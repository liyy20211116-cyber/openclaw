from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "output" / "revenue_goals"
EVENTS_PATH = ROOT / "output" / "coo_ops" / "autonomous-revenue-loop-events.jsonl"


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def build_project_candidates() -> list[dict[str, Any]]:
    return [
        {
            "id": "ai_one_company_diagnosis",
            "name": "AI 一人公司诊断服务",
            "price_floor_cny": 999,
            "price_anchor_cny": 1999,
            "price_ceiling_cny": 2999,
            "delivery_days": 3,
            "proof_assets": [
                "runtime center",
                "agent roster",
                "HR platform learning knowledge base",
                "content operation monitor",
            ],
            "target_buyer": "想用 AI 降本增效但不知道从哪里开始的小老板/超级个体",
            "deliverable": "一份业务诊断、自动化机会清单、内容/销售/交付 SOP 和 7 天执行表",
            "risk": "low",
        },
        {
            "id": "platform_content_sop_setup",
            "name": "平台内容 SOP 搭建服务",
            "price_floor_cny": 1999,
            "price_anchor_cny": 2999,
            "price_ceiling_cny": 4999,
            "delivery_days": 5,
            "proof_assets": [
                "cross-platform viral patterns",
                "Douyin/Bilibili/WeChat draft bundle",
                "Snape compliance gate",
            ],
            "target_buyer": "有账号但内容生产不稳定的个人品牌/小团队",
            "deliverable": "选题库、跨平台改编 SOP、发布前审计表、7 天内容草稿",
            "risk": "medium",
        },
        {
            "id": "jarvis_openclaw_deploy_coaching",
            "name": "OpenClaw / Jarvis 本地自动化部署陪跑",
            "price_floor_cny": 2999,
            "price_anchor_cny": 4999,
            "price_ceiling_cny": 9999,
            "delivery_days": 7,
            "proof_assets": [
                "local Jarvis OS",
                "OpenClaw gateway",
                "model proxy",
                "scheduled watchdog",
            ],
            "target_buyer": "已有技术基础、想把 Agent 真正接入本地工作流的人",
            "deliverable": "本地环境启动、模型路由、角色配置、计划任务和一次真实业务闭环",
            "risk": "medium",
        },
    ]


def _score_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    speed = max(0, 30 - int(candidate["delivery_days"])) * 1.2
    price = min(int(candidate["price_anchor_cny"]) / 100, 50)
    proof = len(candidate.get("proof_assets", [])) * 6
    risk_penalty = {"low": 0, "medium": 8, "high": 18}.get(str(candidate.get("risk")), 10)
    margin = 24 if int(candidate["price_anchor_cny"]) >= 1999 else 18
    score = round(speed + price + proof + margin - risk_penalty, 1)
    next_candidate = dict(candidate)
    next_candidate["score"] = score
    next_candidate["score_breakdown"] = {
        "speed": round(speed, 1),
        "price": round(price, 1),
        "proof": proof,
        "margin": margin,
        "risk_penalty": risk_penalty,
    }
    return next_candidate


def score_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted((_score_candidate(item) for item in candidates), key=lambda item: item["score"], reverse=True)


def select_primary_project(scored: list[dict[str, Any]]) -> dict[str, Any]:
    if not scored:
        return {}
    return scored[0]


