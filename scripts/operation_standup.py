"""Operation First Blood · 每日作战站会脚本（WP5）。

每天早 9:00 自动跑，汇总：
    - 昨日各 Agent 的 learnings 增量
    - 7 个工作包进度
    - 今日计划（基于 calendar）
    - 风险预警（Snape 扫描）
    - KPI Dashboard 更新

输出：
    output/daily_standup/standup_YYYY-MM-DD.md   (可直接发飞书/微信)
    命令行彩色摘要

用法：
    python scripts/operation_standup.py
    python scripts/operation_standup.py --push-feishu
    python scripts/operation_standup.py --push-wechat
    python scripts/operation_standup.py --date 2026-04-22
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "output" / "daily_standup"


WP_STATUS_FILE = PROJECT_ROOT / "output" / "daily_standup" / "wp-status.json"
APP_CONFIG_PATH = PROJECT_ROOT / "config" / "app-config.json"

DEFAULT_WP = [
    {"id": "WP1", "name": "配置中心 M1 骨架",       "owner": "hermione-tech", "status": "done",  "due": "Day 2"},
    {"id": "WP2", "name": "Landing Page 三档",     "owner": "luna-growth",   "status": "done",  "due": "Day 3"},
    {"id": "WP3", "name": "许可证发放器",           "owner": "percy-finance", "status": "done",  "due": "Day 4"},
    {"id": "WP4", "name": "首批 10 条抖音脚本",    "owner": "pack-content",  "status": "done",  "due": "Day 5"},
    {"id": "WP5", "name": "作战站会脚本",           "owner": "jarvis-coo",    "status": "in-progress", "due": "Day 6"},
    {"id": "WP6", "name": "销售话术 + SOP",         "owner": "fred-sales",    "status": "pending","due": "Day 7"},
    {"id": "WP7", "name": "4 月 Token 工资单海报", "owner": "percy-finance", "status": "pending","due": "Day 7"},
]


def scan_yesterday_learnings(since: dt.date) -> dict[str, list[str]]:
    """扫描 openclaw_agents/*/memory/learnings.md 取昨日新增条目（粗略）。"""
    out: dict[str, list[str]] = {}
    agents_dir = PROJECT_ROOT / "openclaw_agents"
    since_str = since.isoformat()
    if not agents_dir.exists():
        return out
    for ad in sorted(agents_dir.iterdir()):
        if not ad.is_dir() or ad.name.startswith(".") or ad.name in ("packs", "_shared"):
            continue
        learnings = ad / "memory" / "learnings.md"
        if not learnings.exists():
            continue
        new_lines: list[str] = []
        try:
            content = learnings.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for line in content.splitlines():
            if since_str in line or (since.strftime("%m-%d") in line):
                new_lines.append(line.strip())
        if new_lines:
            out[ad.name] = new_lines[:5]
    return out


def load_operation_targets() -> dict[str, object]:
    """从 config/app-config.json 读取 operation_targets；缺省与历史硬编码一致。"""
    defaults: dict[str, object] = {
        "phase_label": "Day 30",
        "orders": 20,
        "revenue_cny": 20000,
        "scripts_label": "60+",
        "videos_label": "30+",
        "posters_label": "30+",
    }
    if not APP_CONFIG_PATH.exists():
        return defaults
    try:
        data = json.loads(APP_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return defaults
    raw = data.get("operation_targets")
    if not isinstance(raw, dict):
        return defaults
    out = dict(defaults)
    if "phase_label" in raw:
        out["phase_label"] = str(raw.get("phase_label") or defaults["phase_label"])
    for key in ("orders", "revenue_cny"):
        if key in raw:
            try:
                out[key] = int(raw[key])
            except Exception:
                pass
    for key in ("scripts_label", "videos_label", "posters_label"):
        if key in raw and raw[key] is not None:
            out[key] = str(raw[key])
    return out


def load_wp_status() -> list[dict]:
    if WP_STATUS_FILE.exists():
        try:
            return json.loads(WP_STATUS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return DEFAULT_WP


def compute_kpi_snapshot(date_obj: dt.date) -> dict[str, str]:
    """从 ledger / drafts / output 动态计算 KPI 快照。"""
    today = date_obj.isoformat()
    ledger_file = PROJECT_ROOT / "output" / "licenses" / "ledger.jsonl"
    orders = 0
    revenue = 0.0
    if ledger_file.exists():
        for line in ledger_file.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            ts = row.get("ts") or row.get("issued_at") or ""
            if isinstance(ts, str) and ts.startswith(today):
                orders += 1
                revenue += float(row.get("amount", 0) or 0)

    today_drafts = PROJECT_ROOT / "output" / "drafts" / today
    scripts_cnt = 0
    if today_drafts.exists():
        scripts_cnt = len(list(today_drafts.glob("douyin-*.md"))) \
            + len(list(today_drafts.glob("xhs-*.md"))) \
            + len(list(today_drafts.glob("bilibili-*.md")))

    videos_cnt = 0
    videos_dir = PROJECT_ROOT / "output" / "videos"
    if videos_dir.exists():
        videos_cnt = len(list(videos_dir.glob("*.mp4")))

    posters_cnt = 0
    posters_dir = PROJECT_ROOT / "output" / "posters"
    if posters_dir.exists():
        posters_cnt = len(list(posters_dir.glob("*.png")))

    return {
        "orders_today":  str(orders),
        "revenue_today": f"¥{revenue:.0f}",
        "scripts_today": str(scripts_cnt),
        "videos_total":  str(videos_cnt),
        "posters_total": str(posters_cnt),
    }


def check_blockers(wp: list[dict]) -> list[str]:
    """扫描 wp 里的 blocker 字段 + 支付/资产缺失。"""
    risks: list[str] = []
    for w in wp:
        if w.get("blocker"):
            risks.append(f"🟡 **{w['id']}** `{w['name']}` → {w['blocker']}")
    wechat_qr = PROJECT_ROOT / "assets" / "qr" / "wechat.png"
    if not wechat_qr.exists():
        risks.append("🔴 支付通道未激活：`assets/qr/wechat.png` 缺失（影响收款）")
    alipay_qr = PROJECT_ROOT / "assets" / "qr" / "alipay.png"
    if not alipay_qr.exists():
        risks.append("🟢 支付宝收款码可选（未上传不影响主通道）")
    return risks


def emit_markdown(date_obj: dt.date, wp: list[dict], learnings: dict[str, list[str]]) -> str:
    lines: list[str] = []
    lines.append(f"# 📊 Operation First Blood · 每日作战站会")
    lines.append("")
    lines.append(f"> {date_obj.strftime('%Y-%m-%d %A')} · 指挥官：贾维斯（COO）")
    lines.append("")

    # 1) 工作包进度
    lines.append("## 1. 工作包进度")
    lines.append("")
    lines.append("| WP | 名称 | 负责 | 状态 | 截止 |")
    lines.append("|---|---|---|:---:|---|")
    emoji = {"done": "✅", "in-progress": "🟡", "pending": "⏳", "blocked": "🔴"}
    for w in wp:
        lines.append(f"| {w['id']} | {w['name']} | {w['owner']} | {emoji.get(w['status'],'?')} {w['status']} | {w['due']} |")
    lines.append("")
    done = sum(1 for w in wp if w["status"] == "done")
    lines.append(f"**总进度：{done}/{len(wp)} 完成**（{100*done//max(1,len(wp))}%）")
    lines.append("")

    # 2) 各 Agent 昨日产出
    lines.append("## 2. 各 Agent 昨日学习/产出")
    lines.append("")
    if not learnings:
        lines.append("> 暂无新增 learnings（或首日运行）")
    else:
        for agent, items in learnings.items():
            lines.append(f"### {agent}")
            for it in items:
                lines.append(f"- {it}")
            lines.append("")

    # 3) 今日重点（基于 calendar 的占位）
    lines.append("## 3. 今日重点")
    lines.append("")
    lines.append("- [ ] 内容工厂：按排期发布今日视频")
    lines.append("- [ ] Fred-sales：处理昨日新增咨询（≥3 条）")
    lines.append("- [ ] Luna：热点聚合 + 对标监控")
    lines.append("- [ ] Snape：抽样审计昨日 Token 消耗 Top3")
    lines.append("")

    # 4) 风险
    lines.append("## 4. 风险预警")
    lines.append("")
    risks = check_blockers(wp)
    if risks:
        for r in risks:
            lines.append(f"- {r}")
    else:
        lines.append("- 🟢 暂无高危风险（Snape 每日扫描）")
    lines.append("")

    # 5) KPI 快照（动态）
    kpi = compute_kpi_snapshot(date_obj)
    ot = load_operation_targets()
    phase = str(ot.get("phase_label", "Day 30"))
    t_orders = int(ot.get("orders", 20))
    t_rev = int(ot.get("revenue_cny", 20000))
    t_scripts = str(ot.get("scripts_label", "60+"))
    t_videos = str(ot.get("videos_label", "30+"))
    t_posters = str(ot.get("posters_label", "30+"))
    rev_disp = f"¥{t_rev:,}"
    lines.append("## 5. KPI 快照（自动统计）")
    lines.append("")
    lines.append(f"| 指标 | 今日 | 累计 | 目标（{phase}） |")
    lines.append("|---|---|---|---|")
    lines.append(f"| 今日订单数 | {kpi['orders_today']} | - | {t_orders} |")
    lines.append(f"| 今日营收 | {kpi['revenue_today']} | - | {rev_disp} |")
    lines.append(f"| 今日脚本数（抖音+小红书+B站） | {kpi['scripts_today']} | - | {t_scripts} |")
    lines.append(f"| 视频库存（mp4） | - | {kpi['videos_total']} | {t_videos} |")
    lines.append(f"| 海报库存（png） | - | {kpi['posters_total']} | {t_posters} |")
    lines.append("")

    lines.append("---")
    lines.append("*由 scripts/operation_standup.py 自动生成*")
    return "\n".join(lines)


def push_feishu(md_path: Path) -> None:
    try:
        subprocess.run(
            ["python", "-m", "skills.feishu-messaging.scripts.send_doc",
             "--file", str(md_path)],
            check=False, cwd=str(PROJECT_ROOT)
        )
    except Exception as e:
        print(f"[push_feishu] 失败: {e}")


def push_wechat(md_path: Path) -> None:
    try:
        subprocess.run([
            "python", str(PROJECT_ROOT / "skills" / "wechat-bot" / "scripts" / "wx_send.py"),
            "--to", "AI一人公司研究所",
            "--type", "file",
            "--content", str(md_path),
            "--confirm",
        ], check=False)
    except Exception as e:
        print(f"[push_wechat] 失败: {e}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=dt.date.today().isoformat())
    ap.add_argument("--push-feishu", action="store_true")
    ap.add_argument("--push-wechat", action="store_true")
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    date_obj = dt.date.fromisoformat(args.date)
    since = date_obj - dt.timedelta(days=1)

    wp = load_wp_status()
    learnings = scan_yesterday_learnings(since)
    md = emit_markdown(date_obj, wp, learnings)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"standup_{args.date}.md"
    out.write_text(md, encoding="utf-8")
    print(md)
    print(f"\n[saved] {out}")

    if args.push_feishu:
        push_feishu(out)
    if args.push_wechat:
        push_wechat(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
