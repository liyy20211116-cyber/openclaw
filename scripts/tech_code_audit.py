"""赫敏·技术部 — 代码质量审计脚本
扫描项目 Python 文件，输出安全隐患 + 代码风格问题报告。
"""
import subprocess, json, os, sys
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

report = {"timestamp": datetime.now().isoformat(), "checks": {}}

# --- 1. Bandit 安全扫描 ---
print("[1/3] Bandit 安全扫描 ...")
try:
    r = subprocess.run(
        [sys.executable, "-m", "bandit", "-r", os.path.join(ROOT, "scripts"),
         "-f", "json", "-q", "--severity-level", "medium"],
        capture_output=True, text=True, timeout=120
    )
    data = json.loads(r.stdout) if r.stdout.strip() else {}
    issues = data.get("results", [])
    report["checks"]["bandit"] = {
        "status": "pass" if not issues else "warn",
        "issue_count": len(issues),
        "top_issues": [
            {"file": i["filename"], "line": i["line_number"],
             "severity": i["issue_severity"], "text": i["issue_text"]}
            for i in issues[:10]
        ]
    }
    print(f"   发现 {len(issues)} 个安全问题")
except Exception as e:
    report["checks"]["bandit"] = {"status": "error", "message": str(e)}
    print(f"   Bandit 出错: {e}")

# --- 2. Ruff 代码风格检查 ---
print("[2/3] Ruff 代码风格检查 ...")
try:
    r = subprocess.run(
        [sys.executable, "-m", "ruff", "check", os.path.join(ROOT, "scripts"),
         "--output-format", "json", "--select", "E,W,F"],
        capture_output=True, text=True, timeout=60
    )
    items = json.loads(r.stdout) if r.stdout.strip() else []
    report["checks"]["ruff"] = {
        "status": "pass" if not items else "info",
        "issue_count": len(items),
        "top_issues": [
            {"file": i["filename"], "line": i["location"]["row"],
             "code": i["code"], "message": i["message"]}
            for i in items[:10]
        ]
    }
    print(f"   发现 {len(items)} 个风格问题")
except Exception as e:
    report["checks"]["ruff"] = {"status": "error", "message": str(e)}
    print(f"   Ruff 出错: {e}")

# --- 3. 敏感信息扫描 ---
print("[3/3] 敏感信息扫描 ...")
import re
sensitive_patterns = [
    (r'(?i)(password|passwd|secret|api_key|token)\s*[=:]\s*["\'][^"\']{8,}', "硬编码密钥"),
    (r'(?i)Bearer\s+[A-Za-z0-9\-._~+/]+=*', "Bearer Token"),
]
findings = []
scan_dirs = [os.path.join(ROOT, d) for d in ("scripts", "openclaw_agents", "config")]
for scan_dir in scan_dirs:
    if not os.path.isdir(scan_dir):
        continue
    for dirpath, _, filenames in os.walk(scan_dir):
        for fn in filenames:
            if not fn.endswith((".py", ".json", ".md", ".json5")):
                continue
            fp = os.path.join(dirpath, fn)
            try:
                content = open(fp, "r", encoding="utf-8", errors="ignore").read()
                for pat, desc in sensitive_patterns:
                    for m in re.finditer(pat, content):
                        findings.append({"file": fp, "type": desc, "line_hint": content[:m.start()].count("\n") + 1})
            except Exception:
                pass

report["checks"]["secrets"] = {
    "status": "pass" if not findings else "warn",
    "finding_count": len(findings),
    "findings": findings[:10]
}
print(f"   发现 {len(findings)} 处敏感信息")

# --- 输出报告 ---
out_file = os.path.join(OUTPUT, f"tech_audit_{datetime.now():%Y%m%d_%H%M}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\n审计报告已输出: {out_file}")

total = sum(c.get("issue_count", c.get("finding_count", 0)) for c in report["checks"].values())
print(f"总计发现 {total} 个问题")
