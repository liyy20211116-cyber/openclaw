"""
skill_competitor_pricing.py — 弗雷德的技能：竞品定价分析
分析 AI 自动化/Agent 领域竞品的定价策略
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=1500):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是弗雷德，一人公司 CSO。你在做竞品定价分析，请基于行业知识输出结构化建议。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def load_pricing_config():
    cfg_path = os.path.join(PROJECT_ROOT, "config", "payment-info.json")
    if os.path.isfile(cfg_path):
        try:
            return json.loads(open(cfg_path, encoding="utf-8").read())
        except:
            pass
    return {}


def main():
    our_pricing = load_pricing_config()
    our_pricing_text = json.dumps(our_pricing, ensure_ascii=False, indent=2)[:500] if our_pricing else "暂未配置"

    prompt = f"""## 竞品定价分析

### 我们的定价
{our_pricing_text}

### 请完成以下分析

1. **行业定价地图**：列出 AI Agent/自动化 SaaS 领域的主流竞品及其定价模式（至少 5 个）
2. **定价模式对比**：按月/年费、Token 用量、座位数等维度对比
3. **我们的定位建议**：基于一人公司的产品特性，建议采用什么定价策略
4. **套餐设计建议**：建议 3 个套餐（入门/专业/企业）的定价、包含功能和目标客户
5. **首单策略**：如何设计首单优惠来降低获客门槛"""

    analysis = call_llm(prompt)
    result = {
        "ok": True,
        "summary": "竞品定价分析完成: 输出行业地图、定位建议和套餐设计",
        "analysis": analysis,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
