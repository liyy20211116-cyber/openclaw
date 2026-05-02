"""
skill_competitor_watch.py — 赫敏的技能：竞品网站监控
定期访问竞品关键页面，抓取定价/功能更新信息，截图存档。
"""
import json, os, hashlib
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
SNAPSHOT_DIR = PROJECT / "output" / "competitor_snapshots"

COMPETITORS = [
    {
        "name": "Dify",
        "pages": [
            {"label": "pricing", "url": "https://dify.ai/pricing"},
            {"label": "features", "url": "https://dify.ai"},
        ]
    },
    {
        "name": "Coze",
        "pages": [
            {"label": "home", "url": "https://www.coze.com"},
        ]
    },
]

def main():
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(json.dumps({"ok": False, "summary": "Playwright 未安装"}))
        return

    now = datetime.now().strftime("%Y%m%d_%H%M")
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )

        for competitor in COMPETITORS:
            comp_name = competitor["name"]
            comp_result = {"name": comp_name, "pages": []}

            for page_info in competitor["pages"]:
                label = page_info["label"]
                url = page_info["url"]
                page_record = {"label": label, "url": url, "changed": False, "error": None}

                try:
                    page = context.new_page()
                    page.set_default_timeout(30000)
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_timeout(3000)

                    safe_name = f"{comp_name}_{label}"
                    screenshot_path = str(SNAPSHOT_DIR / f"{safe_name}_{now}.png")
                    page.screenshot(path=screenshot_path, full_page=False)
                    page_record["screenshot"] = screenshot_path

                    text = page.inner_text("body")[:5000]
                    current_hash = hashlib.md5(text.encode("utf-8")).hexdigest()

                    hash_file = SNAPSHOT_DIR / f"{safe_name}_last_hash.txt"
                    if hash_file.exists():
                        prev_hash = hash_file.read_text().strip()
                        page_record["changed"] = current_hash != prev_hash

                    hash_file.write_text(current_hash)
                    page.close()

                except Exception as e:
                    page_record["error"] = str(e)[:200]

                comp_result["pages"].append(page_record)

            results.append(comp_result)

        browser.close()

    total_pages = sum(len(c["pages"]) for c in results)
    changed = sum(1 for c in results for pg in c["pages"] if pg.get("changed"))
    errors = sum(1 for c in results for pg in c["pages"] if pg.get("error"))

    summary = f"竞品监控: {len(results)} 家竞品, {total_pages} 个页面, {changed} 个变化, {errors} 个错误"
    report = {"ok": errors == 0, "summary": summary, "timestamp": now, "competitors": results}

    report_path = OUTPUT_DIR / f"competitor_watch_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
