"""首笔营收里程碑发布脚本。

CEO 收到第一笔收入后，跑一条命令就能自动：
    1. 把 08-first-income-voice.txt 里的占位符替换为真实金额/天数
    2. 生成配套海报（make_quote_poster）
    3. 跑 TTS + SRT + 视频合成
    4. 追加到 output/publish/ 发布清单

用法：
    python scripts/publish_income_milestone.py --amount 2999 --days 90 \
        --buyer-count 3 --highest-sku "标准版年付"
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
VOICE_TEXT = PROJECT_ROOT / "output" / "drafts" / "2026-04-22" / "08-first-income-voice.txt"
DATE_DIR = "2026-04-22"
JOB_ID = "08-first-income"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--amount", type=int, required=True, help="当月累计营收 ¥")
    ap.add_argument("--days", type=int, default=90, help="距辞职天数")
    ap.add_argument("--buyer-count", type=int, default=1, help="累计下单客户数")
    ap.add_argument("--highest-sku", default="启航版", help="最大订单套餐名")
    args = ap.parse_args()

    raw = VOICE_TEXT.read_text(encoding="utf-8")
    voice_txt = (
        raw.replace("XXXXX", str(args.amount))
           .replace("XX", str(args.days))
           .replace("X万多", f"{args.amount / 10000:.1f}万")
    )

    job_dir = PROJECT_ROOT / "output" / "video" / DATE_DIR / JOB_ID
    job_dir.mkdir(parents=True, exist_ok=True)
    final_voice = job_dir / "voice.txt"
    final_voice.write_text(voice_txt, encoding="utf-8")

    poster_path = PROJECT_ROOT / "output" / "posters" / f"{JOB_ID}-poster.png"
    audio_path = job_dir / "audio.mp3"
    srt_path = job_dir / "audio.srt"
    video_path = job_dir / "final.mp4"

    sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
    from make_quote_poster import make as make_poster  # type: ignore

    make_poster(
        title=f"一人公司90天·月入¥{args.amount}",
        subtitle=f"{args.buyer_count} 个客户 · {args.highest_sku} · 毛利 >90%",
        output=poster_path,
        theme="gold",
    )
    print(f"[OK] poster -> {poster_path}")

    py = sys.executable
    subprocess.run([py, "skills/video-edit-cli/scripts/wrap_tts.py",
                    "--file", str(final_voice.relative_to(PROJECT_ROOT)),
                    "--voice", "zh-CN-YunxiNeural",
                    "--output", str(audio_path.relative_to(PROJECT_ROOT))],
                   cwd=str(PROJECT_ROOT), check=True)

    subprocess.run([py, "scripts/text_to_srt.py",
                    "--text", str(final_voice.relative_to(PROJECT_ROOT)),
                    "--audio", str(audio_path.relative_to(PROJECT_ROOT)),
                    "--output", str(srt_path.relative_to(PROJECT_ROOT))],
                   cwd=str(PROJECT_ROOT), check=True)

    subprocess.run([py, "scripts/quick_video.py",
                    "--image", str(poster_path.relative_to(PROJECT_ROOT)),
                    "--audio", str(audio_path.relative_to(PROJECT_ROOT)),
                    "--output", str(video_path.relative_to(PROJECT_ROOT)),
                    "--srt", str(srt_path.relative_to(PROJECT_ROOT))],
                   cwd=str(PROJECT_ROOT), check=True)

    print("=" * 80)
    print(f"[OK] 首笔营收里程碑视频已生成：{video_path}")
    print(f"     海报：{poster_path}")
    print(f"     下一步：把 final.mp4 发到抖音 / B 站 / 视频号")
    print("=" * 80)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
