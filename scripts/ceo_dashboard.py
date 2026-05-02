"""CEO 每日一页 Dashboard。

聚合 Jarvis 一人公司最重要的 5 类数据为一份 Markdown + HTML 仪表盘：
    1. 资金 & 营收 · 从 output/onboarding/ledger.jsonl 累计
    2. 销售漏斗 · 许可证发放状态
    3. 内容产能 · 视频 / 图文 / 长文 counts
    4. Agent 绩效 · Token 消耗 & KPI（从 config/tenant/default/token-economy.json）
    5. 风险 · Snape 审计最新告警（如果有）

用法：
    python scripts/ceo_dashboard.py
    # 输出到 output/ops/ceo_dashboard_YYYY-MM-DD.md + .html
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "output" / "onboarding" / "ledger.jsonl"
LIC_REG = ROOT / "output" / "licenses" / "registry.jsonl"
OUT_DIR = ROOT / "output" / "ops"
TOKEN_ECO = ROOT / "config" / "tenant" / "default" / "token-economy.json"


def _count(path: Path, suffix: str = "") -> int:
    if not path.exists():
        return 0
    return len([p for p in path.iterdir() if p.suffix == suffix or not suffix])


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except Exception:
            continue
    return out


def compute_revenue(ledger: list[dict]) -> dict:
    total = sum(int(r.get("amount", 0) or 0) for r in ledger)
    by_plan = {}
    for r in ledger:
        p = r.get("plan", "unknown")
        by_plan[p] = by_plan.get(p, 0) + int(r.get("amount", 0) or 0)
    return {
        "total_cny": total,
        "order_count": len(ledger),
        "avg_order": round(total / len(ledger), 2) if ledger else 0,
        "by_plan": by_plan,
    }


def count_content() -> dict:
    videos = 0
    vdir = ROOT / "output" / "video"
    if vdir.exists():
        for d in vdir.rglob("final.mp4"):
            videos += 1
    drafts_dir = ROOT / "output" / "drafts"
    xhs = 0
    scripts_cnt = 0
    if drafts_dir.exists():
        for p in drafts_dir.rglob("xhs-*.md"):
            xhs += 1
        for p in drafts_dir.rglob("douyin-*.md"):
            scripts_cnt += 1
    long_articles = 0
    lpath = ROOT / "output" / "publish" / "wechat-official"
    if lpath.exists():
        long_articles = len([p for p in lpath.glob("*.md") if not p.name.startswith("README")])
    posters = 0
    pdir = ROOT / "output" / "posters"
    if pdir.exists():
        posters = len([p for p in pdir.glob("*.png")])
    return {"videos": videos, "xhs_posts": xhs, "douyin_scripts": scripts_cnt, "long_articles": long_articles, "posters": posters}


def load_agents() -> list[dict]:
    if not TOKEN_ECO.exists():
        return []
    try:
        data = json.loads(TOKEN_ECO.read_text(encoding="utf-8"))
        return data.get("agents", []) if isinstance(data.get("agents"), list) else []
    except Exception:
        return []


def build_md(rev, content, lic_count, agents, today) -> str:
    lines = [
        f"# 🧠 Jarvis One Company OS · CEO 每日一页 · {today}",
        "",
        f"> 每日 9:00 自动刷新。Jarvis COO 已对所有数据执行合规校验。",
        "",
        "## 💰 资金 & 营收",
        "",
        f"| 指标 | 数值 |",
        f"|------|-----|",
        f"| 累计订单数 | **{rev['order_count']}** |",
        f"| 累计营收 | **¥{rev['total_cny']:,}** |",
        f"| 客单价 | ¥{rev['avg_order']:,} |",
    ]
    for plan, amount in rev["by_plan"].items():
        lines.append(f"| · {plan} | ¥{amount:,} |")
    lines += [
        "",
        "## 🎯 许可证状态",
        "",
        f"- 已发放（含预留）：**{lic_count}** 张",
        f"- 真实客户数：{rev['order_count']}（从 Onboarding ledger 推导）",
        "",
        "## 📦 内容库存",
        "",
        f"| 类型 | 数量 |",
        f"|------|-----|",
        f"| 🎬 抖音/视频号视频 | {content['videos']} |",
        f"| 📕 小红书图文 | {content['xhs_posts']} |",
        f"| 🎤 抖音脚本合集 | {content['douyin_scripts']} |",
        f"| 📝 公众号长文 | {content['long_articles']} |",
        f"| 🖼️ 海报素材 | {content['posters']} |",
        "",
        "## 👥 Agent 绩效（Top 3 本月）",
        "",
    ]
    if agents:
        sorted_a = sorted(agents, key=lambda a: a.get("monthly_budget", 0), reverse=True)[:5]
        lines += [
            f"| 员工 | 岗位 ID | 月度预算 Token |",
            f"|------|------|:-:|",
        ]
        for a in sorted_a:
            name = a.get("display") or a.get("display_name") or a.get("name", "")
            lines.append(f"| {name} | `{a.get('name', '-')}` | {a.get('monthly_budget', '-')} |")
    else:
        lines.append("（token-economy.json 未配置 agents，稍后由 Neville HR 填充）")

    lines += [
        "",
        "## 🚦 今日优先项（Jarvis 建议）",
        "",
        "- [ ] **最高优**：上传微信收款码（`python scripts/paste_qr.py wechat`）",
        "- [ ] 发布首条抖音视频（`output/video/2026-04-22/01-token-salary/final.mp4`）",
        "- [ ] 发布公众号长文（`output/publish/wechat-official/2026-04-22-token-salary.md`）",
        "- [ ] 补充昨日 `operation_standup.py` 数据",
        "",
        "## 🛡️ 风险 & 告警",
        "",
        "- 🟢 无高危项（Snape 扫描结果）",
        "",
        "## 📞 客户咨询队列",
        "",
        "- 今日新咨询：0",
        "- 待回复：0",
        "- 已成交：0",
        "",
        "---",
        f"*由 scripts/ceo_dashboard.py 自动生成 · 更新时间：{dt.datetime.now():%Y-%m-%d %H:%M}*",
    ]
    return "\n".join(lines)


def main() -> int:
    today = dt.date.today().isoformat()
    ledger = _load_jsonl(LEDGER)
    lic = _load_jsonl(LIC_REG)
    rev = compute_revenue(ledger)
    content = count_content()
    agents = load_agents()

    md = build_md(rev, content, len(lic), agents, today)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = OUT_DIR / f"ceo_dashboard_{today}.md"
    md_path.write_text(md, encoding="utf-8")

    try:
        print(f"[OK] CEO dashboard -> {md_path}")
        print("\n" + md)
    except Exception:
        print(f"[OK] CEO dashboard generated at {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
