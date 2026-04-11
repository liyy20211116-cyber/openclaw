"""
card_action_handler.py — 飞书卡片按钮事件处理服务
通过飞书 WebSocket 长连接接收卡片交互事件，处理「通过」和「退回」操作。

退回流程（纯卡片内交互，无需聊天消息）：
  点击「退回」→ 卡片更新为含 input 输入框的 v2 卡片
  → 填写退回理由后点「确认退回」→ 后台静默执行，卡片更新为「已退回」

运行方式：python card_action_handler.py（后台常驻，随 OpenClaw 一起启动）
"""
import json, subprocess, sys, datetime, requests, logging, re, threading
from pathlib import Path

import lark_oapi as lark
from lark_oapi.event.dispatcher_handler import EventDispatcherHandler
from lark_oapi.event.callback.model.p2_card_action_trigger import (
    P2CardActionTrigger, P2CardActionTriggerResponse,
    CallBackCard, CallBackToast
)

HERE = Path(__file__).parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))

APP_ID     = CONFIG["feishu_app_id"]
APP_SECRET = CONFIG["feishu_app_secret"]

# 当前配置下 Bitable 与卡片回调共用同一应用凭据
BITABLE_APP_ID     = CONFIG["feishu_app_id"]
BITABLE_APP_SECRET = CONFIG["feishu_app_secret"]
FEISHU_API = "https://open.feishu.cn/open-apis"
APP_TOKEN  = CONFIG["feishu"]["bitable_app_token"]
TABLE_ID   = CONFIG["feishu"]["table_id"]
REVIEWER   = CONFIG.get("reviewer_receive_id") or CONFIG["reviewer_open_id"]
RECEIVE_ID_TYPE = CONFIG.get("reviewer_receive_id_type", "open_id")
APPROVER_OPEN_ID = CONFIG.get("reviewer_approver_open_id")

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(HERE / "card_handler.log"), encoding="utf-8")
    ]
)
log = logging.getLogger("card-handler")


# ─────────────────────── 飞书基础工具 ─────────────────────────

def get_tenant_token() -> str:
    """原神 token，用于发送消息、卡片更新"""
    r = requests.post(
        f"{FEISHU_API}/auth/v3/tenant_access_token/internal",
        json={"app_id": APP_ID, "app_secret": APP_SECRET}, timeout=10
    )
    return r.json()["tenant_access_token"]


def get_bitable_token() -> str:
    """白泽 token，用于 Bitable 读写（原神暂无多维表权限）"""
    r = requests.post(
        f"{FEISHU_API}/auth/v3/tenant_access_token/internal",
        json={"app_id": BITABLE_APP_ID, "app_secret": BITABLE_APP_SECRET}, timeout=10
    )
    return r.json()["tenant_access_token"]


def update_bitable_record(token: str, record_id: str, fields_data: dict):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 保险层：飞书人员字段当前缺少可用 Person ID，先禁止审批人字段进入回写 payload，确保主流程闭环
    approver_field = CONFIG.get("feishu", {}).get("fields", {}).get("approver")
    safe_fields = dict(fields_data or {})
    if approver_field and approver_field in safe_fields:
        safe_fields.pop(approver_field, None)
        log.info(f"[Bitable PUT] 已过滤审批人字段: {approver_field}")

    try:
        log.info(f"[Bitable PUT] safe_fields keys={list(safe_fields.keys())}")
    except Exception:
        pass

    r = requests.put(
        f"{FEISHU_API}/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records/{record_id}",
        headers=headers, json={"fields": safe_fields}, timeout=15
    )
    raw = r.content.decode("utf-8", errors="replace").strip()
    log.info(f"[Bitable PUT] status={r.status_code} body={raw[:200]}")
    try:
        resp = json.loads(raw) if raw else {}
    except Exception:
        if r.status_code < 300:
            log.warning(f"[Bitable] 响应无法解析，HTTP {r.status_code} 视为成功")
            return {"code": 0}
        raise RuntimeError(f"Bitable API HTTP {r.status_code}: {raw[:200]}")
    if isinstance(resp, dict) and resp.get("code", 0) != 0:
        log.error(f"更新飞书表格失败: {resp}")
    return resp if isinstance(resp, dict) else {"code": 0}


