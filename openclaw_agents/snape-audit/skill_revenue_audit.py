"""斯内普·审计部 — 收入与支出审计
审计公司财务数据，检查异常交易和预算偏差。
"""
import json, os
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_DIR = os.path.join(ROOT, "data_raw")

def main():
    print("=== Revenue & Expense Audit ===\n")

    findings = []

    # Check invoice ledger
    ledger_file = os.path.join(DATA_DIR, "invoice_ledger.json")
    if os.path.exists(ledger_file):
        ledger = json.load(open(ledger_file, "r", encoding="utf-8"))
        total_invoiced = sum(r.get("total", 0) for r in ledger)
        print(f"  Invoices: {len(ledger)} | Total: CNY{total_invoiced:,}")

        for inv in ledger:
            if inv.get("total", 0) > 50000:
                findings.append({"type": "large_invoice", "amount": inv["total"],
                                "client": inv.get("client", "unknown")})
            if inv.get("total", 0) <= 0:
                findings.append({"type": "zero_invoice", "invoice": inv.get("invoice_no", "unknown")})
    else:
        print("  No invoice ledger found")
        findings.append({"type": "no_ledger", "severity": "INFO"})

    # Check sales pipeline consistency
    pipeline_file = os.path.join(DATA_DIR, "sales_pipeline.json")
    if os.path.exists(pipeline_file):
        pipeline = json.load(open(pipeline_file, "r", encoding="utf-8"))
        leads = pipeline.get("leads", [])
        won = [l for l in leads if l.get("stage") == "won"]
        total_pipeline = sum(l.get("value", 0) for l in leads)
        print(f"  Pipeline: {len(leads)} leads | Value: CNY{total_pipeline:,}")

        stale = [l for l in leads if not l.get("updated")]
        if stale:
            findings.append({"type": "stale_leads", "count": len(stale)})
    else:
        print("  No pipeline data")

    # Check service catalog pricing
    catalog_file = os.path.join(DATA_DIR, "service_catalog.json")
    if os.path.exists(catalog_file):
        catalog = json.load(open(catalog_file, "r", encoding="utf-8"))
        services = catalog.get("services", [])
        for svc in services:
            if svc.get("price", 0) < 1000:
                findings.append({"type": "underpriced_service", "service": svc.get("name_cn", ""),
                                "price": svc.get("price", 0)})
        print(f"  Services: {len(services)} active")

    # API cost check
    finance_files = sorted([f for f in os.listdir(OUTPUT) if f.startswith("finance_report")])
    if finance_files:
        latest = json.load(open(os.path.join(OUTPUT, finance_files[-1]), "r", encoding="utf-8"))
        api_cost = latest.get("total_estimated_cost_usd", 0)
        print(f"  API Cost (7d): ${api_cost}")
        if api_cost > 50:
            findings.append({"type": "high_api_cost", "cost": api_cost})

    print(f"\n--- Audit Findings: {len(findings)} ---")
    for f in findings:
        print(f"  [{f['type']}] {json.dumps({k:v for k,v in f.items() if k != 'type'}, ensure_ascii=False)}")

    report = {
        "audit_date": datetime.now().isoformat(),
        "auditor": "snape-audit",
        "findings_count": len(findings),
        "findings": findings,
        "risk_level": "HIGH" if len(findings) > 5 else ("MEDIUM" if findings else "LOW")
    }

    out_file = os.path.join(OUTPUT, f"revenue_audit_{datetime.now():%Y%m%d}.json")
    json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nAudit report: {out_file}")

if __name__ == "__main__":
    main()
