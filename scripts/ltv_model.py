"""Customer LTV 简化模型（Fred 销售经理判断帮手）。

用途：
    给定一个潜在客户的画像，粗略估算他在 36 个月内能贡献的 LTV，
    用来判断：
      - 是否值得给折扣
      - 是否值得上门演示
      - 优先级打分

核心公式（简化版 BG/NBD + Gamma-Gamma 的人话版）：
    LTV = 首单金额
        + 续费概率 × 年费 × 平均续费年数
        + 交叉销售期望（Pack 附加包）
        + 推荐带来的期望（NPS × 0.1 × 首单均价）

所有系数来自配置文件（config/tenant/default/ltv.json），便于运营调整。

用法：
    python scripts/ltv_model.py --plan pro --years-used 2 --nps 9
    python scripts/ltv_model.py --plan starter --years-used 1 --nps 5 --has-team
    python scripts/ltv_model.py --batch  # 批量跑 ledger.jsonl 里所有客户
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LTV_CFG = ROOT / "config" / "tenant" / "default" / "ltv.json"
LEDGER  = ROOT / "output" / "licenses" / "ledger.jsonl"


DEFAULT_CFG = {
    "plan_price": {
        "starter":    999,
        "pro":       2999,
        "enterprise": 9999
    },
    "plan_is_yearly": {
        "starter":    False,
        "pro":        True,
        "enterprise": False
    },
    "renew_rate": {
        "starter":    0.10,
        "pro":        0.65,
        "enterprise": 0.40
    },
    "avg_renew_years": {
        "starter":    1.0,
        "pro":        2.5,
        "enterprise": 1.5
    },
    "cross_sell_expect": {
        "starter":    120,
        "pro":        800,
        "enterprise": 3000
    },
    "referral_coef": 0.1,
    "team_multiplier": 1.25,
    "nps_impact": {
        "low":    0.85,
        "mid":    1.0,
        "high":   1.35
    }
}


def load_cfg() -> dict:
    if LTV_CFG.exists():
        try:
            return {**DEFAULT_CFG, **json.loads(LTV_CFG.read_text(encoding="utf-8"))}
        except Exception:
            pass
    return DEFAULT_CFG


def nps_bucket(nps: int) -> str:
    if nps >= 9:
        return "high"
    if nps >= 7:
        return "mid"
    return "low"


def compute_ltv(
    plan: str,
    years_used: float = 1.0,
    nps: int = 7,
    has_team: bool = False,
    paid_upsell: float = 0.0,
    cfg: dict | None = None,
) -> dict:
    """返回 {ltv, breakdown}。"""
    cfg = cfg or load_cfg()
    price = float(cfg["plan_price"].get(plan, 0))
    is_yearly = bool(cfg["plan_is_yearly"].get(plan, False))
    renew_rate = float(cfg["renew_rate"].get(plan, 0))
    avg_renew = float(cfg["avg_renew_years"].get(plan, 0))
    cross_sell = float(cfg["cross_sell_expect"].get(plan, 0))
    ref_coef = float(cfg["referral_coef"])
    team_mul = float(cfg["team_multiplier"]) if has_team else 1.0
    nps_mul = float(cfg["nps_impact"][nps_bucket(nps)])

    first_sale = price
    renew_value = (price * renew_rate * avg_renew) if is_yearly else 0.0
    ref_value = ref_coef * price * max(0, nps - 6)

    ltv = (first_sale + renew_value + cross_sell + ref_value + paid_upsell) * team_mul * nps_mul

    return {
        "plan": plan,
        "ltv": round(ltv, 2),
        "breakdown": {
            "first_sale":   round(first_sale, 2),
            "renew_value":  round(renew_value, 2),
            "cross_sell":   round(cross_sell, 2),
            "referral":     round(ref_value, 2),
            "upsell":       round(paid_upsell, 2),
            "team_mult":    team_mul,
            "nps_mult":     nps_mul,
        },
        "tier": tier_by_ltv(ltv),
    }


def tier_by_ltv(ltv: float) -> str:
    if ltv >= 15000:
        return "🦄 VIP（上门演示 + CEO 亲自跟）"
    if ltv >= 5000:
        return "💎 重点（Fred 贴身服务）"
    if ltv >= 1500:
        return "⭐ 标准（走正常 SOP）"
    return "📦 普通（自助即可）"


def batch_from_ledger() -> list[dict]:
    out = []
    if not LEDGER.exists():
        return out
    for line in LEDGER.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except Exception:
            continue
        plan = row.get("plan", "starter")
        res = compute_ltv(plan=plan, years_used=1.0, nps=7, has_team=False)
        res["tenant_id"] = row.get("tenant_id", "")
        res["buyer"] = row.get("buyer", "")
        out.append(res)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", choices=["starter", "pro", "enterprise"])
    ap.add_argument("--years-used", type=float, default=1.0)
    ap.add_argument("--nps", type=int, default=7, help="0-10")
    ap.add_argument("--has-team", action="store_true")
    ap.add_argument("--paid-upsell", type=float, default=0.0)
    ap.add_argument("--batch", action="store_true", help="批量跑 ledger.jsonl")
    args = ap.parse_args()

    if args.batch:
        rows = batch_from_ledger()
        if not rows:
            print("[INFO] ledger 为空。示例：3 种套餐 LTV 对比：\n")
            rows = [
                compute_ltv("starter",    nps=7),
                compute_ltv("pro",        nps=9),
                compute_ltv("enterprise", nps=8, has_team=True, paid_upsell=2000),
            ]
        print("| 客户 | 套餐 | LTV (¥) | 档位 |")
        print("|------|------|--------:|------|")
        for r in rows:
            buyer = r.get("buyer") or r.get("tenant_id") or "-"
            print(f"| {buyer} | {r['plan']} | {r['ltv']:.0f} | {r['tier']} |")
        return 0

    if not args.plan:
        ap.error("--plan 必填，或使用 --batch")

    res = compute_ltv(
        plan=args.plan,
        years_used=args.years_used,
        nps=args.nps,
        has_team=args.has_team,
        paid_upsell=args.paid_upsell,
    )
    print(json.dumps(res, ensure_ascii=False, indent=2))
    print(f"\n[LTV] ¥{res['ltv']:.0f}  →  {res['tier']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
