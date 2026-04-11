"""
Safely update OpenClaw config to add base skills.
"""
import json
from pathlib import Path

CONFIG_PATH = Path(r"C:\Users\Lenovo\.openclaw\openclaw.json")

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Config loaded, {len(json.dumps(data))} chars")

# 1. Add D:\FY003\skills to extraDirs
extra_dirs = data["skills"]["load"]["extraDirs"]
skills_dir = r"D:\FY003\skills"
if skills_dir not in extra_dirs:
    extra_dirs.insert(1, skills_dir)
    print(f"Added {skills_dir} to extraDirs")
else:
    print(f"{skills_dir} already in extraDirs")

# 2. Register 17 base skills
base_skills = [
    "web-search", "browser-automation", "local-file-ops",
    "skill-installer", "git-ops", "api-http-client",
    "image-gen", "excel-data", "feishu-messaging",
    "feishu-workflow-diagram", "feishu-workflow-bitable",
    "feishu-workflow-doc", "feishu-workflow-wiki",
    "feishu-workflow-sync", "feishu-drive-archive",
    "workflow-diagram-render", "libreoffice-safe-export",
]

entries = data["skills"]["entries"]
added = 0
for skill in base_skills:
    if skill not in entries:
        entries[skill] = {"enabled": True}
        added += 1

print(f"Added {added} new skills, total entries: {len(entries)}")

# 3. Write back with proper encoding (no BOM)
with open(CONFIG_PATH, "w", encoding="utf-8", newline="\n") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# 4. Verify
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    verify = json.load(f)
    dirs = verify["skills"]["load"]["extraDirs"]
    ents = verify["skills"]["entries"]

print(f"\nVerification OK:")
print(f"  extraDirs: {dirs}")
print(f"  Total skills: {len(ents)}")
base_found = [s for s in base_skills if s in ents]
print(f"  Base skills registered: {len(base_found)}/17")
for s in base_found:
    print(f"    ✓ {s}")
