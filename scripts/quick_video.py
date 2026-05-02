"""快速视频合成器 —— 在 videocut/Claude CLI 就绪前，用纯 FFmpeg 出一条可发布视频。

原理：
    静态海报图 (1080×1440 竖版) × TTS 音频 → 1080×1920 抖音 mp4
    + 可选字幕烧录 (SRT)

适用场景：
    - 首发 Demo 视频（封面即内容）
    - Token 工资单、9 Agent 架构图、统计数据这类图文向内容

用法：
    python scripts/quick_video.py \
        --image output/posters/salary_poster_2026-04.png \
        --audio output/video/2026-04-22/01-token-salary/audio.mp3 \
        --output output/video/2026-04-22/01-token-salary/final.mp4
    # 带字幕
    python scripts/quick_video.py --image x.png --audio x.mp3 --output x.mp4 --srt x.srt

依赖：
    - ffmpeg（已装 8.0.1）
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        print("[!] 缺少 ffmpeg", file=sys.stderr)
        sys.exit(2)


def compose(image: Path, audio: Path, output: Path, size: str = "1080:1920",
            bg_color: str = "0x121622", srt: Path | None = None) -> int:
    """合成静帧视频。"""
    output.parent.mkdir(parents=True, exist_ok=True)

    # 视频滤镜：把海报缩放+居中铺到抖音竖屏 1080x1920 画布上
    vf_parts = [
        f"scale=w={size.split(':')[0]}:h=-2:force_original_aspect_ratio=decrease",
        f"pad={size}:-1:-1:color={bg_color}",
        "format=yuv420p",
    ]
    if srt:
        # 字幕烧录（注意 Windows 路径转义）
        srt_fixed = str(srt.resolve()).replace("\\", "/").replace(":", r"\:")
        vf_parts.append(
            f"subtitles=filename='{srt_fixed}':force_style='FontName=Microsoft YaHei,FontSize=18,PrimaryColour=&H00F0F4FF,OutlineColour=&H00121622,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60'"
        )
    vf = ",".join(vf_parts)

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(image),
        "-i", str(audio),
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-pix_fmt", "yuv420p",
        "-vf", vf,
        str(output),
    ]
    print("[ffmpeg]", " ".join(cmd))
    return subprocess.run(cmd).returncode


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--size", default="1080:1920", help="抖音竖屏 1080:1920，小红书 1080:1440")
    ap.add_argument("--bg", default="0x121622")
    ap.add_argument("--srt", default=None)
    args = ap.parse_args()

    ensure_ffmpeg()
    image = Path(args.image).resolve()
    audio = Path(args.audio).resolve()
    output = Path(args.output).resolve()
    srt = Path(args.srt).resolve() if args.srt else None

    for p in (image, audio):
        if not p.exists():
            print(f"[!] 找不到 {p}", file=sys.stderr)
            return 2
    if srt and not srt.exists():
        print(f"[!] SRT 不存在 {srt}", file=sys.stderr)
        return 2

    rc = compose(image, audio, output, size=args.size, bg_color=args.bg, srt=srt)
    if rc == 0:
        size = output.stat().st_size / 1024
        print(f"\n[OK] {output} ({size:.0f} KB)")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
