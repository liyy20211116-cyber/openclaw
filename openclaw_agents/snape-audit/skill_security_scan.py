"""
skill_security_scan.py — 斯内普的技能：全项目安全扫描
扫描所有 agent 代码中的安全隐患
"""
import json, os, re

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGENTS_DIR = os.path.join(PROJECT, "openclaw_agents")
SCRIPTS_DIR = os.path.join(PROJECT, "scripts")

issues = []
files_scanned = 0

SENSITIVE_PATTERNS = [
    (r'(app_secret|password|secret_key|api_key)\s*=\s*["\'][^"\']{8,}', "硬编码密钥/密码"),
    (r'(sk-[a-zA-Z0-9\-]{20,})', "API Key 明文暴露"),
    (r'Bearer\s+[a-zA-Z0-9\.\-_]{20,}', "Bearer Token 硬编码"),
]

CODE_PATTERNS = [
    (r'^\s*except\s*:', "裸 except（应指定异常类型）"),
    (r'eval\s*\(', "使用 eval（安全风险）"),
    (r'exec\s*\(', "使用 exec（安全风险）"),
    (r'subprocess.*shell\s*=\s*True', "shell=True（命令注入风险）"),
    (r'\.format\(.*input\b', "用户输入直接 format（注入风险）"),
]

def scan_file(fpath, fname):
    global files_scanned
    try:
        code = open(fpath, encoding="utf-8").read()
    except:
        return
    files_scanned += 1
    lines = code.split("\n")

    for i, line in enumerate(lines, 1):
        for pat, desc in SENSITIVE_PATTERNS:
            if re.search(pat, line, re.I):
                if "os.environ" not in line and "getenv" not in line and "#" not in line.split(pat[0])[0]:
                    issues.append({"file": fname, "line": i, "severity": "critical", "message": desc})
        for pat, desc in CODE_PATTERNS:
            if re.search(pat, line):
                issues.append({"file": fname, "line": i, "severity": "warning", "message": desc})

for scan_dir in [AGENTS_DIR, SCRIPTS_DIR]:
    if not os.path.isdir(scan_dir):
        continue
    for root, dirs, files in os.walk(scan_dir):
        if "__pycache__" in root or "node_modules" in root:
            continue
        for f in files:
            if f.endswith((".py", ".ts", ".js", ".json", ".sh", ".ps1")):
                fpath = os.path.join(root, f)
                rel = os.path.relpath(fpath, PROJECT)
                scan_file(fpath, rel)

critical = sum(1 for i in issues if i["severity"] == "critical")
warnings = sum(1 for i in issues if i["severity"] == "warning")

summary = f"安全扫描: {files_scanned} 文件 | 严重: {critical} / 警告: {warnings}"
if critical > 0:
    summary += " ⚠️ 发现严重安全隐患，需立即处理"

print(json.dumps({
    "ok": critical == 0,
    "summary": summary,
    "issues": issues[:30],
    "files_scanned": files_scanned,
}, ensure_ascii=False))