def send_text_message(token: str, receive_id: str, text: str, receive_id_type: str = "open_id"):
    if not receive_id:
        log.warning("[消息] receive_id 为空，跳过发送")
        return {}
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = requests.post(
        f"{FEISHU_API}/im/v1/messages?receive_id_type={receive_id_type}",
        headers=headers,
        json={"receive_id": receive_id, "msg_type": "text",
              "content": json.dumps({"text": text}, ensure_ascii=False)},
        timeout=15
    )
    try:
        resp = r.json()
    except Exception:
        resp = {"code": -1, "raw": r.text[:100]}
    if resp.get("code", 0) != 0:
        log.error(f"[消息] 发送失败: {resp}")
    return resp


# ─────────────────────── 卡片构建工具 ─────────────────────────

_REJECT_REASONS = [
    "需求描述不清晰，请补充后重提",
    "功能不在当前规划范围内",
    "优先级不符，暂缓处理",
    "信息不完整，请补充后重提",
]


def build_reject_reason_card(record_id: str, title: str, submitter_id: str) -> dict:
    """
    退回：显示预设理由按钮（schema 1.0，兼容 CallBackCard 更新）。
    点击任一理由按钮立即执行退回，无需聊天消息、无需 v2 schema。
    """
    def _btn(reason: str) -> dict:
        return {
            "tag": "button",
            "text": {"tag": "plain_text", "content": reason},
            "type": "danger",
            "value": {
                "action_type": "req_reject_confirm",
                "record_id": record_id,
                "req_title": title,
                "submitter_id": submitter_id,
                "reason": reason,
            }
        }

    rows = [_REJECT_REASONS[:2], _REJECT_REASONS[2:]]
    elements = [
        {"tag": "div", "text": {"tag": "lark_md",
            "content": f"**需求**：{title}\n\n请选择退回理由（点击后立即执行）："}},
    ]
    for row in rows:
        if row:
            elements.append({"tag": "action", "actions": [_btn(r) for r in row]})
    elements.append({
        "tag": "action",
        "actions": [{
            "tag": "button",
            "text": {"tag": "plain_text", "content": "取消"},
            "type": "default",
            "value": {"action_type": "req_cancel", "req_title": title}
        }]
    })

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": "退回需求 | 选择退回理由"},
            "template": "orange"
        },
        "elements": elements
    }


def build_done_card(title: str, action: str, detail: str = "") -> dict:
    """操作完成后的静态结果卡片"""
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    if action == "approved":
        return {
            "config": {"wide_screen_mode": True},
            "header": {"title": {"tag": "plain_text", "content": f"[已通过] {title}"},
                       "template": "green"},
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md", "content": f"ONES 工单已创建。\n{detail}"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"_处理时间：{now_str}_"}}
            ]
        }
    elif action == "rejected":
        return {
            "config": {"wide_screen_mode": True},
            "header": {"title": {"tag": "plain_text", "content": f"[已退回] {title}"},
                       "template": "red"},
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**退回理由**：{detail}"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"_处理时间：{now_str}_"}}
            ]
        }
    elif action == "failed":
        return {
            "config": {"wide_screen_mode": True},
            "header": {"title": {"tag": "plain_text", "content": f"[处理失败] {title}"},
                       "template": "red"},
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md", "content": detail or "建单失败，请查看日志。"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"_处理时间：{now_str}_"}}
            ]
        }
    else:
        return {
            "config": {"wide_screen_mode": True},
            "header": {"title": {"tag": "plain_text", "content": f"[已取消] {title}"},
                       "template": "grey"},
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md", "content": "操作已取消。"}}
            ]
        }


