"""
skill_roi_calculator.py — 珀西的技能：ROI 投资回报计算器
根据投资额和预期收益计算项目 ROI，支持销售报价和项目评估决策。
新增：自动拉取 LLM 用量统计计算实际 AI 运营成本。
"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "finance")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1200):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是珀西·韦斯莱，一人公司首席财务官(CFO)。你擅长做精准的财务分析和 ROI 测算，输出结构清晰的财务建议。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def calculate_roi(investment, monthly_savings, months=12, impl_months=1):
    total_savings = monthly_savings * (months - impl_months)
    net_profit = total_savings - investment
    roi_pct = (net_profit / investment * 100) if investment > 0 else 0
    payback = investment / monthly_savings if monthly_savings > 0 else float('inf')
    return {
        "investment": investment,
        "monthly_savings": monthly_savings,
        "period_months": months,
        "total_savings": total_savings,
        "net_profit": net_profit,
        "roi_pct": round(roi_pct, 1),
        "payback_months": round(payback, 1),
        "recommendation": "建议投资" if roi_pct > 100 else ("可以考虑" if roi_pct > 30 else "暂缓"),
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")
    target = task_arg or "AI一人公司标准服务包"

    scenarios = [
        {"name": "AI 工作流自动化咨询", "investment": 10000, "monthly_savings": 5000, "months": 12},
        {"name": "定制 Agent 开发", "investment": 30000, "monthly_savings": 8000, "months": 12},
        {"name": "AI 培训工作坊", "investment": 5000, "monthly_savings": 2000, "months": 6},
        {"name": "月度运维服务", "investment": 3000, "monthly_savings": 3000, "months": 12},
    ]

    results = []
    for s in scenarios:
        roi = calculate_roi(s["investment"], s["monthly_savings"], s["months"])
        results.append({"scenario": s["name"], **roi})

    prompt = f"""## ROI 分析报告

项目/产品：{target}

以下是 4 个标准服务场景的 ROI 计算结果：
{json.dumps(results, ensure_ascii=False, indent=2)}

请基于以上数据：
1. 给出综合投资建议（100字内）
2. 指出最优投资场景
3. 给出定价优化建议"""

    analysis = call_llm(prompt)

    out_file = os.path.join(OUTPUT_DIR, f"roi_analysis_{timestamp}.json")
    report = {"generated_at": timestamp, "target": target, "scenarios": results, "analysis": analysis}
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    llm_cost = 0
    try:
        import urllib.request
        llm_req = urllib.request.Request(
            "http://127.0.0.1:18782/api/llm/usage-stats",
            data=b'{}',
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(llm_req, timeout=5) as resp:
            llm_data = json.loads(resp.read().decode("utf-8"))
            llm_cost = llm_data.get("weeklyCost", 0)
    except Exception:
        pass

    best = max(results, key=lambda x: x["roi_pct"])

    out = SkillOutput()
    out.summary = f"ROI 分析完成: {len(results)} 个场景 | 最优: {best['scenario']} (ROI {best['roi_pct']}%)"
    if llm_cost > 0:
        out.summary += f" | 本周 LLM 成本: ¥{llm_cost:.4f}"
    out.data = {
        "scenarios": results,
        "analysis": analysis,
        "best_scenario": best["scenario"],
        "best_roi": best["roi_pct"],
        "weekly_llm_cost": llm_cost,
    }
    out.add_artifact(os.path.basename(out_file), json.dumps(report, ensure_ascii=False, indent=2))
    out.metrics["scenariosAnalyzed"] = len(results)
    out.emit()


if __name__ == "__main__":
    main()
