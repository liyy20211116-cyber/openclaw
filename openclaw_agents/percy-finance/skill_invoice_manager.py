"""
skill_invoice_manager.py — 珀西的技能：发票与账单管理
管理客户发票、应收账款，生成对账报表
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data_raw")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "finance")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1000):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是珀西·韦斯莱，一人公司首席财务官(CFO)。输出简洁的财务分析和建议。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def load_invoices():
    ledger_file = os.path.join(DATA_DIR, "invoice_ledger.json")
    if os.path.exists(ledger_file):
        try:
            return json.loads(open(ledger_file, encoding="utf-8").read())
        except Exception:
            pass
    return []


def load_payment_info():
    payment_file = os.path.join(PROJECT_ROOT, "config", "payment-info.json")
    if os.path.exists(payment_file):
        try:
            return json.loads(open(payment_file, encoding="utf-8").read())
        except Exception:
            pass
    return {}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    invoices = load_invoices()
    payment_info = load_payment_info()

    total_invoiced = sum(inv.get("total", 0) for inv in invoices)
    paid = [inv for inv in invoices if inv.get("status") == "paid"]
    unpaid = [inv for inv in invoices if inv.get("status") != "paid"]
    total_paid = sum(inv.get("total", 0) for inv in paid)
    total_unpaid = sum(inv.get("total", 0) for inv in unpaid)

    overdue = []
    for inv in unpaid:
        due = inv.get("due_date", "")
        if due and due < time.strftime("%Y-%m-%d"):
            overdue.append(inv)

    stats = {
        "total_invoices": len(invoices),
        "total_invoiced": total_invoiced,
        "paid_count": len(paid),
        "paid_amount": total_paid,
        "unpaid_count": len(unpaid),
        "unpaid_amount": total_unpaid,
        "overdue_count": len(overdue),
        "overdue_amount": sum(inv.get("total", 0) for inv in overdue),
        "collection_rate": round(total_paid / total_invoiced * 100, 1) if total_invoiced > 0 else 0,
    }

    prompt = f"""## 发票管理报告

当前发票统计：
- 总开票 {stats['total_invoices']} 张，金额 CNY{stats['total_invoiced']:,}
- 已回款 {stats['paid_count']} 张 / CNY{stats['paid_amount']:,}
- 待回款 {stats['unpaid_count']} 张 / CNY{stats['unpaid_amount']:,}
- 逾期 {stats['overdue_count']} 张 / CNY{stats['overdue_amount']:,}
- 回款率 {stats['collection_rate']}%

{f'任务补充: {task_arg}' if task_arg else ''}

请给出：
1. 现金流健康度评估（一句话）
2. 催收优先级建议
3. 财务风险提示"""

    analysis = call_llm(prompt)

    report = {
        "report_date": timestamp,
        "stats": stats,
        "overdue_invoices": [{"client": inv.get("client", ""), "amount": inv.get("total", 0),
                              "due_date": inv.get("due_date", "")} for inv in overdue],
        "analysis": analysis,
    }

    out_file = os.path.join(OUTPUT_DIR, f"invoice_report_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = (f"发票管理: {stats['total_invoices']}张/CNY{stats['total_invoiced']:,} | "
               f"回款率{stats['collection_rate']}% | 逾期{stats['overdue_count']}张/CNY{stats['overdue_amount']:,}")
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
