from __future__ import annotations

import csv
import datetime as dt
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def test_build_runtime_status_from_real_artifacts() -> None:
    import runtime_status

    status = runtime_status.build_runtime_status(
        scheduled_tasks=[
            {"name": "JarvisUnattendedHealthGuardian", "state": "Ready", "result": "ok", "result_code": 0, "next_run_time": "2026-04-29T14:30:00"},
            {"name": "JarvisXhsMonitor-T8h", "state": "Ready", "result": "pending", "next_run_time": "2026-04-29T19:27:00"},
            {"name": "JarvisXhsMonitor-HRStudy-T24h", "state": "Ready", "result": "pending", "next_run_time": "2026-05-01T12:42:00"},
        ]
    )
    assert_true(status["company_status"] in {"营业中", "监控中", "等待审核", "异常"}, "invalid company status")
    assert_true(status["business_monitor"]["platform"] == "xiaohongshu", "platform should be visible")
    assert_true("views" in status["business_monitor"], "views metric missing")
    assert_true(status["guardian"]["mode"] == "watchdog_readonly", "guardian mode missing")
    assert_true(status["safety"]["allow_comment_reply"] is False, "comment reply must be disabled")
    assert_true(len(status["next_actions"]) >= 1, "next action should be visible")
    assert_true(len(status["platforms"]) >= 5, "cross-platform matrix should include configured channels")
    platform_ids = {item["id"] for item in status["platforms"]}
    for platform_id in ["xiaohongshu", "douyin", "bilibili", "wechat_official", "wechat_personal"]:
        assert_true(platform_id in platform_ids, f"{platform_id} should be visible in platform matrix")
    xhs = next(item for item in status["platforms"] if item["id"] == "xiaohongshu")
    assert_true(xhs["data_source"] == "synced", "xiaohongshu should use the current real monitor data")
    assert_true(xhs["views"] >= 518, "xiaohongshu account metrics should aggregate monitored posts, not only the latest post")
    assert_true(xhs["published"] >= 2, "xiaohongshu account should count all published monitored posts")
    douyin = next(item for item in status["platforms"] if item["id"] == "douyin")
    assert_true(douyin["data_source"] in {"pending_connection", "manual"}, "unconnected channels should not fake synced data")
    assert_true(status["company_metrics"]["total_views"] >= status["business_monitor"]["views"], "company metrics should aggregate platform metrics")
    assert_true(status["company_metrics"]["total_views"] >= 518, "company metrics should include account-level content history")
    assert_true(len(status["content_posts"]) >= 2, "content operations should show multiple monitored posts")
    first_post = status["content_posts"][0]
    for key in ["platform", "post_title", "status", "views", "published_at", "last_checked_at", "next_action", "review_status", "next_topic", "private_domain_action"]:
        assert_true(key in first_post, f"content post missing {key}")
    assert_true(any(post["review_status"] == "needs_review" for post in status["content_posts"]), "content posts should expose review status")
    assert_true(any("私域" in post["private_domain_action"] for post in status["content_posts"]), "content posts should carry private-domain action")
    scheduled_names = {task["name"] for task in status["scheduled_tasks"]}
    assert_true("JarvisXhsMonitor-HRStudy-T24h" in scheduled_names, "runtime status should include content-specific monitor tasks")
    assert_true(status["lead_funnel"]["stages"][0]["id"] == "exposure", "lead funnel should start at exposure")
    assert_true(len(status["campaigns"]) >= 1, "content campaigns should be visible")
    assert_true(len(status["agent_ops"]) >= 6, "agent operations room should include the core team")
    assert_true(len(status["risk_alerts"]) >= 1, "risk alerts should expose gaps and safety status")
    assert_true("office" in status, "agent office should be visible")
    assert_true(len(status["office"]["zones"]) >= 5, "office should include functional zones")
    assert_true(len(status["office"]["workstations"]) >= 9, "office should include all agent workstations")
    assert_true(len(status["office"]["daily_rhythm"]) >= 3, "office should show operating rhythm")
    assert_true(len(status["enablement_points"]) >= 6, "commercial enablement points should be visible")
    assert_true("magic_office" in status, "magic office should be visible")
    assert_true(status["magic_office"]["theme"] == "original_magic_company", "magic office should use an original commercial-safe theme")
    assert_true(len(status["magic_office"]["rooms"]) >= 7, "magic office should include rooms")
    assert_true(len(status["magic_office"]["characters"]) >= 9, "magic office should include all agent characters")
    assert_true(len(status["magic_office"]["activity_log"]) >= 3, "magic office should expose activity log")
    character = next(item for item in status["magic_office"]["characters"] if item["agent_id"] == "jarvis-coo")
    for key in ["display_name", "avatar_style", "room_id", "x", "y", "action_state", "speech", "target_room_id", "current_task"]:
        assert_true(key in character, f"magic office character missing {key}")
    enablement_ids = {item["id"] for item in status["enablement_points"]}
    for item_id in ["platform_onboarding", "lead_ledger", "content_review", "product_shelf", "agent_daily_report", "complaint_handling"]:
        assert_true(item_id in enablement_ids, f"{item_id} enablement point missing")
    assert_true("model_health" in status, "model health should be visible")
    assert_true(status["model_health"]["status"] in {"ready", "degraded", "not_configured"}, "model health status invalid")
    assert_true(len(status["model_health"]["models"]) >= 1, "at least one configured model should be shown")
    assert_true("agent_roster" in status, "agent roster should be visible")
    assert_true(len(status["agent_roster"]) >= 9, "agent roster should include all operating roles")
    assert_true(all(item["responsibility"] for item in status["agent_roster"]), "each agent should expose responsibility")
    assert_true("company_work_queue" in status, "company work queue should be visible")
    work_owners = {item["owner"] for item in status["company_work_queue"]}
    for owner in ["jarvis-coo", "luna-growth", "fred-sales", "mcgonagall-product", "hermione-tech", "dobby-customer", "percy-finance", "snape-audit", "neville-hr"]:
        assert_true(owner in work_owners, f"{owner} should have active work")
    assert_true("hr_learning_assets" in status, "HR learning assets should be visible")
    assert_true(len(status["hr_learning_assets"]) >= 1, "HR should expose at least one learning asset")
    assert_true(any("douyin" in item["platforms"] for item in status["hr_learning_assets"]), "HR learning should include Douyin")
    assert_true(any("bilibili" in item["platforms"] for item in status["hr_learning_assets"]), "HR learning should include Bilibili")
    assert_true(any("wechat_official" in item["platforms"] for item in status["hr_learning_assets"]), "HR learning should include WeChat Official")
    assert_true("revenue_goal" in status, "revenue goal should be visible")
    revenue_goal = status["revenue_goal"]
    for key in ["active", "target_cny", "current_gap_cny", "selected_project", "approval_queue_count", "artifacts", "next_action"]:
        assert_true(key in revenue_goal, f"revenue goal missing {key}")
    if revenue_goal["active"]:
        assert_true(revenue_goal["mode"] in {"dry_run", "autonomous"}, "active revenue goal should expose execution mode")
        assert_true(revenue_goal["target_cny"] >= 10000, "active revenue goal should expose the target")
        assert_true(revenue_goal["current_gap_cny"] >= 0, "active revenue goal should expose the gap")
        assert_true(revenue_goal["approval_queue_count"] >= 1, "active revenue goal should expose approval queue")
        assert_true(revenue_goal["internal_executed_count"] >= 0, "active revenue goal should expose internal execution count")


