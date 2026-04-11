"""纳威·人资部 — 团队成长周报
汇总各 Agent 的学习和成长情况。
"""
import os, json, re
from datetime import datetime, timedelta

ROOT = r"D:\FY003"
AGENTS_DIR = os.path.join(ROOT, "openclaw_agents")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== Team Growth Weekly Report ===\n")

now = datetime.now()
week_start = now - timedelta(days=7)

agents = [d for d in sorted(os.listdir(AGENTS_DIR))
          if os.path.isdir(os.path.join(AGENTS_DIR, d))]

growth_data = []
for agent in agents:
    agent_dir = os.path.join(AGENTS_DIR, agent)
    data = {"agent": agent, "learnings_total": 0, "learnings_this_week": 0, "files_changed": 0}

    learnings_file = os.path.join(agent_dir, "memory", "learnings.md")
    if os.path.exists(learnings_file):
        content = open(learnings_file, "r", encoding="utf-8").read()
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

    mem_dir = os.path.join(agent_dir, "memory")
    if os.path.isdir(mem_dir):
        for fn in os.listdir(mem_dir):
            fp = os.path.join(mem_dir, fn)
            if os.path.isfile(fp):
                mtime = datetime.fromtimestamp(os.path.getmtime(fp))
                if mtime >= week_start:
                    data["files_changed"] += 1

    growth_data.append(data)
    status = "[+]" if data["learnings_this_week"] > 0 else "[ ]"
    print(f"  {status} {agent}: {data['learnings_this_week']} new / {data['learnings_total']} total | {data['files_changed']} files changed")

active = sum(1 for d in growth_data if d["learnings_this_week"] > 0)
total_new = sum(d["learnings_this_week"] for d in growth_data)

report = {
    "report_date": now.isoformat(),
    "period": f"{week_start:%Y-%m-%d} ~ {now:%Y-%m-%d}",
    "summary": {
        "total_agents": len(agents),
        "active_learners": active,
        "inactive_agents": len(agents) - active,
        "total_new_learnings": total_new,
        "activity_rate": round(active / max(len(agents), 1) * 100, 1),
    },
    "agents": growth_data,
    "recommendations": [],
}

inactive = [d["agent"] for d in growth_data if d["learnings_this_week"] == 0]
if inactive:
    report["recommendations"].append(f"Inactive agents need engagement: {', '.join(inactive)}")
if total_new < 5:
    report["recommendations"].append("Low learning volume - consider assigning more learning-oriented tasks")

out_file = os.path.join(OUTPUT, f"team_growth_{now:%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'='*40}")
print(f"Active Learners: {active}/{len(agents)} ({report['summary']['activity_rate']}%)")
print(f"New Learnings: {total_new}")
print(f"Report: {out_file}")
