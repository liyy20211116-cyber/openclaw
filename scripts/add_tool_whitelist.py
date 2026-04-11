"""Add business automation scripts to OpenClaw tool whitelist."""
import json
from pathlib import Path

CONFIG_PATH = Path(r"C:\Users\Lenovo\.openclaw\openclaw.json")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

new_commands = [
    "python D:\\FY003\\openclaw_agents\\jarvis-coo\\skill_self_check.py",
    "python D:\\FY003\\openclaw_agents\\jarvis-coo\\skill_company_status.py",
    "python D:\\FY003\\openclaw_agents\\jarvis-coo\\skill_dispatch.py *",
    "python D:\\FY003\\openclaw_agents\\hermione-tech\\skill_check_services.py",
    "python D:\\FY003\\openclaw_agents\\hermione-tech\\skill_code_review.py *",
    "python D:\\FY003\\openclaw_agents\\hermione-tech\\skill_run_test.py *",
    "python D:\\FY003\\openclaw_agents\\hermione-tech\\skill_deploy_fix.py *",
    "python D:\\FY003\\scripts\\fetch_news.py *",
    "python D:\\FY003\\scripts\\rank_news.py *",
    "python D:\\FY003\\scripts\\pipeline_api.py *",
    "python D:\\FY003\\scripts\\check_skills.py",
    "python D:\\FY003\\scripts\\write_script.py *",
    "python -u *",
    "pip install *",
    "pip list *",
    "npm *",
    "npx *",
]

also_allow = data.get("tools", {}).get("alsoAllow", [])
added = 0
for cmd in new_commands:
    if cmd not in also_allow:
        also_allow.append(cmd)
        added += 1

data["tools"]["alsoAllow"] = also_allow

with open(CONFIG_PATH, "w", encoding="utf-8", newline="\n") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Added {added} commands to tools.alsoAllow")
print(f"Total whitelist: {len(also_allow)} commands")
