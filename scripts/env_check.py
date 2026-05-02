"""Jarvis OS 工具链环境检查脚本。

对应补齐计划 阶段 0.3。

输出：
  - 命令行 - 彩色摘要
  - docs/env-check-report.md - markdown 报告（可提交到 git）

用法：
  python scripts/env_check.py
  python scripts/env_check.py --save-report
"""

from __future__ import annotations

import argparse
import datetime as dt
import importlib
import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = PROJECT_ROOT / "docs" / "env-check-report.md"


BINARIES = [
    ("git", "--version"),
    ("node", "--version"),
    ("npm", "--version"),
    ("python", "--version"),
    ("ffmpeg", "-version"),
    ("uv", "--version"),
    ("opencli", "--version"),
    ("claude", "--version"),
]

PY_PKGS = [
    "pillow",
    "requests",
    "wxauto",
    "edge_tts",
    "whisper",
]

EXTERNAL_REPOS = [
    ("tools/videocut", "zinan92/videocut"),
    ("tools/openclip", "linzzzzzz/openclip"),
    ("tools/Clip2Post", "WtecHtec/Clip2Post"),
    ("tools/OpenCLI", "jackwener/opencli"),
]


def check_binary(name: str, arg: str) -> dict:
    if shutil.which(name) is None:
        return {"name": name, "ok": False, "version": None, "hint": None}
    try:
        out = subprocess.run(
            [name, arg], capture_output=True, text=True, timeout=10, encoding="utf-8", errors="ignore"
        )
        ver = (out.stdout or out.stderr or "").strip().splitlines()[0] if (out.stdout or out.stderr) else "(unknown)"
    except Exception as e:
        ver = f"error: {e}"
    return {"name": name, "ok": True, "version": ver, "hint": None}


def check_py(pkg: str) -> dict:
    try:
        m = importlib.import_module(pkg.replace("-", "_"))
        ver = getattr(m, "__version__", "(no __version__)")
        return {"name": pkg, "ok": True, "version": ver}
    except Exception:
        return {"name": pkg, "ok": False, "version": None}


def check_repo(rel_path: str, upstream: str) -> dict:
    p = PROJECT_ROOT / rel_path
    return {
        "rel_path": rel_path,
        "upstream": upstream,
        "exists": p.exists(),
        "has_skill_md": (p / "SKILL.md").exists() if p.exists() else False,
    }


def emit_markdown(report: dict) -> str:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines: list[str] = []
    lines.append("# Jarvis OS 环境检查报告")
    lines.append("")
    lines.append(f"> 生成于 {now}")
    lines.append("")
    lines.append(f"- 操作系统：{report['platform']}")
    lines.append(f"- Python：{report['python']}")
    lines.append("")

    lines.append("## 命令行工具")
    lines.append("")
    lines.append("| 工具 | 状态 | 版本 |")
    lines.append("|---|:---:|---|")
    for b in report["binaries"]:
        status = "✅" if b["ok"] else "❌"
        ver = b["version"] or "-"
        lines.append(f"| {b['name']} | {status} | {ver} |")
    lines.append("")

    lines.append("## Python 包")
    lines.append("")
    lines.append("| 包 | 状态 | 版本 |")
    lines.append("|---|:---:|---|")
    for p in report["py_pkgs"]:
        status = "✅" if p["ok"] else "❌"
        ver = p["version"] or "-"
        lines.append(f"| {p['name']} | {status} | {ver} |")
    lines.append("")

    lines.append("## 外部开源工具链")
    lines.append("")
    lines.append("| 路径 | 上游 | 存在 | 有 SKILL.md |")
    lines.append("|---|---|:---:|:---:|")
    for r in report["external_repos"]:
        e = "✅" if r["exists"] else "❌"
        s = "✅" if r["has_skill_md"] else "—"
        lines.append(f"| `{r['rel_path']}` | {r['upstream']} | {e} | {s} |")
    lines.append("")

    missing_bin = [b["name"] for b in report["binaries"] if not b["ok"]]
    missing_py = [p["name"] for p in report["py_pkgs"] if not p["ok"]]
    missing_repo = [r["rel_path"] for r in report["external_repos"] if not r["exists"]]

    lines.append("## 修复建议")
    lines.append("")
    if not (missing_bin or missing_py or missing_repo):
        lines.append("所有检查通过 🎉")
    else:
        if missing_bin:
            lines.append(f"- 缺少命令行：{', '.join(missing_bin)}")
        if missing_py:
            lines.append(f"- 缺少 Python 包：`pip install {' '.join(missing_py)}`")
        if missing_repo:
            lines.append(f"- 缺少外部仓库，请运行 `pwsh scripts/setup_toolchain.ps1`")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--save-report", action="store_true", help="保存 markdown 报告到 docs/env-check-report.md")
    ap.add_argument("--json", action="store_true", help="仅输出 JSON")
    args = ap.parse_args()

    report = {
        "platform": f"{platform.system()} {platform.release()}",
        "python": sys.version.split()[0],
        "binaries": [check_binary(n, a) for n, a in BINARIES],
        "py_pkgs": [check_py(p) for p in PY_PKGS],
        "external_repos": [check_repo(r, u) for r, u in EXTERNAL_REPOS],
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    md = emit_markdown(report)
    print(md)

    if args.save_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(md, encoding="utf-8")
        print(f"\n[saved] {REPORT_PATH}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
