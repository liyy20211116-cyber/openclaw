"""
skill_acceptance_check.py — 麦格教授的技能：验收检查
对照需求文档检查项目实际完成情况，输出验收报告
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1500):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是麦格教授，一人公司首席产品官(CPO)。你正在做产品验收检查，请严谨务实地评估。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def collect_project_state():
    """收集项目状态"""
    state = {"pages": [], "api_endpoints": [], "db_tables": [], "output_files": []}

    src_dir = os.path.join(PROJECT_ROOT, "jarvis-one-company-os", "src", "pages")
    if os.path.isdir(src_dir):
        state["pages"] = [f for f in os.listdir(src_dir) if f.endswith(".tsx")]

    schema_path = os.path.join(PROJECT_ROOT, "jarvis-one-company-os", "prisma", "schema.prisma")
    if os.path.isfile(schema_path):
        content = open(schema_path, encoding="utf-8").read()
        import re
        state["db_tables"] = re.findall(r'model\s+(\w+)', content)

    output_dir = os.path.join(PROJECT_ROOT, "output")
    if os.path.isdir(output_dir):
        for d in os.listdir(output_dir):
            dp = os.path.join(output_dir, d)
            if os.path.isdir(dp):
                count = len([f for f in os.listdir(dp) if not f.startswith(".")])
                state["output_files"].append(f"{d}/: {count} 个文件")

    agents_dir = os.path.join(PROJECT_ROOT, "openclaw_agents")
    agent_count = 0
    skill_count = 0
    if os.path.isdir(agents_dir):
        for agent in os.listdir(agents_dir):
            sp = os.path.join(agents_dir, agent, "skills.json")
            if os.path.isfile(sp):
                agent_count += 1
                try:
                    skills = json.loads(open(sp, encoding="utf-8").read())
                    skill_count += len(skills)
                except:
                    pass
    state["agent_count"] = agent_count
    state["skill_count"] = skill_count
    return state


def main():
    state = collect_project_state()

    prompt = f"""## 产品验收检查

### 当前项目状态
- 前端页面: {len(state['pages'])} 个 ({', '.join(state['pages'][:10])})
- 数据库表: {len(state['db_tables'])} 个 ({', '.join(state['db_tables'][:10])})
- Agent 团队: {state['agent_count']} 个角色, 共 {state['skill_count']} 个技能
- 产出目录: {', '.join(state['output_files'][:10]) or '暂无'}

### 请完成验收评估
1. **功能完整度评分**（1-10）：基于一人公司 OS 的核心功能清单评估
2. **缺失功能清单**：列出还没有实现但应该有的功能
3. **质量问题**：列出已实现功能中的质量缺陷
4. **发布就绪度**：判断当前版本是否可以交付使用
5. **优先改进项 Top 5**：按影响力排序"""

    analysis = call_llm(prompt)

    result = {
        "ok": True,
        "summary": f"验收检查完成: {len(state['pages'])} 个页面, {len(state['db_tables'])} 张表, {state['agent_count']} 个角色, {state['skill_count']} 个技能",
        "analysis": analysis,
        "state_summary": state,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
