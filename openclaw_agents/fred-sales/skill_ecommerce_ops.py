"""
skill_ecommerce_ops.py — 弗雷德的技能：电商闭环运营
选品分析 → 上架优化 → 定价策略 → 订单跟踪 → 竞品监控
"""
import json, os, sys, time
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "ecommerce"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=1200):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是弗雷德，一人公司销售商务官(CSO)。你精通电商运营，善于选品定价和转化优化。"},
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


def analyze_product_opportunity(category: str, budget: str) -> dict:
    """分析选品机会"""
    prompt = f"""作为电商运营专家，请分析「{category}」品类的选品机会：
预算范围：{budget}

请输出 JSON 格式：
{{
  "category": "{category}",
  "market_size": "市场规模评估",
  "competition_level": "高/中/低",
  "recommended_products": [
    {{"name": "产品名", "price_range": "价格区间", "margin": "利润率", "demand_trend": "上升/稳定/下降", "score": 85}}
  ],
  "entry_strategy": "入场策略建议",
  "risk_factors": ["风险1", "风险2"],
  "platforms": ["推荐平台1", "推荐平台2"]
}}"""
    result = call_llm(prompt)
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        return json.loads(result[start:end]) if start >= 0 else {}
    except Exception:
        return {"category": category, "error": "解析失败"}


def generate_product_listing(product: str, platform: str) -> dict:
    """生成商品上架文案"""
    prompt = f"""为「{platform}」平台生成「{product}」的完整上架文案：

请输出 JSON 格式：
{{
  "title": "商品标题（含核心关键词）",
  "subtitle": "副标题",
  "bullet_points": ["卖点1", "卖点2", "卖点3", "卖点4", "卖点5"],
  "description": "详情描述（200字，SEO友好）",
  "keywords": ["搜索关键词1", "关键词2", ...],
  "main_image_prompt": "主图AI生成提示词（英文）",
  "pricing_suggestion": {{
    "cost": 0,
    "recommended_price": 0,
    "competitor_avg": 0,
    "strategy": "定价策略说明"
  }}
}}"""
    result = call_llm(prompt)
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        return json.loads(result[start:end]) if start >= 0 else {}
    except Exception:
        return {"title": product, "error": "解析失败"}


def track_order_metrics(orders_data: list) -> dict:
    """分析订单指标"""
    if not orders_data:
        return {"total": 0, "note": "暂无订单数据"}

    total = len(orders_data)
    revenue = sum(o.get("amount", 0) for o in orders_data)
    avg_order = revenue / max(total, 1)

    return {
        "total_orders": total,
        "total_revenue": revenue,
        "avg_order_value": round(avg_order, 2),
        "platforms": list(set(o.get("platform", "") for o in orders_data)),
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")

    raw = sys.argv[1] if len(sys.argv) > 1 else '{"action": "analyze", "category": "AI工具", "budget": "5000-20000"}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"action": "analyze", "category": raw}

    action = params.get("action", "analyze")
    results = {}

    if action == "analyze":
        category = params.get("category", "AI工具")
        budget = params.get("budget", "5000-20000")
        results = analyze_product_opportunity(category, budget)
        results["action"] = "选品分析"

    elif action == "listing":
        product = params.get("product", "AI编程助手")
        platform = params.get("platform", "淘宝")
        results = generate_product_listing(product, platform)
        results["action"] = "上架文案"

    elif action == "metrics":
        orders = params.get("orders", [])
        results = track_order_metrics(orders)
        results["action"] = "订单分析"

    elif action == "full_pipeline":
        category = params.get("category", "AI工具")
        platform = params.get("platform", "淘宝")
        opportunity = analyze_product_opportunity(category, params.get("budget", "5000-20000"))
        top_product = ""
        if opportunity.get("recommended_products"):
            top_product = opportunity["recommended_products"][0].get("name", category)
        listing = generate_product_listing(top_product or category, platform)
        results = {
            "action": "电商全流程",
            "opportunity_analysis": opportunity,
            "listing": listing,
            "next_steps": ["上传商品", "设置价格", "投放广告", "监控数据"],
        }

    out_file = OUTPUT_DIR / f"ecom_{action}_{timestamp}.json"
    out_file.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = f"电商运营[{results.get('action', action)}]: {params.get('category', params.get('product', 'N/A'))}"
    print(json.dumps({"ok": True, "summary": summary, "output_file": str(out_file), "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