def test_latest_revenue_goal_ignores_test_runs() -> None:
    import revenue_goal_loop
    import runtime_status

    real_run_id = f"revenue-goal-10000-{dt.date.today().strftime('%Y%m%d')}"
    revenue_goal_loop.run_revenue_goal_loop(target_cny=10000, days=30, run_id=real_run_id, dry_run=False)
    revenue_goal_loop.run_revenue_goal_loop(target_cny=10000, days=30, run_id="test-runtime-status-ignore", dry_run=False)
    status = runtime_status.build_runtime_status()
    assert_true(not status["revenue_goal"]["run_id"].startswith("test-"), "runtime status should ignore test revenue goal runs")


def test_company_status_recovers_when_failed_monitor_has_catchup() -> None:
    import runtime_status

    monitor = {"views": 5, "comments": 0, "private_messages": 0}
    tasks = [
        {"name": "JarvisXhsMonitor-T8h", "result": "failed_interrupted_or_crashed", "last_run_time": "2026-04-30T17:40:53"},
        {"name": "JarvisXhsMonitor-T24h", "result": "pending"},
    ]
    events = [
        {"event": "post_t8h_engagement_scan_catchup", "ts": "2026-04-30T21:39:14"},
    ]
    assert_true(runtime_status._company_status(tasks, monitor, events) == "营业中", "catchup should recover company status")


