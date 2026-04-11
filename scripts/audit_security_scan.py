"""斯内普·审计部 — 安全风控扫描
全面扫描项目安全隐患：密钥泄露、依赖漏洞、权限异常。
"""
import json, os, re, subprocess, sys
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 斯内普·安全风控扫描 ===\n")

report = {"timestamp": datetime.now().isoformat(), "risk_level": "LOW", "findings": []}

def add_finding(severity, category, description, file="", line=0):
    report["findings"].append({
        "severity": severity, "category": category,
        "description": description, "file": file, "line": line
    })

# --- 1. 密钥泄露扫描 ---
print("[1/4] 密钥泄露扫描 ...")
secret_patterns = [
    (r'(?i)(app_?secret|client_?secret)\s*[=:"\']\s*["\']?([a-zA-Z0-9]{20,})', "AppSecret 泄露"),
    (r'(?i)(password|passwd)\s*[=:"\']\s*["\']([^"\']{6,})', "密码硬编码"),
    (r'sk-[a-zA-Z0-9]{20,}', "OpenAI API Key"),
    (r'xoxb-[0-9]{10,}-[a-zA-Z0-9]{20,}', "Slack Token"),
    (r'ghp_[a-zA-Z0-9]{36}', "GitHub Token"),
]
secret_count = 0
scan_dirs = ["scripts", "openclaw_agents", "config", "skills", "openclaw_skills"]
for sd in scan_dirs:
    full_dir = os.path.join(ROOT, sd)
    if not os.path.isdir(full_dir):
        continue
    for dp, _, fns in os.walk(full_dir):
        for fn in fns:
            if not fn.endswith((".py", ".json", ".json5", ".md", ".txt", ".bat", ".ps1")):
                continue
            fp = os.path.join(dp, fn)
            try:
                content = open(fp, "r", encoding="utf-8", errors="ignore").read()
                for pat, desc in secret_patterns:
                    for m in re.finditer(pat, content):
                        ln = content[:m.start()].count("\n") + 1
                        add_finding("HIGH", "secret_leak", desc, fp, ln)
                        secret_count += 1
            except Exception:
                pass
print(f"   发现 {secret_count} 处密钥泄露风险")

# --- 2. 依赖漏洞检查 ---
print("[2/4] 依赖漏洞检查 ...")
try:
    r = subprocess.run(
        [sys.executable, "-m", "pip", "list", "--outdated", "--format=json"],
        capture_output=True, text=True, timeout=60
    )
    outdated = json.loads(r.stdout) if r.stdout.strip() else []
    for pkg in outdated[:5]:
        add_finding("LOW", "outdated_dep",
                    f"{pkg['name']} {pkg['version']} -> {pkg['latest_version']}")
    print(f"   {len(outdated)} 个过时依赖")
except Exception as e:
    print(f"   检查失败: {e}")

# --- 3. 文件权限与大文件检查 ---
print("[3/4] 大文件与异常文件检查 ...")
large_files = []
for dp, _, fns in os.walk(ROOT):
    if any(skip in dp for skip in ("node_modules", ".git", "OpenClaw", "__pycache__")):
        continue
    for fn in fns:
        fp = os.path.join(dp, fn)
        try:
            size = os.path.getsize(fp)
            if size > 10 * 1024 * 1024:
                large_files.append((fp, size))
                add_finding("LOW", "large_file", f"{size // (1024*1024)}MB: {fp}", fp)
        except Exception:
            pass
print(f"   {len(large_files)} 个超过 10MB 的文件")

# --- 4. .env 和 .gitignore 检查 ---
print("[4/4] 配置安全检查 ...")
env_file = os.path.join(ROOT, ".env")
gitignore = os.path.join(ROOT, ".gitignore")
if os.path.exists(env_file):
    gi_content = open(gitignore, "r", encoding="utf-8").read() if os.path.exists(gitignore) else ""
    if ".env" not in gi_content:
        add_finding("HIGH", "config", ".env 文件未加入 .gitignore", env_file)
        print("   警告: .env 未在 .gitignore 中")
    else:
        print("   .env is in .gitignore [OK]")
else:
    print("   无 .env 文件")

# --- 风险等级评定 ---
high_count = sum(1 for f in report["findings"] if f["severity"] == "HIGH")
if high_count >= 5:
    report["risk_level"] = "CRITICAL"
elif high_count >= 1:
    report["risk_level"] = "HIGH"
elif len(report["findings"]) >= 5:
    report["risk_level"] = "MEDIUM"

# --- 输出 ---
out_file = os.path.join(OUTPUT, f"security_audit_{datetime.now():%Y%m%d_%H%M}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'='*40}")
print(f"风险等级: {report['risk_level']}")
print(f"总发现: {len(report['findings'])} 项 (HIGH: {high_count})")
print(f"报告: {out_file}")
