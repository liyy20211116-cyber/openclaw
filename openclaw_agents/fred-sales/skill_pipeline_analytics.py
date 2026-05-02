"""
skill_pipeline_analytics.py — 弗雷德的技能：销售漏斗分析
分析销售管道各阶段转化率、成交周期、客单价趋势，输出优化建议
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data_raw")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "sales")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""

PIPELINE_FILE = os.path.join(DATA_DIR, "sales_pipeline.json")
STAGE_ORDER = ["线索", "初步接触", "需求确认", "方案演示", "报价", "谈判", "成交"]


def call_llm(prompt, max_tokens=1200):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是弗雷德·韦斯莱，一人公司销售官(CSO)。你擅长分析销售数据，给出接地气的增长建议。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def analyze_pipeline(leads):
    stage_counts = {}
    stage_values = {}
    for stage in STAGE_ORDER:
        stage_leads = [l for l in leads if l.get("stage") == stage]
        stage_counts[stage] = len(stage_leads)
        stage_values[stage] = sum(l.get("value", 0) for l in stage_leads)

    total = len(leads)
    won = stage_counts.get("成交", 0)
    lost = sum(1 for l in leads if l.get("stage") == "流失")
    total_value = sum(l.get("value", 0) for l in leads)
    won_value = stage_values.get("成交", 0)
    avg_deal = round(won_value / won) if won > 0 else 0

    conversion_rates = {}
    for i in range(len(STAGE_ORDER) - 1):
        prev = stage_counts.get(STAGE_ORDER[i], 0)
        curr = stage_counts.get(STAGE_ORDER[i + 1], 0)
        rate = round(curr / prev * 100, 1) if prev > 0 else 0
        conversion_rates[f"{STAGE_ORDER[i]}→{STAGE_ORDER[i+1]}"] = rate

    win_rate = round(won / (won + lost) * 100, 1) if (won + lost) > 0 else 0

    source_stats = {}
    for l in leads:
        src = l.get("source", "未知")
        if src not in source_stats:
            source_stats[src] = {"count": 0, "value": 0, "won": 0}
        source_stats[src]["count"] += 1
        source_stats[src]["value"] += l.get("value", 0)
        if l.get("stage") == "成交":
            source_stats[src]["won"] += 1

    return {
        "total_leads": total,
        "won": won,
        "lost": lost,
        "win_rate": win_rate,
        "total_pipeline_value": total_value,
        "won_value": won_value,
        "avg_deal_size": avg_deal,
        "stage_distribution": stage_counts,
        "stage_values": stage_values,
        "conversion_rates": conversion_rates,
        "source_breakdown": source_stats,
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    if not os.path.exists(PIPELINE_FILE):
        summary = "暂无销售管道数据，请先通过弗雷德的其他技能录入客户线索"
        print(json.dumps({"ok": True, "summary": summary}, ensure_ascii=False))
        return

    data = json.loads(open(PIPELINE_FILE, encoding="utf-8").read())
    leads = data.get("leads", [])

    if not leads:
        summary = "销售管道为空，暂无可分析的线索"
        print(json.dumps({"ok": True, "summary": summary}, ensure_ascii=False))
        return

    analytics = analyze_pipeline(leads)

    prompt = f"""## 销售漏斗分析

关键数据：
- 总线索 {analytics['total_leads']} 条 | 成交 {analytics['won']} 条 | 流失 {analytics['lost']} 条
- 成交率 {analytics['win_rate']}% | 客单价 CNY{analytics['avg_deal_size']:,}
- 管道总价值 CNY{analytics['total_pipeline_value']:,} | 已成交 CNY{analytics['won_value']:,}

各阶段转化率：{json.dumps(analytics['conversion_rates'], ensure_ascii=False)}
来源分布：{json.dumps(analytics['source_breakdown'], ensure_ascii=False)}

{f'补充信息: {task_arg}' if task_arg else ''}

请给出：
1. 漏斗瓶颈在哪个环节
2. 最高效的获客渠道
3. 3条提升成交率的具体建议"""

    analysis = call_llm(prompt)

    report = {
        "report_date": timestamp,
        "analytics": analytics,
        "llm_analysis": analysis,
    }

    out_file = os.path.join(OUTPUT_DIR, f"pipeline_analytics_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = (f"漏斗分析: {analytics['total_leads']}条线索 | 成交率{analytics['win_rate']}% | "
               f"客单价CNY{analytics['avg_deal_size']:,} | 管道CNY{analytics['total_pipeline_value']:,}")
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
