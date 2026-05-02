"""
skill_satisfaction_survey.py — 多比的技能：满意度调查生成器
生成结构化的客户满意度调查问卷和 NPS 跟踪模板
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "surveys")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1200):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是多比，一人公司 CCO。你在设计客户满意度调查，请输出专业但友好的问卷内容。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    product = task_arg or "AI 一人公司操作系统"
    timestamp = time.strftime("%Y%m%d_%H%M")

    prompt = f"""为「{product}」设计一份客户满意度调查问卷。

要求：
1. NPS 评分题（0-10 推荐度）
2. 5 个维度评分题（功能完整度/易用性/响应速度/性价比/技术支持，1-5分）
3. 3 个开放式问题（最满意的功能/最需要改进的/希望新增的功能）
4. 1 个选择题（使用频率）
5. 适合微信/飞书消息发送的简洁格式

输出为可直接使用的问卷文案。"""

    content = call_llm(prompt)
    out_file = os.path.join(OUTPUT_DIR, f"survey_{timestamp}.md")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"# 客户满意度调查 — {product}\n\n{content}\n")

    result = {
        "ok": True,
        "summary": f"满意度调查问卷已生成: {out_file}",
        "output_file": out_file,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
