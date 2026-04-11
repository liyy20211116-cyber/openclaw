"""
create_ones_task_ui.py — 基于 ONES 页面弹窗的自动提报脚本

目标：
- 复用本机已登录浏览器会话
- 按真实页面流程新建“业务需求”或“问题缺陷”
- 成功后读取 #ID / 标题 / 链接，供回调服务回填多维表
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import requests
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

CDP_PORTS = [9337, 18800]

HERE = Path(__file__).parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
TOKEN_CACHE_PATH = HERE / "token_cache.json"
EDGE_CHANNEL = "msedge"
ONES_HOME = "https://ones.winnermedical.com/project/"
ONES_DOMAIN = "ones.winnermedical.com"

PRODUCT_LABEL_MAP = {
    "全棉WMS": "全棉WMS",
    "医疗WMS": "医疗WMS",
    "TMS": "TMS",
    "SAP": "SAP",
    "WIN BI数据报表": "WIN BI数据报表",
    "OMS中台订单库存": "OMS中台订单库存",
    "OA": "OA",
    "BI工具": "BI工具",
}

TITLE = sys.argv[1] if len(sys.argv) > 1 else "测试标题"
DESC = sys.argv[2] if len(sys.argv) > 2 else "测试描述"
SEVERITY_UUID = sys.argv[3] if len(sys.argv) > 3 else "da53MmEu"
ISSUE_TYPE_UUID = sys.argv[4] if len(sys.argv) > 4 else "2cCuqqQw"
PRODUCT_UUID = sys.argv[5] if len(sys.argv) > 5 else "QE2GXyz1QGmiMX55"
REQ_TYPE = sys.argv[6] if len(sys.argv) > 6 else "需求优化"
WAREHOUSE = sys.argv[7] if len(sys.argv) > 7 else ""
PRIORITY = sys.argv[8] if len(sys.argv) > 8 else ""
EXPECTED_DATE = sys.argv[9] if len(sys.argv) > 9 else ""
VALUE_AMOUNT = sys.argv[10] if len(sys.argv) > 10 else ""
SUBMITTER_NAME = sys.argv[11] if len(sys.argv) > 11 else ""
PRODUCT_DISPLAY = sys.argv[12] if len(sys.argv) > 12 else ""

REVIEWER_NAME = CONFIG.get("reviewer_name", "李原野")
PROJECT_NAME = "业务需求池-总"
WORK_ITEM_LABEL = "业务需求" if REQ_TYPE == "需求优化" else "问题缺陷"
WORK_ITEM_CONFIG_KEY = "requirement" if REQ_TYPE == "需求优化" else "bug"
WORK_ITEM_VIEW_URL = CONFIG.get("ones", {}).get("issue_types", {}).get(WORK_ITEM_CONFIG_KEY, {}).get("view_url", ONES_HOME)
SEVERITY_LABEL = {
    "CbHEhDQ4": "P0",
    "Gjh8TNF3": "P1",
    "da53MmEu": "P2",
    "VN4pcKke": "P3",
}.get(SEVERITY_UUID, "P2")
PRIORITY_LABEL = PRIORITY if PRIORITY in {"高", "中", "低"} else "中"
PRODUCT_LABEL = PRODUCT_DISPLAY if PRODUCT_DISPLAY in PRODUCT_LABEL_MAP else PRODUCT_LABEL_MAP.get(PRODUCT_DISPLAY, PRODUCT_DISPLAY or "全棉WMS")
VALUE_TYPE_LABEL = "管理价值"
VALUE_TEXT_LABEL = "效率提升"


def load_token_cache() -> dict:
    if not TOKEN_CACHE_PATH.exists():
        raise RuntimeError(f"未找到 token 缓存文件: {TOKEN_CACHE_PATH}")
    return json.loads(TOKEN_CACHE_PATH.read_text(encoding="utf-8"))


def build_cookie_values(cache: dict) -> dict:
    values = {}
    cookie_header = cache.get("cookie", "") or ""
    for part in cookie_header.split(";"):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        values[k.strip()] = v.strip()
    if cache.get("ones_lt"):
        values["ones-lt"] = cache["ones_lt"]
    if cache.get("ones_org_uuid"):
        values["ones-org-uuid"] = cache["ones_org_uuid"]
    values.setdefault("ones-lang", "zh")
    values.setdefault("ones-region-uuid", "default")
    values.setdefault("timezone", "Asia/Shanghai")
    return values


def build_playwright_cookies(cache: dict) -> list:
    cookies = []
    if cache.get("cookies"):
        for c in cache["cookies"]:
            cookies.append({
                "name": c["name"],
                "value": c["value"],
                "domain": c["domain"],
                "path": c.get("path", "/"),
                "expires": c.get("expires", -1),
                "httpOnly": c.get("httpOnly", False),
                "secure": c.get("secure", False),
                "sameSite": c.get("sameSite", "Lax"),
            })
    else:
        for name, value in build_cookie_values(cache).items():
            cookies.append({
                "name": name,
                "value": value,
                "domain": ONES_DOMAIN,
                "path": "/",
                "httpOnly": False,
                "secure": False,
                "sameSite": "Lax",
            })
    return cookies


def inject_login_state(context, cache: dict):
    context.add_cookies(build_playwright_cookies(cache))


def apply_storage_state(context, cache: dict):
    storage = cache.get("storage") or {}
    local_storage = dict(storage.get("localStorage") or {})
    session_storage = dict(storage.get("sessionStorage") or {})
    local_storage.pop("ONES_LOGOUT_LOGS", None)
    payload = json.dumps([local_storage, session_storage], ensure_ascii=False)
    context.add_init_script(
        script=f"""
        (() => {{
          const [ls, ss] = {payload};
          for (const [k, v] of Object.entries(ls || {{}})) {{
            window.localStorage.setItem(k, v);
          }}
          for (const [k, v] of Object.entries(ss || {{}})) {{
            window.sessionStorage.setItem(k, v);
          }}
        }})();
        """
    )


def restore_storage(page, cache: dict):
    storage = cache.get("storage") or {}
    local_storage = dict(storage.get("localStorage") or {})
    session_storage = dict(storage.get("sessionStorage") or {})
    local_storage.pop("ONES_LOGOUT_LOGS", None)
    page.goto("https://ones.winnermedical.com", wait_until="domcontentloaded", timeout=30000)
    page.evaluate(
        """
        ([ls, ss]) => {
          for (const [k, v] of Object.entries(ls || {})) {
            window.localStorage.setItem(k, v);
          }
          for (const [k, v] of Object.entries(ss || {})) {
            window.sessionStorage.setItem(k, v);
          }
        }
        """,
        [local_storage, session_storage],
    )
    page.reload(wait_until="domcontentloaded", timeout=30000)


def click_text(page, text: str, exact: bool = True, timeout: int = 15000):
    locator = page.get_by_text(text, exact=exact)
    locator.first.wait_for(timeout=timeout)
    locator.first.click()


def wait_dialog(page):
    dialog_title = f"新建{WORK_ITEM_LABEL}"
    candidates = page.locator(".taskEditDialog:visible, .ones-modal:visible, .semi-modal:visible, [role='dialog']:visible").filter(has_text=dialog_title)

    def looks_like_real_dialog(locator) -> bool:
        try:
            if locator.count() == 0 or not locator.first.is_visible(timeout=1000):
                return False
        except Exception:
            return False
        checks = [
            locator.locator("input#summary:visible"),
            locator.locator("button:has-text('确定'), [role='button']:has-text('确定')"),
            locator.locator("button:has-text('取消'), [role='button']:has-text('取消')"),
            locator.locator("[contenteditable='true']:visible, textarea:visible, input:visible"),
        ]
        for item in checks:
            try:
                if item.count() > 0 and item.first.is_visible(timeout=500):
                    return True
            except Exception:
                continue
        return False

    candidates.first.wait_for(timeout=15000)
    for idx in range(min(candidates.count(), 6)):
        current = candidates.nth(idx)
        if looks_like_real_dialog(current):
            return current
    raise RuntimeError(f"检测到包含标题的弹层，但未命中真实新建弹窗结构: {dialog_title}; current_url={page.url}")


def click_create_button(page):
    label = WORK_ITEM_LABEL
    plus_label = f"+{label}"
    dialog_title = f"新建{label}"
    last_error = None

    def dialog_ready() -> bool:
        try:
            wait_dialog(page)
            return True
        except Exception:
            return False

    def clickable_meta(locator) -> tuple[str, str, str, str]:
        text = (locator.inner_text(timeout=1000) or "").strip()
        title = (locator.get_attribute("title") or "").strip()
        aria = (locator.get_attribute("aria-label") or "").strip()
        cls = (locator.get_attribute("class") or "").strip()
        return text, title, aria, cls

    def raw_click(locator):
        locator.scroll_into_view_if_needed(timeout=2000)
        try:
            locator.click(timeout=3000)
        except Exception:
            locator.evaluate(
                """
                (el) => {
                  const target = el.closest('button,[role="button"],a,.ones-button,.semi-button') || el;
                  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                  target.click();
                }
                """
            )

    def try_click(locator, source: str, require_label: bool = True) -> bool:
        nonlocal last_error
        try:
            if not locator.is_visible():
                return False
            text, title, aria, cls = clickable_meta(locator)
            combined = f"{text} {title} {aria}".strip()
            if require_label and combined and label not in combined and plus_label not in combined and dialog_title not in combined:
                return False
            before_url = page.url or ""
            raw_click(locator)
            page.wait_for_timeout(1200)
            after_url = page.url or ""
            if "/view/77FNRHaj" in after_url and after_url != before_url:
                print(f"[WARN] clicked view-switch instead of create: source={source}; text={combined}; class={cls}; url={after_url}")
                return False
            if dialog_ready():
                print(f"[INFO] create_clicked={combined or plus_label}; class={cls}; source={source}")
                return True
        except Exception as e:
            last_error = e
        return False

    if dialog_ready():
        print(f"[INFO] dialog already opened={label}")
        return

    # 已验证稳定入口：页头主按钮右侧 dropdown trigger，但需补一跳点击下拉菜单里的“新建业务需求/问题缺陷”。
    try:
        main_button = page.locator("main button").filter(has_text=label).first
        if main_button.count() > 0 and main_button.is_visible():
            trigger = main_button.locator("xpath=following-sibling::*[1]").first
            if trigger.count() > 0 and trigger.is_visible():
                trigger_text, trigger_title, trigger_aria, trigger_cls = clickable_meta(trigger)
                raw_click(trigger)
                page.wait_for_timeout(800)
                if dialog_ready():
                    print(
                        "[INFO] create_clicked="
                        f"{json.dumps({'source': 'adjacent-dropdown-trigger', 'text': trigger_text, 'title': trigger_title, 'aria': trigger_aria, 'class': trigger_cls}, ensure_ascii=False)}"
                    )
                    return

                menu_candidates = [
                    page.locator(".semi-dropdown-menu, .ones-menu, .semi-portal, [role='menu']").locator("a,button,[role='menuitem'],.ones-menu-item,.semi-dropdown-item"),
                    page.locator("a,button,[role='menuitem'],.ones-menu-item,.semi-dropdown-item").filter(has_text=dialog_title),
                    page.locator("a,button,[role='menuitem'],.ones-menu-item,.semi-dropdown-item").filter(has_text=f"新建{label}"),
                    page.locator("a,button,[role='menuitem'],.ones-menu-item,.semi-dropdown-item").filter(has_text=label),
                ]
                for menu in menu_candidates:
                    try:
                        count = menu.count()
                    except Exception:
                        count = 0
                    for idx in range(min(count, 8)):
                        item = menu.nth(idx)
                        try:
                            if not item.is_visible():
                                continue
                            text, title, aria, cls = clickable_meta(item)
                            combined = f"{text} {title} {aria}".strip()
                            if not combined or (label not in combined and dialog_title not in combined and f"新建{label}" not in combined):
                                continue
                            raw_click(item)
                            page.wait_for_timeout(1000)
                            if dialog_ready():
                                print(
                                    "[INFO] create_clicked="
                                    f"{json.dumps({'source': 'adjacent-dropdown-menu', 'text': text, 'title': title, 'aria': aria, 'class': cls}, ensure_ascii=False)}"
                                )
                                return
                        except Exception as inner_e:
                            last_error = inner_e
    except Exception as e:
        last_error = e

    explicit_candidates = [
        ("explicit-title", page.locator("button,[role='button'],a,.ones-button,.semi-button").filter(has_text=dialog_title)),
        ("explicit-text", page.get_by_text(dialog_title, exact=False)),
    ]
    for source, locator in explicit_candidates:
        try:
            count = locator.count()
            for idx in range(min(count, 6)):
                if try_click(locator.nth(idx), source):
                    return
        except Exception as e:
            last_error = e

    strict_candidates = [
        ("toolbar-primary", page.locator(".toolbar button,.toolbar [role='button'],header button,header [role='button']").filter(has_text=plus_label)),
        ("generic-button", page.locator("button,[role='button'],a,.ones-button,.semi-button").filter(has_text=plus_label)),
        ("role-regex-plus", page.get_by_role("button", name=re.compile(rf"\+\s*{label}"))),
    ]
    for source, locator in strict_candidates:
        try:
            count = locator.count()
            for idx in range(min(count, 10)):
                if try_click(locator.nth(idx), source):
                    return
        except Exception as e:
            last_error = e

    dump = page.evaluate(
        """
        () => Array.from(document.querySelectorAll('button,[role="button"],a,.ones-button,.semi-button'))
          .map(el => ({
            text: `${el.innerText || el.textContent || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`.trim(),
            cls: el.className || '',
            tag: el.tagName,
            toolbar: !!el.closest('.toolbar, header, .layout-header, .ones-table-header, .table-toolbar')
          }))
          .filter(x => /业务需求|问题缺陷|新建/.test(x.text))
          .slice(0, 40)
        """
    )
    raise RuntimeError(f"未找到或无法点击创建按钮: {plus_label}; candidates={json.dumps(dump, ensure_ascii=False)}; last_error={last_error}")



def open_create_dialog(page):
    page.goto(WORK_ITEM_VIEW_URL, wait_until="domcontentloaded", timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        pass
    print(f"[INFO] current_url={page.url}")
    debug_buttons = page.evaluate(
        """
        () => Array.from(document.querySelectorAll('button,[role="button"],a,.ones-button,.semi-button'))
          .map(el => ({
            text: `${el.innerText || el.textContent || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`.trim(),
            cls: el.className || '',
            tag: el.tagName,
            toolbar: !!el.closest('.toolbar, header, .layout-header, .ones-table-header, .table-toolbar')
          }))
          .filter(x => /业务需求|问题缺陷|新建/.test(x.text))
          .slice(0, 40)
        """
    )
    print(f"[INFO] create_button_candidates={json.dumps(debug_buttons, ensure_ascii=False)}")
    page.wait_for_timeout(3000)
    click_create_button(page)
    print(f"[INFO] dialog_opened={WORK_ITEM_LABEL}")


def dialog_text_input(dialog, selector: str, value: str):
    if not value:
        return
    locator = dialog.locator(selector).first
    locator.wait_for(timeout=8000)
    try:
        locator.fill(value)
        return
    except Exception:
        pass
    dialog.page.evaluate(
        """
        ([sel, val]) => {
          const el = document.querySelector(sel);
          if (!el) throw new Error(`input not found: ${sel}`);
          el.focus();
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        """,
        [selector, value],
    )


def field_container(dialog, field_label: str):
    candidates = [
        dialog.locator(f".fieldItem:has-text('{field_label}')"),
        dialog.locator(f".ones-form-item:has-text('{field_label}')"),
        dialog.locator(f"div:has-text('{field_label}')"),
    ]
    for locator in candidates:
        if locator.count() > 0:
            return locator.first
    raise RuntimeError(f"未找到字段区域: {field_label}")


def choose_select_option(dialog, field_label: str, option_label: str):
    if not option_label:
        return

    page = dialog.page
    container = None
    special_map = {
        "所属产品": ".productSelect, .field-input-44",
    }
    special_selector = special_map.get(field_label)
    if special_selector:
        special = dialog.locator(special_selector)
        if special.count() > 0:
            container = special.first

    if container is None:
        container = field_container(dialog, field_label)

    def raw_click(locator):
        locator.scroll_into_view_if_needed(timeout=3000)
        try:
            locator.click(timeout=3000)
        except Exception:
            locator.evaluate(
                """
                (el) => {
                  const target = el.closest('button,[role="button"],a,.ones-button,.semi-button,[role="option"]') || el;
                  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                  target.click();
                }
                """
            )

    def scroll_field_into_view():
        try:
            container.evaluate(
                """
                (el) => {
                  el.scrollIntoView({ block: 'center', inline: 'nearest' });
                  const modalBody = el.closest('.semi-modal-body, .ones-modal-body, .taskEditDialog-body, .semi-modal-content, .taskEditDialog');
                  if (modalBody) {
                    const rect = el.getBoundingClientRect();
                    const bodyRect = modalBody.getBoundingClientRect();
                    if (rect.bottom > bodyRect.bottom - 80) {
                      modalBody.scrollTop += rect.bottom - bodyRect.bottom + 120;
                    }
                    if (rect.top < bodyRect.top + 80) {
                      modalBody.scrollTop -= bodyRect.top - rect.top + 120;
                    }
                  }
                }
                """
            )
        except Exception:
            try:
                container.scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass
        page.wait_for_timeout(400)

    trigger_candidates = [
        container.locator(".ones-select-selector"),
        container.locator(".ones-select, .ones-selection, .semi-select, .semi-tree-select"),
        container.locator("input.ones-selection-search-input"),
        container.locator("input"),
        container.locator("[role='combobox']"),
    ]
    trigger = None
    for candidate in trigger_candidates:
        if candidate.count() > 0:
            trigger = candidate.first
            break
    if trigger is None:
        raise RuntimeError(f"未找到下拉触发器: {field_label}")

    scroll_field_into_view()
    raw_click(trigger)
    page.wait_for_timeout(800)

    desired_labels = [option_label]
    if field_label == "所属产品":
        fallback_map = {
            "WIN BI数据报表": ["WIN BI数据报表"],
            "SAP": ["BW(SAP报表)"],
            "全棉WMS": ["全棉SRM", "ONES"],
            "医疗WMS": ["医疗SRM"],
            "TMS": ["ONES"],
            "OMS中台订单库存": ["ONES"],
            "OA": ["ONES"],
            "BI工具": ["WIN BI数据报表"],
        }
        desired_labels.extend(fallback_map.get(option_label, []))
    elif field_label == "价值类型":
        fallback_map = {
            "管理价值": ["管理价值"],
            "业务价值": ["业务价值"],
            "客户价值": ["客户价值"],
        }
        desired_labels.extend(fallback_map.get(option_label, []))
    elif field_label == "仓库":
        fallback_map = {
            "武汉仓": ["武汉智慧仓"],
            "武汉": ["武汉智慧仓"],
            "黄冈仓": ["黄冈仓"],
            "荆门仓": ["荆门仓"],
            "龙岗仓": ["龙岗仓"],
            "平山仓": ["平山仓"],
            "天门仓": ["天门仓"],
            "嘉兴仓": ["嘉兴仓"],
            "全棉时代": ["全棉时代"],
        }
        desired_labels.extend(fallback_map.get(option_label, []))

    last_error = None

    def collect_visible_options():
        selectors = [
            ".ones-select-dropdown:visible .ones-select-item",
            ".semi-select-dropdown:visible .semi-select-option",
            ".ones-select-dropdown:visible [role='option']",
            ".semi-select-dropdown:visible [role='option']",
            ".ones-dropdown:visible [role='option']",
        ]
        rows = []
        for selector in selectors:
            loc = page.locator(selector)
            count = loc.count()
            for idx in range(min(count, 160)):
                item = loc.nth(idx)
                try:
                    if not item.is_visible():
                        continue
                    txt = (item.inner_text(timeout=300) or "").strip()
                    if not txt:
                        continue
                    rows.append({"selector": selector, "index": idx, "text": txt})
                except Exception:
                    continue
        dedup = []
        seen = set()
        for row in rows:
            key = (row["selector"], row["index"], row["text"])
            if key in seen:
                continue
            seen.add(key)
            dedup.append(row)
        return dedup

    def scroll_active_dropdowns():
        dropdowns = [
            page.locator(".ones-select-dropdown:visible"),
            page.locator(".semi-select-dropdown:visible"),
            page.locator(".ones-dropdown:visible"),
        ]
        for dropdown in dropdowns:
            try:
                if dropdown.count() == 0:
                    continue
                panel = dropdown.first
                panel.evaluate(
                    """
                    (el) => {
                      const scroller = el.querySelector('.ones-scroll-container, .semi-virtual-list, .semi-select-option-list, .rc-virtual-list-holder, .semi-select-content, ul') || el;
                      scroller.scrollTop = scroller.scrollTop + Math.max(320, scroller.clientHeight || 320);
                    }
                    """
                )
            except Exception:
                continue
        page.wait_for_timeout(250)

    def click_dropdown_option(label: str) -> bool:
        nonlocal last_error
        for _ in range(16):
            candidates = collect_visible_options()
            for row in candidates:
                txt = row["text"]
                if txt != label and label not in txt:
                    continue
                locator = page.locator(row["selector"]).nth(row["index"])
                try:
                    raw_click(locator)
                    page.wait_for_timeout(300)
                    return True
                except Exception as e:
                    last_error = e
            scroll_active_dropdowns()
        return False

    available = [row["text"] for row in collect_visible_options()[:100]]
    print(f"[INFO] select_attempt field={field_label} option={option_label} desired={json.dumps(desired_labels, ensure_ascii=False)} available={json.dumps(available, ensure_ascii=False)}")
    for label in desired_labels:
        if click_dropdown_option(label):
            print(f"[INFO] select_success field={field_label} chosen={label}")
            return

    raise RuntimeError(f"未找到下拉选项: {field_label} -> {option_label}; desired={json.dumps(desired_labels, ensure_ascii=False)}; available={json.dumps(available, ensure_ascii=False)}; last_error={last_error}")


def fill_editor(dialog, field_label: str, value: str):
    if not value:
        return

    editor = None
    named_candidates = [
        dialog.get_by_role("textbox", name=field_label),
        dialog.locator(f"textarea[placeholder*='{field_label}']"),
        dialog.locator(f"input[placeholder*='{field_label}']"),
    ]
    for candidate in named_candidates:
        try:
            if candidate.count() > 0 and candidate.first.is_visible():
                editor = candidate.first
                break
        except Exception:
            continue

    if editor is None:
        try:
            container = field_container(dialog, field_label)
            scoped = container.locator("[contenteditable='true'], textarea, input")
            if scoped.count() > 0:
                editor = scoped.first
        except Exception:
            editor = None

    if editor is None:
        # 当前 ONES 弹窗里“描述”是富文本编辑器，而“背景”是普通 textbox。
        if field_label == "描述":
            editor = dialog.locator("[contenteditable='true']").first
        else:
            fallback_inputs = dialog.locator("textarea, input")
            for idx in range(min(fallback_inputs.count(), 20)):
                item = fallback_inputs.nth(idx)
                try:
                    placeholder = (item.get_attribute("placeholder") or "").strip()
                    if field_label and field_label in placeholder:
                        editor = item
                        break
                except Exception:
                    continue

    if editor is None:
        raise RuntimeError(f"未找到编辑器: {field_label}")

    editor.wait_for(timeout=8000)
    try:
        editor.fill(value)
        return
    except Exception:
        pass
    editor.evaluate(
        """
        (el, val) => {
          el.focus();
          if ('value' in el) {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.value = String(val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
            return;
          }
          el.innerHTML = '';
          el.textContent = val;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: val, inputType: 'insertText' }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        """,
        value,
    )


def fill_by_label_input(dialog, field_label: str, value: str):
    if not value:
        return

    input_el = None
    candidates = [
        dialog.get_by_role("textbox", name=field_label),
        dialog.get_by_role("spinbutton", name=field_label),
        dialog.locator(f"textarea[placeholder*='{field_label}']"),
        dialog.locator(f"input[placeholder*='{field_label}']"),
    ]
    for candidate in candidates:
        try:
            if candidate.count() > 0 and candidate.first.is_visible():
                input_el = candidate.first
                break
        except Exception:
            continue

    if input_el is None:
        container = field_container(dialog, field_label)
        inputs = container.locator("input, textarea")
        if inputs.count() == 0:
            raise RuntimeError(f"未找到输入框: {field_label}")
        input_el = inputs.first

    input_el.wait_for(timeout=8000)
    try:
        input_el.fill(str(value))
        return
    except Exception:
        pass
    input_el.evaluate(
        """
        (el, val) => {
          el.focus();
          if ('value' in el) {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.value = String(val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          } else {
            el.textContent = String(val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          }
        }
        """,
        str(value),
    )


def fill_by_selector(dialog, selector: str, value: str):
    if not value:
        return
    field = dialog.locator(selector).first
    field.wait_for(timeout=8000)
    field.evaluate(
        """
        (el, val) => {
          el.focus();
          if ('value' in el) {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.value = String(val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.textContent = String(val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        """,
        str(value),
    )


def submit_dialog(dialog):
    page = dialog.page

    def raw_click(locator):
        locator.scroll_into_view_if_needed(timeout=3000)
        try:
            locator.click(timeout=3000)
        except Exception:
            locator.evaluate(
                """
                (el) => {
                  const target = el.closest('button,[role="button"],a,.ones-button,.semi-button') || el;
                  target.scrollIntoView({ block: 'center', inline: 'nearest' });
                  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                  target.click();
                }
                """
            )

    # 先尝试关闭仍然展开的下拉浮层，避免遮挡提交按钮。
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    except Exception:
        pass

    def visible_button_rows(scope):
        rows = []
        buttons = scope.locator("button, [role='button'], a")
        count = buttons.count()
        for idx in range(min(count, 80)):
            btn = buttons.nth(idx)
            try:
                if not btn.is_visible():
                    continue
                text = (btn.inner_text(timeout=300) or "").strip()
                cls = (btn.get_attribute("class") or "").strip()
                btn_type = (btn.get_attribute("type") or "").strip()
                disabled = (btn.get_attribute("disabled") or "").strip()
                rows.append({
                    "index": idx,
                    "text": text,
                    "class": cls,
                    "type": btn_type,
                    "disabled": bool(disabled),
                })
            except Exception:
                continue
        return rows

    def click_first_match(scope, labels):
        last_error = None
        rows = visible_button_rows(scope)
        for label in labels:
            for row in rows:
                text = row["text"]
                cls = row["class"]
                if row["disabled"]:
                    continue
                if text == label or label in text or (label in cls and label in {"primary", "submit"}):
                    locator = scope.locator("button, [role='button'], a").nth(row["index"])
                    try:
                        raw_click(locator)
                        page.wait_for_timeout(500)
                        return True, rows, None
                    except Exception as e:
                        last_error = e
        return False, rows, last_error

    scopes = [
        dialog,
        page.locator(".semi-modal-footer:visible, .ones-modal-footer:visible, .taskEditDialog footer:visible, [role='dialog']:visible").first,
        page.locator(".semi-modal:visible, .ones-modal:visible, .taskEditDialog:visible").first,
        page,
    ]
    labels = ["确定", "创建", "提交", "保存"]
    last_error = None
    debug_rows = []

    for scope in scopes:
        try:
            if hasattr(scope, "count") and scope.count() == 0:
                continue
        except Exception:
            pass
        ok, rows, err = click_first_match(scope, labels)
        if rows:
            debug_rows.append(rows)
        if ok:
            return
        if err is not None:
            last_error = err

    raise RuntimeError(
        "未找到确定提交按钮; last_error="
        + str(last_error)
        + "; visible_buttons="
        + json.dumps(debug_rows, ensure_ascii=False)
    )


def read_windows_clipboard() -> str:
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "Get-Clipboard"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return (result.stdout or "").strip()
    except Exception:
        return ""


def attach_submit_probe(page):
    hits = []
    armed = {"enabled": False}

    def on_response(resp):
        if not armed["enabled"]:
            return
        req = resp.request
        url = resp.url or ""
        method = req.method or ""
        post_data = ""
        try:
            post_data = req.post_data or ""
        except Exception:
            pass
        try:
            body = resp.text()
        except Exception:
            body = ""
        hits.append({
            "url": url,
            "method": method,
            "status": resp.status,
            "post_data": (post_data or "")[:20000],
            "body": (body or "")[:20000],
        })

    page.on("response", on_response)
    return hits, armed


def try_copy_issue_meta(page) -> str:
    try:
        page.mouse.move(220, 220)
        page.wait_for_timeout(500)
        copy_btn = page.locator("button, [role='button'], a").filter(has_text="复制 ID+标题+链接")
        if copy_btn.count() == 0:
            copy_btn = page.locator("button, [role='button'], a").filter(has_text="复制")
        if copy_btn.count() > 0:
            copy_btn.first.hover()
            page.wait_for_timeout(200)
            copy_btn.first.click(timeout=3000)
            page.wait_for_timeout(500)
            return read_windows_clipboard()
    except Exception:
        pass
    return ""


def extract_issue_info(page, response_hits=None) -> tuple[str, str]:
    page.wait_for_timeout(5000)
    current_url = page.url or ""

    patterns = [
        r"#?(\d{3,})",
        r"#?([A-Z]{2,}-\d+)",
        r"#?(REQ-\d+)",
        r"#?(BUG-\d+)",
        r"#?(TASK-\d+)",
    ]

    def first_match(text: str) -> str:
        for pat in patterns:
            mm = re.search(pat, text or "")
            if mm:
                return mm.group(1)
        return ""

    def first_url(text: str) -> str:
        m = re.search(r'https?://ones\.winnermedical\.com\S+', text or "")
        return m.group(0).strip('\",)') if m else ""

    def normalized(s: str) -> str:
        return re.sub(r"\s+", "", s or "")

    def candidate_from_text(text: str, fallback_url: str = "") -> tuple[str, str]:
        if not text:
            return "", ""
        issue_no = first_match(text)
        if not issue_no:
            return "", ""
        issue_url = first_url(text) or fallback_url or current_url
        return issue_no, issue_url

    def search_current_list() -> tuple[str, str]:
        search_box = page.locator("input[placeholder*='搜索'], input[aria-label*='搜索'], [role='textbox'][name*='搜索']").first
        try:
            if search_box.count() == 0 or not search_box.is_visible(timeout=1000):
                return "", ""
        except Exception:
            return "", ""
        try:
            search_box.click(timeout=2000)
            search_box.fill(TITLE, timeout=3000)
            page.wait_for_timeout(1200)
            page.keyboard.press("Enter")
            page.wait_for_timeout(1800)
            links = page.locator("a")
            title_norm = normalized(TITLE)
            for idx in range(min(links.count(), 80)):
                link = links.nth(idx)
                try:
                    if not link.is_visible():
                        continue
                    text = (link.inner_text(timeout=300) or "").strip()
                    if not text:
                        continue
                    if title_norm not in normalized(text):
                        continue
                    href = link.get_attribute("href") or ""
                    row_text = ""
                    try:
                        row_text = link.locator("xpath=ancestor::*[self::tr or @role='row' or contains(@class,'row')][1]").inner_text(timeout=500)
                    except Exception:
                        pass
                    issue_no = first_match(f"{text}\n{row_text}")
                    issue_url = href if href.startswith("http") else (ONES_HOME.rstrip("/") + "/" + href.lstrip("#/")) if href else current_url
                    return issue_no, issue_url
                except Exception:
                    continue
        except Exception:
            return "", ""
        return "", ""

    def page_error_hints() -> list[str]:
        hints = []
        locators = [
            page.locator(".semi-toast, .semi-notification, .ones-message, .semi-banner, .semi-form-field-error-message, .semi-form-field-help-text, [role='alert']"),
            page.locator("[class*='error'], [class*='warning'], [class*='invalid']"),
        ]
        for loc in locators:
            try:
                count = loc.count()
            except Exception:
                continue
            for idx in range(min(count, 20)):
                try:
                    item = loc.nth(idx)
                    if not item.is_visible():
                        continue
                    text = (item.inner_text(timeout=300) or "").strip()
                    if text and text not in hints:
                        hints.append(text)
                except Exception:
                    continue
        return hints

    title_norm = normalized(TITLE)

    # 1) 优先从提交动作前后的请求/响应里找“本次标题”的强证据。
    for hit in reversed(response_hits or []):
        body = hit.get("body") or ""
        post_data = hit.get("post_data") or ""
        joined = f"{post_data}\n{body}"
        if TITLE and TITLE not in joined:
            continue
        issue_no, issue_url = candidate_from_text(joined, fallback_url=hit.get("url") or current_url)
        if issue_no:
            return issue_no, issue_url

    # 2) 如果提交后已跳到详情页，直接接受当前 URL/页面文案里的编号。
    page_text = ""
    try:
        page_text = page.locator("body").inner_text(timeout=1500)
    except Exception:
        pass
    if title_norm and title_norm in normalized(page_text):
        issue_no, issue_url = candidate_from_text(page_text, fallback_url=current_url)
        if issue_no:
            return issue_no, issue_url

    # 3) 尝试从“我创建的/当前列表”里搜索本次标题，兼容创建成功但脚本未抓到跳转结果的情况。
    issue_no, issue_url = search_current_list()
    if issue_no:
        return issue_no, issue_url

    # 4) 接受“复制出来的元信息里包含当前标题”这一强证据。
    copied = try_copy_issue_meta(page)
    if copied and title_norm and title_norm in normalized(copied):
        issue_no, issue_url = candidate_from_text(copied, fallback_url=current_url)
        if issue_no:
            return issue_no, issue_url

    debug_dump = []
    for hit in (response_hits or [])[-40:]:
        body = hit.get("body") or ""
        if TITLE in body or any(k in (hit.get("url") or "").lower() for k in ["create", "save", "issue", "task", "work", "item"]):
            debug_dump.append({"url": hit.get("url"), "status": hit.get("status"), "body": body[:1000]})

    hints = page_error_hints()
    if hints:
        raise RuntimeError(
            "已提交创建动作，但页面存在未通过校验/提示信息；hints="
            + json.dumps(hints, ensure_ascii=False)
            + "; current_url="
            + current_url
            + "; debug="
            + json.dumps(debug_dump, ensure_ascii=False)
        )

    raise RuntimeError(
        "已提交创建动作，但未能确认本次新建结果；未获取到与当前标题匹配的 ONES 编号/链接；current_url="
        + current_url
        + "; debug="
        + json.dumps(debug_dump, ensure_ascii=False)
    )


def resolve_cdp_url() -> str:
    last_error = None
    for port in CDP_PORTS:
        url = f"http://127.0.0.1:{port}"
        try:
            resp = requests.get(f"{url}/json/version", timeout=2)
            if resp.ok and "webSocketDebuggerUrl" in (resp.text or ""):
                print(f"[INFO] cdp_connected={url}")
                return url
            last_error = f"status={resp.status_code} body={(resp.text or '')[:200]}"
        except Exception as e:
            last_error = str(e)
    raise RuntimeError(f"未找到可用 CDP 调试端口，已尝试: {CDP_PORTS}; last_error={last_error}")


def get_or_open_ones_page(browser):
    for context in browser.contexts:
        for page in context.pages:
            if "ones.winnermedical.com/project/" in (page.url or ""):
                return context, page, False
    context = browser.contexts[0] if browser.contexts else browser.new_context()
    page = context.new_page()
    page.goto(WORK_ITEM_VIEW_URL, wait_until="domcontentloaded", timeout=60000)
    return context, page, True


def create_via_ui():
    full_desc = DESC or "-"
    background_text = DESC or "-"

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(resolve_cdp_url())
        context, page, opened_here = get_or_open_ones_page(browser)
        try:
            if opened_here:
                try:
                    page.wait_for_load_state("networkidle", timeout=15000)
                except PlaywrightTimeoutError:
                    pass
            else:
                page.bring_to_front()
            if WORK_ITEM_VIEW_URL not in (page.url or ""):
                page.goto(WORK_ITEM_VIEW_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(2000)
            print(f"[INFO] current_url={page.url}")
            response_hits, response_armed = attach_submit_probe(page)
            open_create_dialog(page)
            dialog = wait_dialog(page)
            print("[INFO] step=dialog_ready")

            dialog_text_input(dialog, "input#summary", TITLE)
            print("[INFO] step=summary_filled")
            fill_editor(dialog, "描述", full_desc)
            print("[INFO] step=desc_filled")
            choose_select_option(dialog, "所属产品", PRODUCT_LABEL)
            print(f"[INFO] step=product_selected value={PRODUCT_LABEL}")

            if REQ_TYPE == "需求优化":
                choose_select_option(dialog, "需求优先级", PRIORITY_LABEL)
                print(f"[INFO] step=priority_selected value={PRIORITY_LABEL}")
                if EXPECTED_DATE:
                    fill_by_label_input(dialog, "期望上线时间", EXPECTED_DATE)
                    print(f"[INFO] step=expected_date_filled value={EXPECTED_DATE}")
                fill_by_label_input(dialog, "背景", background_text)
                print("[INFO] step=background_filled")
                fill_by_label_input(dialog, "需求价值", VALUE_TEXT_LABEL)
                print(f"[INFO] step=value_text_filled value={VALUE_TEXT_LABEL}")
                if VALUE_AMOUNT not in ("", "-", None):
                    fill_by_selector(dialog, "input.ones-input-number-input", str(VALUE_AMOUNT))
                    print(f"[INFO] step=value_amount_filled value={VALUE_AMOUNT}")
                choose_select_option(dialog, "价值类型", VALUE_TYPE_LABEL)
                print(f"[INFO] step=value_type_selected value={VALUE_TYPE_LABEL}")
                if WAREHOUSE and WAREHOUSE != "-":
                    choose_select_option(dialog, "仓库", WAREHOUSE)
                    print(f"[INFO] step=warehouse_selected value={WAREHOUSE}")
            else:
                choose_select_option(dialog, "严重程度", SEVERITY_LABEL)
                print(f"[INFO] step=severity_selected value={SEVERITY_LABEL}")
                fill_by_label_input(dialog, "背景", background_text)
                print("[INFO] step=background_filled")
                if WAREHOUSE and WAREHOUSE != "-":
                    fill_by_label_input(dialog, "仓库", WAREHOUSE)
                    print(f"[INFO] step=warehouse_filled value={WAREHOUSE}")

            response_armed["enabled"] = True
            print("[INFO] step=submit_start")
            submit_dialog(dialog)
            print("[INFO] step=submit_clicked")
            page.wait_for_timeout(5000)
            response_armed["enabled"] = False
            print(f"[INFO] step=submit_probe_hits count={len(response_hits)}")
            probe_summary = [
                {
                    "url": hit.get("url"),
                    "status": hit.get("status"),
                    "method": hit.get("method"),
                }
                for hit in response_hits[-12:]
            ]
            print(f"[INFO] step=submit_probe_summary current_url={page.url} hits={json.dumps(probe_summary, ensure_ascii=False)}")
            issue_no = ""
            issue_url = ""
            try:
                issue_no, issue_url = extract_issue_info(page, response_hits=response_hits)
                print("[INFO] step=issue_info_extracted")
            except Exception as e:
                print(f"[WARN] issue_info_extract_failed error={e}")

            # 第一阶段成功标准收紧为：必须拿到 ONES ID；链接与标题抓取后补。
            result = {
                "issue_no": issue_no,
                "ones_url": issue_url,
                "submitted": bool(issue_no),
                "link_pending": bool(issue_no) and not bool(issue_url and "ones.winnermedical.com" in issue_url),
                "current_url": page.url,
            }
            if issue_no:
                print(f"[OK] issue_no={issue_no}")
            if issue_url:
                print(f"[OK] ones_url={issue_url}")
            print(json.dumps(result, ensure_ascii=False))
        finally:
            browser.close()


if __name__ == "__main__":
    try:
        create_via_ui()
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
