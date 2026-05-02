from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import xhs_compliance_guard as guard  # noqa: E402
import xhs_day2_reflection as day2  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    run_id = "test-xhs-day2-reflection"
    out_dir = ROOT / "output" / "xhs_leadgen" / run_id
    if out_dir.exists():
        shutil.rmtree(out_dir)

    result = day2.generate_day2_reflection(run_id=run_id, run_date="2026-04-29")

    assert_true(result["ok"], "generation failed")
    assert_true(result["title"] == "第一条小红书被下架了", "unexpected title")
    assert_true("评论：" not in result["body"] and "评论区" not in result["body"], "must not bait comments")
    assert_true("点赞" not in result["body"] and "收藏" not in result["body"], "must not bait engagement")
    assert_true("下架" in result["body"] and "规则" in result["body"], "must reflect real incident")
    assert_true("后台给的原因" in result["body"], "should read like a first-person platform incident")
    assert_true("内容岗" not in result["body"] and "技术岗" not in result["body"], "body should avoid internal org jargon")
    assert_true("内部复盘" not in result["body"], "body should not read like internal reporting")
    audit = guard.audit_text(result["body"])
    assert_true(audit["pass"], f"compliance failed: {audit}")
    assert_true(len(result["cards"]) == 4, "should generate 4 cards")
    assert_true(all(Path(card["path"]).exists() for card in result["cards"]), "card images missing")

    job = json.loads(Path(result["artifacts"]["job"]).read_text(encoding="utf-8"))
    assert_true(job["publish"] is False, "job must be draft-only")
    assert_true(job["gates"]["luna_realness"] == "pass", "Luna gate missing")
    assert_true(job["gates"]["snape_compliance"] == "pass", "Snape gate missing")

    print("xhs day2 reflection tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
