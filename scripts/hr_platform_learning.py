from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = ROOT / "config" / "knowledge" / "platform-ops"
LESSONS_DIR = KNOWLEDGE_DIR / "lessons"
DEFAULT_OUT = ROOT / "output" / "hr"


SOURCES = [
    {
        "platform": "douyin",
        "title": "Douyin short-video operations references, April 2026",
        "url": "https://www.01mvp.com/docs/growth/china-douyin",
        "note": "Use as current external reference for short-video format, metrics, and viral testing ideas.",
    },
    {
        "platform": "bilibili",
        "title": "Bilibili tech-area content best practices, February 2026",
        "url": "https://www.huasheng.ai/insights/bilibili-video-best-practices/",
        "note": "Use as external reference for Bilibili long-form technical content structure.",
    },
    {
        "platform": "wechat_official",
        "title": "WeChat Official Account headline/open-rate operations reference",
        "url": "https://www.yunyingpai.com/media/660503.html",
        "note": "Use as external reference for article title and open-rate oriented writing.",
    },
]


PATTERNS = [
    {
        "platform": "douyin",
        "platform_name": "抖音",
        "observed_tactic": "Use a 3-second contradiction and a visible dashboard/process proof.",
        "why_it_may_work": "Short-video recommendation rewards early retention, completion, interaction, and clear user signals.",
        "when_to_use": "When the company has a visible operating change, such as HR learning viral patterns or a monitor recovering.",
        "when_not_to_use": "When the point needs long background, private data, or unverified income claims.",
        "compliance_risk": "Do not exaggerate automation, do not imply guaranteed results, do not expose account/customer data.",
        "reusable_template": "我让 {agent} 学 {platform} 爆款，不是为了抄，而是把它变成公司的 SOP：问题 -> 学习 -> 规则 -> 下一条内容。",
        "next_experiment": "Record a 20-30s screen video: Neville extracts three rules from platform playbooks and assigns Luna/Fred/Snape follow-up work.",
        "owner_agent": "luna-growth",
    },
    {
        "platform": "bilibili",
        "platform_name": "B站",
        "observed_tactic": "Turn the learning process into a build log with method, evidence, limits, and next version.",
        "why_it_may_work": "Bilibili is stronger for trust-building, long explanations, and technical/product depth.",
        "when_to_use": "When explaining how the one-company OS makes agents learn and then produce assets.",
        "when_not_to_use": "When there is no real artifact, no demo, or only a marketing claim.",
        "compliance_risk": "Avoid naming competitors as targets without evidence; avoid showing secrets, cookies, dashboards with private identifiers.",
        "reusable_template": "我怎么让一人公司提前学习一个新平台：资料源 -> 规则拆解 -> Agent 分工 -> 内容草稿 -> 数据复盘。",
        "next_experiment": "Produce a 5-8 minute build log about Neville learning Douyin/Bilibili/公众号 before publishing there.",
        "owner_agent": "hermione-tech",
    },
    {
        "platform": "wechat_official",
        "platform_name": "公众号",
        "observed_tactic": "Use an operating memo title that promises a decision, not a diary summary.",
        "why_it_may_work": "Official-account readers need durable trust content, buyer-ready explanation, and clear trade-offs.",
        "when_to_use": "When the lesson can become a long-form decision memo or service explainer.",
        "when_not_to_use": "When the idea is only a short update or lacks a clear takeaway.",
        "compliance_risk": "No guaranteed revenue wording; separate observations, assumptions, and results.",
        "reusable_template": "我提前让 HR 学三个平台爆款：不是追热点，而是给一人公司建立内容训练系统。",
        "next_experiment": "Write one article with sections: why learn first, what HR learned, how agents use it, next publishing gate.",
        "owner_agent": "mcgonagall-product",
    },
]


AGENT_TASKS = [
    {
        "owner": "neville-hr",
        "task": "Maintain cross-platform viral learning notes and update the platform-ops knowledge base twice weekly.",
        "output": "knowledge lesson + agent enablement memo",
    },
    {
        "owner": "luna-growth",
        "task": "Convert HR learning process into one Douyin script, one XHS note angle, and one Bilibili outline.",
        "output": "draft bundle for CEO review",
    },
    {
        "owner": "fred-sales",
        "task": "Extract lead signals from each platform pattern and prepare non-intrusive CTA wording.",
        "output": "lead trigger and offer wording list",
    },
    {
        "owner": "snape-audit",
        "task": "Audit the learning-process content for copycat risk, engagement-bait risk, and overclaiming.",
        "output": "risk checklist before publication",
    },
    {
        "owner": "mcgonagall-product",
        "task": "Turn the learning loop into a buyer-facing service module: platform learning and content SOP setup.",
        "output": "service package module",
    },
]


