"""微信发送工具（阶段 2.1）。

基于 wxauto 发送消息到指定群/联系人。默认 dry-run，需 --confirm 才真正发送。

用法：
    python wx_send.py --to "AI一人公司研究所" --type text --content "晚上好"
    python wx_send.py --to "CEO" --type image --content "D:/path/to/poster.png"
    python wx_send.py --to "CEO" --type file --content "D:/path/to/report.pdf"
    python wx_send.py --to "CEO" --type text --content "内容" --confirm

注意：
    - 仅支持 Windows + 微信桌面版（4.0 以下，wxauto 3.9.11.17.5）
    - 需先扫码登录微信
    - 纯本地自动化，**严禁营销群发**
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def load_wxauto():
    try:
        from wxauto import WeChat  # type: ignore
        return WeChat
    except ImportError:
        print("缺少 wxauto，请运行：pip install wxauto==3.9.11.17.5", file=sys.stderr)
        sys.exit(2)


def main() -> int:
    ap = argparse.ArgumentParser(description="WeChat 发送")
    ap.add_argument("--to", required=True, help="群名或联系人名")
    ap.add_argument("--type", default="text", choices=["text", "image", "file"])
    ap.add_argument("--content", required=True, help="文本内容或文件路径")
    ap.add_argument("--confirm", action="store_true", help="不加此参数则只打印不发送")
    ap.add_argument("--dry-run", action="store_true", help="显式 dry-run（等同不加 confirm）")
    args = ap.parse_args()

    will_send = args.confirm and not args.dry_run

    print(f"[wx_send] to={args.to} type={args.type} confirm={will_send}")
    if args.type == "text":
        preview = (args.content[:80] + "...") if len(args.content) > 80 else args.content
        print(f"  text: {preview}")
    else:
        p = Path(args.content)
        if not p.exists():
            print(f"[!] 文件不存在: {p}", file=sys.stderr)
            return 2
        print(f"  {args.type}: {p}")

    if not will_send:
        print("[i] 未加 --confirm，跳过实际发送（dry-run）")
        return 0

    WeChat = load_wxauto()
    wx = WeChat()
    if args.type == "text":
        wx.SendMsg(msg=args.content, who=args.to)
    elif args.type == "image":
        wx.SendFiles(filepath=args.content, who=args.to)
    elif args.type == "file":
        wx.SendFiles(filepath=args.content, who=args.to)
    print("[wx_send] 已发送")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
