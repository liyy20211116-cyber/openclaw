"""小红书图文发布器（接管 CEO 已登录的 Chrome）。

用法（草稿模式）：
    python scripts/publish/xhs_publisher.py \\
        --title "我给9个AI员工发工资" \\
        --content-file output/drafts/2026-04-22/xhs-08-first-income.md \\
        --images output/posters/xhs-08-cover.png output/posters/xhs-08-proof.png \\
        --tags "AI创业" "一人公司" "副业"

Flags：
    --publish    直接发布（默认存草稿）
    --dry-run    只 fill 表单不提交，让 CEO 肉眼 review

设计要点：
    - 发布流程中插入多处随机停顿（human_sleep），减少被风控概率
    - 标题超过 20 字自动截断（小红书限制）
    - 默认存草稿（publish=False），CEO 在后台点「发布」，零风险起步
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

PUBLISH_URL = "https://creator.xiaohongshu.com/publish/publish"


def publish(
    title: str,
    content: str,
    images: list[Path],
    tags: list[str],
    publish_mode: bool = False,
    dry_run: bool = False,
    port: int = DEFAULT_CDP_PORT,
) -> int:
    pw, browser, context, _ = connect_cdp(port)
    try:
        page = goto_tab_or_new(context, "xiaohongshu.com", PUBLISH_URL)
        # 每次都强制刷新到干净的发布页（避免上一条 job 的残留）
        print(f"[xhs] 导航到干净发布页...")
        try:
            page.goto(PUBLISH_URL, wait_until="domcontentloaded", timeout=20000)
        except Exception as e:
            print(f"[xhs] goto 失败（{e}）")
        human_sleep(3.0, 4.5)
        print(f"[xhs] 发布页：{page.url}")

        # 切到「上传图文」tab（默认是视频 tab，必须主动切）- 带重试
        switched = False
        for attempt in range(8):
            try:
                switched = page.evaluate("""
                    () => {
                        const nodes = [...document.querySelectorAll('*')];
                        for (const n of nodes) {
                            if (n.children.length > 0) continue;
                            const t = (n.textContent || '').trim();
                            if (t === '上传图文') {
                                let el = n;
                                for (let i=0; i<6 && el; i++) {
                                    if (el.getAttribute && (el.getAttribute('role') === 'tab' || (el.className || '').toString().match(/tab/i))) {
                                        el.click();
                                        return true;
                                    }
                                    el = el.parentElement;
                                }
                                n.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                if switched:
                    print(f"[xhs] 已点击『上传图文』tab（第 {attempt+1} 次尝试）")
                    break
            except Exception as e:
                print(f"[xhs] 切 tab 异常：{e}")
            page.wait_for_timeout(1500)
        if not switched:
            print("[xhs] 8 次重试仍未找到『上传图文』文本节点，尝试刷新页面...")
            try:
                page.reload(wait_until="domcontentloaded", timeout=20000)
                human_sleep(3.0, 4.5)
                switched = page.evaluate("""
                    () => {
                        const nodes = [...document.querySelectorAll('*')];
                        for (const n of nodes) {
                            if (n.children.length > 0) continue;
                            if ((n.textContent || '').trim() === '上传图文') {
                                let el = n;
                                for (let i=0; i<6 && el; i++) {
                                    if (el.getAttribute && (el.getAttribute('role') === 'tab' || (el.className || '').toString().match(/tab/i))) {
                                        el.click(); return true;
                                    }
                                    el = el.parentElement;
                                }
                                n.click(); return true;
                            }
                        }
                        return false;
                    }
                """)
                print(f"[xhs] reload 后 switched={switched}")
            except Exception as e:
                print(f"[xhs] reload 失败：{e}")
        human_sleep(1.5, 2.5)

        # 上传图片
        if images:
            print(f"[xhs] 上传 {len(images)} 张图片...")
            # 等 input 的 accept 变成图片
            try:
                for _ in range(10):
                    accept = page.evaluate("""() => {
                        const inp = document.querySelector('input[type=file]');
                        return inp ? (inp.accept || '') : '';
                    }""")
                    if accept and ("image" in accept or ".png" in accept or ".jpg" in accept or ".jpeg" in accept):
                        break
                    page.wait_for_timeout(500)
                file_input = page.locator('input[type="file"]').first
                file_input.wait_for(state="attached", timeout=10000)
                file_input.set_input_files([str(p) for p in images])
            except Exception as e:
                print(f"[xhs] input[type=file] 上传失败（{e}），当前 URL: {page.url}")
                return 1
            human_sleep(3.5, 5.5)

        # 剥掉 markdown frontmatter + 标题 #
        body = content
        if body.startswith("---"):
            parts = body.split("---", 2)
            if len(parts) >= 3:
                body = parts[2].lstrip("\n")
        lines = []
        for line in body.split("\n"):
            if line.startswith("# "):
                lines.append(line[2:])
            elif line.startswith("## "):
                lines.append(line[3:])
            elif line.startswith("### "):
                lines.append(line[4:])
            else:
                lines.append(line.replace("**", "").replace("`", ""))
        body = "\n".join(lines).strip()

        # 标题（小红书限 20 字）
        title_short = title[:20]
        try:
            title_input = page.locator('input[placeholder*="标题"], input[placeholder*="填写标题"]').first
            title_input.click()
            human_sleep()
            title_input.fill("")
            title_input.type(title_short, delay=human_type_delay())
            human_sleep()
            print(f"[xhs] 标题已填：{title_short}")
        except Exception as e:
            print(f"[xhs] 标题填写失败：{e}")

        # 正文：用 keyboard.insert_text 一次性插入（tiptap 兼容，比 type 稳）
        try:
            body_with_tags = body + "\n\n" + " ".join(f"#{t}" for t in tags[:5])
            body_with_tags = body_with_tags[:900]
            content_area = page.locator('[contenteditable="true"]').first
            content_area.click()
            human_sleep(0.4, 0.8)
            # 清空（如果有默认内容）
            page.keyboard.press("Control+A")
            human_sleep(0.2, 0.4)
            page.keyboard.press("Delete")
            human_sleep(0.3, 0.6)
            # 一次性插入
            page.keyboard.insert_text(body_with_tags)
            human_sleep(1.2, 2.0)
            print("[xhs] 正文已插入")
        except Exception as e:
            print(f"[xhs] 正文插入失败：{e}")
            return 1

        print("[xhs] 表单已填写完成。")

        if dry_run:
            print("[xhs] dry-run 模式：不提交，等 CEO 手动 review + 发布。")
            return 0

        if publish_mode:
            print("[xhs] 点击『发布』按钮（真实发布）...")
            page.get_by_role("button", name="发布").click(timeout=10000)
        else:
            print("[xhs] 点击『存草稿』按钮（安全模式）...")
            page.keyboard.press("Escape")
            page.wait_for_timeout(700)
            try:
                clicked = page.evaluate("""
                    () => {
                        const labels = ['存草稿', '暂存', '保存草稿'];
                        const candidates = [...document.querySelectorAll('button, .d-button, [role="button"]')];
                        for (const label of labels) {
                            const target = candidates.find((node) => {
                                const text = (node.innerText || node.textContent || '').trim();
                                const box = node.getBoundingClientRect();
                                return text.includes(label) && box.width > 0 && box.height > 0;
                            });
                            if (target) {
                                target.scrollIntoView({ block: 'center', inline: 'center' });
                                target.click();
                                return label;
                            }
                        }
                        return '';
                    }
                """)
                if not clicked:
                    page.get_by_role("button", name="存草稿").click(timeout=5000, force=True)
                else:
                    print(f"[xhs] 已点击：{clicked}")
            except Exception as e:
                print(f"[xhs] 存草稿失败：{e}")
                return 1

        human_sleep(2.0, 3.5)
        log_publish("xiaohongshu", {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "title": title_short,
            "images": [str(p) for p in images],
            "tags": tags,
            "mode": "publish" if publish_mode else "draft",
        })
        print("[OK] 小红书提交完成，请在创作平台后台核对。")
        return 0
    finally:
        try:
            pw.stop()
        except Exception:
            pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--content-file", type=Path)
    ap.add_argument("--content", default="")
    ap.add_argument("--images", nargs="+", type=Path, default=[])
    ap.add_argument("--tags", nargs="+", default=["AI创业", "一人公司"])
    ap.add_argument("--publish", action="store_true", help="真实发布（默认存草稿）")
    ap.add_argument("--dry-run", action="store_true", help="只填表不提交")
    ap.add_argument("--port", type=int, default=DEFAULT_CDP_PORT)
    args = ap.parse_args()

    content = args.content
    if args.content_file and args.content_file.exists():
        content = args.content_file.read_text(encoding="utf-8")

    if not content.strip():
        ap.error("必须通过 --content 或 --content-file 提供正文")

    return publish(
        title=args.title,
        content=content,
        images=[p for p in (args.images or []) if p.exists()],
        tags=args.tags,
        publish_mode=args.publish,
        dry_run=args.dry_run,
        port=args.port,
    )


if __name__ == "__main__":
    sys.exit(main())
