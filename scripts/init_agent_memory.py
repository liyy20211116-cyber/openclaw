"""Initialize memory/learnings.md for agents that don't have one."""
from pathlib import Path

agents = {
    "luna-growth": "卢娜",
    "fred-sales": "弗雷德",
    "percy-finance": "珀西",
    "snape-audit": "斯内普",
    "dobby-customer": "多比",
}

base = Path(r"D:\FY003\openclaw_agents")
for agent_id, name in agents.items():
    mem_dir = base / agent_id / "memory"
    mem_dir.mkdir(parents=True, exist_ok=True)
    learnings = mem_dir / "learnings.md"
    if not learnings.exists() or learnings.stat().st_size == 0:
        learnings.write_text(
            f"# {name}长期记忆\n\n---\n_2026-04-11_ 记忆系统初始化成功。\n",
            encoding="utf-8"
        )
        print(f"Created {learnings}")
    else:
        print(f"Already exists: {learnings}")
print("Done")
