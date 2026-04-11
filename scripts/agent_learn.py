"""全公司 Agent 通用自学习脚本
为每个 Agent 执行记忆整理：去重、分类、压缩、生成领域知识库。
贾维斯（COO）可以用 --all 整理全公司记忆。
"""
import os, re, json, sys
from datetime import datetime
from collections import defaultdict

ROOT = r"D:\FY003"
AGENTS_DIR = os.path.join(ROOT, "openclaw_agents")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

AGENT_CATEGORIES = {
    "hermione-tech": ["架构决策", "Bug修复", "技术方案", "工具经验", "代码规范", "ONES", "Playwright", "API"],
    "mcgonagall-product": ["需求洞察", "竞品变化", "用户行为", "产品决策", "市场趋势"],
    "luna-growth": ["内容效果", "增长实验", "热点趋势", "渠道数据", "创意灵感", "SEO"],
    "fred-sales": ["客户画像", "销售话术", "成交模式", "报价经验", "流失原因"],
    "percy-finance": ["成本规律", "预算异常", "ROI分析", "定价策略", "财务风险", "Token"],
    "snape-audit": ["安全漏洞", "审计发现", "风险模式", "合规要求", "攻防经验", "密钥"],
    "dobby-customer": ["常见问题", "满意度", "功能请求", "服务改进", "知识更新"],
    "jarvis-coo": ["公司决策", "团队管理", "CEO偏好", "方法论", "组织架构", "ONES", "Agent能力"],
}

SENSITIVE_PATTERNS = [
    r'sk-[a-zA-Z0-9]{20,}',
    r'(?i)password\s*[=:]\s*\S{6,}',
    r'(?i)secret\s*[=:]\s*\S{10,}',
    r'Bearer\s+[A-Za-z0-9\-._~+/]{20,}',
]

def process_agent(agent_name):
    agent_dir = os.path.join(AGENTS_DIR, agent_name)
    mem_dir = os.path.join(agent_dir, "memory")
    learnings_file = os.path.join(mem_dir, "learnings.md")

    if not os.path.exists(learnings_file):
        return {"agent": agent_name, "status": "no_learnings", "count": 0}

    content = open(learnings_file, "r", encoding="utf-8").read()

    # 解析记录
    entries = []
    blocks = re.split(r'\n---\n', content)
    for block in blocks:
        block = block.strip()
        if not block or block.startswith("# "):
            continue
        ts_match = re.search(r'_(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2})_', block)
        timestamp = ts_match.group(1) if ts_match else "unknown"
        text = re.sub(r'_\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}_\s*', '', block).strip()
        if text:
            entries.append({"timestamp": timestamp, "text": text})

    # 去重
    seen = set()
    unique = []
    for e in entries:
        key = e["text"][:80].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(e)
    removed = len(entries) - len(unique)

    # 敏感信息过滤
    sensitive_found = 0
    for e in unique:
        for pat in SENSITIVE_PATTERNS:
            if re.search(pat, e["text"]):
                e["text"] = re.sub(pat, "[REDACTED]", e["text"])
                sensitive_found += 1

    # 分类
    categories = AGENT_CATEGORIES.get(agent_name, ["general"])
    classified = defaultdict(list)
    for e in unique:
        matched = False
        for cat in categories:
            if cat.lower() in e["text"].lower():
                classified[cat].append(e)
                matched = True
                break
        if not matched:
            classified["other"].append(e)

    # 生成压缩版
    compressed_lines = [f"# {agent_name} 长期记忆（压缩版）\n"]
    compressed_lines.append(f"_最后整理: {datetime.now():%Y-%m-%d %H:%M}_ | 原始 {len(entries)} 条 -> 去重后 {len(unique)} 条\n")
    for cat, items in sorted(classified.items()):
        compressed_lines.append(f"\n## {cat}\n")
        for it in items[-5:]:
            compressed_lines.append(f"- [{it['timestamp']}] {it['text'][:150]}\n")

    compressed_file = os.path.join(mem_dir, "learnings_compressed.md")
    with open(compressed_file, "w", encoding="utf-8") as f:
        f.writelines(compressed_lines)

    # 生成领域知识库
    domain_kb = {
        "agent": agent_name,
        "updated_at": datetime.now().isoformat(),
        "stats": {
            "total_raw": len(entries),
            "duplicates_removed": removed,
            "unique": len(unique),
            "sensitive_redacted": sensitive_found,
        },
        "categories": {
            cat: {"count": len(items), "latest": items[-1]["timestamp"] if items else ""}
            for cat, items in classified.items()
        },
        "top_learnings": [e["text"][:200] for e in unique[-5:]],
    }

    kb_file = os.path.join(mem_dir, "domain_knowledge.json")
    json.dump(domain_kb, open(kb_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    return {
        "agent": agent_name,
        "status": "ok",
        "count": len(unique),
        "removed": removed,
        "categories": len(classified),
        "sensitive_redacted": sensitive_found,
    }


def main():
    args = sys.argv[1:]

    if "--all" in args:
        agents = [d for d in os.listdir(AGENTS_DIR)
                  if os.path.isdir(os.path.join(AGENTS_DIR, d))
                  and os.path.exists(os.path.join(AGENTS_DIR, d, "memory", "learnings.md"))]
    elif "--agent" in args:
        idx = args.index("--agent")
        if idx + 1 < len(args):
            agents = [args[idx + 1]]
        else:
            print("Error: --agent requires agent name")
            return
    else:
        print("Agent Learning System")
        print("Usage:")
        print("  python agent_learn.py --agent hermione-tech")
        print("  python agent_learn.py --all")
        return

    print(f"=== Agent Learning System ===\n")
    results = []
    for agent in sorted(agents):
        print(f"[{agent}] ", end="")
        result = process_agent(agent)
        results.append(result)
        if result["status"] == "ok":
            print(f"{result['count']} entries, -{result['removed']} dupes, {result['categories']} cats, {result['sensitive_redacted']} redacted")
        else:
            print(f"skipped ({result['status']})")

    # COO 全局报告
    report = {
        "generated_at": datetime.now().isoformat(),
        "agents_processed": len(results),
        "total_learnings": sum(r.get("count", 0) for r in results),
        "total_duplicates_removed": sum(r.get("removed", 0) for r in results),
        "total_sensitive_redacted": sum(r.get("sensitive_redacted", 0) for r in results),
        "agents": results,
    }

    out_file = os.path.join(OUTPUT, f"agent_learning_report_{datetime.now():%Y%m%d}.json")
    json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nReport: {out_file}")
    print(f"Total: {report['total_learnings']} learnings across {len(results)} agents")


if __name__ == "__main__":
    main()
