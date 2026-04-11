"""麦格·产品部 — 项目健康仪表板
综合评估一人公司项目的完成度、健康度和下一步优先级。
"""
import json, os, glob
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 麦格·项目健康仪表板 ===\n")

# --- 1. Agent 完备性检查 ---
agents_dir = os.path.join(ROOT, "openclaw_agents")
agent_health = {}
required_files = ["IDENTITY.md"]
optional_files = ["skills.json", "memory/learnings.md"]

for agent_name in sorted(os.listdir(agents_dir)):
    agent_path = os.path.join(agents_dir, agent_name)
    if not os.path.isdir(agent_path):
        continue

    health = {"files": {}, "score": 0, "issues": []}

    for rf in required_files:
        exists = os.path.exists(os.path.join(agent_path, rf))
        health["files"][rf] = exists
        if exists:
            health["score"] += 20
        else:
            health["issues"].append(f"缺少 {rf}")

    skill_files = [f for f in os.listdir(agent_path) if f.startswith("SKILL-") and f.endswith(".md")]
    health["files"]["SKILL-*.md"] = len(skill_files)
    health["score"] += min(30, len(skill_files) * 15)
    if not skill_files:
        health["issues"].append("缺少 SKILL 文件")

    for of in optional_files:
        exists = os.path.exists(os.path.join(agent_path, of))
        health["files"][of] = exists
        if exists:
            health["score"] += 10

    py_scripts = [f for f in os.listdir(agent_path) if f.endswith(".py")]
    health["files"]["*.py"] = len(py_scripts)
    health["score"] += min(20, len(py_scripts) * 5)

    health["score"] = min(100, health["score"])
    agent_health[agent_name] = health

# --- 2. 脚本覆盖率 ---
scripts_dir = os.path.join(ROOT, "scripts")
scripts = [f for f in os.listdir(scripts_dir) if f.endswith(".py") and not f.startswith("_")]
department_scripts = {
    "tech": [s for s in scripts if "tech" in s or "code" in s or "audit" in s.replace("security", "")],
    "finance": [s for s in scripts if "finance" in s or "invoice" in s],
    "growth": [s for s in scripts if "growth" in s or "content" in s or "seo" in s or "news" in s],
    "sales": [s for s in scripts if "sales" in s or "pipeline" in s or "email" in s],
    "audit": [s for s in scripts if "security" in s or "dependency" in s],
    "product": [s for s in scripts if "product" in s or "competitive" in s or "health" in s],
    "customer": [s for s in scripts if "customer" in s or "feedback" in s or "knowledge" in s or "faq" in s],
    "coo": [s for s in scripts if "daily" in s or "company" in s or "memory" in s or "weekly" in s or "learning" in s],
}

# --- 3. 基础设施检查 ---
config_dir = os.path.join(ROOT, "config")
config_files = os.listdir(config_dir) if os.path.isdir(config_dir) else []
skills_count = len(os.listdir(os.path.join(ROOT, "skills"))) if os.path.isdir(os.path.join(ROOT, "skills")) else 0

# --- 4. 产出物检查 ---
output_files = sorted(glob.glob(os.path.join(OUTPUT, "*.json"))) + sorted(glob.glob(os.path.join(OUTPUT, "*.md")))
today = datetime.now().strftime("%Y%m%d")
today_outputs = [f for f in output_files if today in os.path.basename(f)]

# --- 5. 计算总健康分 ---
avg_agent_score = sum(a["score"] for a in agent_health.values()) / max(len(agent_health), 1)
script_coverage = sum(1 for dept, s in department_scripts.items() if s) / max(len(department_scripts), 1) * 100
config_score = min(100, len(config_files) / 7 * 100)

total_health = round((avg_agent_score * 0.4 + script_coverage * 0.3 + config_score * 0.3), 1)

# --- 6. 输出 ---
dashboard = {
    "generated_at": datetime.now().isoformat(),
    "overall_health": total_health,
    "health_grade": "A" if total_health >= 80 else ("B" if total_health >= 60 else ("C" if total_health >= 40 else "D")),
    "agent_health": agent_health,
    "avg_agent_score": round(avg_agent_score, 1),
    "script_coverage": {
        "total_scripts": len(scripts),
        "departments_covered": sum(1 for s in department_scripts.values() if s),
        "total_departments": len(department_scripts),
        "coverage_pct": round(script_coverage, 1),
        "by_department": {k: len(v) for k, v in department_scripts.items()},
    },
    "config_completeness": {
        "files": config_files,
        "count": len(config_files),
        "target": 7,
        "score": round(config_score, 1),
    },
    "skills_count": skills_count,
    "output_today": len(today_outputs),
    "output_total": len(output_files),
}

out_file = os.path.join(OUTPUT, f"project_health_{datetime.now():%Y%m%d}.json")
json.dump(dashboard, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"{'='*50}")
print(f"  项目健康度: {total_health}/100 ({dashboard['health_grade']})")
print(f"{'='*50}")
print(f"\nAgent 平均得分: {avg_agent_score}/100")
for name, health in sorted(agent_health.items(), key=lambda x: -x[1]["score"]):
    status = "[OK]" if health["score"] >= 60 else "[--]" if health["score"] >= 30 else "[XX]"
    print(f"  {status} {name}: {health['score']}/100", end="")
    if health["issues"]:
        print(f" - {', '.join(health['issues'][:2])}", end="")
    print()

print(f"\nScript Coverage: {script_coverage:.0f}% ({sum(1 for s in department_scripts.values() if s)}/{len(department_scripts)} dept)")
for dept, s in sorted(department_scripts.items()):
    print(f"  {'[OK]' if s else '[XX]'} {dept}: {len(s)} scripts")

print(f"\n制度文档: {len(config_files)}/7 ({config_score:.0f}%)")
print(f"技能数量: {skills_count}")
print(f"今日产出: {len(today_outputs)} 个文件")
print(f"\n仪表板: {out_file}")
