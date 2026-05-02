from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "output" / "coo_ops"


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
    files = sorted(directory.glob(pattern), key=lambda path: path.stat().st_mtime, reverse=True)
    return str(files[0]) if files else ""


def inspect_cdp() -> dict[str, Any]:
    sys.path.insert(0, str(ROOT / "scripts" / "publish"))
    try:
        from _common import probe_cdp

        tabs = probe_cdp()
    except Exception as exc:
        return {
            "ok": False,
            "error": str(exc),
            "tabs": [],
            "login_targets": platform_login_targets(False, []),
        }
    return {
        "ok": True,
        "tabs": [
            {"title": tab.get("title", ""), "url": tab.get("url", ""), "type": tab.get("type", "")}
            for tab in tabs
        ],
        "login_targets": platform_login_targets(True, tabs),
    }


def platform_login_targets(cdp_ok: bool, tabs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    targets = [
        ("xiaohongshu", "小红书创作服务平台", "creator.xiaohongshu.com"),
        ("douyin", "抖音创作者中心", "creator.douyin.com"),
        ("wechat-official", "微信公众号后台", "mp.weixin.qq.com"),
        ("bilibili", "B站创作中心", "member.bilibili.com"),
    ]
    rows: list[dict[str, Any]] = []
    for platform, label, host in targets:
        open_tab = cdp_ok and any(host in (tab.get("url") or "") for tab in tabs)
        rows.append(
            {
                "platform": platform,
                "label": label,
                "host": host,
                "open_tab": bool(open_tab),
                "status": "ready_for_login_or_draft" if open_tab else "needs_login_tab",
            }
        )
    return rows


def build_content_assets(run_date: str) -> dict[str, str]:
    poster = ROOT / "output" / "posters" / f"one-company-self-run-{run_date}.png"
    ensure_self_run_poster(poster)
    return {
        "payment_block": str(ROOT / "output" / "landing" / "payment-block.md"),
        "outreach": latest_file(ROOT / "output" / "outreach", "outreach_*.md"),
        "benchmark": str(ROOT / "config" / "knowledge" / "one-company-benchmark-playbook.md"),
        "report": str(ROOT / "output" / "reports" / "one-company-benchmark-analysis-20260428.md"),
        "draft_md": str(ROOT / "output" / "coo_ops" / f"content-draft-{run_date}.md"),
        "poster": str(poster),
    }


def find_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    lines: list[str] = []
    current = ""
    for char in text:
        trial = current + char
        if draw.textlength(trial, font=font) > max_width and current:
            lines.append(current)
            current = char
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def ensure_self_run_poster(path: Path) -> None:
    if path.exists() and path.stat().st_size > 10_000:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 1080, 1440
    image = Image.new("RGB", (width, height), (11, 18, 32))
    draw = ImageDraw.Draw(image)
    brand_font = find_font(38)
    title_font = find_font(88)
    subtitle_font = find_font(42)
    small_font = find_font(30)

    draw.rectangle([0, 0, width, height], fill=(11, 18, 32))
    draw.rectangle([0, 0, width, 180], fill=(18, 30, 52))
    draw.text((64, 56), "Jarvis One Company OS", font=brand_font, fill=(94, 234, 212))

    title_lines = wrap_text("一人公司先自己跑起来", title_font, width - 128, draw)
    y = 360
    for line in title_lines:
        draw.text((64, y), line, font=title_font, fill=(248, 250, 252))
        y += 112

    subtitle_lines = [
        "不是先卖系统",
        "而是先让 AI 团队每天产生经营动作",
        "内容 · 线索 · 私域 · 收款 · 交付 · 复盘",
    ]
    y += 60
    for line in subtitle_lines:
        draw.text((64, y), line, font=subtitle_font, fill=(203, 213, 225))
        y += 68

    draw.rounded_rectangle([64, 1080, width - 64, 1260], radius=28, fill=(15, 23, 42), outline=(94, 234, 212), width=3)
    draw.text((104, 1120), "今日目标：拿到第一个真实咨询", font=subtitle_font, fill=(94, 234, 212))
    draw.text((104, 1185), "CEO 审核后发布，不自动回复，不伪造收入", font=small_font, fill=(226, 232, 240))
    draw.text((64, 1340), "@野子哥 · 一人公司自营实验", font=small_font, fill=(148, 163, 184))
    image.save(path, "PNG", optimize=True)


def build_content_draft(run_date: str, assets: dict[str, str]) -> str:
    return "\n".join(
        [
            "# 一人公司自营实验日报",
            "",
            "今天不卖软件，先公开一人公司自己怎么跑业务：",
            "",
            "1. Jarvis 设定 7 天目标：拿到 1 个 999 元启航版订单。",
            "2. COO 循环每天检查收款、线索、内容、评论和交付。",
            "3. 所有平台先进入草稿箱，CEO 审核后发布。",
            "4. 评论区只生成回复建议，不自动回复。",
            "5. 真收入只在到账后登记，演示收入不算商业化。",
            "",
            "如果你也想看一人公司怎么从 0 跑出第一个闭环，可以评论“闭环”或私信我。",
            "",
            f"- 日期：{run_date}",
            f"- 收款说明：{assets['payment_block']}",
            f"- 对标观察：{assets['benchmark']}",
            "",
        ]
    )


def build_draft_jobs(run_date: str, assets: dict[str, str]) -> dict[str, Any]:
    content = build_content_draft(run_date, assets)
    draft_path = Path(assets["draft_md"])
    write_text(draft_path, content)
    tags = ["一人公司", "AI运营", "自主赚钱", "Jarvis", "商业闭环"]
    return {
        "mode": "review_only",
        "run_date": run_date,
        "jobs": [
            {
                "platform": "xiaohongshu",
                "action": "draft",
                "title": "一人公司先自己跑起来：第1天",
                "content_file": str(draft_path.relative_to(ROOT)).replace("\\", "/"),
                "images": [str(Path(assets["poster"]).relative_to(ROOT)).replace("\\", "/")],
                "tags": tags,
                "publish": False,
                "requires_ceo_confirm": True,
            },
            {
                "platform": "douyin",
                "action": "draft",
                "title": "一人公司不是先卖系统，而是先自己挣到钱",
                "script_file": str(draft_path.relative_to(ROOT)).replace("\\", "/"),
                "tags": tags,
                "publish": False,
                "requires_ceo_confirm": True,
                "blocker": "需要 CEO 提供或确认短视频素材后才能进入抖音草稿。",
            },
            {
                "platform": "wechat-official",
                "action": "draft",
                "title": "一人公司自营实验：先让 Jarvis 做 COO",
                "md": str(draft_path.relative_to(ROOT)).replace("\\", "/"),
                "publish": False,
                "requires_ceo_confirm": True,
            },
            {
                "platform": "bilibili",
                "action": "draft",
                "title": "一人公司自营实验：Jarvis COO 第1天",
                "desc_file": str(draft_path.relative_to(ROOT)).replace("\\", "/"),
                "tags": tags,
                "publish": False,
                "requires_ceo_confirm": True,
                "blocker": "需要 CEO 提供或确认视频文件后才能进入 B 站上传草稿。",
            },
        ],
    }


def classify_comment(text: str) -> dict[str, Any]:
    lower = text.lower()
    pricing_terms = ["价格", "多少钱", "收费", "报价", "999", "买", "购买"]
    purchase_terms = ["能帮我", "想做", "怎么做", "私信", "合作", "闭环", "赚钱"]
    risk_terms = ["封号", "违规", "投诉", "失败", "骗", "退款"]
    is_pricing = any(term in text for term in pricing_terms)
    is_purchase = any(term in text for term in purchase_terms)
    is_risk = any(term in text for term in risk_terms)
    if is_pricing or is_purchase:
        intent = "purchase" if is_purchase else "pricing"
        priority = "high"
    elif is_risk:
        intent = "risk"
        priority = "high"
    else:
        intent = "general"
        priority = "medium"
    return {
        "intent": intent,
        "priority": priority,
        "is_lead": bool(is_pricing or is_purchase),
        "keywords": [term for term in pricing_terms + purchase_terms + risk_terms if term in text or term in lower],
    }


def generate_reply(platform: str, text: str, intent: dict[str, Any]) -> str:
    if intent["intent"] in ("pricing", "purchase"):
        return "可以，当前先跑 999 元启航版：帮你搭一个可执行的最小经营闭环。你可以私信我“闭环”，我发你交付清单。"
    if intent["intent"] == "risk":
        return "不会建议自动群发或自动评论。现在的方案是先生成草稿和回复建议，人工审核后再发，尽量降低账号风险。"
    if platform == "bilibili":
        return "这套实验会持续公开过程：目标、动作、结果和失败点都会留痕，方便大家判断是不是真的能跑。"
    return "核心不是炫工具，而是让 AI 每天产生可审核的经营动作：内容、线索、收款、交付和复盘。"


def build_comment_queue(sample_comments: list[dict[str, str]] | None = None) -> list[dict[str, Any]]:
    comments = sample_comments or [
        {"platform": "xiaohongshu", "author": "sample_lead", "text": "一人公司怎么收费？能不能帮我也跑一个闭环？"},
        {"platform": "douyin", "author": "sample_risk", "text": "自动回复评论会不会违规封号？"},
        {"platform": "bilibili", "author": "sample_general", "text": "这个 Jarvis COO 后面会公开视频吗？"},
    ]
    queue: list[dict[str, Any]] = []
    for index, comment in enumerate(comments, start=1):
        platform = comment.get("platform", "unknown")
        text = comment.get("text", "")
        intent = classify_comment(text)
        queue.append(
            {
                "id": f"comment_{index:03d}",
                "platform": platform,
                "author": comment.get("author", ""),
                "original_text": text,
                "intent": intent["intent"],
                "priority": intent["priority"],
                "is_lead": intent["is_lead"],
                "reply_suggestion": generate_reply(platform, text, intent),
                "private_domain_action": "引导私信/微信：发送交付清单和报价" if intent["is_lead"] else "",
                "requires_ceo_confirm": True,
                "auto_reply": False,
            }
        )
    return queue


def build_actions(draft_jobs: dict[str, Any], comment_queue: list[dict[str, Any]], cdp: dict[str, Any]) -> list[dict[str, Any]]:
    lead_count = sum(1 for item in comment_queue if item["is_lead"])
    return [
        {
            "owner": "jarvis-coo",
            "action": "主持今日自营经营会",
            "output": "确认今日内容、评论、私域、收款、交付五条线的待审核任务。",
            "success_metric": "至少形成 1 条待发布草稿和 1 条可执行评论回复建议。",
            "requires_ceo_confirm": True,
        },
        {
            "owner": "luna-growth",
            "action": "把一人公司自营过程写入多平台草稿",
            "output": f"{len(draft_jobs['jobs'])} 个平台草稿任务。",
            "success_metric": "CEO 审核后至少发布 1 个平台。",
            "requires_ceo_confirm": True,
        },
        {
            "owner": "mcgonagall-product",
            "action": "把 999 元启航版包装成可验收服务",
            "output": "定义交付清单：配置核验、首条内容草稿、评论回复模板、收款说明、7 日运营复盘。",
            "success_metric": "潜在客户 3 分钟内能判断买到什么、多久交付、如何验收。",
            "requires_ceo_confirm": True,
        },
        {
            "owner": "hermione-tech",
            "action": "维护自动化执行链路",
            "output": "检查配置 API、发布 CDP、OpenClaw/skill 可用性和测试门禁。",
            "success_metric": "关键脚本可重复运行，失败原因进入阻塞列表。",
            "requires_ceo_confirm": False,
        },
        {
            "owner": "dobby-customer",
            "action": "整理评论区回复与私域引流建议",
            "output": f"{len(comment_queue)} 条评论建议，识别 {lead_count} 条潜在线索。",
            "success_metric": "CEO 审核后回复高意向评论，并引导私信/微信。",
            "requires_ceo_confirm": True,
        },
        {
            "owner": "fred-sales",
            "action": "把高意向评论转成销售线索",
            "output": "只登记真实可联系线索，不把样例评论当客户。",
            "success_metric": "新增 1 条带联系方式或私信上下文的真实线索。",
            "requires_ceo_confirm": True,
        },
        {
            "owner": "percy-finance",
            "action": "守住收款与收入登记纪律",
            "output": "付款码可用；真实收入只在 CEO 确认到账后入账；样例收入不计商业化。",
            "success_metric": "每一笔收入都有客户、金额、交付记录和到账证据。",
            "requires_ceo_confirm": True,
        },
        {
            "owner": "snape-audit",
            "action": "审计外部 skill/GitHub 引入风险",
            "output": "陌生 skill 不直接执行；先做来源、依赖、网络、文件写入、密钥读取五项检查。",
            "success_metric": "没有未审查脚本获得账号、密钥、浏览器登录态或写库权限。",
            "requires_ceo_confirm": False,
        },
        {
            "owner": "neville-hr",
            "action": "检查团队职责是否空转",
            "output": "确认每个角色至少有 1 条今日动作、1 个指标、1 个产出物。",
            "success_metric": "组织不是 COO 单点执行，至少 8 个角色进入任务队列。",
            "requires_ceo_confirm": False,
        },
        {
            "owner": "jarvis-coo",
            "action": "检查发布浏览器登录状态",
            "output": "CDP 已连接" if cdp["ok"] else "CDP 未连接，需要启动调试 Chrome 并扫码登录。",
            "success_metric": "四个平台标签页打开，CEO 完成登录。",
            "requires_ceo_confirm": True,
        },
    ]


def build_role_contracts() -> list[dict[str, str]]:
    return [
        {"agent": "jarvis-coo", "role": "COO", "responsibility": "拆目标、排优先级、调度全员、晚间复盘", "forbidden": "替所有岗位单点干活"},
        {"agent": "luna-growth", "role": "增长", "responsibility": "选题、内容草稿、平台发布队列、数据反馈", "forbidden": "未经审核自动发布"},
        {"agent": "fred-sales", "role": "销售", "responsibility": "线索识别、私域承接、报价跟进、成交推进", "forbidden": "把样例线索当真实客户"},
        {"agent": "mcgonagall-product", "role": "产品", "responsibility": "服务包、验收标准、交付边界、客户价值定义", "forbidden": "只卖概念不卖结果"},
        {"agent": "percy-finance", "role": "财务", "responsibility": "收款检查、收入登记、Token/成本台账、ROI", "forbidden": "未到账登记真实收入"},
        {"agent": "dobby-customer", "role": "客服/成功", "responsibility": "评论回复建议、客诉 SOP、交付跟进、满意度", "forbidden": "自动回复敏感评论"},
        {"agent": "snape-audit", "role": "审计", "responsibility": "账号安全、skill 安全、合规边界、异常冻结", "forbidden": "未审查执行外部代码"},
        {"agent": "hermione-tech", "role": "技术", "responsibility": "自动化脚本、配置链路、测试门禁、故障修复", "forbidden": "绕过测试把失败当成功"},
        {"agent": "neville-hr", "role": "人事/组织", "responsibility": "职责覆盖、绩效反馈、能力缺口、协作节奏", "forbidden": "让组织退化成单 Agent"},
    ]


def build_blockers(cdp: dict[str, Any], draft_jobs: dict[str, Any]) -> list[dict[str, str]]:
    blockers: list[dict[str, str]] = []
    if not cdp["ok"]:
        blockers.append(
            {
                "severity": "medium",
                "owner": "jarvis-coo",
                "issue": "发布浏览器 CDP 未连接，无法把内容自动填入平台草稿箱。",
            }
        )
    missing_login = [target["label"] for target in cdp.get("login_targets", []) if not target["open_tab"]]
    if missing_login:
        blockers.append(
            {
                "severity": "medium",
                "owner": "luna-growth",
                "issue": "需要 CEO 打开并登录：" + "、".join(missing_login),
            }
        )
    if any(job.get("blocker") for job in draft_jobs["jobs"]):
        blockers.append(
            {
                "severity": "low",
                "owner": "luna-growth",
                "issue": "抖音/B站视频草稿需要 CEO 先确认视频素材。",
            }
        )
    return blockers


def render_report(payload: dict[str, Any]) -> str:
    lines = [
        "# Jarvis COO 自营运营批次",
        "",
        f"- 运行ID：`{payload['run_id']}`",
        f"- 日期：{payload['run_date']}",
        "- 模式：review_only",
        "- 边界：生成内容、生成草稿任务、生成回复建议；CEO审核后发布；不自动回复评论；不自动登记收入。",
        "- 组织原则：COO 负责调度，不替代员工；每个角色都有职责、产出和指标。",
        "",
        "## 角色职责契约",
        "",
    ]
    for contract in payload["role_contracts"]:
        lines.append(f"- {contract['agent']} / {contract['role']}：{contract['responsibility']}；禁止：{contract['forbidden']}")
    lines.extend([
        "",
        "## 草稿发布队列",
        "",
    ])
    for job in payload["draft_jobs"]["jobs"]:
        lines.append(f"- {job['platform']}：{job['title']}（{job['action']}，CEO审核后发布）")
        if job.get("blocker"):
            lines.append(f"  - 阻塞：{job['blocker']}")
    lines.extend(["", "## 评论/私域队列", ""])
    for item in payload["comment_queue"]:
        lines.append(f"- {item['platform']} / {item['author']} / {item['intent']}：{item['original_text']}")
        lines.append(f"  - 建议回复：{item['reply_suggestion']}")
        if item["is_lead"]:
            lines.append(f"  - 私域动作：{item['private_domain_action']}")
    lines.extend(["", "## COO 动作", ""])
    for action in payload["actions"]:
        lines.append(f"- {action['owner']}：{action['action']}；指标：{action['success_metric']}")
    lines.extend(["", "## 阻塞", ""])
    if payload["blockers"]:
        for blocker in payload["blockers"]:
            lines.append(f"- {blocker['severity']} / {blocker['owner']}：{blocker['issue']}")
    else:
        lines.append("- 无")
    return "\n".join(lines) + "\n"


def run_coo_ops(
    run_date: str | None = None,
    run_id: str | None = None,
    sample_comments: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    date = run_date or dt.date.today().isoformat()
    rid = run_id or f"jarvis-coo-{date.replace('-', '')}"
    out_dir = OUT_ROOT / rid

    assets = build_content_assets(date)
    draft_jobs = build_draft_jobs(date, assets)
    comment_queue = build_comment_queue(sample_comments)
    cdp = inspect_cdp()
    actions = build_actions(draft_jobs, comment_queue, cdp)
    role_contracts = build_role_contracts()
    blockers = build_blockers(cdp, draft_jobs)
    payload: dict[str, Any] = {
        "ok": True,
        "run_id": rid,
        "run_date": date,
        "mode": "review_only",
        "safety": {
            "auto_publish": False,
            "auto_reply": False,
            "book_revenue": False,
            "requires_ceo_review": True,
        },
        "assets": assets,
        "cdp": cdp,
        "draft_jobs": draft_jobs,
        "comment_queue": comment_queue,
        "role_contracts": role_contracts,
        "actions": actions,
        "blockers": blockers,
    }

    draft_path = out_dir / "draft-job.json"
    comment_path = out_dir / "comment-queue.json"
    evidence_path = out_dir / "evidence.json"
    report_path = out_dir / "coo-report.md"
    write_json(draft_path, draft_jobs)
    write_json(comment_path, {"run_id": rid, "comments": comment_queue})
    write_json(evidence_path, payload)
    write_text(report_path, render_report(payload))
    payload["artifacts"] = {
        "draft_job": str(draft_path),
        "comment_queue": str(comment_path),
        "evidence": str(evidence_path),
        "report": str(report_path),
    }
    write_json(evidence_path, payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=None)
    parser.add_argument("--run-id", default=None)
    args = parser.parse_args()
    result = run_coo_ops(run_date=args.date, run_id=args.run_id)
    print(
        json.dumps(
            {
                "ok": result["ok"],
                "run_id": result["run_id"],
                "report": result["artifacts"]["report"],
                "draft_jobs": len(result["draft_jobs"]["jobs"]),
                "comment_queue": len(result["comment_queue"]),
                "blockers": len(result["blockers"]),
                "cdp": result["cdp"]["ok"],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
