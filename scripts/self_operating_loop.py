from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "output" / "self_operating_loop"


def read_json(path: Path, default: dict[str, Any] | None = None) -> dict[str, Any]:
    if not path.exists():
        return default or {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def latest_file(directory: Path, pattern: str) -> str:
    if not directory.exists():
        return ""
    files = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return str(files[0]) if files else ""


def run_command(args: list[str], timeout: int = 60) -> dict[str, Any]:
    started = dt.datetime.now()
    try:
        completed = subprocess.run(
            args,
            cwd=str(ROOT),
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            check=False,
        )
        return {
            "ok": completed.returncode == 0,
            "returncode": completed.returncode,
            "stdout": completed.stdout.strip(),
            "stderr": completed.stderr.strip(),
            "duration_ms": int((dt.datetime.now() - started).total_seconds() * 1000),
        }
    except Exception as exc:
        return {
            "ok": False,
            "returncode": -1,
            "stdout": "",
            "stderr": str(exc),
            "duration_ms": int((dt.datetime.now() - started).total_seconds() * 1000),
        }


def build_goal() -> dict[str, Any]:
    commerce = read_json(ROOT / "config" / "tenant" / "default" / "commerce.json")
    skus = commerce.get("skus", [])
    starter = next((sku for sku in skus if sku.get("id") == "starter-one-time"), None) or {}
    return {
        "name": "7天自营盈利目标",
        "positioning": "先用一人公司自己卖出一个具体服务，再把赚钱证据产品化。",
        "offer_id": starter.get("id", "starter-one-time"),
        "offer_name": starter.get("name", "启航版一次性买断"),
        "target_orders": 1,
        "target_revenue_cny": int(starter.get("price") or 999),
        "deadline_days": 7,
        "safety_rule": "真实收入只在 CEO 确认到账后登记；本循环不得登记真实收入。",
    }


def inspect_payment() -> dict[str, Any]:
    result = run_command([sys.executable, "scripts/payment_activation_check.py"], timeout=30)
    commerce = read_json(ROOT / "config" / "tenant" / "default" / "commerce.json")
    qr = commerce.get("personal_qr", {})
    channels = []
    if qr.get("wechat_qr_path") and (ROOT / qr["wechat_qr_path"]).exists():
        channels.append("wechat")
    if qr.get("alipay_qr_path") and (ROOT / qr["alipay_qr_path"]).exists():
        channels.append("alipay")
    return {
        "status": "active" if commerce.get("enabled") and channels else "pending",
        "channels": channels,
        "command": result,
        "report": str(ROOT / "output" / "ops" / "payment-status.md"),
    }


def collect_existing_assets() -> dict[str, str]:
    return {
        "payment_block_html": str(ROOT / "output" / "landing" / "payment-block.html"),
        "payment_block_md": str(ROOT / "output" / "landing" / "payment-block.md"),
        "latest_outreach": latest_file(ROOT / "output" / "outreach", "outreach_*.md"),
        "latest_invoice": latest_file(ROOT / "output", "报价单_*.html"),
        "pricing_page": str(ROOT / "docs" / "landing" / "pricing.html"),
        "benchmark_playbook": str(ROOT / "config" / "knowledge" / "one-company-benchmark-playbook.md"),
    }


def inspect_pipeline() -> dict[str, Any]:
    pipeline = read_json(ROOT / "data_raw" / "sales_pipeline.json", {"leads": []})
    leads = pipeline.get("leads", [])
    contactable = [lead for lead in leads if str(lead.get("contact", "")).strip()]
    total_value = sum(int(lead.get("value") or 0) for lead in leads)
    return {
        "total_leads": len(leads),
        "contactable_leads": len(contactable),
        "total_pipeline_value": total_value,
        "top_leads": sorted(
            [
                {
                    "id": lead.get("id", ""),
                    "name": lead.get("name", ""),
                    "stage": lead.get("stage", ""),
                    "value": int(lead.get("value") or 0),
                    "source": lead.get("source", ""),
                    "has_contact": bool(str(lead.get("contact", "")).strip()),
                }
                for lead in leads
            ],
            key=lambda item: item["value"],
            reverse=True,
        )[:5],
    }


def build_actions(goal: dict[str, Any], pipeline: dict[str, Any], assets: dict[str, str]) -> list[dict[str, Any]]:
    return [
        {
            "owner": "jarvis-coo",
            "action": "发布今日经营指令",
            "output": "把目标拆为内容、销售、财务、交付四条线，并在晚间复盘。",
            "success_metric": "今日至少完成1次真实对外触达或拿到1个明确拒绝/反馈。",
        },
        {
            "owner": "luna-growth",
            "action": "发布/准备1条自营内容",
            "output": "围绕“一人公司先自己赚钱再卖系统”写一条朋友圈/小红书内容，并参考对标 Playbook 的内容钩子。",
            "success_metric": "获得1个咨询、评论、私信或转发。",
            "requires_ceo_confirm": True,
        },
        {
            "owner": "luna-growth",
            "action": "更新一人公司对标观察",
            "output": assets.get("benchmark_playbook", ""),
            "success_metric": "每天至少把1个竞品内容钩子转成Jarvis自己的选题或产品动作。",
        },
        {
            "owner": "fred-sales",
            "action": "人工触达1个真实潜在客户",
            "output": assets.get("latest_outreach", ""),
            "success_metric": "拿到一个回复：感兴趣/没兴趣/需要更多信息。",
            "requires_ceo_confirm": True,
            "blocker": "当前销售管道可联系线索为0，CEO需要指定真实联系人或补充contact字段。" if pipeline["contactable_leads"] == 0 else "",
        },
        {
            "owner": "mcgonagall-product",
            "action": "把999元启航版重写成服务承诺",
            "output": f"{goal['offer_name']}：交付一套可运行的最小经营循环，而不是只交付软件。",
            "success_metric": "客户能在3分钟内理解买到什么、多久交付、怎么验收。",
        },
        {
            "owner": "percy-finance",
            "action": "准备收款与报价",
            "output": assets.get("payment_block_md", ""),
            "success_metric": "客户确认购买后可立即付款；到账后再登记真实收入。",
        },
        {
            "owner": "dobby-customer",
            "action": "准备首单交付/客诉SOP",
            "output": "安装失败、不会用、效果不达预期、退款争议四类SOP。",
            "success_metric": "客户付款后24小时内完成首次交付和使用引导。",
        },
    ]


def build_blockers(payment: dict[str, Any], pipeline: dict[str, Any], assets: dict[str, str]) -> list[dict[str, str]]:
    blockers: list[dict[str, str]] = []
    if payment["status"] != "active":
        blockers.append({"severity": "high", "owner": "percy-finance", "issue": "收款通道未激活。"})
    if pipeline["contactable_leads"] == 0:
        blockers.append({"severity": "high", "owner": "fred-sales", "issue": "销售管道没有可联系客户，无法自主完成真实触达。"})
    if not assets.get("latest_outreach"):
        blockers.append({"severity": "medium", "owner": "fred-sales", "issue": "缺少获客话术文件。"})
    if not Path(assets.get("payment_block_md", "")).exists():
        blockers.append({"severity": "medium", "owner": "percy-finance", "issue": "付款说明文件缺失。"})
    blockers.append({"severity": "medium", "owner": "luna-growth", "issue": "本地 LLM 代理连接失败，长文/正文生成需要修复后才能自动发布。"})
    return blockers


def render_report(payload: dict[str, Any]) -> str:
    lines = [
        f"# {payload['goal']['name']}",
        "",
        f"- 运行ID：`{payload['run_id']}`",
        f"- 日期：{payload['run_date']}",
        f"- 目标：{payload['goal']['target_orders']} 单 / CNY {payload['goal']['target_revenue_cny']}",
        f"- 服务：{payload['goal']['offer_name']}",
        f"- 安全规则：{payload['goal']['safety_rule']}",
        "",
        "## 今日判断",
        "",
        "一人公司当前要先做自营，不急着卖 OS。今天的核心是用系统自己完成一次可触达、可收款、可交付的经营动作。",
        "",
        "## 状态",
        "",
        f"- 支付状态：{payload['payment']['status']} / {', '.join(payload['payment']['channels']) or '无'}",
        f"- 销售线索：{payload['pipeline']['total_leads']} 条",
        f"- 可联系线索：{payload['pipeline']['contactable_leads']} 条",
        f"- 管道金额：CNY {payload['pipeline']['total_pipeline_value']}",
        f"- 今日登记真实收入：CNY {payload['revenue']['booked_real_revenue']}（不得登记真实收入，除非 CEO 确认到账）",
        "",
        "## 今日动作队列",
        "",
    ]
    for index, action in enumerate(payload["actions"], start=1):
        lines.append(f"{index}. **{action['owner']}**：{action['action']}")
        lines.append(f"   - 产出：{action['output']}")
        lines.append(f"   - 指标：{action['success_metric']}")
        if action.get("requires_ceo_confirm"):
            lines.append("   - 对外前置：需要 CEO 确认")
        if action.get("blocker"):
            lines.append(f"   - 阻塞：{action['blocker']}")
    lines.extend(["", "## 阻塞", ""])
    for blocker in payload["blockers"]:
        lines.append(f"- {blocker['severity']} / {blocker['owner']}：{blocker['issue']}")
    lines.extend(["", "## 明确禁止", "", "- 不得伪造成交。", "- 不得自动群发。", "- 不得自动登记真实收入。"])
    return "\n".join(lines) + "\n"


def run_self_operating_loop(run_date: str | None = None, run_id: str | None = None, dry_run: bool = False) -> dict[str, Any]:
    date = run_date or dt.date.today().isoformat()
    rid = run_id or f"self-operating-{date.replace('-', '')}"
    out_dir = OUT_ROOT / rid

    goal = build_goal()
    payment = inspect_payment()
    assets = collect_existing_assets()
    pipeline = inspect_pipeline()
    actions = build_actions(goal, pipeline, assets)
    blockers = build_blockers(payment, pipeline, assets)
    from jarvis_coo_ops import run_coo_ops

    coo_ops = run_coo_ops(run_date=date, run_id=f"{rid}-coo")
    actions.append(
        {
            "owner": "jarvis-coo",
            "action": "生成草稿发布与评论私域队列",
            "output": coo_ops["artifacts"]["report"],
            "success_metric": "CEO 审核后至少发布 1 条内容，并处理 1 条高意向评论。",
            "requires_ceo_confirm": True,
        }
    )
    blockers.extend(coo_ops["blockers"])

    payload: dict[str, Any] = {
        "ok": True,
        "run_id": rid,
        "run_date": date,
        "mode": "dry_run" if dry_run else "live_local",
        "goal": goal,
        "payment": payment,
        "pipeline": pipeline,
        "assets": assets,
        "coo_ops": {
            "report": coo_ops["artifacts"]["report"],
            "draft_job": coo_ops["artifacts"]["draft_job"],
            "comment_queue": coo_ops["artifacts"]["comment_queue"],
            "draft_jobs": len(coo_ops["draft_jobs"]["jobs"]),
            "comments": len(coo_ops["comment_queue"]),
            "cdp_ready": coo_ops["cdp"]["ok"],
        },
        "actions": actions,
        "blockers": blockers,
        "revenue": {
            "booked_real_revenue": 0,
            "reason": "真实收入只在 CEO 确认到账后登记。",
        },
    }

    action_path = out_dir / "actions.json"
    evidence_path = out_dir / "evidence.json"
    report_path = out_dir / "daily-report.md"

    write_json(action_path, {"run_id": rid, "actions": actions})
    write_json(evidence_path, payload)
    write_text(report_path, render_report(payload))

    payload["artifacts"] = {
        "actions": str(action_path),
        "evidence": str(evidence_path),
        "report": str(report_path),
    }
    write_json(evidence_path, payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=None)
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    result = run_self_operating_loop(run_date=args.date, run_id=args.run_id, dry_run=args.dry_run)
    print(json.dumps({
        "ok": result["ok"],
        "run_id": result["run_id"],
        "report": result["artifacts"]["report"],
        "actions": len(result["actions"]),
        "blockers": len(result["blockers"]),
        "payment": result["payment"]["status"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
