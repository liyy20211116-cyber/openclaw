"""
add_lead.py — 快速录入销售线索到 CRM
用法：python scripts/add_lead.py "客户名" "阶段" 金额 "来源" "备注"
阶段：线索/初步接触/需求确认/方案演示/报价/谈判/成交/流失
"""
import json, sys, os
from datetime import datetime
from pathlib import Path

PIPELINE_FILE = Path(__file__).resolve().parent.parent / "data_raw" / "sales_pipeline.json"


def load_pipeline():
    if PIPELINE_FILE.exists():
        return json.loads(PIPELINE_FILE.read_text(encoding="utf-8"))
    return {"created": datetime.now().isoformat(), "leads": []}


def save_pipeline(data):
    PIPELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
    PIPELINE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def next_id(leads):
    nums = [int(l["id"].replace("L", "")) for l in leads if l["id"].startswith("L") and l["id"][1:].isdigit()]
    return f"L{max(nums, default=0) + 1:03d}"


VALID_STAGES = ["线索", "初步接触", "需求确认", "方案演示", "报价", "谈判", "成交", "流失"]


def main():
    if len(sys.argv) < 3:
        print(f"用法: python {sys.argv[0]} \"客户名\" \"阶段\" [金额] [来源] [备注]")
        print(f"阶段: {', '.join(VALID_STAGES)}")
        print(f"\n当前管道:")
        data = load_pipeline()
        for l in data["leads"]:
            print(f"  {l['id']} | {l['name']:15s} | {l['stage']:6s} | ¥{l.get('value',0):>8,} | {l.get('source','')}")
        print(f"\n共 {len(data['leads'])} 条线索")
        return

    name = sys.argv[1]
    stage = sys.argv[2] if len(sys.argv) > 2 else "线索"
    value = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    source = sys.argv[4] if len(sys.argv) > 4 else "手动录入"
    notes = sys.argv[5] if len(sys.argv) > 5 else ""

    if stage not in VALID_STAGES:
        print(f"无效阶段: {stage}，可选: {', '.join(VALID_STAGES)}")
        return

    data = load_pipeline()
    lead_id = next_id(data["leads"])

    lead = {
        "id": lead_id,
        "name": name,
        "stage": stage,
        "source": source,
        "value": value,
        "contact": "",
        "notes": notes,
        "updated": datetime.now().isoformat(),
    }
    data["leads"].append(lead)
    save_pipeline(data)

    print(f"✅ 线索已录入: {lead_id} | {name} | {stage} | ¥{value:,} | {source}")
    print(f"   管道共 {len(data['leads'])} 条线索，总价值 ¥{sum(l.get('value',0) for l in data['leads']):,}")


if __name__ == "__main__":
    main()
