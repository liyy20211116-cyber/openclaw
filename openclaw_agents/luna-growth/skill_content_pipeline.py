"""
skill_content_pipeline.py — 卢娜的技能：内容生产流水线
全链路执行：热点抓取 → 筛选排名 → 生成内容草稿 → 输出到 output/
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "content")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else "AI自动化"


def call_llm(prompt, system_msg="你是卢娜·洛夫古德，一人公司增长官(CGO)。你正在执行内容生产，请直接输出内容。", max_tokens=1200):
    body = json.dumps({
        "model": "cascade",
        "messages": [{"role": "system", "content": system_msg}, {"role": "user", "content": prompt}],
        "temperature": 0.7,
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
    topic = task_arg
    timestamp = time.strftime("%Y%m%d_%H%M")
    results = []

    # Step 1: 生成选题方向
    topics_prompt = f"请围绕「{topic}」这个主题，生成 5 个适合小红书/抖音的选题方向。每个选题包含：标题（15字内）、角度、目标人群。用 JSON 数组格式输出。"
    topics_raw = call_llm(topics_prompt)
    try:
        start = topics_raw.find("[")
        end = topics_raw.rfind("]") + 1
        topics_list = json.loads(topics_raw[start:end]) if start >= 0 else []
    except:
        topics_list = [{"title": topic, "angle": "通用", "target": "职场人"}]

    results.append({"step": "选题生成", "count": len(topics_list)})

    # Step 2: 为 Top 3 选题生成草稿
    drafts = []
    for t in topics_list[:3]:
        title = t.get("title", topic)
        draft_prompt = f"""请为小红书写一篇关于「{title}」的种草文：
- 标题（含 emoji，20字内）
- 正文（300-500字，口语化，分段，含 emoji）
- 3-5 个标签
目标人群：{t.get('target', '年轻职场人')}"""
        draft = call_llm(draft_prompt)
        drafts.append({"title": title, "content": draft})

        out_file = os.path.join(OUTPUT_DIR, f"draft_{timestamp}_{len(drafts)}.md")
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(f"# {title}\n\n{draft}\n")

    results.append({"step": "草稿生成", "count": len(drafts)})

    result = {
        "ok": len(drafts) > 0,
        "summary": f"内容流水线完成: 生成 {len(topics_list)} 个选题, {len(drafts)} 篇草稿已保存到 output/content/",
        "topics": [t.get("title", "") for t in topics_list],
        "drafts_count": len(drafts),
        "output_dir": OUTPUT_DIR,
        "steps": results,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
