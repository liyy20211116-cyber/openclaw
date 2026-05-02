"""把 AI 一人公司自检清单的 Markdown 转成漂亮的 HTML 赠品。

使用纯 Python，无外部依赖。供 Landing Page / 邮件附件使用。
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "output" / "downloads" / "ai-one-company-checklist.md"
OUT = ROOT / "output" / "downloads" / "ai-one-company-checklist.html"

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:780px;margin:40px auto;padding:40px;background:#fff;color:#1e293b;line-height:1.85}
h1{color:#F7C325;background:#121622;padding:28px 20px;border-radius:12px;text-align:center;margin-bottom:30px}
h2{color:#121622;border-left:4px solid #F7C325;padding-left:16px;margin:36px 0 18px;font-size:1.4em}
h3{margin:20px 0 10px;color:#374151}
p{margin:10px 0}
blockquote{margin:18px 0;padding:14px 20px;background:#fef3c7;border-left:4px solid #F7C325;color:#78350f;border-radius:6px}
table{width:100%;border-collapse:collapse;margin:18px 0}
th{background:#121622;color:#F7C325;padding:10px;text-align:left}
td{padding:10px;border-bottom:1px solid #e2e8f0}
ol li, ul li{margin:8px 0 8px 26px}
strong{color:#111}
hr{margin:30px 0;border:0;border-top:1px solid #e2e8f0}
.footer{margin-top:40px;padding-top:20px;border-top:2px solid #F7C325;font-size:.88em;color:#64748b;text-align:center}
.cta{display:inline-block;margin-top:16px;padding:12px 28px;background:#F7C325;color:#121622;border-radius:8px;text-decoration:none;font-weight:700}
"""


def md_to_html(md: str) -> str:
    lines = md.split("\n")
    html = []
    in_table = False
    in_list = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# "):
            html.append(f"<h1>{stripped[2:]}</h1>")
        elif stripped.startswith("## "):
            html.append(f"<h2>{stripped[3:]}</h2>")
        elif stripped.startswith("### "):
            html.append(f"<h3>{stripped[4:]}</h3>")
        elif stripped.startswith("> "):
            html.append(f"<blockquote>{stripped[2:]}</blockquote>")
        elif stripped.startswith("| "):
            if not in_table:
                html.append("<table>")
                in_table = True
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if all(set(c) <= set(":-") for c in cells):
                continue
            tag = "th" if len(html) > 0 and "<table>" in html[-1] else "td"
            html.append("<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in cells) + "</tr>")
        elif in_table and not stripped.startswith("|"):
            html.append("</table>")
            in_table = False
        elif re.match(r"^\d+\.", stripped):
            if not in_list:
                html.append("<ol>")
                in_list = "ol"
            html.append(f"<li>{re.sub(r'^\d+\. ', '', stripped)}</li>")
        elif stripped.startswith("- "):
            if in_list != "ul":
                if in_list:
                    html.append(f"</{in_list}>")
                html.append("<ul>")
                in_list = "ul"
            html.append(f"<li>{stripped[2:]}</li>")
        elif stripped == "---":
            if in_list:
                html.append(f"</{in_list}>")
                in_list = False
            html.append("<hr>")
        elif stripped == "":
            if in_list:
                html.append(f"</{in_list}>")
                in_list = False
            if in_table:
                html.append("</table>")
                in_table = False
        else:
            if in_list:
                html.append(f"</{in_list}>")
                in_list = False
            html.append(f"<p>{stripped}</p>")

    if in_list:
        html.append(f"</{in_list}>")
    if in_table:
        html.append("</table>")

    body = "\n".join(html)
    body = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", body)
    body = re.sub(r"`([^`]+)`", r"<code style='background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:.92em'>\1</code>", body)

    return f"""<!DOCTYPE html>
<html lang=\"zh-CN\"><head><meta charset=\"UTF-8\">
<title>AI 一人公司自检清单 v1.0 · Jarvis One Company OS</title>
<style>{CSS}</style></head>
<body>{body}
<div class='footer'>
© 2026 Jarvis One Company OS · 野子哥出品<br>
微信 <strong>go19237140413</strong> · B 站 <strong>野子哥gogogo</strong>
<br><a class='cta' href='https://jarvis-os.com/pricing'>获取同款操作系统 →</a>
</div>
</body></html>"""


def main() -> int:
    md = SRC.read_text(encoding="utf-8")
    html = md_to_html(md)
    OUT.write_text(html, encoding="utf-8")
    print(f"[OK] {OUT} ({len(html)//1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
