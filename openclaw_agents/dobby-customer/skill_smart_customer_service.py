"""
skill_smart_customer_service.py — 多比的技能：7x24智能客服
多渠道智能客服 + 线索识别 + 私域引流 + 自动应答
"""
import json, os, sys, time
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "customer_service"
KB_DIR = PROJECT_ROOT / "config" / "knowledge"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

INTENT_CATEGORIES = {
    "pricing": {"label": "价格咨询", "priority": "high", "auto_reply": True},
    "feature": {"label": "功能咨询", "priority": "medium", "auto_reply": True},
    "bug": {"label": "问题反馈", "priority": "high", "auto_reply": False},
    "cooperation": {"label": "商务合作", "priority": "high", "auto_reply": False},
    "complaint": {"label": "投诉建议", "priority": "urgent", "auto_reply": False},
    "general": {"label": "一般咨询", "priority": "low", "auto_reply": True},
    "purchase": {"label": "购买意向", "priority": "urgent", "auto_reply": True},
}

REPLY_TEMPLATES = {
    "pricing": "感谢您的咨询！我们提供多种方案：\n{pricing_info}\n如需详细了解，可以私信我获取专属报价~",
    "feature": "您好！关于{feature}功能：\n{feature_info}\n还有什么想了解的吗？",
    "purchase": "太好了！感谢您的关注 🎉\n为您准备了专属优惠，请私信我获取~",
    "general": "您好！感谢您的咨询。{answer}\n如有更多问题随时问我~",
}


def call_llm(prompt, system_msg=None, max_tokens=600):
    import urllib.request
    if not system_msg:
        system_msg = (
            "你是多比，一人公司客户成功官(CXO)。"
            "你温暖、专业、高效。回答客户问题时保持友好语气，"
            "善于识别购买意向并引导转化。回复控制在200字以内。"
        )
    body = json.dumps({
        "model": "cascade",
        "messages": [{"role": "system", "content": system_msg}, {"role": "user", "content": prompt}],
        "temperature": 0.5, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def load_knowledge_base() -> str:
    """加载产品知识库"""
    kb_content = []
    if KB_DIR.exists():
        for f in KB_DIR.glob("*.md"):
            kb_content.append(f.read_text(encoding="utf-8")[:1000])
    return "\n---\n".join(kb_content)[:3000]


def classify_intent(message: str) -> dict:
    """使用 LLM 识别客户意图"""
    prompt = f"""请分析以下客户消息的意图，输出 JSON 格式：
{{"intent": "分类", "confidence": 0.0-1.0, "keywords": ["关键词"], "is_lead": true/false, "sentiment": "positive/neutral/negative"}}

分类选项：pricing(价格咨询), feature(功能咨询), bug(问题反馈), cooperation(商务合作), complaint(投诉), purchase(购买意向), general(一般咨询)

客户消息：{message}"""

    result = call_llm(prompt, max_tokens=200)
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        return json.loads(result[start:end]) if start >= 0 else {"intent": "general", "confidence": 0.5}
    except Exception:
        return {"intent": "general", "confidence": 0.5}


def generate_reply(message: str, intent: dict, kb: str) -> dict:
    """根据意图和知识库生成智能回复"""
    intent_type = intent.get("intent", "general")
    is_lead = intent.get("is_lead", False)

    prompt = f"""作为智能客服，请回复以下客户消息。

客户意图：{INTENT_CATEGORIES.get(intent_type, {}).get('label', '一般咨询')}
客户情绪：{intent.get('sentiment', 'neutral')}
是否高意向客户：{'是' if is_lead else '否'}

产品知识库摘要：
{kb[:1500]}

客户消息：{message}

要求：
1. 保持专业友好的语气
2. 回复控制在150字以内
3. 如果是高意向客户，自然引导私信/添加联系方式
4. 如果涉及价格/合作，给出初步信息并引导深入沟通
"""

    reply = call_llm(prompt)

    return {
        "reply": reply,
        "intent": intent_type,
        "auto_reply_enabled": INTENT_CATEGORIES.get(intent_type, {}).get("auto_reply", False),
        "needs_human_review": intent_type in ("bug", "cooperation", "complaint"),
        "is_lead": is_lead,
        "follow_up_action": "transfer_to_sales" if is_lead else None,
    }


def process_batch_messages(messages: list, kb: str) -> list:
    """批量处理客户消息"""
    results = []
    for msg in messages:
        text = msg.get("text", msg) if isinstance(msg, dict) else str(msg)
        intent = classify_intent(text)
        reply = generate_reply(text, intent, kb)
        results.append({
            "original_message": text,
            "channel": msg.get("channel", "unknown") if isinstance(msg, dict) else "unknown",
            "intent_analysis": intent,
            "generated_reply": reply,
            "processed_at": datetime.now().isoformat(),
        })
    return results


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")

    raw = sys.argv[1] if len(sys.argv) > 1 else '{"message": "你们的AI服务多少钱？"}'
    try:
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        params = {"message": raw}

    kb = load_knowledge_base()

    if "messages" in params:
        results = process_batch_messages(params["messages"], kb)
    elif "message" in params:
        intent = classify_intent(params["message"])
        reply = generate_reply(params["message"], intent, kb)
        results = [{
            "original_message": params["message"],
            "channel": params.get("channel", "direct"),
            "intent_analysis": intent,
            "generated_reply": reply,
            "processed_at": datetime.now().isoformat(),
        }]
    else:
        results = []

    leads = [r for r in results if r.get("intent_analysis", {}).get("is_lead")]
    needs_human = [r for r in results if r.get("generated_reply", {}).get("needs_human_review")]

    report = {
        "timestamp": timestamp,
        "total_processed": len(results),
        "auto_replied": sum(1 for r in results if r.get("generated_reply", {}).get("auto_reply_enabled")),
        "needs_human_review": len(needs_human),
        "leads_identified": len(leads),
        "results": results,
    }

    out_file = OUTPUT_DIR / f"cs_session_{timestamp}.json"
    out_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    if leads:
        leads_file = OUTPUT_DIR / f"leads_{timestamp}.json"
        leads_file.write_text(json.dumps(leads, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = (f"客服处理: {len(results)}条消息 | "
               f"自动回复{report['auto_replied']} | 待人工{len(needs_human)} | "
               f"识别线索{len(leads)}条")

    print(json.dumps({
        "ok": True,
        "summary": summary,
        "total": len(results),
        "leads": len(leads),
        "report_file": str(out_file),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
