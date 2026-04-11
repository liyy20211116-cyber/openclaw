import json
from pathlib import Path

CONFIG_PATH = Path(r"C:\Users\Lenovo\.openclaw\openclaw.json")

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

for agent in data.get("agents", {}).get("list", []):
    sa = agent.get("subagents", {})
    if "maxConcurrent" in sa:
        del sa["maxConcurrent"]
        print(f"Removed maxConcurrent from agent {agent['id']}")

with open(CONFIG_PATH, "w", encoding="utf-8", newline="\n") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Fixed. Running validation...")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    verify = json.load(f)
    for a in verify["agents"]["list"]:
        sa_keys = list(a.get("subagents", {}).keys())
        print(f"  {a['id']}: subagents keys = {sa_keys}")
print("Done")
