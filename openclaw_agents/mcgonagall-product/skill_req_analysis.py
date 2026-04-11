"""
skill_req_analysis.py — 麦格教授的技能：需求分析
分析 req-review-agent 的配置和历史数据，输出需求健康度报告
"""
import json, os
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REQ_AGENT = os.path.join(HERE, "..", "req-review-agent")

report = {"fields": {}, "stats": {}, "recommendations": []}

config_path = os.path.join(REQ_AGENT, "config.json")
try:
    cfg = json.loads(open(config_path, encoding="utf-8").read())
    fields = cfg.get("feishu", {}).get("fields", {})
    report["fields"]["mapped_count"] = len(fields)
    report["fields"]["field_list"] = list(fields.keys())

    products = cfg.get("ones", {}).get("product_uuids", {})
    report["fields"]["product_count"] = len(products)
    report["fields"]["products"] = list(products.keys())

    issue_types = cfg.get("ones", {}).get("issue_types", {})
    report["fields"]["issue_types"] = issue_types
except Exception as e:
    report["fields"]["error"] = str(e)

mem_dir = os.path.join(REQ_AGENT, "memory")
processed_path = os.path.join(mem_dir, "processed_log.json")
try:
    processed = json.loads(open(processed_path, encoding="utf-8").read())
    if isinstance(processed, list):
        report["stats"]["total_processed"] = len(processed)
        approved = sum(1 for p in processed if p.get("action") == "approved")
        rejected = sum(1 for p in processed if p.get("action") == "rejected")
        report["stats"]["approved"] = approved
        report["stats"]["rejected"] = rejected
        report["stats"]["approval_rate"] = f"{round(approved / len(processed) * 100)}%" if processed else "N/A"

        types = {}
        for p in processed:
            t = p.get("req_type", "未知")
            types[t] = types.get(t, 0) + 1
        report["stats"]["by_type"] = types
except:
    report["stats"]["total_processed"] = 0
    report["stats"]["note"] = "暂无处理记录"

pending_path = os.path.join(mem_dir, "pending_reviews.json")
try:
    pending = json.loads(open(pending_path, encoding="utf-8").read())
    count = len(pending) if isinstance(pending, (list, dict)) else 0
    report["stats"]["pending_count"] = count
except:
    report["stats"]["pending_count"] = 0

if report["stats"].get("total_processed", 0) == 0:
    report["recommendations"].append("尚无处理记录，建议先运行一次扫描流程验证端到端通路")
if report["stats"].get("pending_count", 0) > 10:
    report["recommendations"].append(f"待审批积压 {report['stats']['pending_count']} 条，建议增加审批频率")
if report["fields"].get("product_count", 0) < 3:
    report["recommendations"].append("产品映射较少，确认是否需要补充更多产品线")

summary_parts = [
    f"字段映射: {report['fields'].get('mapped_count', 0)} 个",
    f"产品线: {report['fields'].get('product_count', 0)} 个",
    f"已处理: {report['stats'].get('total_processed', 0)} 条",
    f"待审批: {report['stats'].get('pending_count', 0)} 条",
]
summary = " | ".join(summary_parts)

print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))
