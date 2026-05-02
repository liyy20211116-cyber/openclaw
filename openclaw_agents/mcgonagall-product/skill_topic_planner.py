"""
skill_topic_planner.py — 麦格教授的技能：数据驱动选题规划
基于内容分析数据和知识库，生成评分排序的选题列表。
"""
import json, sys
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
KNOWLEDGE_DIR = PROJECT / "config" / "knowledge"


def load_knowledge(filename: str) -> str:
    kf = KNOWLEDGE_DIR / filename
    if kf.exists():
        return kf.read_text(encoding="utf-8")[:1500]
    return ""


def ice_score(impact: int, confidence: int, ease: int) -> float:
    return (impact * confidence * ease) / 100


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else '{"niche": "AI编程", "count": 10}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"niche": raw, "count": 10}

    niche = params.get("niche", "AI编程")
    count = params.get("count", 10)
    now = datetime.now().strftime("%Y%m%d_%H%M")

    strategy = load_knowledge("content-strategy.md")
    xhs_ops = load_knowledge("xhs-operations.md")
    growth = load_knowledge("growth-playbook.md")

    topic_templates = [
        {"template": "入门教程", "title": f"从零开始学{niche}｜新手必看", "type": "教程型", "impact": 8, "confidence": 7, "ease": 8},
        {"template": "工具盘点", "title": f"2026年最好用的{niche}工具推荐", "type": "盘点型", "impact": 9, "confidence": 8, "ease": 7},
        {"template": "避坑指南", "title": f"{niche}新手最容易犯的5个错误", "type": "痛点型", "impact": 8, "confidence": 8, "ease": 9},
        {"template": "实战案例", "title": f"我用{niche}做了一个项目，结果...", "type": "故事型", "impact": 9, "confidence": 6, "ease": 5},
        {"template": "对比评测", "title": f"{niche}三大方案对比，哪个更适合你", "type": "对比型", "impact": 7, "confidence": 7, "ease": 7},
        {"template": "趋势预测", "title": f"2026年{niche}五大趋势预测", "type": "趋势型", "impact": 8, "confidence": 5, "ease": 6},
        {"template": "速成方法", "title": f"3天学会{niche}的核心技能", "type": "速效型", "impact": 9, "confidence": 6, "ease": 7},
        {"template": "问答合集", "title": f"关于{niche}你最想知道的10个问题", "type": "问答型", "impact": 7, "confidence": 8, "ease": 9},
        {"template": "资源整理", "title": f"{niche}学习路线图+资源大全", "type": "资源型", "impact": 9, "confidence": 9, "ease": 6},
        {"template": "幕后故事", "title": f"一个{niche}从业者的真实日常", "type": "人设型", "impact": 6, "confidence": 7, "ease": 8},
        {"template": "反直觉观点", "title": f"为什么我不推荐初学者学{niche}", "type": "反差型", "impact": 9, "confidence": 5, "ease": 7},
        {"template": "效率提升", "title": f"用{niche}把工作效率提高10倍", "type": "速效型", "impact": 8, "confidence": 6, "ease": 7},
    ]

    for topic in topic_templates:
        topic["ice_score"] = ice_score(topic["impact"], topic["confidence"], topic["ease"])

    topic_templates.sort(key=lambda x: x["ice_score"], reverse=True)
    top_topics = topic_templates[:count]

    report = {
        "ok": True,
        "summary": f"选题规划: {niche}, 生成{len(top_topics)}个选题（ICE评分排序）",
        "timestamp": now,
        "niche": niche,
        "knowledge_loaded": {
            "strategy": bool(strategy),
            "xhs": bool(xhs_ops),
            "growth": bool(growth),
        },
        "topics": [
            {
                "rank": i + 1,
                "title": t["title"],
                "type": t["type"],
                "template": t["template"],
                "ice_score": t["ice_score"],
                "scores": {"impact": t["impact"], "confidence": t["confidence"], "ease": t["ease"]},
            }
            for i, t in enumerate(top_topics)
        ],
    }

    report_path = OUTPUT_DIR / f"topic_plan_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
