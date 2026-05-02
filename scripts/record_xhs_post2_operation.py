from __future__ import annotations

import csv
import datetime as dt
import json
import sqlite3
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MONITOR = ROOT / "output" / "coo_ops" / "7day-xhs-growth-monitor-2026-04-29.csv"
EVENTS = ROOT / "output" / "coo_ops" / "xhs-monitor-events-2026-04-29.jsonl"
DB_PATHS = [
    ROOT / "jarvis-one-company-os" / "dev.db",
    Path.home() / "AppData" / "Roaming" / "jarvis-one-company-os" / "company-data" / "dev.db",
]

TASK_ID = "task_xhs_salary_post2_ops_20260429"
RUN_ID = "workflow_xhs_salary_post2_ops_20260429"


def now_local() -> str:
    return dt.datetime.now().replace(microsecond=0).isoformat()


def update_monitor(metrics: dict[str, Any]) -> None:
    MONITOR.parent.mkdir(parents=True, exist_ok=True)
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
        "private_messages",
        "qualified_leads",
        "published_at",
        "last_checked_at",
        "next_action",
        "owner",
    ]
    rows: list[dict[str, str]] = []
    if MONITOR.exists():
        with MONITOR.open(encoding="utf-8", newline="") as fp:
            rows = list(csv.DictReader(fp))

    row = {name: str(metrics.get(name, "")) for name in fieldnames}
    replaced = False
    for idx, existing in enumerate(rows):
        if existing.get("platform") == row["platform"] and existing.get("post_title") == row["post_title"]:
            merged = {name: existing.get(name, "") for name in fieldnames}
            merged.update(row)
            rows[idx] = merged
            replaced = True
            break
    if not replaced:
        rows.append(row)

    with MONITOR.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for item in rows:
            writer.writerow({name: item.get(name, "") for name in fieldnames})


def append_event(metrics: dict[str, Any]) -> None:
    EVENTS.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": now_local(),
        "event": "post2_initial_published_status",
        "platform": "xiaohongshu",
        "title": metrics["post_title"],
        "status": metrics["status"],
        "views": metrics["views"],
        "likes": metrics["likes"],
        "favorites": metrics["favorites"],
        "comments": metrics["comments"],
        "private_messages": metrics["private_messages"],
        "qualified_leads": metrics["qualified_leads"],
        "published_at": metrics["published_at"],
        "source": "ceo_screenshot",
    }
    with EVENTS.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(record, ensure_ascii=False) + "\n")


