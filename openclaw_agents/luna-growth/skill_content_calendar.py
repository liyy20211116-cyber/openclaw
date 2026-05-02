"""
skill_content_calendar.py — 卢娜的技能：内容日历生成器
基于关键词研究和知识库，生成未来一周的内容发布计划。
"""
import json, sys
from pathlib import Path
from datetime import datetime, timedelta

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
KNOWLEDGE_DIR = PROJECT / "config" / "knowledge"


def load_knowledge(filename: str) -> str:
    kf = KNOWLEDGE_DIR / filename
    if kf.exists():
        return kf.read_text(encoding="utf-8")[:2000]
    return ""


def generate_calendar(topic: str, platforms: list[str], days: int = 7) -> dict:
    xhs_knowledge = load_knowledge("xhs-operations.md")
    douyin_knowledge = load_knowledge("douyin-operations.md")
    strategy = load_knowledge("content-strategy.md")

    today = datetime.now()
    calendar = []

    platform_schedule = {
        "小红书": {"best_times": ["12:00", "20:00"], "format": "图文/视频笔记", "frequency": "每天1篇"},
        "抖音": {"best_times": ["12:00", "18:00", "21:00"], "format": "短视频15-60秒", "frequency": "每天1-2条"},
        "公众号": {"best_times": ["08:00", "20:00"], "format": "长文章", "frequency": "每周2-3篇"},
        "B站": {"best_times": ["18:00", "21:00"], "format": "中长视频3-15分钟", "frequency": "每周2条"},
    }

    for day_offset in range(days):
        date = today + timedelta(days=day_offset)
        day_name = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][date.weekday()]
        day_plan = {
            "date": date.strftime("%Y-%m-%d"),
            "day": day_name,
            "posts": [],
        }

        for platform in platforms:
            sched = platform_schedule.get(platform, {"best_times": ["20:00"], "format": "内容", "frequency": "适量"})

            content_type_rotation = [
                f"教程型：「{topic}入门指南」",
                f"对比型：「{topic} vs 传统方式」",
                f"案例型：「用{topic}的实战经验」",
                f"盘点型：「5个{topic}工具推荐」",
                f"痛点型：「{topic}最常见的3个坑」",
                f"趋势型：「2026年{topic}新趋势」",
                f"问答型：「{topic}常见问题解答」",
            ]

            suggestion = content_type_rotation[day_offset % len(content_type_rotation)]

            day_plan["posts"].append({
                "platform": platform,
                "time": sched["best_times"][0],
                "format": sched["format"],
                "topic_suggestion": suggestion,
                "status": "planned",
            })

        calendar.append(day_plan)

    return {
        "topic": topic,
        "platforms": platforms,
        "period": f"{today.strftime('%Y-%m-%d')} ~ {(today + timedelta(days=days-1)).strftime('%Y-%m-%d')}",
        "total_posts": sum(len(d["posts"]) for d in calendar),
        "calendar": calendar,
        "knowledge_loaded": {
            "xhs": bool(xhs_knowledge),
            "douyin": bool(douyin_knowledge),
            "strategy": bool(strategy),
        },
    }


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else '{"topic": "AI编程", "platforms": ["小红书", "抖音"]}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"topic": raw, "platforms": ["小红书", "抖音"]}

    topic = params.get("topic", "AI编程")
    platforms = params.get("platforms", ["小红书", "抖音"])
    days = params.get("days", 7)

    now = datetime.now().strftime("%Y%m%d_%H%M")
    calendar = generate_calendar(topic, platforms, days)

    report = {
        "ok": True,
        "summary": f"内容日历: {topic}, {len(platforms)}个平台, {days}天, 共{calendar['total_posts']}条计划",
        "timestamp": now,
        "calendar": calendar,
    }

    report_path = OUTPUT_DIR / f"content_calendar_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
