import json
with open(r"C:\Users\Lenovo\.openclaw\openclaw.json", "r", encoding="utf-8") as f:
    data = json.load(f)
has_meta = "meta" in data
agents = [a.get("id", "?") for a in data.get("agents", {}).get("list", [])]
main_tools = data.get("agents", {}).get("list", [{}])[0].get("tools", {}).get("profile", "?")
dirs = data["skills"]["load"]["extraDirs"]
entries = list(data["skills"]["entries"].keys())
print(f"has_meta: {has_meta}")
print(f"agents: {agents}")
print(f"main agent tools.profile: {main_tools}")
print(f"extraDirs ({len(dirs)}): {dirs}")
print(f"skill entries ({len(entries)}): {entries}")
