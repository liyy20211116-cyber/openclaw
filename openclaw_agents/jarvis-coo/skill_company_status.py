"""
skill_company_status.py — 贾维斯的技能：公司全局状态汇总
遍历所有部门，汇总服务状态、技能配置、记忆健康度
"""
import json, os, socket

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGENTS_DIR = os.path.join(PROJECT, "openclaw_agents")

departments = {}
services = {}

# 服务连通性
def check_port(host, port):
    try:
        s = socket.create_connection((host, port), timeout=3)
        s.close()
        return True
    except:
        return False

services["jarvis_backend"] = "运行中" if check_port("127.0.0.1", 18782) else "未启动"
services["jarvis_frontend"] = "运行中" if check_port("127.0.0.1", 5173) else "未启动"
services["openclaw_gateway"] = "运行中" if check_port("127.0.0.1", 18789) else "未启动"
services["content_pipeline"] = "运行中" if check_port("127.0.0.1", 18781) else "未启动"

agent_map = {
    "jarvis-coo": "贾维斯（COO）",
    "hermione-tech": "赫敏（技术）",
    "mcgonagall-product": "麦格（产品）",
    "luna-growth": "卢娜（增长）",
    "fred-sales": "弗雷德（销售）",
    "percy-finance": "珀西（财务）",
    "snape-audit": "斯内普（审计）",
    "dobby-customer": "多比（客服）",
    "req-review-agent": "需求审核 Agent",
}

total_skills = 0
total_memory_files = 0

for agent_id, name in agent_map.items():
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    dept = {"name": name, "status": "unknown", "skills": 0, "memory": 0, "has_identity": False}

    if not os.path.isdir(agent_dir):
        dept["status"] = "missing"
        departments[agent_id] = dept
        continue

    dept["has_identity"] = os.path.exists(os.path.join(agent_dir, "IDENTITY.md"))

    skills_path = os.path.join(agent_dir, "skills.json")
    if os.path.exists(skills_path):
        try:
            skills = json.loads(open(skills_path, encoding="utf-8").read())
            dept["skills"] = len(skills)
            dept["skill_names"] = [s["name"] for s in skills]
            total_skills += len(skills)
        except:
            pass

    mem_dir = os.path.join(agent_dir, "memory")
    if os.path.isdir(mem_dir):
        mem_count = len(os.listdir(mem_dir))
        dept["memory"] = mem_count
        total_memory_files += mem_count

    if dept["skills"] > 0 and dept["memory"] > 0:
        dept["status"] = "active"
    elif dept["skills"] > 0 or dept["memory"] > 0:
        dept["status"] = "partial"
    elif dept["has_identity"]:
        dept["status"] = "idle"
    else:
        dept["status"] = "missing"

    departments[agent_id] = dept

active = sum(1 for d in departments.values() if d["status"] == "active")
partial = sum(1 for d in departments.values() if d["status"] == "partial")
idle = sum(1 for d in departments.values() if d["status"] == "idle")
online_svc = sum(1 for v in services.values() if v == "运行中")

summary_parts = [
    f"部门: {active} 满编/{partial} 部分/{idle} 空闲 (共 {len(departments)})",
    f"总技能: {total_skills}",
    f"服务: {online_svc}/{len(services)} 在线",
]

print(json.dumps({
    "ok": active >= 3 and online_svc >= 2,
    "summary": " | ".join(summary_parts),
    "services": services,
    "departments": departments,
    "totals": {"skills": total_skills, "memory_files": total_memory_files},
}, ensure_ascii=False))
