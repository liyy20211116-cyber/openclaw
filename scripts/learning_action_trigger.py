"""贾维斯·自我学习系统 — 学习→行动触发器
扫描记忆中的问题模式，自动生成可执行的修复建议。
核心理念：学到的东西必须转化为行动，否则等于没学。
"""
import os, re, json
from datetime import datetime

ROOT = r"D:\FY003"
JARVIS_MEM = os.path.join(ROOT, "openclaw_agents", "jarvis-coo", "memory")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 贾维斯·学习→行动触发器 ===\n")

PROBLEM_ACTION_MAP = [
    {
        "pattern": r"Token.*过期|token.*expired|Token.*失效",
        "problem": "ONES Token 过期",
        "check_cmd": "python -u D:\\FY003\\openclaw_agents\\req-review-agent\\ones_token_refresh.py",
        "action": "自动刷新 Token 或提醒 CEO 手动登录",
        "auto_fixable": True,
        "script": os.path.join(ROOT, "openclaw_agents", "req-review-agent", "ones_token_refresh.py")
    },
    {
        "pattern": r"密[钥码].*硬编码|hardcoded.*password|密码.*明文",
        "problem": "敏感信息硬编码",
        "check_cmd": "python -u D:\\FY003\\scripts\\audit_security_scan.py",
        "action": "运行安全扫描并修复",
        "auto_fixable": False,
        "script": os.path.join(ROOT, "scripts", "audit_security_scan.py")
    },
    {
        "pattern": r"WebSocket.*断[连开]|DNS.*失败|502|连接.*超时",
        "problem": "网络连接不稳定",
        "check_cmd": "python -c \"import requests; r=requests.get('https://open.feishu.cn', timeout=10); print(r.status_code)\"",
        "action": "检查网络连通性，必要时重启 Gateway",
        "auto_fixable": True,
        "script": None
    },
    {
        "pattern": r"环境.*缺[失少]|工具.*不可用|Playwright.*未安装",
        "problem": "执行环境缺失",
        "check_cmd": "python -u D:\\FY003\\openclaw_agents\\jarvis-coo\\skill_self_check.py",
        "action": "运行自检并安装缺失依赖",
        "auto_fixable": True,
        "script": os.path.join(ROOT, "openclaw_agents", "jarvis-coo", "skill_self_check.py")
    },
    {
        "pattern": r"card.*handler.*未运行|卡片.*服务.*停",
        "problem": "飞书卡片回调服务未运行",
        "check_cmd": "python -u D:\\FY003\\openclaw_agents\\req-review-agent\\card_action_handler.py",
        "action": "重启卡片回调服务",
        "auto_fixable": True,
        "script": os.path.join(ROOT, "openclaw_agents", "req-review-agent", "card_action_handler.py")
    },
    {
        "pattern": r"记忆.*重复|learnings.*堆积|同.*问题.*记录",
        "problem": "记忆系统冗余",
        "check_cmd": "python -u D:\\FY003\\scripts\\memory_consolidate.py",
        "action": "运行记忆整理压缩",
        "auto_fixable": True,
        "script": os.path.join(ROOT, "scripts", "memory_consolidate.py")
    },
]

# --- 1. 扫描所有记忆文件 ---
memory_texts = []
for fn in ("learnings.md", "decisions.md", "ceo_preferences.md"):
    fp = os.path.join(JARVIS_MEM, fn)
    if os.path.exists(fp):
        memory_texts.append(open(fp, "r", encoding="utf-8").read())

all_memory = "\n".join(memory_texts)

# --- 2. 模式匹配 ---
triggered_actions = []
for rule in PROBLEM_ACTION_MAP:
    matches = re.findall(rule["pattern"], all_memory, re.IGNORECASE)
    if matches:
        frequency = len(matches)
        urgency = "HIGH" if frequency >= 5 else ("MEDIUM" if frequency >= 2 else "LOW")
        triggered_actions.append({
            "problem": rule["problem"],
            "frequency": frequency,
            "urgency": urgency,
            "action": rule["action"],
            "auto_fixable": rule["auto_fixable"],
            "check_cmd": rule["check_cmd"],
            "script": rule["script"],
        })
        print(f"[{urgency}] {rule['problem']} — 提及 {frequency} 次 → {rule['action']}")

if not triggered_actions:
    print("未发现需要触发行动的问题模式")

# --- 3. 排序：高频+可自动修复的优先 ---
triggered_actions.sort(key=lambda x: (-x["frequency"], not x["auto_fixable"]))

# --- 4. 生成行动计划 ---
action_plan = {
    "generated_at": datetime.now().isoformat(),
    "total_triggers": len(triggered_actions),
    "auto_fixable": sum(1 for a in triggered_actions if a["auto_fixable"]),
    "needs_human": sum(1 for a in triggered_actions if not a["auto_fixable"]),
    "actions": triggered_actions,
}

out_file = os.path.join(OUTPUT, f"action_triggers_{datetime.now():%Y%m%d}.json")
json.dump(action_plan, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'='*40}")
print(f"触发的行动: {len(triggered_actions)} 项")
print(f"  可自动修复: {action_plan['auto_fixable']} 项")
print(f"  需人工介入: {action_plan['needs_human']} 项")
print(f"行动计划: {out_file}")

# --- 5. 自动执行可修复项（仅模拟，实际执行需要 --execute 参数） ---
import sys
if "--execute" in sys.argv:
    import subprocess
    print(f"\n=== 开始自动执行 ===")
    for act in triggered_actions:
        if act["auto_fixable"] and act["script"] and os.path.exists(act["script"]):
            print(f"\n执行: {act['problem']} → {act['script']}")
            try:
                r = subprocess.run(
                    [sys.executable, "-u", act["script"]],
                    capture_output=True, text=True, timeout=120, cwd=ROOT
                )
                act["execution_result"] = "success" if r.returncode == 0 else "failed"
                act["execution_output"] = r.stdout[-300:] if r.stdout else r.stderr[-300:]
                print(f"  结果: {act['execution_result']}")
            except Exception as e:
                act["execution_result"] = "error"
                act["execution_output"] = str(e)
                print(f"  错误: {e}")

    json.dump(action_plan, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n执行结果已更新到: {out_file}")
else:
    print(f"\n提示: 加 --execute 参数可自动执行可修复项")
