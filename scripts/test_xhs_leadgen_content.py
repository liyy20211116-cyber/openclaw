from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import xhs_leadgen_content as xhs  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    run_id = "test-xhs-leadgen"
    out_dir = ROOT / "output" / "xhs_leadgen" / run_id
    if out_dir.exists():
        shutil.rmtree(out_dir)

    result = xhs.generate_xhs_leadgen_content(run_id=run_id, run_date="2026-04-29")

    assert_true(result["ok"] is True, "generation failed")
    assert_true(result["title"], "missing title")
    assert_true(len(result["title"]) <= 20, "title should fit xhs feed display")
    assert_true("D:" not in result["body"] and "FY003" not in result["body"], "body leaks local file paths")
    assert_true("payment-block" not in result["body"], "body leaks internal artifact names")
    assert_true("日报" not in result["body"], "body should not read like an internal report")
    assert_true("下一篇" in result["body"] and "清单" in result["body"], "body should use serialized sharing, not comment bait")
    assert_true("评论：" not in result["body"] and "评论区" not in result["body"], "body must not bait comments")
    assert_true("点赞" not in result["body"] and "收藏" not in result["body"], "body must not bait engagement")
    assert_true("稳赚" not in result["body"] and "暴富" not in result["body"], "body contains risky promise")
    import xhs_compliance_guard as guard  # noqa: PLC0415

    audit = guard.audit_text(result["body"])
    assert_true(audit["pass"], f"xhs compliance guard failed: {audit}")
    assert_true(len(result["cards"]) >= 4, "xhs note needs multi-card structure")
    assert_true(all(Path(card["path"]).exists() for card in result["cards"]), "card images missing")
    assert_true(Path(result["artifacts"]["markdown"]).exists(), "markdown artifact missing")
    assert_true(Path(result["artifacts"]["job"]).exists(), "job artifact missing")

    job = json.loads(Path(result["artifacts"]["job"]).read_text(encoding="utf-8"))
    assert_true(job["platform"] == "xiaohongshu", "job platform mismatch")
    assert_true(job["publish"] is False, "job must not publish")
    assert_true(len(job["images"]) >= 4, "job should include carousel cards")
    assert_true(all((ROOT / image).exists() for image in job["images"]), "job image path missing")

    print("xhs leadgen content tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
