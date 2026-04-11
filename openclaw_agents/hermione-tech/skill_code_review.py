"""
skill_code_review.py — 赫敏的技能：代码质量快速审查
扫描 req-review-agent 目录下的 Python 文件，检查常见问题
"""
import json, os, re, ast, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "..", "req-review-agent")

issues = []
file_stats = []

for fname in os.listdir(TARGET):
    if not fname.endswith(".py"):
        continue
    fpath = os.path.join(TARGET, fname)
    try:
        code = open(fpath, encoding="utf-8").read()
    except:
        continue

    lines = code.split("\n")
    file_stats.append({"file": fname, "lines": len(lines)})

    # bare except
    for i, line in enumerate(lines, 1):
        if re.match(r"\s*except\s*:", line):
            issues.append({"file": fname, "line": i, "severity": "warning", "message": "裸 except（应指定异常类型）"})

    # hardcoded secrets
    for i, line in enumerate(lines, 1):
        if re.search(r"(password|secret|token)\s*=\s*['\"][^'\"]{8,}", line, re.I):
            if "os.environ" not in line and "getenv" not in line:
                issues.append({"file": fname, "line": i, "severity": "critical", "message": "疑似硬编码密钥"})

    # no timeout on requests
    for i, line in enumerate(lines, 1):
        if "requests." in line and "timeout" not in line and ("get(" in line or "post(" in line or "put(" in line):
            issues.append({"file": fname, "line": i, "severity": "warning", "message": "HTTP 请求缺少 timeout 参数"})

    # syntax check
    try:
        ast.parse(code)
    except SyntaxError as e:
        issues.append({"file": fname, "line": e.lineno or 0, "severity": "critical", "message": f"语法错误: {e.msg}"})

critical = sum(1 for i in issues if i["severity"] == "critical")
warnings = sum(1 for i in issues if i["severity"] == "warning")
total_files = len(file_stats)
total_lines = sum(f["lines"] for f in file_stats)

summary = f"审查 {total_files} 个文件 ({total_lines} 行) | 严重: {critical} / 警告: {warnings}"
print(json.dumps({
    "ok": critical == 0,
    "summary": summary,
    "issues": issues[:20],
    "file_stats": file_stats,
}, ensure_ascii=False))
