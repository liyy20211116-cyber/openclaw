from __future__ import annotations

import csv
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import xhs_post_monitor as monitor  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    run_dir = ROOT / "output" / "test_xhs_monitor"
    if run_dir.exists():
        shutil.rmtree(run_dir)
    run_dir.mkdir(parents=True)
    csv_path = run_dir / "monitor.csv"
    event_path = run_dir / "events.jsonl"
    csv_path.write_text(
        "date,platform,post_title,status,views,likes,favorites,comments,private_messages,qualified_leads,next_action,owner\n"
        "2026-04-29,xiaohongshu,我先不卖系统了,draft,0,0,0,0,0,0,CEO 审核后发布,Luna\n",
        encoding="utf-8",
    )

    tabs = [
        {"url": "https://creator.xiaohongshu.com/publish/publish", "title": "发布"},
        {
            "url": "https://www.xiaohongshu.com/explore/69f157a6000000001f006d32?xsec_token=abc",
            "title": "我先不卖系统了 - 小红书",
        },
    ]
    selected = monitor.select_xhs_post_tab(tabs, "我先不卖系统了")
    assert_true(selected["url"].startswith("https://www.xiaohongshu.com/explore/"), "should select public note tab")

    metrics = monitor.parse_visible_metrics(
        {
            "url": selected["url"],
            "title": "我先不卖系统了",
            "visibleText": "我先不卖系统了\n点赞 12\n收藏 3\n评论 2\n登录后评论",
        }
    )
    assert_true(metrics["likes"] == 12, "likes should parse")
    assert_true(metrics["favorites"] == 3, "favorites should parse")
    assert_true(metrics["comments"] == 2, "comments should parse")
    assert_true(metrics["status"] == "published", "public note should be published")

    creator_metrics = monitor.parse_creator_manager_metrics(
        {
            "url": "https://creator.xiaohongshu.com/new/note-manager",
            "title": "小红书创作服务平台",
            "visibleText": "笔记管理\n全部笔记(1)\n已发布\n我先不卖系统了\n发布于 2026年04月29日 08:58\n3\n0\n0\n0\n0\n权限设置",
        },
        "我先不卖系统了",
        selected["url"],
    )
    assert_true(creator_metrics["views"] == 3, "creator backend views should parse")
    assert_true(creator_metrics["status"] == "published", "creator backend should mark published")
    assert_true(creator_metrics["published_at"] == "2026-04-29 08:58", "published time should parse")

    monitor.update_monitor_csv(csv_path, metrics, owner="Hermione", next_action="T+2h 继续监控")
    with csv_path.open(encoding="utf-8", newline="") as fp:
        rows = list(csv.DictReader(fp))
    assert_true(rows[0]["status"] == "published", "csv status should update")
    assert_true(rows[0]["likes"] == "12", "csv likes should update")
    assert_true(rows[0]["next_action"] == "T+2h 继续监控", "csv next action should update")

    stale_metrics = {
        "platform": "xiaohongshu",
        "post_title": metrics["post_title"],
        "post_url": "",
        "status": "pending",
        "views": 0,
        "likes": 0,
        "favorites": 0,
        "comments": 0,
        "private_messages": 0,
        "qualified_leads": 0,
        "checked_at": "2026-04-30 08:00:00",
    }
    monitor.update_monitor_csv(csv_path, stale_metrics, owner="Hermione", next_action="read failed")
    with csv_path.open(encoding="utf-8", newline="") as fp:
        rows = list(csv.DictReader(fp))
    assert_true(rows[0]["status"] == "published", "read failure must not downgrade published status")
    assert_true(rows[0]["likes"] == "12", "read failure must not erase trusted metrics")
    assert_true(rows[0]["next_action"] == "read failed", "read failure should still record next action")

    monitor.append_event(event_path, metrics, "post_t30m_status_check")
    event = json.loads(event_path.read_text(encoding="utf-8").strip())
    assert_true(event["event"] == "post_t30m_status_check", "event name should persist")
    assert_true(event["url"] == selected["url"], "event url should persist")

    print("xhs post monitor tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
