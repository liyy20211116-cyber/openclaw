"""
skill_performance_review.py — 纳威的技能：全员绩效评估
对每个 Agent 进行多维度绩效评分，输出绩效报告
"""
import json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
AGENTS_DIR = os.path.join(PROJECT_ROOT, "openclaw_agents")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "performance")

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""

WEIGHTS = {"completeness": 25, "skills": 20, "memory_activity": 20, "scripts": 20, "growth": 15}

DEPT_NAMES = {
    "jarvis-coo": "执行办(贾维斯)", "hermione-tech": "技术部(赫敏)",
    "mcgonagall-product": "产品部(麦格)", "luna-growth": "增长部(露娜)",
    "fred-sales": "销售部(弗雷德)", "percy-finance": "财务部(珀西)",
    "snape-audit": "审计部(斯内普)", "dobby-customer": "客户部(多比)",
    "neville-hr": "人资部(纳威)",
}


def evaluate_agent(agent_name):
    agent_dir = os.path.join(AGENTS_DIR, agent_name)
    scores = {}

    has_identity = os.path.exists(os.path.join(agent_dir, "IDENTITY.md"))
    has_skills = os.path.exists(os.path.join(agent_dir, "skills.json"))
    has_memory = os.path.isdir(os.path.join(agent_dir, "memory"))
    completeness = sum([has_identity, has_skills, has_memory]) / 3
    scores["completeness"] = round(completeness * WEIGHTS["completeness"], 1)

    skill_count = 0
    skills_path = os.path.join(agent_dir, "skills.json")
    if os.path.exists(skills_path):
        try:
            skill_count = len(json.loads(open(skills_path, encoding="utf-8").read()))
        except Exception:
            pass
    scores["skills"] = min(WEIGHTS["skills"], round(skill_count * 1.5, 1))

    mem_dir = os.path.join(agent_dir, "memory")
    mem_score = 0
    learnings_count = 0
    if os.path.isdir(mem_dir):
        learnings_file = os.path.join(mem_dir, "learnings.md")
        if os.path.exists(learnings_file):
            try:
                content = open(learnings_file, encoding="utf-8").read()
                learnings_count = max(0, content.count("---") - 1)
                mem_score += min(10, learnings_count * 2)
            except Exception:
                pass
            try:
                from datetime import datetime
                mtime = datetime.fromtimestamp(os.path.getmtime(learnings_file))
                days_since = (datetime.now() - mtime).days
                if days_since <= 1:
                    mem_score += 10
                elif days_since <= 7:
                    mem_score += 5
            except Exception:
                pass
    scores["memory_activity"] = min(WEIGHTS["memory_activity"], mem_score)

    py_files = [f for f in os.listdir(agent_dir) if f.endswith(".py")]
    scores["scripts"] = min(WEIGHTS["scripts"], len(py_files) * 4)

    growth_score = 0
    if os.path.isdir(mem_dir):
        if os.path.exists(os.path.join(mem_dir, "domain_knowledge.json")):
            growth_score += 8
        if os.path.exists(os.path.join(mem_dir, "reflection_log.json")):
            growth_score += 7
    scores["growth"] = min(WEIGHTS["growth"], growth_score)

    total = round(sum(scores.values()), 1)
    grade = "S" if total >= 90 else ("A" if total >= 75 else ("B" if total >= 60 else ("C" if total >= 40 else "D")))

    return {
        "agent": agent_name,
        "dept": DEPT_NAMES.get(agent_name, agent_name),
        "total_score": total,
        "grade": grade,
        "dimension_scores": scores,
        "skill_count": skill_count,
        "learnings": learnings_count,
        "improve_areas": [k for k, v in scores.items() if v < WEIGHTS[k] * 0.6],
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    agents = [d for d in sorted(os.listdir(AGENTS_DIR))
              if os.path.isdir(os.path.join(AGENTS_DIR, d)) and d in DEPT_NAMES]

    results = []
    for agent in agents:
        results.append(evaluate_agent(agent))

    results.sort(key=lambda x: -x["total_score"])
    avg_score = round(sum(r["total_score"] for r in results) / max(len(results), 1), 1)

    grade_dist = {}
    for r in results:
        grade_dist[r["grade"]] = grade_dist.get(r["grade"], 0) + 1

    top = results[0] if results else None
    weak = [r for r in results if r["total_score"] < 50]

    report = {
        "review_date": timestamp,
        "avg_score": avg_score,
        "grade_distribution": grade_dist,
        "top_performer": top["dept"] if top else "无",
        "needs_attention": [r["dept"] for r in weak],
        "reviews": results,
    }

    out_file = os.path.join(OUTPUT_DIR, f"performance_review_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    ranking = " > ".join(f"{r['dept']}{r['total_score']}分" for r in results[:3])
    summary = f"绩效评估: {len(results)}人 均分{avg_score} | {' '.join(f'{g}:{c}人' for g,c in grade_dist.items())} | Top3: {ranking}"
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
