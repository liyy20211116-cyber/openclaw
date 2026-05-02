"""
skill_run_test.py — 赫敏的技能：运行测试
执行项目测试脚本，验证核心流程，输出测试报告
"""
import json, os, sys, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
JARVIS_DIR = os.path.join(PROJECT_ROOT, "jarvis-one-company-os")

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def run_cmd(cmd, cwd, timeout=60):
    try:
        start = time.time()
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, shell=True)
        elapsed = round(time.time() - start, 1)
        return {
            "cmd": cmd if isinstance(cmd, str) else " ".join(cmd),
            "exit_code": proc.returncode,
            "stdout": proc.stdout[-800:] if proc.stdout else "",
            "stderr": proc.stderr[-400:] if proc.stderr else "",
            "elapsed_s": elapsed,
            "ok": proc.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"cmd": cmd, "exit_code": -1, "stdout": "", "stderr": "超时", "elapsed_s": timeout, "ok": False}
    except Exception as e:
        return {"cmd": cmd, "exit_code": -1, "stdout": "", "stderr": str(e), "elapsed_s": 0, "ok": False}


def main():
    results = []

    tsc_result = run_cmd("npx tsc --noEmit", JARVIS_DIR, timeout=90)
    tsc_result["label"] = "TypeScript 类型检查"
    results.append(tsc_result)

    build_result = run_cmd("npx vite build", JARVIS_DIR, timeout=60)
    build_result["label"] = "Vite 前端构建"
    results.append(build_result)

    for agent_dir in sorted(os.listdir(os.path.join(PROJECT_ROOT, "openclaw_agents"))):
        skills_path = os.path.join(PROJECT_ROOT, "openclaw_agents", agent_dir, "skills.json")
        if os.path.isfile(skills_path):
            try:
                skills = json.loads(open(skills_path, encoding="utf-8").read())
                if not isinstance(skills, list):
                    results.append({"label": f"{agent_dir}/skills.json 格式校验", "ok": False, "stderr": "不是数组"})
                else:
                    for s in skills:
                        if s.get("type") == "script":
                            script_path = os.path.join(PROJECT_ROOT, "openclaw_agents", agent_dir, s["script"])
                            if not os.path.isfile(script_path):
                                results.append({"label": f"脚本存在性: {agent_dir}/{s['script']}", "ok": False, "stderr": "文件不存在"})
                    results.append({"label": f"{agent_dir}/skills.json 格式校验", "ok": True, "stderr": ""})
            except Exception as e:
                results.append({"label": f"{agent_dir}/skills.json 格式校验", "ok": False, "stderr": str(e)})

    ok_count = sum(1 for r in results if r.get("ok"))
    fail_count = len(results) - ok_count

    result = {
        "ok": fail_count == 0,
        "summary": f"测试完成: {ok_count} 通过 / {fail_count} 失败 (共 {len(results)} 项)",
        "results": [{"label": r.get("label", r.get("cmd", "")), "ok": r["ok"], "error": r.get("stderr", "")[:200]} for r in results],
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
