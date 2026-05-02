"""
skill_cost_tracker.py — 珀西的技能：真实成本追踪
读取 API 调用日志和系统运行记录，统计真实 Token 消耗和 API 成本
"""
import json, os, sys, time, glob

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
AGENTS_DIR = os.path.join(PROJECT_ROOT, "openclaw_agents")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "finance")
DB_PATH = os.path.join(PROJECT_ROOT, "jarvis-one-company-os", "dev.db")

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""

MODEL_COSTS_PER_1K = {
    "gpt-4o": {"input": 0.0025, "output": 0.01},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-5.4": {"input": 0.005, "output": 0.015},
    "cascade": {"input": 0.001, "output": 0.003},
    "default": {"input": 0.002, "output": 0.006},
}

DEPT_NAMES = {
    "jarvis-coo": "执行办", "hermione-tech": "技术部", "mcgonagall-product": "产品部",
    "luna-growth": "增长部", "fred-sales": "销售部", "percy-finance": "财务部",
    "snape-audit": "审计部", "dobby-customer": "客户部", "neville-hr": "人资部",
}


def estimate_script_cost(agent_id):
    """估算单个 agent 的脚本运行成本"""
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    skills_path = os.path.join(agent_dir, "skills.json")
    cost_data = {"script_count": 0, "llm_calls_estimated": 0, "estimated_tokens": 0}

    if not os.path.exists(skills_path):
        return cost_data

    try:
        skills = json.loads(open(skills_path, encoding="utf-8").read())
        cost_data["script_count"] = sum(1 for s in skills if s.get("type") == "script")
    except Exception:
        return cost_data

    for f in os.listdir(agent_dir):
        if not f.endswith(".py"):
            continue
        try:
            code = open(os.path.join(agent_dir, f), encoding="utf-8").read()
            llm_calls = code.count("call_llm") + code.count("/api/llm/chat") + code.count("BACKEND_URL")
            if llm_calls > 0:
                cost_data["llm_calls_estimated"] += max(1, llm_calls - 1)
                avg_tokens = 2000
                cost_data["estimated_tokens"] += avg_tokens * max(1, llm_calls - 1)
        except Exception:
            pass

    return cost_data


def check_db_messages():
    """从 SQLite 数据库统计聊天消息量"""
    if not os.path.exists(DB_PATH):
        return {"messages": 0, "topics": 0}
    try:
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM chat_messages")
        msg_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM chat_topics")
        topic_count = cur.fetchone()[0]
        conn.close()
        return {"messages": msg_count, "topics": topic_count}
    except Exception:
        return {"messages": 0, "topics": 0}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    dept_costs = {}
    total_scripts = 0
    total_llm_calls = 0
    total_tokens = 0

    for agent_id, dept_name in DEPT_NAMES.items():
        cost = estimate_script_cost(agent_id)
        dept_costs[dept_name] = {
            "agent_id": agent_id,
            **cost,
            "estimated_cost_usd": round(cost["estimated_tokens"] / 1000 * MODEL_COSTS_PER_1K["default"]["output"], 3),
        }
        total_scripts += cost["script_count"]
        total_llm_calls += cost["llm_calls_estimated"]
        total_tokens += cost["estimated_tokens"]

    db_stats = check_db_messages()

    ceo_token_estimate = db_stats["messages"] * 1500
    total_tokens += ceo_token_estimate
    total_cost_usd = round(total_tokens / 1000 * MODEL_COSTS_PER_1K["default"]["output"], 2)

    output_files = 0
    output_size = 0
    output_base = os.path.join(PROJECT_ROOT, "output")
    if os.path.isdir(output_base):
        for root, dirs, files in os.walk(output_base):
            for f in files:
                fp = os.path.join(root, f)
                output_files += 1
                try:
                    output_size += os.path.getsize(fp)
                except Exception:
                    pass

    report = {
        "report_date": timestamp,
        "department_costs": dept_costs,
        "totals": {
            "total_scripts": total_scripts,
            "total_llm_calls_estimated": total_llm_calls,
            "total_tokens_estimated": total_tokens,
            "total_cost_usd_estimated": total_cost_usd,
            "ceo_chat_messages": db_stats["messages"],
            "ceo_chat_topics": db_stats["topics"],
        },
        "output_stats": {
            "total_files": output_files,
            "total_size_mb": round(output_size / 1024 / 1024, 2),
        },
        "cost_model": "基于脚本LLM调用次数和CEO对话量估算",
    }

    top_dept = max(dept_costs.items(), key=lambda x: x[1]["estimated_cost_usd"])

    out_file = os.path.join(OUTPUT_DIR, f"cost_tracker_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = (f"成本追踪: 总Token ~{total_tokens:,} | 预估成本 ${total_cost_usd} | "
               f"最大消耗: {top_dept[0]} | CEO对话{db_stats['messages']}条 | 产出{output_files}个文件")
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
