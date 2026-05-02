from __future__ import annotations

import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def test_config_shape() -> None:
    config = json.loads((ROOT / "config" / "unattended-health-guardian.json").read_text(encoding="utf-8"))
    assert_true(config["mode"] == "watchdog_readonly", "guardian must be read-only")
    assert_true(config["safety"]["allow_publish"] is False, "publish must be disabled")
    assert_true(config["safety"]["allow_comment_reply"] is False, "comment reply must be disabled")
    assert_true(config["safety"]["allow_private_message"] is False, "private message must be disabled")
    assert_true(config["safety"]["allow_revenue_write_without_payment"] is False, "unpaid revenue writes must be disabled")
    assert_true(config["safety"]["allow_autonomous_internal_execution"] is True, "internal autonomous execution should be enabled")
    assert_true(any(job["id"] == "xhs_post2_monitor" for job in config["jobs"]), "xhs monitor job missing")
    revenue_job = next((job for job in config["jobs"] if job["id"] == "autonomous_revenue_loop"), None)
    assert_true(revenue_job is not None, "autonomous revenue loop job missing")
    assert_true("JarvisAutonomousRevenueLoop-Daily" in revenue_job["scheduled_tasks"], "revenue loop scheduled task missing")
    assert_true("--dry-run" not in revenue_job["catchup_command"], "revenue loop should run autonomous internal execution")


def test_classify_task_result() -> None:
    import unattended_health_guardian as guardian

    assert_true(guardian.classify_task_result(0) == "ok", "0 should be ok")
    assert_true(guardian.classify_task_result(267011) == "pending", "never-run future task should be pending")
    assert_true(guardian.classify_task_result(2147942402) == "failed_path_or_python", "path/python failure should be classified")
    assert_true(guardian.classify_task_result(3221225786) == "failed_interrupted_or_crashed", "interrupted monitor should be classified")
    assert_true(guardian.classify_task_result(1) == "failed", "generic non-zero should fail")


def test_parse_scheduled_task_payload_allows_empty_next_run() -> None:
    import unattended_health_guardian as guardian

    task = guardian.parse_scheduled_task_payload(
        "JarvisXhsMonitor-T8h",
        {
            "State": "Ready",
            "LastRunTime": "2026-04-30T17:40:53",
            "NextRunTime": "",
            "LastTaskResult": 3221225786,
        },
    )
    assert_true(task["state"] == "Ready", "task state should be kept")
    assert_true(task["next_run_time"] == "", "empty next run should be allowed")
    assert_true(task["result"] == "failed_interrupted_or_crashed", "failure should be classified")


def test_event_freshness() -> None:
    import unattended_health_guardian as guardian

    now = dt.datetime(2026, 4, 29, 13, 30, 0)
    fresh = dt.datetime(2026, 4, 29, 13, 25, 0)
    stale = dt.datetime(2026, 4, 29, 12, 0, 0)
    assert_true(guardian.classify_event_freshness(fresh, now, 10) == "fresh", "fresh event misclassified")
    assert_true(guardian.classify_event_freshness(stale, now, 10) == "stale", "stale event misclassified")
    assert_true(guardian.classify_event_freshness(None, now, 10) == "missing", "missing event misclassified")


def test_report_contains_decision() -> None:
    import unattended_health_guardian as guardian

    report = guardian.render_report(
        now=dt.datetime(2026, 4, 29, 13, 30, 0),
        checks=[
            {"name": "JarvisXhsMonitor-T8h", "state": "Ready", "result": "pending"},
            {"name": "JarvisXhsMonitor-T2h", "state": "Completed", "result": "failed_path_or_python"},
        ],
        events=[{"event": "post_t2h_initial_metrics_catchup", "views": 347, "likes": 3, "favorites": 4, "comments": 0}],
        actions=["补跑 post_t2h_initial_metrics_catchup"],
    )
    assert_true("failed_path_or_python" in report, "failure classification missing")
    assert_true("347" in report, "metric missing")
    assert_true("补跑" in report, "action missing")


def test_report_contains_runtime_seconds() -> None:
    import unattended_health_guardian as guardian

    report = guardian.render_report(
        now=dt.datetime(2026, 4, 29, 14, 5, 0),
        checks=[],
        events=[],
        actions=[],
        runtime_seconds=3.25,
    )
    assert_true("3.25" in report, "runtime seconds should be visible in report")


def test_run_lock_prevents_duplicate(tmp_path: Path) -> None:
    import unattended_health_guardian as guardian

    tmp_path.mkdir(parents=True, exist_ok=True)
    lock_path = tmp_path / "guardian.lock"
    if lock_path.exists():
        lock_path.unlink()
    now = dt.datetime(2026, 4, 29, 14, 0, 0)
    first = guardian.acquire_run_lock(lock_path, now=now, stale_minutes=15)
    second = guardian.acquire_run_lock(lock_path, now=now + dt.timedelta(minutes=1), stale_minutes=15)
    assert_true(first["acquired"] is True, "first lock should be acquired")
    assert_true(second["acquired"] is False, "fresh lock should prevent duplicate run")
    assert_true(second["reason"] == "already_running", "duplicate reason should be explicit")
    guardian.release_run_lock(lock_path)
    third = guardian.acquire_run_lock(lock_path, now=now + dt.timedelta(minutes=2), stale_minutes=15)
    assert_true(third["acquired"] is True, "lock should be acquirable after release")
    guardian.release_run_lock(lock_path)


