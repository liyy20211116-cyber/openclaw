"""
capture_ones_token.py — 在独立浏览器中完成一次 ONES 登录，并导出完整会话

新策略：
1. 启动独立 Edge 浏览器（不占用用户现有 User Data）
2. 用户在该窗口中手动完成 ONES 登录
3. 脚本捕获 Authorization Bearer / cookies / localStorage / sessionStorage
4. 将结果写入 token_cache.json，供页面自动化建单脚本复用

用法：
  python capture_ones_token.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

HERE = Path(__file__).parent
CACHE_PATH = HERE / "token_cache.json"
ONES_URL = "https://ones.winnermedical.com/project/"
ONES_DOMAIN = "ones.winnermedical.com"
EDGE_CHANNEL = "msedge"


def save_cache(token: str, org_uuid: str | None, source: str, cookies: list | None = None, storage_dump: dict | None = None):
    payload = {
        "ones_lt": token,
        "source": source,
    }
    if org_uuid:
        payload["ones_org_uuid"] = org_uuid
    if cookies is not None:
        payload["cookies"] = cookies
    if storage_dump:
        payload["storage"] = storage_dump
    CACHE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def extract_token_from_headers(headers: dict) -> str | None:
    auth = headers.get("authorization") or headers.get("Authorization")
    if not auth:
        return None
    m = re.match(r"Bearer\s+(.+)", auth)
    return m.group(1).strip() if m else None


def read_storage(page) -> dict:
    try:
        return page.evaluate(
            """
            () => {
              const ls = {};
              const ss = {};
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i); ls[k] = localStorage.getItem(k);
              }
              for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i); ss[k] = sessionStorage.getItem(k);
              }
              return {localStorage: ls, sessionStorage: ss};
            }
            """
        )
    except Exception:
        return {"localStorage": {}, "sessionStorage": {}}


def run():
    captured: dict = {"token": None, "org_uuid": None, "source": None, "cookies": [], "storage": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(channel=EDGE_CHANNEL, headless=False)
        context = browser.new_context()
        page = context.new_page()

        def on_request(req):
            try:
                token = extract_token_from_headers(req.headers)
                if token and ONES_DOMAIN in req.url:
                    captured["token"] = token
                    captured["source"] = f"request:{req.method}:{req.url}"
            except Exception:
                pass

        page.on("request", on_request)

        print("[INFO] 已打开独立 Edge 浏览器。请在该窗口中手动登录 ONES。")
        print("[INFO] 登录完成后，保持页面停留在 ONES 项目页，脚本会自动捕获会话。")

        page.goto(ONES_URL, wait_until="domcontentloaded", timeout=60000)

        for _ in range(120):
            try:
                page.wait_for_timeout(1000)
                current_url = page.url
                if ONES_DOMAIN in current_url and "/identity/" not in current_url:
                    try:
                        page.reload(wait_until="domcontentloaded", timeout=15000)
                    except Exception:
                        pass
                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightTimeoutError:
                        pass

                    cookies = context.cookies([ONES_URL])
                    captured["cookies"] = cookies
                    for c in cookies:
                        if c.get("name") == "ones-org-uuid":
                            captured["org_uuid"] = c.get("value")
                        if c.get("name") == "ones-lt" and not captured["token"]:
                            captured["token"] = c.get("value")
                            captured["source"] = "cookie:ones-lt"

                    captured["storage"] = read_storage(page)
                    if captured["token"]:
                        break
            except Exception:
                pass

        if not captured["token"]:
            browser.close()
            raise RuntimeError("未能捕获到完整 ONES 会话。请确认已在弹出浏览器中完成登录，并停留在 ONES 项目页。")

        save_cache(
            captured["token"],
            captured.get("org_uuid"),
            captured.get("source") or "unknown",
            cookies=captured.get("cookies"),
            storage_dump=captured.get("storage"),
        )
        print("[OK] 已捕获 ONES 完整会话")
        print(f"[OK] source={captured.get('source')}")
        if captured.get("org_uuid"):
            print(f"[OK] ones_org_uuid={captured['org_uuid']}")
        print(f"[OK] token_cache={CACHE_PATH}")
        browser.close()


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
