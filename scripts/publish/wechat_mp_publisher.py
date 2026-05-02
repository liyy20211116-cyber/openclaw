"""公众号草稿箱发布器（接管已登录的公众号后台）。

约束：
    - 个人订阅号没有群发 API，必须走后台 UI。
    - 每日群发次数受平台限制（订阅号 1 次/日）。
    - 为安全起见，默认只「存草稿」，CEO 在后台点「群发」。
    - 支持把 markdown → HTML 贴到「全能编辑器」的富文本区。

用法：
    python scripts/publish/wechat_mp_publisher.py \\
        --title "我给9个AI员工发工资：Token工资单首曝光" \\
        --md output/publish/wechat-official/2026-04-22-token-salary.md \\
        --cover assets/qr/wechat.png
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import (
    DEFAULT_CDP_PORT, connect_cdp, goto_tab_or_new,
    human_sleep, log_publish, human_type_delay,
)

MP_HOME = "https://mp.weixin.qq.com/"


def md_to_html_basic(md: str) -> str:
    """把 md 转成最基本的 HTML。不追求完美，后台编辑器会自己再排版一次。"""
    lines = md.split("\n")
    html_parts: list[str] = []
    in_code = False
    for line in lines:
        if line.startswith("```"):
            in_code = not in_code
            html_parts.append("<pre>" if in_code else "</pre>")
            continue
        if in_code:
            html_parts.append(line.replace("<", "&lt;").replace(">", "&gt;"))
            continue
        if line.startswith("### "):
            html_parts.append(f"<h3>{line[4:]}</h3>")
        elif line.startswith("## "):
            html_parts.append(f"<h2>{line[3:]}</h2>")
        elif line.startswith("# "):
            html_parts.append(f"<h1>{line[2:]}</h1>")
        elif line.startswith("> "):
            html_parts.append(f"<blockquote>{line[2:]}</blockquote>")
        elif line.strip() == "":
            html_parts.append("<br/>")
        else:
            text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", line)
            text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
            html_parts.append(f"<p>{text}</p>")
    return "\n".join(html_parts)


def publish(
    title: str,
    md_path: Path,
    cover: Path | None = None,
    port: int = DEFAULT_CDP_PORT,
    dry_run: bool = False,
) -> int:
    if not md_path.exists():
        print(f"[ERR] MD 文件不存在：{md_path}")
        return 1

    md = md_path.read_text(encoding="utf-8")
    html = md_to_html_basic(md)

    pw, browser, context, _ = connect_cdp(port)
    try:
        page = goto_tab_or_new(context, "mp.weixin.qq.com", MP_HOME)
        human_sleep(2.0, 3.5)

        if "mp.weixin.qq.com" not in (page.url or ""):
            print(f"[ERR] 当前不是公众号后台，请先在 Chrome 里登录 mp.weixin.qq.com")
            return 1

        print(f"[mp] 当前：{page.url}")
        print("[mp] 注意：公众号后台 UI 改版频繁，此脚本采用『半自动』：")
        print("     1) 打开图文素材编辑器 2) 填入标题 3) 把 HTML 复制到剪贴板")
        print("     CEO 到了编辑器页面后，手动 Ctrl+V 粘贴正文、选封面、点存草稿")

        # 把 HTML 写入剪贴板（通过浏览器 JS）
        import json as _json
        page.evaluate("""
            async (text) => {
                await navigator.clipboard.writeText(text);
            }
        """, html)
        print("[mp] HTML 已写入剪贴板。")

        # 跳到图文编辑页（若菜单在侧栏）
        try:
            page.get_by_text("图文素材").first.click(timeout=5000)
            human_sleep(1.2, 2.0)
        except Exception:
            pass

        if dry_run:
            print("[mp] dry-run：已跳到素材页 + HTML 在剪贴板。等 CEO 手动新建图文 → 粘贴。")
        else:
            try:
                page.get_by_text("新的创作").first.click(timeout=5000)
                human_sleep(1.0, 1.8)
                page.get_by_text("写新图文").first.click(timeout=5000)
                human_sleep(2.5, 3.5)
            except Exception as e:
                print(f"[mp] 自动导航失败（{e}），请 CEO 手动点『新的创作 → 写新图文』。")

        log_publish("wechat-official", {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "title": title,
            "md": str(md_path),
            "cover": str(cover) if cover else None,
            "mode": "semi-auto-draft",
        })
        print("[OK] 公众号编辑器已开启，HTML 在剪贴板。")
        print("     ⌨️  下一步：在编辑器正文区 Ctrl+V、填标题、选封面、点『保存』。")
        return 0
    finally:
        try:
            pw.stop()
        except Exception:
            pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--md", required=True, type=Path)
    ap.add_argument("--cover", type=Path)
    ap.add_argument("--port", type=int, default=DEFAULT_CDP_PORT)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    return publish(args.title, args.md, args.cover, args.port, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
