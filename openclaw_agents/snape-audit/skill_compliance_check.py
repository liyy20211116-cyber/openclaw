"""
skill_compliance_check.py — 斯内普的技能：合规检查
检查数据隐私、敏感信息保护、API密钥管理、日志规范等合规项
"""
import json, os, sys, time, re

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
AGENTS_DIR = os.path.join(PROJECT_ROOT, "openclaw_agents")
CONFIG_DIR = os.path.join(PROJECT_ROOT, "config")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "audit")

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def check_env_files():
    """检查环境变量和配置文件中的敏感信息"""
    findings = []
    patterns = [
        (r'(app_secret|password|secret_key|api_key|token)\s*[:=]\s*["\']?[a-zA-Z0-9\-_.]{20,}', "硬编码凭据"),
        (r'sk-[a-zA-Z0-9]{20,}', "OpenAI API Key 明文"),
        (r'xoxb-[a-zA-Z0-9\-]+', "Slack Token 明文"),
    ]

    for root, dirs, files in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "__pycache__", "dist-electron", "release", ".next"}]
        for f in files:
            if not f.endswith((".env", ".env.local", ".env.production")):
                continue
            fp = os.path.join(root, f)
            try:
                content = open(fp, encoding="utf-8").read()
                for pat, desc in patterns:
                    if re.search(pat, content, re.I):
                        findings.append({"check": "env_file", "file": os.path.relpath(fp, PROJECT_ROOT),
                                         "severity": "critical", "detail": f"{desc} 在 {f}"})
            except Exception:
                pass
    return findings


def check_gitignore():
    """检查 .gitignore 是否排除了敏感文件"""
    findings = []
    gitignore = os.path.join(PROJECT_ROOT, ".gitignore")
    if not os.path.exists(gitignore):
        findings.append({"check": "gitignore", "severity": "warning", "detail": "项目缺少 .gitignore"})
        return findings

    content = open(gitignore, encoding="utf-8").read()
    required_patterns = [".env", "*.key", "*.pem", "credentials", "dev.db"]
    for pat in required_patterns:
        if pat not in content:
            findings.append({"check": "gitignore", "severity": "warning",
                             "detail": f".gitignore 缺少 {pat} 排除规则"})
    return findings


def check_agent_data_handling():
    """检查 Agent 脚本中的数据处理合规性"""
    findings = []
    for agent_id in os.listdir(AGENTS_DIR):
        agent_dir = os.path.join(AGENTS_DIR, agent_id)
        if not os.path.isdir(agent_dir):
            continue
        for f in os.listdir(agent_dir):
            if not f.endswith(".py"):
                continue
            fp = os.path.join(agent_dir, f)
            try:
                code = open(fp, encoding="utf-8").read()
                if "os.system(" in code:
                    findings.append({"check": "code_safety", "file": f"{agent_id}/{f}",
                                     "severity": "warning", "detail": "使用 os.system()，建议用 subprocess"})
                if re.search(r'open\(.+["\']w["\']', code) and "output" not in f.lower():
                    pass  # writing to output is expected
                if "import pickle" in code:
                    findings.append({"check": "code_safety", "file": f"{agent_id}/{f}",
                                     "severity": "warning", "detail": "使用 pickle 反序列化（安全风险）"})
            except Exception:
                pass
    return findings


def check_api_timeout():
    """检查所有 HTTP 调用是否设置了 timeout"""
    findings = []
    for agent_id in os.listdir(AGENTS_DIR):
        agent_dir = os.path.join(AGENTS_DIR, agent_id)
        if not os.path.isdir(agent_dir):
            continue
        for f in os.listdir(agent_dir):
            if not f.endswith(".py"):
                continue
            fp = os.path.join(agent_dir, f)
            try:
                code = open(fp, encoding="utf-8").read()
                if "urlopen(" in code and "timeout" not in code:
                    findings.append({"check": "timeout", "file": f"{agent_id}/{f}",
                                     "severity": "warning", "detail": "HTTP 调用缺少 timeout 参数"})
                if "requests.get(" in code and "timeout" not in code:
                    findings.append({"check": "timeout", "file": f"{agent_id}/{f}",
                                     "severity": "warning", "detail": "requests 调用缺少 timeout"})
            except Exception:
                pass
    return findings


def check_output_permissions():
    """检查输出目录权限和敏感数据"""
    findings = []
    output_dir = os.path.join(PROJECT_ROOT, "output")
    if not os.path.isdir(output_dir):
        return findings

    for root, dirs, files in os.walk(output_dir):
        for f in files:
            if f.endswith((".json",)):
                fp = os.path.join(root, f)
                try:
                    content = open(fp, encoding="utf-8").read()
                    if re.search(r'\b\d{11}\b', content):
                        findings.append({"check": "pii", "file": os.path.relpath(fp, PROJECT_ROOT),
                                         "severity": "info", "detail": "输出文件可能包含手机号"})
                    if re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', content):
                        findings.append({"check": "pii", "file": os.path.relpath(fp, PROJECT_ROOT),
                                         "severity": "info", "detail": "输出文件可能包含邮箱地址"})
                except Exception:
                    pass
    return findings


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    all_findings = []
    all_findings.extend(check_env_files())
    all_findings.extend(check_gitignore())
    all_findings.extend(check_agent_data_handling())
    all_findings.extend(check_api_timeout())
    all_findings.extend(check_output_permissions())

    critical = sum(1 for f in all_findings if f["severity"] == "critical")
    warnings = sum(1 for f in all_findings if f["severity"] == "warning")
    info = sum(1 for f in all_findings if f["severity"] == "info")

    compliance_score = max(0, 100 - critical * 20 - warnings * 5 - info * 1)
    status = "合规" if critical == 0 and warnings <= 2 else ("需整改" if critical == 0 else "严重不合规")

    report = {
        "audit_date": timestamp,
        "compliance_score": compliance_score,
        "status": status,
        "findings_count": {"critical": critical, "warning": warnings, "info": info},
        "findings": all_findings[:50],
        "checks_performed": ["环境变量泄露", "gitignore规范", "代码安全", "API超时", "输出数据隐私"],
    }

    out_file = os.path.join(OUTPUT_DIR, f"compliance_check_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = (f"合规检查: {status} ({compliance_score}分) | 严重{critical} 警告{warnings} 信息{info} | "
               f"覆盖5项检查")
    print(json.dumps({"ok": critical == 0, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
