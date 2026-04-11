"""
skill_budget_check.py — 珀西的技能：预算审核
检查各部门资源使用是否合理，输出预警
"""
import json, os

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGENTS_DIR = os.path.join(PROJECT, "openclaw_agents")

BUDGET_LIMITS = {
    "hermione-tech": 5000,
    "mcgonagall-product": 3000,
    "luna-growth": 4000,
    "fred-sales": 3000,
    "percy-finance": 1000,
    "snape-audit": 2000,
    "dobby-customer": 2000,
    "jarvis-coo": 3000,
}

alerts = []
dept_status = []

for agent_id, budget in BUDGET_LIMITS.items():
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    mem_dir = os.path.join(agent_dir, "memory")

    total_size = 0
    if os.path.isdir(mem_dir):
        for f in os.listdir(mem_dir):
            fp = os.path.join(mem_dir, f)
            if os.path.isfile(fp):
                total_size += os.path.getsize(fp)

    usage_estimate = total_size // 4
    usage_pct = round(usage_estimate / budget * 100) if budget > 0 else 0

    status = "normal"
    if usage_pct > 90:
        status = "critical"
        alerts.append(f"{agent_id} 预算使用 {usage_pct}%，即将超标!")
    elif usage_pct > 70:
        status = "warning"
        alerts.append(f"{agent_id} 预算使用 {usage_pct}%，需注意")

    dept_status.append({
        "agent_id": agent_id,
        "budget": budget,
        "estimated_usage": usage_estimate,
        "usage_pct": usage_pct,
        "status": status,
    })

ok_count = sum(1 for d in dept_status if d["status"] == "normal")
warn_count = sum(1 for d in dept_status if d["status"] == "warning")
crit_count = sum(1 for d in dept_status if d["status"] == "critical")

summary = f"预算检查: {ok_count} 正常 / {warn_count} 警告 / {crit_count} 超标"
if alerts:
    summary += "\n预警: " + "; ".join(alerts[:3])

print(json.dumps({"ok": crit_count == 0, "summary": summary, "departments": dept_status, "alerts": alerts}, ensure_ascii=False))
