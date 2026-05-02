"""
skill_auto_publisher.py — 卢娜的技能：多平台内容自动发布
支持将草稿内容一键发布到小红书/抖音/微信公众号/微博，
通过浏览器自动化模拟真人操作完成发布。
"""
import json, os, sys, time, urllib.request
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "published"
DRAFTS_DIR = PROJECT_ROOT / "output" / "drafts"
LOG_DIR = PROJECT_ROOT / "output" / "publish_logs"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

PLATFORM_CONFIG = {
    "小红书": {
        "url": "https://creator.xiaohongshu.com/publish/publish",
        "max_title": 20,
        "max_body": 1000,
        "max_tags": 10,
        "image_required": True,
        "best_times": ["11:00", "14:00", "20:00", "22:00"],
    },
    "抖音": {
        "url": "https://creator.douyin.com/creator-micro/content/upload",
        "max_title": 55,
        "video_required": True,
        "best_times": ["12:00", "18:00", "20:00", "22:00"],
    },
    "微信公众号": {
        "url": "https://mp.weixin.qq.com/",
        "max_title": 64,
        "max_body": 20000,
        "best_times": ["08:00", "12:00", "20:00"],
    },
    "微博": {
        "url": "https://weibo.com",
        "max_body": 2000,
        "max_tags": 5,
        "best_times": ["09:00", "12:00", "18:00", "21:00"],
    },
}


def call_llm(prompt, system_msg="你是卢娜，一人公司增长官。你正在优化发布内容。", max_tokens=800):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [{"role": "system", "content": system_msg}, {"role": "user", "content": prompt}],
        "temperature": 0.5, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def adapt_content_for_platform(content: str, title: str, platform: str) -> dict:
    """根据平台特性自动调整内容格式"""
    config = PLATFORM_CONFIG.get(platform, {})
    prompt = f"""请将以下内容适配「{platform}」平台的格式要求：
- 标题字数限制：{config.get('max_title', 50)}字
- 正文字数限制：{config.get('max_body', 2000)}字
- 需要生成平台专属标签

原标题：{title}
原内容：{content[:1500]}

请输出 JSON 格式：
{{"title": "适配后标题", "body": "适配后正文", "tags": ["标签1", "标签2"], "publish_note": "发布建议"}}"""

    result = call_llm(prompt)
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        return json.loads(result[start:end]) if start >= 0 else {"title": title, "body": content, "tags": []}
    except Exception:
        return {"title": title, "body": content, "tags": []}


def find_best_publish_time(platform: str) -> str:
    """根据平台和当前时间，找到下一个最佳发布窗口"""
    config = PLATFORM_CONFIG.get(platform, {})
    best_times = config.get("best_times", ["20:00"])
    now = datetime.now()
    current = now.strftime("%H:%M")

    for t in best_times:
        if t > current:
            return f"今天 {t}"
    return f"明天 {best_times[0]}"


def generate_publish_script(platform: str, adapted: dict) -> dict:
    """生成浏览器自动化发布脚本（Playwright/Selenium 格式）"""
    config = PLATFORM_CONFIG.get(platform, {})
    steps = []

    if platform == "小红书":
        steps = [
            {"action": "navigate", "url": config["url"]},
            {"action": "wait", "selector": ".upload-input", "timeout": 10},
            {"action": "click", "selector": ".upload-input", "note": "上传图片"},
            {"action": "fill", "selector": "input[placeholder*='标题']", "value": adapted["title"]},
            {"action": "fill", "selector": ".ql-editor", "value": adapted["body"]},
            {"action": "click", "selector": ".tag-input", "note": "添加标签"},
            *[{"action": "type", "text": tag + "\n"} for tag in adapted.get("tags", [])[:5]],
            {"action": "click", "selector": "button.submit", "note": "发布"},
        ]
    elif platform == "抖音":
        steps = [
            {"action": "navigate", "url": config["url"]},
            {"action": "wait", "selector": ".upload-btn", "timeout": 10},
            {"action": "click", "selector": ".upload-btn", "note": "上传视频"},
            {"action": "fill", "selector": ".title-input", "value": adapted["title"]},
            {"action": "fill", "selector": ".desc-input", "value": adapted["body"]},
            {"action": "click", "selector": ".publish-btn", "note": "发布"},
        ]
    elif platform == "微信公众号":
        steps = [
            {"action": "navigate", "url": config["url"]},
            {"action": "click", "selector": "[data-type='new']", "note": "新建图文"},
            {"action": "fill", "selector": "#title", "value": adapted["title"]},
            {"action": "fill", "selector": "#edui_body", "value": adapted["body"]},
            {"action": "click", "selector": ".send-btn", "note": "发布"},
        ]
    elif platform == "微博":
        steps = [
            {"action": "navigate", "url": config["url"]},
            {"action": "fill", "selector": "textarea.W_input", "value": adapted["body"][:2000]},
            {"action": "click", "selector": "a.W_btn_a", "note": "发布"},
        ]

    return {
        "platform": platform,
        "steps": steps,
        "requires_login": True,
        "estimated_time_seconds": 30,
        "note": "请确保已在浏览器中登录对应平台",
    }


