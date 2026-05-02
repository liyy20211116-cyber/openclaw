"""
skill_feedback_collector.py — 多比的技能：客户反馈采集器
扫描 memory 目录和输出文件，汇总客户反馈数据并生成改进建议
"""
import json, os, sys, urllib.request, re

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=1200):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是多比，一人公司客户成功官(CCO)。你在分析客户反馈，请输出可执行的改进建议。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def collect_feedback_sources():
    sources = []

    agents_dir = os.path.join(PROJECT_ROOT, "openclaw_agents")
    if os.path.isdir(agents_dir):
        for agent in os.listdir(agents_dir):
            mem_dir = os.path.join(agents_dir, agent, "memory")
            if not os.path.isdir(mem_dir):
                continue
            for fname in os.listdir(mem_dir):
                if not fname.endswith(".md"):
                    continue
                fpath = os.path.join(mem_dir, fname)
                try:
                    content = open(fpath, encoding="utf-8").read()
                    feedback_lines = [line for line in content.split("\n") if any(kw in line for kw in ["客户", "反馈", "用户", "问题", "改进", "建议", "投诉"])]
                    if feedback_lines:
                        sources.append({"source": f"{agent}/memory/{fname}", "excerpts": feedback_lines[:5]})
                except:
                    pass

    feedback_dir = os.path.join(PROJECT_ROOT, "output", "feedback")
    if os.path.isdir(feedback_dir):
        for fname in sorted(os.listdir(feedback_dir)):
            fpath = os.path.join(feedback_dir, fname)
            if os.path.isfile(fpath):
                try:
                    content = open(fpath, encoding="utf-8", errors="ignore").read()[:500]
                    sources.append({"source": f"output/feedback/{fname}", "excerpts": [content[:200]]})
                except:
                    pass

    return sources


def main():
    sources = collect_feedback_sources()
    source_text = "\n\n".join([
        f"### {s['source']}\n" + "\n".join([f"- {e[:100]}" for e in s["excerpts"]])
        for s in sources[:10]
    ]) or "暂无客户反馈记录"

    prompt = f"""## 客户反馈汇总分析

### 采集到的反馈来源 ({len(sources)} 个)
{source_text}

### 请完成以下分析
1. **反馈分类**：按「功能需求 / 体验问题 / Bug / 性能 / 其他」分类
2. **频率排名**：哪些问题被提及最多
3. **紧急程度**：按影响面排出 Top 5 待解决问题
4. **改进建议**：每个问题对应的解决方案和负责部门
5. **客户满意度预估**：基于反馈推断当前满意度（1-10）"""

    analysis = call_llm(prompt)
    result = {
        "ok": True,
        "summary": f"客户反馈采集完成: 扫描 {len(sources)} 个数据源, 输出分析和改进建议",
        "analysis": analysis,
        "source_count": len(sources),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
