"""口播视频一键成片流水线（阶段 2.2）。

编排 videocut 的 7 能力，从录屏到发布素材全自动：
    input.mp4 → transcribe → autocut → subtitle → hook → cover → speed → 成片 + 4 条钩子 + 封面

用法：
    python pipeline_koubo.py --input D:/raw/recording.mp4 --output D:/FY003/output/video/20260422/
    python pipeline_koubo.py --input xxx.mp4 --steps autocut,subtitle,hook
    python pipeline_koubo.py --input xxx.mp4 --skip-cover --skip-speed
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
WRAPPER = PROJECT_ROOT / "skills" / "video-edit-cli" / "scripts" / "wrap_videocut.py"


DEFAULT_STEPS = ["autocut", "subtitle", "hook", "cover", "speed"]


def run_step(step: str, input_path: Path, output_dir: Path, extra: list[str] | None = None) -> int:
    cmd = ["python", str(WRAPPER), step, str(input_path), "-o", str(output_dir)]
    if extra:
        cmd += extra
    print(f"\n>>> step: {step}")
    print(" ".join(cmd))
    return subprocess.run(cmd).returncode


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", default=None)
    ap.add_argument("--steps", default=",".join(DEFAULT_STEPS))
    ap.add_argument("--skip-cover", action="store_true")
    ap.add_argument("--skip-speed", action="store_true")
    ap.add_argument("--platform", default="douyin", help="douyin / xiaohongshu / bilibili / youtube")
    ap.add_argument("--style", default="luna-tech-cool")
    ap.add_argument("--burn-subtitles", action="store_true")
    ap.add_argument("--hook-count", type=int, default=4)
    ap.add_argument("--speed-rate", default="1.1")
    args = ap.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"[!] 找不到 {input_path}", file=sys.stderr)
        return 2

    output_dir = Path(args.output).resolve() if args.output else (
        PROJECT_ROOT / "output" / "video" / input_path.stem
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    requested = [s.strip() for s in args.steps.split(",") if s.strip()]
    if args.skip_cover and "cover" in requested:
        requested.remove("cover")
    if args.skip_speed and "speed" in requested:
        requested.remove("speed")

    print(f"[pipeline] 输入 {input_path}")
    print(f"[pipeline] 输出 {output_dir}")
    print(f"[pipeline] 步骤 {requested}")
    print(f"[pipeline] 平台 {args.platform} · 风格 {args.style}")

    summary = {"input": str(input_path), "output": str(output_dir), "platform": args.platform,
               "style": args.style, "steps": [], "failed": []}

    for step in requested:
        extra: list[str] = []
        if step == "subtitle" and args.burn_subtitles:
            extra += ["--burn"]
        if step == "hook":
            extra += ["--count", str(args.hook_count)]
        if step == "speed":
            extra += ["--rate", args.speed_rate]
        rc = run_step(step, input_path, output_dir, extra)
        summary["steps"].append({"step": step, "rc": rc})
        if rc != 0:
            summary["failed"].append(step)
            print(f"[!] step {step} 失败 rc={rc}")

    report_path = output_dir / "pipeline_summary.json"
    report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[OK] 报告：{report_path}")
    if summary["failed"]:
        print(f"[!] 有失败步骤：{summary['failed']}")
        return 1
    print("[pipeline] 全部完成 🎉")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
