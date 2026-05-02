from __future__ import annotations

import datetime as dt
import json
import sqlite3
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DB_PATHS = [
    ROOT / "jarvis-one-company-os" / "dev.db",
    Path.home() / "AppData" / "Roaming" / "jarvis-one-company-os" / "company-data" / "dev.db",
]

TASK_ID = "task_post_traffic_offer_ladder_20260429"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def read_offer_ladder() -> dict[str, Any]:
    return json.loads((ROOT / "config" / "lead-offer-ladder.json").read_text(encoding="utf-8"))


def find_offer(ladder: dict[str, Any], offer_id: str) -> dict[str, Any]:
    for offer in ladder.get("offers", []):
        if offer.get("id") == offer_id:
            return offer
    raise KeyError(f"missing offer {offer_id}")


def rel(path: str) -> str:
    return path.replace("\\", "/")


def upsert_task(con: sqlite3.Connection, ladder: dict[str, Any], ts: str) -> None:
    primary_offer = find_offer(ladder, "BOOT-999")
    deliverables = [
        "config/lead-offer-ladder.json",
        "output/product/post-traffic-offer-ladder-2026-04-29.md",
        "output/product/minimum-business-loop-package-2026-04-29.md",
        "output/sales/inbound-lead-sop-2026-04-29.md",
        "output/sales/private-domain-followup-20260428.md",
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
            "流量承接产品阶梯与首单交付机制",
            "把小红书/私域引流后的可交付产品、销售分层、客服响应、财务登记边界固化为一人公司的运行机制。",
            "product",
            "agent_ceo",
            "agent_jarvis",
            "high",
            "completed",
            600,
            280,
            0,
            None,
            json.dumps(deliverables, ensure_ascii=False),
            json.dumps(
                {
                    "primary_paid_offer": primary_offer["id"],
                    "primary_paid_offer_price_cny": primary_offer["price_cny"],
                    "free_offer": "FREE-001",
                    "no_auto_reply": True,
                    "no_revenue_before_payment": True,
                    "no_earnings_promise": True,
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


def upsert_logs(con: sqlite3.Connection, ts: str) -> None:
    logs = [
        (
            "task_log_offer_ladder_20260429",
            "agent_mcgonagall",
            "complete",
            {
                "action": "post_traffic_offer_ladder_defined",
                "artifact": "config/lead-offer-ladder.json",
                "principle": "先卖可交付经营结果，再卖 OS；OS 是工具，不承诺自动盈利。",
            },
        ),
        (
            "task_log_inbound_sop_20260429",
            "agent_fred",
            "complete",
            {
                "action": "inbound_lead_sop_defined",
                "artifact": "output/sales/inbound-lead-sop-2026-04-29.md",
                "handoff": "L2 先问三个诊断问题，L3 再推荐 99/399/999，不直接硬推系统。",
            },
        ),
        (
            "task_log_customer_service_boundary_20260429",
            "agent_dobby",
            "complete",
            {
                "action": "customer_reply_boundary_defined",
                "artifact": "output/sales/inbound-lead-sop-2026-04-29.md",
                "boundary": "只生成评论/私信回复建议，外发由 CEO 审核，不做诱导互动。",
            },
        ),
        (
            "task_log_finance_offer_boundary_20260429",
            "agent_percy",
            "complete",
            {
                "action": "payment_and_revenue_boundary_defined",
                "artifact": "output/ops/payment-status.md",
                "boundary": "只有到账后才能写 revenues；咨询、启动包、陪跑分别记录来源和交付物。",
            },
        ),
        (
            "task_log_content_to_offer_bridge_20260429",
            "agent_luna",
            "complete",
            {
                "action": "content_to_offer_bridge_defined",
                "artifact": "output/product/post-traffic-offer-ladder-2026-04-29.md",
                "boundary": "内容负责建立信任和触发提问，不在正文使用评论口令诱导互动。",
            },
        ),
    ]
    for log_id, operator_id, action_type, detail in logs:
        con.execute(
            """
            insert into task_logs (id, taskId, operatorId, actionType, detailJson, createdAt)
            values (?, ?, ?, ?, ?, ?)
            on conflict(id) do update set detailJson=excluded.detailJson, createdAt=excluded.createdAt
            """,
            (log_id, TASK_ID, operator_id, action_type, json.dumps(detail, ensure_ascii=False), ts),
        )


def upsert_memories(con: sqlite3.Connection, ts: str) -> None:
    memories = [
        (
            "memory_jarvis_offer_loop_20260429",
            "agent_jarvis",
            "commercial_loop",
            "内容获客后的承接顺序：免费清单建立信任 -> 99 元体检或 399 元咨询诊断 -> 999 元最小经营闭环启动包交付结果 -> OS/行业 Agent 包/陪跑作为后续升级。COO 必须调度产品、销售、客服、财务、审计一起运转。",
        ),
        (
            "memory_mcgonagall_offer_ladder_20260429",
            "agent_mcgonagall",
            "product_strategy",
            "当前第一付费产品不是直接卖 OS，而是 999 元最小经营闭环启动包：定位、内容首发、承接话术、收款页、交付记录和复盘模板。OS 是后续证明与升级产品。",
        ),
        (
            "memory_fred_inbound_sop_20260429",
            "agent_fred",
            "sales_sop",
            "线索进入后先分层：L1 解释项目，L2 问业务/渠道/卡点三个诊断问题，L3 才报价。禁止使用保证涨粉、保证成交、自动赚钱等承诺。",
        ),
        (
            "memory_dobby_reply_boundary_20260429",
            "agent_dobby",
            "customer_success",
            "评论和私信只生成回复建议并进入 CEO 审核队列。回复应先理解对方业务，再给下一步诊断，不诱导点赞、收藏、评论，不自动外发。",
        ),
        (
            "memory_percy_revenue_boundary_20260429",
            "agent_percy",
            "finance_control",
            "只有微信/支付宝真实到账后才能写入 revenues。99/399/999/2999/399月费必须带来源、客户、交付包、退款边界和对应任务 ID。",
        ),
        (
            "memory_luna_content_offer_bridge_20260429",
            "agent_luna",
            "content_growth",
            "小红书内容先做号和建立信任，题材围绕真实经营实验、Token 工资单、审核复盘、岗位协作和交付案例。不要用评论口令，不硬卖系统，内容中自然释放可诊断、可交付、可复盘的信号。",
        ),
    ]
    for memory_id, agent_id, category, content in memories:
        con.execute(
            """
            insert into agent_memories (id, agentId, category, content, source, createdAt)
            values (?, ?, ?, ?, ?, ?)
            on conflict(id) do update set category=excluded.category, content=excluded.content, source=excluded.source, createdAt=excluded.createdAt
            """,
            (memory_id, agent_id, category, content, "post_traffic_offer_ladder_20260429", ts),
        )


def main() -> int:
    ladder = read_offer_ladder()
    ts = now_iso()
    touched: list[str] = []
    for db_path in DB_PATHS:
        if not db_path.exists():
            continue
        con = sqlite3.connect(db_path)
        try:
            upsert_task(con, ladder, ts)
            upsert_logs(con, ts)
            upsert_memories(con, ts)
            con.commit()
            touched.append(str(db_path))
        finally:
            con.close()
    print(json.dumps({"ok": True, "task": TASK_ID, "dbs": touched}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
