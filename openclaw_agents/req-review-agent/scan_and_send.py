"""
scan_and_send.py — 扫描飞书待审批需求并发送审核卡片
奥力直接运行此脚本即可完成 STEP 1 + STEP 2
输出：JSON 格式的处理结果
"""
import json, sys, os, datetime, requests
from pathlib import Path

HERE = Path(__file__).parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))

# 飞书凭据
APP_ID     = "cli_a8e665e113a4500e"   # 白泽：用于卡片推送
APP_SECRET = "fFqJuhmuJZBOFxPvBSQ8RhouaPpg4I0k"
BITABLE_APP_ID     = "cli_a8e665e113a4500e"   # 白泽：用于 bitable 读写
BITABLE_APP_SECRET = "fFqJuhmuJZBOFxPvBSQ8RhouaPpg4I0k"

# 飞书表格配置
APP_TOKEN  = CONFIG["feishu"]["bitable_app_token"]   # EI2CbmJb1aDlVosGmnocIdAznab
TABLE_ID   = CONFIG["feishu"]["table_id"]            # tbl3Ci7REHJK8LQT
REVIEWER   = CONFIG.get("reviewer_receive_id") or CONFIG["reviewer_open_id"]
RECEIVE_ID_TYPE = CONFIG.get("reviewer_receive_id_type", "open_id")

FEISHU_API = "https://open.feishu.cn/open-apis"

# 严重程度映射
SEVERITY_MAP = {
    "P0": "CbHEhDQ4", "P1": "Gjh8TNF3",
    "P2": "da53MmEu", "P3": "VN4pcKke",
    "高": "Gjh8TNF3", "中": "da53MmEu", "低": "VN4pcKke",
}
# 产品 UUID 映射
PRODUCT_MAP = CONFIG["ones"]["product_uuids"]
ISSUE_TYPE  = CONFIG["ones"]["issue_types"]


def get_tenant_token():
    r = requests.post(f"{FEISHU_API}/auth/v3/tenant_access_token/internal",
                      json={"app_id": APP_ID, "app_secret": APP_SECRET}, timeout=10)
    return r.json()["tenant_access_token"]


def get_bitable_token():
    r = requests.post(f"{FEISHU_API}/auth/v3/tenant_access_token/internal",
                      json={"app_id": BITABLE_APP_ID, "app_secret": BITABLE_APP_SECRET}, timeout=10)
    return r.json()["tenant_access_token"]


def get_pending_records(token):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    fields = CONFIG["feishu"]["fields"]
    field_names = list(fields.values())
    auto_status = CONFIG["feishu"].get("automation_status_values", {})
    payload = {
        "filter": {
            "conjunction": "and",
            "conditions": [
                {"field_name": fields["status"], "operator": "is",
                 "value": [CONFIG["feishu"]["status_values"]["pending"]]},
                {"field_name": fields["automation_status"], "operator": "isEmpty",
                 "value": []}
            ]
        },
        "field_names": field_names,
        "page_size": 50,
    }
    r = requests.post(
        f"{FEISHU_API}/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records/search",
        headers=headers, json=payload, timeout=15)
    data = r.json()
    if data.get("code") != 0:
        raise RuntimeError(f"飞书 API 错误: {data}")
    return data.get("data", {}).get("items", [])


