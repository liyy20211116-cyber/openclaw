"""按中文标点切句 + 按音频时长比例分配时间戳 → SRT.

对抖音竖屏视频的字幕效果：每句一行，底部居中显示，字级不做严格精确对齐，但完全够用.

用法：
    python scripts/text_to_srt.py \
        --text output/drafts/2026-04-22/01-token-salary-voice.txt \
        --audio output/video/2026-04-22/01-token-salary/audio.mp3 \
        --output output/video/2026-04-22/01-token-salary/audio.srt
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


SPLIT_RE = re.compile(r"(?<=[。！？!?；;])\s*|\n+")
# 兼容逗号/顿号：若句子太长时再细分
SOFT_SPLIT_RE = re.compile(r"(?<=[，、,])\s*")

MAX_LINE_CHARS = 28  # 抖音竖屏一行最多约 14-16 汉字，双行约 28


def probe_duration(audio: Path) -> float:
    if shutil.which("ffprobe") is None:
        return 0.0
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(audio)],
            capture_output=True, text=True, timeout=15,
        )
        return float((r.stdout or "0").strip() or 0)
    except Exception:
        return 0.0


def split_into_lines(text: str) -> list[str]:
    lines: list[str] = []
    raw = text.strip()
    parts = SPLIT_RE.split(raw)
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(p) <= MAX_LINE_CHARS:
            lines.append(p)
            continue
        # 太长 → 再用软标点切
        sub = [s.strip() for s in SOFT_SPLIT_RE.split(p) if s.strip()]
        buf = ""
        for s in sub:
            if len(buf) + len(s) <= MAX_LINE_CHARS:
                buf = (buf + "，" + s) if buf else s
            else:
                if buf:
                    lines.append(buf)
                buf = s
        if buf:
            lines.append(buf)
    return lines


def seconds_to_srt_ts(sec: float) -> str:
    if sec < 0:
        sec = 0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms >= 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(lines: list[str], total_duration: float) -> str:
    total_chars = sum(len(s) for s in lines) or 1
    out: list[str] = []
    t = 0.0
    for idx, line in enumerate(lines, 1):
        portion = len(line) / total_chars
        dur = max(0.9, total_duration * portion)
        start = t
        end = t + dur
        if idx == len(lines):
            end = total_duration  # 最后一句盖到结束
        out.append(str(idx))
        out.append(f"{seconds_to_srt_ts(start)} --> {seconds_to_srt_ts(end)}")
        out.append(line)
        out.append("")
        t = end
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--duration", type=float, default=0, help="手动指定时长（秒），否则自动 ffprobe")
    args = ap.parse_args()

    text_path = Path(args.text)
    audio_path = Path(args.audio)
    if not text_path.exists():
        print(f"[!] 文本不存在 {text_path}", file=sys.stderr)
        return 2
    if not audio_path.exists():
        print(f"[!] 音频不存在 {audio_path}", file=sys.stderr)
        return 2

    dur = args.duration or probe_duration(audio_path)
    if dur <= 0:
        print("[!] 无法获取音频时长（需 ffprobe 或 --duration）", file=sys.stderr)
        return 2

    lines = split_into_lines(text_path.read_text(encoding="utf-8"))
    if not lines:
        print("[!] 切句为空", file=sys.stderr)
        return 2

    srt = build_srt(lines, dur)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(srt, encoding="utf-8")
    print(f"[OK] SRT -> {out}  ({len(lines)} lines, {dur:.1f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
