"""微信群聊 N 小时摘要生成（阶段 2.1）。

抓取群聊近 N 小时消息 → 调 LLM（GLM / Kimi / DeepSeek）总结成结构化日报。
对标 Vita0519/wechat_summary。

用法：
    python wx_group_digest.py --group "AI一人公司研究所" --hours 24
    python wx_group_digest.py --group "CEO与贾维斯" --hours 24 --send-back
    python wx_group_digest.py --group xxx --hours 12 --model glm-4.6

依赖：
    - wxauto（拉消息）
    - requests（调 LLM API）
    - 环境变量 JARVIS_LLM_API_KEY, JARVIS_LLM_API_BASE

输出：
    output/reports/wx_digest_<group>_<date>.md
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DIR = PROJECT_ROOT / "output" / "reports"


PROMPT_TEMPLATE = """你是一个中文的群聊总结助手。请为一个微信群聊记录，提取并总结每个时间段大家在重点讨论的话题内容。

请将下面的群聊内容总结成一份今日群聊报告，不多于 10 个话题（如果还有更多，可在后面简短补充）。

每个话题包含：
- 话题名（50 字以内，带序号 1️⃣2️⃣3️⃣，附带热度 🔥 数量）
- 话题概述（100 字以内）
- 主要参与者
- 关键观点 / 争议点（如有）

结尾附：
- Top 3 最值得 CEO 关注的信息
- 建议回复 / 后续行动（可选）

---
群聊记录：

{records}
---
"""


def load_wxauto():
    try:
        from wxauto import WeChat  # type: ignore
        return WeChat
    except ImportError:
        print("缺少 wxauto，请运行：pip install wxauto==3.9.11.17.5", file=sys.stderr)
        sys.exit(2)


def fetch_messages(group: str, hours: int) -> list[str]:
    """用 wxauto 拉取群消息（wxauto 的能力随版本变化，这里用简化接口）。"""
    WeChat = load_wxauto()
    wx = WeChat()
    wx.ChatWith(group)
    msgs = []
    try:
        all_msgs = wx.GetAllMessage()
    except Exception:
        all_msgs = []
    threshold = dt.datetime.now() - dt.timedelta(hours=hours)
    for m in all_msgs or []:
        ts = getattr(m, "time", None)
        if ts and isinstance(ts, dt.datetime) and ts < threshold:
            continue
        sender = getattr(m, "sender", "?")
        content = getattr(m, "content", "") or ""
        msgs.append(f"[{sender}] {content}")
    return msgs


def call_llm(prompt: str, model: str = "glm-4.6") -> str:
    import requests  # type: ignore
    api_key = os.environ.get("JARVIS_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    api_base = os.environ.get("JARVIS_LLM_API_BASE") or "https://open.bigmodel.cn/api/paas/v4"
    if not api_key:
        return "[模拟总结] 缺少 JARVIS_LLM_API_KEY 环境变量，以下是占位内容：\n\n1️⃣ 话题 A 🔥🔥🔥\n2️⃣ 话题 B 🔥🔥\n3️⃣ 话题 C 🔥"

    try:
        resp = requests.post(
            f"{api_base}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 2000,
            },
            timeout=120,
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        return f"[LLM {resp.status_code}] {resp.text[:200]}"
    except Exception as e:
        return f"[LLM error] {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", required=True)
    ap.add_argument("--hours", type=int, default=24)
    ap.add_argument("--model", default="glm-4.6")
    ap.add_argument("--send-back", action="store_true", help="摘要发回群内")
    ap.add_argument("--mock", action="store_true", help="跳过 wxauto，使用 mock 记录")
    args = ap.parse_args()

    if args.mock:
        records = [
            "[张三] 今天 GLM-4.6 出了，比 K2.5 便宜",
            "[李四] 真的？我刚试，延迟确实低",
            "[CEO]  Luna 可以帮我跑一下新视频生产了吗？",
            "[贾维斯] 已派给 Luna，预计 30 分钟完成",
            "[王五] 抖音小红书的一人公司话题量本周爆了",
        ]
    else:
        records = fetch_messages(args.group, args.hours)

    if not records:
        print(f"[!] 群 {args.group} 近 {args.hours} 小时无消息（或 wxauto 未登录）")
        return 1

    prompt = PROMPT_TEMPLATE.format(records="\n".join(records))
    summary = call_llm(prompt, model=args.model)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    date_str = dt.date.today().isoformat()
    safe_group = "".join(c for c in args.group if c.isalnum() or c in "-_")[:20]
    out_path = OUTPUT_DIR / f"wx_digest_{safe_group}_{date_str}.md"
    out_path.write_text(
        f"# 微信群聊摘要 · {args.group} · 近 {args.hours} 小时\n\n> 生成于 {dt.datetime.now():%Y-%m-%d %H:%M}\n\n{summary}\n",
        encoding="utf-8",
    )
    print(f"[OK] {out_path}")

    if args.send_back and not args.mock:
        from wx_send import main as wx_send_main  # type: ignore
        sys.argv = [
            "wx_send", "--to", args.group, "--type", "text",
            "--content", summary[:3000], "--confirm"
        ]
        wx_send_main()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
