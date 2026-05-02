"""生成 9 个 AI 员工的 Token 工资单海报。

这是 Jarvis One Company OS 最独有的传播资产：把 Token 经济体系可视化成一张
可转发的海报（PNG），每月 1 日自动生成，直接作为抖音/小红书内容素材。

用法：
    python scripts/generate_salary_poster.py               # 生成当月海报
    python scripts/generate_salary_poster.py --month 2026-03
    python scripts/generate_salary_poster.py --dry-run     # 只打印数据

推送飞书（生成 + 上传图片 + 群机器人）见：scripts/push_salary_poster_feishu.py

依赖：
    pip install pillow

数据来源（优先级从高到低）：
    1. http://127.0.0.1:18781/api/v1/agents/salary?month=YYYY-MM
    2. output/reports/agent_salary_{month}.json
    3. mock 数据（用于首次跑通演示）
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("[!] 缺少 Pillow，请先运行：pip install pillow")
    sys.exit(1)

try:
    import requests
except ImportError:
    requests = None


PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "posters"
API_BASE = os.environ.get("JARVIS_API_BASE", "http://127.0.0.1:18781")

# Mock 数据：9 个 AI 员工 + 执行助手
MOCK_AGENTS = [
    {"name": "贾维斯",   "role": "COO",          "budget": 500, "used": 412, "kpi": 95, "emoji": "🧠"},
    {"name": "赫敏",     "role": "技术总监",     "budget": 400, "used": 380, "kpi": 92, "emoji": "⚙️"},
    {"name": "麦格",     "role": "产品总监",     "budget": 300, "used": 256, "kpi": 88, "emoji": "📐"},
    {"name": "卢娜",     "role": "增长官",       "budget": 600, "used": 551, "kpi": 91, "emoji": "🚀"},
    {"name": "弗雷德",   "role": "销售经理",     "budget": 350, "used": 289, "kpi": 84, "emoji": "💼"},
    {"name": "珀西",     "role": "财务总监",     "budget": 200, "used": 156, "kpi": 96, "emoji": "💰"},
    {"name": "斯内普",   "role": "审计长",       "budget": 250, "used": 201, "kpi": 99, "emoji": "🔍"},
    {"name": "多比",     "role": "客户成功",     "budget": 400, "used": 362, "kpi": 87, "emoji": "💬"},
    {"name": "魔法师",   "role": "执行助手",     "budget": 300, "used": 278, "kpi": 90, "emoji": "🧙"},
]


def fetch_agent_salary(month: str) -> list[dict[str, Any]]:
    """优先从 Jarvis API 拉，失败则读本地文件，最后回退 mock。"""
    if requests is not None:
        try:
            resp = requests.get(
                f"{API_BASE}/api/v1/agents/salary",
                params={"month": month},
                timeout=3,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    return data
        except Exception:
            pass

    local = PROJECT_ROOT / "output" / "reports" / f"agent_salary_{month}.json"
    if local.exists():
        try:
            return json.loads(local.read_text(encoding="utf-8"))
        except Exception:
            pass

    print("[i] 未找到 API 或本地数据，使用 mock 数据演示")
    return MOCK_AGENTS


def _find_font(size: int) -> ImageFont.FreeTypeFont:
    """尽力找到一个中文字体。"""
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",     # 微软雅黑
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


def draw_poster(agents: list[dict[str, Any]], month: str, out_path: Path) -> None:
    """渲染 1080x1440 的竖版海报，适合小红书/朋友圈。"""
    W, H = 1080, 1440
    BG = (18, 22, 36)
    ACCENT = (247, 195, 37)
    CARD = (28, 34, 52)
    TEXT = (240, 244, 255)
    SUB = (160, 170, 200)
    GOOD = (111, 214, 160)
    WARN = (255, 140, 94)

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    f_title = _find_font(68)
    f_sub = _find_font(34)
    f_name = _find_font(32)
    f_role = _find_font(22)
    f_num = _find_font(28)
    f_small = _find_font(20)

    d.text((60, 50), "Jarvis One Company OS", font=f_sub, fill=ACCENT)
    d.text((60, 100), f"{month} AI 员工工资单", font=f_title, fill=TEXT)
    d.text((60, 190), "9 个 AI 部门 · Token 经济 · 绩效透明", font=f_sub, fill=SUB)

    total_budget = sum(a["budget"] for a in agents)
    total_used = sum(a["used"] for a in agents)
    avg_kpi = sum(a["kpi"] for a in agents) / max(len(agents), 1)
    usage_pct = 100 * total_used / max(total_budget, 1)

    d.rectangle([60, 260, W - 60, 380], fill=CARD)
    d.text((90, 280), f"本月总预算：{total_budget} 元 Token", font=f_num, fill=TEXT)
    d.text((90, 316), f"实际消耗：{total_used} 元 （{usage_pct:.1f}%）", font=f_num, fill=GOOD if usage_pct <= 95 else WARN)
    d.text((90, 352), f"平均 KPI：{avg_kpi:.1f} / 100", font=f_num, fill=GOOD if avg_kpi >= 85 else WARN)

    y = 420
    for a in agents:
        card_h = 88
        d.rectangle([60, y, W - 60, y + card_h], fill=CARD)
        emoji = a.get("emoji", "🤖")
        d.text((80, y + 18), emoji, font=f_title, fill=TEXT)
        d.text((160, y + 12), f"{a['name']}", font=f_name, fill=TEXT)
        d.text((160, y + 52), f"{a['role']}", font=f_role, fill=SUB)

        usage = 100 * a["used"] / max(a["budget"], 1)
        d.text((560, y + 22), f"预算 {a['budget']}", font=f_role, fill=SUB)
        d.text((560, y + 52), f"用掉 {a['used']} ({usage:.0f}%)",
               font=f_role, fill=GOOD if usage <= 95 else WARN)

        kpi = a["kpi"]
        d.text((860, y + 22), f"KPI", font=f_role, fill=SUB)
        d.text((860, y + 48), f"{kpi}", font=f_name,
               fill=GOOD if kpi >= 85 else WARN)

        y += card_h + 10

    d.text((60, H - 90), "5 万行代码 · 9 个 AI 员工 · Token 工资制 · 零人力",
           font=f_sub, fill=SUB)
    d.text((60, H - 50), "@Jarvis One Company OS",
           font=f_small, fill=ACCENT)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG", optimize=True)
    try:
        print(f"[OK] 工资单海报已生成: {out_path}")
    except Exception:
        print(("[OK] salary poster saved to " + str(out_path)).encode("ascii", "replace").decode("ascii"))


def main() -> int:
    p = argparse.ArgumentParser(description="生成 Jarvis OS Token 工资单海报")
    p.add_argument("--month", default=dt.date.today().strftime("%Y-%m"))
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--output", default=None)
    args = p.parse_args()

    agents = fetch_agent_salary(args.month)

    if args.dry_run:
        print(json.dumps(agents, ensure_ascii=False, indent=2))
        return 0

    out = Path(args.output) if args.output else OUTPUT_DIR / f"salary_poster_{args.month}.png"
    draw_poster(agents, args.month, out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
