"""抖音视频发布器（接管已登录的 Chrome）。

用法：
    python scripts/publish/douyin_publisher.py \\
        --video output/videos/01-token-salary.mp4 \\
        --title "我给9个AI员工发工资#一人公司#AI创业" \\
        --tags "AI" "一人公司" "副业"

    默认是「存草稿」模式（提交到创作者中心的作品管理→草稿），加 --publish 才真实发布。
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import (
    DEFAULT_CDP_PORT, connect_cdp, goto_tab_or_new,
    human_sleep, log_publish, human_type_delay,
)

UPLOAD_URL = "https://creator.douyin.com/creator-micro/content/upload"


def publish(
    video: Path,
    title: str,
    tags: list[str],
    publish_mode: bool = False,
    dry_run: bool = False,
    port: int = DEFAULT_CDP_PORT,
    cover: Path | None = None,
) -> int:
    if not video.exists():
        print(f"[ERR] 视频不存在：{video}")
        return 1

    pw, browser, context, _ = connect_cdp(port)
    try:
        page = goto_tab_or_new(context, "creator.douyin.com", UPLOAD_URL)
        human_sleep(2.0, 3.5)
        print(f"[douyin] 当前：{page.url}")

        # 上传视频
        print(f"[douyin] 上传视频：{video.name} ({video.stat().st_size / 1024 / 1024:.1f} MB)")
        file_input = page.locator('input[type="file"]').first
        file_input.set_input_files(str(video))

        # 等上传完成（检查进度条消失）
        print("[douyin] 等待上传与转码... (最多 120s)")
        for _ in range(60):
            human_sleep(1.8, 2.5)
            # 标题输入框一般要等转码开始后才可编辑
            if page.locator('input[placeholder*="标题"], [contenteditable="true"]').first.is_visible():
                break

        # 标题
        full_title = title + " " + " ".join(f"#{t}" for t in tags[:5])
        full_title = full_title[:55]  # 抖音标题限制
        title_sel = page.locator('input[placeholder*="标题"], [contenteditable="true"]').first
        title_sel.click()
        human_sleep()
        title_sel.fill("")
        title_sel.type(full_title, delay=human_type_delay())
        human_sleep()

        if cover and cover.exists():
            print(f"[douyin] 自定义封面：{cover.name}（模块预留位，需要先定位封面上传按钮）")

        print("[douyin] 表单已填写。")

        if dry_run:
            print("[douyin] dry-run：表单已填好，等 CEO 手工点发布。")
            return 0

        if publish_mode:
            print("[douyin] 点击『发布』...")
            try:
                page.get_by_role("button", name="发布").click(timeout=10000)
            except Exception:
                page.get_by_text("发布视频").click(timeout=10000)
        else:
            print("[douyin] 点击『存草稿』...")
            try:
                page.get_by_text("存草稿").first.click(timeout=5000)
            except Exception:
                print("[douyin] 没找到『存草稿』按钮，降级：不提交。等 CEO 手动处理。")
                return 0

        human_sleep(2.0, 3.5)
        log_publish("douyin", {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "video": str(video),
            "title": full_title,
            "tags": tags,
            "mode": "publish" if publish_mode else "draft",
        })
        print("[OK] 抖音提交完成。")
        return 0
    finally:
        try:
            pw.stop()
        except Exception:
            pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, type=Path)
    ap.add_argument("--title", required=True)
    ap.add_argument("--tags", nargs="+", default=["一人公司", "AI创业"])
    ap.add_argument("--cover", type=Path)
    ap.add_argument("--publish", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--port", type=int, default=DEFAULT_CDP_PORT)
    args = ap.parse_args()

    return publish(
        video=args.video,
        title=args.title,
        tags=args.tags,
        cover=args.cover,
        publish_mode=args.publish,
        dry_run=args.dry_run,
        port=args.port,
    )


if __name__ == "__main__":
    sys.exit(main())