def upsert_db(con: sqlite3.Connection, metrics: dict[str, Any], ts: str) -> None:
    deliverables = [
        "output/coo_ops/xhs-post2-live-ops-2026-04-29.md",
        "output/coo_ops/reply-suggestions-2026-04-29.md",
        "output/coo_ops/next-content-queue-2026-04-29.md",
        "output/coo_ops/7day-xhs-growth-monitor-2026-04-29.csv",
    ]
    con.execute(
        """
        insert into tasks
          (id, title, description, taskType, creatorAgentId, ownerAgentId, priority, status, budgetToken, spentToken,
           requiresApproval, approverId, deliverablesJson, kpiJson, dueAt, startedAt, completedAt, createdAt, updatedAt)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          description=excluded.description,
          status=excluded.status,
          spentToken=excluded.spentToken,
          deliverablesJson=excluded.deliverablesJson,
          kpiJson=excluded.kpiJson,
          completedAt=excluded.completedAt,
          updatedAt=excluded.updatedAt
        """,
        (
            TASK_ID,
            "小红书第二篇工资单内容实战运营",
            "第二篇已发布内容进入真实运营监控：记录初始数据、拆分角色动作、准备评论/私信承接、输出下一轮调整。",
            "growth",
            "agent_ceo",
            "agent_jarvis",
            "urgent",
            "completed",
            500,
            220,
            0,
            None,
            json.dumps(deliverables, ensure_ascii=False),
            json.dumps(metrics, ensure_ascii=False),
            None,
            ts,
            ts,
            ts,
            ts,
        ),
    )

    logs = [
        (
            "task_log_xhs_post2_jarvis_dispatch_20260429",
            "agent_jarvis",
            "complete",
            {"action": "dispatch_live_ops", "decision": "salary hook outperformed rejected post; keep observing before scaling"},
        ),
        (
            "task_log_xhs_post2_luna_review_20260429",
            "agent_luna",
            "complete",
            {"action": "content_review", "learning": "数据型工资单钩子比抽象 OS 表述更容易被用户看懂"},
        ),
        (
            "task_log_xhs_post2_dobby_reply_queue_20260429",
            "agent_dobby",
            "complete",
            {"action": "prepare_reply_suggestions", "boundary": "draft only, CEO approves before sending"},
        ),
        (
            "task_log_xhs_post2_fred_lead_rules_20260429",
            "agent_fred",
            "complete",
            {"action": "lead_scoring_ready", "rule": "comments/private messages are L1-L3 only after explicit interest"},
        ),
        (
            "task_log_xhs_post2_percy_payment_guard_20260429",
            "agent_percy",
            "complete",
            {"action": "payment_guard", "rule": "do not book revenue before payment received"},
        ),
        (
            "task_log_xhs_post2_snape_audit_20260429",
            "agent_snape",
            "complete",
            {"action": "compliance_watch", "risk": "avoid inducing interaction and unsupported income claims in follow-up"},
        ),
    ]
    for log_id, operator_id, action_type, detail in logs:
        detail["metrics"] = metrics
        con.execute(
            """
            insert into task_logs (id, taskId, operatorId, actionType, detailJson, createdAt)
            values (?, ?, ?, ?, ?, ?)
            on conflict(id) do update set detailJson=excluded.detailJson, createdAt=excluded.createdAt
            """,
            (log_id, TASK_ID, operator_id, action_type, json.dumps(detail, ensure_ascii=False), ts),
        )

    con.execute(
        """
        insert into workflow_runs
          (id, workflowId, workflowName, status, inputJson, contextJson, errorMessage, startedAt, completedAt, createdAt, updatedAt)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set status=excluded.status, contextJson=excluded.contextJson, completedAt=excluded.completedAt, updatedAt=excluded.updatedAt
        """,
        (
            RUN_ID,
            "xhs-post2-live-commercial-loop",
            "小红书第二篇内容实战运营闭环",
            "completed",
            json.dumps({"source": "ceo_screenshot", "mode": "review_only"}, ensure_ascii=False),
            json.dumps({"metrics": metrics, "deliverables": deliverables}, ensure_ascii=False),
            None,
            ts,
            ts,
            ts,
            ts,
        ),
    )

    steps = [
        ("monitor", "agent_hermione", "readonly_monitor", "记录发布状态与初始数据", {"views": metrics["views"], "likes": metrics["likes"]}),
        ("content_review", "agent_luna", "xhs_review", "复盘工资单钩子", {"next": "保留数据钩子，减少夸张承诺"}),
        ("lead_queue", "agent_fred", "lead_scoring", "准备线索分层", {"comments": metrics["comments"], "private_messages": metrics["private_messages"]}),
        ("reply_queue", "agent_dobby", "reply_draft", "准备待审回复", {"auto_reply": False}),
        ("payment_guard", "agent_percy", "finance_guard", "守住到账登记", {"book_revenue": False}),
        ("audit", "agent_snape", "compliance_guard", "跟踪平台风险", {"risk": "low_after_publish"}),
    ]
    for idx, (node_id, agent_id, skill_id, label, output) in enumerate(steps, start=1):
        con.execute(
            """
            insert into workflow_steps
              (id, runId, nodeId, agentId, skillId, label, status, outputJson, errorMsg, attempts, startedAt, completedAt)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set status=excluded.status, outputJson=excluded.outputJson, completedAt=excluded.completedAt
            """,
            (
                f"{RUN_ID}_step_{idx}",
                RUN_ID,
                node_id,
                agent_id,
                skill_id,
                label,
                "completed",
                json.dumps(output, ensure_ascii=False),
                None,
                1,
                ts,
                ts,
            ),
        )


def main() -> int:
    ts = now_local()
    metrics = {
        "date": "2026-04-29",
        "platform": "xiaohongshu",
        "post_title": "我给9个AI员工发工资",
        "post_url": "",
        "status": "published",
        "views": 64,
        "likes": 1,
        "favorites": 0,
        "comments": 0,
        "private_messages": 0,
        "qualified_leads": 0,
        "published_at": "2026-04-29 11:27",
        "last_checked_at": ts.replace("T", " "),
        "next_action": "T+2h 继续只读监控；若出现评论/私信，多比生成待审回复，弗雷德分层线索",
        "owner": "Hermione",
    }
    update_monitor(metrics)
    append_event(metrics)
    touched: list[str] = []
    for db_path in DB_PATHS:
        if not db_path.exists():
            continue
        con = sqlite3.connect(db_path)
        try:
            upsert_db(con, metrics, ts)
            con.commit()
            touched.append(str(db_path))
        finally:
            con.close()
    print(json.dumps({"ok": True, "task": TASK_ID, "workflow": RUN_ID, "dbs": touched}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
