"""
notify.py — 一人公司统一通知服务
支持：飞书群机器人 / 企业微信 / 邮件
所有Agent调用此模块推送通知给CEO
"""
import json
import urllib.request
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "integrations.json"


def _load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {}


def send_feishu(title: str, content: str, msg_type: str = "text") -> bool:
    """通过飞书群机器人Webhook发送消息"""
    config = _load_config().get("feishu", {})
    if not config.get("enabled"):
        return False

    webhook_url = config.get("bot_webhook_url", "")
    if not webhook_url or webhook_url.startswith("TODO"):
        return False

    if msg_type == "text":
        body = {"msg_type": "text", "content": {"text": f"📋 {title}\n\n{content}"}}
    elif msg_type == "interactive":
        body = {
            "msg_type": "interactive",
            "card": {
                "header": {"title": {"tag": "plain_text", "content": title}},
                "elements": [{"tag": "markdown", "content": content}],
            },
        }
    else:
        body = {"msg_type": "text", "content": {"text": f"{title}\n{content}"}}

    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def send_wecom(title: str, content: str, to_user: str = "@all") -> bool:
    """通过企业微信应用消息发送通知"""
    config = _load_config().get("outreach", {}).get("wecom", {})
    if not config.get("enabled"):
        return False

    corp_id = config.get("corp_id", "")
    agent_secret = config.get("agent_secret", "")
    agent_id = config.get("agent_id", "")

    if not corp_id or corp_id.startswith("TODO"):
        return False

    try:
        token_url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={corp_id}&corpsecret={agent_secret}"
        with urllib.request.urlopen(token_url, timeout=10) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
            access_token = token_data.get("access_token")

        if not access_token:
            return False

        send_url = f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={access_token}"
        msg = {
            "touser": to_user,
            "msgtype": "text",
            "agentid": int(agent_id),
            "text": {"content": f"📋 {title}\n\n{content}"},
        }
        req = urllib.request.Request(
            send_url,
            data=json.dumps(msg).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def send_email(to_addr: str, subject: str, body: str) -> bool:
    """通过SMTP发送邮件"""
    config = _load_config().get("outreach", {}).get("email", {})
    if not config.get("enabled"):
        return False

    host = config.get("smtp_host", "")
    if not host or host.startswith("TODO"):
        return False

    port = config.get("smtp_port", 465)
    user = config.get("smtp_user", "")
    password = config.get("smtp_password", "")
    from_name = config.get("from_name", "OpenClaw AI Agency")

    try:
        msg = MIMEMultipart()
        msg["From"] = f"{from_name} <{user}>"
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html", "utf-8"))

        if config.get("smtp_ssl", True):
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls()

        server.login(user, password)
        server.sendmail(user, [to_addr], msg.as_string())
        server.quit()
        return True
    except Exception:
        return False


def notify_ceo(title: str, content: str) -> dict:
    """统一通知CEO — 尝试所有可用渠道"""
    results = {
        "feishu": send_feishu(title, content, "interactive"),
        "wecom": send_wecom(title, content),
    }
    results["any_success"] = any(results.values())
    return results
