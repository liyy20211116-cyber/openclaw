"""
skill_ecommerce_analysis.py — 卢娜的技能：电商平台竞品分析
使用 Playwright 访问天猫/京东搜索页面，分析竞品产品和定价
"""
import json, sys
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
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在做电商竞品分析，请输出市场洞察和定价建议。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def scrape_platform(keyword, platform="jd"):
    urls = {
        "jd": f"https://search.jd.com/Search?keyword={keyword}",
        "tmall": f"https://list.tmall.com/search_product.htm?q={keyword}",
    }
    url = urls.get(platform, urls["jd"])
    products = []
    error = None

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            page = ctx.new_page()
            page.set_default_timeout(30000)
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(5000)

            now = datetime.now().strftime("%Y%m%d_%H%M")
            page.screenshot(path=str(OUTPUT_DIR / f"ecommerce_{platform}_{now}.png"))

            items = page.query_selector_all("[class*='product'], [class*='goods'], [class*='gl-item'], li[class*='product']")
            if not items:
                items = page.query_selector_all("li[data-sku], div[class*='item']")

            for i, item in enumerate(items[:20]):
                try:
                    text = item.inner_text()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    products.append({"rank": i + 1, "title": lines[0] if lines else "", "price_info": " ".join(lines[1:3]) if len(lines) > 1 else "", "raw": text[:300]})
                except:
                    pass

            browser.close()
    except ImportError:
        error = "Playwright 未安装"
    except Exception as e:
        error = str(e)[:300]

    return products, error


def main():
    keyword = sys.argv[1] if len(sys.argv) > 1 else "AI自动化工具"
    try:
        p = json.loads(keyword)
        keyword = p.get("keyword", keyword)
    except:
        pass

    now = datetime.now().strftime("%Y%m%d_%H%M")
    jd_products, jd_error = scrape_platform(keyword, "jd")

    product_text = "\n".join([f"{p['rank']}. {p['title']} | {p['price_info']}" for p in jd_products[:15]]) or "未能获取商品列表"

    analysis = call_llm(f"""## 电商竞品分析 — 「{keyword}」

### 京东搜索结果 ({len(jd_products)} 条)
{product_text}

请分析：
1. 价格区间分布（低/中/高端各占比）
2. 主流卖点提炼 Top 5（竞品都在强调什么）
3. 差异化机会（哪些需求没被满足）
4. 定价建议（如果我们要进入这个市场，应该定在什么价位）
5. 详情页优化建议（标题/主图/卖点/评价管理）""")

    result = {
        "ok": len(jd_products) > 0 or jd_error is None,
        "summary": f"电商竞品分析: 「{keyword}」获取 {len(jd_products)} 个商品" + (f" (错误: {jd_error[:80]})" if jd_error else ""),
        "keyword": keyword, "product_count": len(jd_products),
        "analysis": analysis, "products": jd_products[:10],
    }
    (OUTPUT_DIR / f"ecommerce_analysis_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
