from __future__ import annotations

import csv
import datetime as dt
import html
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "output" / "coo_ops"
MONITOR_CSV = ROOT / "output" / "coo_ops" / "7day-xhs-growth-monitor-2026-04-29.csv"
HEALTH_JSON_SOURCE = ROOT / "config" / "unattended-health-guardian.json"
INTEGRATIONS_JSON_SOURCE = ROOT / "config" / "integrations.json"
APP_CONFIG_SOURCE = ROOT / "config" / "app-config.json"
MODEL_ROUTING_SOURCE = ROOT / "config" / "model-routing.json"
OPENCLAW_AGENTS_SOURCE = ROOT / "jarvis-one-company-os" / "config" / "openclaw-agents.json"
MONITOR_EVENTS_SOURCE = ROOT / "output" / "coo_ops" / "xhs-monitor-events-2026-04-29.jsonl"
HR_PLATFORM_PATTERNS_SOURCE = ROOT / "config" / "knowledge" / "platform-ops" / "cross-platform-viral-patterns.json"
REVENUE_GOALS_DIR = ROOT / "output" / "revenue_goals"

OPENCLAW_AGENT_KEYS = {
    "jarvis-coo": "agent_jarvis",
    "hermione-tech": "agent_hermione",
    "mcgonagall-product": "agent_mcgonagall",
    "luna-growth": "agent_luna",
    "fred-sales": "agent_fred",
    "percy-finance": "agent_percy",
    "snape-audit": "agent_snape",
    "dobby-customer": "agent_dobby",
}

WORK_QUEUE = {
    "jarvis-coo": {
        "workstream": "company_ops",
        "next_action": "Run the daily operating loop: content, leads, product, delivery, finance, and audit.",
        "cadence": "daily",
    },
    "luna-growth": {
        "workstream": "content_growth",
        "next_action": "Turn monitored XHS posts into Douyin, Bilibili, and WeChat Official drafts.",
        "cadence": "every content cycle",
    },
    "fred-sales": {
        "workstream": "sales_pipeline",
        "next_action": "Prepare lead intake, diagnosis questions, quote script, and follow-up ledger.",
        "cadence": "daily",
    },
    "mcgonagall-product": {
        "workstream": "productization",
        "next_action": "Package the offer into 99/299/999 service tiers with deliverables and acceptance checks.",
        "cadence": "weekly",
    },
    "hermione-tech": {
        "workstream": "automation",
        "next_action": "Connect read-only metrics for Douyin, Bilibili, WeChat Official, and repair monitor jobs.",
        "cadence": "daily",
    },
    "dobby-customer": {
        "workstream": "customer_success",
        "next_action": "Draft comment and private-message replies only; wait for CEO confirmation before sending.",
        "cadence": "when replies exist",
    },
    "percy-finance": {
        "workstream": "finance",
        "next_action": "Track cost and ROI; record revenue only after payment evidence exists.",
        "cadence": "daily close",
    },
    "snape-audit": {
        "workstream": "audit",
        "next_action": "Check content risk, automation boundaries, task failures, and secret exposure.",
        "cadence": "every release",
    },
    "neville-hr": {
        "workstream": "capability_growth",
        "next_action": "Review whether every Agent has a visible output and a next operating duty.",
        "cadence": "daily",
    },
}


def _read_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return fallback


def _read_monitor_rows(path: Path = MONITOR_CSV) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as fp:
        return list(csv.DictReader(fp))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            rows.append(item)
    return rows


def _to_int(value: Any) -> int:
    try:
        return int(str(value or "0").replace(",", ""))
    except ValueError:
        return 0


def _latest_business_monitor(rows: list[dict[str, str]]) -> dict[str, Any]:
    published = [row for row in rows if row.get("status") == "published"]
    row = published[-1] if published else (rows[-1] if rows else {})
    return {
        "platform": row.get("platform") or "xiaohongshu",
        "post_title": row.get("post_title") or "我给9个AI员工发工资",
        "status": row.get("status") or "unknown",
        "views": _to_int(row.get("views")),
        "likes": _to_int(row.get("likes")),
        "favorites": _to_int(row.get("favorites")),
        "comments": _to_int(row.get("comments")),
        "shares": _to_int(row.get("shares")),
        "private_messages": _to_int(row.get("private_messages")),
        "qualified_leads": _to_int(row.get("qualified_leads")),
        "published_at": row.get("published_at") or "",
        "last_checked_at": row.get("last_checked_at") or "",
        "next_action": row.get("next_action") or "",
    }