def make_response(new_card: dict | None, toast_text: str | None = None,
                  toast_type: str = "info") -> P2CardActionTriggerResponse:
    resp = P2CardActionTriggerResponse()
    if new_card is not None:
        card = CallBackCard()
        card.type = "raw"
        card.data = new_card
        resp.card = card
    if toast_text:
        toast = CallBackToast()
        toast.type = toast_type
        toast.content = toast_text
        resp.toast = toast
    return resp


# ─────────────────────── 业务逻辑 ─────────────────────────────

def _run_approve_job(value: dict) -> None:
    record_id      = value.get("record_id", "")
    title          = value.get("req_title", "未命名需求")
    desc           = value.get("description", "")
    severity_uuid  = value.get("severity_uuid", "da53MmEu")
    issue_uuid     = value.get("issue_type_uuid", "2cCuqqQw")
    product_uuid   = value.get("product_uuid", "QE2GXyz1QGmiMX55")
    req_type       = value.get("req_type", "需求优化")
    warehouse      = value.get("warehouse", "")
    priority       = value.get("priority", "")
    expected_date  = value.get("expected_date", "")
    value_amount   = value.get("value_amount", "")
    submitter_name = value.get("submitter_name", "")
    product_display = value.get("product_display", "")

    log.info(f"[通过-后台] record={record_id} title={title}")

    cmd = [
        sys.executable, str(HERE / "create_ones_task_ui.py"),
        title, desc, severity_uuid, issue_uuid, product_uuid,
        req_type, warehouse, priority, expected_date, value_amount,
        submitter_name, product_display
    ]

    try:
        bitable_token = get_bitable_token()
        fields_cfg    = CONFIG["feishu"]["fields"]
        status_values = CONFIG["feishu"]["status_values"]
        auto_values   = CONFIG["feishu"].get("automation_status_values", {})
        now_ms = int(datetime.datetime.now().timestamp() * 1000)

        pre_update = {
            fields_cfg["automation_status"]: auto_values.get("approved_waiting_create", "审批通过待建单"),
            fields_cfg["approval_time"]: now_ms
        }
        if fields_cfg.get("recent_processed_time"):
            pre_update[fields_cfg["recent_processed_time"]] = now_ms
        update_bitable_record(bitable_token, record_id, pre_update)

        result = subprocess.run(cmd, capture_output=True, timeout=180,
                                encoding="utf-8", errors="replace")
        output = (result.stdout or "") + (result.stderr or "")
        log.info(f"[通过-后台] create_ones_task 输出:\n{output[:4000]}")

        if result.returncode != 0:
            raise RuntimeError(f"create_ones_task_ui.py 失败(returncode={result.returncode}): {output[:2000].strip()}")

        ones_url = ""
        issue_no = ""
        submitted = False
        link_pending = False
        parsed_json = None
        for line in output.splitlines():
            if not ones_url:
                m = re.search(r'https?://ones\.winnermedical\.com\S+', line)
                if m:
                    ones_url = m.group(0).strip('\",)')
            if not issue_no:
                m = re.search(r'issue_no=([^\s]+)', line)
                if m:
                    issue_no = m.group(1).lstrip('#')
            if parsed_json is None and line.strip().startswith('{') and 'submitted' in line:
                try:
                    parsed_json = json.loads(line.strip())
                except Exception:
                    pass

        if parsed_json:
            ones_url = parsed_json.get("ones_url") or ones_url
            issue_no = (parsed_json.get("issue_no") or issue_no or "").lstrip('#')
            submitted = bool(parsed_json.get("submitted"))
            link_pending = bool(parsed_json.get("link_pending"))
        else:
            submitted = bool(issue_no)
            link_pending = bool(issue_no) and not bool(ones_url)

        if not issue_no:
            raise RuntimeError(f"create_ones_task_ui.py 未拿到 ONES ID，当前不判定建单成功: {output[:800].strip()}")
        if not submitted:
            raise RuntimeError(f"create_ones_task_ui.py 未确认提交完成: {output[:500].strip()}")

        update_data = {
            fields_cfg["status"]: status_values.get("approved", "已提交ones"),
            fields_cfg["automation_status"]: auto_values.get("create_success_pending_link", "已提交ONES-待补链接") if link_pending else auto_values.get("create_success", "建单成功"),
            fields_cfg["approval_time"]: now_ms
        }
        if fields_cfg.get("recent_processed_time"):
            update_data[fields_cfg["recent_processed_time"]] = now_ms
        if ones_url and fields_cfg.get("ones_link"):
            update_data[fields_cfg["ones_link"]] = ones_url.strip()
        if issue_no and fields_cfg.get("ones_number"):
            update_data[fields_cfg["ones_number"]] = f"#{issue_no}"
        if fields_cfg.get("build_fail_reason"):
            update_data[fields_cfg["build_fail_reason"]] = "待补链接" if link_pending else ""
        update_bitable_record(bitable_token, record_id, update_data)

    except Exception as e:
        log.error(f"[通过-后台] 执行失败: {e}", exc_info=True)
        try:
            bitable_token = get_bitable_token()
            fields_cfg = CONFIG["feishu"]["fields"]
            auto_values = CONFIG["feishu"].get("automation_status_values", {})
            fail_update = {
                fields_cfg["automation_status"]: auto_values.get("create_failed", "建单失败")
            }
            fail_reason_field = fields_cfg.get("build_fail_reason")
            if fail_reason_field:
                fail_update[fail_reason_field] = str(e)[:500]
            if fields_cfg.get("recent_processed_time"):
                fail_update[fields_cfg["recent_processed_time"]] = int(datetime.datetime.now().timestamp() * 1000)
            update_bitable_record(bitable_token, record_id, fail_update)
        except Exception:
            pass


