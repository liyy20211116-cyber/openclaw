"""
skill_draft_generator.py — 卢娜的技能：社交平台内容草稿生成器
调用 LLM 生成适配小红书/抖音/公众号的高质量原创内容。
安全模式：只生成草稿文件，不自动发布。
"""
import json, sys, os, urllib.request
from pathlib import Path
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output" / "drafts"
KNOWLEDGE_DIR = PROJECT / "config" / "knowledge"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

PLATFORM_PROMPTS = {
    "小红书": """你是一位小红书爆款笔记写手。请根据以下选题写一篇完整的小红书笔记。

要求：
- 标题：20字以内，用「|」「！」等分隔符，带数字或悬念钩子
- 正文：600-1000字，分段清晰，多用emoji，口语化
- 开头3秒抓住注意力（痛点/反常识/数据）
- 中间给干货（3-5个核心要点，每个配实操步骤）
- 结尾引导互动（提问/投票/收藏提醒）
- 底部带5-8个相关话题标签（#开头）
- 配图建议（几张图，每张拍什么）

选题：{topic}
风格：{style}
{knowledge_hint}

直接输出笔记内容，不要元描述。""",

    "抖音": """你是一位抖音短视频脚本写手。请根据以下选题写一份完整的短视频脚本。

要求：
- 时长目标：45-90秒
- 分镜脚本格式：每个画面写明【时间段】【画面描述】【口播文案】【字幕】
- 开头3秒必须有强钩子（疑问/冲突/利益点）
- 中间给干货（3个核心要点，简洁有力）
- 结尾行动号召（关注/评论/收藏）
- BGM建议
- 底部带3-5个话题标签

选题：{topic}
风格：{style}
{knowledge_hint}

直接输出脚本内容，不要元描述。""",

    "公众号": """你是一位微信公众号内容运营。请根据以下选题写一篇公众号文章。

要求：
- 标题：25字以内，引发点击欲望
- 正文：1500-2500字，结构清晰（引言→正文→总结）
- 深度但不枯燥，案例+数据支撑观点
- 适当使用加粗、引用块、分割线增加可读性
- 结尾引导关注或留言

选题：{topic}
风格：{style}
{knowledge_hint}

直接输出文章内容。""",
}


def call_llm(prompt: str, max_tokens: int = 2000) -> str:
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司首席增长官(CGO)。你擅长写引人入胜的社交媒体内容，风格活泼专业，善于用通俗语言解释复杂概念。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.8,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def load_knowledge(filename: str) -> str:
    kf = KNOWLEDGE_DIR / filename
    if kf.exists():
        return kf.read_text(encoding="utf-8")[:2000]
    return ""


def generate_draft(topic: str, platform: str, style: str) -> dict:
    prompt_template = PLATFORM_PROMPTS.get(platform)
    if not prompt_template:
        return {"platform": platform, "title": topic, "body": f"暂不支持{platform}，请选择小红书/抖音/公众号", "style": style, "tags": []}

    knowledge_files = {"小红书": "xhs-operations.md", "抖音": "douyin-operations.md", "公众号": "wechat-operations.md"}
    knowledge = load_knowledge(knowledge_files.get(platform, ""))
    knowledge_hint = f"\n参考运营知识：\n{knowledge[:1000]}" if knowledge else ""

    prompt = prompt_template.format(topic=topic, style=style, knowledge_hint=knowledge_hint)
    content = call_llm(prompt)

    lines = content.strip().split("\n")
    title = lines[0].lstrip("#").strip() if lines else topic
    if len(title) > 50:
        title = topic

    tags = []
    for line in lines:
        import re
        found = re.findall(r'#(\S+)', line)
        tags.extend(found)
    tags = list(dict.fromkeys(tags))[:8]

    best_times = {"小红书": "周四/周五 20:00", "抖音": "周五/周六 20:00-22:00", "公众号": "周二/周四 20:00"}

    return {
        "platform": platform,
        "title": title,
        "body": content,
        "style": style,
        "tags": tags,
        "best_publish_time": best_times.get(platform, "20:00"),
        "word_count": len(content),
        "generated_by": "llm",
    }


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else '{"topic": "AI编程", "platforms": ["小红书", "抖音"], "style": "教程型"}'
    if raw.endswith('.json') and Path(raw).exists():
        raw = Path(raw).read_text(encoding='utf-8')
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"topic": raw, "platforms": ["小红书"], "style": "教程型"}

    topic = params.get("topic", "AI编程")
    platforms = params.get("platforms", ["小红书", "抖音"])
    style = params.get("style", "教程型")
    now = datetime.now().strftime("%Y%m%d_%H%M")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    drafts = []
    for platform in platforms:
        draft = generate_draft(topic, platform, style)
        drafts.append(draft)

        import re
        safe_topic = re.sub(r'[\\/:*?"<>|]', '_', topic)[:30]
        draft_file = OUTPUT_DIR / f"{platform}_{safe_topic}_{now}.md"
        content = draft.get("body", "")
        draft_file.write_text(content, encoding="utf-8")

    out = SkillOutput()
    total_words = sum(d.get("word_count", 0) for d in drafts)
    out.summary = f"AI原创草稿: {topic} | {len(drafts)}个平台 | 风格={style} | 共{total_words}字"
    out.data = {"drafts": drafts, "output_dir": str(OUTPUT_DIR), "topic": topic, "platforms": platforms}
    out.metrics["draftsGenerated"] = len(drafts)
    out.metrics["totalWords"] = total_words

    for draft in drafts:
        content = draft.get("body", "")
        if content:
            out.add_artifact(f"{draft.get('platform', 'unknown')}_{topic}.md", content)

    out.suggest_next("luna_auto_publisher", "luna-growth")

    report_path = OUTPUT_DIR / f"draft_report_{now}.json"
    report_path.write_text(json.dumps({
        "summary": out.summary,
        "drafts": [{k: v for k, v in d.items() if k != "body"} for d in drafts],
        "timestamp": now,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    out.emit()


if __name__ == "__main__":
    main()
