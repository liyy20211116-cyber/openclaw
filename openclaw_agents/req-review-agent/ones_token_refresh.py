"""
ONES Token 全自动刷新模块
流程：WIS RSA 登录 → Playwright SSO → 捕获 ones-lt

用法：
    token = get_token_auto()  # 返回有效的 Bearer token 字符串
"""
import json, os, time, base64, subprocess, shutil, tempfile, re
from pathlib import Path
import requests
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5


def _safe_json_dumps(data) -> str:
    try:
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return repr(data)


def _truncate(text: str, limit: int = 500) -> str:
    text = text or ""
    return text if len(text) <= limit else text[:limit] + "..."

# ------ 路径和常量 ------
HERE        = Path(__file__).parent
CACHE_FILE  = HERE / "token_cache.json"
BASE_WIS    = "https://wis.winnermedical.com"
WIS_SSO_URL = (BASE_WIS +
               "/api/winnerCms/cmsSsoSystem/sso/redirect/ones"
               "?target=aHR0cHM6Ly9vbmVzLndpbm5lcm1lZGljYWwuY29tLw==")
CHROME_EXE  = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT    = 9337

WIS_USER    = os.environ.get("WIS_USER", "91764")
WIS_PASS    = os.environ.get("WIS_PASS", "")


# ------ 缓存读写 ------
def _load_cache() -> dict:
    try:
        data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

    # 兼容两种缓存格式：
    # 1) 旧格式：{"ones_lt": "..."}
    # 2) 手动刷新脚本格式：{"token": "...", "cookie": "..."}
    if data.get("token") and not data.get("ones_lt"):
        data["ones_lt"] = data["token"]
    return data

def _save_cache(data: dict):
    CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ------ JWT 到期检查 ------
def _token_valid(token: str, buffer_secs: int = 30) -> bool:
    """检查 JWT 是否在 buffer_secs 秒内有效"""
    if not token or len(token) < 50:
        return False
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return False
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        exp = payload.get("exp", 0)
        return time.time() < exp - buffer_secs
    except Exception:
        return False


# ------ WIS RSA 登录 ------
def _wis_login() -> tuple[str, dict]:
    """返回 (wis_access_token, cookies_dict)"""
    H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
         "Content-Type": "application/json",
         "Referer": BASE_WIS + "/login.html", "Origin": BASE_WIS}

    # 获取 RSA 公钥
    key_resp = requests.get(BASE_WIS + "/api/user/password/key/get",
                            headers=H, timeout=10)
    key_resp.raise_for_status()
    key_json = key_resp.json()
    key_data = key_json["data"]
    pem = f"-----BEGIN PUBLIC KEY-----\n{key_data}\n-----END PUBLIC KEY-----"
    enc_pw = base64.b64encode(
        PKCS1_v1_5.new(RSA.import_key(pem)).encrypt(WIS_PASS.encode("utf-8"))
    ).decode()

    payload = {
        "username": WIS_USER,
        "password": enc_pw,
        "codeKey": "",
        "captchaCode": ""
    }

    # 登录
    resp = requests.post(
        BASE_WIS + "/api/oauth/web/v2/login", headers=H,
        json=payload,
        timeout=10)

    raw = resp.text
    try:
        rj = resp.json()
    except Exception:
        raise RuntimeError(
            f"WIS 登录响应非 JSON: status={resp.status_code}, body={_truncate(raw)}"
        )

    if resp.status_code >= 400:
        raise RuntimeError(
            f"WIS 登录 HTTP 失败: status={resp.status_code}, body={_safe_json_dumps(rj)}"
        )

    if rj.get("code") != 200:
        raise RuntimeError(
            f"WIS 登录失败: status={resp.status_code}, body={_safe_json_dumps(rj)}"
        )

    wis_at = rj.get("data")
    if not wis_at:
        raise RuntimeError(
            f"WIS 登录成功但未返回 access token: body={_safe_json_dumps(rj)}"
        )

    cookies = {c.name: c.value for c in resp.cookies}
    cookies["wis_access_token"] = wis_at
    return wis_at, cookies


