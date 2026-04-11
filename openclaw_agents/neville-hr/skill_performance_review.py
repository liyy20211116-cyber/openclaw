"""纳威·人资部 — 全员绩效评估
对每个 Agent 进行多维度绩效评分。
"""
import os, json, re
from datetime import datetime, timedelta

ROOT = r"D:\FY003"
AGENTS_DIR = os.path.join(ROOT, "openclaw_agents")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== Neville's Performance Review ===\n")

WEIGHTS = {
    "completeness": 25,
    "skills": 20,
    "memory_activity": 20,
    "scripts": 20,
    "growth": 15,
}

def evaluate_agent(agent_name):
    agent_dir = os.path.join(AGENTS_DIR, agent_name)
    scores = {}

    # 1. File completeness
    required = ["IDENTITY.md"]
    found = sum(1 for f in required if os.path.exists(os.path.join(agent_dir, f)))
    scores["completeness"] = found / len(required) * WEIGHTS["completeness"]

    # 2. Skills
    skill_files = [f for f in os.listdir(agent_dir) if f.startswith("SKILL-") and f.endswith(".md")]
    scores["skills"] = min(WEIGHTS["skills"], len(skill_files) * 10)

    # 3. Memory activity
    learnings_file = os.path.join(agent_dir, "memory", "learnings.md")
    mem_score = 0
    learnings_count = 0
    if os.path.exists(learnings_file):
        content = open(learnings_file, "r", encoding="utf-8").read()
        learnings_count = content.count("---") - 1
        mem_score += min(10, learnings_count * 2)
        mtime = datetime.fromtimestamp(os.path.getmtime(learnings_file))
        days_since = (datetime.now() - mtime).days
        if days_since <= 1:
            mem_score += 10
        elif days_since <= 7:
            mem_score += 5
    scores["memory_activity"] = min(WEIGHTS["memory_activity"], mem_score)

    # 4. Scripts
    py_files = [f for f in os.listdir(agent_dir) if f.endswith(".py")]
    scores["scripts"] = min(WEIGHTS["scripts"], len(py_files) * 5)

    # 5. Growth (has domain_knowledge + reflection_log)
    growth_score = 0
    if os.path.exists(os.path.join(agent_dir, "memory", "domain_knowledge.json")):
        growth_score += 8
    if os.path.exists(os.path.join(agent_dir, "memory", "reflection_log.json")):
        growth_score += 7
    scores["growth"] = min(WEIGHTS["growth"], growth_score)

    total = sum(scores.values())
    grade = "S" if total >= 90 else ("A" if total >= 75 else ("B" if total >= 60 else ("C" if total >= 40 else "D")))

    return {
        "agent": agent_name,
        "total_score": round(total, 1),
        "grade": grade,
        "scores": {k: round(v, 1) for k, v in scores.items()},
        "learnings_count": learnings_count,
        "improvement_areas": [k for k, v in scores.items() if v < WEIGHTS[k] * 0.6],
    }

# Run evaluation
agents = [d for d in sorted(os.listdir(AGENTS_DIR))
          if os.path.isdir(os.path.join(AGENTS_DIR, d))]

results = []
for agent in agents:
    result = evaluate_agent(agent)
    results.append(result)
    print(f"  [{result['grade']}] {result['total_score']:5.1f}/100 | {agent}")
    if result["improvement_areas"]:
        print(f"       Improve: {', '.join(result['improvement_areas'])}")

# Summary
avg_score = sum(r["total_score"] for r in results) / max(len(results), 1)
grade_dist = {}
for r in results:
    grade_dist[r["grade"]] = grade_dist.get(r["grade"], 0) + 1

report = {
    "review_date": datetime.now().isoformat(),
    "reviewer": "neville-hr",
    "summary": {
        "total_agents": len(results),
        "avg_score": round(avg_score, 1),
        "grade_distribution": grade_dist,
        "top_performer": max(results, key=lambda x: x["total_score"])["agent"] if results else None,
        "needs_attention": [r["agent"] for r in results if r["total_score"] < 50],
    },
    "reviews": results,
}

out_file = os.path.join(OUTPUT, f"performance_review_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'='*40}")
print(f"Team Avg: {avg_score:.1f}/100")
print(f"Grades: {grade_dist}")
if report["summary"]["needs_attention"]:
    print(f"Needs attention: {', '.join(report['summary']['needs_attention'])}")
print(f"\nReport: {out_file}")