def build_card(record):
    f = record.get("fields", {})
    fields = CONFIG["feishu"]["fields"]

    def extract_text(val, default=""):
        if isinstance(val, list):
            return "".join(item.get("text", "") for item in val if isinstance(item, dict))
        return str(val) if val else default

    req_type = extract_text(f.get(fields["type"], ""), "需求优化") or "需求优化"
    title    = extract_text(f.get(fields["title"], ""), "（无标题）") or "（无标题）"
    desc_full = extract_text(f.get(fields["description"], ""), "（无描述）") or "（无描述）"
    desc_preview = desc_full[:300]

    submitter_name = "（未知）"
    submitter_id   = ""
    sub_raw = f.get(fields["submitter"], [])
    if isinstance(sub_raw, list) and sub_raw:
        submitter_name = sub_raw[0].get("name", "（未知）")
        submitter_id   = sub_raw[0].get("id", "")

    severity = str(f.get(fields["severity"], "P2") or "P2")
    priority = str(f.get(fields["priority"], "-") or "-")

    product_raw = f.get(fields["product"], [])
    if isinstance(product_raw, list):
        product_list = [str(x) for x in product_raw if x]
    elif product_raw:
        product_list = [str(product_raw)]
    else:
        product_list = []
    product = product_list[0] if product_list else "-"
    product_display = "、".join(product_list) if product_list else "-"

    warehouse= str(f.get(fields["warehouse"], "-") or "-")
    value_amt = str(f.get(fields["value_amount"], "-") or "-")

    exp_ts = f.get(fields["expected_date"])
    expected = "-"
    if exp_ts:
        try:
            expected = datetime.datetime.fromtimestamp(int(exp_ts)/1000).strftime("%Y-%m-%d")
        except Exception:
            pass

    record_id = record.get("record_id", "")

    # 获取 ONES 参数
    severity_uuid = SEVERITY_MAP.get(severity, "da53MmEu")
    product_uuid  = PRODUCT_MAP.get(product, "QE2GXyz1QGmiMX55")
    issue_uuid    = ISSUE_TYPE.get("bug" if req_type == "系统BUG" else "requirement", {}).get("issue_type_uuid", "TNVWjjtZ")

    # 卡片 JSON
    card = {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": f"📋 需求审核 | {req_type}"},
            "template": "blue" if req_type == "需求优化" else "red"
        },
        "elements": [
            {"tag": "div", "fields": [
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**标题**\n{title}"}},
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**类型**\n{req_type}"}},
            ]},
            {"tag": "div", "fields": [
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**提报人**\n{submitter_name}"}},
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**所属产品**\n{product_display}"}},
            ]},
            {"tag": "div", "fields": [
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**提出仓库**\n{warehouse}"}},
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**需求优先级**\n{priority}"}},
            ]},
            {"tag": "div", "fields": [
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**严重程度**\n{severity}"}},
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**期望上线**\n{expected}"}},
            ]},
            {"tag": "div", "fields": [
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**需求价值金额**\n{value_amt}"}},
                {"is_short": True, "text": {"tag": "lark_md", "content": f"**记录ID**\n{record_id}"}},
            ]},
            {"tag": "div", "text": {"tag": "lark_md", "content": f"**需求描述**\n{desc_preview}"}},
            {"tag": "hr"},
            {"tag": "action", "actions": [
                {"tag": "button", "text": {"tag": "plain_text", "content": "✅ 通过"},
                 "type": "primary",
                 "value": {"action_type": "req_approve", "record_id": record_id,
                           "req_title": title, "description": desc_full,
                           "severity_uuid": severity_uuid, "issue_type_uuid": issue_uuid,
                           "product_uuid": product_uuid, "submitter_id": submitter_id,
                           "req_type": req_type, "warehouse": warehouse,
                           "priority": priority, "expected_date": expected,
                           "value_amount": value_amt, "submitter_name": submitter_name,
                           "product_display": product_display}},
                {"tag": "button", "text": {"tag": "plain_text", "content": "⏭ 跳过"},
                 "type": "default",
                 "value": {"action_type": "req_skip", "record_id": record_id,
                           "req_title": title}}
            ]},
            {"tag": "note", "elements": [
                {"tag": "plain_text", "content": "退回理由（点击即执行）："}
            ]},
            {"tag": "action", "actions": [
                {"tag": "button",
                 "text": {"tag": "plain_text", "content": "描述不清晰"},
                 "type": "danger",
                 "value": {"action_type": "req_reject", "record_id": record_id,
                           "req_title": title, "submitter_id": submitter_id,
                           "reason": "需求描述不清晰，请补充后重提"}},
                {"tag": "button",
                 "text": {"tag": "plain_text", "content": "不在规划范围"},
                 "type": "danger",
                 "value": {"action_type": "req_reject", "record_id": record_id,
                           "req_title": title, "submitter_id": submitter_id,
                           "reason": "功能不在当前规划范围内"}},
                {"tag": "button",
                 "text": {"tag": "plain_text", "content": "优先级不符"},
                 "type": "danger",
                 "value": {"action_type": "req_reject", "record_id": record_id,
                           "req_title": title, "submitter_id": submitter_id,
                           "reason": "优先级不符，暂缓处理"}},
                {"tag": "button",
                 "text": {"tag": "plain_text", "content": "信息不完整"},
                 "type": "danger",
                 "value": {"action_type": "req_reject", "record_id": record_id,
                           "req_title": title, "submitter_id": submitter_id,
                           "reason": "信息不完整，请补充后重提"}},
            ]}
        ]
    }
    return card


