"""
skill_video_generator.py — 卢娜的技能：AI视频/数字人内容生成
集成 AI 视频生成能力，支持文字转视频、数字人口播、图片转视频。
"""
import json, os, sys, time
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "videos"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

VIDEO_STYLES = {
    "口播": {
        "description": "数字人正面口播，适合教程/分享",
        "duration": "30-60秒",
        "resolution": "1080x1920",
        "fps": 30,
    },
    "图文": {
        "description": "图片轮播+字幕+BGM，适合盘点/种草",
        "duration": "15-30秒",
        "resolution": "1080x1920",
        "fps": 24,
    },
    "混剪": {
        "description": "素材混剪+解说旁白，适合资讯/评测",
        "duration": "45-120秒",
        "resolution": "1920x1080",
        "fps": 30,
    },
    "教程": {
        "description": "屏幕录制+画外音，适合技术教学",
        "duration": "60-300秒",
        "resolution": "1920x1080",
        "fps": 30,
    },
}


def call_llm(prompt, max_tokens=1200):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司增长官。你正在创作视频内容。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def generate_video_script(topic: str, style: str, platform: str, duration: str) -> dict:
    """生成完整的视频脚本"""
    prompt = f"""请为「{platform}」平台创作一个「{style}」风格的视频脚本：

主题：{topic}
目标时长：{duration}
平台：{platform}

请输出 JSON 格式：
{{
  "title": "视频标题（含emoji，吸引点击）",
  "hook": "前3秒钩子文案（必须在3秒内抓住注意力）",
  "scenes": [
    {{"time": "0-3s", "visual": "画面描述", "narration": "解说词", "text_overlay": "屏幕文字"}},
    ...
  ],
  "cta": "结尾行动号召",
  "bgm_mood": "BGM风格建议",
  "tags": ["标签1", "标签2"],
  "thumbnail_prompt": "封面图AI生成提示词（英文）"
}}"""

    result = call_llm(prompt)
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        return json.loads(result[start:end]) if start >= 0 else {}
    except Exception:
        return {"title": topic, "scenes": [], "tags": []}


def generate_digital_human_config(script: dict) -> dict:
    """生成数字人口播配置"""
    narrations = [s.get("narration", "") for s in script.get("scenes", []) if s.get("narration")]
    full_narration = " ".join(narrations)

    return {
        "type": "digital_human",
        "provider_options": ["HeyGen", "D-ID", "SadTalker", "MuseTalk"],
        "voice": {
            "language": "zh-CN",
            "style": "cheerful",
            "speed": 1.1,
        },
        "avatar": {
            "style": "professional_female",
            "background": "office_blur",
        },
        "narration_text": full_narration,
        "subtitles": True,
        "estimated_cost_usd": round(len(full_narration) * 0.005, 2),
    }


def generate_image_slideshow_config(script: dict) -> dict:
    """生成图文轮播视频配置"""
    scenes = script.get("scenes", [])
    image_prompts = []
    for s in scenes:
        visual = s.get("visual", "")
        if visual:
            image_prompts.append({
                "prompt": f"social media content, {visual}, modern, clean, vibrant colors",
                "duration_seconds": 3,
                "transition": "fade",
            })

    return {
        "type": "image_slideshow",
        "images": image_prompts,
        "subtitles": [s.get("text_overlay", "") for s in scenes],
        "bgm_mood": script.get("bgm_mood", "upbeat"),
        "resolution": "1080x1920",
        "provider_options": ["FFmpeg+AI图片", "Runway", "Pika"],
    }


def generate_ffmpeg_command(config: dict, output_file: str) -> str:
    """生成 FFmpeg 合成命令（图文轮播模式）"""
    n = len(config.get("images", []))
    return (
        f'ffmpeg -y -framerate 1/3 -i "image_%03d.png" '
        f'-i "bgm.mp3" -c:v libx264 -r 24 -pix_fmt yuv420p '
        f'-shortest "{output_file}"'
    )


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")

    raw = sys.argv[1] if len(sys.argv) > 1 else '{"topic": "AI编程效率提升"}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"topic": raw}

    topic = params.get("topic", "AI编程效率提升")
    style = params.get("style", "口播")
    platform = params.get("platform", "抖音")
    style_config = VIDEO_STYLES.get(style, VIDEO_STYLES["口播"])
    duration = params.get("duration", style_config["duration"])

    script = generate_video_script(topic, style, platform, duration)

    production_config = {}
    if style == "口播":
        production_config = generate_digital_human_config(script)
    elif style in ("图文", "混剪"):
        production_config = generate_image_slideshow_config(script)
    elif style == "教程":
        production_config = {
            "type": "screen_recording",
            "tools": ["OBS Studio", "FFmpeg"],
            "narration": "画外音配音",
            "provider_options": ["本地录制+AI配音", "HeyGen Screen"],
        }

    project = {
        "id": f"video_{timestamp}",
        "topic": topic,
        "platform": platform,
        "style": style,
        "script": script,
        "production": production_config,
        "style_config": style_config,
        "status": "script_ready",
        "created_at": timestamp,
    }

    project_file = OUTPUT_DIR / f"video_project_{timestamp}.json"
    project_file.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")

    script_file = OUTPUT_DIR / f"video_script_{timestamp}.md"
    scenes_text = "\n".join([
        f"**{s.get('time', '')}** | {s.get('visual', '')}\n"
        f"  解说：{s.get('narration', '')}\n"
        f"  字幕：{s.get('text_overlay', '')}\n"
        for s in script.get("scenes", [])
    ])
    script_file.write_text(
        f"# {script.get('title', topic)}\n\n"
        f"平台：{platform} | 风格：{style} | 时长：{duration}\n\n"
        f"## 钩子\n{script.get('hook', '')}\n\n"
        f"## 分镜\n{scenes_text}\n\n"
        f"## 结尾CTA\n{script.get('cta', '')}\n\n"
        f"## 封面提示词\n{script.get('thumbnail_prompt', '')}\n",
        encoding="utf-8",
    )

    summary = (f"视频项目: {topic} | {platform}/{style} | "
               f"分镜{len(script.get('scenes', []))}个 | 制作方案: {production_config.get('type', 'N/A')}")

    print(json.dumps({
        "ok": True,
        "summary": summary,
        "project_file": str(project_file),
        "script_file": str(script_file),
        "script_title": script.get("title", ""),
        "scenes_count": len(script.get("scenes", [])),
        "production_type": production_config.get("type", ""),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