def build_offer(selected: dict[str, Any], target_cny: int) -> dict[str, Any]:
    anchor = int(selected["price_anchor_cny"])
    needed_orders = max(1, (target_cny + anchor - 1) // anchor)
    return {
        "project_id": selected["id"],
        "name": selected["name"],
        "price_cny": anchor,
        "needed_orders": needed_orders,
        "deliverable": selected["deliverable"],
        "buyer": selected["target_buyer"],
        "boundary": "只承诺交付诊断、SOP、配置和陪跑结果，不承诺平台流量、收入或客户成交。",
        "proof_assets": selected.get("proof_assets", []),
    }


def build_department_actions(selected: dict[str, Any], target_cny: int) -> list[dict[str, Any]]:
    offer = build_offer(selected, target_cny)
    return [
        {
            "owner": "jarvis-coo",
            "action": "Set the 30-day revenue command rhythm and publish daily operating reports.",
            "output": "daily revenue standup, blockers, approval queue",
            "success_metric": "one updated revenue report per day",
        },
        {
            "owner": "mcgonagall-product",
            "action": f"Package {selected['name']} into a buyer-ready offer.",
            "output": offer,
            "success_metric": "buyer understands price, deliverables, timeline, and boundary in 3 minutes",
        },
        {
            "owner": "luna-growth",
            "action": "Create acquisition content from current proof assets.",
            "output": "one XHS note, one Douyin script, one WeChat article angle",
            "success_metric": "at least one qualified inquiry or clear objection",
            "requires_ceo_approval": True,
        },
        {
            "owner": "fred-sales",
            "action": "Build lead intake and outreach scripts for the selected offer.",
            "output": "lead form, qualification questions, quote script",
            "success_metric": "five target prospects or inbound leads classified",
            "requires_ceo_approval": True,
        },
        {
            "owner": "snape-audit",
            "action": "Audit claims, pricing wording, proof screenshots, and external promises.",
            "output": "risk checklist and blocked phrases",
            "success_metric": "zero auto-publish or revenue guarantee claims",
        },
        {
            "owner": "percy-finance",
            "action": "Track target gap, price path, collection state, and booked revenue.",
            "output": "target gap table and payment confirmation rule",
            "success_metric": "real revenue remains zero until CEO confirms payment",
        },
        {
            "owner": "dobby-customer",
            "action": "Prepare onboarding, FAQ, complaint, and delivery handoff scripts.",
            "output": "customer success SOP",
            "success_metric": "first buyer can be onboarded within 4 hours after payment",
        },
        {
            "owner": "neville-hr",
            "action": "Turn this revenue loop into reusable company training.",
            "output": "lessons for Luna, Fred, McGonagall, Snape, and Jarvis",
            "success_metric": "one learning memo per revenue loop",
        },
    ]


def build_approval_queue(actions: list[dict[str, Any]], offer: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "id": "approval_publish_revenue_content",
            "type": "publish_content",
            "owner": "luna-growth",
            "title": "Publish acquisition content for selected revenue project",
            "reason": "External publishing requires CEO confirmation.",
        },
        {
            "id": "approval_send_sales_outreach",
            "type": "send_outreach",
            "owner": "fred-sales",
            "title": "Send first sales outreach or private-domain follow-up",
            "reason": "Direct outreach requires CEO confirmation.",
        },
        {
            "id": "approval_quote_selected_offer",
            "type": "quote_price",
            "owner": "fred-sales",
            "title": f"Quote CNY {offer['price_cny']} for {offer['name']}",
            "reason": "Pricing and customer commitment require CEO confirmation.",
        },
    ]


def build_execution_ledger(actions: list[dict[str, Any]], approvals: list[dict[str, Any]], run_id: str, mode: str) -> dict[str, Any]:
    approval_owners = {item["owner"] for item in approvals}
    items = []
    for index, action in enumerate(actions, start=1):
        gated = bool(action.get("requires_ceo_approval")) or action["owner"] in approval_owners
        items.append(
            {
                "id": f"{run_id}-action-{index:02d}",
                "owner": action["owner"],
                "action": action["action"],
                "output": action["output"],
                "success_metric": action["success_metric"],
                "status": "pending_ceo_approval" if gated else "executed_internal",
                "mode": mode,
            }
        )
    return {
        "run_id": run_id,
        "mode": mode,
        "items": items,
        "executed_count": sum(1 for item in items if item["status"] == "executed_internal"),
        "approval_gated_count": sum(1 for item in items if item["status"] == "pending_ceo_approval"),
    }


def build_agent_dispatch(ledger: dict[str, Any]) -> dict[str, Any]:
    dispatch: dict[str, list[dict[str, Any]]] = {}
    for item in ledger["items"]:
        dispatch.setdefault(item["owner"], []).append(
            {
                "task_id": item["id"],
                "status": item["status"],
                "action": item["action"],
                "output": item["output"],
                "success_metric": item["success_metric"],
            }
        )
    return {"run_id": ledger["run_id"], "mode": ledger["mode"], "dispatch": dispatch}


def render_plan(payload: dict[str, Any]) -> str:
    selected = payload["selected_project"]
    offer = payload["offer"]
    lines = [
        f"# Revenue Goal Plan - CNY {payload['target_cny']}",
        "",
        f"- Run ID: `{payload['run_id']}`",
        f"- Deadline: {payload['days']} days",
        f"- Selected project: {selected['name']} ({selected['score']})",
        f"- Offer: CNY {offer['price_cny']} x {offer['needed_orders']} orders",
        f"- Current booked revenue: CNY {payload['booked_real_revenue']}",
        f"- Current gap: CNY {payload['current_gap_cny']}",
        "",
        "## Project Candidates",
    ]
    for item in payload["project_candidates"]:
        lines.append(f"- {item['name']}: score {item['score']} / CNY {item['price_anchor_cny']} / {item['delivery_days']} days / risk {item['risk']}")
    lines.extend(["", "## Department Actions"])
    for action in payload["department_actions"]:
        lines.append(f"- {action['owner']}: {action['action']}")
    lines.extend(["", "## Approval Queue"])
    for approval in payload["approval_queue"]:
        lines.append(f"- {approval['type']} / {approval['owner']}: {approval['title']}")
    return "\n".join(lines) + "\n"


