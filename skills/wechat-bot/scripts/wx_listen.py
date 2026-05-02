"""微信消息监听守护进程（阶段 2.1）。

监听指定群/联系人的新消息；识别 @Jarvis 或 #jarvis 触发词；
转发给 Jarvis-COO 的 /ceo_chat HTTP 入口；回复写回微信。

用法：
    python wx_listen.py --groups "AI一人公司研究所" --contacts "CEO" --forward-to http://127.0.0.1:18781/ceo_chat
    python wx_listen.py --config skills/wechat-bot/config.json

注意事项：
    - 仅支持 Windows + 微信桌面版
    - 建议使用小号/工作号
    - CTRL+C 停止
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("缺少 requests，请运行：pip install requests", file=sys.stderr)
    sys.exit(2)

TRIGGER = re.compile(r"(@Jarvis|#jarvis|贾维斯)\b", re.IGNORECASE)


def load_wxauto():
    try:
        from wxauto import WeChat  # type: ignore
        return WeChat
    except ImportError:
        print("缺少 wxauto，请运行：pip install wxauto==3.9.11.17.5", file=sys.stderr)
        sys.exit(2)


def is_trigger(text: str) -> bool:
    return bool(TRIGGER.search(text or ""))


def forward_to_jarvis(forward_url: str, chat_key: str, sender: str, msg: str, timeout: int = 30) -> str:
    try:
        resp = requests.post(
            forward_url,
            json={"chat": chat_key, "sender": sender, "message": msg, "stream": False},
            timeout=timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("reply") or data.get("message") or "(Jarvis 暂无回复)"
        return f"[Jarvis API {resp.status_code}] {resp.text[:200]}"
    except Exception as e:
        return f"[Jarvis 调用失败] {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--groups", default="", help="逗号分隔的群名")
    ap.add_argument("--contacts", default="", help="逗号分隔的联系人名")
    ap.add_argument("--forward-to", default="http://127.0.0.1:18781/ceo_chat")
    ap.add_argument("--config", default=None)
    ap.add_argument("--dry-run", action="store_true", help="不发送回复")
    args = ap.parse_args()

    if args.config:
        cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
        args.groups = ",".join(cfg.get("groups", []))
        args.contacts = ",".join(cfg.get("contacts", []))
        args.forward_to = cfg.get("forward_to", args.forward_to)

    groups = [g.strip() for g in args.groups.split(",") if g.strip()]
    contacts = [c.strip() for c in args.contacts.split(",") if c.strip()]
    if not groups and not contacts:
        print("请提供 --groups 或 --contacts 或 --config", file=sys.stderr)
        return 2

    WeChat = load_wxauto()
    wx = WeChat()
    for name in groups + contacts:
        try:
            wx.AddListenChat(who=name, savepic=False)
            print(f"[listen] 已添加监听: {name}")
        except Exception as e:
            print(f"[!] 添加监听 {name} 失败: {e}")

    print(f"[listen] 开始监听，转发到 {args.forward_to} ...（Ctrl+C 退出）")
    try:
        while True:
            msgs = wx.GetListenMessage()
            for chat, items in (msgs or {}).items():
                chat_key = getattr(chat, "who", str(chat))
                for m in items:
                    text = getattr(m, "content", "") or ""
                    sender = getattr(m, "sender", "") or "unknown"
                    if not is_trigger(text):
                        continue
                    print(f"[{chat_key}] {sender}: {text}")
                    reply = forward_to_jarvis(args.forward_to, chat_key, sender, text)
                    print(f"  -> {reply[:200]}")
                    if args.dry_run:
                        continue
                    try:
                        wx.SendMsg(msg=reply, who=chat_key)
                    except Exception as e:
                        print(f"  [!] 回复失败: {e}")
            time.sleep(2)
    except KeyboardInterrupt:
        print("\n[listen] 退出")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
