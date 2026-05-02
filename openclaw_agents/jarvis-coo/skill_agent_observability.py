"""
skill_agent_observability.py — 贾维斯的技能：Agent 执行可观测性
提供全局 Agent 执行监控、日志追溯、成本追踪、信任评分
"""
import json, os, sys, time
from pathlib import Path
from datetime import datetime, timedelta

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "observability"
LOG_DIRS = {
    "publish_logs": PROJECT_ROOT / "output" / "publish_logs",
    "customer_service": PROJECT_ROOT / "output" / "customer_service",
    "ecommerce": PROJECT_ROOT / "output" / "ecommerce",
    "videos": PROJECT_ROOT / "output" / "videos",
    "content": PROJECT_ROOT / "output" / "content",
    "drafts": PROJECT_ROOT / "output" / "drafts",
    "feedback": PROJECT_ROOT / "output" / "feedback",
    "customer": PROJECT_ROOT / "output" / "customer",
}
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=1000):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是贾维斯，一人公司COO。你正在做Agent执行可观测性报告，关注效率、成本、质量。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def scan_execution_logs() -> dict:
    """扫描所有 Agent 执行输出，统计活动情况"""
    stats = {}
    total_files = 0
    recent_files = 0
    cutoff = datetime.now() - timedelta(days=7)

    for name, log_dir in LOG_DIRS.items():
        if not log_dir.exists():
            stats[name] = {"total": 0, "recent_7d": 0}
            continue

        files = list(log_dir.glob("*.json")) + list(log_dir.glob("*.md"))
        recent = [f for f in files if datetime.fromtimestamp(f.stat().st_mtime) > cutoff]

        stats[name] = {
            "total": len(files),
            "recent_7d": len(recent),
            "latest": files[-1].name if files else None,
            "latest_time": datetime.fromtimestamp(files[-1].stat().st_mtime).isoformat() if files else None,
        }
        total_files += len(files)
        recent_files += len(recent)

    return {"modules": stats, "total_files": total_files, "recent_7d_files": recent_files}


def calculate_trust_scores() -> list:
    """计算各 Agent 信任评分"""
    agents = [
        {"id": "jarvis-coo", "name": "贾维斯", "role": "COO"},
        {"id": "hermione-tech", "name": "赫敏", "role": "CTO"},
        {"id": "mcgonagall-product", "name": "麦格教授", "role": "CPO"},
        {"id": "luna-growth", "name": "卢娜", "role": "CGO"},
        {"id": "fred-sales", "name": "弗雷德", "role": "CSO"},
        {"id": "percy-finance", "name": "珀西", "role": "CFO"},
        {"id": "snape-audit", "name": "斯内普", "role": "审计"},
        {"id": "dobby-customer", "name": "多比", "role": "CXO"},
        {"id": "neville-hr", "name": "纳威", "role": "HRD"},
    ]

    for agent in agents:
        agent_dir = PROJECT_ROOT / "openclaw_agents" / agent["id"]
        skills_file = agent_dir / "skills.json"
        memory_dir = agent_dir / "memory"

        skill_count = 0
        if skills_file.exists():
            try:
                skills = json.loads(skills_file.read_text(encoding="utf-8"))
                skill_count = len(skills)
            except Exception:
                pass

        has_memory = memory_dir.exists() and any(memory_dir.iterdir()) if memory_dir.exists() else False

        base_score = 60
        base_score += min(skill_count * 2, 20)
        if has_memory:
            base_score += 10

        output_count = 0
        for log_dir in LOG_DIRS.values():
            if log_dir.exists():
                output_count += len([f for f in log_dir.glob("*") if agent["id"].split("-")[0] in f.name.lower()])

        if output_count > 0:
            base_score += min(output_count, 10)

        agent["trust_score"] = min(base_score, 100)
        agent["skill_count"] = skill_count
        agent["has_memory"] = has_memory
        agent["output_count"] = output_count

    return sorted(agents, key=lambda x: x["trust_score"], reverse=True)


def generate_cost_estimate() -> dict:
    """估算近期 Token 消耗"""
    routing_file = PROJECT_ROOT / "config" / "model-routing.json"
    if routing_file.exists():
        try:
            config = json.loads(routing_file.read_text(encoding="utf-8"))
            budget = config.get("cost_optimization", {}).get("monthly_budget_tokens_usd", 50)
        except Exception:
            budget = 50
    else:
        budget = 50

    log_stats = scan_execution_logs()
    recent = log_stats["recent_7d_files"]
    estimated_weekly_cost = recent * 0.02
    estimated_monthly_cost = estimated_weekly_cost * 4.3

    return {
        "monthly_budget_usd": budget,
        "estimated_weekly_cost_usd": round(estimated_weekly_cost, 2),
        "estimated_monthly_cost_usd": round(estimated_monthly_cost, 2),
        "budget_usage_percent": round(estimated_monthly_cost / max(budget, 1) * 100, 1),
        "recent_7d_executions": recent,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")

    raw = sys.argv[1] if len(sys.argv) > 1 else '{"report_type": "full"}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"report_type": "full"}

    log_stats = scan_execution_logs()
    trust_scores = calculate_trust_scores()
    cost_estimate = generate_cost_estimate()

    data_summary = f"""## Agent 可观测性数据
- 总产出文件: {log_stats['total_files']} | 近7天: {log_stats['recent_7d_files']}
- 模块统计: {json.dumps({k: v['recent_7d'] for k, v in log_stats['modules'].items()}, ensure_ascii=False)}
- Agent信任排名: {', '.join([f"{a['name']}({a['trust_score']})" for a in trust_scores[:5]])}
- 预估月成本: ${cost_estimate['estimated_monthly_cost_usd']} / ${cost_estimate['monthly_budget_usd']}
"""

    analysis = call_llm(f"{data_summary}\n请给出：\n1. 系统整体运行评估\n2. 需要关注的问题\n3. 效率优化建议")

    report = {
        "timestamp": timestamp,
        "execution_stats": log_stats,
        "trust_scores": trust_scores,
        "cost_estimate": cost_estimate,
        "analysis": analysis,
    }

    out_file = OUTPUT_DIR / f"observability_{timestamp}.json"
    out_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = (f"可观测性: 总产出{log_stats['total_files']}文件 近7天{log_stats['recent_7d_files']} | "
               f"预估月成本${cost_estimate['estimated_monthly_cost_usd']} | "
               f"Top Agent: {trust_scores[0]['name']}({trust_scores[0]['trust_score']})")

    print(json.dumps({"ok": True, "summary": summary, "report_file": str(out_file)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
