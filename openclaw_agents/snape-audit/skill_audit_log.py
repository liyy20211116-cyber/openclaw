"""
skill_audit_log.py — 斯内普的技能：审计日志检查
检查各部门的工作日志和记忆文件完整性
"""
import json, os
from datetime import datetime

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGENTS_DIR = os.path.join(PROJECT, "openclaw_agents")

audit_results = []

agents = ["jarvis-coo", "hermione-tech", "mcgonagall-product", "luna-growth",
          "fred-sales", "percy-finance", "dobby-customer", "req-review-agent"]

for agent_id in agents:
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    if not os.path.isdir(agent_dir):
        audit_results.append({"agent": agent_id, "status": "missing", "issues": ["agent 目录不存在"]})
        continue

    entry = {"agent": agent_id, "status": "ok", "issues": [], "checks": {}}

    identity = os.path.exists(os.path.join(agent_dir, "IDENTITY.md"))
    entry["checks"]["identity"] = identity
    if not identity:
        entry["issues"].append("缺少 IDENTITY.md")

    skills = os.path.exists(os.path.join(agent_dir, "skills.json"))
    entry["checks"]["skills_defined"] = skills
    if not skills:
        entry["issues"].append("缺少 skills.json（无可执行技能）")

    mem_dir = os.path.join(agent_dir, "memory")
    if os.path.isdir(mem_dir):
        mem_files = os.listdir(mem_dir)
        entry["checks"]["memory_files"] = len(mem_files)
        learnings = os.path.exists(os.path.join(mem_dir, "learnings.md"))
        entry["checks"]["has_learnings"] = learnings
        if not learnings:
            entry["issues"].append("无 learnings.md（知识未沉淀）")
    else:
        entry["checks"]["memory_files"] = 0
        entry["issues"].append("无 memory 目录（无记忆能力）")

    if entry["issues"]:
        entry["status"] = "warning" if len(entry["issues"]) < 3 else "fail"

    audit_results.append(entry)

ok = sum(1 for r in audit_results if r["status"] == "ok")
warn = sum(1 for r in audit_results if r["status"] == "warning")
fail = sum(1 for r in audit_results if r["status"] in ("fail", "missing"))
all_issues = []
for r in audit_results:
    for iss in r.get("issues", []):
        all_issues.append(f"{r['agent']}: {iss}")

summary = f"审计结果: {ok} 合规 / {warn} 警告 / {fail} 不合规 (共 {len(audit_results)} 部门)"
print(json.dumps({
    "ok": fail == 0,
    "summary": summary,
    "results": audit_results,
    "all_issues": all_issues[:15],
}, ensure_ascii=False))
