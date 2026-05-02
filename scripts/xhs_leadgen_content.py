from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "output" / "xhs_leadgen"


def find_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    lines: list[str] = []
    current = ""
    for char in text:
        trial = current + char
        if draw.textlength(trial, font=font) > max_width and current:
            lines.append(current)
            current = char
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def draw_card(path: Path, eyebrow: str, title: str, points: list[str], index: int, total: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 1080, 1440
    bg = (250, 247, 240)
    ink = (24, 31, 42)
    sub = (75, 85, 99)
    accent = (220, 38, 38)
    green = (20, 117, 83)
    image = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(image)
    f_eyebrow = find_font(34, bold=True)
    f_title = find_font(86, bold=True)
    f_point = find_font(44)
    f_small = find_font(30)

    draw.rounded_rectangle([54, 54, width - 54, height - 54], radius=36, outline=(220, 214, 204), width=3)
    draw.text((92, 96), eyebrow, font=f_eyebrow, fill=green)

    y = 250
    for line in wrap_text(title, f_title, width - 184, draw):
        draw.text((92, y), line, font=f_title, fill=ink)
        y += 108

    y += 70
    for point in points:
        draw.rounded_rectangle([92, y + 6, 116, y + 30], radius=12, fill=accent)
        for line in wrap_text(point, f_point, width - 220, draw):
            draw.text((142, y), line, font=f_point, fill=sub)
            y += 62
        y += 32

    footer = f"{index}/{total}  @野子哥 · 一人公司实验"
    draw.text((92, height - 142), footer, font=f_small, fill=(120, 113, 108))
    image.save(path, "PNG", optimize=True)


def build_strategy() -> dict[str, Any]:
    return {
        "product_owner": "mcgonagall-product",
        "content_owner": "luna-growth",
        "audit_owner": "snape-audit",
        "positioning": "不是卖软件，而是公开用 AI 团队跑第一个经营闭环。",
        "audience": ["想做副业但执行力不足的人", "自由职业者", "小团队老板", "AI 工具重度使用者"],
        "hook_rules": [
            "标题少于 20 字，先给冲突或结果",
            "封面只讲一个核心钩子",
            "正文先讲犯错和转向，再讲方法",
            "不使用评论关键词、点赞、收藏、关注、私信等互动诱导",
            "用连续内容承接兴趣：下一篇拆方法，而不是要求用户互动换资料",
        ],
        "learned_from_sources": [
            "小红书 feed 场景依赖封面和标题打开率",
            "标题不宜过长，封面与内容必须一致",
            "避免虚假夸张、硬广导流和互动诱导",
            "新号更要降低 AI 味，写真实过程、真实卡点、真实复盘",
        ],
    }


def build_note() -> dict[str, Any]:
    title = "我先不卖系统了"
    body = "\n".join(
        [
            "我前几天犯了一个很典型的错误：",
            "一直在讲“一人公司系统有多复杂”。",
            "",
            "但站在别人视角，真正关心的不是我做了多少功能，",
            "而是：它到底能不能帮一个普通人把业务跑起来？",
            "",
            "所以我把目标改了：先不卖系统。",
            "先让这套 AI 团队帮我自己拿到第一个真实咨询。",
            "",
            "现在的一人公司不是一个聊天机器人，",
            "而是 9 个岗位一起跑：",
            "内容岗写选题，销售岗接线索，客服岗整理回复，财务岗只认到账，审计岗盯风险。",
            "",
            "我不承诺暴利，也不讲神话。",
            "接下来只公开 3 件事：",
            "1. 今天做了什么经营动作",
            "2. 有没有拿到真实反馈",
            "3. 哪一步卡住了，怎么修",
            "",
            "我会把第一版「最小经营闭环清单」整理成下一篇。",
            "这次先记录第一个事实：",
            "一人公司要先像公司一样运转，再谈把系统卖出去。",
        ]
    )
    tags = ["一人公司", "AI运营", "副业实验", "普通人创业", "商业闭环"]
    return {"title": title, "body": body, "tags": tags}


def generate_xhs_leadgen_content(run_id: str | None = None, run_date: str | None = None) -> dict[str, Any]:
    rid = run_id or "xhs-leadgen"
    date = run_date or "2026-04-29"
    out_dir = OUT_ROOT / rid
    out_dir.mkdir(parents=True, exist_ok=True)

    strategy = build_strategy()
    note = build_note()
    card_specs = [
        {
            "eyebrow": "一人公司实验 01",
            "title": "我先不卖系统了",
            "points": ["先让 AI 团队帮我自己拿到第一个真实咨询", "能跑出结果，再谈产品化"],
        },
        {
            "eyebrow": "之前的问题",
            "title": "没人关心我做了多少功能",
            "points": ["用户只关心：能不能帮我把业务跑起来", "所以内容不能写成内部日报"],
        },
        {
            "eyebrow": "现在怎么跑",
            "title": "9 个 AI 岗位一起动",
            "points": ["内容岗写选题，销售岗接线索", "客服整理回复，财务只认到账，审计盯风险"],
        },
        {
            "eyebrow": "想看过程",
            "title": "我只公开真实反馈",
            "points": ["今天做了什么，有没有咨询，哪里卡住了", "下一篇拆最小经营闭环清单"],
        },
    ]

    cards: list[dict[str, str]] = []
    for index, spec in enumerate(card_specs, start=1):
        path = out_dir / f"card-{index:02d}.png"
        draw_card(path, spec["eyebrow"], spec["title"], spec["points"], index, len(card_specs))
        cards.append({"path": str(path), "title": spec["title"]})

    markdown = out_dir / "note.md"
    markdown.write_text(note["body"], encoding="utf-8")
    job = {
        "platform": "xiaohongshu",
        "action": "draft",
        "title": note["title"],
        "content_file": str(markdown.relative_to(ROOT)).replace("\\", "/"),
        "images": [str(Path(card["path"]).relative_to(ROOT)).replace("\\", "/") for card in cards],
        "tags": note["tags"],
        "publish": False,
        "requires_ceo_confirm": True,
        "strategy": strategy,
    }
    job_path = out_dir / "xhs-job.json"
    strategy_path = out_dir / "strategy.json"
    job_path.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
    strategy_path.write_text(json.dumps(strategy, ensure_ascii=False, indent=2), encoding="utf-8")

    result = {
        "ok": True,
        "run_id": rid,
        "run_date": date,
        "title": note["title"],
        "body": note["body"],
        "tags": note["tags"],
        "cards": cards,
        "strategy": strategy,
        "artifacts": {
            "markdown": str(markdown),
            "job": str(job_path),
            "strategy": str(strategy_path),
        },
    }
    evidence = out_dir / "evidence.json"
    evidence.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["artifacts"]["evidence"] = str(evidence)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--date", default=None)
    args = parser.parse_args()
    result = generate_xhs_leadgen_content(run_id=args.run_id, run_date=args.date)
    print(json.dumps({
        "ok": result["ok"],
        "run_id": result["run_id"],
        "title": result["title"],
        "cards": len(result["cards"]),
        "job": result["artifacts"]["job"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
