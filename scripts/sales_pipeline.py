"""弗雷德·销售部 — 销售管线与线索管理
管理潜在客户线索、跟进状态和转化漏斗。
"""
import json, os
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_DIR = os.path.join(ROOT, "data_raw")
os.makedirs(OUTPUT, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

PIPELINE_FILE = os.path.join(DATA_DIR, "sales_pipeline.json")

print("=== 弗雷德·销售管线管理 ===\n")

STAGES = ["线索", "初步接触", "需求确认", "方案演示", "报价", "谈判", "成交", "流失"]

if os.path.exists(PIPELINE_FILE):
    pipeline = json.load(open(PIPELINE_FILE, "r", encoding="utf-8"))
    print(f"加载了 {len(pipeline.get('leads', []))} 条线索")
else:
    pipeline = {
        "created": datetime.now().isoformat(),
        "leads": [
            {"id": "L001", "name": "示例客户A", "stage": "线索", "source": "社交媒体",
             "value": 5000, "contact": "", "notes": "对 AI 自动化有兴趣", "updated": datetime.now().isoformat()},
            {"id": "L002", "name": "示例客户B", "stage": "初步接触", "source": "朋友推荐",
             "value": 10000, "contact": "", "notes": "已发送产品介绍", "updated": datetime.now().isoformat()},
        ]
    }
    json.dump(pipeline, open(PIPELINE_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("已创建示例管线数据")

leads = pipeline.get("leads", [])

# --- 漏斗统计 ---
stage_counts = {s: 0 for s in STAGES}
stage_values = {s: 0 for s in STAGES}
for lead in leads:
    s = lead.get("stage", "线索")
    if s in stage_counts:
        stage_counts[s] += 1
        stage_values[s] += lead.get("value", 0)

print("\n--- 销售漏斗 ---")
max_count = max(stage_counts.values()) if stage_counts.values() else 1
for stage in STAGES:
    count = stage_counts[stage]
    value = stage_values[stage]
    bar = "█" * int(count / max(max_count, 1) * 20)
    print(f"  {stage:6s} | {bar:20s} | {count} 条 | ¥{value:,.0f}")

total_value = sum(l.get("value", 0) for l in leads)
won = sum(l.get("value", 0) for l in leads if l.get("stage") == "成交")
lost = sum(l.get("value", 0) for l in leads if l.get("stage") == "流失")

print(f"\n--- 关键指标 ---")
print(f"  总线索: {len(leads)} 条")
print(f"  管线总价值: ¥{total_value:,.0f}")
print(f"  已成交: ¥{won:,.0f}")
print(f"  已流失: ¥{lost:,.0f}")
print(f"  转化率: {won/total_value*100:.1f}%" if total_value else "  转化率: N/A")

# --- 输出报告 ---
report = {
    "date": datetime.now().isoformat(),
    "funnel": {s: {"count": stage_counts[s], "value": stage_values[s]} for s in STAGES},
    "kpi": {
        "total_leads": len(leads),
        "pipeline_value": total_value,
        "won_value": won,
        "lost_value": lost,
        "conversion_rate": round(won / total_value * 100, 1) if total_value else 0
    }
}

out_file = os.path.join(OUTPUT, f"sales_report_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\n销售报告: {out_file}")
