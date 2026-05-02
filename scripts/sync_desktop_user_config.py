from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_CONFIG = ROOT / "config"


def user_config_dir() -> Path:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        raise RuntimeError("APPDATA is not set")
    return Path(appdata) / "jarvis-one-company-os" / "company-data" / "config"


def backup_existing(target: Path) -> str:
    if not target.exists():
        return ""
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = target.parent / f"config-backup-{stamp}"
    shutil.copytree(target, backup)
    return str(backup)


def sync_config(target: Path) -> dict:
    if not SOURCE_CONFIG.exists():
        raise FileNotFoundError(SOURCE_CONFIG)
    target.mkdir(parents=True, exist_ok=True)
    backup = backup_existing(target)

    for src in SOURCE_CONFIG.rglob("*"):
        rel = src.relative_to(SOURCE_CONFIG)
        dst = target / rel
        if src.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    app_config = json.loads((target / "app-config.json").read_text(encoding="utf-8"))
    return {
        "ok": True,
        "target": str(target),
        "backup": backup,
        "company": app_config.get("company", {}),
        "contact": app_config.get("contact", {}),
        "agents": len(app_config.get("agents", [])),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=Path, default=None)
    args = parser.parse_args()
    target = args.target or user_config_dir()
    result = sync_config(target)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
