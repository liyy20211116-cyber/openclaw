from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    metrics = json.loads((ROOT / "output" / "coo_ops" / "xhs-post2-metrics-2026-04-29.json").read_text(encoding="utf-8"))
    assert_true(metrics["post_title"] == "我给9个AI员工发工资", "post2 title mismatch")
    assert_true(metrics["initial_metrics"]["views"] == 64, "initial views must come from CEO screenshot")
    assert_true(metrics["latest_metrics"]["views"] >= metrics["initial_metrics"]["views"], "latest views should not go backwards")
    assert_true(metrics["latest_metrics"]["source"] == "xiaohongshu_creator_center_cdp", "latest metrics source missing")
    assert_true(metrics["operating_mode"] == "read_only_monitoring_and_review_only_replies", "unsafe operating mode")

    replies = (ROOT / "output" / "coo_ops" / "reply-suggestions-2026-04-29.md").read_text(encoding="utf-8")
    forbidden = ["点赞后领取", "收藏后领取", "评论区打", "保证涨粉", "保证成交"]
    assert_true(not any(term in replies for term in forbidden), "reply suggestions contain unsafe promise or bait")
    assert_true("CEO 审核后才能发送" in replies, "reply review boundary missing")

    with (ROOT / "output" / "coo_ops" / "7day-xhs-growth-monitor-2026-04-29.csv").open(encoding="utf-8", newline="") as fp:
        rows = list(csv.DictReader(fp))
    row = next((item for item in rows if item["post_title"] == "我给9个AI员工发工资"), None)
    assert_true(row is not None, "post2 monitor row missing")
    assert_true(row["status"] == "published", "post2 status should be published")
    assert_true(int(row["views"]) >= metrics["initial_metrics"]["views"], "post2 monitor views should not go backwards")
    print("xhs post2 operation tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