def _today_label() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d")


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _lesson_markdown(date_label: str) -> str:
    lines = [
        f"# {date_label} HR Cross-Platform Viral Learning",
        "",
        "Owner: Neville HR",
        "Purpose: learn Douyin, Bilibili, and WeChat Official Account patterns before publishing there, then turn the learning process itself into reusable content material.",
        "",
        "## Operating Principle",
        "",
        "HR 学爆款不是抄袭，而是把公开可观察的方法拆成公司自己的训练资产：平台语境、内容结构、风险边界、可复用模板、下一轮实验。",
        "",
        "## Platform Lessons",
    ]
    for pattern in PATTERNS:
        lines.extend(
            [
                "",
                f"### {pattern['platform_name']}",
                "",
                f"- Observed tactic: {pattern['observed_tactic']}",
                f"- Why it may work: {pattern['why_it_may_work']}",
                f"- Use when: {pattern['when_to_use']}",
                f"- Do not use when: {pattern['when_not_to_use']}",
                f"- Compliance risk: {pattern['compliance_risk']}",
                f"- Reusable template: {pattern['reusable_template']}",
                f"- Next experiment: {pattern['next_experiment']}",
                f"- Owner agent: {pattern['owner_agent']}",
            ]
        )
    lines.extend(
        [
            "",
            "## Sources",
        ]
    )
    for source in SOURCES:
        lines.append(f"- {source['platform']}: {source['title']} - {source['url']}")
    return "\n".join(lines) + "\n"


def _memo_markdown(date_label: str) -> str:
    lines = [
        f"# Neville Enablement Memo - {date_label}",
        "",
        "## Decision",
        "",
        "Start platform learning before platform publishing. Douyin, Bilibili, and 公众号 will not be treated as copy-paste destinations; each gets its own format, risk gate, and success metric.",
        "",
        "## Department Assignments",
    ]
    for task in AGENT_TASKS:
        lines.append(f"- {task['owner']}: {task['task']} Output: {task['output']}.")
    lines.extend(
        [
            "",
            "## Next Content Asset",
            "",
            "Turn the learning process into a build-in-public story: `我让 HR 提前学习抖音、B站、公众号爆款，不是为了抄，而是为了让一人公司先长脑子再发内容`.",
        ]
    )
    return "\n".join(lines) + "\n"


def _content_kit_markdown(date_label: str) -> str:
    return f"""# HR 学爆款不是抄袭 - Content Kit - {date_label}

## Core Story

我没有让一人公司直接去抖音、B站、公众号搬运内容。我先让 Neville HR 学这些平台为什么会出爆款，再把学习结果变成 Luna、Fred、Snape、McGonagall 都能用的公司知识库。

## Douyin Short Script

Title: 我让 HR 去学抖音爆款，不是为了抄

Hook: 一人公司最危险的事，不是没人干活，是所有 Agent 都只会盯一个平台。

Beats:
1. Show runtime dashboard: 目前小红书有真实数据，但其他平台还没接通。
2. Show Neville learning board: HR 先拆抖音的前 3 秒、完播、互动、复看逻辑。
3. Show output: 不是复制文案，而是生成 SOP、风险边界和下一条脚本。
4. CTA: 下一步，我让 Luna 按这个 SOP 做第一条抖音草稿。

## Bilibili Outline

Title: 我怎么让一人公司先学习平台，再开始多平台内容生产

Structure:
1. Why single-platform monitoring is not enough.
2. How Neville turns platform examples into company knowledge.
3. Douyin: short contradiction and workflow proof.
4. Bilibili: build log and technical trust.
5. 公众号: operating memo and buyer-ready explanation.
6. What each Agent does next.

## WeChat Official Article

Title: 我提前让 HR 学三个平台爆款：不是追热点，而是给一人公司建立内容训练系统

Sections:
1. 先承认问题：只盯一个平台会让公司停摆。
2. 解决方式：HR 负责组织学习，不负责冒险发布。
3. 三个平台的不同打法。
4. 学习如何进入知识库、素材库和 Agent 作战队列。
5. 下一步：只读数据接入、草稿生产、CEO 审核。

## Reusable Caption

HR 学爆款不是为了抄作业，而是为了让一人公司知道：什么内容适合短视频，什么内容适合长视频，什么内容适合长文沉淀。
"""


