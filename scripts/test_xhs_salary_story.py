from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import xhs_compliance_guard as guard  # noqa: E402
import xhs_salary_story as salary_story  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    run_id = "test-xhs-salary-story"
    out_dir = ROOT / "output" / "xhs_leadgen" / run_id
    if out_dir.exists():
        shutil.rmtree(out_dir)

    result = salary_story.generate_salary_story(run_id=run_id, month="2026-04")

    assert_true(result["ok"], "generation failed")
    assert_true(result["title"] == "我给AI员工发工资", "unexpected title")
    assert_true("Token 工资单" in result["body"], "salary hook missing")
    assert_true("不是真人雇佣" in result["body"], "needs clarity that AI employees are roles")
    assert_true("关注我" not in result["body"], "must not bait follows")
    assert_true("评论" not in result["body"], "must not bait comments")
    assert_true("从不摸鱼" not in result["body"] and "1/10" not in result["body"], "must not use unsupported claims")

    audit = guard.audit_text(result["body"])
    assert_true(audit["pass"], f"compliance failed: {audit}")
    assert_true(len(result["images"]) >= 1, "needs at least one image")
    assert_true(all(Path(image).exists() for image in result["images"]), "image missing")

    job = json.loads(Path(result["artifacts"]["job"]).read_text(encoding="utf-8"))
    assert_true(job["publish"] is False, "job must be draft-only")
    assert_true(job["gates"]["snape_compliance"] == "pass", "compliance gate missing")

    print("xhs salary story tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
