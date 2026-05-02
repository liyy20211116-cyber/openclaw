"""
skill_lead_scorer.py — 弗雷德的技能：线索智能评分
对销售管道中的客户线索做多维度评分，自动排序优先级
"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data_raw")
PIPELINE_FILE = os.path.join(DATA_DIR, "sales_pipeline.json")

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""

SCORING_RULES = {
    "stage_score": {
        "线索": 5, "初步接触": 10, "需求确认": 20,
        "方案演示": 30, "报价": 40, "谈判": 50, "成交": 100, "流失": 0,
    },
    "source_score": {
        "朋友推荐": 20, "老客户转介": 25, "社交媒体": 10,
        "搜索引擎": 8, "陌生拜访": 5, "展会": 15,
    },
}


def score_lead(lead):
    score = 0
    value = lead.get("value", 0)
    score += min(30, value // 1000 * 5)
    score += SCORING_RULES["stage_score"].get(lead.get("stage", ""), 5)
    score += SCORING_RULES["source_score"].get(lead.get("source", ""), 5)
    return min(100, score)


def main():
    out = SkillOutput()

    if not os.path.exists(PIPELINE_FILE):
        out.summary = "暂无销售管道数据，已生成示例模板"
        out.data = {"scored_leads": []}
        out.emit()
        return

    data = json.loads(open(PIPELINE_FILE, encoding="utf-8").read())
    leads = data.get("leads", [])

    scored = []
    for lead in leads:
        s = score_lead(lead)
        priority = "高优" if s >= 60 else ("中等" if s >= 30 else "低")
        scored.append({
            "name": lead.get("name", "未知"),
            "stage": lead.get("stage", ""),
            "value": lead.get("value", 0),
            "source": lead.get("source", ""),
            "score": s,
            "priority": priority,
        })

    scored.sort(key=lambda x: -x["score"])

    data["leads"] = [{**l, "score": s["score"], "priority": s["priority"]}
                     for l, s in zip(leads, sorted([next(sc for sc in scored if sc["name"] == le.get("name", ""))
                                                     for le in leads], key=lambda x: 0))]
    data["last_scored"] = time.strftime("%Y-%m-%d %H:%M")

    with open(PIPELINE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    high = sum(1 for s in scored if s["priority"] == "高优")
    total_value = sum(s["value"] for s in scored)

    out.summary = f"线索评分完成: {len(scored)} 条线索 | 高优 {high} 条 | 总价值 CNY{total_value:,}"
    if scored:
        out.summary += f" | Top: {scored[0]['name']} ({scored[0]['score']}分)"
    out.data = {"scored_leads": scored[:10], "total_leads": len(scored), "high_priority": high, "total_value": total_value}
    out.metrics["leadsProcessed"] = len(scored)
    out.emit()


if __name__ == "__main__":
    main()
