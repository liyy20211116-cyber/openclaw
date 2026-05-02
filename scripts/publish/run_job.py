"""从 JSON 作业描述批量跑发布器，避免 PowerShell 中文参数转义问题。

用法：
    python scripts/publish/run_job.py scripts/publish/jobs/first_blood.json

作业格式：
    {
      "jobs": [
        {
          "platform": "wechat-official",
          "action": "draft",
          "title": "...",
          "md": "output/publish/wechat-official/2026-04-22-token-salary.md",
          "cover": "assets/qr/wechat.png"
        },
        {
          "platform": "xiaohongshu",
          "action": "draft",
          "title": "...",
          "content_file": "output/drafts/2026-04-22/xhs-01-token-salary.md",
          "images": ["output/posters/salary_poster_2026-04.png"],
          "tags": ["AI创业", "一人公司"]
        }
      ]
    }
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

ROOT = Path(__file__).resolve().parent.parent.parent


def run_wechat(job: dict) -> int:
    from wechat_mp_publisher import publish
    return publish(
        title=job["title"],
        md_path=ROOT / job["md"],
        cover=ROOT / job["cover"] if job.get("cover") else None,
        dry_run=job.get("dry_run", False),
    )


def run_xhs(job: dict) -> int:
    from xhs_publisher import publish
    content = job.get("content", "")
    if job.get("content_file"):
        content = (ROOT / job["content_file"]).read_text(encoding="utf-8")
    return publish(
        title=job["title"],
        content=content,
        images=[ROOT / p for p in job.get("images", []) if (ROOT / p).exists()],
        tags=job.get("tags", []),
        publish_mode=job.get("publish", False),
        dry_run=job.get("dry_run", False),
    )


def run_douyin(job: dict) -> int:
    from douyin_publisher import publish
    return publish(
        video=ROOT / job["video"],
        title=job["title"],
        tags=job.get("tags", []),
        cover=ROOT / job["cover"] if job.get("cover") else None,
        publish_mode=job.get("publish", False),
        dry_run=job.get("dry_run", False),
    )


def run_bilibili(job: dict) -> int:
    from bilibili_uploader import publish
    return publish(
        video=ROOT / job["video"],
        title=job["title"],
        desc=job.get("desc", ""),
        tags=job.get("tags", []),
        dry_run=job.get("dry_run", False),
    )


DISPATCH = {
    "wechat-official": run_wechat,
    "xiaohongshu": run_xhs,
    "douyin": run_douyin,
    "bilibili": run_bilibili,
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("job_file", type=Path)
    ap.add_argument("--only", help="只跑某个 platform，例如 wechat-official")
    args = ap.parse_args()

    spec = json.loads(args.job_file.read_text(encoding="utf-8"))
    jobs = spec.get("jobs", [])

    summary = []
    for i, job in enumerate(jobs, 1):
        plat = job.get("platform")
        if args.only and plat != args.only:
            continue
        fn = DISPATCH.get(plat)
        if not fn:
            print(f"[skip] unknown platform: {plat}")
            continue
        print(f"\n{'=' * 60}\n[Job {i}/{len(jobs)}] {plat}: {job.get('title', '(no title)')}")
        t0 = time.time()
        try:
            code = fn(job)
            dt = time.time() - t0
            summary.append((plat, job.get("title", ""), "OK" if code == 0 else f"ERR({code})", f"{dt:.1f}s"))
            if code != 0:
                print(f"[!] Job returned {code}")
        except Exception as e:
            dt = time.time() - t0
            summary.append((plat, job.get("title", ""), f"EXC: {e}", f"{dt:.1f}s"))
            print(f"[!] Exception: {e}")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for plat, title, status, dt in summary:
        print(f"  [{status}] {plat:20} {dt:>8}  {title[:50]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
