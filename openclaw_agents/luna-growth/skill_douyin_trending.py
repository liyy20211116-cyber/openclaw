"""
skill_douyin_trending.py — 卢娜的技能：抖音热点追踪
使用 Playwright 抓取抖音热搜榜，分析热点话题和趋势。
不需要登录，仅抓取公开可见的热搜列表。
"""
import json, sys
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"


def main():
    now = datetime.now().strftime("%Y%m%d_%H%M")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(json.dumps({
            "ok": False,
            "summary": "Playwright 未安装，请运行: pip install playwright && playwright install chromium"
        }))
        return

    trending = []
    error = None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = context.new_page()
            page.set_default_timeout(30000)

            page.goto("https://www.douyin.com/hot", wait_until="domcontentloaded")
            page.wait_for_timeout(5000)

            screenshot_path = str(OUTPUT_DIR / f"douyin_hot_{now}.png")
            page.screenshot(path=screenshot_path)

            items = page.query_selector_all("[class*='hot-list'] [class*='item']")

            if not items:
                items = page.query_selector_all("li, [class*='HotItem'], [class*='hot']")

            for i, item in enumerate(items[:30]):
                try:
                    text = item.inner_text()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    if lines:
                        entry = {
                            "rank": i + 1,
                            "title": lines[0] if lines else "",
                            "detail": lines[1] if len(lines) > 1 else "",
                            "raw": text[:200],
                        }
                        trending.append(entry)
                except Exception:
                    pass

            browser.close()

    except Exception as e:
        error = str(e)[:300]

    if not trending and not error:
        trending = [{"rank": 0, "title": "页面结构变化，未能解析热搜列表", "detail": "建议检查截图确认页面状态"}]

    report = {
        "ok": len(trending) > 0 and error is None,
        "summary": f"抖音热搜: 获取到 {len(trending)} 条热点" + (f" (错误: {error[:100]})" if error else ""),
        "timestamp": now,
        "trending": trending,
        "screenshot": str(OUTPUT_DIR / f"douyin_hot_{now}.png") if not error else None,
    }

    report_path = OUTPUT_DIR / f"douyin_trending_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
