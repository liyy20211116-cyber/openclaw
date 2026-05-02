"""
skill_team_roster.py - 纳威的技能：团队花名册
生成公司组织架构和人员配置清单
"""
import json, os

AGENTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROSTER = [
    {"name": "贾维斯", "role": "执行总裁 (COO)", "dept": "执行办公室", "agent_id": "jarvis-coo", "level": "L4"},
    {"name": "赫敏·格兰杰", "role": "技术总监 (CTO)", "dept": "技术部", "agent_id": "hermione-tech", "level": "L3"},
    {"name": "米勒娃·麦格", "role": "产品总监 (CPO)", "dept": "产品部", "agent_id": "mcgonagall-product", "level": "L3"},
    {"name": "卢娜·洛夫古德", "role": "增长负责人 (CGO)", "dept": "内容增长部", "agent_id": "luna-growth", "level": "L3"},
    {"name": "弗雷德·韦斯莱", "role": "销售总监 (CSO)", "dept": "销售商务部", "agent_id": "fred-sales", "level": "L3"},
    {"name": "珀西·韦斯莱", "role": "财务总监 (CFO)", "dept": "财务部", "agent_id": "percy-finance", "level": "L3"},
    {"name": "西弗勒斯·斯内普", "role": "审计官 (CAO)", "dept": "审计风控部", "agent_id": "snape-audit", "level": "L3"},
    {"name": "多比", "role": "客户成功经理", "dept": "客户成功部", "agent_id": "dobby-customer", "level": "L3"},
    {"name": "纳威·隆巴顿", "role": "人资总监 (CHRO)", "dept": "人资部", "agent_id": "neville-hr", "level": "L3"},
]

entries = []
for member in ROSTER:
    agent_dir = os.path.join(AGENTS_DIR, member["agent_id"])
    active = os.path.isdir(agent_dir) and os.path.exists(os.path.join(agent_dir, "skills.json"))
    entries.append({**member, "status": "在岗" if active else "待配置"})

active_count = sum(1 for e in entries if e["status"] == "在岗")
summary = f"团队花名册: {active_count}/{len(entries)} 人在岗"

print(json.dumps({"ok": True, "summary": summary, "roster": entries}, ensure_ascii=False))
