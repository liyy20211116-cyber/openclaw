"""6 平台热榜聚合脚本（阶段 1.2）。

调 `opencli <platform> ...` 抓 6 个平台热点，聚合成一份选题日报。
默认平台：douyin / xiaohongshu / bilibili / zhihu / hackernews / producthunt

用法：
    python hot_aggregator.py                              # 默认 6 平台
    python hot_aggregator.py --platforms douyin,bilibili  # 指定
    python hot_aggregator.py --limit 20                   # 每平台 20 条

输出：
    output/daily_hot/hot_YYYY-MM-DD.json  结构化数据
    output/daily_hot/hot_YYYY-MM-DD.md    选题日报（Luna 可直接用）
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
OUTPUT_DIR = PROJECT_ROOT / "output" / "daily_hot"


PLATFORM_CMDS = {
    "douyin":       ("douyin", "trending"),
    "xiaohongshu":  ("xiaohongshu", "hot"),
    "bilibili":     ("bilibili", "hot"),
    "zhihu":        ("zhihu", "hot"),
    "hackernews":   ("hackernews", "top"),
    "producthunt":  ("producthunt", "today"),
    "weibo":        ("weibo", "hot"),
    "twitter":      ("twitter", "trending"),
    "reddit":       ("reddit", "rising"),
}


def have_opencli() -> bool:
    return shutil.which("opencli") is not None


def fetch_platform(platform: str, limit: int = 20) -> list[dict]:
    if platform not in PLATFORM_CMDS:
        return []
    cmd_pair = PLATFORM_CMDS[platform]
    cmd = ["opencli", *cmd_pair, "--limit", str(limit), "-f", "json"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60, encoding="utf-8", errors="ignore")
        if out.returncode != 0:
            return []
        data = json.loads(out.stdout or "[]")
        return data if isinstance(data, list) else data.get("items", [])
    except Exception as e:
        print(f"[{platform}] 抓取失败: {e}", file=sys.stderr)
        return []


def emit_markdown(agg: dict, date_str: str) -> str:
    lines = [f"# 今日热点聚合 · {date_str}", "", "> 来源：OpenCLI 桥 · 6 平台数据快照", ""]
    for platform, items in agg.items():
        lines.append(f"## {platform}（{len(items)} 条）")
        lines.append("")
        for i, it in enumerate(items[:15], 1):
            title = (it.get("title") or it.get("name") or it.get("text") or "")[:80]
            metric = it.get("hot") or it.get("score") or it.get("views") or it.get("likes") or ""
            url = it.get("url") or it.get("link") or ""
            if url:
                lines.append(f"{i}. [{title}]({url})  `热度 {metric}`")
            else:
                lines.append(f"{i}. {title}  `热度 {metric}`")
        lines.append("")
    lines.append("---")
    lines.append("## Luna 选题建议（Top 10）")
    lines.append("")
    scored = []
    for platform, items in agg.items():
        for it in items:
            title = it.get("title") or it.get("name") or ""
            score = float(it.get("hot") or it.get("score") or 0 or 0)
            if title:
                scored.append((score, platform, title))
    scored.sort(reverse=True)
    for i, (s, p, t) in enumerate(scored[:10], 1):
        lines.append(f"{i}. **[{p}]** {t[:80]}  （热度 {s:.0f}）")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--platforms", default="douyin,xiaohongshu,bilibili,zhihu,hackernews,producthunt")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--mock", action="store_true", help="跳过 opencli 调用，输出 mock 数据（用于首次演示）")
    args = ap.parse_args()

    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
    date_str = dt.date.today().isoformat()

    if args.mock or not have_opencli():
        if not args.mock:
            print("[!] 未检测到 opencli，切换 mock 模式")
        agg = {
            p: [{"title": f"[Mock] {p} 热点 #{i}", "hot": 10000 - i * 100, "url": f"https://example.com/{p}/{i}"}
                for i in range(1, min(args.limit, 15) + 1)]
            for p in platforms
        }
    else:
        agg = {p: fetch_platform(p, args.limit) for p in platforms}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUTPUT_DIR / f"hot_{date_str}.json"
    md_path = OUTPUT_DIR / f"hot_{date_str}.md"
    json_path.write_text(json.dumps(agg, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(emit_markdown(agg, date_str), encoding="utf-8")

    print(f"[OK] {json_path}")
    print(f"[OK] {md_path}")
    for p, items in agg.items():
        print(f"  {p:15s}: {len(items)} items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
