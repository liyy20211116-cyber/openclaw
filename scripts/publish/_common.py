"""发布器公共工具：CDP 连接、路径辅助、人类节奏模拟。"""
from __future__ import annotations

import json
import random
import time
import urllib.request
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent.parent
INTEGRATIONS = ROOT / "config" / "tenant" / "default" / "integrations"
PUBLISH_LOG = ROOT / "output" / "publish_log"

DEFAULT_CDP_PORT = 9222
DEFAULT_CDP_ENDPOINT = f"http://127.0.0.1:{DEFAULT_CDP_PORT}"


def human_sleep(lo: float = 0.8, hi: float = 2.4) -> None:
    """模拟真人节奏，防机器人检测。"""
    time.sleep(random.uniform(lo, hi))


def human_type_delay() -> int:
    """单字输入毫秒（给 page.type 用）。"""
    return random.randint(60, 140)


def load_integration(platform: str) -> dict:
    p = INTEGRATIONS / f"{platform}.json"
    if not p.exists():
        raise FileNotFoundError(f"integration 配置不存在: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def probe_cdp(port: int = DEFAULT_CDP_PORT) -> list[dict]:
    """检测 CDP 端口是否可连，返回当前所有 Tab 的信息。"""
    url = f"http://127.0.0.1:{port}/json/version"
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            version_info = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        raise ConnectionError(
            f"CDP 端口 {port} 未就绪：{e}\n"
            f"请先跑：pwsh scripts/publish/start_chrome_debuggable.ps1"
        ) from e

    tabs_url = f"http://127.0.0.1:{port}/json"
    with urllib.request.urlopen(tabs_url, timeout=3) as r:
        tabs = json.loads(r.read().decode("utf-8"))
    return tabs


def connect_cdp(port: int = DEFAULT_CDP_PORT):
    """连接 CDP 并返回 (playwright, browser, context, page)。"""
    from playwright.sync_api import sync_playwright

    probe_cdp(port)
    pw = sync_playwright().start()
    browser = pw.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
    if not browser.contexts:
        raise RuntimeError("CDP 连接成功但 context 为空，检查浏览器是否卡住。")
    context = browser.contexts[0]
    page = context.pages[0] if context.pages else context.new_page()
    return pw, browser, context, page


def log_publish(platform: str, record: dict) -> None:
    PUBLISH_LOG.mkdir(parents=True, exist_ok=True)
    import datetime as dt
    stamp = dt.datetime.now().strftime("%Y-%m-%d")
    f = PUBLISH_LOG / f"{stamp}-{platform}.jsonl"
    with f.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(record, ensure_ascii=False) + "\n")


def goto_tab_or_new(context, url_contains: str, target_url: Optional[str] = None):
    """找匹配的已打开 tab，否则新开一个。"""
    for p in context.pages:
        try:
            if url_contains in (p.url or ""):
                p.bring_to_front()
                return p
        except Exception:
            continue
    page = context.new_page()
    if target_url:
        page.goto(target_url, wait_until="domcontentloaded")
    return page
