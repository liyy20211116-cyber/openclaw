"""珀西·财务部 — 发票/报价单生成器
使用 Jinja2 + openpyxl 生成专业的报价单和发票。
"""
import json, os
from datetime import datetime, timedelta
from jinja2 import Template

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_DIR = os.path.join(ROOT, "data_raw")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 珀西·报价单/发票生成器 ===\n")

INVOICE_TEMPLATE = """<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<style>
body{font-family:'Microsoft YaHei',sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333}
.header{display:flex;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px}
.title{font-size:28px;font-weight:bold;color:#2563eb}
.info{text-align:right;font-size:13px;color:#666}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#2563eb;color:white;padding:12px;text-align:left}
td{padding:10px;border-bottom:1px solid #eee}
.total-row{font-weight:bold;font-size:16px;background:#f0f4ff}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#999}
.amount{text-align:right}
.notes{background:#fffbeb;padding:15px;border-left:4px solid #f59e0b;margin:20px 0}
</style></head><body>
<div class="header">
<div><div class="title">{{ doc_type }}</div><div>编号: {{ invoice_no }}</div></div>
<div class="info"><div>{{ company_name }}</div><div>日期: {{ date }}</div><div>有效期至: {{ valid_until }}</div></div>
</div>
<div><strong>客户:</strong> {{ client_name }}</div>
<table>
<tr><th>#</th><th>项目</th><th>描述</th><th>数量</th><th class="amount">单价</th><th class="amount">金额</th></tr>
{% for item in items %}
<tr><td>{{ loop.index }}</td><td>{{ item.name }}</td><td>{{ item.desc }}</td><td>{{ item.qty }}</td><td class="amount">¥{{ "%.2f"|format(item.price) }}</td><td class="amount">¥{{ "%.2f"|format(item.qty * item.price) }}</td></tr>
{% endfor %}
<tr class="total-row"><td colspan="5" class="amount">合计</td><td class="amount">¥{{ "%.2f"|format(total) }}</td></tr>
</table>
{% if notes %}<div class="notes"><strong>备注:</strong> {{ notes }}</div>{% endif %}
<div class="footer">
<p>此{{ doc_type }}由一人公司智能体系统自动生成</p>
<p>付款方式: 银行转账 | 支付宝 | 微信支付</p>
</div></body></html>"""

def generate_invoice(client_name, items, doc_type="报价单", notes="", invoice_no=None):
    if not invoice_no:
        invoice_no = f"INV-{datetime.now():%Y%m%d%H%M}"

    total = sum(it["qty"] * it["price"] for it in items)
    tpl = Template(INVOICE_TEMPLATE)
    html = tpl.render(
        doc_type=doc_type,
        invoice_no=invoice_no,
        company_name="一人公司",
        date=datetime.now().strftime("%Y-%m-%d"),
        valid_until=(datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        client_name=client_name,
        items=items,
        total=total,
        notes=notes,
    )

    out_file = os.path.join(OUTPUT, f"{doc_type}_{invoice_no}.html")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(html)

    record = {
        "invoice_no": invoice_no,
        "doc_type": doc_type,
        "client": client_name,
        "total": total,
        "date": datetime.now().isoformat(),
        "file": out_file,
        "items": items,
    }

    ledger_file = os.path.join(DATA_DIR, "invoice_ledger.json")
    ledger = []
    if os.path.exists(ledger_file):
        ledger = json.load(open(ledger_file, "r", encoding="utf-8"))
    ledger.append(record)
    json.dump(ledger, open(ledger_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"已生成 {doc_type}: {out_file}")
    print(f"Amount: CNY{total:,.2f}")
    return out_file

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        generate_invoice(
            client_name="示例客户有限公司",
            items=[
                {"name": "AI 自动化咨询", "desc": "需求分析与方案设计", "qty": 1, "price": 5000},
                {"name": "Agent 开发", "desc": "定制 AI Agent 开发部署", "qty": 3, "price": 3000},
                {"name": "运维支持", "desc": "月度运维与优化", "qty": 1, "price": 2000},
            ],
            doc_type="报价单",
            notes="此报价单有效期 30 天，含税价格"
        )
    else:
        print("用法: python invoice_generator.py --demo")
        print("或在代码中调用 generate_invoice() 函数")
