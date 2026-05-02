"""
skill_req_analysis.py — 麦格教授的技能：需求分析
分析需求记录，输出需求清洗和优先级建议
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
            {"role": "system", "content": "你是麦格教授，一人公司 CPO。你在做需求分析，请用结构化方式输出优先级建议。"},
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


def load_tasks():
    """从快照加载现有任务列表"""
    snapshot_dir = os.path.join(PROJECT_ROOT, "jarvis-one-company-os")
    snapshot_candidates = [
        os.path.join(snapshot_dir, "data", "snapshot.json"),
        os.path.join(PROJECT_ROOT, "output", "app-snapshot.json"),
    ]
    for sp in snapshot_candidates:
        if os.path.isfile(sp):
            try:
                data = json.loads(open(sp, encoding="utf-8").read())
                return data.get("tasks", [])
            except:
                pass
    return []


def main():
    tasks = load_tasks()
    task_summary = "\n".join([
        f"- [{t.get('status', '?')}] {t.get('title', '无标题')} (负责: {t.get('owner', '?')}, 优先级: {t.get('priority', '?')})"
        for t in tasks[:20]
    ]) or "暂无任务记录"

    extra_context = task_arg or "一人公司当前主线目标：验证商业模式、获取首批客户、产出增长内容"

    prompt = f"""## 需求分析

### 背景
{extra_context}

### 现有任务列表
{task_summary}

### 请完成需求分析
1. **需求分类**：将现有任务按「核心功能 / 增长引擎 / 运营保障 / 技术基建」分类
2. **优先级矩阵**：用「影响力 × 紧迫性」二维矩阵对每个需求评分（1-5）
3. **缺失需求**：基于一人公司业务模式，指出还缺少哪些关键需求
4. **建议执行顺序**：给出接下来 7 天的执行排序建议
5. **资源预估**：每个需求的 Token 预算和预计耗时"""

    analysis = call_llm(prompt)

    result = {
        "ok": True,
        "summary": f"需求分析完成: 分析 {len(tasks)} 个现有任务, 输出优先级矩阵和执行建议",
        "analysis": analysis,
        "task_count": len(tasks),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
