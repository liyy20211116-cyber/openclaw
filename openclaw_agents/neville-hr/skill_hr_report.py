"""
skill_hr_report.py - 纳威的技能：人事汇总报告
汇总全公司 Agent 配置状态、技能覆盖率和编制情况
"""
import json, os

AGENTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEPT_NAMES = {
    "jarvis-coo": "执行办公室",
    "hermione-tech": "技术部",
    "mcgonagall-product": "产品部",
    "luna-growth": "内容增长部",
    "fred-sales": "销售商务部",
    "percy-finance": "财务部",
    "snape-audit": "审计风控部",
    "dobby-customer": "客户成功部",
    "neville-hr": "人资部",
    "req-review-agent": "需求审核",
}

report = {"departments": {}, "total_agents": 0, "total_skills": 0, "fully_configured": 0}

for agent_id, dept_name in DEPT_NAMES.items():
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    if not os.path.isdir(agent_dir):
        continue

    skills_path = os.path.join(agent_dir, "skills.json")
    skill_count = 0
    script_skills = 0
    has_memory = os.path.isdir(os.path.join(agent_dir, "memory"))

    if os.path.exists(skills_path):
        try:
            skills = json.loads(open(skills_path, encoding="utf-8").read())
            skill_count = len(skills)
            script_skills = sum(1 for s in skills if s.get("type") == "script")
        except Exception:
            pass

    py_files = [f for f in os.listdir(agent_dir) if f.endswith(".py")]
    configured = skill_count > 0 and has_memory

    report["departments"][dept_name] = {
        "agent_id": agent_id,
        "skills": skill_count,
        "script_skills": script_skills,
        "py_files": len(py_files),
        "has_memory": has_memory,
        "configured": configured,
    }
    report["total_agents"] += 1
    report["total_skills"] += skill_count
    if configured:
        report["fully_configured"] += 1

total = report["total_agents"]
configured = report["fully_configured"]
summary = f"编制: {total} 人 | 技能总数: {report['total_skills']} | 完整配置: {configured}/{total} | 缺配置: {total - configured}"

print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))
