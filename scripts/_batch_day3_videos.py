"""批量生产脚本 04-07 的海报+TTS+带字幕视频 (Day 3-7 发布储备).

流程：
  1. 生成海报（make_quote_poster）
  2. TTS 合成（wrap_tts）
  3. 文本→SRT（text_to_srt）
  4. 海报+音频+字幕→MP4（quick_video --srt）
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_quote_poster import make as make_poster  # type: ignore  # noqa: E402

JOBS = [
    {
        "id": "04-audit-catch",
        "title": "AI审计官每天偷偷查其他AI摸鱼",
        "subtitle": "Token花销·质量分析·ROI预估 · AI管AI的时代",
        "theme": "cyber",
        "text": "output/drafts/2026-04-22/04-audit-catch-voice.txt",
    },
    {
        "id": "05-ai-meeting",
        "title": "月度会议，现场只有一个碳基人",
        "subtitle": "9个AI员工开会 · 1小时搞定以前3小时的会",
        "theme": "default",
        "text": "output/drafts/2026-04-22/05-ai-meeting-voice.txt",
    },
    {
        "id": "06-ai-write-scripts",
        "title": "AI写10条抖音脚本 · 我一个字没改",
        "subtitle": "30分钟交稿 · 比我自己写的还能打",
        "theme": "gold",
        "text": "output/drafts/2026-04-22/06-ai-write-scripts-voice.txt",
    },
    {
        "id": "07-3k-ops-cost",
        "title": "月薪3千养9个员工 · 真实账本",
        "subtitle": "LLM 1800 · TTS 0 · 视频 0 · 算力 200 · 对比传统团队 1/10",
        "theme": "hot",
        "text": "output/drafts/2026-04-22/07-3k-ops-cost-voice.txt",
    },
]


def run(cmd: list[str]) -> int:
    print(">>>", " ".join(cmd))
    r = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    return r.returncode


def main() -> int:
    py = sys.executable
    for j in JOBS:
        job_dir = PROJECT_ROOT / "output" / "video" / "2026-04-22" / j["id"]
        poster = PROJECT_ROOT / "output" / "posters" / f"{j['id']}-poster.png"
        audio = job_dir / "audio.mp3"
        srt = job_dir / "audio.srt"
        final = job_dir / "final.mp4"

        # 1) 海报
        make_poster(
            title=j["title"],
            subtitle=j["subtitle"],
            output=poster,
            theme=j["theme"],
        )

        # 2) TTS
        rc = run([py, "skills/video-edit-cli/scripts/wrap_tts.py",
                  "--file", j["text"],
                  "--voice", "zh-CN-YunxiNeural",
                  "--output", str(audio.relative_to(PROJECT_ROOT))])
        if rc != 0:
            print(f"[!] TTS 失败 {j['id']}")
            continue

        # 3) SRT
        rc = run([py, "scripts/text_to_srt.py",
                  "--text", j["text"],
                  "--audio", str(audio.relative_to(PROJECT_ROOT)),
                  "--output", str(srt.relative_to(PROJECT_ROOT))])
        if rc != 0:
            print(f"[!] SRT 失败 {j['id']}")
            continue

        # 4) 视频
        rc = run([py, "scripts/quick_video.py",
                  "--image", str(poster.relative_to(PROJECT_ROOT)),
                  "--audio", str(audio.relative_to(PROJECT_ROOT)),
                  "--output", str(final.relative_to(PROJECT_ROOT)),
                  "--srt", str(srt.relative_to(PROJECT_ROOT))])
        if rc != 0:
            print(f"[!] 视频失败 {j['id']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
