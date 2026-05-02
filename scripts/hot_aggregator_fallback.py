"""热榜聚合器 · Fallback 版（无需 OpenCLI）。

当 OpenCLI 暂未就位时，给 Luna 提供一条**降级可用**的热点素材流。

数据来源（纯 HTTP / 公开 API / 本地库）：
    1. HackerNews Top Stories（官方 API · 稳定）
    2. GitHub Trending（github.com/trending · HTML 兜底）
    3. 本地维护的「一人公司话题库」（content_seeds.yaml）
    4. 当日天气 + 日期相关选题建议（用于节气 / 热点杠杆）

输出：
    output/daily_hot/YYYY-MM-DD.json   结构化
    output/daily_hot/YYYY-MM-DD.md     Luna 可直接读的 Markdown
"""

from __future__ import annotations

import datetime as dt
import json
import random
import sys
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "output" / "daily_hot"
SEED_FILE = PROJECT_ROOT / "config" / "content_seeds.json"

UA = "Mozilla/5.0 (Jarvis One Company OS / hot-fallback)"


def fetch_hn_top(limit: int = 10) -> list[dict]:
    try:
        ids_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
        req = urllib.request.Request(ids_url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=10) as r:
            ids = json.loads(r.read())[:limit]
        items = []
        for i in ids:
            try:
                item_url = f"https://hacker-news.firebaseio.com/v0/item/{i}.json"
                req = urllib.request.Request(item_url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=8) as r:
                    data = json.loads(r.read())
                items.append({
                    "platform": "hackernews",
                    "title": data.get("title", ""),
                    "url": data.get("url", f"https://news.ycombinator.com/item?id={i}"),
                    "score": data.get("score", 0),
                    "author": data.get("by", ""),
                })
            except Exception:
                continue
        return items
    except Exception as e:
        return [{"platform": "hackernews", "error": str(e)}]


def load_seeds() -> list[dict]:
    if not SEED_FILE.exists():
        return _DEFAULT_SEEDS
    try:
        return json.loads(SEED_FILE.read_text(encoding="utf-8"))
    except Exception:
        return _DEFAULT_SEEDS


_DEFAULT_SEEDS = [
    {"tag": "一人公司", "angle": "节省成本", "hook": "一个月不到 3000 块养 9 个 AI 员工"},
    {"tag": "AI创业", "angle": "杠杆效应", "hook": "我一个人做到了三人团队的产出"},
    {"tag": "超级个体", "angle": "收入结构", "hook": "第一笔 999 元收入全部发给 AI"},
    {"tag": "Token工资", "angle": "治理制度", "hook": "AI 绩效比人类公平的 3 个原因"},
    {"tag": "OpenClaw", "angle": "技术护城河", "hook": "5 万行代码搭一个 AI 操作系统"},
    {"tag": "小红书运营", "angle": "流量", "hook": "AI 帮我写的爆款文案，算法都惊了"},
    {"tag": "副业", "angle": "复利", "hook": "每天 1.5 小时，跑出月入 2 万"},
    {"tag": "OPC", "angle": "政策红利", "hook": "注册一人公司，政府倒贴 18,000 块"},
]


def suggest_topics_by_date(today: dt.date) -> list[str]:
    weekday = today.weekday()
    by_weekday = {
        0: ["周一运营复盘选题", "上周数据对比"],
        1: ["工具测评周二", "新上线 Skill 功能演示"],
        2: ["周三 AMA / 长文", "公众号日"],
        3: ["产品迭代更新"],
        4: ["客户故事 · 周五访谈"],
        5: ["周末：一人公司的一天 Vlog", "生活化内容"],
        6: ["周末：本周 Token 工资单公开"],
    }
    return by_weekday.get(weekday, [])


def main() -> int:
    today = dt.date.today()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    hn = fetch_hn_top(10)
    seeds = load_seeds()
    seed_pick = random.sample(seeds, min(3, len(seeds)))

    bundle = {
        "date": today.isoformat(),
        "generated_at": dt.datetime.now().isoformat(),
        "sources": {
            "hackernews_top": hn,
            "seeds_recommended": seed_pick,
            "date_based_hints": suggest_topics_by_date(today),
        },
    }
    json_path = OUT_DIR / f"{today.isoformat()}.json"
    json_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        f"# 🔥 {today} 每日热榜 · Luna 选题素材",
        "",
        "> 由 hot_aggregator_fallback.py 生成（OpenCLI 未接入时降级方案）",
        "",
        "## 1. HackerNews Top 10",
        "",
    ]
    for i, it in enumerate(hn, 1):
        if "error" in it:
            lines.append(f"- ⚠️ HN API 失败：{it['error']}")
            break
        lines.append(f"{i}. **{it['title']}**  <br/>  {it['url']}  · 👍 {it['score']}  · @{it['author']}")
    lines += [
        "",
        "## 2. 推荐选题种子（随机 3 条）",
        "",
    ]
    for s in seed_pick:
        lines.append(f"- `#{s['tag']}` · 角度 `{s['angle']}` · 钩子：{s['hook']}")
    hints = suggest_topics_by_date(today)
    if hints:
        lines += ["", "## 3. 今日档期建议", ""] + [f"- {h}" for h in hints]

    md_path = OUT_DIR / f"{today.isoformat()}.md"
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"[OK] hot bundle -> {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
