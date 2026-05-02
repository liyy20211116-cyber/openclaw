from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import self_operating_loop as loop  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    run_date = "2026-04-28"
    run_id = "test-self-operating-loop"
    out_dir = ROOT / "output" / "self_operating_loop" / run_id
    if out_dir.exists():
        shutil.rmtree(out_dir)

    result = loop.run_self_operating_loop(run_date=run_date, run_id=run_id, dry_run=True)

    assert_true(result["ok"] is True, "loop did not report ok")
    assert_true(result["run_id"] == run_id, "run_id mismatch")
    assert_true(result["goal"]["target_revenue_cny"] == 999, "wrong target revenue")
    assert_true(result["goal"]["target_orders"] == 1, "wrong target order count")
    assert_true(result["payment"]["status"] == "active", "payment channel must be active")
    assert_true(result["revenue"]["booked_real_revenue"] == 0, "dry run must not book real revenue")
    assert_true(len(result["actions"]) >= 5, "loop should produce at least five actions")
    assert_true(any(action["owner"] == "fred-sales" for action in result["actions"]), "missing sales action")
    assert_true(any(action["owner"] == "luna-growth" for action in result["actions"]), "missing growth action")
    assert_true(result["coo_ops"]["draft_jobs"] >= 3, "missing COO draft jobs")
    assert_true(result["coo_ops"]["comments"] >= 1, "missing COO comment queue")
    assert_true(Path(result["coo_ops"]["report"]).exists(), "missing COO report")
    assert_true(
        any("对标" in action["action"] for action in result["actions"]),
        "missing benchmark monitoring action",
    )
    assert_true(any(action["owner"] == "percy-finance" for action in result["actions"]), "missing finance action")
    assert_true(any(blocker["severity"] == "high" for blocker in result["blockers"]), "expected at least one high-severity blocker")

    report_path = Path(result["artifacts"]["report"])
    action_path = Path(result["artifacts"]["actions"])
    evidence_path = Path(result["artifacts"]["evidence"])

    assert_true(report_path.exists(), "report file missing")
    assert_true(action_path.exists(), "actions file missing")
    assert_true(evidence_path.exists(), "evidence file missing")

    actions = json.loads(action_path.read_text(encoding="utf-8"))
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    report = report_path.read_text(encoding="utf-8")

    assert_true(actions["run_id"] == run_id, "actions artifact run_id mismatch")
    assert_true(evidence["run_id"] == run_id, "evidence artifact run_id mismatch")
    assert_true("7天自营盈利目标" in report, "report missing operating goal")
    assert_true("不得登记真实收入" in report, "report missing revenue safety rule")

    print("self operating loop tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
