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

# ------ 路径和常量 ------
HERE        = Path(__file__).parent
CACHE_FILE  = HERE / "token_cache.json"
BASE_WIS    = "https://wis.winnermedical.com"
WIS_SSO_URL = (BASE_WIS +
               "/api/winnerCms/cmsSsoSystem/sso/redirect/ones"
               "?target=aHR0cHM6Ly9vbmVzLndpbm5lcm1lZGljYWwuY29tLw==")
CHROME_EXE  = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT    = 9337

# 凭据（由 WIS 域账号）
WIS_USER    = "91764"
WIS_PASS    = "LLll99..=="


# ------ 缓存读写 ------
def _load_cache() -> dict:
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

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
    key_data = requests.get(BASE_WIS + "/api/user/password/key/get",
                            headers=H, timeout=10).json()["data"]
    pem = f"-----BEGIN PUBLIC KEY-----\n{key_data}\n-----END PUBLIC KEY-----"
    enc_pw = base64.b64encode(
        PKCS1_v1_5.new(RSA.import_key(pem)).encrypt(WIS_PASS.encode())
    ).decode()

    # 登录
    resp = requests.post(
        BASE_WIS + "/api/oauth/web/v2/login", headers=H,
        json={"username": WIS_USER, "password": enc_pw,
              "codeKey": "", "captchaCode": ""},
        timeout=10)
    resp.raise_for_status()
    rj = resp.json()
    if rj.get("code") != 200:
        raise RuntimeError(f"WIS 登录失败: {rj}")
    wis_at = rj["data"]
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

    if _token_valid(token):
        return token

    print("[TokenRefresh] 缓存已过期，通过 WIS SSO 刷新...")

    # Step 1: WIS 登录
    wis_at, wis_ck = _wis_login()
    print(f"[TokenRefresh] WIS 登录成功")

    # Step 2: SSO -> ones-lt
    ones_lt = _playwright_sso(wis_at, wis_ck)
    if not ones_lt:
        raise RuntimeError("ONES SSO 失败：未能获取 ones-lt token")

    print(f"[TokenRefresh] ones-lt 获取成功，长度={len(ones_lt)}")

    # 保存缓存
    cache["ones_lt"] = ones_lt
    _save_cache(cache)

    return ones_lt


if __name__ == "__main__":
    tok = get_token_auto()
    print(f"\n[RESULT] ones-lt ({len(tok)} chars):")
    print(tok[:120] + "...")
