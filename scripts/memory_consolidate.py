"""贾维斯·自我学习系统 — 记忆整理与压缩
扫描 learnings.md，去重+压缩+分类，生成结构化知识库。
同时从 OpenClaw workspace/memory/ 中提取最新记忆写入 Agent 记忆。
"""
import os, re, json
from datetime import datetime
from collections import defaultdict

ROOT = r"D:\FY003"
OPENCLAW_WS = os.path.join(os.path.expanduser("~"), ".openclaw", "workspace")
JARVIS_MEM = os.path.join(ROOT, "openclaw_agents", "jarvis-coo", "memory")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 贾维斯·记忆整理系统 ===\n")

# --- 1. 解析 learnings.md ---
learnings_file = os.path.join(JARVIS_MEM, "learnings.md")
entries = []
if os.path.exists(learnings_file):
    content = open(learnings_file, "r", encoding="utf-8").read()
    blocks = re.split(r'\n---\n', content)
    for block in blocks:
        block = block.strip()
        if not block or block.startswith("# "):
            continue
        ts_match = re.search(r'_(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})_', block)
        timestamp = ts_match.group(1) if ts_match else "unknown"
        text = re.sub(r'_\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}_\s*', '', block).strip()
        if text:
            entries.append({"timestamp": timestamp, "text": text, "hash": hash(text[:100])})
    print(f"解析了 {len(entries)} 条学习记录")

# --- 2. 去重（基于前100字符相似度） ---
seen = set()
unique_entries = []
for e in entries:
    key = e["text"][:80].lower().strip()
    if key not in seen:
        seen.add(key)
        unique_entries.append(e)
duplicates_removed = len(entries) - len(unique_entries)
print(f"去重: 移除 {duplicates_removed} 条重复，剩余 {len(unique_entries)} 条")

# --- 3. 分类 ---
categories = defaultdict(list)
category_keywords = {
    "ones_automation": ["ONES", "建单", "Token", "审核", "闭环", "pending", "processed"],
    "agent_capability": ["环境", "工具", "Playwright", "Code Interpreter", "profile", "权限", "基础设施"],
    "team_management": ["赫敏", "斯内普", "珀西", "卢娜", "弗雷德", "多比", "麦格", "部门", "团队"],
    "ceo_interaction": ["CEO", "原野", "汇报", "决策"],
    "technical": ["API", "WebSocket", "502", "断连", "DNS"],
    "methodology": ["方法论", "策略", "原则", "先验证"],
}

for e in unique_entries:
    classified = False
    for cat, keywords in category_keywords.items():
        if any(kw.lower() in e["text"].lower() for kw in keywords):
            categories[cat].append(e)
            classified = True
            break
    if not classified:
        categories["other"].append(e)

print(f"\n分类结果:")
for cat, items in sorted(categories.items()):
    print(f"  {cat}: {len(items)} 条")

# --- 4. 生成压缩知识库 ---
knowledge_base = {
    "generated_at": datetime.now().isoformat(),
    "stats": {
        "total_raw": len(entries),
        "duplicates_removed": duplicates_removed,
        "unique_entries": len(unique_entries),
    },
    "categories": {}
}

for cat, items in categories.items():
    knowledge_base["categories"][cat] = {
        "count": len(items),
        "latest": items[-1]["timestamp"] if items else "",
        "key_learnings": [it["text"][:200] for it in items[-3:]]
    }

# --- 5. 从 OpenClaw workspace/memory/ 同步最新记忆 ---
ws_memory_dir = os.path.join(OPENCLAW_WS, "memory")
latest_memories = []
if os.path.isdir(ws_memory_dir):
    memory_files = sorted([f for f in os.listdir(ws_memory_dir) if f.endswith(".md")])
    for mf in memory_files[-3:]:
        content = open(os.path.join(ws_memory_dir, mf), "r", encoding="utf-8").read()
        latest_memories.append({"date": mf.replace(".md", ""), "content": content[:500]})
    print(f"\nOpenClaw 记忆文件: {len(memory_files)} 个，最新: {memory_files[-1] if memory_files else 'N/A'}")

knowledge_base["openclaw_recent_memories"] = latest_memories

# --- 6. 生成压缩版 learnings ---
compressed_lines = ["# 贾维斯长期记忆（压缩版）\n"]
compressed_lines.append(f"_最后整理: {datetime.now():%Y-%m-%d %H:%M}_\n")

for cat, items in sorted(categories.items()):
    cat_names = {
        "ones_automation": "ONES 需求审核自动化",
        "agent_capability": "Agent 能力与环境",
        "team_management": "团队管理",
        "ceo_interaction": "CEO 偏好与决策",
        "technical": "技术问题",
        "methodology": "方法论",
        "other": "其他"
    }
    compressed_lines.append(f"\n## {cat_names.get(cat, cat)}\n")
    for it in items[-3:]:
        compressed_lines.append(f"- [{it['timestamp']}] {it['text'][:150]}\n")

compressed_file = os.path.join(JARVIS_MEM, "learnings_compressed.md")
with open(compressed_file, "w", encoding="utf-8") as f:
    f.writelines(compressed_lines)
print(f"\n压缩版记忆: {compressed_file} ({len(compressed_lines)} 行)")

# --- 7. 输出知识库 ---
kb_file = os.path.join(OUTPUT, f"knowledge_base_{datetime.now():%Y%m%d}.json")
json.dump(knowledge_base, open(kb_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"知识库: {kb_file}")
print(f"\n整理完成: {len(entries)} 条原始 → {len(unique_entries)} 条去重 → {len(categories)} 个分类")
