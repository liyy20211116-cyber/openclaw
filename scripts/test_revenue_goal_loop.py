from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def test_revenue_goal_loop_builds_project_plan() -> None:
    import revenue_goal_loop

    run_id = "test-revenue-goal-loop"
    out_dir = ROOT / "output" / "revenue_goals" / run_id
    if out_dir.exists():
        shutil.rmtree(out_dir)

    result = revenue_goal_loop.run_revenue_goal_loop(target_cny=10000, days=30, run_id=run_id, dry_run=True)

    assert_true(result["ok"] is True, "loop should report ok")
    assert_true(result["target_cny"] == 10000, "target revenue mismatch")
    assert_true(result["days"] == 30, "deadline mismatch")
    assert_true(result["booked_real_revenue"] == 0, "dry run must not book real revenue")
    assert_true(len(result["project_candidates"]) >= 3, "should generate at least three project candidates")
    assert_true(result["selected_project"]["id"], "selected project missing")
    assert_true(result["selected_project"]["score"] >= 70, "selected project should be defensible")
    assert_true(len(result["department_actions"]) >= 6, "department actions should cover the company")
    assert_true(len(result["approval_queue"]) >= 3, "approval queue should include external actions")

    owners = {item["owner"] for item in result["department_actions"]}
    for owner in ["jarvis-coo", "mcgonagall-product", "luna-growth", "fred-sales", "snape-audit", "percy-finance"]:
        assert_true(owner in owners, f"{owner} action missing")

    approval_types = {item["type"] for item in result["approval_queue"]}
    for approval_type in ["publish_content", "send_outreach", "quote_price"]:
        assert_true(approval_type in approval_types, f"{approval_type} approval missing")

    for key in ["evidence", "plan", "approvals", "offer", "content_brief"]:
        path = Path(result["artifacts"][key])
        assert_true(path.exists(), f"{key} artifact missing")

    evidence = json.loads(Path(result["artifacts"]["evidence"]).read_text(encoding="utf-8"))
    assert_true(evidence["run_id"] == run_id, "evidence run_id mismatch")
    assert_true(evidence["selected_project"]["id"] == result["selected_project"]["id"], "selected project not persisted")


def test_autonomous_mode_executes_internal_company_work() -> None:
    import revenue_goal_loop

    run_id = "test-revenue-goal-loop-autonomous"
    out_dir = ROOT / "output" / "revenue_goals" / run_id
    if out_dir.exists():
        shutil.rmtree(out_dir)

    result = revenue_goal_loop.run_revenue_goal_loop(target_cny=10000, days=30, run_id=run_id, dry_run=False)

    assert_true(result["mode"] == "autonomous", "non-dry-run loop should be autonomous")
    assert_true(result["booked_real_revenue"] == 0, "autonomous loop must not book real revenue")
    assert_true(result["safety"]["auto_publish"] is False, "autonomous loop must not auto-publish")
    assert_true(result["safety"]["auto_outreach"] is False, "autonomous loop must not auto-outreach")
    assert_true(result["safety"]["auto_quote"] is False, "autonomous loop must not auto-quote")
    assert_true(result["internal_execution"]["executed_count"] >= 5, "internal company work should be executed")

    for key in ["execution_ledger", "agent_dispatch", "events"]:
        path = Path(result["artifacts"][key])
        assert_true(path.exists(), f"{key} artifact missing")

    ledger = json.loads(Path(result["artifacts"]["execution_ledger"]).read_text(encoding="utf-8"))
    assert_true(any(item["status"] == "executed_internal" for item in ledger["items"]), "ledger should include executed internal work")
    assert_true(any(item["status"] == "pending_ceo_approval" for item in ledger["items"]), "ledger should keep external actions gated")


def main() -> int:
    test_revenue_goal_loop_builds_project_plan()
    test_autonomous_mode_executes_internal_company_work()
    print("revenue goal loop tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
