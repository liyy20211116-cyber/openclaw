"""一日一备份脚本。

每天凌晨跑，把项目关键产出打包成 zip，写到：
    backups/jarvis-YYYY-MM-DD.zip

备份内容（轻量、不含 tools/ 和 .venv）：
    - config/       全量配置中心
    - output/       作战产出、ledger、drafts
    - docs/         文档
    - skills/       Skill 源码
    - scripts/      脚本
    - openclaw_agents/  Agent 身份
    - README.md / AGENTS.md 等根文件

保留策略：最近 14 份全量。
"""
from __future__ import annotations

import argparse
import datetime as dt
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUP_DIR = ROOT / "backups"

INCLUDE_DIRS = [
    "config", "output", "docs", "skills", "scripts",
    "openclaw_agents", "templates", "assets",
]
INCLUDE_FILES = ["README.md", "AGENTS.md", ".gitignore", "pyproject.toml"]

EXCLUDE_PATTERNS = [
    "__pycache__", ".venv", "node_modules", ".git", "tools",
    "output/videos",   # 视频可能很大，单独备份
    "backups",
]

KEEP_LAST = 14


def should_skip(rel: str) -> bool:
    rel_norm = rel.replace("\\", "/")
    for pat in EXCLUDE_PATTERNS:
        if pat in rel_norm:
            return True
    return False


def make_backup(out_path: Path) -> int:
    total = 0
    size = 0
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for d in INCLUDE_DIRS:
            base = ROOT / d
            if not base.exists():
                continue
            for p in base.rglob("*"):
                if not p.is_file():
                    continue
                rel = str(p.relative_to(ROOT))
                if should_skip(rel):
                    continue
                zf.write(p, rel)
                total += 1
                size += p.stat().st_size
        for f in INCLUDE_FILES:
            fp = ROOT / f
            if fp.is_file():
                zf.write(fp, f)
                total += 1
                size += fp.stat().st_size
    return total, size


def prune_old():
    files = sorted(BACKUP_DIR.glob("jarvis-*.zip"), key=lambda x: x.stat().st_mtime)
    if len(files) <= KEEP_LAST:
        return
    for f in files[: -KEEP_LAST]:
        try:
            f.unlink()
            print(f"[prune] removed {f.name}")
        except Exception:
            pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.date.today().isoformat()
    out = BACKUP_DIR / f"jarvis-{stamp}.zip"
    if out.exists():
        out = BACKUP_DIR / f"jarvis-{stamp}-{dt.datetime.now().strftime('%H%M%S')}.zip"

    if args.dry_run:
        print(f"[dry] would write {out}")
        return 0

    files, size = make_backup(out)
    mb = size / 1024 / 1024
    print(f"[OK] backup saved: {out}")
    print(f"     files={files}, size={mb:.2f} MB")
    prune_old()
    return 0


if __name__ == "__main__":
    sys.exit(main())
