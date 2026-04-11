"""一次性脚本：为所有Agent配置自学习能力
1. 初始化 domain_knowledge.json
2. 在 learnings.md 中添加学习指令头部
"""
import os, json
from datetime import datetime

ROOT = r"D:\FY003"
AGENTS_DIR = os.path.join(ROOT, "openclaw_agents")

AGENT_CONFIG = {
    "hermione-tech": {
        "role": "CTO",
        "domain": "technology",
        "learn_categories": ["architecture", "bugfix", "tooling", "codestandard", "api"],
        "description": "Technical decisions, code patterns, tool evaluations, bug root causes"
    },
    "mcgonagall-product": {
        "role": "CPO",
        "domain": "product",
        "learn_categories": ["requirements", "competitor", "userbehavior", "decision", "market"],
        "description": "Product insights, competitor changes, user behavior patterns"
    },
    "luna-growth": {
        "role": "CGO",
        "domain": "growth",
        "learn_categories": ["content", "experiment", "trending", "channel", "creative"],
        "description": "Content performance, growth experiments, trending topics"
    },
    "fred-sales": {
        "role": "Sales Director",
        "domain": "sales",
        "learn_categories": ["customer", "pitch", "deal", "pricing", "churn"],
        "description": "Customer profiles, sales patterns, deal outcomes"
    },
    "percy-finance": {
        "role": "CFO",
        "domain": "finance",
        "learn_categories": ["cost", "budget", "roi", "pricing", "risk"],
        "description": "Cost patterns, budget insights, financial metrics"
    },
    "snape-audit": {
        "role": "CAO",
        "domain": "audit",
        "learn_categories": ["vulnerability", "finding", "riskpattern", "compliance", "attack"],
        "description": "Security vulnerabilities, audit findings, risk patterns"
    },
    "dobby-customer": {
        "role": "Customer Lead",
        "domain": "customer",
        "learn_categories": ["faq", "satisfaction", "feature_request", "improvement", "knowledge"],
        "description": "Customer issues, satisfaction trends, feature requests"
    },
}

print("=== Setting up Agent Learning System ===\n")

for agent_name, config in AGENT_CONFIG.items():
    agent_dir = os.path.join(AGENTS_DIR, agent_name)
    mem_dir = os.path.join(agent_dir, "memory")

    if not os.path.isdir(agent_dir):
        print(f"  [SKIP] {agent_name}: directory not found")
        continue

    os.makedirs(mem_dir, exist_ok=True)

    # Initialize domain_knowledge.json
    kb_file = os.path.join(mem_dir, "domain_knowledge.json")
    if not os.path.exists(kb_file):
        kb = {
            "agent": agent_name,
            "role": config["role"],
            "domain": config["domain"],
            "initialized_at": datetime.now().isoformat(),
            "learn_categories": config["learn_categories"],
            "description": config["description"],
            "stats": {"total_learnings": 0, "last_consolidation": None},
            "categories": {cat: {"count": 0, "latest": None} for cat in config["learn_categories"]},
            "top_learnings": [],
        }
        json.dump(kb, open(kb_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"  [NEW] {agent_name}: domain_knowledge.json created")
    else:
        print(f"  [OK]  {agent_name}: domain_knowledge.json exists")

    # Initialize reflection_log.json
    ref_file = os.path.join(mem_dir, "reflection_log.json")
    if not os.path.exists(ref_file):
        json.dump({"reflections": [], "agent": agent_name}, open(ref_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"  [NEW] {agent_name}: reflection_log.json created")

    # Ensure learnings.md has learning header
    learnings_file = os.path.join(mem_dir, "learnings.md")
    if not os.path.exists(learnings_file):
        header = f"# {agent_name} ({config['role']}) - Long-term Memory\n\n"
        header += f"Domain: {config['description']}\n"
        header += f"Categories: {', '.join(config['learn_categories'])}\n\n"
        header += "---\n"
        header += f"_{datetime.now():%Y-%m-%d %H:%M}_ Memory system initialized.\n"
        with open(learnings_file, "w", encoding="utf-8") as f:
            f.write(header)
        print(f"  [NEW] {agent_name}: learnings.md created with header")

print(f"\nSetup complete for {len(AGENT_CONFIG)} agents.")
print("COO (jarvis-coo) retains full audit access to all agent memories.")
print("Run 'python agent_learn.py --all' to consolidate all memories.")
print("Run 'python coo_memory_audit.py' for COO audit report.")
