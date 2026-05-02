from __future__ import annotations

import datetime as dt
import json
import os
import shlex
import sqlite3
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "unattended-health-guardian.json"
DB_PATHS = [
    ROOT / "jarvis-one-company-os" / "dev.db",
    Path.home() / "AppData" / "Roaming" / "jarvis-one-company-os" / "company-data" / "dev.db",
]
LOCK_PATH = ROOT / "output" / "coo_ops" / "unattended-health.lock"


def classify_task_result(result: int) -> str:
    if result == 0:
        return "ok"
    if result == 267011:
        return "pending"
    if result == 2147942402:
        return "failed_path_or_python"
    if result == 3221225786:
        return "failed_interrupted_or_crashed"
    return "failed"


def classify_event_freshness(last_seen: dt.datetime | None, now: dt.datetime, max_minutes: int) -> str:
    if last_seen is None:
        return "missing"
    age = now - last_seen
    return "fresh" if age <= dt.timedelta(minutes=max_minutes) else "stale"


def render_report(
    now: dt.datetime,
    checks: list[dict[str, Any]],
    events: list[dict[str, Any]],
    actions: list[str],
    runtime_seconds: float | None = None,
) -> str:
    lines = [
        "# 无人值守健康守护报告",
        "",
        f"生成时间：{now.strftime('%Y-%m-%d %H:%M:%S')}",
    ]
    if runtime_seconds is not None:
        lines.extend(["", f"运行耗时：{runtime_seconds:.2f} 秒"])
    lines.extend(["", "## 调度任务"])
    for check in checks:
        lines.append(f"- {check['name']}：state={check['state']}，result={check['result']}")
    lines.extend(["", "## 最近事件"])
    if not events:
        lines.append("- 未发现监控事件")
    for event in events:
        lines.append(
            f"- {event.get('event', '')}：阅读 {event.get('views', 0)}，点赞 {event.get('likes', 0)}，"
            f"收藏 {event.get('favorites', 0)}，评论 {event.get('comments', 0)}"
        )
    lines.extend(["", "## 自动动作"])
    if not actions:
        lines.append("- 无自动补跑")
    for action in actions:
        lines.append(f"- {action}")
    lines.extend(
        [
            "",
            "## 边界",
            "- 只允许只读监控和补跑指标读取。",
            "- 不允许自动发布、自动评论、自动私信。",
            "- 未到账不得写入收入。",
        ]
    )
    return "\n".join(lines) + "\n"


def read_recent_events(path: Path, limit: int = 5) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rows.append(json.loads(line))
    return rows[-limit:]


