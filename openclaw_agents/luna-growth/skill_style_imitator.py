"""
skill_style_imitator.py — 卢娜的技能：风格仿写
分析参考内容的写作风格（句式/语气/结构/用词），然后用相同风格写新主题
"""
import json, sys
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=2000):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司增长官。你精通文案创作和风格模仿，能精准还原任何写作风格并应用到新主题上。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def main():
    raw_input = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        params = json.loads(raw_input)
        reference = params.get("reference", "")
        new_topic = params.get("topic", "")
        platform = params.get("platform", "通用")
        count = params.get("count", 3)
    except:
        reference = raw_input
        new_topic = ""
        platform = "通用"
        count = 3

    if not reference:
        print(json.dumps({"ok": False, "error": "请提供参考内容。参数: {\"reference\": \"参考文案...\", \"topic\": \"新主题\", \"platform\": \"小红书\", \"count\": 3}"}, ensure_ascii=False))
        return

    now = datetime.now().strftime("%Y%m%d_%H%M")

    style_analysis = call_llm(f"""请分析以下内容的写作风格特征：

{reference[:2000]}

请从以下维度拆解：
1. 句式结构（长短句比例/问句/感叹句/排比）
2. 语气调性（亲切/专业/幽默/毒舌/鸡汤/焦虑）
3. 用词习惯（口语化程度/专业术语/网络用语/表情使用）
4. 内容结构（开头/正文/结尾的组织方式）
5. 情绪节奏（情绪起伏的节奏感）
6. 独特标识（个人口头禅/标志性表达）
7. 适用平台和受众画像""")

    topic_hint = f"新主题: {new_topic}" if new_topic else "请自选 3 个与参考内容同领域的热门话题"

    imitation = call_llm(f"""## 风格仿写任务

### 参考内容
{reference[:1500]}

### 风格分析
{style_analysis}

### 仿写要求
- {topic_hint}
- 目标平台: {platform}
- 生成 {count} 篇仿写作品
- 保持参考内容的核心风格特征（句式/语气/结构/用词习惯）
- 但内容必须是原创的，不能直接抄袭

请输出：
1. 仿写作品 1（标题 + 正文）
2. 仿写作品 2（标题 + 正文）
3. 仿写作品 3（标题 + 正文）

每篇后面附注：模仿了哪些风格元素""")

    result = {
        "ok": True,
        "summary": f"风格仿写完成: 基于参考内容生成 {count} 篇 [{platform}] 仿写作品",
        "platform": platform,
        "reference_length": len(reference),
        "new_topic": new_topic or "同领域话题",
        "style_analysis": style_analysis,
        "imitated_content": imitation,
    }
    (OUTPUT_DIR / f"style_imitation_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
