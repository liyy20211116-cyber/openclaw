"""Agent Skill 自动蒸馏 v1（阶段 3.1）。

目标：给 Jarvis 最小可用的"自进化"能力 —— 监测每个 Agent 的对话/执行历史，
当同一类任务重复成功 ≥N 次，自动蒸馏成一份 SOP，写入 openclaw_skills/auto/<agent>/<topic>/SKILL.md。

对标：
    - Hermes Closed Loop Learning
    - EvoMap Evolver 自进化

v1 约束（简单优先）：
    - 仅在"CEO 审核通过"后才真正生效（生成到 pending/，需手动 accept）
    - 不接入真 LLM，先用规则 + 模板生成候选 SOP（v2 再调 GLM/Kimi 精炼）
    - 触发阈值：同主题成功记录 >= 3 条

用法：
    python scripts/skill_auto_distill.py                    # 扫描所有 Agent，生成候选 SOP 到 pending/
    python scripts/skill_auto_distill.py --agent luna-growth
    python scripts/skill_auto_distill.py --threshold 5
    python scripts/skill_auto_distill.py --accept <pending_path>   # 采纳某个候选到正式位置
    python scripts/skill_auto_distill.py --dry-run
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = PROJECT_ROOT / "openclaw_agents"
PENDING_DIR = PROJECT_ROOT / "openclaw_skills" / "auto" / "pending"
ACCEPTED_DIR = PROJECT_ROOT / "openclaw_skills" / "auto" / "accepted"

TOPIC_RE = re.compile(r"\[([^\]]+)\]")


def scan_agent_learnings(agent_dir: Path) -> list[tuple[str, str]]:
    """读取 learnings.md / decisions.md，抽取 (topic, content) 对。"""
    pairs: list[tuple[str, str]] = []
    for name in ("learnings.md", "decisions.md", "learnings_compressed.md"):
        p = agent_dir / "memory" / name
        if not p.exists():
            continue
        current_topic = "untagged"
        buf: list[str] = []

        def flush():
            if buf:
                pairs.append((current_topic, "\n".join(buf).strip()))
                buf.clear()

        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = TOPIC_RE.search(line)
            if line.startswith("## ") or line.startswith("### ") or m:
                flush()
                if m:
                    current_topic = m.group(1).strip()
                else:
                    current_topic = line.lstrip("# ").strip() or "untagged"
            else:
                buf.append(line)
        flush()
    return pairs


def group_by_topic(pairs: list[tuple[str, str]]) -> dict[str, list[str]]:
    g: dict[str, list[str]] = defaultdict(list)
    for topic, content in pairs:
        if content.strip():
            g[topic].append(content.strip())
    return g


def draft_sop(agent: str, topic: str, cases: list[str]) -> str:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    safe_topic = re.sub(r"[^\w\-\u4e00-\u9fa5]+", "_", topic)[:40] or "topic"
    header = f"""---
name: auto-{agent}-{safe_topic}
description: "[自动蒸馏 · 待审核] 从 {agent} 的 {len(cases)} 条历史记录蒸馏出的 SOP。初稿，未接入 LLM 精炼。"
metadata: {{ "openclaw": {{ "emoji": "🧪", "auto_generated": true }} }}
---

# 自动蒸馏 SOP · {agent} · {topic}

> 生成于 {now} · 样本数 {len(cases)} · 状态 **pending（需 CEO 审核）**

## 蒸馏来源

本 SOP 由 `scripts/skill_auto_distill.py` v1 从 {agent} 的 `memory/` 自动汇总。
目前未接入 LLM 精炼，CEO 审核时建议：
1. 修正话题标题
2. 合并/删除冗余 bullet
3. 如果价值足够，运行 `--accept` 迁移到 `accepted/`

## 触发条件

以下任意情况激活本 SOP：
- 用户提到与「{topic}」相关的关键词
- {agent} 被调度执行此类任务

## 历史样本（最多展示 10 条）

"""
    bullets = []
    for i, c in enumerate(cases[:10], 1):
        snippet = c.replace("\n", " ").strip()[:300]
        bullets.append(f"{i}. {snippet}")
    body = "\n".join(bullets)

    tail = f"""

## 推荐执行步骤（占位）

> 💡 v2 将用 LLM 对上面样本提炼成 3-5 步可执行 SOP。

- [ ] 步骤 1：...
- [ ] 步骤 2：...
- [ ] 步骤 3：...

## 审核建议

- 如有价值：`python scripts/skill_auto_distill.py --accept openclaw_skills/auto/pending/{agent}/{safe_topic}/SKILL.md`
- 如无价值：直接删除本目录

"""
    return header + body + tail


def run_scan(agents: list[str] | None, threshold: int, dry_run: bool) -> int:
    target_agents = []
    if AGENTS_DIR.exists():
        for d in sorted(AGENTS_DIR.iterdir()):
            if not d.is_dir() or d.name.startswith("."):
                continue
            if agents and d.name not in agents:
                continue
            target_agents.append(d)
    if not target_agents:
        print("[!] 未找到目标 Agent")
        return 2

    generated = 0
    for ad in target_agents:
        pairs = scan_agent_learnings(ad)
        if not pairs:
            continue
        topics = group_by_topic(pairs)
        for topic, cases in topics.items():
            if len(cases) < threshold:
                continue
            out_dir = PENDING_DIR / ad.name / re.sub(r"[^\w\-\u4e00-\u9fa5]+", "_", topic)[:40]
            out_path = out_dir / "SKILL.md"
            content = draft_sop(ad.name, topic, cases)
            if dry_run:
                print(f"[dry] would write {out_path} (samples={len(cases)})")
                continue
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path.write_text(content, encoding="utf-8")
            print(f"[+] {out_path}  (samples={len(cases)})")
            generated += 1

    print(f"\n[scan] 生成候选 SOP: {generated}")
    return 0


def run_accept(pending_path: Path) -> int:
    if not pending_path.exists():
        print(f"[!] 文件不存在 {pending_path}", file=sys.stderr)
        return 2
    try:
        rel = pending_path.parent.relative_to(PENDING_DIR)
    except ValueError:
        print(f"[!] 该路径不在 {PENDING_DIR} 下", file=sys.stderr)
        return 2
    dst_dir = ACCEPTED_DIR / rel
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst_path = dst_dir / "SKILL.md"
    shutil.copy2(pending_path, dst_path)
    print(f"[accept] {pending_path} -> {dst_path}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", default=None, help="只扫描指定 Agent（可逗号分隔多个）")
    ap.add_argument("--threshold", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--accept", default=None, help="采纳一个 pending SOP 到 accepted/")
    args = ap.parse_args()

    if args.accept:
        return run_accept(Path(args.accept).resolve())

    agents = [a.strip() for a in (args.agent.split(",") if args.agent else []) if a.strip()] or None
    return run_scan(agents, args.threshold, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
