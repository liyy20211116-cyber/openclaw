"""贾维斯·COO — 全公司记忆审计
扫描所有Agent记忆，检查健康度、断层、敏感信息。
只有COO有权运行此脚本。
"""
import os, re, json
from datetime import datetime, timedelta

ROOT = r"D:\FY003"
AGENTS_DIR = os.path.join(ROOT, "openclaw_agents")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== COO Memory Audit ===\n")

SENSITIVE_PATTERNS = [
    (r'sk-[a-zA-Z0-9]{20,}', "OpenAI API Key"),
    (r'(?i)(password|passwd)\s*[=:"\']\s*\S{6,}', "Password"),
    (r'(?i)(app_?secret|client_?secret)\s*[=:"\']\s*\S{10,}', "App Secret"),
    (r'ghp_[a-zA-Z0-9]{36}', "GitHub Token"),
]

agents = [d for d in sorted(os.listdir(AGENTS_DIR))
          if os.path.isdir(os.path.join(AGENTS_DIR, d))]

audit_results = []
total_learnings = 0
total_sensitive = 0

for agent in agents:
    mem_dir = os.path.join(AGENTS_DIR, agent, "memory")
    result = {
        "agent": agent,
        "has_memory_dir": os.path.isdir(mem_dir),
        "files": {},
        "learnings_count": 0,
        "last_updated": None,
        "sensitive_findings": [],
        "health": "unknown",
    }

    if not result["has_memory_dir"]:
        result["health"] = "no_memory"
        audit_results.append(result)
        print(f"  [XX] {agent}: no memory directory")
        continue

    for fn in os.listdir(mem_dir):
        fp = os.path.join(mem_dir, fn)
        if os.path.isfile(fp):
            stat = os.stat(fp)
            result["files"][fn] = {
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
            }
            if stat.st_mtime > (result.get("_last_mtime") or 0):
                result["_last_mtime"] = stat.st_mtime
                result["last_updated"] = datetime.fromtimestamp(stat.st_mtime).isoformat()

    learnings_file = os.path.join(mem_dir, "learnings.md")
    if os.path.exists(learnings_file):
        content = open(learnings_file, "r", encoding="utf-8").read()
        result["learnings_count"] = content.count("\n---\n")
        total_learnings += result["learnings_count"]

        for pat, desc in SENSITIVE_PATTERNS:
            matches = re.findall(pat, content)
            if matches:
                result["sensitive_findings"].append({
                    "type": desc,
                    "count": len(matches)
                })
                total_sensitive += len(matches)

    # 健康评估
    if result["learnings_count"] > 0 and not result["sensitive_findings"]:
        last_ts = result.get("_last_mtime", 0)
        if datetime.now().timestamp() - last_ts < 3 * 86400:
            result["health"] = "healthy"
        else:
            result["health"] = "stale"
    elif result["sensitive_findings"]:
        result["health"] = "security_risk"
    elif result["learnings_count"] == 0:
        result["health"] = "empty"
    else:
        result["health"] = "ok"

    result.pop("_last_mtime", None)
    audit_results.append(result)

    health_icon = {"healthy": "[OK]", "stale": "[--]", "security_risk": "[!!]",
                   "empty": "[  ]", "no_memory": "[XX]", "ok": "[OK]"}.get(result["health"], "[??]")
    print(f"  {health_icon} {agent}: {result['learnings_count']} learnings, "
          f"health={result['health']}, files={len(result['files'])}")

# 全局报告
report = {
    "audit_date": datetime.now().isoformat(),
    "auditor": "jarvis-coo",
    "summary": {
        "total_agents": len(agents),
        "healthy": sum(1 for r in audit_results if r["health"] == "healthy"),
        "stale": sum(1 for r in audit_results if r["health"] == "stale"),
        "empty": sum(1 for r in audit_results if r["health"] == "empty"),
        "no_memory": sum(1 for r in audit_results if r["health"] == "no_memory"),
        "security_risk": sum(1 for r in audit_results if r["health"] == "security_risk"),
        "total_learnings": total_learnings,
        "total_sensitive_findings": total_sensitive,
    },
    "agents": audit_results,
    "recommendations": [],
}

if report["summary"]["stale"] > 0:
    stale_agents = [r["agent"] for r in audit_results if r["health"] == "stale"]
    report["recommendations"].append(f"Stale memory ({', '.join(stale_agents)}): run agent_learn.py to refresh")
if report["summary"]["security_risk"] > 0:
    report["recommendations"].append("URGENT: Sensitive info found in memory - run redaction immediately")
if report["summary"]["empty"] > 0:
    empty_agents = [r["agent"] for r in audit_results if r["health"] == "empty"]
    report["recommendations"].append(f"Empty memory ({', '.join(empty_agents)}): agents need to start learning")

out_file = os.path.join(OUTPUT, f"coo_memory_audit_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'='*40}")
print(f"Agents: {report['summary']['total_agents']}")
print(f"  Healthy: {report['summary']['healthy']}")
print(f"  Stale: {report['summary']['stale']}")
print(f"  Empty: {report['summary']['empty']}")
print(f"  No Memory: {report['summary']['no_memory']}")
print(f"  Security Risk: {report['summary']['security_risk']}")
print(f"Total Learnings: {total_learnings}")
if total_sensitive:
    print(f"  ALERT: {total_sensitive} sensitive items found!")
print(f"\nReport: {out_file}")
if report["recommendations"]:
    print(f"\nRecommendations:")
    for r in report["recommendations"]:
        print(f"  - {r}")
