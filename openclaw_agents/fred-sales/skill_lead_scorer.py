"""弗雷德·销售部 — 线索评分器
根据客户信息自动评分，帮助优先跟进高价值线索。
"""
import json, os
from datetime import datetime

ROOT = r"D:\FY003"
PIPELINE_FILE = os.path.join(ROOT, "data_raw", "sales_pipeline.json")

SCORING_RULES = {
    "value_score": lambda v: min(30, v // 1000 * 5),
    "stage_score": {
        "线索": 5, "初步接触": 10, "需求确认": 20,
        "方案演示": 30, "报价": 40, "谈判": 50, "成交": 100, "流失": 0
    },
    "source_score": {
        "朋友推荐": 20, "老客户转介": 25, "社交媒体": 10,
        "搜索引擎": 8, "陌生拜访": 5, "展会": 15
    }
}

def score_lead(lead):
    score = 0
    score += SCORING_RULES["value_score"](lead.get("value", 0))
    score += SCORING_RULES["stage_score"].get(lead.get("stage", ""), 5)
    score += SCORING_RULES["source_score"].get(lead.get("source", ""), 5)
    return min(100, score)

def main():
    if not os.path.exists(PIPELINE_FILE):
        print("No pipeline data found")
        return

    data = json.load(open(PIPELINE_FILE, "r", encoding="utf-8"))
    leads = data.get("leads", [])

    scored = []
    for lead in leads:
        lead["score"] = score_lead(lead)
        lead["priority"] = "HIGH" if lead["score"] >= 60 else ("MEDIUM" if lead["score"] >= 30 else "LOW")
        scored.append(lead)

    scored.sort(key=lambda x: -x["score"])

    print("=== Lead Scoring Results ===\n")
    for lead in scored:
        print(f"  [{lead['priority']:6s}] {lead['score']:3d}/100 | {lead['name']} | {lead['stage']} | CNY{lead.get('value',0):,}")

    data["leads"] = scored
    data["last_scored"] = datetime.now().isoformat()
    json.dump(data, open(PIPELINE_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nScored {len(scored)} leads, pipeline updated.")

if __name__ == "__main__":
    main()
