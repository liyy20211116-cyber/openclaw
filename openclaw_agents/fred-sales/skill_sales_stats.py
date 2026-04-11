"""
skill_sales_stats.py — 弗雷德的技能：销售数据统计
扫描 output/proposals 和 output/customers 目录，统计商务活动
"""
import json, os
from datetime import datetime

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT = os.path.join(PROJECT, "output")

stats = {
    "proposals": {"count": 0, "files": []},
    "customers": {"count": 0, "files": []},
    "total_docs": 0,
}

for subdir, key in [("proposals", "proposals"), ("customers", "customers")]:
    dpath = os.path.join(OUTPUT, subdir)
    if not os.path.isdir(dpath):
        continue
    for f in os.listdir(dpath):
        fpath = os.path.join(dpath, f)
        if os.path.isfile(fpath):
            stats[key]["count"] += 1
            stats[key]["files"].append({
                "name": f,
                "modified": datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%Y-%m-%d %H:%M"),
            })
            stats["total_docs"] += 1

mem_dir = os.path.join(PROJECT, "openclaw_agents", "fred-sales", "memory")
work_log = os.path.join(mem_dir, "work_log.md")
if os.path.exists(work_log):
    lines = open(work_log, encoding="utf-8").readlines()
    stats["work_log_entries"] = len([l for l in lines if l.strip().startswith("-")])
else:
    stats["work_log_entries"] = 0

summary = f"商务文档: {stats['total_docs']} 个 | 报价方案: {stats['proposals']['count']} / 客户画像: {stats['customers']['count']} | 工作记录: {stats['work_log_entries']} 条"
print(json.dumps({"ok": True, "summary": summary, "stats": stats}, ensure_ascii=False))
