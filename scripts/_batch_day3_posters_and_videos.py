"""补齐脚本 09 + 10 的海报 + TTS + 带字幕视频（脚本 08 等真实营收数据后再做）."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_quote_poster import make as make_poster  # type: ignore  # noqa: E402

JOBS = [
    {
        "id": "09-year-bonus",
        "title": "我给AI员工发年终奖 · 发的是Token",
        "subtitle": "KPI99翻倍 · 播放破百万加薪30% · AI绩效比人类公平",
        "theme": "gold",
        "text": "output/drafts/2026-04-22/09-year-bonus-voice.txt",
    },
    {
        "id": "10-opc-policy",
        "title": "开一家一人公司 政府倒贴1000万",
        "subtitle": "22+城市OPC政策 · 杭州/上海/深圳/北京海淀 全覆盖",
        "theme": "default",
        "text": "output/drafts/2026-04-22/10-opc-policy-voice.txt",
    },
]


def run(cmd: list[str]) -> int:
    print(">>>", " ".join(cmd))
    return subprocess.run(cmd, cwd=str(PROJECT_ROOT)).returncode


def main() -> int:
    py = sys.executable
    for j in JOBS:
        job_dir = PROJECT_ROOT / "output" / "video" / "2026-04-22" / j["id"]
        poster = PROJECT_ROOT / "output" / "posters" / f"{j['id']}-poster.png"
        audio = job_dir / "audio.mp3"
        srt = job_dir / "audio.srt"
        final = job_dir / "final.mp4"
        make_poster(j["title"], j["subtitle"], poster, j["theme"])
        run([py, "skills/video-edit-cli/scripts/wrap_tts.py",
             "--file", j["text"], "--voice", "zh-CN-YunxiNeural",
             "--output", str(audio.relative_to(PROJECT_ROOT))])
        run([py, "scripts/text_to_srt.py",
             "--text", j["text"],
             "--audio", str(audio.relative_to(PROJECT_ROOT)),
             "--output", str(srt.relative_to(PROJECT_ROOT))])
        run([py, "scripts/quick_video.py",
             "--image", str(poster.relative_to(PROJECT_ROOT)),
             "--audio", str(audio.relative_to(PROJECT_ROOT)),
             "--output", str(final.relative_to(PROJECT_ROOT)),
             "--srt", str(srt.relative_to(PROJECT_ROOT))])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
