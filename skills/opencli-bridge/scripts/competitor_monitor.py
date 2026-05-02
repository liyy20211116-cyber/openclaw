"""对标账号每日追踪（阶段 2.3）。

基于 opencli 抓多个目标账号最近的作品，对比昨天数据做增量分析。
对标账号：阿彦能行、数字生命卡兹克、拉斐尔2077、阿森编程日记、小天 fotos、Yapie 程序员哥、Maaker.AI 小马哥、方鑫三个金 等。

用法：
    python competitor_monitor.py                                      # 用默认名单
    python competitor_monitor.py --accounts "阿彦能行,数字生命卡兹克"
    python competitor_monitor.py --platform douyin

输出：
    output/competitor/<account>_<date>.json  原始快照
    output/competitor/daily_report_<date>.md 汇总日报
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = PROJECT_ROOT / "output" / "competitor"

DEFAULT_ACCOUNTS = [
    "阿彦能行",
    "数字生命卡兹克",
    "拉斐尔2077",
    "阿森编程日记",
    "小天fotos",
    "Yapie",
    "Maaker.AI",
    "方鑫三个金",
    "强哥的ai笔记",
    "李一鸣OPC",
    "EcomAi墨青",
    "Xi Xu",
]


def have_opencli() -> bool:
    return shutil.which("opencli") is not None


def fetch_user(platform: str, account: str, limit: int = 20) -> list[dict]:
    if not have_opencli():
        return []
    cmd_map = {
        "douyin":      ["opencli", "douyin", "user",     "--name", account, "--limit", str(limit), "-f", "json"],
        "xiaohongshu": ["opencli", "xiaohongshu", "user", "--name", account, "--limit", str(limit), "-f", "json"],
        "bilibili":    ["opencli", "bilibili", "user",   "--name", account, "--limit", str(limit), "-f", "json"],
    }
    cmd = cmd_map.get(platform)
    if not cmd:
        return []
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60, encoding="utf-8", errors="ignore")
        if out.returncode != 0:
            return []
        data = json.loads(out.stdout or "[]")
        return data if isinstance(data, list) else data.get("items", [])
    except Exception as e:
        print(f"[!] {platform}/{account}: {e}", file=sys.stderr)
        return []


def load_previous(account: str, platform: str) -> list[dict]:
    yest = (dt.date.today() - dt.timedelta(days=1)).isoformat()
    p = OUT_DIR / f"{account}_{platform}_{yest}.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def diff_new_posts(today: list[dict], yesterday: list[dict]) -> list[dict]:
    y_ids = {x.get("id") or x.get("aweme_id") or x.get("url") for x in yesterday if x}
    return [x for x in today if (x.get("id") or x.get("aweme_id") or x.get("url")) not in y_ids]


def emit_report(accounts_data: dict, date_str: str) -> str:
    lines = [f"# 对标账号日报 · {date_str}", "", "> 数据来源：OpenCLI 桥", ""]
    total_new = 0
    for acc, platforms in accounts_data.items():
        lines.append(f"## @{acc}")
        for p, info in platforms.items():
            new_posts = info.get("new_posts", [])
            total_new += len(new_posts)
            lines.append(f"- **{p}**：新增 {len(new_posts)} 条 / 快照 {len(info.get('today', []))} 条")
            for np in new_posts[:5]:
                title = (np.get("title") or np.get("desc") or "")[:60]
                lines.append(f"  - {title}")
        lines.append("")
    lines.insert(2, f"> 累计新增作品：{total_new} 条\n")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--accounts", default=",".join(DEFAULT_ACCOUNTS))
    ap.add_argument("--platform", default="douyin,xiaohongshu,bilibili")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--mock", action="store_true")
    args = ap.parse_args()

    accounts = [a.strip() for a in args.accounts.split(",") if a.strip()]
    platforms = [p.strip() for p in args.platform.split(",") if p.strip()]
    date_str = dt.date.today().isoformat()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    agg: dict = {}
    for acc in accounts:
        agg[acc] = {}
        for p in platforms:
            if args.mock or not have_opencli():
                today = [{"id": f"mock_{acc}_{p}_{i}", "title": f"[Mock] {acc} 最新作品 #{i}"} for i in range(3)]
            else:
                today = fetch_user(p, acc, args.limit)
            yest = load_previous(acc, p)
            new_posts = diff_new_posts(today, yest)
            snap = OUT_DIR / f"{acc}_{p}_{date_str}.json"
            try:
                snap.write_text(json.dumps(today, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception:
                pass
            agg[acc][p] = {"today": today, "new_posts": new_posts}

    md = emit_report(agg, date_str)
    md_path = OUT_DIR / f"daily_report_{date_str}.md"
    md_path.write_text(md, encoding="utf-8")
    print(f"[OK] {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
