"""
skill_web_monitor.py — 赫敏的技能：网页变化监控
监控指定 URL 列表，截图并对比页面内容变化，输出变化报告。
"""
import json, sys, os, hashlib
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
SNAPSHOT_DIR = PROJECT / "output" / "web_snapshots"

MONITOR_TARGETS = [
    {"name": "公司官网", "url": "https://www.winnermedical.com", "selector": "body"},
    {"name": "飞书开放平台", "url": "https://open.feishu.cn/document/home/index", "selector": "body"},
]

def content_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()

def main():
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(json.dumps({"ok": False, "summary": "Playwright 未安装，请运行 pip install playwright && playwright install chromium"}))
        return

    results = []
    now = datetime.now().strftime("%Y%m%d_%H%M")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )

        for target in MONITOR_TARGETS:
            name = target["name"]
            url = target["url"]
            selector = target.get("selector", "body")
            record = {"name": name, "url": url, "changed": False, "error": None}

            try:
                page = context.new_page()
                page.set_default_timeout(30000)
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(3000)

                screenshot_path = str(SNAPSHOT_DIR / f"{name}_{now}.png")
                page.screenshot(path=screenshot_path, full_page=False)
                record["screenshot"] = screenshot_path

                text = page.inner_text(selector)[:5000]
                current_hash = content_hash(text)

                hash_file = SNAPSHOT_DIR / f"{name}_last_hash.txt"
                if hash_file.exists():
                    prev_hash = hash_file.read_text().strip()
                    record["changed"] = current_hash != prev_hash
                    if record["changed"]:
                        record["detail"] = f"内容哈希变化: {prev_hash[:8]}→{current_hash[:8]}"

                hash_file.write_text(current_hash)
                page.close()

            except Exception as e:
                record["error"] = str(e)[:200]

            results.append(record)

        browser.close()

    changed_count = sum(1 for r in results if r.get("changed"))
    error_count = sum(1 for r in results if r.get("error"))
    summary = f"监控完成: {len(results)} 个目标, {changed_count} 个变化, {error_count} 个错误"

    report = {"ok": error_count == 0, "summary": summary, "timestamp": now, "results": results}

    report_path = OUTPUT_DIR / f"web_monitor_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
