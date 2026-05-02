"""在已连接的 CDP Chrome 中打开 4 个平台登录页。"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import connect_cdp, DEFAULT_CDP_PORT

TARGETS = [
    ("https://creator.xiaohongshu.com", "xhs"),
    ("https://creator.douyin.com", "douyin"),
    ("https://mp.weixin.qq.com", "wechat-mp"),
    ("https://member.bilibili.com/platform/home.html", "bilibili"),
]


def main() -> int:
    pw, browser, context, _ = connect_cdp(DEFAULT_CDP_PORT)
    try:
        existing_urls = [p.url or "" for p in context.pages]
        for url, name in TARGETS:
            host = url.split("/")[2]
            if any(host in u for u in existing_urls):
                print(f"[skip] {name} already open")
                continue
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
            except Exception as e:
                print(f"[warn] {name} goto failed: {e}")
            print(f"[open] {name}: {url}")
        print("\n[OK] done. scan QR in each tab to login.")
        return 0
    finally:
        try:
            pw.stop()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