def _content_posts(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    posts: list[dict[str, Any]] = []
    for row in rows:
        title = row.get("post_title") or ""
        if not title:
            continue
        status = row.get("status") or "unknown"
        views = _to_int(row.get("views"))
        comments = _to_int(row.get("comments"))
        private_messages = _to_int(row.get("private_messages"))
        qualified_leads = _to_int(row.get("qualified_leads"))
        needs_review = status != "published" or views == 0 or comments > 0 or private_messages > 0
        posts.append(
            {
                "platform": row.get("platform") or "xiaohongshu",
                "post_title": title,
                "post_url": row.get("post_url") or "",
                "status": status,
                "views": views,
                "likes": _to_int(row.get("likes")),
                "favorites": _to_int(row.get("favorites")),
                "comments": comments,
                "shares": _to_int(row.get("shares")),
                "private_messages": private_messages,
                "qualified_leads": qualified_leads,
                "published_at": row.get("published_at") or "",
                "last_checked_at": row.get("last_checked_at") or "",
                "next_action": row.get("next_action") or "按 SOP 进入下一轮监控",
                "owner": row.get("owner") or "",
                "review_status": "needs_review" if needs_review else "tracked",
                "next_topic": _next_topic_for_post(title, status, views),
                "private_domain_action": _private_domain_action(comments, private_messages, qualified_leads),
            }
        )
    return sorted(posts, key=lambda item: (item["last_checked_at"], item["published_at"]), reverse=True)


def _next_topic_for_post(title: str, status: str, views: int) -> str:
    if status != "published":
        return "复盘违规点，重写成经验型内容"
    if views == 0:
        return "先等下一轮数据，再决定是否改标题和封面"
    if views < 100:
        return "优化标题钩子，补一版更具体的结果截图"
    return "拆成短视频脚本和公众号长文"


def _private_domain_action(comments: int, private_messages: int, qualified_leads: int) -> str:
    if qualified_leads > 0:
        return "进入私域诊断和报价跟进"
    if comments > 0 or private_messages > 0:
        return "生成回复建议，人工确认后引导到私域"
    return "保留私域入口，继续观察评论和私信"


def _account_metrics_for(platform_id: str, posts: list[dict[str, Any]]) -> dict[str, int]:
    platform_posts = [item for item in posts if item.get("platform") == platform_id]
    return {
        "views": sum(_to_int(item.get("views")) for item in platform_posts),
        "likes": sum(_to_int(item.get("likes")) for item in platform_posts),
        "favorites": sum(_to_int(item.get("favorites")) for item in platform_posts),
        "comments": sum(_to_int(item.get("comments")) for item in platform_posts),
        "shares": sum(_to_int(item.get("shares")) for item in platform_posts),
        "private_messages": sum(_to_int(item.get("private_messages")) for item in platform_posts),
        "qualified_leads": sum(_to_int(item.get("qualified_leads")) for item in platform_posts),
        "published": sum(1 for item in platform_posts if item.get("status") == "published"),
    }


def _scheduled_snapshot() -> list[dict[str, Any]]:
    try:
        import unattended_health_guardian

        health_config = _read_json(HEALTH_JSON_SOURCE, {"jobs": []})
        names = ["JarvisUnattendedHealthGuardian"]
        for job in health_config.get("jobs", []):
            if not isinstance(job, dict):
                continue
            for task_name in job.get("scheduled_tasks", []):
                if task_name not in names:
                    names.append(task_name)
        return [unattended_health_guardian.get_scheduled_task_info(name) for name in names]
    except Exception as exc:
        return [{"name": "scheduler", "state": "unknown", "result": "failed", "raw": str(exc)}]


def _next_run(tasks: list[dict[str, Any]], name: str) -> str:
    task = next((item for item in tasks if item.get("name") == name), {})
    return str(task.get("next_run_time") or "")


def _parse_time(value: Any) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _task_recovered_by_catchup(task: dict[str, Any], events: list[dict[str, Any]]) -> bool:
    name = str(task.get("name") or "")
    last_run = _parse_time(task.get("last_run_time"))
    if "XhsMonitor" not in name:
        return False
    for event in events:
        event_name = str(event.get("event") or "")
        if "catchup" not in event_name and "scan" not in event_name:
            continue
        event_time = _parse_time(event.get("ts") or event.get("created_at"))
        if last_run is None or event_time is None or event_time >= last_run:
            return True
    return False


def _company_status(tasks: list[dict[str, Any]], monitor: dict[str, Any], events: list[dict[str, Any]] | None = None) -> str:
    events = events or []
    has_unrecovered_failure = any(
        str(task.get("result", "")).startswith("failed") and not _task_recovered_by_catchup(task, events)
        for task in tasks
    )
    if has_unrecovered_failure:
        return "异常"
    if monitor.get("comments", 0) > 0 or monitor.get("private_messages", 0) > 0:
        return "等待审核"
    if monitor.get("views", 0) > 0:
        return "营业中"
    return "监控中"


def _platform_template(
    platform_id: str,
    name: str,
    enabled: bool,
    account_name: str,
    connection_status: str,
    data_source: str,
    next_action: str,
) -> dict[str, Any]:
    return {
        "id": platform_id,
        "name": name,
        "enabled": enabled,
        "account_name": account_name,
        "connection_status": connection_status,
        "data_source": data_source,
        "views": 0,
        "likes": 0,
        "favorites": 0,
        "comments": 0,
        "shares": 0,
        "private_messages": 0,
        "qualified_leads": 0,
        "drafts": 0,
        "published": 0,
        "risk": "needs_connection" if enabled and data_source == "pending_connection" else "normal",
        "last_sync": "",
        "next_check": "",
        "next_action": next_action,
    }


def _build_platforms(config: dict[str, Any], monitor: dict[str, Any], tasks: list[dict[str, Any]], posts: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    social = config.get("social_media", {}) if isinstance(config.get("social_media"), dict) else {}
    outreach = config.get("outreach", {}) if isinstance(config.get("outreach"), dict) else {}
    posts = posts or []
    xhs_account_metrics = _account_metrics_for("xiaohongshu", posts)

    xhs_cfg = social.get("xiaohongshu", {}) if isinstance(social.get("xiaohongshu"), dict) else {}
    xhs = _platform_template(
        "xiaohongshu",
        "小红书",
        bool(xhs_cfg.get("enabled", True)),
        str(xhs_cfg.get("account_name") or xhs_cfg.get("account_id") or ""),
        "connected" if monitor.get("views", 0) > 0 or monitor.get("last_checked_at") else "pending_connection",
        "synced" if monitor.get("views", 0) > 0 or monitor.get("last_checked_at") else "pending_connection",
        monitor.get("next_action") or "按 SOP 进入下一轮监控",
    )
    xhs.update(
        {
            "views": xhs_account_metrics["views"] or monitor["views"],
            "likes": xhs_account_metrics["likes"] or monitor["likes"],
            "favorites": xhs_account_metrics["favorites"] or monitor["favorites"],
            "comments": xhs_account_metrics["comments"] or monitor["comments"],
            "shares": xhs_account_metrics["shares"] or monitor["shares"],
            "private_messages": xhs_account_metrics["private_messages"] or monitor["private_messages"],
            "qualified_leads": xhs_account_metrics["qualified_leads"] or monitor["qualified_leads"],
            "published": xhs_account_metrics["published"] or (1 if monitor.get("status") == "published" else 0),
            "risk": "normal" if monitor.get("status") == "published" else "review",
            "last_sync": monitor.get("last_checked_at", ""),
            "next_check": _next_run(tasks, "JarvisXhsMonitor-T8h"),
        }
    )

    douyin_cfg = social.get("douyin", {}) if isinstance(social.get("douyin"), dict) else {}
    bilibili_cfg = social.get("bilibili", {}) if isinstance(social.get("bilibili"), dict) else {}
    official_cfg = social.get("wechat_official", {}) if isinstance(social.get("wechat_official"), dict) else {}
    personal_cfg = outreach.get("wechat_personal", {}) if isinstance(outreach.get("wechat_personal"), dict) else {}

    return [
        xhs,
        _platform_template(
            "douyin",
            "抖音",
            bool(douyin_cfg.get("enabled", False)),
            str(douyin_cfg.get("account_name") or douyin_cfg.get("account_id") or ""),
            "pending_connection",
            "pending_connection",
            "接入只读数据采集，再开放草稿投放",
        ),
        _platform_template(
            "bilibili",
            "B站",
            bool(bilibili_cfg.get("enabled", False)),
            str(bilibili_cfg.get("account_name") or bilibili_cfg.get("uid") or ""),
            "pending_connection",
            "pending_connection",
            "建立视频稿件草稿箱和数据回填",
        ),
        _platform_template(
            "wechat_official",
            "公众号",
            bool(official_cfg.get("enabled", False)),
            str(official_cfg.get("account_name") or official_cfg.get("gh_id") or ""),
            "pending_connection",
            "pending_connection",
            "接入草稿箱和人工发布后的数据回填",
        ),
        _platform_template(
            "wechat_personal",
            "微信私域",
            bool(personal_cfg.get("enabled", False)),
            str(personal_cfg.get("wechat_id") or ""),
            "manual_confirm_first",
            "manual",
            "用人工确认方式承接评论和私信线索",
        ),
    ]


def _company_metrics(platforms: list[dict[str, Any]]) -> dict[str, int]:
    total_views = sum(_to_int(item.get("views")) for item in platforms)
    total_likes = sum(_to_int(item.get("likes")) for item in platforms)
    total_favorites = sum(_to_int(item.get("favorites")) for item in platforms)
    total_comments = sum(_to_int(item.get("comments")) for item in platforms)
    total_shares = sum(_to_int(item.get("shares")) for item in platforms)
    total_private = sum(_to_int(item.get("private_messages")) for item in platforms)
    qualified_leads = sum(_to_int(item.get("qualified_leads")) for item in platforms)
    return {
        "total_views": total_views,
        "total_interactions": total_likes + total_favorites + total_comments + total_shares,
        "public_comments": total_comments,
        "private_messages": total_private,
        "qualified_leads": qualified_leads,
        "pending_replies": total_comments + total_private,
        "active_platforms": sum(1 for item in platforms if item.get("enabled")),
        "connected_platforms": sum(1 for item in platforms if item.get("data_source") == "synced"),
    }


def _campaigns(monitor: dict[str, Any], posts: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    posts = posts or []
    assets_published = sum(1 for item in posts if item.get("status") == "published")
    total_views = sum(_to_int(item.get("views")) for item in posts)
    qualified_leads = sum(_to_int(item.get("qualified_leads")) for item in posts)
    return [
        {
            "id": "ai_salary_sheet",
            "name": "AI员工工资单曝光",
            "stage": "monitor",
            "owner": "luna-growth",
            "platforms": ["xiaohongshu", "douyin", "bilibili", "wechat_official", "wechat_personal"],
            "assets_ready": max(len(posts), 1),
            "assets_published": assets_published or (1 if monitor.get("status") == "published" else 0),
            "total_views": total_views or monitor.get("views", 0),
            "qualified_leads": qualified_leads or monitor.get("qualified_leads", 0),
            "next_action": "把同一选题改造成短视频、公众号长文和私域承接话术",
        },
        {
            "id": "one_company_live_log",
            "name": "一人公司实战日志",
            "stage": "planning",
            "owner": "jarvis-coo",
            "platforms": ["xiaohongshu", "douyin", "bilibili"],
            "assets_ready": 0,
            "assets_published": 0,
            "total_views": 0,
            "qualified_leads": 0,
            "next_action": "沉淀审核失败、调整、再发布的真实过程",
        },
    ]


def _lead_funnel(metrics: dict[str, int]) -> dict[str, Any]:
    return {
        "stages": [
            {"id": "exposure", "name": "曝光", "count": metrics["total_views"]},
            {"id": "engagement", "name": "互动", "count": metrics["total_interactions"]},
            {"id": "public_inquiry", "name": "评论咨询", "count": metrics["public_comments"]},
            {"id": "private_inquiry", "name": "私信/微信", "count": metrics["private_messages"]},
            {"id": "qualified_lead", "name": "有效线索", "count": metrics["qualified_leads"]},
            {"id": "quote", "name": "报价", "count": 0},
            {"id": "paid", "name": "收款", "count": 0},
            {"id": "delivery", "name": "交付", "count": 0},
        ],
        "next_action": "先把评论、私信、微信咨询统一登记为线索，再进入诊断和报价",
    }


def _agent_ops(platforms: list[dict[str, Any]], metrics: dict[str, int]) -> list[dict[str, Any]]:
    pending_connections = sum(1 for item in platforms if item.get("data_source") == "pending_connection")
    return [
        {"agent_id": "jarvis-coo", "name": "贾维斯 COO", "role": "调度", "status": "running", "current_task": "跨平台运营巡检", "last_action": "汇总运行状态", "blocker": "", "next_action": "推动各角色补齐下一步动作", "needs_ceo_review": False},
        {"agent_id": "luna-growth", "name": "卢娜 CMO", "role": "内容增长", "status": "running", "current_task": "内容战役复盘与扩写", "last_action": "监控小红书内容", "blocker": "", "next_action": "把工资单选题改造成短视频/长文", "needs_ceo_review": True},
        {"agent_id": "fred-sales", "name": "弗雷德 CSO", "role": "销售", "status": "waiting", "current_task": "线索承接", "last_action": f"当前有效线索 {metrics['qualified_leads']}", "blocker": "还没有有效咨询", "next_action": "准备诊断问卷和报价话术", "needs_ceo_review": False},
        {"agent_id": "dobby-customer", "name": "多比 CRO", "role": "客户成功", "status": "waiting", "current_task": "评论/私信回复建议", "last_action": f"待回复 {metrics['pending_replies']}", "blocker": "自动评论和私信关闭", "next_action": "只生成回复建议，等待人工确认", "needs_ceo_review": True},
        {"agent_id": "percy-finance", "name": "珀西 CFO", "role": "财务", "status": "guarding", "current_task": "收入确认", "last_action": "无收款不登记收入", "blocker": "", "next_action": "等待真实收款凭证", "needs_ceo_review": False},
        {"agent_id": "snape-audit", "name": "斯内普 CAO", "role": "审计", "status": "guarding", "current_task": "平台合规和风控", "last_action": "自动发布/评论/私信保持关闭", "blocker": "", "next_action": "审查下一批内容是否有诱导互动风险", "needs_ceo_review": False},
        {"agent_id": "hermione-tech", "name": "赫敏 CTO", "role": "自动化", "status": "blocked" if pending_connections else "running", "current_task": "多平台只读监控接入", "last_action": f"{pending_connections} 个平台待接入", "blocker": "缺少平台数据采集器或登录态" if pending_connections else "", "next_action": "优先接入抖音/B站/公众号只读数据", "needs_ceo_review": False},
        {"agent_id": "mcgonagall-product", "name": "麦格 产品", "role": "产品化", "status": "running", "current_task": "服务包设计", "last_action": "把线索承接为诊断服务", "blocker": "", "next_action": "定义首个可交付产品包", "needs_ceo_review": True},
        {"agent_id": "neville-hr", "name": "纳威 HR", "role": "能力成长", "status": "running", "current_task": "角色能力评估", "last_action": "记录内容审核失败经验", "blocker": "", "next_action": "给内容/销售/客服角色补课", "needs_ceo_review": False},
    ]


def _model_health(app_config: dict[str, Any], routing: dict[str, Any]) -> dict[str, Any]:
    llm = app_config.get("llm", {}) if isinstance(app_config.get("llm"), dict) else {}
    providers = llm.get("providers", []) if isinstance(llm.get("providers"), list) else []
    models: list[dict[str, Any]] = []
    enabled_providers = []
    for provider in providers:
        if not isinstance(provider, dict):
            continue
        if provider.get("enabled"):
            enabled_providers.append(provider)
        provider_id = str(provider.get("id") or "")
        provider_models = provider.get("models", []) if isinstance(provider.get("models"), list) else []
        for model in provider_models:
            if not isinstance(model, dict):
                continue
            models.append(
                {
                    "id": model.get("id") or model.get("name") or "",
                    "name": model.get("name") or model.get("id") or "",
                    "alias": model.get("alias") or "",
                    "provider": provider_id,
                    "status": "configured" if provider.get("enabled") else "disabled",
                }
            )
    default_provider = str(llm.get("default_provider") or "")
    default_model = str(llm.get("default_model") or "")
    if enabled_providers and models and default_provider and default_model:
        status = "ready"
    elif enabled_providers or models:
        status = "degraded"
    else:
        status = "not_configured"
    return {
        "status": status,
        "default_provider": default_provider,
        "default_model": default_model,
        "enabled_providers": [provider.get("id") for provider in enabled_providers],
        "fallback_chains": llm.get("fallback_chains", {}),
        "routing_tiers": routing.get("agent_default_tiers", {}),
        "models": models,
    }


def _agent_roster(app_config: dict[str, Any], openclaw_config: dict[str, Any]) -> list[dict[str, Any]]:
    openclaw_agents = openclaw_config.get("agents", {}) if isinstance(openclaw_config.get("agents"), dict) else {}
    agents = app_config.get("agents", []) if isinstance(app_config.get("agents"), list) else []
    roster: list[dict[str, Any]] = []
    for agent in agents:
        if not isinstance(agent, dict) or not agent.get("enabled", True):
            continue
        agent_id = str(agent.get("id") or "")
        skills_file = str(agent.get("skills_file") or "")
        skills_exists = bool(skills_file and (ROOT / skills_file).exists())
        openclaw_key = OPENCLAW_AGENT_KEYS.get(agent_id, "")
        openclaw_status = "mapped" if openclaw_key and openclaw_key in openclaw_agents else "skills_only"
        capabilities = agent.get("capabilities", []) if isinstance(agent.get("capabilities"), list) else []
        roster.append(
            {
                "agent_id": agent_id,
                "name": agent.get("display_name") or agent_id,
                "role": agent.get("role") or "",
                "role_label": agent.get("role_label") or "",
                "responsibility": ", ".join(str(item) for item in capabilities) or str(agent.get("role_label") or agent_id),
                "model_tier": agent.get("model_tier") or "",
                "task_types": agent.get("task_types", []),
                "skill_status": "online" if skills_exists else "needs_skill_file",
                "openclaw_status": openclaw_status,
                "status": "online" if skills_exists else "offline",
            }
        )
    return roster


def _hr_learning_assets() -> list[dict[str, Any]]:
    patterns = _read_json(HR_PLATFORM_PATTERNS_SOURCE, {})
    pattern_items = patterns.get("patterns", []) if isinstance(patterns.get("patterns"), list) else []
    platforms = sorted({str(item.get("platform") or "") for item in pattern_items if isinstance(item, dict) and item.get("platform")})
    latest_kits = sorted((ROOT / "output" / "hr" / "materials").glob("*-hr-learning-content-kit.md"), reverse=True)
    latest_tasks = sorted((ROOT / "output" / "hr" / "materials").glob("*-hr-learning-agent-tasks.json"), reverse=True)
    if not platforms and not latest_kits and not latest_tasks:
        return []
    return [
        {
            "id": "neville_cross_platform_viral_learning",
            "owner": "neville-hr",
            "title": "HR cross-platform viral learning",
            "platforms": platforms,
            "patterns_count": len(pattern_items),
            "knowledge_path": str(HR_PLATFORM_PATTERNS_SOURCE.relative_to(ROOT)) if HR_PLATFORM_PATTERNS_SOURCE.exists() else "",
            "content_kit_path": str(latest_kits[0].relative_to(ROOT)) if latest_kits else "",
            "agent_tasks_path": str(latest_tasks[0].relative_to(ROOT)) if latest_tasks else "",
            "next_action": "Use the learning kit to produce Douyin script, Bilibili outline, and WeChat Official article draft for CEO review.",
        }
    ]


def _latest_revenue_goal() -> dict[str, Any]:
    inactive = {
        "active": False,
        "run_id": "",
        "mode": "",
        "target_cny": 0,
        "days": 0,
        "booked_real_revenue": 0,
        "current_gap_cny": 0,
        "selected_project": "",
        "selected_project_id": "",
        "selected_score": 0,
        "internal_executed_count": 0,
        "approval_gated_count": 0,
        "department_action_count": 0,
        "approval_queue_count": 0,
        "artifacts": {},
        "next_action": "Run the autonomous revenue loop to create project candidates, assignments, and approval queue.",
    }
    if not REVENUE_GOALS_DIR.exists():
        return inactive
    evidence_files = sorted(
        (path for path in REVENUE_GOALS_DIR.glob("*/evidence.json") if not path.parent.name.startswith("test-")),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not evidence_files:
        return inactive

    evidence = _read_json(evidence_files[0], {})
    selected = evidence.get("selected_project", {})
    if not isinstance(selected, dict):
        selected = {}
    artifacts = evidence.get("artifacts", {})
    if not isinstance(artifacts, dict):
        artifacts = {}
    department_actions = evidence.get("department_actions", [])
    approval_queue = evidence.get("approval_queue", [])
    internal_execution = evidence.get("internal_execution", {})
    if not isinstance(internal_execution, dict):
        internal_execution = {}

    active = bool(evidence.get("ok"))
    selected_name = str(selected.get("name") or selected.get("id") or "")
    return {
        "active": active,
        "run_id": str(evidence.get("run_id") or evidence_files[0].parent.name),
        "mode": str(evidence.get("mode") or ""),
        "target_cny": _to_int(evidence.get("target_cny")),
        "days": _to_int(evidence.get("days")),
        "booked_real_revenue": _to_int(evidence.get("booked_real_revenue")),
        "current_gap_cny": _to_int(evidence.get("current_gap_cny")),
        "selected_project": selected_name,
        "selected_project_id": str(selected.get("id") or ""),
        "selected_score": selected.get("score", 0),
        "internal_executed_count": _to_int(internal_execution.get("executed_count")),
        "approval_gated_count": _to_int(internal_execution.get("approval_gated_count")),
        "department_action_count": len(department_actions) if isinstance(department_actions, list) else 0,
        "approval_queue_count": len(approval_queue) if isinstance(approval_queue, list) else 0,
        "artifacts": artifacts,
        "next_action": "Review approval queue, then let agents execute content, outreach, offer, finance, and audit work." if active else inactive["next_action"],
    }


def _company_work_queue(agent_roster: list[dict[str, Any]], metrics: dict[str, int], posts: list[dict[str, Any]], hr_assets: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    post_count = len(posts)
    pending_replies = metrics.get("pending_replies", 0)
    connected = metrics.get("connected_platforms", 0)
    active = metrics.get("active_platforms", 0)
    hr_asset_count = len(hr_assets or [])
    by_agent = {agent["agent_id"]: agent for agent in agent_roster}
    queue: list[dict[str, Any]] = []
    for owner, plan in WORK_QUEUE.items():
        agent = by_agent.get(owner, {})
        if owner == "dobby-customer":
            status = "waiting_ceo" if pending_replies else "standby"
            evidence = f"{pending_replies} pending replies"
        elif owner == "hermione-tech":
            status = "running" if connected < active else "ready"
            evidence = f"{connected}/{active} connected platforms"
        elif owner == "luna-growth":
            status = "running" if post_count else "waiting_source"
            evidence = f"{post_count} tracked content posts"
        elif owner == "fred-sales":
            status = "running"
            evidence = f"{metrics.get('qualified_leads', 0)} qualified leads"
        elif owner == "neville-hr":
            status = "running" if hr_asset_count else "waiting_source"
            evidence = f"{hr_asset_count} HR learning assets"
        else:
            status = "running"
            evidence = str(agent.get("skill_status") or "configured")
        queue.append(
            {
                "owner": owner,
                "name": agent.get("name") or owner,
                "role": agent.get("role") or "",
                "workstream": plan["workstream"],
                "status": status,
                "next_action": plan["next_action"],
                "evidence": evidence,
                "cadence": plan["cadence"],
            }
        )
    return queue


def _risk_alerts(platforms: list[dict[str, Any]], metrics: dict[str, int], safety: dict[str, Any]) -> list[dict[str, str]]:
    alerts: list[dict[str, str]] = []
    pending = [item["name"] for item in platforms if item.get("data_source") == "pending_connection" and item.get("enabled")]
    if pending:
        alerts.append({"level": "warning", "title": "多平台监控未接通", "detail": "、".join(pending) + " 仍需接入只读数据源", "owner": "hermione-tech"})
    if metrics["qualified_leads"] == 0:
        alerts.append({"level": "info", "title": "还没有有效线索", "detail": "当前应优先优化内容选题、评论承接和私域入口", "owner": "fred-sales"})
    if not safety.get("allow_publish", False):
        alerts.append({"level": "normal", "title": "自动发布关闭", "detail": "当前只允许草稿和只读监控，发布仍由 CEO 审核", "owner": "snape-audit"})
    return alerts


def _office(agent_ops: list[dict[str, Any]]) -> dict[str, Any]:
    zone_by_agent = {
        "jarvis-coo": "command",
        "luna-growth": "growth",
        "fred-sales": "sales",
        "dobby-customer": "customer",
        "percy-finance": "finance",
        "snape-audit": "audit",
        "hermione-tech": "automation",
        "mcgonagall-product": "product",
        "neville-hr": "learning",
    }
    desk_by_agent = {
        "jarvis-coo": "总调度台",
        "luna-growth": "内容运营桌",
        "fred-sales": "销售线索桌",
        "dobby-customer": "客户沟通桌",
        "percy-finance": "财务收款桌",
        "snape-audit": "合规审计桌",
        "hermione-tech": "自动化接入桌",
        "mcgonagall-product": "产品货架桌",
        "neville-hr": "复盘成长桌",
    }
    zones = [
        {"id": "command", "name": "总调度区", "purpose": "经营节奏、任务调度、异常升级", "status": "running", "owner_agents": ["jarvis-coo"]},
        {"id": "growth", "name": "内容增长区", "purpose": "选题、草稿、发布复盘、平台数据", "status": "running", "owner_agents": ["luna-growth"]},
        {"id": "sales", "name": "线索成交区", "purpose": "线索台账、诊断、报价、跟进", "status": "waiting", "owner_agents": ["fred-sales", "dobby-customer"]},
        {"id": "delivery", "name": "产品交付区", "purpose": "服务包、交付记录、客诉闭环", "status": "building", "owner_agents": ["mcgonagall-product", "dobby-customer"]},
        {"id": "guard", "name": "财务风控区", "purpose": "收款确认、成本、审计、合规", "status": "guarding", "owner_agents": ["percy-finance", "snape-audit"]},
        {"id": "automation", "name": "自动化机房", "purpose": "平台接入、监控任务、防卡死", "status": "blocked", "owner_agents": ["hermione-tech"]},
        {"id": "learning", "name": "复盘训练区", "purpose": "能力评估、失败复盘、角色补课", "status": "running", "owner_agents": ["neville-hr"]},
    ]
    workstations = []
    for agent in agent_ops:
        agent_id = str(agent.get("agent_id", ""))
        workstations.append(
            {
                "agent_id": agent_id,
                "agent_name": agent.get("name", agent_id),
                "zone_id": zone_by_agent.get(agent_id, "command"),
                "desk_name": desk_by_agent.get(agent_id, "临时工位"),
                "status": agent.get("status", "unknown"),
                "current_task": agent.get("current_task", ""),
                "last_action": agent.get("last_action", ""),
                "next_action": agent.get("next_action", ""),
                "blocker": agent.get("blocker", ""),
                "needs_ceo_review": bool(agent.get("needs_ceo_review")),
            }
        )
    return {
        "zones": zones,
        "workstations": workstations,
        "daily_rhythm": [
            {"time": "09:30", "name": "晨会调度", "owner": "jarvis-coo", "output": "当日作战计划、卡点列表、CEO 审批项"},
            {"time": "13:30", "name": "平台巡检", "owner": "luna-growth", "output": "内容数据、评论私信、平台异常"},
            {"time": "17:30", "name": "线索复盘", "owner": "fred-sales", "output": "线索台账、报价机会、明日跟进"},
            {"time": "21:30", "name": "审计复盘", "owner": "snape-audit", "output": "风险告警、收入确认、失败教训"},
        ],
    }


def _enablement_points(platforms: list[dict[str, Any]], metrics: dict[str, int], campaigns: list[dict[str, Any]]) -> list[dict[str, str]]:
    connected = sum(1 for item in platforms if item.get("data_source") == "synced")
    active = sum(1 for item in platforms if item.get("enabled"))
    published_assets = sum(_to_int(item.get("assets_published")) for item in campaigns)
    return [
        {
            "id": "platform_onboarding",
            "name": "平台接入优先级",
            "status": "in_progress" if connected < active else "running",
            "owner": "hermione-tech",
            "next_action": "优先接入抖音、B站、公众号只读监控，再开放草稿投放",
            "evidence": f"{connected}/{active} 平台接通",
        },
        {
            "id": "lead_ledger",
            "name": "线索台账",
            "status": "empty" if metrics["qualified_leads"] == 0 else "running",
            "owner": "fred-sales",
            "next_action": "把评论、私信、微信咨询统一登记为线索，区分有效/无效/待跟进",
            "evidence": f"{metrics['qualified_leads']} 条有效线索",
        },
        {
            "id": "content_review",
            "name": "内容复盘机制",
            "status": "running" if published_assets > 0 else "planning",
            "owner": "luna-growth",
            "next_action": "每条内容记录审核、流量、问题、下一版动作，沉淀平台规则",
            "evidence": f"{published_assets} 个已发布内容资产",
        },
        {
            "id": "product_shelf",
            "name": "产品货架",
            "status": "building",
            "owner": "mcgonagall-product",
            "next_action": "建立 99 诊断、299 陪跑、999 一人公司部署三档可售服务",
            "evidence": "服务包需要进入可售态",
        },
        {
            "id": "agent_daily_report",
            "name": "Agent 日报",
            "status": "building",
            "owner": "jarvis-coo",
            "next_action": "每个角色每天输出做了什么、卡在哪里、明天做什么",
            "evidence": "办公室工位已具象化",
        },
        {
            "id": "complaint_handling",
            "name": "客诉机制",
            "status": "planning",
            "owner": "dobby-customer",
            "next_action": "客户问题进 CRO，严重问题进 CAO，退款/收款进 CFO",
            "evidence": "暂无真实客诉，先建立流程",
        },
    ]


def _action_state(agent: dict[str, Any]) -> str:
    status = str(agent.get("status", ""))
    task = str(agent.get("current_task", ""))
    if status == "blocked":
        return "blocked"
    if agent.get("needs_ceo_review"):
        return "waiting_approval"
    if "内容" in task or "选题" in task:
        return "writing"
    if "线索" in task or "销售" in task:
        return "lead_following"
    if "收入" in task or "财务" in task:
        return "accounting"
    if "审计" in task or "合规" in task:
        return "guarding"
    if "接入" in task or "监控" in task:
        return "syncing"
    if "复盘" in task or "评估" in task:
        return "learning"
    return "coordinating" if agent.get("agent_id") == "jarvis-coo" else "working"


def _magic_room_for(agent_id: str, action: str) -> str:
    if action == "waiting_approval":
        return "ceo_gate"
    if action == "blocked":
        return "ward_room"
    mapping = {
        "jarvis-coo": "command_hall",
        "luna-growth": "crystal_studio",
        "fred-sales": "owl_station",
        "dobby-customer": "client_lounge",
        "percy-finance": "gold_vault",
        "snape-audit": "ward_room",
        "hermione-tech": "spell_library",
        "mcgonagall-product": "alchemy_bench",
        "neville-hr": "training_room",
    }
    return mapping.get(agent_id, "command_hall")


def _magic_office(agent_ops: list[dict[str, Any]]) -> dict[str, Any]:
    rooms = [
        {"id": "command_hall", "name": "星图作战大厅", "purpose": "COO 调度全局经营节奏", "x": 42, "y": 36, "width": 190, "height": 132, "accent": "#38bdf8"},
        {"id": "spell_library", "name": "咒文图书馆", "purpose": "技术接入、资料检索、自动化修复", "x": 260, "y": 32, "width": 206, "height": 132, "accent": "#a78bfa"},
        {"id": "crystal_studio", "name": "水晶内容工坊", "purpose": "选题、草稿、发布复盘", "x": 496, "y": 36, "width": 206, "height": 132, "accent": "#22c55e"},
        {"id": "owl_station", "name": "猫头鹰线索驿站", "purpose": "线索、报价、跟进、私域承接", "x": 42, "y": 206, "width": 206, "height": 132, "accent": "#f59e0b"},
        {"id": "client_lounge", "name": "客户会客厅", "purpose": "评论、私信、客诉、客户成功", "x": 282, "y": 208, "width": 190, "height": 132, "accent": "#ec4899"},
        {"id": "gold_vault", "name": "金库账房", "purpose": "收款确认、成本、收入流水", "x": 504, "y": 210, "width": 190, "height": 132, "accent": "#eab308"},
        {"id": "ward_room", "name": "防御审计室", "purpose": "合规、风险、异常和卡点修复", "x": 42, "y": 374, "width": 206, "height": 132, "accent": "#ef4444"},
        {"id": "alchemy_bench", "name": "产品炼金台", "purpose": "服务包、交付模板、产品货架", "x": 282, "y": 374, "width": 190, "height": 132, "accent": "#14b8a6"},
        {"id": "training_room", "name": "复盘训练室", "purpose": "角色补课、能力评估、失败复盘", "x": 504, "y": 374, "width": 190, "height": 132, "accent": "#84cc16"},
        {"id": "ceo_gate", "name": "CEO 审批门厅", "purpose": "等待人工确认和关键授权", "x": 732, "y": 206, "width": 170, "height": 132, "accent": "#60a5fa"},
    ]
    room_by_id = {room["id"]: room for room in rooms}
    avatar_styles = {
        "jarvis-coo": "arcane_coo",
        "luna-growth": "moonlit_creator",
        "fred-sales": "owl_merchant",
        "dobby-customer": "service_sprite",
        "percy-finance": "vault_keeper",
        "snape-audit": "ward_auditor",
        "hermione-tech": "spell_engineer",
        "mcgonagall-product": "alchemy_product",
        "neville-hr": "training_keeper",
    }
    display_names = {
        "jarvis-coo": "贾维斯",
        "luna-growth": "卢娜",
        "fred-sales": "弗雷德",
        "dobby-customer": "多比",
        "percy-finance": "珀西",
        "snape-audit": "斯内普",
        "hermione-tech": "赫敏",
        "mcgonagall-product": "麦格",
        "neville-hr": "纳威",
    }
    characters = []
    for index, agent in enumerate(agent_ops):
        agent_id = str(agent.get("agent_id", ""))
        action = _action_state(agent)
        target_room_id = _magic_room_for(agent_id, action)
        room = room_by_id[target_room_id]
        offset_x = 24 + (index % 3) * 42
        offset_y = 62 + (index % 2) * 38
        speech = str(agent.get("blocker") or agent.get("next_action") or agent.get("current_task") or "继续办公")
        characters.append(
            {
                "agent_id": agent_id,
                "display_name": display_names.get(agent_id, str(agent.get("name", agent_id)).split(" ")[0]),
                "avatar_style": avatar_styles.get(agent_id, "arcane_worker"),
                "room_id": target_room_id,
                "target_room_id": target_room_id,
                "x": int(room["x"]) + offset_x,
                "y": int(room["y"]) + offset_y,
                "action_state": action,
                "speech": speech[:46],
                "current_task": agent.get("current_task", ""),
                "last_action": agent.get("last_action", ""),
                "needs_ceo_review": bool(agent.get("needs_ceo_review")),
            }
        )
    return {
        "theme": "original_magic_company",
        "commercial_safe_note": "原创魔法公司视觉，不使用受版权保护的人物形象、学院徽章或官方场景。",
        "rooms": rooms,
        "characters": characters,
        "activity_log": [
            {"time": "09:30", "agent": "贾维斯", "action": "在星图作战大厅发起晨会调度"},
            {"time": "13:30", "agent": "卢娜", "action": "在水晶内容工坊复盘平台内容"},
            {"time": "17:30", "agent": "弗雷德", "action": "在猫头鹰线索驿站检查线索台账"},
            {"time": "21:30", "agent": "斯内普", "action": "在防御审计室检查风险边界"},
        ],
    }


def build_runtime_status(scheduled_tasks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    health_config = _read_json(HEALTH_JSON_SOURCE, {"mode": "watchdog_readonly", "safety": {}})
    integrations = _read_json(INTEGRATIONS_JSON_SOURCE, {})
    app_config = _read_json(APP_CONFIG_SOURCE, {})
    model_routing = _read_json(MODEL_ROUTING_SOURCE, {})
    openclaw_config = _read_json(OPENCLAW_AGENTS_SOURCE, {})
    monitor_events = _read_jsonl(MONITOR_EVENTS_SOURCE)
    rows = _read_monitor_rows()
    monitor = _latest_business_monitor(rows)
    content_posts = _content_posts(rows)
    tasks = scheduled_tasks if scheduled_tasks is not None else _scheduled_snapshot()
    guardian_task = next((task for task in tasks if task.get("name") == "JarvisUnattendedHealthGuardian"), {})
    platforms = _build_platforms(integrations, monitor, tasks, content_posts)
    metrics = _company_metrics(platforms)
    safety = health_config.get("safety", {})
    campaigns = _campaigns(monitor, content_posts)
    lead_funnel = _lead_funnel(metrics)
    agent_ops = _agent_ops(platforms, metrics)
    office = _office(agent_ops)
    magic_office = _magic_office(agent_ops)
    enablement_points = _enablement_points(platforms, metrics, campaigns)
    model_health = _model_health(app_config, model_routing)
    agent_roster = _agent_roster(app_config, openclaw_config)
    hr_learning_assets = _hr_learning_assets()
    revenue_goal = _latest_revenue_goal()
    company_work_queue = _company_work_queue(agent_roster, metrics, content_posts, hr_learning_assets)

    next_actions = []
    seen_next_actions: set[str] = set()
    for task in tasks:
        if task.get("next_run_time"):
            action = f"{task['name']} 下一次运行：{task['next_run_time']}"
            if action not in seen_next_actions:
                next_actions.append(action)
                seen_next_actions.add(action)
    if monitor.get("next_action"):
        action = monitor["next_action"]
        if action not in seen_next_actions:
            next_actions.insert(0, action)
            seen_next_actions.add(action)
    if not next_actions:
        next_actions.append("等待下一轮健康守护检查")

    last_action = "健康守护检查完成"
    if monitor.get("last_checked_at"):
        last_action = f"最近业务监控：{monitor['last_checked_at']}"

    return {
        "generated_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "company_status": _company_status(tasks, monitor, monitor_events),
        "last_action": last_action,
        "next_actions": next_actions,
        "company_metrics": metrics,
        "business_monitor": monitor,
        "content_posts": content_posts,
        "platforms": platforms,
        "campaigns": campaigns,
        "lead_funnel": lead_funnel,
        "agent_ops": agent_ops,
        "model_health": model_health,
        "agent_roster": agent_roster,
        "company_work_queue": company_work_queue,
        "hr_learning_assets": hr_learning_assets,
        "revenue_goal": revenue_goal,
        "office": office,
        "magic_office": magic_office,
        "enablement_points": enablement_points,
        "risk_alerts": _risk_alerts(platforms, metrics, safety),
        "scheduled_tasks": tasks,
        "guardian": {
            "state": guardian_task.get("state", "unknown"),
            "last_result": guardian_task.get("result_code", guardian_task.get("result", "unknown")),
            "mode": health_config.get("mode", "watchdog_readonly"),
            "runtime_seconds": _read_latest_runtime_seconds(),
        },
        "safety": safety,
        "artifacts": {
            "health_report": "output/coo_ops/unattended-health-latest.md",
            "monitor_csv": "output/coo_ops/7day-xhs-growth-monitor-2026-04-29.csv",
            "reply_suggestions": "output/coo_ops/reply-suggestions-2026-04-29.md",
        },
    }


def _read_latest_runtime_seconds() -> float | None:
    db_path = ROOT / "jarvis-one-company-os" / "dev.db"
    if not db_path.exists():
        return None
    try:
        import sqlite3

        con = sqlite3.connect(db_path)
        raw = con.execute("select detailJson from task_logs where id='task_log_unattended_guardian_latest'").fetchone()
        con.close()
        if not raw:
            return None
        return json.loads(raw[0]).get("runtime_seconds")
    except Exception:
        return None


def render_markdown(status: dict[str, Any]) -> str:
    metrics = status["company_metrics"]
    lines = [
        "# 一人公司运行状态",
        "",
        f"生成时间：{status['generated_at']}",
        f"公司状态：{status['company_status']}",
        f"最近动作：{status['last_action']}",
        "",
        "## 公司总览",
        f"- 总曝光：{metrics['total_views']}",
        f"- 总互动：{metrics['total_interactions']}",
        f"- 有效线索：{metrics['qualified_leads']}",
        f"- 待回复：{metrics['pending_replies']}",
        "",
        "## 平台矩阵",
    ]
    for platform in status["platforms"]:
        lines.append(
            f"- {platform['name']}：{platform['connection_status']} / {platform['data_source']} / "
            f"{platform['views']} 曝光 / {platform['qualified_leads']} 线索 / 下一步：{platform['next_action']}"
        )

    lines.extend(["", "## 内容战役"])
    for campaign in status["campaigns"]:
        lines.append(f"- {campaign['name']}：{campaign['stage']} / {campaign['total_views']} 曝光 / 下一步：{campaign['next_action']}")

    lines.extend(["", "## 线索漏斗"])
    for stage in status["lead_funnel"]["stages"]:
        lines.append(f"- {stage['name']}：{stage['count']}")

    lines.extend(["", "## Agent 作战室"])
    for agent in status["agent_ops"]:
        lines.append(f"- {agent['name']}：{agent['status']} / {agent['current_task']} / 下一步：{agent['next_action']}")

    lines.extend(["", "## 一人公司办公室"])
    for zone in status["office"]["zones"]:
        lines.append(f"- {zone['name']}：{zone['purpose']} / {zone['status']}")

    lines.extend(["", "## 魔法办公室"])
    lines.append(f"- 主题：{status['magic_office']['theme']}")
    for room in status["magic_office"]["rooms"]:
        lines.append(f"- {room['name']}：{room['purpose']}")

    lines.extend(["", "## 赋能点"])
    for point in status["enablement_points"]:
        lines.append(f"- {point['name']}：{point['status']} / {point['next_action']} / 证据：{point['evidence']}")

    lines.extend(["", "## 风险告警"])
    for alert in status["risk_alerts"]:
        lines.append(f"- [{alert['level']}] {alert['title']}：{alert['detail']}")

    lines.extend(["", "## 下一步"])
    lines.extend([f"- {item}" for item in status["next_actions"]])
    lines.extend(
        [
            "",
            "## 安全边界",
            "- 不自动发布",
            "- 不自动评论",
            "- 不自动私信",
            "- 未到账不登记收入",
        ]
    )
    return "\n".join(lines) + "\n"


def render_html(status: dict[str, Any]) -> str:
    metrics = status["company_metrics"]
    platforms = "".join(
        "<tr>"
        f"<td>{html.escape(platform['name'])}</td>"
        f"<td>{html.escape(str(platform['connection_status']))}</td>"
        f"<td>{html.escape(str(platform['data_source']))}</td>"
        f"<td>{platform['views']}</td>"
        f"<td>{platform['comments']} / {platform['private_messages']}</td>"
        f"<td>{platform['qualified_leads']}</td>"
        f"<td>{html.escape(str(platform['next_action']))}</td>"
        "</tr>"
        for platform in status.get("platforms", [])
    )
    campaigns = "".join(
        f"<li><strong>{html.escape(campaign['name'])}</strong> {html.escape(campaign['stage'])} · "
        f"{campaign['total_views']} 曝光 · {html.escape(campaign['next_action'])}</li>"
        for campaign in status.get("campaigns", [])
    )
    funnel = "".join(
        f"<div class='funnel'><strong>{html.escape(stage['name'])}</strong><span>{stage['count']}</span></div>"
        for stage in status.get("lead_funnel", {}).get("stages", [])
    )
    agents = "".join(
        f"<li><strong>{html.escape(agent['name'])}</strong> {html.escape(agent['status'])} · "
        f"{html.escape(agent['current_task'])} · 下一步：{html.escape(agent['next_action'])}</li>"
        for agent in status.get("agent_ops", [])
    )
    office_zones = "".join(
        f"<li><strong>{html.escape(zone['name'])}</strong> {html.escape(zone['purpose'])} · {html.escape(zone['status'])}</li>"
        for zone in status.get("office", {}).get("zones", [])
    )
    magic_rooms = "".join(
        f"<li><strong>{html.escape(room['name'])}</strong> {html.escape(room['purpose'])}</li>"
        for room in status.get("magic_office", {}).get("rooms", [])
    )
    enablement_points = "".join(
        f"<li><strong>{html.escape(point['name'])}</strong> {html.escape(point['status'])} · "
        f"{html.escape(point['next_action'])} · {html.escape(point['evidence'])}</li>"
        for point in status.get("enablement_points", [])
    )
    alerts = "".join(
        f"<li><strong>{html.escape(alert['title'])}</strong> {html.escape(alert['detail'])}</li>"
        for alert in status.get("risk_alerts", [])
    )
    next_actions = "".join(f"<li>{html.escape(str(item))}</li>" for item in status["next_actions"])
    tasks = "".join(
        f"<tr><td>{html.escape(str(task.get('name', '')))}</td><td>{html.escape(str(task.get('state', '')))}</td><td>{html.escape(str(task.get('result', '')))}</td><td>{html.escape(str(task.get('next_run_time', '')))}</td></tr>"
        for task in status.get("scheduled_tasks", [])
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>一人公司运行状态</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e5e7eb; }}
    main {{ max-width: 1200px; margin: 0 auto; padding: 32px; }}
    .hero {{ display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 1px solid #334155; padding-bottom: 22px; }}
    h1 {{ margin: 0 0 8px; font-size: 32px; }}
    h2 {{ margin-top: 0; }}
    .status {{ display: inline-flex; align-items: center; padding: 8px 14px; border: 1px solid #22c55e; border-radius: 999px; color: #86efac; background: rgba(34,197,94,.12); font-weight: 700; }}
    .grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }}
    .card {{ border: 1px solid #334155; border-radius: 8px; padding: 16px; background: #111827; margin-top: 16px; }}
    .metric {{ font-size: 28px; font-weight: 800; margin-top: 8px; }}
    .muted {{ color: #94a3b8; }}
    table {{ width: 100%; border-collapse: collapse; }}
    td, th {{ border-bottom: 1px solid #334155; padding: 10px; text-align: left; vertical-align: top; }}
    ul {{ line-height: 1.8; }}
    .funnel-row {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }}
    .funnel {{ border: 1px solid #334155; border-radius: 8px; padding: 10px; display: flex; justify-content: space-between; }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>一人公司运行状态</h1>
        <div class="muted">生成时间：{html.escape(status['generated_at'])}</div>
        <p>最近动作：{html.escape(status['last_action'])}</p>
      </div>
      <div class="status">{html.escape(status['company_status'])}</div>
    </section>

    <section class="grid">
      <div class="card"><div class="muted">总曝光</div><div class="metric">{metrics['total_views']}</div></div>
      <div class="card"><div class="muted">总互动</div><div class="metric">{metrics['total_interactions']}</div></div>
      <div class="card"><div class="muted">有效线索</div><div class="metric">{metrics['qualified_leads']}</div></div>
      <div class="card"><div class="muted">待回复</div><div class="metric">{metrics['pending_replies']}</div></div>
    </section>

    <section class="card">
      <h2>平台矩阵</h2>
      <table><thead><tr><th>平台</th><th>连接</th><th>数据源</th><th>曝光</th><th>评论/私信</th><th>线索</th><th>下一步</th></tr></thead><tbody>{platforms}</tbody></table>
    </section>

    <section class="card">
      <h2>内容战役</h2>
      <ul>{campaigns}</ul>
    </section>

    <section class="card">
      <h2>线索漏斗</h2>
      <div class="funnel-row">{funnel}</div>
      <p class="muted">{html.escape(status.get('lead_funnel', {}).get('next_action', ''))}</p>
    </section>

    <section class="card">
      <h2>Agent 作战室</h2>
      <ul>{agents}</ul>
    </section>

    <section class="card">
      <h2>一人公司办公室</h2>
      <ul>{office_zones}</ul>
    </section>

    <section class="card">
      <h2>魔法办公室</h2>
      <ul>{magic_rooms}</ul>
    </section>

    <section class="card">
      <h2>赋能点</h2>
      <ul>{enablement_points}</ul>
    </section>

    <section class="card">
      <h2>风险告警</h2>
      <ul>{alerts}</ul>
    </section>

    <section class="card">
      <h2>下一步</h2>
      <ul>{next_actions}</ul>
    </section>

    <section class="card">
      <h2>后台任务</h2>
      <table><thead><tr><th>任务</th><th>状态</th><th>结果</th><th>下次运行</th></tr></thead><tbody>{tasks}</tbody></table>
    </section>

    <section class="card">
      <h2>安全边界</h2>
      <ul>
        <li>不自动发布</li>
        <li>不自动评论</li>
        <li>不自动私信</li>
        <li>未到账不登记收入</li>
      </ul>
    </section>
  </main>
</body>
</html>
"""


def write_runtime_status(out_dir: Path = DEFAULT_OUT, scheduled_tasks: list[dict[str, Any]] | None = None) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    status = build_runtime_status(scheduled_tasks=scheduled_tasks)
    json_path = out_dir / "runtime-status.json"
    md_path = out_dir / "runtime-status.md"
    html_path = out_dir / "runtime-status.html"
    json_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(render_markdown(status), encoding="utf-8")
    html_path.write_text(render_html(status), encoding="utf-8")
    return {"json": str(json_path), "markdown": str(md_path), "html": str(html_path)}


def main() -> int:
    result = write_runtime_status()
    print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
