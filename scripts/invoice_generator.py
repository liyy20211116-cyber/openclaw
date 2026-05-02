"""珀西·财务部 — 发票/报价单生成器
使用 Jinja2 生成专业的报价单和发票，含收款信息。
"""
import json, os, base64
from datetime import datetime, timedelta
from jinja2 import Template

ROOT = "D:\\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_DIR = os.path.join(ROOT, "data_raw")
CONFIG_DIR = os.path.join(ROOT, "config")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 珀西·报价单/发票生成器 ===\n")

def load_payment_info():
    path = os.path.join(CONFIG_DIR, "payment-info.json")
    if os.path.exists(path):
        return json.load(open(path, "r", encoding="utf-8"))
    return {}

def encode_qr_image(image_path):
    if not image_path or not os.path.exists(image_path):
        return None
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    ext = os.path.splitext(image_path)[1].lower()
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext.lstrip("."), "image/png")
    return f"data:{mime};base64,{data}"

INVOICE_TEMPLATE = """<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<style>
body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333;line-height:1.6}
.header{display:flex;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px}
.title{font-size:28px;font-weight:bold;color:#2563eb}
.info{text-align:right;font-size:13px;color:#666}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#2563eb;color:white;padding:12px;text-align:left}
td{padding:10px;border-bottom:1px solid #eee}
.total-row{font-weight:bold;font-size:16px;background:#f0f4ff}
.amount{text-align:right}
.notes{background:#fffbeb;padding:15px;border-left:4px solid #f59e0b;margin:20px 0;border-radius:0 8px 8px 0}
.payment-section{margin-top:30px;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px}
.payment-title{font-size:16px;font-weight:bold;color:#2563eb;margin-bottom:15px;padding-bottom:10px;border-bottom:2px solid #e2e8f0}
.payment-methods{display:flex;gap:20px;flex-wrap:wrap}
.payment-method{flex:1;min-width:200px;padding:15px;background:white;border-radius:8px;border:1px solid #e2e8f0}
.payment-method h4{margin:0 0 8px;color:#334155;font-size:14px}
.payment-method p{margin:3px 0;font-size:12px;color:#64748b}
.payment-method .account{font-family:monospace;font-size:13px;color:#1e293b;font-weight:600;letter-spacing:0.5px}
.qr-code{width:140px;height:140px;margin:10px auto;display:block;border-radius:8px}
.contact-section{margin-top:20px;padding:15px;background:#f0f4ff;border-radius:8px;display:flex;gap:20px;flex-wrap:wrap}
.contact-item{font-size:12px;color:#475569}
.contact-item strong{color:#334155}
.footer{margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:11px;color:#94a3b8;text-align:center}
</style></head><body>
<div class="header">
<div><div class="title">{{ doc_type }}</div><div>编号: {{ invoice_no }}</div></div>
<div class="info"><div>{{ company_name }}</div><div>日期: {{ date }}</div><div>有效期至: {{ valid_until }}</div></div>
</div>
<div style="margin-bottom:20px"><strong>客户:</strong> {{ client_name }}</div>
<table>
<tr><th>#</th><th>项目</th><th>描述</th><th>数量</th><th class="amount">单价</th><th class="amount">金额</th></tr>
{% for item in items %}
<tr><td>{{ loop.index }}</td><td>{{ item.name }}</td><td>{{ item.desc }}</td><td>{{ item.qty }}</td><td class="amount">¥{{ "%.2f"|format(item.price) }}</td><td class="amount">¥{{ "%.2f"|format(item.qty * item.price) }}</td></tr>
{% endfor %}
<tr class="total-row"><td colspan="5" class="amount">合计</td><td class="amount">¥{{ "%.2f"|format(total) }}</td></tr>
</table>
{% if notes %}<div class="notes"><strong>备注:</strong> {{ notes }}</div>{% endif %}

<div class="payment-section">
<div class="payment-title">💳 付款方式</div>
<div class="payment-methods">
{% if bank_enabled %}
<div class="payment-method">
<h4>🏦 银行转账</h4>
<p>开户行: {{ bank_name }}</p>
<p>户名: {{ bank_account_name }}</p>
<p class="account">{{ bank_account_no }}</p>
<p style="color:#f59e0b;font-size:11px">{{ bank_note }}</p>
</div>
{% endif %}
{% if alipay_enabled %}
<div class="payment-method" style="text-align:center">
<h4>💙 支付宝</h4>
{% if alipay_qr %}<img src="{{ alipay_qr }}" class="qr-code" alt="支付宝收款码">{% endif %}
{% if alipay_account %}<p class="account">{{ alipay_account }}</p>{% endif %}
<p style="color:#f59e0b;font-size:11px">{{ alipay_note }}</p>
</div>
{% endif %}
{% if wechat_enabled %}
<div class="payment-method" style="text-align:center">
<h4>💚 微信支付</h4>
{% if wechat_qr %}<img src="{{ wechat_qr }}" class="qr-code" alt="微信收款码">{% endif %}
{% if wechat_account %}<p class="account">{{ wechat_account }}</p>{% endif %}
<p style="color:#f59e0b;font-size:11px">{{ wechat_note }}</p>
</div>
{% endif %}
{% if not bank_enabled and not alipay_enabled and not wechat_enabled %}
<div class="payment-method">
<h4>请联系我们获取付款信息</h4>
<p>邮箱: {{ contact_email }}</p>
</div>
{% endif %}
</div>
</div>

{% if contact_name or contact_email or contact_phone or contact_wechat %}
<div class="contact-section">
{% if contact_name %}<div class="contact-item"><strong>联系人:</strong> {{ contact_name }}</div>{% endif %}
{% if contact_email %}<div class="contact-item"><strong>邮箱:</strong> {{ contact_email }}</div>{% endif %}
{% if contact_phone %}<div class="contact-item"><strong>电话:</strong> {{ contact_phone }}</div>{% endif %}
{% if contact_wechat %}<div class="contact-item"><strong>微信:</strong> {{ contact_wechat }}</div>{% endif %}
</div>
{% endif %}

<div class="footer">
<p>此{{ doc_type }}由 {{ company_name }} 智能体系统自动生成</p>
{% if footer_note %}<p>{{ footer_note }}</p>{% endif %}
</div></body></html>"""

