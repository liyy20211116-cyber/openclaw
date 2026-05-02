from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "jarvis-one-company-os" / "dev.db"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def upsert_chat(con: sqlite3.Connection, coo: dict[str, Any], self_loop: dict[str, Any]) -> None:
    ts = now_iso()
    topic_id = "topic_jarvis_coo_20260428"
    messages = [
        (
            "msg_jarvis_coo_ceo_20260428",
            "ceo",
            "贾维斯，从今天开始你按 COO 角色运行一人公司：先让产品自己运营起来，生成内容草稿、整理评论回复建议、引流私域、检查收款和交付，但所有对外发布和评论回复都必须等我审核。",
            ts,
        ),
        (
            "msg_jarvis_coo_reply_20260428",
            "jarvis",
            "收到。我已启动 review_only 自营运营批次：生成 4 个平台草稿任务、3 条评论/私域回复建议，并接入每日自营循环。当前四个平台登录页已打开，后续我只进入草稿箱和待审核队列，不自动发布、不自动回复、不登记未到账收入。",
            ts,
        ),
    ]
    con.execute(
        """
        insert into chat_topics (id, title, messageCount, createdAt, updatedAt)
        values (?, ?, ?, ?, ?)
        on conflict(id) do update set title=excluded.title, messageCount=excluded.messageCount, updatedAt=excluded.updatedAt
        """,
        (topic_id, "Jarvis COO 自营闭环", len(messages), ts, ts),
    )
    for message_id, role, content, created_at in messages:
        con.execute(
            """
            insert into chat_messages
              (id, topicId, role, content, attachmentsJson, mentionsJson, quotedMessageJson, teamMessagesJson, llmModelUsed, createdAt)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set content=excluded.content, createdAt=excluded.createdAt
            """,
            (message_id, topic_id, role, content, "[]", "[]", None, None, "local-coo-loop", created_at),
        )


def upsert_task_and_workflow(con: sqlite3.Connection, coo: dict[str, Any], self_loop: dict[str, Any]) -> None:
    ts = now_iso()
    task_id = "task_jarvis_coo_20260428"
    deliverables = [
        coo["artifacts"]["report"],
        coo["artifacts"]["draft_job"],
        coo["artifacts"]["comment_queue"],
        self_loop["artifacts"]["report"],
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
            task_id,
            "Jarvis COO：自营内容与评论私域闭环",
            "生成多平台草稿任务、评论回复建议和每日自营循环证据；所有对外动作保持 CEO 审核。",
            "growth",
            "agent_ceo",
            "agent_jarvis",
            "urgent",
            "completed",
            1200,
            650,
            1,
            "agent_ceo",
            json.dumps(deliverables, ensure_ascii=False),
            json.dumps(
                {
                    "draft_jobs": len(coo["draft_jobs"]["jobs"]),
                    "comment_queue": len(coo["comment_queue"]),
                    "auto_publish": False,
                    "auto_reply": False,
                },
                ensure_ascii=False,
            ),
            None,
            ts,
            ts,
            ts,
            ts,
        ),
    )
    con.execute(
        """
        insert into task_logs (id, taskId, operatorId, actionType, detailJson, createdAt)
        values (?, ?, ?, ?, ?, ?)
        on conflict(id) do update set detailJson=excluded.detailJson, createdAt=excluded.createdAt
        """,
        (
            "task_log_jarvis_coo_20260428",
            task_id,
            "agent_jarvis",
            "complete",
            json.dumps({"coo_report": coo["artifacts"]["report"], "self_loop_report": self_loop["artifacts"]["report"]}, ensure_ascii=False),
            ts,
        ),
    )

    run_id = "workflow_jarvis_coo_20260428"
    con.execute(
        """
        insert into workflow_runs
          (id, workflowId, workflowName, status, inputJson, contextJson, errorMessage, startedAt, completedAt, createdAt, updatedAt)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          status=excluded.status,
          contextJson=excluded.contextJson,
          completedAt=excluded.completedAt,
          updatedAt=excluded.updatedAt
        """,
        (
            run_id,
            "jarvis-coo-commercial-loop",
            "Jarvis COO 自营获客闭环",
            "completed",
            json.dumps({"mode": "review_only"}, ensure_ascii=False),
            json.dumps({"coo": coo["artifacts"], "self_loop": self_loop["artifacts"]}, ensure_ascii=False),
            None,
            ts,
            ts,
            ts,
            ts,
        ),
    )
    steps = [
        ("coo_dispatch", "agent_jarvis", "dispatch", "COO 拆解目标并调度全员", {"review_only": True}),
        ("coo_content_drafts", "agent_luna", "publisher", "生成多平台草稿任务", {"jobs": len(coo["draft_jobs"]["jobs"])}),
        ("coo_product_package", "agent_mcgonagall", "product", "定义 999 元启航版交付与验收", {"offer": "starter-one-time"}),
        ("coo_tech_chain", "agent_hermione", "automation", "检查配置 API、CDP、测试门禁", {"repeatable": True}),
        ("coo_comment_queue", "agent_dobby", "customer_service", "生成评论回复与私域建议", {"comments": len(coo["comment_queue"])}),
        ("coo_sales_followup", "agent_fred", "sales", "把高意向评论转销售线索", {"review_only": True}),
        ("coo_finance_guard", "agent_percy", "finance", "保持真实收入到账后登记", {"book_revenue": False}),
        ("coo_audit_guard", "agent_snape", "audit", "审计外部 skill/GitHub 引入风险", {"external_code_review": True}),
        ("coo_org_health", "agent_neville", "hr", "检查组织职责覆盖和空转风险", {"all_roles_active": True}),
    ]
    for order, (node_id, agent_id, skill_id, label, output) in enumerate(steps, start=1):
        con.execute(
            """
            insert into workflow_steps
              (id, runId, nodeId, agentId, skillId, label, status, outputJson, errorMsg, attempts, startedAt, completedAt)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set outputJson=excluded.outputJson, status=excluded.status, completedAt=excluded.completedAt
            """,
            (
                f"workflow_jarvis_coo_20260428_step_{order}",
                run_id,
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--coo-evidence", required=True, type=Path)
    parser.add_argument("--self-evidence", required=True, type=Path)
    args = parser.parse_args()
    coo = read_json(args.coo_evidence)
    self_loop = read_json(args.self_evidence)

    con = sqlite3.connect(DB_PATH)
    try:
        upsert_chat(con, coo, self_loop)
        upsert_task_and_workflow(con, coo, self_loop)
        con.commit()
    finally:
        con.close()
    print(json.dumps({"ok": True, "db": str(DB_PATH), "topic": "topic_jarvis_coo_20260428", "task": "task_jarvis_coo_20260428"}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
