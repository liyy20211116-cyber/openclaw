import json, sys, os

sys.stdout.reconfigure(encoding='utf-8')

config_path = os.path.expanduser(r"~\.openclaw\openclaw.json")
with open(config_path, "r", encoding="utf-8") as f:
    cfg = json.load(f)

print("=== 当前技能配置 ===")
skills = cfg.get("skills", {}).get("entries", {})
for k, v in skills.items():
    print(f"  {k}: enabled={v.get('enabled', 'N/A')}")

print(f"\n=== 技能加载目录 ===")
dirs = cfg.get("skills", {}).get("load", {}).get("extraDirs", [])
for d in dirs:
    exists = os.path.isdir(d)
    print(f"  {d}  [{'exists' if exists else 'MISSING'}]")

print(f"\n=== 主Agent(贾维斯)配置 ===")
main = cfg["agents"]["list"][0]
print(f"  id: {main['id']}")
print(f"  name: {main['name']}")
print(f"  tools: {json.dumps(main.get('tools', {}), ensure_ascii=False)}")
print(f"  subagents: {json.dumps(main.get('subagents', {}), ensure_ascii=False)}")
print(f"  workspace: {main.get('workspace', 'N/A')}")

print(f"\n=== 魔法师Agent配置 ===")
mof = [a for a in cfg["agents"]["list"] if a["id"] == "mofashi-worker"]
if mof:
    m = mof[0]
    print(f"  id: {m['id']}")
    print(f"  name: {m['name']}")
    print(f"  tools: {json.dumps(m.get('tools', {}), ensure_ascii=False)}")
    print(f"  workspace: {m.get('workspace', 'N/A')}")
    print(f"  identity: {json.dumps(m.get('identity', {}), ensure_ascii=False)}")

print(f"\n=== 全局工具配置 ===")
print(f"  profile: {cfg.get('tools', {}).get('profile', 'N/A')}")
also_allow = cfg.get("tools", {}).get("alsoAllow", [])
print(f"  alsoAllow ({len(also_allow)} items):")
for a in also_allow:
    print(f"    - {a}")

print(f"\n=== 插件配置 ===")
plugins = cfg.get("plugins", {}).get("entries", {})
for k, v in plugins.items():
    print(f"  {k}: enabled={v.get('enabled', 'N/A')}")

print(f"\n=== Commands 配置 ===")
cmds = cfg.get("commands", {})
print(f"  native: {cmds.get('native', 'N/A')}")
print(f"  nativeSkills: {cmds.get('nativeSkills', 'N/A')}")
print(f"  restart: {cmds.get('restart', 'N/A')}")
print(f"  ownerDisplay: {cmds.get('ownerDisplay', 'N/A')}")