def handle_approve(value: dict) -> P2CardActionTriggerResponse:
    """通过：快速 ACK，后台执行 ONES 页面自动化建单"""
    record_id = value.get("record_id", "")
    title = value.get("req_title", "未命名需求")
    log.info(f"[通过] record={record_id} title={title} -> 后台执行")
    threading.Thread(target=_run_approve_job, args=(value,), daemon=True).start()
    return make_response(None, toast_text="已接收，正在后台创建 ONES 工单", toast_type="info")


def handle_reject(value: dict) -> P2CardActionTriggerResponse:
    """
    退回：理由已在原始卡片按钮 value 里，直接静默执行。
    不产生第二步回调，避免被妙搭/AI 拦截。
    """
    record_id    = value.get("record_id", "")
    title        = value.get("req_title", "未命名需求")
    submitter_id = value.get("submitter_id", "")
    reason       = value.get("reason", "").strip()

    if not reason:
        log.warning(f"[退回] reason 为空，record={record_id}")
        return make_response(None, toast_text="退回理由缺失，请重试", toast_type="error")

    log.info(f"[退回] record={record_id} reason={reason[:80]}")

    try:
        bitable_token = get_bitable_token()
        msg_token     = get_tenant_token()
        fields_cfg    = CONFIG["feishu"]["fields"]
        status_values = CONFIG["feishu"]["status_values"]

        # 更新飞书多维表状态（白泽 token 有权限）
        auto_values   = CONFIG["feishu"].get("automation_status_values", {})
        now_ms = int(datetime.datetime.now().timestamp() * 1000)
        reject_update = {
            fields_cfg["status"]: status_values.get("rejected", "退回需求"),
            fields_cfg["reject_reason"]: reason,
            fields_cfg["automation_status"]: auto_values.get("rejected", "审核退回"),
            fields_cfg["approval_time"]: now_ms
        }
        if fields_cfg.get("recent_processed_time"):
            reject_update[fields_cfg["recent_processed_time"]] = now_ms
        update_bitable_record(bitable_token, record_id, reject_update)

        # 通知提报人（原神 token 发消息）
        if submitter_id:
            send_text_message(msg_token, submitter_id,
                f"[需求退回通知]\n需求「{title}」已被退回。\n"
                f"退回理由：{reason}\n请修改后重新提报。",
                receive_id_type="open_id")

        log.info(f"[退回] 执行完成")
        return make_response(
            build_done_card(title, "rejected", reason),
            toast_text="退回成功"
        )

    except Exception as e:
        log.error(f"[退回] 执行失败: {e}", exc_info=True)
        return make_response(
            build_done_card(title, "rejected", f"[执行出错] {e}"),
            toast_text=f"退回失败: {e}", toast_type="error"
        )


