"""openclip 长视频高光提取包装器（阶段 1.4）。

薄封装 tools/openclip 的 video_orchestrator.py。支持 Bilibili/YouTube URL 或本地 mp4。

用法：
    python wrap_openclip.py "https://www.bilibili.com/video/BVxxx" --top 5
    python wrap_openclip.py "D:\\raw\\livestream.mp4" --llm-provider glm

输出：
    - processed_videos/ 目录下 5 个高光 mp4
    - 每个片段带字幕、标题、封面
"""

from __future__ import annotations

import argparse
import os
import shlex
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
OPENCLIP_DIR = PROJECT_ROOT / "tools" / "openclip"
ORCH = OPENCLIP_DIR / "video_orchestrator.py"


def main() -> int:
    ap = argparse.ArgumentParser(description="openclip 高光提取")
    ap.add_argument("input", help="视频 URL 或本地文件路径")
    ap.add_argument("-o", "--output", default=None, help="输出目录（默认 processed_videos/）")
    ap.add_argument("--llm-provider", default="glm", choices=["qwen", "openrouter", "glm", "minimax"])
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--user-intent", default=None, help="引导 AI 聚焦的主题")
    ap.add_argument("--burn-subtitles", action="store_true")
    ap.add_argument("--subtitle-translation", default=None, help='e.g. "Simplified Chinese"')
    args = ap.parse_args()

    if not OPENCLIP_DIR.exists() or not ORCH.exists():
        print("[openclip] tools/openclip 未就绪，请先运行 setup_toolchain.ps1", file=sys.stderr)
        return 2

    cmd = ["uv", "run", "python", str(ORCH), args.input, "--llm-provider", args.llm_provider]
    if args.output:
        cmd += ["-o", args.output]
    if args.user_intent:
        cmd += ["--user-intent", args.user_intent]
    if args.burn_subtitles:
        cmd.append("--burn-subtitles")
    if args.subtitle_translation:
        cmd += ["--subtitle-translation", args.subtitle_translation]

    print(f"[openclip] exec: {' '.join(shlex.quote(c) for c in cmd)}")
    env = os.environ.copy()
    try:
        proc = subprocess.run(cmd, cwd=str(OPENCLIP_DIR), env=env)
        return proc.returncode
    except FileNotFoundError:
        print("[openclip] 需要 uv（https://astral.sh/uv/install.ps1）", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
