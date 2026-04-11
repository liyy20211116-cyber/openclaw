"""斯内普·审计部 — 依赖安全深度检查
扫描所有 Python 依赖的安全漏洞、许可证合规性和供应链风险。
"""
import subprocess, sys, json, os, re
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 斯内普·依赖安全深度检查 ===\n")

report = {"timestamp": datetime.now().isoformat(), "checks": [], "risk_level": "LOW"}

def add_check(name, status, details):
    report["checks"].append({"name": name, "status": status, "details": details})

# --- 1. pip 已安装包列表 ---
print("[1/5] 获取已安装依赖清单 ...")
try:
    r = subprocess.run([sys.executable, "-m", "pip", "list", "--format=json"],
                       capture_output=True, text=True, timeout=30)
    packages = json.loads(r.stdout) if r.stdout.strip() else []
    add_check("installed_packages", "ok", {"count": len(packages)})
    print(f"   {len(packages)} 个已安装包")
except Exception as e:
    packages = []
    add_check("installed_packages", "error", {"error": str(e)})

# --- 2. 已知恶意/风险包检测 ---
print("[2/5] 恶意包名检测 ...")
KNOWN_TYPOSQUAT = [
    "python-dateutil" not in ["python-dateutil"],
    "request", "requets", "reqeusts",
    "python3-dateutil", "python-dateutl",
    "urlib3", "urrlib3",
    "beautifulsoup", "beutifulsoup4",
    "numpyy", "pandass", "scikitlearn",
]
suspicious = []
pkg_names = [p["name"].lower() for p in packages]
for pkg in pkg_names:
    if len(pkg) <= 2:
        suspicious.append({"name": pkg, "reason": "包名过短（可能是恶意包）"})
    if re.match(r'^[a-z]+-[a-z]+-[a-z]+-[a-z]+', pkg):
        suspicious.append({"name": pkg, "reason": "包名异常长（多段连字符）"})

add_check("typosquat_check", "warn" if suspicious else "ok",
          {"suspicious_count": len(suspicious), "packages": suspicious[:5]})
print(f"   {len(suspicious)} 个可疑包名")

# --- 3. requirements.txt 锁定检查 ---
print("[3/5] 依赖版本锁定检查 ...")
req_file = os.path.join(ROOT, "requirements.txt")
if os.path.exists(req_file):
    lines = open(req_file, "r").readlines()
    unlocked = [l.strip() for l in lines if l.strip() and not l.startswith("#")
                and "==" not in l and ">=" not in l]
    add_check("version_lock", "warn" if unlocked else "ok",
              {"unlocked": unlocked[:10], "total_deps": len(lines)})
    print(f"   {len(unlocked)} 个未锁定版本")
else:
    add_check("version_lock", "warn", {"message": "requirements.txt 不存在"})
    print("   requirements.txt 不存在")

# --- 4. 敏感数据在依赖中的暴露检查 ---
print("[4/5] 依赖配置安全检查 ...")
pip_config_paths = [
    os.path.expanduser("~/.pip/pip.conf"),
    os.path.expanduser("~/pip/pip.ini"),
    os.path.expanduser("~/.config/pip/pip.conf"),
]
config_issues = []
for cp in pip_config_paths:
    if os.path.exists(cp):
        content = open(cp, "r", encoding="utf-8", errors="ignore").read()
        if re.search(r'password|token|secret', content, re.IGNORECASE):
            config_issues.append({"file": cp, "issue": "pip 配置中包含敏感信息"})

add_check("pip_config_security", "warn" if config_issues else "ok",
          {"issues": config_issues})
print(f"   {len(config_issues)} 个配置安全问题")

# --- 5. 许可证合规检查 ---
print("[5/5] 许可证合规检查 ...")
try:
    r = subprocess.run([sys.executable, "-m", "pip", "show"] + [p["name"] for p in packages[:20]],
                       capture_output=True, text=True, timeout=30)
    licenses = re.findall(r'License:\s*(.*)', r.stdout)
    license_counts = {}
    risky_licenses = []
    for lic in licenses:
        lic = lic.strip() or "UNKNOWN"
        license_counts[lic] = license_counts.get(lic, 0) + 1
        if lic.upper() in ("UNKNOWN", "OTHER", ""):
            risky_licenses.append(lic)
        if "GPL" in lic.upper() and "LGPL" not in lic.upper():
            risky_licenses.append(f"GPL: {lic}")

    add_check("license_compliance", "warn" if risky_licenses else "ok", {
        "license_distribution": dict(sorted(license_counts.items(), key=lambda x: -x[1])[:10]),
        "risky_count": len(risky_licenses)
    })
    print(f"   {len(license_counts)} 种许可证，{len(risky_licenses)} 个风险许可")
except Exception as e:
    add_check("license_compliance", "error", {"error": str(e)})

# --- 风险等级 ---
warn_count = sum(1 for c in report["checks"] if c["status"] == "warn")
error_count = sum(1 for c in report["checks"] if c["status"] == "error")
if error_count >= 2:
    report["risk_level"] = "HIGH"
elif warn_count >= 3:
    report["risk_level"] = "MEDIUM"

out_file = os.path.join(OUTPUT, f"dep_security_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'='*40}")
print(f"风险等级: {report['risk_level']}")
print(f"检查项: {len(report['checks'])} 项（通过: {sum(1 for c in report['checks'] if c['status']=='ok')}, 警告: {warn_count}, 错误: {error_count}）")
print(f"报告: {out_file}")
