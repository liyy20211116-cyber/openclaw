"""贾维斯·COO — 每日公司运营总报告
汇总各部门数据，生成一份公司级运营概览。
"""
import json, os, subprocess, sys
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=" * 50)
print(f"  一人公司每日运营报告 | {datetime.now():%Y-%m-%d %H:%M}")
print("=" * 50)

report_sections = {}

# --- 1. 技术部 — 代码质量 ---
print("\n[技术部] 运行代码审计 ...")
try:
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "tech_code_audit.py")],
                       capture_output=True, text=True, timeout=120, cwd=ROOT)
    report_sections["tech"] = {"status": "done", "output": r.stdout[-500:] if r.stdout else ""}
except Exception as e:
    report_sections["tech"] = {"status": "error", "error": str(e)}

# --- 2. 财务部 — 成本报告 ---
print("\n[财务部] 运行成本统计 ...")
try:
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "finance_report.py")],
                       capture_output=True, text=True, timeout=60, cwd=ROOT)
    report_sections["finance"] = {"status": "done", "output": r.stdout[-500:] if r.stdout else ""}
except Exception as e:
    report_sections["finance"] = {"status": "error", "error": str(e)}

# --- 3. 增长部 — 内容素材 ---
print("\n[增长部] 运行内容生成 ...")
try:
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "growth_content_gen.py")],
                       capture_output=True, text=True, timeout=60, cwd=ROOT)
    report_sections["growth"] = {"status": "done", "output": r.stdout[-500:] if r.stdout else ""}
except Exception as e:
    report_sections["growth"] = {"status": "error", "error": str(e)}

# --- 4. 审计部 — 安全扫描 ---
print("\n[审计部] 运行安全扫描 ...")
try:
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "audit_security_scan.py")],
                       capture_output=True, text=True, timeout=120, cwd=ROOT)
    report_sections["audit"] = {"status": "done", "output": r.stdout[-500:] if r.stdout else ""}
except Exception as e:
    report_sections["audit"] = {"status": "error", "error": str(e)}

# --- 5. 系统健康 ---
print("\n[系统] 检查基础设施 ...")
infra = {}
for cmd, name in [
    ([sys.executable, "--version"], "python"),
    (["node", "--version"], "node"),
]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        infra[name] = r.stdout.strip() or r.stderr.strip()
    except Exception:
        infra[name] = "unavailable"

openclaw_running = False
try:
    r = subprocess.run(["powershell", "-c", "(Get-Process node -ErrorAction SilentlyContinue).Count"],
                       capture_output=True, text=True, timeout=10)
    count = int(r.stdout.strip() or "0")
    openclaw_running = count > 5
    infra["openclaw_processes"] = count
except Exception:
    infra["openclaw_processes"] = 0

report_sections["infrastructure"] = {
    "status": "healthy" if openclaw_running else "degraded",
    **infra
}

# --- 汇总 ---
daily_report = {
    "date": datetime.now().isoformat(),
    "company": "一人公司",
    "coo": "贾维斯",
    "sections": report_sections,
    "summary": {
        "departments_reported": len([s for s in report_sections.values() if s.get("status") == "done"]),
        "departments_error": len([s for s in report_sections.values() if s.get("status") == "error"]),
        "infrastructure": report_sections.get("infrastructure", {}).get("status", "unknown")
    }
}

out_file = os.path.join(OUTPUT, f"daily_report_{datetime.now():%Y%m%d}.json")
json.dump(daily_report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'=' * 50}")
print(f"  报告完成: {daily_report['summary']['departments_reported']} 个部门汇报")
print(f"  异常部门: {daily_report['summary']['departments_error']} 个")
print(f"  基础设施: {daily_report['summary']['infrastructure']}")
print(f"  输出: {out_file}")
print(f"{'=' * 50}")
