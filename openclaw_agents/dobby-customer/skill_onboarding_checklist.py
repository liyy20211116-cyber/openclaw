"""多比·客户部 — 客户入职检查清单生成器
为新签约客户生成标准化入职流程和检查清单。
"""
import json, os
from datetime import datetime, timedelta

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

ONBOARDING_TEMPLATE = {
    "day_1": {
        "title": "Day 1 - Welcome",
        "tasks": [
            "Send welcome email with project overview",
            "Share access credentials and documentation",
            "Schedule kickoff meeting",
            "Create project folder in workspace",
        ]
    },
    "week_1": {
        "title": "Week 1 - Setup",
        "tasks": [
            "Complete requirements gathering",
            "Set up development environment",
            "Define success metrics and KPIs",
            "Establish communication cadence",
        ]
    },
    "week_2": {
        "title": "Week 2 - Build",
        "tasks": [
            "Deliver first prototype/MVP",
            "Collect initial feedback",
            "Iterate based on feedback",
            "Mid-project review meeting",
        ]
    },
    "week_4": {
        "title": "Week 4 - Deliver",
        "tasks": [
            "Final delivery and handover",
            "Training session for client team",
            "Documentation handover",
            "Satisfaction survey",
            "Discuss maintenance/follow-up",
        ]
    }
}

def generate_checklist(client_name, project_name, start_date=None):
    if not start_date:
        start_date = datetime.now()

    checklist = {
        "client": client_name,
        "project": project_name,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "generated_at": datetime.now().isoformat(),
        "phases": {}
    }

    for phase_key, phase in ONBOARDING_TEMPLATE.items():
        checklist["phases"][phase_key] = {
            "title": phase["title"],
            "tasks": [{"task": t, "done": False, "notes": ""} for t in phase["tasks"]]
        }

    out_file = os.path.join(OUTPUT, f"onboarding_{client_name}_{datetime.now():%Y%m%d}.json")
    json.dump(checklist, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"=== Onboarding Checklist: {client_name} ===\n")
    for phase_key, phase in checklist["phases"].items():
        print(f"  {phase['title']}")
        for t in phase["tasks"]:
            print(f"    [ ] {t['task']}")
    print(f"\nSaved: {out_file}")
    return out_file

if __name__ == "__main__":
    import sys
    if "--demo" in sys.argv:
        generate_checklist("DemoClient", "AI Automation Setup")
    else:
        print("Usage: python skill_onboarding_checklist.py --demo")
