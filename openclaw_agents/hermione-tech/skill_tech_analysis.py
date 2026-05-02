"""
skill_tech_analysis.py — 赫敏的技能：技术缺口分析与方案报告
读取项目代码结构，调用 LLM 分析技术缺口并输出结构化报告
"""
import json, os, sys, urllib.request, urllib.error, glob, re

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "..", "req-review-agent")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else "技术缺口盘点"


def scan_project():
    """扫描项目目录，提取代码结构与关键信息"""
    info = {"files": [], "total_lines": 0, "scripts": [], "configs": [], "issues": []}

    if not os.path.isdir(TARGET):
        info["issues"].append("req-review-agent 目录不存在")
        return info

    for fname in sorted(os.listdir(TARGET)):
        fpath = os.path.join(TARGET, fname)
        if not os.path.isfile(fpath):
            continue
        ext = os.path.splitext(fname)[1]
        size = os.path.getsize(fpath)

        if ext == ".py":
            try:
                code = open(fpath, encoding="utf-8").read()
                lines = len(code.split("\n"))
                info["total_lines"] += lines

                funcs = re.findall(r"^(?:def|async def)\s+(\w+)", code, re.M)
                classes = re.findall(r"^class\s+(\w+)", code, re.M)
                imports = re.findall(r"^(?:import|from)\s+(\S+)", code, re.M)
                has_main = "if __name__" in code
                has_try = "try:" in code
                bare_except = len(re.findall(r"^\s*except\s*:", code, re.M))
                no_timeout = len(re.findall(r"requests\.\w+\([^)]*\)(?!.*timeout)", code))

                info["scripts"].append({
                    "name": fname,
                    "lines": lines,
                    "functions": funcs[:10],
                    "classes": classes[:5],
                    "key_imports": list(set(imports))[:8],
                    "has_main": has_main,
                    "has_error_handling": has_try,
                    "bare_except_count": bare_except,
                    "missing_timeout_count": no_timeout,
                })
            except Exception as e:
                info["issues"].append(f"{fname}: 读取失败 - {e}")

        elif ext == ".json":
            try:
                data = json.loads(open(fpath, encoding="utf-8").read())
                keys = list(data.keys()) if isinstance(data, dict) else f"[array:{len(data)}]"
                info["configs"].append({"name": fname, "keys": keys})
            except:
                info["configs"].append({"name": fname, "keys": "解析失败"})

        info["files"].append({"name": fname, "ext": ext, "size": size})

    tpl_dir = os.path.join(TARGET, "templates")
    if os.path.isdir(tpl_dir):
        info["templates"] = os.listdir(tpl_dir)
    else:
        info["templates"] = []
        info["issues"].append("templates/ 目录不存在")

    mem_dir = os.path.join(TARGET, "memory")
    if os.path.isdir(mem_dir):
        info["memory_files"] = os.listdir(mem_dir)
    else:
        info["memory_files"] = []

    return info


def call_llm(prompt, max_tokens=1500):
    """调用本地 LLM API"""
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是赫敏·格兰杰，一人公司的技术总监(CTO)。你正在做技术分析，请直接输出结论，不要寒暄。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }).encode("utf-8")

    req = urllib.request.Request(
        BACKEND_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def main():
    project_info = scan_project()

    script_summary = "\n".join([
        f"- {s['name']} ({s['lines']}行): 函数={s['functions']}, "
        f"错误处理={'有' if s['has_error_handling'] else '无'}, "
        f"裸except={s['bare_except_count']}, 缺timeout={s['missing_timeout_count']}"
        for s in project_info["scripts"]
    ])

    config_summary = "\n".join([
        f"- {c['name']}: {c['keys']}" for c in project_info["configs"]
    ])

    known_issues = "\n".join([f"- {i}" for i in project_info["issues"]]) or "无已知问题"

    prompt = f"""## 任务: {task_arg}

## 项目概况: ONES 需求审核自动化 (req-review-agent)
- 文件总数: {len(project_info['files'])}
- Python 脚本: {len(project_info['scripts'])} 个, 共 {project_info['total_lines']} 行
- 配置文件: {len(project_info['configs'])} 个
- 卡片模板: {len(project_info.get('templates', []))} 个
- 内存文件: {len(project_info.get('memory_files', []))} 个

## 脚本明细
{script_summary}

## 配置文件
{config_summary}

## 已发现问题
{known_issues}

## 请你完成以下分析

1. **缺口识别**: 这个项目要实现"飞书表格扫描→AI审核→ONES建单→飞书卡片回写"的完整链路，请分析当前代码还有哪些缺口（功能缺失、异常处理不足、链路断点等）

2. **风险评估**: 按严重程度列出 Top 5 风险点

3. **闭环建议**: 针对每个缺口给出具体的修复方向和优先级（P0/P1/P2）

4. **预估工作量**: 每个修复项的大致工作量（小时）

请用结构化格式输出，不用 markdown，直接用中文描述。"""

    analysis = call_llm(prompt, max_tokens=1500)

    gap_count = analysis.count("P0") + analysis.count("P1") + analysis.count("P2")
    p0_count = analysis.count("P0")

    result = {
        "ok": True,
        "summary": f"技术分析完成: 扫描 {len(project_info['scripts'])} 个脚本/{project_info['total_lines']} 行代码, 识别 {gap_count} 个待修复项 (P0: {p0_count})",
        "analysis": analysis,
        "project_stats": {
            "total_files": len(project_info["files"]),
            "total_scripts": len(project_info["scripts"]),
            "total_lines": project_info["total_lines"],
            "config_count": len(project_info["configs"]),
            "template_count": len(project_info.get("templates", [])),
        },
        "raw_issues": project_info["issues"],
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
