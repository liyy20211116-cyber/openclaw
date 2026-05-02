from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sync_desktop_user_config as sync_config  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="jarvis-config-sync-"))
    try:
        result = sync_config.sync_config(tmp)
        assert_true(result["ok"] is True, "sync did not report ok")
        assert_true(result["agents"] >= 8, "desktop config must include the operating team")
        app_config = json.loads((tmp / "app-config.json").read_text(encoding="utf-8"))
        integrations = json.loads((tmp / "integrations.json").read_text(encoding="utf-8"))
        assert_true(app_config["contact"]["phone"] == "19237140413", "phone not synced")
        assert_true(app_config["contact"]["wechat"] == "go19237140413", "wechat not synced")
        assert_true(any(agent["id"] == "jarvis-coo" for agent in app_config["agents"]), "missing Jarvis COO")
        assert_true(any(agent["id"] == "fred-sales" for agent in app_config["agents"]), "missing sales agent")
        assert_true(any(agent["id"] == "snape-audit" for agent in app_config["agents"]), "missing audit agent")
        assert_true(integrations["owner"]["phone"] == "19237140413", "integrations owner not synced")
        assert_true((tmp / "tenant" / "default" / "integrations" / "douyin.json").exists(), "tenant integration not synced")
        print("desktop user config sync tests passed")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
