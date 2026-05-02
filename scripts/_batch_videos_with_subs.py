"""批量 (重新) 合成 Day 2 三条带字幕的完整视频."""
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

JOBS = [
    {
        "id": "01-token-salary",
        "text": "output/drafts/2026-04-22/01-token-salary-voice.txt",
        "image": "output/posters/salary_poster_2026-04.png",
    },
    {
        "id": "02-5w-lines",
        "text": "output/drafts/2026-04-22/02-5w-lines-voice.txt",
        "image": "output/posters/script-02-poster.png",
    },
    {
        "id": "03-9-lobsters",
        "text": "output/drafts/2026-04-22/03-9-lobsters-voice.txt",
        "image": "output/posters/script-03-poster.png",
    },
]


def run(cmd: list[str]) -> int:
    print(">>>", " ".join(cmd))
    r = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    return r.returncode


def main() -> int:
    for j in JOBS:
        base = PROJECT_ROOT / "output" / "video" / "2026-04-22" / j["id"]
        audio = base / "audio.mp3"
        srt = base / "audio.srt"
        final = base / "final.mp4"

        # 1) 生成 SRT
        rc = run([sys.executable, "scripts/text_to_srt.py",
                  "--text", j["text"],
                  "--audio", str(audio.relative_to(PROJECT_ROOT)),
                  "--output", str(srt.relative_to(PROJECT_ROOT))])
        if rc != 0:
            print(f"[!] SRT 失败 {j['id']}")
            continue

        # 2) 合成带字幕的视频
        rc = run([sys.executable, "scripts/quick_video.py",
                  "--image", j["image"],
                  "--audio", str(audio.relative_to(PROJECT_ROOT)),
                  "--output", str(final.relative_to(PROJECT_ROOT)),
                  "--srt", str(srt.relative_to(PROJECT_ROOT))])
        if rc != 0:
            print(f"[!] 视频 失败 {j['id']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
