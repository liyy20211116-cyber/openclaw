from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import jarvis_coo_ops as coo  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    run_id = "test-jarvis-coo-ops"
    out_dir = ROOT / "output" / "coo_ops" / run_id
    if out_dir.exists():
        shutil.rmtree(out_dir)

    result = coo.run_coo_ops(
        run_date="2026-04-28",
        run_id=run_id,
        sample_comments=[
            {
                "platform": "xiaohongshu",
                "author": "potential_buyer",
                "text": "这个一人公司怎么收费？能帮我做一个能赚钱的账号吗？",
            },
            {
                "platform": "douyin",
                "author": "operator_a",
                "text": "自动回复会不会封号？",
            },
        ],
    )

    assert_true(result["ok"] is True, "COO ops did not report ok")
    assert_true(result["mode"] == "review_only", "COO ops must stay in review-only mode")
    assert_true(result["safety"]["auto_publish"] is False, "auto publish must be disabled")
    assert_true(result["safety"]["auto_reply"] is False, "auto reply must be disabled")
    assert_true(result["safety"]["book_revenue"] is False, "real revenue booking must be disabled")
    assert_true(len(result["draft_jobs"]["jobs"]) >= 3, "expected multi-platform draft jobs")
    assert_true(
        all(job["action"] == "draft" and not job.get("publish", False) for job in result["draft_jobs"]["jobs"]),
        "every platform job must be draft-only",
    )
    xhs_job = next(job for job in result["draft_jobs"]["jobs"] if job["platform"] == "xiaohongshu")
    assert_true(xhs_job.get("images"), "xiaohongshu draft must include at least one image")
    assert_true(
        all((ROOT / image).exists() for image in xhs_job["images"]),
        "xiaohongshu draft images must exist",
    )
    assert_true(len(result["comment_queue"]) == 2, "comment queue should process sample comments")
    assert_true(any(item["is_lead"] for item in result["comment_queue"]), "should identify at least one lead")
    assert_true(
        all(item["requires_ceo_confirm"] for item in result["comment_queue"]),
        "comment replies must require CEO confirmation",
    )
    assert_true(any(action["owner"] == "jarvis-coo" for action in result["actions"]), "missing Jarvis COO action")
    assert_true(any(action["owner"] == "dobby-customer" for action in result["actions"]), "missing customer service action")
    expected_owners = {
        "jarvis-coo",
        "luna-growth",
        "fred-sales",
        "mcgonagall-product",
        "percy-finance",
        "dobby-customer",
        "snape-audit",
        "hermione-tech",
        "neville-hr",
    }
    actual_owners = {action["owner"] for action in result["actions"]}
    missing_owners = expected_owners - actual_owners
    assert_true(not missing_owners, f"missing operating owners: {sorted(missing_owners)}")
    assert_true(len(result["role_contracts"]) >= len(expected_owners), "missing role contracts")

    for key in ("draft_job", "comment_queue", "report"):
        assert_true(Path(result["artifacts"][key]).exists(), f"missing artifact: {key}")

    draft_job = json.loads(Path(result["artifacts"]["draft_job"]).read_text(encoding="utf-8"))
    comments = json.loads(Path(result["artifacts"]["comment_queue"]).read_text(encoding="utf-8"))
    report = Path(result["artifacts"]["report"]).read_text(encoding="utf-8")

    assert_true(draft_job["mode"] == "review_only", "draft job artifact mode mismatch")
    assert_true(comments["run_id"] == run_id, "comment queue run_id mismatch")
    assert_true("CEO审核后发布" in report, "report should mention CEO review before publishing")
    assert_true("不自动回复评论" in report, "report should mention no automatic comment replies")

    print("jarvis COO ops tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
