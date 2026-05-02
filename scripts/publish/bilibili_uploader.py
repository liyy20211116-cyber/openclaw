"""B 站视频投稿（接管已登录的 member.bilibili.com）。

用法：
    python scripts/publish/bilibili_uploader.py \\
        --video output/videos/bilibili-15min-compilation.mp4 \\
        --title "一个人+9个AI员工=一家公司" \\
        --desc "这是我 4 月的 Token 工资单。5 万行代码，9 个 AI 员工..." \\
        --tags "AI创业" "一人公司" "AI工具" "Claude"
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

UPLOAD_URL = "https://member.bilibili.com/platform/upload/video/frame"


def publish(
    video: Path,
    title: str,
    desc: str,
    tags: list[str],
    port: int = DEFAULT_CDP_PORT,
    dry_run: bool = False,
) -> int:
    if not video.exists():
        print(f"[ERR] 视频不存在：{video}")
        return 1

    pw, browser, context, _ = connect_cdp(port)
    try:
        page = goto_tab_or_new(context, "member.bilibili.com", UPLOAD_URL)
        human_sleep(2.0, 3.5)
        print(f"[bilibili] 当前：{page.url}")

        print(f"[bilibili] 上传视频：{video.name} ({video.stat().st_size / 1024 / 1024:.1f} MB)")
        file_input = page.locator('input[type="file"]').first
        file_input.set_input_files(str(video))
        human_sleep(3.0, 5.0)

        # 标题
        title_sel = page.locator('input.input-val, input[placeholder*="标题"]').first
        title_sel.click()
        human_sleep()
        title_sel.fill("")
        title_sel.type(title[:80], delay=human_type_delay())
        human_sleep()

        # 标签（B站标签需要回车提交）
        try:
            tag_box = page.locator('.tag-container input, input[placeholder*="标签"]').first
            tag_box.click()
            for t in tags[:10]:
                tag_box.type(t, delay=80)
                human_sleep(0.4, 0.8)
                tag_box.press("Enter")
                human_sleep(0.3, 0.6)
        except Exception as e:
            print(f"[bilibili] 标签填写失败（{e}），请 CEO 手动补充。")

        # 简介
        try:
            desc_area = page.locator('[contenteditable="true"], textarea.description').first
            desc_area.click()
            desc_area.type(desc[:2000], delay=20)
        except Exception:
            pass

        print("[bilibili] 表单已填写。")
        if dry_run:
            print("[bilibili] dry-run：等 CEO 肉眼 review + 点「立即投稿」。")
            return 0

        try:
            page.get_by_text("立即投稿").first.click(timeout=10000)
        except Exception:
            print("[bilibili] 没找到『立即投稿』按钮，可能需要 CEO 补全分区/封面。")

        human_sleep(2.0, 3.0)
        log_publish("bilibili", {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "video": str(video),
            "title": title,
            "tags": tags,
            "mode": "submit",
        })
        print("[OK] B 站投稿提交完成。")
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
    ap.add_argument("--desc", default="")
    ap.add_argument("--tags", nargs="+", default=["AI创业", "一人公司"])
    ap.add_argument("--port", type=int, default=DEFAULT_CDP_PORT)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    return publish(args.video, args.title, args.desc, args.tags, args.port, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