def generate_invoice(client_name, items, doc_type="报价单", notes="", invoice_no=None):
    if not invoice_no:
        invoice_no = f"INV-{datetime.now():%Y%m%d%H%M}"

    pay = load_payment_info()
    total = sum(it["qty"] * it["price"] for it in items)

    bank = pay.get("bank", {})
    alipay = pay.get("alipay", {})
    wechat = pay.get("wechat_pay", {})

    tpl = Template(INVOICE_TEMPLATE)
    html = tpl.render(
        doc_type=doc_type,
        invoice_no=invoice_no,
        company_name=pay.get("company_name", "一人公司"),
        date=datetime.now().strftime("%Y-%m-%d"),
        valid_until=(datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        client_name=client_name,
        items=items,
        total=total,
        notes=notes,
        bank_enabled=bank.get("enabled", False),
        bank_name=bank.get("bank_name", ""),
        bank_account_name=bank.get("account_name", ""),
        bank_account_no=bank.get("account_no", ""),
        bank_note=bank.get("note", ""),
        alipay_enabled=alipay.get("enabled", False),
        alipay_account=alipay.get("account", ""),
        alipay_qr=encode_qr_image(alipay.get("qr_image_path", "")),
        alipay_note=alipay.get("note", ""),
        wechat_enabled=wechat.get("enabled", False),
        wechat_account=wechat.get("account", ""),
        wechat_qr=encode_qr_image(wechat.get("qr_image_path", "")),
        wechat_note=wechat.get("note", ""),
        contact_name=pay.get("contact_name", ""),
        contact_email=pay.get("contact_email", ""),
        contact_phone=pay.get("contact_phone", ""),
        contact_wechat=pay.get("contact_wechat", ""),
        footer_note=pay.get("footer_note", ""),
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
