"""CDP 连接测试：列出当前 Chrome 所有 tab，验证 Jarvis 能否接管。

用法：
    python scripts/publish/probe_cdp.py
    python scripts/publish/probe_cdp.py --port 9333
"""
from __future__ import annotations

import argparse
import sys

from _common import probe_cdp, DEFAULT_CDP_PORT


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=DEFAULT_CDP_PORT)
    args = ap.parse_args()

    try:
        tabs = probe_cdp(args.port)
    except ConnectionError as e:
        print(f"[ERR] {e}")
        return 1

    print(f"[OK] CDP 连接成功，共 {len(tabs)} 个 tab：\n")
    for i, t in enumerate(tabs, 1):
        title = (t.get("title") or "").strip()
        url = t.get("url", "")
        kind = t.get("type", "")
        print(f"  [{i}] [{kind}] {title[:50]}")
        print(f"       → {url[:100]}")

    print("\n平台登录态自检：")
    targets = {
        "小红书创作": "creator.xiaohongshu.com",
        "抖音创作者": "creator.douyin.com",
        "公众号后台": "mp.weixin.qq.com",
        "B 站创作":   "member.bilibili.com",
    }
    for name, key in targets.items():
        hit = any(key in (t.get("url") or "") for t in tabs)
        marker = "OK" if hit else "--"
        state = "tab_open" if hit else "not_open"
        print(f"  [{marker}] {name:8} {state}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
