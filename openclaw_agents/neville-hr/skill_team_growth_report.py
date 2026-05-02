"""
skill_team_growth_report.py — 纳威的技能：团队成长周报
汇总各 Agent 的学习和成长情况，输出团队成长报告
"""
import json, os, re, sys, time
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
AGENTS_DIR = os.path.join(PROJECT_ROOT, "openclaw_agents")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "hr")

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""

DEPT_NAMES = {
    "jarvis-coo": "执行办(贾维斯)", "hermione-tech": "技术部(赫敏)",
    "mcgonagall-product": "产品部(麦格)", "luna-growth": "增长部(露娜)",
    "fred-sales": "销售部(弗雷德)", "percy-finance": "财务部(珀西)",
    "snape-audit": "审计部(斯内普)", "dobby-customer": "客户部(多比)",
    "neville-hr": "人资部(纳威)",
}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")
    now = datetime.now()
    week_start = now - timedelta(days=7)

    agents = [d for d in sorted(os.listdir(AGENTS_DIR))
              if os.path.isdir(os.path.join(AGENTS_DIR, d)) and d in DEPT_NAMES]

    growth_data = []
    for agent in agents:
        agent_dir = os.path.join(AGENTS_DIR, agent)
        data = {"agent": agent, "dept": DEPT_NAMES.get(agent, agent),
                "learnings_total": 0, "learnings_this_week": 0, "files_changed": 0}

        learnings_file = os.path.join(agent_dir, "memory", "learnings.md")
        if os.path.exists(learnings_file):
            try:
                content = open(learnings_file, encoding="utf-8").read()
                data["learnings_total"] = max(0, content.count("---") - 1)
                blocks = re.split(r'\n---\n', content)
                for block in blocks:
                    ts_match = re.search(r'_(\d{4}-\d{2}-\d{2})', block)
                    if ts_match:
                        try:
                            d = datetime.strptime(ts_match.group(1), "%Y-%m-%d")
                            if d >= week_start:
                                data["learnings_this_week"] += 1
                        except ValueError:
                            pass
            except Exception:
                pass

        mem_dir = os.path.join(agent_dir, "memory")
        if os.path.isdir(mem_dir):
            for fn in os.listdir(mem_dir):
                fp = os.path.join(mem_dir, fn)
                if os.path.isfile(fp):
                    try:
                        mtime = datetime.fromtimestamp(os.path.getmtime(fp))
                        if mtime >= week_start:
                            data["files_changed"] += 1
                    except Exception:
                        pass

        growth_data.append(data)

    growth_data.sort(key=lambda x: -x["learnings_this_week"])
    active = sum(1 for d in growth_data if d["learnings_this_week"] > 0)
    total_new = sum(d["learnings_this_week"] for d in growth_data)
    rate = round(active / max(len(agents), 1) * 100, 1)

    inactive = [d["dept"] for d in growth_data if d["learnings_this_week"] == 0]
    recommendations = []
    if inactive:
        recommendations.append(f"以下部门本周无学习记录: {', '.join(inactive[:5])}")
    if total_new < 5:
        recommendations.append("全员学习产出偏低，建议安排更多学习型任务")

    report = {
        "report_date": timestamp,
        "period": f"{week_start.strftime('%m/%d')} ~ {now.strftime('%m/%d')}",
        "active_learners": active,
        "total_agents": len(agents),
        "activity_rate": rate,
        "total_new_learnings": total_new,
        "agents": growth_data,
        "recommendations": recommendations,
    }

    out_file = os.path.join(OUTPUT_DIR, f"team_growth_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = f"团队成长周报: {active}/{len(agents)} 活跃 ({rate}%) | 本周新增学习 {total_new} 条"
    if inactive:
        summary += f" | 需关注: {', '.join(inactive[:3])}"
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