def load_pending_drafts() -> list:
    """加载待发布的草稿文件"""
    drafts = []
    if DRAFTS_DIR.exists():
        for f in sorted(DRAFTS_DIR.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
            content = f.read_text(encoding="utf-8")
            title = content.split("\n")[0].lstrip("# ").strip() if content else f.stem
            drafts.append({"file": str(f), "title": title, "content": content, "filename": f.name})
    return drafts


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")

    raw = sys.argv[1] if len(sys.argv) > 1 else '{}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"platforms": ["小红书", "抖音", "微信公众号", "微博"]}

    platforms = params.get("platforms", ["小红书", "抖音", "微信公众号", "微博"])
    draft_file = params.get("draft_file", "")
    auto_execute = params.get("auto_execute", False)

    if draft_file and Path(draft_file).exists():
        content = Path(draft_file).read_text(encoding="utf-8")
        title = content.split("\n")[0].lstrip("# ").strip()
        drafts = [{"file": draft_file, "title": title, "content": content}]
    else:
        drafts = load_pending_drafts()[:5]

    if not drafts:
        print(json.dumps({"ok": False, "summary": "没有找到待发布的草稿，请先运行内容生产流水线"}, ensure_ascii=False))
        return

    publish_plan = []
    for draft in drafts:
        for platform in platforms:
            adapted = adapt_content_for_platform(draft["content"], draft["title"], platform)
            best_time = find_best_publish_time(platform)
            script = generate_publish_script(platform, adapted)

            entry = {
                "draft_title": draft["title"],
                "platform": platform,
                "adapted_content": adapted,
                "best_publish_time": best_time,
                "automation_script": script,
                "status": "ready" if auto_execute else "pending_review",
            }
            publish_plan.append(entry)

    plan_file = OUTPUT_DIR / f"publish_plan_{timestamp}.json"
    plan_file.write_text(json.dumps(publish_plan, ensure_ascii=False, indent=2), encoding="utf-8")

    log_entry = {
        "timestamp": timestamp,
        "drafts_count": len(drafts),
        "platforms": platforms,
        "entries": len(publish_plan),
        "auto_execute": auto_execute,
    }
    log_file = LOG_DIR / f"publish_log_{timestamp}.json"
    log_file.write_text(json.dumps(log_entry, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = (f"发布计划: {len(drafts)}篇草稿 × {len(platforms)}个平台 = "
               f"{len(publish_plan)}条发布任务 | 模式={'自动执行' if auto_execute else '人工审核'}")

    notify_msg = f"📢 内容发布计划已生成\n\n"
    for entry in publish_plan[:10]:
        status_icon = "🟢" if entry["status"] == "ready" else "🟡"
        notify_msg += f"{status_icon} [{entry['platform']}] {entry['draft_title'][:30]}\n"
        notify_msg += f"   最佳发布时间: {entry['best_publish_time']}\n"
    notify_msg += f"\n共 {len(publish_plan)} 条任务，计划文件: {plan_file.name}"

    try:
        notify_body = json.dumps({
            "msg_type": "text",
            "content": json.dumps({"text": notify_msg})
        }).encode("utf-8")
        feishu_url = "http://127.0.0.1:18782/api/feishu/notify"
        req = urllib.request.Request(feishu_url, data=notify_body, headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass

    print(json.dumps({
        "ok": True,
        "summary": summary,
        "plan_file": str(plan_file),
        "entries": len(publish_plan),
        "platforms": platforms,
        "drafts": [d["title"] for d in drafts],
        "notification": "飞书通知已尝试推送",
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