def send_card(token, card):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "receive_id": REVIEWER,
        "msg_type": "interactive",
        "content": json.dumps(card, ensure_ascii=False)
    }
    r = requests.post(
        f"{FEISHU_API}/im/v1/messages?receive_id_type={RECEIVE_ID_TYPE}",
        headers=headers, json=payload, timeout=15)
    data = r.json()
    if data.get("code") != 0:
        raise RuntimeError(f"发送卡片失败: {data}")
    return data["data"]["message_id"]


def save_pending(record_id, message_id, title):
    path = HERE / "memory" / "pending_reviews.json"
    path.parent.mkdir(exist_ok=True)
    try:
        existing = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(existing, dict):
            existing = {}
    except Exception:
        existing = {}
    existing[record_id] = {
        "message_id": message_id,
        "title": title,
        "sent_at": datetime.datetime.now().isoformat()
    }
    path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")


def update_record_after_send(token, record_id, message_id=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    fields = CONFIG["feishu"]["fields"]
    auto_status = CONFIG["feishu"].get("automation_status_values", {})
    now_ms = int(datetime.datetime.now().timestamp() * 1000)
    payload_fields = {
        fields["automation_status"]: auto_status.get("card_sent", "审批卡片已发送")
    }
    if fields.get("recent_processed_time"):
        payload_fields[fields["recent_processed_time"]] = now_ms
    if message_id and fields.get("card_message_id"):
        payload_fields[fields["card_message_id"]] = message_id
    payload = {
        "fields": payload_fields
    }
    r = requests.put(
        f"{FEISHU_API}/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records/{record_id}",
        headers=headers, json=payload, timeout=15)
    data = r.json()
    if data.get("code") != 0:
        raise RuntimeError(f"回写自动化处理状态失败: {data}")


def main():
    print("[扫描] 获取飞书 token...")
    token = get_tenant_token()
    bitable_token = get_bitable_token()

    print("[扫描] 查询待审批记录...")
    records = get_pending_records(bitable_token)

    if not records:
        print(json.dumps({"status": "empty", "message": "当前无待审批需求", "count": 0}, ensure_ascii=False))
        return

    print(f"[扫描] 找到 {len(records)} 条待审批需求，开始发送审核卡片...")
    results = []
    for rec in records:
        title = ""
        try:
            fields = CONFIG["feishu"]["fields"]
            raw_title = rec.get("fields", {}).get(fields["title"], "（无标题）")
            if isinstance(raw_title, list):
                title = "".join(item.get("text", "") for item in raw_title if isinstance(item, dict)) or "（无标题）"
            else:
                title = str(raw_title) if raw_title else "（无标题）"
            card  = build_card(rec)
            msg_id = send_card(token, card)
            save_pending(rec["record_id"], msg_id, title)
            update_record_after_send(bitable_token, rec["record_id"], msg_id)
            results.append({"record_id": rec["record_id"], "title": title, "status": "sent", "message_id": msg_id})
            print(f"  [OK] 已发送: {title}")
        except Exception as e:
            results.append({"record_id": rec.get("record_id","?"), "title": title, "status": "error", "error": str(e)})
            print(f"  [FAIL] 失败: {title} -- {e}")

    summary = {"status": "done", "count": len(records), "results": results}
    print("\n" + json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