def _draft_bundle_markdown(date_label: str) -> str:
    return f"""# HR 平台学习内容草稿包 - {date_label}

## 抖音草稿

标题：我让 HR 学抖音爆款，不是为了抄

脚本：
一人公司现在最大的问题，不是没有 Agent，而是 Agent 容易只盯一个平台。
所以我今天不急着让它们发抖音。
我先让 HR 去学习：抖音为什么要看前三秒、完播、互动和复看。
然后 HR 把这些规则交给增长、销售、审计和产品。
这不是抄爆款，这是让公司先长出内容判断力。

画面建议：
- 运行中心：小红书已有数据，其他平台待接入。
- HR 学习资产：知识库、素材包、Agent 任务。
- 作战队列：Luna/Fred/Snape/McGonagall 各自领任务。

## B站大纲

标题：我怎么让一人公司先学习平台，再开始多平台内容生产

1. 只盯一个平台为什么会让公司停住。
2. HR 在一人公司里不是做人事表，而是负责组织学习。
3. 抖音学什么：前 3 秒冲突、过程可视化、短链路反馈。
4. B站学什么：构建日志、方法拆解、真实限制。
5. 公众号学什么：经营备忘录、决策过程、买家信任。
6. 学习如何变成知识库、素材包和下一轮内容生产。
7. 下一步：只读数据接入和 CEO 审核后发布。

## 公众号长文草稿

标题：我提前让 HR 学三个平台爆款：不是追热点，而是给一人公司建立内容训练系统

开头：
我之前发现一个问题：系统已经开始跑小红书监控，但公司不能一直只围着一个平台、一条内容转。
如果一人公司真的要动起来，HR 就不能只做绩效和花名册，还要负责把外部平台经验变成内部能力。

正文结构：
1. 问题：单平台监控会让组织动作变窄。
2. 决定：先学习，再发布；先沉淀，再扩张。
3. 抖音：短视频不是压缩长文，而是用前三秒建立冲突。
4. B站：长视频不是堆信息，而是把构建过程讲清楚。
5. 公众号：长文不是日记，而是经营决策的公开档案。
6. 组织分工：HR 学习，增长改编，审计把关，销售提炼线索，产品包装服务。
7. 下一步：把这套学习过程本身做成第一批跨平台内容。

结尾：
爆款不是公司要抄的答案，而是 HR 要拆解的训练题。
"""


def write_learning_assets(out_dir: Path = DEFAULT_OUT, date_label: str | None = None) -> dict[str, str]:
    date_label = date_label or _today_label()
    lesson_path = LESSONS_DIR / f"{date_label}-douyin-bilibili-wechat-viral-learning.md"
    patterns_path = KNOWLEDGE_DIR / "cross-platform-viral-patterns.json"
    memo_path = out_dir / f"neville-cross-platform-enablement-{date_label}.md"
    content_kit_path = out_dir / "materials" / f"{date_label}-hr-learning-content-kit.md"
    agent_tasks_path = out_dir / "materials" / f"{date_label}-hr-learning-agent-tasks.json"
    draft_bundle_path = ROOT / "output" / "drafts" / date_label / "hr-platform-learning-draft-bundle.md"

    lesson_path.parent.mkdir(parents=True, exist_ok=True)
    memo_path.parent.mkdir(parents=True, exist_ok=True)
    content_kit_path.parent.mkdir(parents=True, exist_ok=True)

    lesson_path.write_text(_lesson_markdown(date_label), encoding="utf-8")
    memo_path.write_text(_memo_markdown(date_label), encoding="utf-8")
    content_kit_path.write_text(_content_kit_markdown(date_label), encoding="utf-8")
    draft_bundle_path.parent.mkdir(parents=True, exist_ok=True)
    draft_bundle_path.write_text(_draft_bundle_markdown(date_label), encoding="utf-8")
    _write_json(
        patterns_path,
        {
            "updated_at": date_label,
            "owner": "neville-hr",
            "sources": SOURCES,
            "patterns": PATTERNS,
        },
    )
    _write_json(
        agent_tasks_path,
        {
            "date": date_label,
            "owner": "neville-hr",
            "tasks": AGENT_TASKS,
            "content_material": str(content_kit_path.relative_to(ROOT)),
            "knowledge_lesson": str(lesson_path.relative_to(ROOT)),
        },
    )
    return {
        "lesson": str(lesson_path),
        "patterns": str(patterns_path),
        "memo": str(memo_path),
        "content_kit": str(content_kit_path),
        "agent_tasks": str(agent_tasks_path),
        "draft_bundle": str(draft_bundle_path),
    }


def main() -> int:
    result = write_learning_assets()
    print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
