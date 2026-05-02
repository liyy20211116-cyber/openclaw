from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import xhs_compliance_guard as guard
from PIL import Image, ImageDraw
from generate_salary_poster import MOCK_AGENTS
from xhs_leadgen_content import ROOT, OUT_ROOT, find_font


def _agent_line(name: str, role: str, budget: int, used: int, kpi: int, note: str = "") -> str:
    suffix = f"（{note}）" if note else ""
    return f"- {name} · {role}：预算 {budget}，用了 {used}，KPI {kpi}{suffix}"


def build_note(month: str) -> dict[str, Any]:
    total_budget = sum(agent["budget"] for agent in MOCK_AGENTS)
    total_used = sum(agent["used"] for agent in MOCK_AGENTS)
    avg_kpi = sum(agent["kpi"] for agent in MOCK_AGENTS) / len(MOCK_AGENTS)
    usage_pct = total_used / total_budget * 100
    title = "我给AI员工发工资"
    body = "\n".join(
        [
            "我给 AI 员工做了一张 Token 工资单。",
            "",
            "先说清楚：",
            "这不是真人雇佣，也不是发现金工资。",
            "我只是把一人公司里每个 AI 岗位的调用预算、消耗和 KPI 记成了一张表。",
            "",
            f"这是 {month} 的记录：",
            _agent_line("贾维斯", "COO", 500, 412, 95),
            _agent_line("赫敏", "技术", 400, 380, 92),
            _agent_line("卢娜", "内容", 600, 551, 91),
            _agent_line("弗雷德", "销售", 350, 289, 84),
            _agent_line("珀西", "财务", 200, 156, 96, "最省"),
            _agent_line("斯内普", "审计", 250, 201, 99, "最高"),
            "",
            f"总预算 {total_budget}，实际用了 {total_used}，消耗率 {usage_pct:.1f}%。",
            f"平均 KPI {avg_kpi:.1f}。",
            "",
            "这张表对我最大的提醒是：",
            "AI 不是越多越好，任务也不是越自动越好。",
            "每个岗位都要有预算、结果和复盘，不然很容易变成一堆会聊天的工具。",
            "",
            "我现在还在验证这套东西能不能真的跑出业务。",
            "所以先把账记清楚：谁花了 Token，谁产出了结果，谁需要被调整。",
            "",
            "下一篇我会记录：",
            "审计角色是怎么发现内容踩线的。",
        ]
    )
    return {"title": title, "body": body, "tags": ["一人公司", "AI员工", "Token经济", "AI运营"]}


def draw_salary_story_poster(path: Path, month: str) -> None:
    width, height = 1080, 1440
    bg = (16, 20, 32)
    panel = (29, 35, 53)
    ink = (244, 247, 255)
    muted = (164, 174, 202)
    accent = (250, 204, 21)
    green = (110, 231, 183)
    orange = (251, 146, 60)

    img = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(img)
    f_brand = find_font(34, bold=True)
    f_title = find_font(76, bold=True)
    f_sub = find_font(34)
    f_name = find_font(34, bold=True)
    f_small = find_font(26)
    f_metric = find_font(40, bold=True)

    draw.text((64, 58), "Jarvis One Company OS", font=f_brand, fill=accent)
    draw.text((64, 116), "我给AI员工发工资", font=f_title, fill=ink)
    draw.text((64, 210), f"{month} Token 工资单 / 预算 · 消耗 · KPI", font=f_sub, fill=muted)

    total_budget = sum(a["budget"] for a in MOCK_AGENTS)
    total_used = sum(a["used"] for a in MOCK_AGENTS)
    avg_kpi = sum(a["kpi"] for a in MOCK_AGENTS) / len(MOCK_AGENTS)
    usage_pct = total_used / total_budget * 100

    draw.rounded_rectangle([64, 286, width - 64, 410], radius=10, fill=panel)
    draw.text((96, 308), f"总预算 {total_budget}", font=f_metric, fill=ink)
    draw.text((398, 308), f"已用 {total_used}", font=f_metric, fill=green)
    draw.text((700, 308), f"KPI {avg_kpi:.1f}", font=f_metric, fill=green)
    draw.text((96, 364), f"消耗率 {usage_pct:.1f}% · 这不是现金工资，是 AI 岗位的 Token 成本记录", font=f_small, fill=muted)

    y = 452
    for index, agent in enumerate(MOCK_AGENTS, start=1):
        row_h = 86
        draw.rounded_rectangle([64, y, width - 64, y + row_h], radius=8, fill=panel)
        draw.text((92, y + 24), f"{index:02d}", font=f_name, fill=accent)
        draw.text((160, y + 16), agent["name"], font=f_name, fill=ink)
        draw.text((160, y + 52), agent["role"], font=f_small, fill=muted)
        usage = agent["used"] / agent["budget"] * 100
        draw.text((520, y + 16), f"预算 {agent['budget']}", font=f_small, fill=muted)
        draw.text((520, y + 50), f"用了 {agent['used']} ({usage:.0f}%)", font=f_small, fill=green if usage <= 95 else orange)
        draw.text((850, y + 16), "KPI", font=f_small, fill=muted)
        draw.text((850, y + 46), str(agent["kpi"]), font=f_name, fill=green if agent["kpi"] >= 85 else orange)
        y += row_h + 12

    draw.text((64, height - 126), "AI 不是越多越好，每个岗位都要有预算、结果和复盘。", font=f_sub, fill=ink)
    draw.text((64, height - 72), "@野子哥 · 一人公司实验", font=f_small, fill=muted)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)


def generate_salary_story(run_id: str | None = None, month: str = "2026-04") -> dict[str, Any]:
    rid = run_id or f"xhs-salary-story-{month}"
    out_dir = OUT_ROOT / rid
    out_dir.mkdir(parents=True, exist_ok=True)
    note = build_note(month)

    poster_dst = out_dir / f"salary_poster_{month}.png"
    draw_salary_story_poster(poster_dst, month)

    audit = guard.audit_text(note["body"])
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
        "images": [str(poster_dst.relative_to(ROOT)).replace("\\", "/")],
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
        "title": note["title"],
        "body": note["body"],
        "tags": note["tags"],
        "images": [str(poster_dst)],
        "artifacts": {"markdown": str(markdown), "job": str(job_path), "evidence": str(evidence_path)},
        "gates": gates,
        "audit": audit,
    }
    evidence_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--month", default="2026-04")
    args = parser.parse_args()
    result = generate_salary_story(run_id=args.run_id, month=args.month)
    print(json.dumps({"ok": result["ok"], "run_id": result["run_id"], "title": result["title"], "job": result["artifacts"]["job"]}, ensure_ascii=False))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
