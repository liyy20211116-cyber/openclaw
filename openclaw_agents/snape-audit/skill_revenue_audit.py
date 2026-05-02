"""
skill_revenue_audit.py — 斯内普的技能：收入支出审计
审计公司财务数据，检查发票、销售管道、服务定价和 API 成本的异常
"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "audit")
DATA_DIR = os.path.join(PROJECT_ROOT, "data_raw")

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")
    findings = []
    stats = {"invoices": 0, "total_invoiced": 0, "pipeline_leads": 0, "services": 0, "api_cost": 0}

    ledger_file = os.path.join(DATA_DIR, "invoice_ledger.json")
    if os.path.exists(ledger_file):
        try:
            ledger = json.loads(open(ledger_file, encoding="utf-8").read())
            stats["invoices"] = len(ledger)
            stats["total_invoiced"] = sum(r.get("total", 0) for r in ledger)
            for inv in ledger:
                if inv.get("total", 0) > 50000:
                    findings.append({"type": "large_invoice", "severity": "warning",
                                     "detail": f"大额发票 CNY{inv['total']:,} 客户: {inv.get('client', '未知')}"})
                if inv.get("total", 0) <= 0:
                    findings.append({"type": "zero_invoice", "severity": "critical",
                                     "detail": f"零金额发票: {inv.get('invoice_no', '未知')}"})
        except Exception as e:
            findings.append({"type": "ledger_error", "severity": "warning", "detail": f"发票账本读取失败: {e}"})
    else:
        findings.append({"type": "no_ledger", "severity": "info", "detail": "未找到发票账本文件"})

    pipeline_file = os.path.join(DATA_DIR, "sales_pipeline.json")
    if os.path.exists(pipeline_file):
        try:
            pipeline = json.loads(open(pipeline_file, encoding="utf-8").read())
            leads = pipeline.get("leads", [])
            stats["pipeline_leads"] = len(leads)
            stale = [l for l in leads if not l.get("updated")]
            if stale:
                findings.append({"type": "stale_leads", "severity": "warning",
                                 "detail": f"{len(stale)} 条线索缺少更新时间"})
        except Exception as e:
            findings.append({"type": "pipeline_error", "severity": "warning", "detail": f"销售管道读取失败: {e}"})

    catalog_file = os.path.join(DATA_DIR, "service_catalog.json")
    if os.path.exists(catalog_file):
        try:
            catalog = json.loads(open(catalog_file, encoding="utf-8").read())
            services = catalog.get("services", [])
            stats["services"] = len(services)
            for svc in services:
                if svc.get("price", 0) < 1000:
                    findings.append({"type": "underpriced", "severity": "warning",
                                     "detail": f"低价服务: {svc.get('name_cn', svc.get('name', ''))} CNY{svc.get('price', 0)}"})
        except Exception:
            pass

    finance_dir = os.path.join(PROJECT_ROOT, "output")
    if os.path.isdir(finance_dir):
        finance_files = sorted([f for f in os.listdir(finance_dir) if f.startswith("finance_report")])
        if finance_files:
            try:
                latest = json.loads(open(os.path.join(finance_dir, finance_files[-1]), encoding="utf-8").read())
                stats["api_cost"] = latest.get("total_estimated_cost_usd", 0)
                if stats["api_cost"] > 50:
                    findings.append({"type": "high_api_cost", "severity": "warning",
                                     "detail": f"7天API成本 ${stats['api_cost']} 偏高"})
            except Exception:
                pass

    critical = sum(1 for f in findings if f["severity"] == "critical")
    warnings = sum(1 for f in findings if f["severity"] == "warning")
    risk = "高风险" if critical > 0 else ("中风险" if warnings > 3 else "低风险")

    report = {
        "audit_date": timestamp,
        "auditor": "snape-audit",
        "risk_level": risk,
        "stats": stats,
        "findings": findings,
    }

    out_file = os.path.join(OUTPUT_DIR, f"revenue_audit_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    out = SkillOutput()
    if critical > 0:
        out.status = "failed"
    out.summary = f"收支审计: {risk} | 发票{stats['invoices']}张/CNY{stats['total_invoiced']:,} | 发现{len(findings)}项 (严重{critical}/警告{warnings})"
    out.data = report
    out.metrics["findingsCount"] = len(findings)
    out.metrics["criticalCount"] = critical
    if critical > 0:
        out.suggest_next("snape_compliance_check", "snape-audit")
    out.emit()


if __name__ == "__main__":
    main()
