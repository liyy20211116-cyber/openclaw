"""
skill_platform_ops_dashboard.py — 卢娜的技能：跨平台运营看板
汇总各平台数据（output 中的分析报告），生成跨平台运营全景看板
"""
import json, os
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=1500):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在生成跨平台运营看板，请用数据驱动的方式输出运营全景和行动建议。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def collect_platform_data():
    platform_reports = {"douyin": [], "xhs": [], "ecommerce": [], "content": [], "other": []}

    if not os.path.isdir(str(OUTPUT_DIR)):
        return platform_reports

    for fname in sorted(os.listdir(str(OUTPUT_DIR)), reverse=True):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(str(OUTPUT_DIR), fname)
        try:
            data = json.loads(open(fpath, encoding="utf-8").read())
            summary = data.get("summary", "")[:200]
            entry = {"file": fname, "summary": summary, "ok": data.get("ok", False)}

            if "douyin" in fname:
                platform_reports["douyin"].append(entry)
            elif "xhs" in fname:
                platform_reports["xhs"].append(entry)
            elif "ecommerce" in fname:
                platform_reports["ecommerce"].append(entry)
            elif "content" in fname or "draft" in fname:
                platform_reports["content"].append(entry)
            else:
                platform_reports["other"].append(entry)
        except:
            pass

    for k in platform_reports:
        platform_reports[k] = platform_reports[k][:5]
    return platform_reports


def main():
    data = collect_platform_data()
    now = datetime.now().strftime("%Y%m%d_%H%M")

    total = sum(len(v) for v in data.values())
    data_text = ""
    for platform, reports in data.items():
        if reports:
            data_text += f"\n### {platform} ({len(reports)} 份报告)\n"
            for r in reports:
                data_text += f"- [{('✅' if r['ok'] else '❌')}] {r['file']}: {r['summary']}\n"

    analysis = call_llm(f"""## 跨平台运营看板 — {datetime.now().strftime('%Y-%m-%d')}

### 数据汇总 (共 {total} 份报告)
{data_text or '暂无平台数据报告'}

请生成运营全景看板：
1. 各平台运营状态概览（一句话总结每个平台的当前状态）
2. 本周关键数据指标（如有）
3. 跨平台内容策略一致性评估
4. 各平台优先级排序（基于 ROI 潜力）
5. 本周运营行动清单 Top 5（最高优先级的具体任务）
6. 风险提示（哪些平台需要紧急关注）""")

    result = {
        "ok": True,
        "summary": f"运营看板生成: 汇总 {total} 份平台报告, 覆盖 {sum(1 for v in data.values() if v)} 个平台",
        "analysis": analysis,
        "platform_counts": {k: len(v) for k, v in data.items()},
    }
    (OUTPUT_DIR / f"ops_dashboard_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
