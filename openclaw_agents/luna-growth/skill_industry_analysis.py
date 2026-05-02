"""
skill_industry_analysis.py — 卢娜的技能：行业趋势分析
调用 LLM 分析指定行业的市场趋势、竞争格局、机会窗口
"""
import json, sys, time
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=2000):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在做行业分析，请基于最新的行业认知输出深度洞察。注意标注哪些是确定的事实，哪些是推测。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def main():
    industry = sys.argv[1] if len(sys.argv) > 1 else "AI Agent 自动化"
    try:
        p = json.loads(industry)
        industry = p.get("industry", industry)
    except:
        pass

    now = time.strftime("%Y%m%d_%H%M")

    analysis = call_llm(f"""## 行业趋势分析 — 「{industry}」

请完成全面的行业分析报告：

### 1. 市场规模与增长
- 全球和中国市场规模预估
- 年增长率和关键驱动因素

### 2. 竞争格局
- 头部玩家（国内外各 3-5 家）及其核心优势
- 市场集中度和进入壁垒

### 3. 技术趋势
- 当前主流技术路线
- 未来 1-2 年的技术演进方向

### 4. 用户需求
- 目标用户画像（B端/C端）
- 用户最大的 5 个痛点
- 付费意愿和价格敏感度

### 5. 机会窗口
- 目前哪些细分市场还有空间
- 一人公司切入的最佳赛道建议（具体到产品形态）

### 6. 风险因素
- 政策风险、技术风险、市场风险

请在不确定的数据旁标注「预估」。""")

    result = {
        "ok": True,
        "summary": f"行业分析完成: 「{industry}」市场规模/竞争格局/技术趋势/机会窗口",
        "industry": industry, "analysis": analysis,
    }
    (OUTPUT_DIR / f"industry_analysis_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
