from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def test_hr_platform_learning_outputs_knowledge_and_materials() -> None:
    import hr_platform_learning

    out_dir = ROOT / "output" / "test_hr_platform_learning"
    result = hr_platform_learning.write_learning_assets(out_dir=out_dir, date_label="2026-04-30")

    for key in ["lesson", "patterns", "memo", "content_kit", "agent_tasks", "draft_bundle"]:
        path = Path(result[key])
        assert_true(path.exists(), f"{key} output missing")

    patterns = json.loads(Path(result["patterns"]).read_text(encoding="utf-8"))
    platforms = {item["platform"] for item in patterns["patterns"]}
    for platform in ["douyin", "bilibili", "wechat_official"]:
        assert_true(platform in platforms, f"{platform} learning pattern missing")

    content_kit = Path(result["content_kit"]).read_text(encoding="utf-8")
    assert_true("HR 学爆款不是抄袭" in content_kit, "content kit should turn learning process into material")
    assert_true("Douyin" in content_kit or "抖音" in content_kit, "douyin material missing")
    assert_true("Bilibili" in content_kit or "B站" in content_kit, "bilibili material missing")
    assert_true("公众号" in content_kit, "wechat official material missing")

    tasks = json.loads(Path(result["agent_tasks"]).read_text(encoding="utf-8"))
    owners = {item["owner"] for item in tasks["tasks"]}
    for owner in ["neville-hr", "luna-growth", "fred-sales", "snape-audit", "mcgonagall-product"]:
        assert_true(owner in owners, f"{owner} enablement task missing")

    draft_bundle = Path(result["draft_bundle"]).read_text(encoding="utf-8")
    assert_true("抖音草稿" in draft_bundle, "draft bundle should include Douyin draft")
    assert_true("B站大纲" in draft_bundle, "draft bundle should include Bilibili outline")
    assert_true("公众号长文草稿" in draft_bundle, "draft bundle should include WeChat article draft")


def main() -> int:
    test_hr_platform_learning_outputs_knowledge_and_materials()
    print("hr platform learning tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
