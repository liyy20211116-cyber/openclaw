"""
skill_token_report.py — 珀西的技能：Token 消耗报告
读取 LLM 调用日志，统计各部门 Token 使用量
"""
import json, os, re
from datetime import datetime, timedelta

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGENTS_DIR = os.path.join(PROJECT, "openclaw_agents")

report = {"departments": {}, "total_tokens_estimated": 0, "period": "recent"}

agent_names = {
    "jarvis-coo": "执行办公室",
    "hermione-tech": "技术部",
    "mcgonagall-product": "产品部",
    "luna-growth": "内容增长部",
    "fred-sales": "销售商务部",
    "percy-finance": "财务部",
    "snape-audit": "审计风控部",
    "dobby-customer": "客户成功部",
    "req-review-agent": "需求审核",
}

for agent_id, dept_name in agent_names.items():
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    if not os.path.isdir(agent_dir):
        continue

    mem_dir = os.path.join(agent_dir, "memory")
    skills_file = os.path.join(agent_dir, "skills.json")

    skill_count = 0
    if os.path.exists(skills_file):
        try:
            skill_count = len(json.loads(open(skills_file, encoding="utf-8").read()))
        except:
            pass

    mem_files = 0
    mem_size = 0
    if os.path.isdir(mem_dir):
        for f in os.listdir(mem_dir):
            fp = os.path.join(mem_dir, f)
            if os.path.isfile(fp):
                mem_files += 1
                mem_size += os.path.getsize(fp)

    work_log = os.path.join(mem_dir, "work_log.md") if os.path.isdir(mem_dir) else ""
    work_entries = 0
    if os.path.exists(work_log):
        work_entries = len([l for l in open(work_log, encoding="utf-8").readlines() if l.strip().startswith("-")])

    estimated_tokens = skill_count * 500 + mem_files * 200 + work_entries * 100
    report["departments"][dept_name] = {
        "agent_id": agent_id,
        "skills": skill_count,
        "memory_files": mem_files,
        "memory_size_kb": round(mem_size / 1024, 1),
        "work_log_entries": work_entries,
        "estimated_token_cost": estimated_tokens,
    }
    report["total_tokens_estimated"] += estimated_tokens

active_depts = [d for d, v in report["departments"].items() if v["skills"] > 0]
idle_depts = [d for d, v in report["departments"].items() if v["skills"] == 0]

summary_parts = [
    f"活跃部门: {len(active_depts)}/{len(report['departments'])}",
    f"总技能数: {sum(v['skills'] for v in report['departments'].values())}",
    f"估算 Token 消耗: ~{report['total_tokens_estimated']}",
]
if idle_depts:
    summary_parts.append(f"空闲部门: {', '.join(idle_depts)}")

print(json.dumps({"ok": True, "summary": " | ".join(summary_parts), "report": report}, ensure_ascii=False))