# ------ Playwright SSO 获取 ones-lt ------
def _playwright_sso(wis_at: str, wis_cookies: dict) -> str:
    """使用 WIS cookies 走 SSO 流程，返回 ones-lt token"""
    tmp_dir = tempfile.mkdtemp(prefix="ones_sso_")
    proc = subprocess.Popen(
        [CHROME_EXE,
         f"--remote-debugging-port={CDP_PORT}",
         "--no-first-run", "--disable-extensions",
         f"--user-data-dir={tmp_dir}",
         "--headless=new", "--window-size=1280,900",
         "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW
    )

    try:
        time.sleep(3)
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

        ones_lt = None

        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(
                f"http://127.0.0.1:{CDP_PORT}", timeout=10000)
            context = (browser.contexts[0]
                       if browser.contexts else browser.new_context())

            # 注入 WIS cookies
            for name, value in wis_cookies.items():
                context.add_cookies([{
                    "name": name, "value": value,
                    "domain": ".winnermedical.com", "path": "/"
                }])

            page = context.new_page()

            # 监听 set-cookie: ones-lt
            def on_resp(resp):
                nonlocal ones_lt
                ck = resp.headers.get("set-cookie", "")
                if "ones-lt" in ck and not ones_lt:
                    m = re.search(r"ones-lt=([^;]+)", ck)
                    if m:
                        ones_lt = m.group(1)

            context.on("response", on_resp)

            # 访问 WIS SSO redirect
            try:
                page.goto(WIS_SSO_URL, wait_until="domcontentloaded",
                          timeout=25000)
            except PWTimeout:
                pass

            # 等待 ones-lt（最多 20 秒，轮询 cookie）
            for _ in range(20):
                if ones_lt:
                    break
                cookies = context.cookies()
                tok = next(
                    (c["value"] for c in cookies if c["name"] == "ones-lt"),
                    None)
                if tok and len(tok) > 100:
                    ones_lt = tok
                    break
                time.sleep(1)

            browser.close()

        return ones_lt or ""
    finally:
        proc.terminate()
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ------ 对外接口 ------
def get_token_auto() -> str:
    """
    返回有效的 ONES Bearer token。
    优先使用缓存；若过期则通过 WIS SSO 全自动刷新。
    """
    cache = _load_cache()
    token = cache.get("ones_lt", "")

    if token:
        print(f"[TokenRefresh] cache token found, len={len(token)}")
        if _token_valid(token):
            print("[TokenRefresh] cache token still valid, reuse it")
            return token
        else:
            print("[TokenRefresh] cache token expired, refreshing")

    print("[TokenRefresh] cache expired, refresh via WIS SSO...")

    if not WIS_PASS:
        raise RuntimeError(
            "WIS_PASS 环境变量未设置。请先设置: $env:WIS_PASS='你的密码' 或在系统环境变量中配置"
        )

    # Step 1: WIS 登录
    try:
        wis_at, wis_ck = _wis_login()
    except Exception as e:
        print(f"[TokenRefresh] WIS login failed: {e}")
        raise
    print("[TokenRefresh] WIS login ok")

    # Step 2: SSO -> ones-lt
    ones_lt = _playwright_sso(wis_at, wis_ck)
    if not ones_lt:
        raise RuntimeError("ONES SSO failed: ones-lt token not found")

    print(f"[TokenRefresh] ones-lt acquired, len={len(ones_lt)}")

    # 保存缓存
    cache["ones_lt"] = ones_lt
    _save_cache(cache)

    return ones_lt


if __name__ == "__main__":
    tok = get_token_auto()
    print(f"\n[RESULT] ones-lt ({len(tok)} chars):")
    print(tok[:120] + "...")
