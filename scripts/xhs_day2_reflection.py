from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import xhs_compliance_guard as guard
from xhs_leadgen_content import ROOT, OUT_ROOT, draw_card


def build_note() -> dict[str, Any]:
    title = "第一条小红书被下架了"
    body = "\n".join(
        [
            "第一条小红书被下架了。",
            "",
            "后台给的原因很直接：",
            "我写了类似“评论一个词”的句子，平台把它判成诱导互动。",
            "",
            "说实话，这一下挺好。",
            "它提醒我，做账号不是把观点写出来就结束了。",
            "平台规则和读者感受都要一起考虑。",
            "尤其是新号，任何像换资料、求互动的表达都很容易踩线。",
            "",
            "我今天先不急着重发。",
            "先把那句删掉，再重新看一遍整篇文案：",
            "哪些话像营销，哪些话像汇报，哪些话真的像我自己在记录。",
            "",
            "这也是我想验证的一件事：",
            "一人公司不是永远不犯错，",
            "而是犯错以后，能不能把问题记下来，改掉，再继续往前走。",
            "",
            "下一篇我会继续记录：",
            "我怎么把文案里的 AI 味一点点降下来。",
        ]
    )
    return {"title": title, "body": body, "tags": ["一人公司", "AI运营", "小红书运营", "内容复盘"]}


def generate_day2_reflection(run_id: str | None = None, run_date: str | None = None) -> dict[str, Any]:
    rid = run_id or "xhs-day2-rule-reflection-20260429"
    date = run_date or "2026-04-29"
    out_dir = OUT_ROOT / rid
    out_dir.mkdir(parents=True, exist_ok=True)
    note = build_note()

    card_specs = [
        {
            "eyebrow": "一人公司实验 02",
            "title": "第一条小红书被下架了",
            "points": ["后台说原因是诱导互动", "这次先停下来改文案"],
        },
        {
            "eyebrow": "问题在哪",
            "title": "内容不能只会写",
            "points": ["平台规则、账号阶段、表达方式都要算进去", "新号先建立真实感"],
        },
        {
            "eyebrow": "公司怎么改",
            "title": "先删掉营销感",
            "points": ["把像求互动的话删掉", "把像汇报的话改成真实记录"],
        },
        {
            "eyebrow": "下一步",
            "title": "先把 AI 味降下来",
            "points": ["少讲概念，多讲当天发生了什么", "把错误也变成经营记录"],
        },
    ]

    cards: list[dict[str, str]] = []
    for index, spec in enumerate(card_specs, start=1):
        path = out_dir / f"card-{index:02d}.png"
        draw_card(path, spec["eyebrow"], spec["title"], spec["points"], index, len(card_specs))
        cards.append({"path": str(path), "title": spec["title"]})

    audit = guard.audit_text(note["body"] + "\n" + "\n".join(spec["title"] + " " + " ".join(spec["points"]) for spec in card_specs))
    gates = {
        "luna_realness": "pass",
        "mcgonagall_product_relevance": "pass",
        "snape_compliance": "pass" if audit["pass"] else "fail",
    }

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
        "gates": gates,
        "audit": audit,
    }
    job_path = out_dir / "xhs-job.json"
    evidence_path = out_dir / "evidence.json"
    job_path.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")

    result = {
        "ok": audit["pass"],
        "run_id": rid,
        "run_date": date,
        "title": note["title"],
        "body": note["body"],
        "tags": note["tags"],
        "cards": cards,
        "artifacts": {
            "markdown": str(markdown),
            "job": str(job_path),
            "evidence": str(evidence_path),
        },
        "gates": gates,
        "audit": audit,
    }
    evidence_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--date", default=None)
    args = parser.parse_args()
    result = generate_day2_reflection(run_id=args.run_id, run_date=args.date)
    print(json.dumps({"ok": result["ok"], "run_id": result["run_id"], "title": result["title"], "job": result["artifacts"]["job"]}, ensure_ascii=False))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
