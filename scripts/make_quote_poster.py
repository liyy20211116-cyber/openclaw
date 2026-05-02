"""金句海报生成器 —— 给抖音/小红书短视频批量做封面.

输入一句主标题 + 一句副标题 → 输出 1080×1440 竖版海报.

用法：
    python scripts/make_quote_poster.py \
        --title "5万行代码写了个AI公司" \
        --subtitle "9个AI员工 · Token经济 · 零人力" \
        --output output/posters/script-02.png
    python scripts/make_quote_poster.py --title "9只龙虾分工协作" --subtitle "一人公司新形态" --output x.png --theme gold
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("缺少 Pillow：pip install pillow", file=sys.stderr)
    sys.exit(2)


THEMES = {
    "default": {"bg": (18, 22, 36), "accent": (247, 195, 37), "text": (240, 244, 255), "sub": (160, 170, 200)},
    "gold":    {"bg": (10, 12, 20),  "accent": (255, 203, 68), "text": (250, 246, 230), "sub": (180, 160, 120)},
    "cyber":   {"bg": (9, 14, 28),   "accent": (56, 189, 248), "text": (232, 242, 255), "sub": (130, 160, 200)},
    "hot":     {"bg": (22, 13, 18),  "accent": (255, 94, 120), "text": (255, 235, 240), "sub": (200, 160, 170)},
}


def _find_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _wrap_chinese(text: str, font: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        w = draw.textlength(trial, font=font)
        if w > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def make(title: str, subtitle: str, output: Path, theme: str = "default",
         brand: str = "Jarvis One Company OS", footer: str = "5万行代码 · 9个AI员工 · Token工资制 · 零人力") -> None:
    W, H = 1080, 1440
    t = THEMES.get(theme, THEMES["default"])
    img = Image.new("RGB", (W, H), t["bg"])
    d = ImageDraw.Draw(img)

    f_brand = _find_font(36)
    f_title = _find_font(92)
    f_sub = _find_font(42)
    f_footer = _find_font(28)

    # 品牌
    d.text((60, 50), brand, font=f_brand, fill=t["accent"])

    # 主标题：居中显示，自动换行
    title_lines = _wrap_chinese(title, f_title, W - 120, d)
    total_h = len(title_lines) * 110
    y0 = (H - total_h) // 2 - 60
    for i, line in enumerate(title_lines):
        w = d.textlength(line, font=f_title)
        d.text(((W - w) / 2, y0 + i * 110), line, font=f_title, fill=t["text"])

    # 副标题
    sub_lines = _wrap_chinese(subtitle, f_sub, W - 140, d)
    y_sub = y0 + total_h + 50
    for i, line in enumerate(sub_lines):
        w = d.textlength(line, font=f_sub)
        d.text(((W - w) / 2, y_sub + i * 56), line, font=f_sub, fill=t["sub"])

    # 底部品牌条
    d.rectangle([0, H - 130, W, H], fill=(8, 11, 20))
    fw = d.textlength(footer, font=f_footer)
    d.text(((W - fw) / 2, H - 95), footer, font=f_footer, fill=t["sub"])
    d.text((60, H - 55), "@Jarvis一人公司OS", font=f_footer, fill=t["accent"])

    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output, "PNG", optimize=True)
    print(f"[OK] {output}  ({output.stat().st_size // 1024} KB)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--output", required=True)
    ap.add_argument("--theme", choices=list(THEMES.keys()), default="default")
    ap.add_argument("--brand", default="Jarvis One Company OS")
    ap.add_argument("--footer", default="5万行代码 · 9个AI员工 · Token工资制 · 零人力")
    args = ap.parse_args()
    make(args.title, args.subtitle, Path(args.output), args.theme, args.brand, args.footer)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