def test_render_runtime_status_html_is_customer_visible() -> None:
    import runtime_status

    sample = {
        "generated_at": "2026-04-29 14:30:00",
        "company_status": "营业中",
        "last_action": "健康守护检查完成",
        "next_actions": ["19:27 小红书 T+8h 监控"],
        "business_monitor": {
            "platform": "xiaohongshu",
            "post_title": "我给9个AI员工发工资",
            "views": 347,
            "likes": 3,
            "favorites": 4,
            "comments": 0,
            "shares": 3,
            "qualified_leads": 0,
        },
        "guardian": {"state": "Ready", "last_result": 0, "mode": "watchdog_readonly", "runtime_seconds": 12.36},
        "company_metrics": {"total_views": 347, "total_interactions": 10, "qualified_leads": 0, "pending_replies": 0},
        "platforms": [
            {"id": "xiaohongshu", "name": "小红书", "enabled": True, "connection_status": "connected", "data_source": "synced", "views": 347, "likes": 3, "favorites": 4, "comments": 0, "shares": 3, "private_messages": 0, "qualified_leads": 0, "drafts": 0, "published": 1, "risk": "normal", "last_sync": "2026-04-29 13:30:54", "next_check": "2026-04-29T19:27:00", "next_action": "按 SOP 进入下一轮监控"},
            {"id": "douyin", "name": "抖音", "enabled": True, "connection_status": "pending_connection", "data_source": "pending_connection", "views": 0, "likes": 0, "favorites": 0, "comments": 0, "shares": 0, "private_messages": 0, "qualified_leads": 0, "drafts": 0, "published": 0, "risk": "needs_connection", "last_sync": "", "next_check": "", "next_action": "接入只读监控"},
        ],
        "campaigns": [{"id": "ai_salary_sheet", "name": "AI员工工资单曝光", "stage": "monitor", "owner": "luna-growth", "platforms": ["xiaohongshu", "douyin"], "assets_ready": 1, "assets_published": 1, "total_views": 347, "qualified_leads": 0, "next_action": "扩展到短视频和公众号"}],
        "lead_funnel": {"stages": [{"id": "exposure", "name": "曝光", "count": 347}, {"id": "qualified_lead", "name": "有效线索", "count": 0}]},
        "agent_ops": [{"agent_id": "jarvis-coo", "name": "贾维斯 COO", "role": "调度", "status": "running", "current_task": "跨平台运营巡检", "last_action": "生成运行状态", "blocker": "", "next_action": "推动下一轮监控", "needs_ceo_review": False}],
        "risk_alerts": [{"level": "warning", "title": "多平台监控未接通", "detail": "抖音/B站/公众号仍需接入只读数据源", "owner": "hermione-tech"}],
        "office": {
            "zones": [{"id": "command", "name": "总调度台", "purpose": "经营调度", "status": "running", "owner_agents": ["jarvis-coo"]}],
            "workstations": [{"agent_id": "jarvis-coo", "agent_name": "贾维斯 COO", "zone_id": "command", "desk_name": "总调度台", "status": "running", "current_task": "跨平台运营巡检", "next_action": "推动下一轮监控", "blocker": "", "needs_ceo_review": False}],
            "daily_rhythm": [{"time": "09:30", "name": "晨会", "owner": "jarvis-coo", "output": "当日作战计划"}],
        },
        "magic_office": {
            "theme": "original_magic_company",
            "rooms": [{"id": "command_hall", "name": "星图作战大厅", "purpose": "调度", "x": 50, "y": 50, "width": 100, "height": 80, "accent": "#38bdf8"}],
            "characters": [{"agent_id": "jarvis-coo", "display_name": "贾维斯", "avatar_style": "arcane_coo", "room_id": "command_hall", "target_room_id": "command_hall", "x": 80, "y": 90, "action_state": "coordinating", "speech": "汇总全局状态", "current_task": "跨平台运营巡检", "needs_ceo_review": False}],
            "activity_log": [{"time": "09:30", "agent": "贾维斯", "action": "发起晨会调度"}],
        },
        "enablement_points": [{"id": "platform_onboarding", "name": "平台接入优先级", "status": "in_progress", "owner": "hermione-tech", "next_action": "接入抖音/B站只读监控", "evidence": "1/5 平台接通"}],
        "safety": {
            "allow_publish": False,
            "allow_comment_reply": False,
            "allow_private_message": False,
            "allow_revenue_write_without_payment": False,
        },
    }
    html = runtime_status.render_html(sample)
    assert_true("<!doctype html>" in html.lower(), "html doctype missing")
    assert_true("营业中" in html, "company status should be visible")
    assert_true("347" in html, "business metric should be visible")
    assert_true("不自动评论" in html, "safety boundary should be visible")
    assert_true("小红书" in html, "platform matrix should be visible")
    assert_true("AI员工工资单曝光" in html, "campaign should be visible")
    assert_true("有效线索" in html, "lead funnel should be visible")
    assert_true("总调度台" in html, "office zone should be visible")
    assert_true("平台接入优先级" in html, "enablement point should be visible")
    assert_true("星图作战大厅" in html, "magic office should be visible")


def test_write_runtime_status_outputs_three_files() -> None:
    import runtime_status

    out_dir = ROOT / "output" / "test_runtime_status"
    result = runtime_status.write_runtime_status(
        out_dir=out_dir,
        scheduled_tasks=[{"name": "JarvisUnattendedHealthGuardian", "state": "Ready", "result": "ok", "result_code": 0, "next_run_time": "2026-04-29T14:30:00"}],
    )
    for key in ["json", "markdown", "html"]:
        assert_true(Path(result[key]).exists(), f"{key} output missing")
    data = json.loads(Path(result["json"]).read_text(encoding="utf-8"))
    assert_true(data["company_status"], "json status missing")


def main() -> int:
    test_build_runtime_status_from_real_artifacts()
    test_latest_revenue_goal_ignores_test_runs()
    test_company_status_recovers_when_failed_monitor_has_catchup()
    test_render_runtime_status_html_is_customer_visible()
    test_write_runtime_status_outputs_three_files()
    print("runtime status tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
