"""
skill_email_outreach.py — Fred的技能：自动邮件获客触达
从销售管线中选取目标线索，生成个性化邮件并发送。
安全模式：默认只生成邮件草稿，不自动发送。
"""
import json
import sys
import os
from pathlib import Path
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput
from _shared.notify import send_email

PROJECT = Path(__file__).resolve().parent.parent.parent
PIPELINE_PATH = PROJECT / "data_raw" / "sales_pipeline.json"
OUTREACH_DIR = PROJECT / "output" / "outreach"
CONFIG_PATH = PROJECT / "config" / "integrations.json"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def load_pipeline() -> list:
    if PIPELINE_PATH.exists():
        data = json.loads(PIPELINE_PATH.read_text(encoding="utf-8"))
        return data.get("leads", [])
    return []


def load_email_config() -> dict:
    if CONFIG_PATH.exists():
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return config.get("outreach", {}).get("email", {})
    return {}


def call_llm(prompt: str) -> str:
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是弗雷德，一人公司首席销售官。你擅长写专业、有温度、转化率高的商务邮件。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 1000,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def generate_email(lead: dict) -> dict:
    prompt = f"""为以下潜在客户生成一封获客邮件：

客户名称：{lead.get('name', '未知')}
来源：{lead.get('source', '未知')}
预估价值：¥{lead.get('value', 0)}
备注：{lead.get('notes', '')}

要求：
- 标题：15字以内，引起兴趣但不像广告
- 正文：200字以内，直击痛点
- 突出一人公司AI操作系统的核心价值：节省人力、自动化运营、降本增效
- 结尾引导回复或预约沟通
- 专业温和，不要过度推销

直接输出邮件内容，格式：
标题：xxx
正文：
xxx"""

    content = call_llm(prompt)
    lines = content.strip().split("\n")
    subject = ""
    body_lines = []
    in_body = False
    for line in lines:
        if line.startswith("标题：") or line.startswith("标题:"):
            subject = line.split("：", 1)[-1].split(":", 1)[-1].strip()
        elif line.startswith("正文：") or line.startswith("正文:"):
            in_body = True
        elif in_body:
            body_lines.append(line)

    return {
        "lead_id": lead.get("id"),
        "lead_name": lead.get("name"),
        "subject": subject or f"关于AI自动化运营的合作机会",
        "body": "\n".join(body_lines) if body_lines else content,
        "generated_at": datetime.now().isoformat(),
    }


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else '{}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {}

    auto_send = params.get("auto_send", False)
    target_stages = params.get("stages", ["线索", "初步接触"])

    leads = load_pipeline()
    target_leads = [l for l in leads if l.get("stage") in target_stages]

    if not target_leads:
        out = SkillOutput()
        out.summary = "无目标线索需要触达"
        out.emit()
        return

    OUTREACH_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now().strftime("%Y%m%d_%H%M")

    emails = []
    sent_count = 0
    for lead in target_leads:
        email = generate_email(lead)
        emails.append(email)

        draft_path = OUTREACH_DIR / f"email_{lead['id']}_{now}.md"
        draft_path.write_text(
            f"# 获客邮件 — {lead['name']}\n\n**标题**: {email['subject']}\n\n{email['body']}",
            encoding="utf-8",
        )

        if auto_send and lead.get("contact"):
            email_config = load_email_config()
            if email_config.get("enabled"):
                success = send_email(lead["contact"], email["subject"], email["body"])
                if success:
                    sent_count += 1
                    email["sent"] = True

    out = SkillOutput()
    out.summary = f"获客邮件: {len(emails)}封草稿生成 | {sent_count}封已发送 | 目标阶段: {target_stages}"
    out.data = {"emails": emails, "target_leads": len(target_leads), "sent": sent_count}
    out.metrics["emailsGenerated"] = len(emails)
    out.metrics["emailsSent"] = sent_count
    out.emit()


if __name__ == "__main__":
    main()