def acquire_run_lock(lock_path: Path, now: dt.datetime | None = None, stale_minutes: int = 15) -> dict[str, Any]:
    now = now or dt.datetime.now()
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    if lock_path.exists():
        payload: dict[str, Any] = {}
        try:
            payload = json.loads(lock_path.read_text(encoding="utf-8"))
            started_at = dt.datetime.fromisoformat(payload["started_at"])
        except (json.JSONDecodeError, KeyError, ValueError):
            started_at = now - dt.timedelta(minutes=stale_minutes + 1)
        if now - started_at <= dt.timedelta(minutes=stale_minutes):
            return {"acquired": False, "reason": "already_running", "lock": str(lock_path)}
        lock_path.write_text(
            json.dumps(
                {
                    "started_at": now.isoformat(timespec="seconds"),
                    "pid": os.getpid(),
                    "stale_recovered": True,
                    "previous_lock": payload,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return {"acquired": True, "stale_recovered": True, "lock": str(lock_path)}
    lock_path.write_text(
        json.dumps({"started_at": now.isoformat(timespec="seconds"), "pid": os.getpid()}, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"acquired": True, "stale_recovered": False, "lock": str(lock_path)}


def release_run_lock(lock_path: Path) -> None:
    try:
        lock_path.unlink()
    except FileNotFoundError:
        return


def get_scheduled_task_info(task_name: str) -> dict[str, Any]:
    ps = (
        f"$i=Get-ScheduledTaskInfo -TaskName '{task_name}'; "
        f"$t=Get-ScheduledTask -TaskName '{task_name}'; "
        "$lastRun=if($i.LastRunTime){$i.LastRunTime.ToString('s')}else{''}; "
        "$nextRun=if($i.NextRunTime){$i.NextRunTime.ToString('s')}else{''}; "
        "[pscustomobject]@{"
        f"TaskName='{task_name}';"
        "State=$t.State.ToString();"
        "LastRunTime=$lastRun;"
        "NextRunTime=$nextRun;"
        "LastTaskResult=$i.LastTaskResult"
        "} | ConvertTo-Json -Compress"
    )
    try:
        completed = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=20,
        )
    except subprocess.TimeoutExpired:
        return {"name": task_name, "state": "Timeout", "result": "failed_scheduler_timeout"}
    if completed.returncode != 0:
        return {"name": task_name, "state": "Missing", "result": "failed", "raw": completed.stderr.strip()}
    payload = json.loads(completed.stdout)
    return parse_scheduled_task_payload(task_name, payload)


def parse_scheduled_task_payload(task_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    result_code = int(payload.get("LastTaskResult", 1))
    return {
        "name": task_name,
        "state": payload.get("State", ""),
        "last_run_time": payload.get("LastRunTime", ""),
        "next_run_time": payload.get("NextRunTime", ""),
        "result_code": result_code,
        "result": classify_task_result(result_code),
    }


def write_db_log(db_path: Path, detail: dict[str, Any]) -> None:
    if not db_path.exists():
        return
    con = sqlite3.connect(db_path, timeout=5)
    try:
        con.execute(
            "insert or replace into task_logs (id, taskId, operatorId, actionType, detailJson, createdAt) values (?,?,?,?,?,?)",
            (
                "task_log_unattended_guardian_latest",
                "task_xhs_salary_post2_ops_20260429",
                "agent_jarvis",
                "complete",
                json.dumps(detail, ensure_ascii=False),
                dt.datetime.now().isoformat(timespec="seconds"),
            ),
        )
        con.commit()
    finally:
        con.close()


def run_catchup(python_executable: str, command_text: str) -> dict[str, Any]:
    approved_readonly = "xhs_post_monitor.py" in command_text
    approved_revenue_loop = "revenue_goal_loop.py" in command_text
    if not approved_readonly and not approved_revenue_loop:
        return {"ok": False, "reason": "catchup command is not an approved monitor or autonomous internal command"}
    blocked_terms = ["publish", "comment_reply", "private_message", "send_private_message", "book-revenue", "record-payment", "paid-revenue"]
    if any(blocked in command_text for blocked in blocked_terms):
        return {"ok": False, "reason": "catchup command contains blocked action"}
    try:
        args = shlex.split(command_text, posix=False)
    except ValueError as exc:
        return {"ok": False, "reason": f"invalid catchup command: {exc}"}
    completed = subprocess.run([python_executable] + args, cwd=ROOT, capture_output=True, text=True, check=False, timeout=60)
    return {
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "stdout": completed.stdout[-2000:],
        "stderr": completed.stderr[-2000:],
    }


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def main() -> int:
    started = dt.datetime.now()
    lock = acquire_run_lock(LOCK_PATH, now=started, stale_minutes=15)
    if not lock["acquired"]:
        print(json.dumps({"ok": False, "reason": lock["reason"], "lock": lock["lock"]}, ensure_ascii=False))
        return 0

    try:
        config = load_config()
        now = dt.datetime.now()
        checks: list[dict[str, Any]] = []
        actions: list[str] = []
        events: list[dict[str, Any]] = []
        seen_task_names: set[str] = set()

        for job in config["jobs"]:
            for task_name in job["scheduled_tasks"]:
                if task_name in seen_task_names:
                    continue
                seen_task_names.add(task_name)
                checks.append(get_scheduled_task_info(task_name))
            events.extend(read_recent_events(ROOT / job["events_file"], limit=5))

        runtime_seconds = (dt.datetime.now() - started).total_seconds()
        health = {
            "generated_at": now.isoformat(timespec="seconds"),
            "checks": checks,
            "events": events,
            "actions": actions,
            "mode": config["mode"],
            "runtime_seconds": runtime_seconds,
            "lock": lock,
        }
        report = render_report(now=now, checks=checks, events=events, actions=actions, runtime_seconds=runtime_seconds)
        latest_path = ROOT / config["report"]["latest_path"]
        latest_path.parent.mkdir(parents=True, exist_ok=True)
        latest_path.write_text(report, encoding="utf-8")
        history_dir = ROOT / config["report"]["history_dir"]
        history_dir.mkdir(parents=True, exist_ok=True)
        (history_dir / f"unattended-health-{now.strftime('%Y%m%d-%H%M%S')}.md").write_text(report, encoding="utf-8")

        for db_path in DB_PATHS:
            write_db_log(db_path, health)

        import runtime_status

        status_tasks = [
            {"name": "JarvisUnattendedHealthGuardian", "state": "Running", "result": "ok", "result_code": 0, "next_run_time": ""},
            *checks,
        ]
        runtime_outputs = runtime_status.write_runtime_status(scheduled_tasks=status_tasks)

        print(
            json.dumps(
                {
                    "ok": True,
                    "report": str(latest_path),
                    "runtime_status": runtime_outputs["html"],
                    "checks": len(checks),
                    "events": len(events),
                    "runtime_seconds": runtime_seconds,
                },
                ensure_ascii=False,
            )
        )
        return 0
    finally:
        release_run_lock(LOCK_PATH)


if __name__ == "__main__":
    raise SystemExit(main())
