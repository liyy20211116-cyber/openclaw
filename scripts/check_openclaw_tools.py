"""Check OpenClaw tool configuration to understand why Jarvis can't execute code."""
import json
from pathlib import Path

CONFIG_PATH = Path(r"C:\Users\Lenovo\.openclaw\openclaw.json")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

print("=== Global Tools Config ===")
tools = data.get("tools", {})
print(f"  profile: {tools.get('profile')}")
print(f"  alsoAllow ({len(tools.get('alsoAllow', []))} items):")
for item in tools.get("alsoAllow", []):
    print(f"    - {item}")

print("\n=== Agent-Specific Tools ===")
for agent in data.get("agents", {}).get("list", []):
    agent_tools = agent.get("tools", {})
    print(f"  {agent['id']}:")
    print(f"    profile: {agent_tools.get('profile', '(inherit global)')}")
    deny = agent_tools.get("deny", [])
    if deny:
        print(f"    deny: {deny}")

print("\n=== Model Config ===")
defaults = data.get("agents", {}).get("defaults", {})
model_cfg = defaults.get("model", {})
print(f"  primary: {model_cfg.get('primary')}")
print(f"  fallbacks: {model_cfg.get('fallbacks', [])}")
subagent_cfg = defaults.get("subagents", {})
print(f"  subagent model: {subagent_cfg.get('model')}")

print("\n=== Plugins ===")
plugins = data.get("plugins", {})
print(f"  allow: {plugins.get('allow', [])}")
for name, cfg in plugins.get("entries", {}).items():
    enabled = cfg.get("enabled", False)
    print(f"  {name}: enabled={enabled}")

print("\n=== Browser ===")
browser = data.get("browser", {})
print(f"  enabled: {browser.get('enabled')}")
print(f"  headless: {browser.get('headless')}")
print(f"  profiles: {list(browser.get('profiles', {}).keys())}")
