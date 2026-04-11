"""珀西·财务部 — ROI 计算器
帮助评估项目投资回报率，支持销售报价决策。
"""
import json, os
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

def calculate_roi(investment, monthly_savings, months=12, implementation_months=1):
    total_savings = monthly_savings * (months - implementation_months)
    net_profit = total_savings - investment
    roi_pct = (net_profit / investment * 100) if investment > 0 else 0
    payback_months = investment / monthly_savings if monthly_savings > 0 else float('inf')

    return {
        "investment": investment,
        "monthly_savings": monthly_savings,
        "period_months": months,
        "implementation_months": implementation_months,
        "total_savings": total_savings,
        "net_profit": net_profit,
        "roi_pct": round(roi_pct, 1),
        "payback_months": round(payback_months, 1),
        "recommendation": "PROCEED" if roi_pct > 100 else ("CONSIDER" if roi_pct > 30 else "HOLD")
    }

def main():
    print("=== ROI Calculator ===\n")

    scenarios = [
        {
            "name": "AI Workflow Automation - Small Biz",
            "investment": 10000,
            "monthly_savings": 5000,
            "months": 12
        },
        {
            "name": "Custom Agent Development",
            "investment": 30000,
            "monthly_savings": 8000,
            "months": 12
        },
        {
            "name": "AI Training Workshop",
            "investment": 5000,
            "monthly_savings": 2000,
            "months": 6
        },
    ]

    results = []
    for s in scenarios:
        roi = calculate_roi(s["investment"], s["monthly_savings"], s["months"])
        results.append({"scenario": s["name"], **roi})
        print(f"  {s['name']}")
        print(f"    Investment: CNY{s['investment']:,}")
        print(f"    Monthly Savings: CNY{s['monthly_savings']:,}")
        print(f"    ROI: {roi['roi_pct']}% | Payback: {roi['payback_months']}m | {roi['recommendation']}")
        print()

    out_file = os.path.join(OUTPUT, f"roi_analysis_{datetime.now():%Y%m%d}.json")
    json.dump({
        "generated_at": datetime.now().isoformat(),
        "scenarios": results
    }, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"Report: {out_file}")

if __name__ == "__main__":
    main()
