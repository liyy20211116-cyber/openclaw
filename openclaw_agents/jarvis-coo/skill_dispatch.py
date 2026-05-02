"""
skill_dispatch.py — 贾维斯的技能：任务批量派发
读取 stdin 传入的 JSON 任务列表，依次调用各 agent 技能
"""
import json, sys, os, subprocess, time

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGENTS_DIR = os.path.join(PROJECT, "openclaw_agents")

PYTHON = sys.executable or "python"

agent_skill_map = {
    "hermione-tech": "hermione_check_services",
    "mcgonagall-product": "mcgonagall_acceptance_check",
    "luna-growth": "luna_content_stats",
    "fred-sales": "fred_sales_stats",
    "percy-finance": "percy_token_report",
    "snape-audit": "snape_security_scan",
    "dobby-customer": "dobby_ux_walkthrough",
    "neville-hr": "neville_hr_report",
}

def run_agent_skill(agent_id, skill_id=None):
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    skills_path = os.path.join(agent_dir, "skills.json")

    if not os.path.exists(skills_path):
        return {"agent": agent_id, "ok": False, "message": "无 skills.json"}

    skills = json.loads(open(skills_path, encoding="utf-8").read())

    if skill_id:
        target = next((s for s in skills if s["id"] == skill_id), None)
    else:
        target = next((s for s in skills if s.get("type") == "script"), None)

    if not target:
        return {"agent": agent_id, "ok": False, "message": "无匹配技能"}

    if target.get("type") != "script":
        return {"agent": agent_id, "ok": True, "message": f"LLM 技能 [{target['name']}] 需要在前端执行", "skill": target["name"]}

    script_path = os.path.join(agent_dir, target["script"])
    if not os.path.exists(script_path):
        return {"agent": agent_id, "ok": False, "message": f"脚本不存在: {target['script']}"}

    try:
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [PYTHON, script_path],
            cwd=agent_dir,
            capture_output=True, text=True, encoding="utf-8",
            timeout=target.get("timeout", 60),
            env=env,
        )
        output = result.stdout.strip()
        try:
            parsed = json.loads(output.split("\n")[-1])
            return {"agent": agent_id, "ok": parsed.get("ok", True), "skill": target["name"], "result": parsed.get("summary", output[:200])}
        except:
            return {"agent": agent_id, "ok": result.returncode == 0, "skill": target["name"], "result": output[:300]}
    except subprocess.TimeoutExpired:
        return {"agent": agent_id, "ok": False, "skill": target["name"], "message": f"超时 ({target.get('timeout', 60)}s)"}
    except Exception as e:
        return {"agent": agent_id, "ok": False, "skill": target["name"], "message": str(e)[:200]}


input_data = sys.argv[1] if len(sys.argv) > 1 else ""

if input_data:
    try:
        tasks = json.loads(input_data)
    except:
        tasks = [{"agent_id": a, "skill_id": s} for a, s in agent_skill_map.items()]
else:
    tasks = [{"agent_id": a, "skill_id": s} for a, s in agent_skill_map.items()]

results = []
for task in tasks:
    agent_id = task.get("agent_id", "")
    skill_id = task.get("skill_id", None)
    r = run_agent_skill(agent_id, skill_id)
    results.append(r)

ok_count = sum(1 for r in results if r.get("ok"))
fail_count = len(results) - ok_count

summary = f"派发完成: {ok_count} 成功 / {fail_count} 失败 (共 {len(results)} 个任务)"
print(json.dumps({"ok": fail_count == 0, "summary": summary, "results": results}, ensure_ascii=False))
