from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MONITOR = ROOT / "output" / "coo_ops" / "7day-xhs-growth-monitor-2026-04-29.csv"
DEFAULT_EVENTS = ROOT / "output" / "coo_ops" / "xhs-monitor-events-2026-04-29.jsonl"
DEFAULT_DB = ROOT / "jarvis-one-company-os" / "dev.db"


def select_xhs_post_tab(tabs: list[dict[str, Any]], title_hint: str) -> dict[str, Any] | None:
    public_tabs = [
        tab
        for tab in tabs
        if "xiaohongshu.com/explore/" in (tab.get("url") or "")
        and "creator.xiaohongshu.com" not in (tab.get("url") or "")
    ]
    if not public_tabs:
        return None
    for tab in public_tabs:
        if title_hint and title_hint in ((tab.get("title") or "") + " " + (tab.get("url") or "")):
            return tab
    return public_tabs[-1]


def _parse_count_after_label(text: str, labels: list[str]) -> int:
    for label in labels:
        patterns = [
            rf"{re.escape(label)}\s*([0-9][0-9,]*)",
            rf"([0-9][0-9,]*)\s*{re.escape(label)}",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return int(match.group(1).replace(",", ""))
    return 0


def parse_visible_metrics(info: dict[str, Any]) -> dict[str, Any]:
    text = info.get("visibleText") or ""
    url = info.get("url") or ""
    title = (info.get("title") or "").replace(" - 小红书", "").strip() or "我先不卖系统了"
    return {
        "platform": "xiaohongshu",
        "post_title": title,
        "post_url": url,
        "status": "published" if "/explore/" in url else "pending",
        "views": _parse_count_after_label(text, ["阅读", "浏览", "观看"]),
        "likes": _parse_count_after_label(text, ["点赞", "赞"]),
        "favorites": _parse_count_after_label(text, ["收藏"]),
        "comments": _parse_count_after_label(text, ["评论"]),
        "private_messages": _parse_count_after_label(text, ["私信"]),
        "qualified_leads": 0,
        "visible_text_excerpt": text[:500],
        "checked_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def parse_creator_manager_metrics(info: dict[str, Any], title_hint: str, fallback_url: str = "") -> dict[str, Any]:
    text = info.get("visibleText") or ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title_index = next((idx for idx, line in enumerate(lines) if title_hint in line), -1)
    if title_index < 0:
        return {
            "platform": "xiaohongshu",
            "post_title": title_hint,
            "post_url": fallback_url,
            "status": "pending",
            "views": 0,
            "likes": 0,
            "favorites": 0,
            "comments": 0,
            "private_messages": 0,
            "qualified_leads": 0,
            "visible_text_excerpt": text[:500],
            "checked_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    tail = lines[title_index + 1 : title_index + 12]
    published_at = ""
    status = "published" if "已发布" in lines[: title_index + 1] else "pending"
    numbers: list[int] = []
    for line in tail:
        time_match = re.search(r"发布于\s*(\d{4})年(\d{2})月(\d{2})日\s*(\d{2}:\d{2})", line)
        if time_match:
            published_at = f"{time_match.group(1)}-{time_match.group(2)}-{time_match.group(3)} {time_match.group(4)}"
            status = "published"
            continue
        if re.fullmatch(r"[0-9][0-9,]*", line):
            numbers.append(int(line.replace(",", "")))

    while len(numbers) < 5:
        numbers.append(0)
    # Creator center order is: views, comments, likes, favorites, shares.
    return {
        "platform": "xiaohongshu",
        "post_title": title_hint,
        "post_url": fallback_url,
        "status": status,
        "published_at": published_at,
        "views": numbers[0],
        "comments": numbers[1],
        "likes": numbers[2],
        "favorites": numbers[3],
        "shares": numbers[4],
        "private_messages": 0,
        "qualified_leads": 0,
        "visible_text_excerpt": text[:500],
        "checked_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def update_monitor_csv(path: Path, metrics: dict[str, Any], owner: str, next_action: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    if path.exists():
        with path.open(encoding="utf-8", newline="") as fp:
            rows = list(csv.DictReader(fp))

    today = datetime.now().strftime("%Y-%m-%d")
    fieldnames = [
        "date",
        "platform",
        "post_title",
        "post_url",
        "status",
        "views",
        "likes",
        "favorites",
        "comments",
        "shares",
        "private_messages",
        "qualified_leads",
        "published_at",
        "last_checked_at",
        "next_action",
        "owner",
    ]
    row = {
        "date": today,
        "platform": "xiaohongshu",
        "post_title": str(metrics.get("post_title") or "我先不卖系统了"),
        "post_url": str(metrics.get("post_url") or ""),
        "status": str(metrics.get("status") or "pending"),
        "views": str(metrics.get("views") or 0),
        "likes": str(metrics.get("likes") or 0),
        "favorites": str(metrics.get("favorites") or 0),
        "comments": str(metrics.get("comments") or 0),
        "shares": str(metrics.get("shares") or 0),
        "private_messages": str(metrics.get("private_messages") or 0),
        "qualified_leads": str(metrics.get("qualified_leads") or 0),
        "published_at": str(metrics.get("published_at") or ""),
        "last_checked_at": str(metrics.get("checked_at") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        "next_action": next_action,
        "owner": owner,
    }
    is_empty_pending_read = (
        row["status"] == "pending"
        and row["post_url"] == ""
        and all(row.get(name, "0") in ("", "0") for name in ["views", "likes", "favorites", "comments", "shares", "private_messages", "qualified_leads"])
    )

    replaced = False
    for idx, existing in enumerate(rows):
        if existing.get("platform") == "xiaohongshu" and existing.get("post_title") == row["post_title"]:
            merged = {name: existing.get(name, "") for name in fieldnames}
            if is_empty_pending_read and existing.get("status") == "published":
                merged["last_checked_at"] = row["last_checked_at"]
                merged["next_action"] = next_action
                merged["owner"] = owner
            else:
                merged.update(row)
            rows[idx] = merged
            replaced = True
            break
    if not replaced:
        rows.append(row)

    with path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for item in rows:
            writer.writerow({name: item.get(name, "") for name in fieldnames})


def append_event(path: Path, metrics: dict[str, Any], event: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "event": event,
        "platform": metrics.get("platform", "xiaohongshu"),
        "title": metrics.get("post_title", ""),
        "url": metrics.get("post_url", ""),
        "status": metrics.get("status", "pending"),
        "views": metrics.get("views", 0),
        "likes": metrics.get("likes", 0),
        "favorites": metrics.get("favorites", 0),
        "comments": metrics.get("comments", 0),
        "shares": metrics.get("shares", 0),
        "private_messages": metrics.get("private_messages", 0),
        "qualified_leads": metrics.get("qualified_leads", 0),
        "published_at": metrics.get("published_at", ""),
    }
    with path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_db_log(db_path: Path, metrics: dict[str, Any], event: str) -> None:
    if not db_path.exists():
        return
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    now = datetime.now().isoformat()
    detail = {
        "event": event,
        "metrics": metrics,
        "monitor": str(DEFAULT_MONITOR.relative_to(ROOT)).replace("\\", "/"),
        "events": str(DEFAULT_EVENTS.relative_to(ROOT)).replace("\\", "/"),
    }
    cur.execute(
        "insert or replace into task_logs (id, taskId, operatorId, actionType, detailJson, createdAt) values (?,?,?,?,?,?)",
        (
            f"task_log_xhs_monitor_{event}_20260429",
            "task_xhs_growth_tech_20260429",
            "agent_hermione",
            "xhs_readonly_monitor",
            json.dumps(detail, ensure_ascii=False),
            now,
        ),
    )
    conn.commit()


def read_from_cdp(title_hint: str, port: int, explicit_url: str = "") -> dict[str, Any]:
    sys.path.insert(0, str(ROOT / "scripts" / "publish"))
    from _common import connect_cdp, probe_cdp  # noqa: PLC0415

    tabs = probe_cdp(port)
    selected = select_xhs_post_tab(tabs, title_hint)
    target_url = explicit_url or (selected or {}).get("url") or ""
    if not target_url:
        return {
            "url": "",
            "title": title_hint,
            "visibleText": "",
            "status": "pending",
        }

    pw, _browser, context, _page = connect_cdp(port)
    try:
        page = None
        for candidate in context.pages:
            if target_url and target_url.split("?")[0] in (candidate.url or ""):
                page = candidate
                break
        if page is None:
            page = context.new_page()
            page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
        page.bring_to_front()
        page.wait_for_timeout(1500)
        info = page.evaluate(
            """
            () => ({
                url: location.href,
                title: document.title || '',
                visibleText: document.body ? document.body.innerText : ''
            })
            """
        )
        return info
    finally:
        try:
            pw.stop()
        except Exception:
            pass


def read_creator_manager_from_cdp(title_hint: str, port: int, fallback_url: str = "") -> dict[str, Any] | None:
    sys.path.insert(0, str(ROOT / "scripts" / "publish"))
    from _common import connect_cdp  # noqa: PLC0415

    pw, _browser, context, _page = connect_cdp(port)
    try:
        page = None
        for candidate in context.pages:
            if "creator.xiaohongshu.com" in (candidate.url or "") and "note-manager" in (candidate.url or ""):
                page = candidate
                break
        if page is None:
            return None
        page.bring_to_front()
        page.wait_for_timeout(1500)
        info = page.evaluate(
            """
            () => ({
                url: location.href,
                title: document.title || '',
                visibleText: document.body ? document.body.innerText : ''
            })
            """
        )
        metrics = parse_creator_manager_metrics(info, title_hint, fallback_url)
        return metrics if metrics["status"] == "published" or metrics["views"] > 0 else None
    finally:
        try:
            pw.stop()
        except Exception:
            pass


def run_monitor(
    title_hint: str,
    event: str,
    monitor_path: Path = DEFAULT_MONITOR,
    events_path: Path = DEFAULT_EVENTS,
    db_path: Path = DEFAULT_DB,
    port: int = 9222,
    url: str = "",
) -> dict[str, Any]:
    info = read_from_cdp(title_hint=title_hint, port=port, explicit_url=url)
    metrics = parse_visible_metrics(info)
    creator_metrics = read_creator_manager_from_cdp(
        title_hint=title_hint,
        port=port,
        fallback_url=str(metrics.get("post_url") or url),
    )
    if creator_metrics:
        metrics.update(creator_metrics)
    next_action = "T+2h 继续监控初始曝光" if event == "post_t30m_status_check" else "按 SOP 进入下一轮监控"
    update_monitor_csv(monitor_path, metrics, owner="Hermione", next_action=next_action)
    append_event(events_path, metrics, event)
    write_db_log(db_path, metrics, event)
    return metrics


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", default="我先不卖系统了")
    parser.add_argument("--event", default="post_t30m_status_check")
    parser.add_argument("--url", default="")
    parser.add_argument("--port", type=int, default=9222)
    parser.add_argument("--monitor", type=Path, default=DEFAULT_MONITOR)
    parser.add_argument("--events", type=Path, default=DEFAULT_EVENTS)
    args = parser.parse_args()
    metrics = run_monitor(
        title_hint=args.title,
        event=args.event,
        monitor_path=args.monitor,
        events_path=args.events,
        port=args.port,
        url=args.url,
    )
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
