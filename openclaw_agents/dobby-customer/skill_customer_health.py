"""
skill_customer_health.py — 多比的技能：客户健康评分
综合评估客户健康度（交互频率、满意度、合同状态），输出预警和行动建议
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data_raw")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "customer")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1000):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是多比，一人公司客户成功官(CXO)。你关注每个客户的健康度，擅长发现流失风险和挽留机会。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def load_customer_data():
    """从多个数据源加载客户信息"""
    customers = []

    pipeline_file = os.path.join(DATA_DIR, "sales_pipeline.json")
    if os.path.exists(pipeline_file):
        try:
            data = json.loads(open(pipeline_file, encoding="utf-8").read())
            for lead in data.get("leads", []):
                if lead.get("stage") in ("成交", "报价", "谈判"):
                    customers.append({
                        "name": lead.get("name", "未知"),
                        "stage": lead.get("stage", ""),
                        "value": lead.get("value", 0),
                        "source": lead.get("source", ""),
                        "last_updated": lead.get("updated", ""),
                    })
        except Exception:
            pass

    feedback_dir = os.path.join(PROJECT_ROOT, "output", "feedback")
    feedback_count = 0
    if os.path.isdir(feedback_dir):
        feedback_count = len([f for f in os.listdir(feedback_dir) if f.endswith(".json")])

    onboard_dir = os.path.join(PROJECT_ROOT, "output", "onboarding")
    onboard_count = 0
    if os.path.isdir(onboard_dir):
        onboard_count = len([f for f in os.listdir(onboard_dir) if f.endswith(".json")])

    return customers, feedback_count, onboard_count


def score_customer(customer):
    """对单个客户做健康评分"""
    score = 50

    if customer["stage"] == "成交":
        score += 30
    elif customer["stage"] == "谈判":
        score += 15
    elif customer["stage"] == "报价":
        score += 10

    if customer["value"] >= 15000:
        score += 10
    elif customer["value"] >= 5000:
        score += 5

    if customer.get("last_updated"):
        try:
            from datetime import datetime
            updated = datetime.strptime(customer["last_updated"][:10], "%Y-%m-%d")
            days = (datetime.now() - updated).days
            if days <= 7:
                score += 10
            elif days <= 30:
                score += 5
            elif days > 60:
                score -= 15
        except Exception:
            pass

    score = max(0, min(100, score))
    if score >= 80:
        health = "健康"
    elif score >= 60:
        health = "良好"
    elif score >= 40:
        health = "需关注"
    else:
        health = "风险"

    return score, health


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    customers, feedback_count, onboard_count = load_customer_data()

    scored_customers = []
    for c in customers:
        score, health = score_customer(c)
        scored_customers.append({**c, "health_score": score, "health_status": health})

    scored_customers.sort(key=lambda x: x["health_score"])

    healthy = sum(1 for c in scored_customers if c["health_status"] in ("健康", "良好"))
    at_risk = sum(1 for c in scored_customers if c["health_status"] in ("需关注", "风险"))
    total_value = sum(c["value"] for c in scored_customers)
    avg_score = round(sum(c["health_score"] for c in scored_customers) / max(len(scored_customers), 1), 1)

    stats = {
        "total_customers": len(scored_customers),
        "healthy": healthy,
        "at_risk": at_risk,
        "avg_health_score": avg_score,
        "total_value": total_value,
        "feedback_records": feedback_count,
        "onboarding_records": onboard_count,
    }

    prompt = f"""## 客户健康度报告

统计：
- 客户 {stats['total_customers']} 个 | 健康 {healthy} | 风险 {at_risk}
- 平均健康分 {avg_score} | 总价值 CNY{total_value:,}
- 反馈记录 {feedback_count} 条 | 入职记录 {onboard_count} 条

风险客户：
{json.dumps([c for c in scored_customers if c['health_status'] in ('需关注', '风险')][:5], ensure_ascii=False, indent=2)}

请给出：
1. 总体客户健康评估（一句话）
2. 需要优先干预的客户及行动建议
3. 提升客户留存的建议"""

    analysis = call_llm(prompt)

    report = {
        "report_date": timestamp,
        "stats": stats,
        "customers": scored_customers,
        "analysis": analysis,
    }

    out_file = os.path.join(OUTPUT_DIR, f"customer_health_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = (f"客户健康: {len(scored_customers)}客户 均分{avg_score} | "
               f"健康{healthy} 风险{at_risk} | 总价值CNY{total_value:,}")
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