def render_offer(offer: dict[str, Any]) -> str:
    return f"""# {offer['name']}

Price: CNY {offer['price_cny']}

Buyer: {offer['buyer']}

Deliverable: {offer['deliverable']}

Boundary: {offer['boundary']}

Proof assets:
{chr(10).join(f"- {item}" for item in offer['proof_assets'])}
"""


def render_content_brief(payload: dict[str, Any]) -> str:
    offer = payload["offer"]
    return f"""# Acquisition Content Brief

Core offer: {offer['name']}

Main angle: 我用自己的 Jarvis 一人公司系统先跑出真实经营闭环，再把这套方法做成可交付服务。

XHS note:
- Hook: 一个人想用 AI 经营公司，第一步不是买工具，而是先知道哪条业务能最快回本。
- CTA: 想看我怎么拆你的业务，可以先做一次 AI 一人公司诊断。

Douyin script:
- 3 seconds: 我给一人公司设了一个目标：30 天赚 1 万。
- Middle: 系统自动选项目、算价格、做内容、排销售动作。
- Ending: 真正对外前，所有发布、报价、私信都要 CEO 审批。

WeChat article:
- Title: 我让一人公司自己找项目：30 天赚 1 万不是一句口号
- Sections: 目标拆解 / 项目评分 / 主服务包 / 内容获客 / 审批边界 / 每日复盘。
"""


def run_revenue_goal_loop(target_cny: int, days: int, run_id: str | None = None, dry_run: bool = True) -> dict[str, Any]:
    date = dt.date.today().isoformat()
    rid = run_id or f"revenue-goal-{target_cny}-{date.replace('-', '')}"
    out_dir = OUT_ROOT / rid
    candidates = score_candidates(build_project_candidates())
    selected = select_primary_project(candidates)
    offer = build_offer(selected, target_cny)
    actions = build_department_actions(selected, target_cny)
    approvals = build_approval_queue(actions, offer)
    mode = "dry_run" if dry_run else "autonomous"
    execution_ledger = build_execution_ledger(actions, approvals, rid, mode)
    agent_dispatch = build_agent_dispatch(execution_ledger)
    booked_revenue = 0
    payload: dict[str, Any] = {
        "ok": True,
        "run_id": rid,
        "run_date": date,
        "mode": mode,
        "target_cny": target_cny,
        "days": days,
        "booked_real_revenue": booked_revenue,
        "current_gap_cny": max(target_cny - booked_revenue, 0),
        "project_candidates": candidates,
        "selected_project": selected,
        "offer": offer,
        "department_actions": actions,
        "approval_queue": approvals,
        "internal_execution": {
            "executed_count": execution_ledger["executed_count"],
            "approval_gated_count": execution_ledger["approval_gated_count"],
        },
        "safety": {
            "auto_publish": False,
            "auto_outreach": False,
            "auto_quote": False,
            "auto_revenue_booking": False,
        },
    }
    evidence_path = out_dir / "evidence.json"
    plan_path = out_dir / "plan.md"
    approvals_path = out_dir / "approvals.json"
    offer_path = out_dir / "offer.md"
    content_brief_path = out_dir / "content-brief.md"
    execution_ledger_path = out_dir / "execution-ledger.json"
    agent_dispatch_path = out_dir / "agent-dispatch.json"
    artifacts = {
        "evidence": str(evidence_path),
        "plan": str(plan_path),
        "approvals": str(approvals_path),
        "offer": str(offer_path),
        "content_brief": str(content_brief_path),
        "execution_ledger": str(execution_ledger_path),
        "agent_dispatch": str(agent_dispatch_path),
        "events": str(EVENTS_PATH),
    }
    payload["artifacts"] = artifacts
    write_json(evidence_path, payload)
    write_text(plan_path, render_plan(payload))
    write_json(approvals_path, {"run_id": rid, "approval_queue": approvals})
    write_text(offer_path, render_offer(offer))
    write_text(content_brief_path, render_content_brief(payload))
    write_json(execution_ledger_path, execution_ledger)
    write_json(agent_dispatch_path, agent_dispatch)
    if not dry_run:
        append_jsonl(
            EVENTS_PATH,
            {
                "ts": dt.datetime.now().isoformat(timespec="seconds"),
                "event": "revenue_goal_daily_loop",
                "run_id": rid,
                "target_cny": target_cny,
                "mode": mode,
                "selected_project": selected["id"],
                "executed_internal": execution_ledger["executed_count"],
                "approval_gated": execution_ledger["approval_gated_count"],
            },
        )
    write_json(evidence_path, payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-cny", type=int, default=10000)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    result = run_revenue_goal_loop(target_cny=args.target_cny, days=args.days, run_id=args.run_id, dry_run=args.dry_run)
    print(
        json.dumps(
            {
                "ok": result["ok"],
                "run_id": result["run_id"],
                "target_cny": result["target_cny"],
                "selected_project": result["selected_project"]["name"],
                "approval_queue": len(result["approval_queue"]),
                "artifacts": result["artifacts"],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