def test_stale_run_lock_is_recovered(tmp_path: Path) -> None:
    import unattended_health_guardian as guardian

    tmp_path.mkdir(parents=True, exist_ok=True)
    lock_path = tmp_path / "guardian.lock"
    lock_path.write_text(
        json.dumps({"started_at": "2026-04-29T13:00:00", "pid": 12345}, ensure_ascii=False),
        encoding="utf-8",
    )
    result = guardian.acquire_run_lock(lock_path, now=dt.datetime(2026, 4, 29, 14, 0, 0), stale_minutes=15)
    assert_true(result["acquired"] is True, "stale lock should be recovered")
    assert_true(result["stale_recovered"] is True, "stale recovery should be recorded")
    guardian.release_run_lock(lock_path)


def test_read_recent_events(tmp_path: Path) -> None:
    import unattended_health_guardian as guardian

    tmp_path.mkdir(parents=True, exist_ok=True)
    events = tmp_path / "events.jsonl"
    events.write_text(
        json.dumps({"ts": "2026-04-29T13:30:54", "event": "post_t2h_initial_metrics_catchup", "views": 347}, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )
    rows = guardian.read_recent_events(events, limit=1)
    assert_true(rows[0]["event"] == "post_t2h_initial_metrics_catchup", "event should parse")
    assert_true(rows[0]["views"] == 347, "views should parse")


def test_write_db_log(tmp_path: Path) -> None:
    import unattended_health_guardian as guardian

    tmp_path.mkdir(parents=True, exist_ok=True)
    db = tmp_path / "test.db"
    if db.exists():
        db.unlink()
    con = sqlite3.connect(db)
    con.execute("create table task_logs (id text primary key, taskId text, operatorId text, actionType text, detailJson text, createdAt text)")
    con.commit()
    con.close()
    guardian.write_db_log(db, {"health": "ok", "actions": []})
    con = sqlite3.connect(db)
    count = con.execute("select count(*) from task_logs where id='task_log_unattended_guardian_latest'").fetchone()[0]
    con.close()
    assert_true(count == 1, "health log should be written")


def test_safe_catchup_guard() -> None:
    import unattended_health_guardian as guardian

    blocked = guardian.run_catchup("python", "scripts/send_private_message.py --text hi")
    assert_true(blocked["ok"] is False, "non-monitor command must be blocked")
    blocked_publish = guardian.run_catchup("python", "scripts/xhs_post_monitor.py --publish")
    assert_true(blocked_publish["ok"] is False, "publish-like catchup must be blocked")
    blocked_revenue_write = guardian.run_catchup("python", "scripts/revenue_goal_loop.py --target-cny 10000 --days 30 --book-revenue 1")
    assert_true(blocked_revenue_write["ok"] is False, "revenue loop catchup must block revenue booking")


def test_registration_script_has_timeout_and_no_parallel_policy() -> None:
    script = (ROOT / "scripts" / "register_unattended_health_guardian.ps1").read_text(encoding="utf-8")
    assert_true("-ExecutionTimeLimit" in script, "guardian task must have an execution timeout")
    assert_true("-MultipleInstances IgnoreNew" in script, "guardian task must block overlapping instances")
    revenue_script = (ROOT / "scripts" / "register_autonomous_revenue_loop.ps1").read_text(encoding="utf-8")
    assert_true("JarvisAutonomousRevenueLoop-Daily" in revenue_script, "revenue loop task name missing")
    assert_true("--dry-run" not in revenue_script, "revenue loop task should not be registered as dry-run")
    assert_true("-ExecutionTimeLimit" in revenue_script, "revenue loop task must have an execution timeout")
    assert_true("-MultipleInstances IgnoreNew" in revenue_script, "revenue loop task must block overlapping instances")


def main() -> int:
    test_config_shape()
    test_classify_task_result()
    test_parse_scheduled_task_payload_allows_empty_next_run()
    test_event_freshness()
    test_report_contains_decision()
    test_report_contains_runtime_seconds()
    test_run_lock_prevents_duplicate(ROOT / "output" / "test_unattended_health_guardian")
    test_stale_run_lock_is_recovered(ROOT / "output" / "test_unattended_health_guardian")
    test_read_recent_events(ROOT / "output" / "test_unattended_health_guardian")
    test_write_db_log(ROOT / "output" / "test_unattended_health_guardian")
    test_safe_catchup_guard()
    test_registration_script_has_timeout_and_no_parallel_policy()
    print("unattended health guardian tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