def handle_skip(value: dict) -> P2CardActionTriggerResponse:
    record_id = value.get("record_id", "")
    title = value.get("req_title", "需求")
    log.info(f"[跳过] record={record_id} title={title}")
    try:
        bitable_token = get_bitable_token()
        fields_cfg = CONFIG["feishu"]["fields"]
        auto_values = CONFIG["feishu"].get("automation_status_values", {})
        now_ms = int(datetime.datetime.now().timestamp() * 1000)
        skip_update = {
            fields_cfg["automation_status"]: auto_values.get("skipped", "跳过处理")
        }
        if fields_cfg.get("recent_processed_time"):
            skip_update[fields_cfg["recent_processed_time"]] = now_ms
        update_bitable_record(bitable_token, record_id, skip_update)
        return make_response(build_done_card(title, "cancelled"), toast_text="已跳过")
    except Exception as e:
        log.error(f"[跳过] 执行失败: {e}", exc_info=True)
        return make_response(None, toast_text=f"跳过失败: {e}", toast_type="error")


def handle_cancel(value: dict) -> P2CardActionTriggerResponse:
    title = value.get("req_title", "需求")
    log.info(f"[取消] title={title}")
    return make_response(build_done_card(title, "cancelled"), toast_text="已取消")


# ─────────────────────── 事件处理器 ───────────────────────────

def do_card_action(data: P2CardActionTrigger) -> P2CardActionTriggerResponse:
    """处理卡片按钮点击 / 表单提交事件"""
    try:
        event = data.event
        if not event or not event.action:
            return make_response(None)

        action      = event.action
        value       = action.value or {}
        form_value  = getattr(action, "form_value", None) or {}
        action_type = value.get("action_type", "")

        log.info(f"卡片事件: action_type={action_type} record={value.get('record_id','?')} "
                 f"form_keys={list(form_value.keys()) if form_value else []}")

        if action_type == "req_approve":
            return handle_approve(value)
        elif action_type == "req_reject":
            return handle_reject(value)
        elif action_type == "req_skip":
            return handle_skip(value)
        elif action_type == "req_cancel":
            return handle_cancel(value)
        else:
            log.warning(f"未知 action_type: {action_type}")
            return make_response(None)

    except Exception as e:
        log.error(f"处理卡片事件异常: {e}", exc_info=True)
        return make_response(None, toast_text="处理出错，请重试", toast_type="error")


# ─────────────────────── 主入口 ───────────────────────────────

def main():
    log.info("=" * 50)
    log.info("启动飞书卡片事件监听服务 (v2-input flow)")
    log.info(f"App ID: {APP_ID}")
    log.info(f"日志文件: {HERE / 'card_handler.log'}")

    event_handler = (
        EventDispatcherHandler
        .builder("", "")
        .register_p2_card_action_trigger(do_card_action)
        .build()
    )

    ws_client = lark.ws.Client(
        APP_ID,
        APP_SECRET,
        event_handler=event_handler,
        log_level=lark.LogLevel.INFO,
    )

    log.info("WebSocket 已就绪，监听卡片交互事件...")
    ws_client.start()


if __name__ == "__main__":
    main()
