"""videocut 统一包装器（阶段 1.1）。

薄封装 tools/videocut 下的 Node CLI，提供给 Jarvis 的 Python 代码统一调用。

用法（典型）：
    python wrap_videocut.py pipeline input.mp4 --steps autocut,subtitle,hook -o out/
    python wrap_videocut.py transcribe input.mp4 -o out/
    python wrap_videocut.py autocut input.mp4 -o out/
    python wrap_videocut.py subtitle input.mp4 -o out/ --burn

依赖：
    - Node.js 18+
    - FFmpeg
    - Claude CLI 或 OpenRouter/GLM（通过环境变量 CLAUDE_PATH 或 VIDEOCUT_LLM）
    - Whisper / faster-whisper / whisper.cpp
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
VIDEOCUT_DIR = PROJECT_ROOT / "tools" / "videocut"
CLI_ENTRY = VIDEOCUT_DIR / "cli.js"

VALID_CAPABILITIES = {
    "transcribe", "autocut", "subtitle", "hook",
    "clip", "cover", "speed", "pipeline",
}


def ensure_ready() -> tuple[bool, str]:
    if not VIDEOCUT_DIR.exists():
        return False, f"tools/videocut/ 不存在，请先运行 scripts/setup_toolchain.ps1"
    if not CLI_ENTRY.exists():
        return False, f"找不到 {CLI_ENTRY}"
    try:
        subprocess.run(["node", "--version"], check=True, capture_output=True)
    except Exception:
        return False, "需要 Node.js 18+，未安装或不在 PATH"
    return True, "OK"


def run(argv: list[str]) -> int:
    ok, msg = ensure_ready()
    if not ok:
        print(f"[videocut] 未就绪: {msg}", file=sys.stderr)
        return 2

    if not argv:
        print("usage: wrap_videocut.py <capability> [args...]", file=sys.stderr)
        print(f"  capability in {sorted(VALID_CAPABILITIES)}", file=sys.stderr)
        return 2

    cap = argv[0]
    if cap not in VALID_CAPABILITIES:
        print(f"[videocut] 未知能力: {cap}", file=sys.stderr)
        return 2

    cmd = ["node", str(CLI_ENTRY), *argv]
    env = os.environ.copy()
    if "CLAUDE_PATH" not in env and shutil_which("claude"):
        env["CLAUDE_PATH"] = shutil_which("claude") or ""

    print(f"[videocut] exec: {' '.join(shlex.quote(c) for c in cmd)}")
    try:
        proc = subprocess.run(cmd, cwd=str(VIDEOCUT_DIR), env=env)
        return proc.returncode
    except FileNotFoundError as e:
        print(f"[videocut] 执行失败: {e}", file=sys.stderr)
        return 1


def shutil_which(name: str) -> str | None:
    import shutil
    return shutil.which(name)


def info() -> dict:
    """给 Jarvis Agent 的 introspection：列出 videocut 所有 capabilities。"""
    caps_dir = VIDEOCUT_DIR / "capabilities"
    out = {"ready": VIDEOCUT_DIR.exists(), "capabilities": []}
    if caps_dir.exists():
        for d in sorted(caps_dir.iterdir()):
            if d.is_dir() and (d / "SKILL.md").exists():
                out["capabilities"].append(d.name)
    return out


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "--info":
        print(json.dumps(info(), ensure_ascii=False, indent=2))
        return 0
    return run(sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
