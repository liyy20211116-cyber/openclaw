"""
skill_ui_smoke_test.py — 赫敏的技能：Jarvis OS 前端冒烟测试
启动 headless 浏览器访问本地 Jarvis OS 前端，验证核心页面可加载。
"""
import json, sys
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"

BASE_URL = "http://localhost:5173"

SMOKE_PAGES = [
    {"path": "/", "name": "CEO 驾驶舱", "expect_text": "驾驶舱"},
    {"path": "/agents", "name": "角色中心", "expect_text": "角色"},
    {"path": "/tasks", "name": "任务看板", "expect_text": "任务"},
    {"path": "/approvals", "name": "审批中心", "expect_text": "审批"},
    {"path": "/treasury", "name": "Token 国库", "expect_text": "Token"},
    {"path": "/store", "name": "Token 超市", "expect_text": "超市"},
    {"path": "/revenues", "name": "利润中心", "expect_text": "利润"},
    {"path": "/audit", "name": "审计中心", "expect_text": "审计"},
    {"path": "/ceo-chat", "name": "CEO 对话页", "expect_text": ""},
    {"path": "/playbook", "name": "盈利闭环", "expect_text": ""},
]

def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(json.dumps({"ok": False, "summary": "Playwright 未安装"}))
        return

    now = datetime.now().strftime("%Y%m%d_%H%M")
    results = []
    screenshot_dir = OUTPUT_DIR / "ui_smoke_test"
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})

        for smoke in SMOKE_PAGES:
            url = f"{BASE_URL}{smoke['path']}"
            record = {"name": smoke["name"], "path": smoke["path"], "passed": False, "error": None, "load_ms": 0}

            try:
                page = context.new_page()
                page.set_default_timeout(15000)

                start = page.evaluate("performance.now()") if False else 0
                import time
                t0 = time.time()
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(2000)
                record["load_ms"] = int((time.time() - t0) * 1000)

                screenshot_path = str(screenshot_dir / f"{smoke['name']}_{now}.png")
                page.screenshot(path=screenshot_path)
                record["screenshot"] = screenshot_path

                body_text = page.inner_text("body")
                if smoke["expect_text"]:
                    record["passed"] = smoke["expect_text"] in body_text
                else:
                    record["passed"] = len(body_text.strip()) > 10

                page.close()

            except Exception as e:
                record["error"] = str(e)[:200]

            results.append(record)

        browser.close()

    passed = sum(1 for r in results if r["passed"])
    failed = len(results) - passed
    summary = f"冒烟测试: {passed}/{len(results)} 通过, {failed} 失败"
    report = {"ok": failed == 0, "summary": summary, "timestamp": now, "results": results}

    report_path = OUTPUT_DIR / f"ui_smoke_test_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
