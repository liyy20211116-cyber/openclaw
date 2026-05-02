from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "jarvis-one-company-os"


def read(relative_path: str) -> str:
    return (APP / relative_path).read_text(encoding="utf-8")


def assert_contains(path: str, needle: str) -> None:
    content = read(path)
    assert needle in content, f"{path} should contain {needle!r}"


def test_runtime_nav_and_route() -> None:
    assert_contains("src/app/navigation.ts", "运行中心")
    assert_contains("src/app/navigation.ts", "path: '/runtime'")
    assert_contains("src/app/navigation.ts", "办公室")
    assert_contains("src/app/navigation.ts", "path: '/office'")
    assert_contains("src/app/navigation.ts", "魔法办公室")
    assert_contains("src/app/navigation.ts", "path: '/magic-office'")
    assert_contains("src/App.tsx", "RuntimePage")
    assert_contains("src/App.tsx", 'path="runtime"')
    assert_contains("src/App.tsx", "OfficePage")
    assert_contains("src/App.tsx", 'path="office"')
    assert_contains("src/App.tsx", "MagicOfficePage")
    assert_contains("src/App.tsx", 'path="magic-office"')


def test_runtime_page_has_business_status_sections() -> None:
    page = APP / "src/pages/RuntimePage.tsx"
    assert page.exists(), "RuntimePage.tsx should exist"
    content = page.read_text(encoding="utf-8")
    for needle in [
        "运行状态",
        "平台矩阵",
        "内容战役",
        "线索漏斗",
        "Agent 作战室",
        "健康守护",
        "防卡死",
        "fetchRuntimeStatus",
    ]:
        assert needle in content, f"RuntimePage.tsx should contain {needle!r}"


def test_runtime_service_and_api_endpoint() -> None:
    service = APP / "src/services/runtimeStatusService.ts"
    assert service.exists(), "runtimeStatusService.ts should exist"
    service_content = service.read_text(encoding="utf-8")
    assert "/api/company/runtime-status" in service_content
    assert "RuntimeStatusSnapshot" in service_content
    for needle in ["RuntimePlatformStatus", "RuntimeCampaign", "RuntimeLeadFunnel", "RuntimeAgentOps"]:
        assert needle in service_content, f"runtimeStatusService.ts should contain {needle!r}"
    for needle in ["RuntimeOffice", "RuntimeOfficeZone", "RuntimeWorkstation", "RuntimeEnablementPoint"]:
        assert needle in service_content, f"runtimeStatusService.ts should contain {needle!r}"
    for needle in ["RuntimeMagicOffice", "RuntimeMagicRoom", "RuntimeMagicCharacter"]:
        assert needle in service_content, f"runtimeStatusService.ts should contain {needle!r}"

    api_content = read("scripts/writeback-api.ts")
    assert "/api/company/runtime-status" in api_content
    assert "runtime-status.json" in api_content


def test_office_page_has_operating_sections() -> None:
    page = APP / "src/pages/OfficePage.tsx"
    assert page.exists(), "OfficePage.tsx should exist"
    content = page.read_text(encoding="utf-8")
    for needle in [
        "一人公司办公室",
        "办公区",
        "工位",
        "作息节奏",
        "赋能点",
        "客诉机制",
        "fetchRuntimeStatus",
    ]:
        assert needle in content, f"OfficePage.tsx should contain {needle!r}"


def test_magic_office_page_has_scene_and_motion() -> None:
    page = APP / "src/pages/MagicOfficePage.tsx"
    assert page.exists(), "MagicOfficePage.tsx should exist"
    content = page.read_text(encoding="utf-8")
    for needle in [
        "魔法办公室",
        "星图作战大厅",
        "agent-sprite",
        "action_state",
        "activity_log",
        "fetchRuntimeStatus",
        "原创魔法公司",
    ]:
        assert needle in content, f"MagicOfficePage.tsx should contain {needle!r}"


if __name__ == "__main__":
    tests = [
        test_runtime_nav_and_route,
        test_runtime_page_has_business_status_sections,
        test_runtime_service_and_api_endpoint,
        test_office_page_has_operating_sections,
        test_magic_office_page_has_scene_and_motion,
    ]
    for test in tests:
        test()
    print("runtime status app integration checks passed")
