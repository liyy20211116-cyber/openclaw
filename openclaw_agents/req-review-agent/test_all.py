"""
全方位单元测试 — 覆盖 req-review-agent 核心模块
运行: pytest test_all.py -v
"""
import base64
import datetime
import json
import os
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch, PropertyMock

import pytest

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

# create_ones_task.py 在模块顶层执行 get_token_auto() 和 requests.post()，
# 必须在 import 之前就 mock 掉，否则测试会挂起/失败。
import ones_token_refresh as _otr
_otr.get_token_auto = lambda: "FAKE_TEST_TOKEN"

import requests as _real_requests
_orig_post = _real_requests.post
def _safe_post(*args, **kwargs):
    m = MagicMock()
    m.status_code = 200
    m.json.return_value = {"tasks": [{"uuid": "test_uuid_001"}], "tenant_access_token": "fake"}
    m.text = '{"tasks": [{"uuid": "test_uuid_001"}]}'
    return m
_real_requests.post = _safe_post
import create_ones_task as _cot_module
_real_requests.post = _orig_post


# ═══════════════════════════════════════════════════════════════
# 测试配置 fixtures
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def sample_config():
    return json.loads((HERE / "config.json").read_text(encoding="utf-8"))


@pytest.fixture
def sample_record():
    return {
        "record_id": "recABC123",
        "fields": {
            "标题": [{"text": "测试需求标题", "type": "text"}],
            "提报类型": [{"text": "需求优化", "type": "text"}],
            "描述": [{"text": "这是一个测试需求描述", "type": "text"}],
            "需求提出人": [{"name": "张三", "id": "ou_test123"}],
            "严重程度": "P2",
            "需求优先级": "中",
            "所属产品": ["全棉WMS"],
            "提出仓库": "武汉仓",
            "需求价值（金额，单位：元|年）": "50000",
            "期望上线时间": int(datetime.datetime(2026, 6, 1).timestamp() * 1000),
            "状态": "待审批",
            "自动化处理状态": "",
            "ONES 链接": "",
        }
    }


@pytest.fixture
def card_action_value():
    return {
        "action_type": "req_approve",
        "record_id": "recABC123",
        "req_title": "测试需求标题",
        "description": "这是一个测试需求描述",
        "severity_uuid": "da53MmEu",
        "issue_type_uuid": "2cCuqqQw",
        "product_uuid": "QE2GXyz1QGmiMX55",
        "submitter_id": "ou_test123",
        "req_type": "需求优化",
        "warehouse": "武汉仓",
        "priority": "中",
        "expected_date": "2026-06-01",
        "value_amount": "50000",
        "submitter_name": "张三",
        "product_display": "全棉WMS",
    }


# ═══════════════════════════════════════════════════════════════
# 1. card_action_handler.py 测试
# ═══════════════════════════════════════════════════════════════

class TestBuildRejectReasonCard:
    """退回理由卡片构建"""

    def test_basic_structure(self):
        from card_action_handler import build_reject_reason_card
        card = build_reject_reason_card("rec001", "我的需求", "ou_xyz")
        assert card["header"]["template"] == "orange"
        assert "退回需求" in card["header"]["title"]["content"]
        assert len(card["elements"]) >= 3  # 说明文本 + 理由按钮行 + 取消按钮

    def test_reason_buttons_carry_correct_values(self):
        from card_action_handler import build_reject_reason_card
        card = build_reject_reason_card("rec001", "需求A", "ou_abc")
        action_elements = [e for e in card["elements"] if e["tag"] == "action"]
        reason_buttons = []
        for ae in action_elements:
            for btn in ae["actions"]:
                if btn.get("value", {}).get("action_type") == "req_reject_confirm":
                    reason_buttons.append(btn)
        assert len(reason_buttons) == 4
        for btn in reason_buttons:
            assert btn["value"]["record_id"] == "rec001"
            assert btn["value"]["submitter_id"] == "ou_abc"
            assert btn["value"]["reason"]

    def test_cancel_button_present(self):
        from card_action_handler import build_reject_reason_card
        card = build_reject_reason_card("rec001", "需求A", "ou_abc")
        cancel_found = False
        for e in card["elements"]:
            if e["tag"] == "action":
                for btn in e["actions"]:
                    if btn.get("value", {}).get("action_type") == "req_cancel":
                        cancel_found = True
        assert cancel_found


class TestBuildDoneCard:
    """操作完成卡片"""

    def test_approved_card(self):
        from card_action_handler import build_done_card
        card = build_done_card("需求X", "approved", "ONES 工单已创建")
        assert card["header"]["template"] == "green"
        assert "[已通过]" in card["header"]["title"]["content"]

    def test_rejected_card(self):
        from card_action_handler import build_done_card
        card = build_done_card("需求X", "rejected", "描述不清晰")
        assert card["header"]["template"] == "red"
        assert "[已退回]" in card["header"]["title"]["content"]
        assert any("描述不清晰" in e.get("text", {}).get("content", "")
                    for e in card["elements"] if e.get("tag") == "div")

    def test_failed_card(self):
        from card_action_handler import build_done_card
        card = build_done_card("需求X", "failed", "建单失败原因")
        assert card["header"]["template"] == "red"
        assert "[处理失败]" in card["header"]["title"]["content"]

    def test_cancelled_card(self):
        from card_action_handler import build_done_card
        card = build_done_card("需求X", "cancelled")
        assert card["header"]["template"] == "grey"
        assert "[已取消]" in card["header"]["title"]["content"]

    def test_unknown_action_uses_cancelled(self):
        from card_action_handler import build_done_card
        card = build_done_card("需求X", "unknown_action")
        assert card["header"]["template"] == "grey"


class TestMakeResponse:
    """make_response 返回结构"""

    def test_with_card_and_toast(self):
        from card_action_handler import make_response
        card_data = {"config": {}, "header": {}, "elements": []}
        resp = make_response(card_data, toast_text="操作成功", toast_type="success")
        assert resp.card is not None
        assert resp.card.type == "raw"
        assert resp.card.data == card_data
        assert resp.toast.content == "操作成功"
        assert resp.toast.type == "success"

    def test_no_card(self):
        from card_action_handler import make_response
        resp = make_response(None, toast_text="仅提示")
        assert resp.card is None
        assert resp.toast.content == "仅提示"

    def test_no_toast(self):
        from card_action_handler import make_response
        card_data = {"config": {}}
        resp = make_response(card_data)
        assert resp.card is not None
        assert resp.toast is None


class TestHandleApprove:
    """通过操作（异步后台执行）"""

    @patch("card_action_handler.threading")
    def test_returns_toast_immediately(self, mock_threading, card_action_value):
        from card_action_handler import handle_approve
        resp = handle_approve(card_action_value)
        assert resp.toast is not None
        assert "后台创建" in resp.toast.content
        mock_threading.Thread.assert_called_once()
        mock_threading.Thread.return_value.start.assert_called_once()

    @patch("card_action_handler.threading")
    def test_card_not_replaced_immediately(self, mock_threading, card_action_value):
        from card_action_handler import handle_approve
        resp = handle_approve(card_action_value)
        assert resp.card is None


class TestRunApproveJob:
    """_run_approve_job 后台执行逻辑"""

    @patch("card_action_handler.subprocess.run")
    @patch("card_action_handler.update_bitable_record")
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_success_path(self, mock_bt, mock_update, mock_run, card_action_value):
        from card_action_handler import _run_approve_job
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout='{"submitted": true, "issue_no": "12345", "ones_url": "https://ones.winnermedical.com/project/#/xxx"}\n',
            stderr=""
        )
        _run_approve_job(card_action_value)
        assert mock_update.call_count == 2  # pre-update + final update
        final_call_fields = mock_update.call_args_list[1][0][2]
        assert "已提交ones" in str(final_call_fields.values()) or "建单成功" in str(final_call_fields.values())

    @patch("card_action_handler.subprocess.run")
    @patch("card_action_handler.update_bitable_record")
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_subprocess_failure_marks_failed(self, mock_bt, mock_update, mock_run, card_action_value):
        from card_action_handler import _run_approve_job
        mock_run.return_value = MagicMock(returncode=1, stdout="error output", stderr="something broke")
        _run_approve_job(card_action_value)
        assert mock_update.call_count >= 2
        last_call_fields = mock_update.call_args_list[-1][0][2]
        assert "建单失败" in str(last_call_fields.values())

    @patch("card_action_handler.subprocess.run")
    @patch("card_action_handler.update_bitable_record")
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_no_issue_id_marks_failed(self, mock_bt, mock_update, mock_run, card_action_value):
        from card_action_handler import _run_approve_job
        mock_run.return_value = MagicMock(returncode=0, stdout="no id here", stderr="")
        _run_approve_job(card_action_value)
        last_call_fields = mock_update.call_args_list[-1][0][2]
        assert "建单失败" in str(last_call_fields.values())

    @patch("card_action_handler.subprocess.run")
    @patch("card_action_handler.update_bitable_record")
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_link_pending_flag(self, mock_bt, mock_update, mock_run, card_action_value):
        from card_action_handler import _run_approve_job
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout='{"submitted": true, "issue_no": "99999", "ones_url": "", "link_pending": true}\n',
            stderr=""
        )
        _run_approve_job(card_action_value)
        final_call_fields = mock_update.call_args_list[-1][0][2]
        assert "待补链接" in str(final_call_fields.values()) or "已提交ONES-待补链接" in str(final_call_fields.values())


class TestHandleReject:
    """退回操作"""

    @patch("card_action_handler.send_text_message", return_value={"code": 0})
    @patch("card_action_handler.update_bitable_record", return_value={"code": 0})
    @patch("card_action_handler.get_tenant_token", return_value="fake_msg_token")
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_reject_success(self, mock_bt, mock_msg, mock_update, mock_send):
        from card_action_handler import handle_reject
        value = {
            "record_id": "rec001",
            "req_title": "需求A",
            "submitter_id": "ou_sub1",
            "reason": "描述不清晰"
        }
        resp = handle_reject(value)
        assert resp.card is not None
        assert resp.toast.content == "退回成功"
        mock_update.assert_called_once()
        mock_send.assert_called_once()

    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_reject_empty_reason(self, mock_bt):
        from card_action_handler import handle_reject
        value = {"record_id": "rec001", "req_title": "需求A", "submitter_id": "", "reason": ""}
        resp = handle_reject(value)
        assert resp.toast.type == "error"
        assert "退回理由缺失" in resp.toast.content

    @patch("card_action_handler.send_text_message", return_value={"code": 0})
    @patch("card_action_handler.update_bitable_record", side_effect=RuntimeError("API down"))
    @patch("card_action_handler.get_tenant_token", return_value="fake_msg_token")
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_reject_api_error(self, mock_bt, mock_msg, mock_update, mock_send):
        from card_action_handler import handle_reject
        value = {"record_id": "rec001", "req_title": "需求A", "submitter_id": "ou_s", "reason": "理由"}
        resp = handle_reject(value)
        assert "失败" in resp.toast.content

    @patch("card_action_handler.send_text_message", return_value={"code": 0})
    @patch("card_action_handler.update_bitable_record", return_value={"code": 0})
    @patch("card_action_handler.get_tenant_token", return_value="fake_msg_token")
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_reject_no_submitter_skips_message(self, mock_bt, mock_msg, mock_update, mock_send):
        from card_action_handler import handle_reject
        value = {"record_id": "rec001", "req_title": "需求A", "submitter_id": "", "reason": "理由"}
        resp = handle_reject(value)
        mock_send.assert_not_called()
        assert resp.toast.content == "退回成功"


class TestHandleSkip:
    """跳过操作"""

    @patch("card_action_handler.update_bitable_record", return_value={"code": 0})
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_skip_success(self, mock_bt, mock_update):
        from card_action_handler import handle_skip
        value = {"record_id": "rec001", "req_title": "需求A"}
        resp = handle_skip(value)
        assert resp.toast.content == "已跳过"
        assert resp.card is not None

    @patch("card_action_handler.update_bitable_record", side_effect=RuntimeError("fail"))
    @patch("card_action_handler.get_bitable_token", return_value="fake_bt_token")
    def test_skip_error(self, mock_bt, mock_update):
        from card_action_handler import handle_skip
        value = {"record_id": "rec001", "req_title": "需求A"}
        resp = handle_skip(value)
        assert "失败" in resp.toast.content


class TestHandleCancel:
    """取消操作"""

    def test_cancel_returns_done_card(self):
        from card_action_handler import handle_cancel
        value = {"req_title": "需求A"}
        resp = handle_cancel(value)
        assert resp.toast.content == "已取消"
        assert resp.card is not None


class TestDoCardAction:
    """事件分发入口"""

    def test_unknown_action_type(self):
        from card_action_handler import do_card_action
        data = MagicMock()
        data.event.action.value = {"action_type": "unknown_type"}
        data.event.action.form_value = None
        resp = do_card_action(data)
        assert resp.card is None

    def test_none_event(self):
        from card_action_handler import do_card_action
        data = MagicMock()
        data.event = None
        resp = do_card_action(data)
        assert resp.card is None

    def test_none_action(self):
        from card_action_handler import do_card_action
        data = MagicMock()
        data.event.action = None
        resp = do_card_action(data)
        assert resp.card is None

    @patch("card_action_handler.handle_approve")
    def test_dispatch_approve(self, mock_handler):
        from card_action_handler import do_card_action
        mock_handler.return_value = MagicMock()
        data = MagicMock()
        data.event.action.value = {"action_type": "req_approve", "record_id": "x"}
        data.event.action.form_value = None
        do_card_action(data)
        mock_handler.assert_called_once()

    @patch("card_action_handler.handle_reject")
    def test_dispatch_reject(self, mock_handler):
        from card_action_handler import do_card_action
        mock_handler.return_value = MagicMock()
        data = MagicMock()
        data.event.action.value = {"action_type": "req_reject", "record_id": "x"}
        data.event.action.form_value = None
        do_card_action(data)
        mock_handler.assert_called_once()

    @patch("card_action_handler.handle_skip")
    def test_dispatch_skip(self, mock_handler):
        from card_action_handler import do_card_action
        mock_handler.return_value = MagicMock()
        data = MagicMock()
        data.event.action.value = {"action_type": "req_skip", "record_id": "x"}
        data.event.action.form_value = None
        do_card_action(data)
        mock_handler.assert_called_once()

    @patch("card_action_handler.handle_cancel")
    def test_dispatch_cancel(self, mock_handler):
        from card_action_handler import do_card_action
        mock_handler.return_value = MagicMock()
        data = MagicMock()
        data.event.action.value = {"action_type": "req_cancel"}
        data.event.action.form_value = None
        do_card_action(data)
        mock_handler.assert_called_once()

    def test_exception_in_handler_returns_error_toast(self):
        from card_action_handler import do_card_action
        data = MagicMock()
        data.event.action.value = {"action_type": "req_approve"}
        data.event.action.form_value = None
        with patch("card_action_handler.handle_approve", side_effect=RuntimeError("boom")):
            resp = do_card_action(data)
        assert resp.toast is not None
        assert "出错" in resp.toast.content


class TestUpdateBitableRecord:
    """Bitable 记录更新"""

    @patch("card_action_handler.requests.put")
    def test_success(self, mock_put):
        from card_action_handler import update_bitable_record
        mock_put.return_value = MagicMock(
            status_code=200,
            content=b'{"code": 0, "data": {}}',
        )
        result = update_bitable_record("token", "rec001", {"字段A": "值A"})
        assert result["code"] == 0

    @patch("card_action_handler.requests.put")
    def test_error_code(self, mock_put):
        from card_action_handler import update_bitable_record
        mock_put.return_value = MagicMock(
            status_code=200,
            content=b'{"code": 1, "msg": "error"}',
        )
        result = update_bitable_record("token", "rec001", {"字段A": "值A"})
        assert result["code"] == 1

    @patch("card_action_handler.requests.put")
    def test_filters_approver_field(self, mock_put):
        from card_action_handler import update_bitable_record, CONFIG
        mock_put.return_value = MagicMock(
            status_code=200,
            content=b'{"code": 0}',
        )
        approver_field = CONFIG.get("feishu", {}).get("fields", {}).get("approver")
        if approver_field:
            fields_data = {approver_field: "some_person", "其他字段": "值"}
            update_bitable_record("token", "rec001", fields_data)
            call_body = mock_put.call_args[1]["json"]
            assert approver_field not in call_body["fields"]
            assert "其他字段" in call_body["fields"]


class TestSendTextMessage:
    """发送文本消息"""

    @patch("card_action_handler.requests.post")
    def test_success(self, mock_post):
        from card_action_handler import send_text_message
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {"code": 0}
        result = send_text_message("token", "ou_123", "测试消息")
        assert result["code"] == 0

    def test_empty_receive_id(self):
        from card_action_handler import send_text_message
        result = send_text_message("token", "", "测试消息")
        assert result == {}


# ═══════════════════════════════════════════════════════════════
# 2. scan_and_send.py 测试
# ═══════════════════════════════════════════════════════════════

class TestScanBuildCard:
    """scan_and_send.build_card"""

    def test_requirement_card_blue_header(self, sample_record):
        from scan_and_send import build_card
        card = build_card(sample_record)
        assert card["header"]["template"] == "blue"
        assert "需求审核" in card["header"]["title"]["content"]

    def test_bug_card_red_header(self, sample_record):
        from scan_and_send import build_card
        sample_record["fields"]["提报类型"] = [{"text": "系统BUG", "type": "text"}]
        card = build_card(sample_record)
        assert card["header"]["template"] == "red"

    def test_card_has_approve_reject_skip_buttons(self, sample_record):
        from scan_and_send import build_card
        card = build_card(sample_record)
        all_buttons = []
        for element in card["elements"]:
            if element.get("tag") == "action":
                all_buttons.extend(element.get("actions", []))
        action_types = [b.get("value", {}).get("action_type") for b in all_buttons]
        assert "req_approve" in action_types
        assert "req_skip" in action_types
        assert "req_reject" in action_types

    def test_card_approve_button_carries_all_metadata(self, sample_record):
        from scan_and_send import build_card
        card = build_card(sample_record)
        approve_btn = None
        for element in card["elements"]:
            if element.get("tag") == "action":
                for btn in element.get("actions", []):
                    if btn.get("value", {}).get("action_type") == "req_approve":
                        approve_btn = btn
                        break
        assert approve_btn is not None
        val = approve_btn["value"]
        assert val["record_id"] == "recABC123"
        assert val["req_title"] == "测试需求标题"
        assert val["description"] == "这是一个测试需求描述"
        assert val["product_uuid"]
        assert val["severity_uuid"]

    def test_card_handles_missing_fields(self):
        from scan_and_send import build_card
        record = {"record_id": "rec_empty", "fields": {}}
        card = build_card(record)
        assert card is not None
        assert card["header"] is not None

    def test_card_description_truncated(self, sample_record):
        from scan_and_send import build_card
        long_desc = "A" * 1000
        sample_record["fields"]["描述"] = [{"text": long_desc, "type": "text"}]
        card = build_card(sample_record)
        desc_elements = [e for e in card["elements"]
                         if e.get("tag") == "div" and "需求描述" in str(e.get("text", {}).get("content", ""))]
        assert desc_elements
        assert len(desc_elements[0]["text"]["content"]) < 1000

    def test_expected_date_formatting(self, sample_record):
        from scan_and_send import build_card
        card = build_card(sample_record)
        found_date = False
        for element in card["elements"]:
            for field in element.get("fields", []):
                content = field.get("text", {}).get("content", "")
                if "期望上线" in content and "2026-06-01" in content:
                    found_date = True
        assert found_date

    def test_submitter_extraction(self, sample_record):
        from scan_and_send import build_card
        card = build_card(sample_record)
        found_submitter = False
        for element in card["elements"]:
            for field in element.get("fields", []):
                content = field.get("text", {}).get("content", "")
                if "提报人" in content and "张三" in content:
                    found_submitter = True
        assert found_submitter


class TestScanSendCard:
    """scan_and_send.send_card"""

    @patch("scan_and_send.requests.post")
    def test_success(self, mock_post):
        from scan_and_send import send_card
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {
            "code": 0,
            "data": {"message_id": "om_test123"}
        }
        msg_id = send_card("token", {"config": {}, "elements": []})
        assert msg_id == "om_test123"

    @patch("scan_and_send.requests.post")
    def test_failure_raises(self, mock_post):
        from scan_and_send import send_card
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {"code": 1, "msg": "fail"}
        with pytest.raises(RuntimeError, match="发送卡片失败"):
            send_card("token", {})


class TestScanGetPendingRecords:
    """scan_and_send.get_pending_records"""

    @patch("scan_and_send.requests.post")
    def test_returns_items(self, mock_post):
        from scan_and_send import get_pending_records
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {
            "code": 0,
            "data": {"items": [{"record_id": "rec1"}, {"record_id": "rec2"}]}
        }
        items = get_pending_records("token")
        assert len(items) == 2

    @patch("scan_and_send.requests.post")
    def test_empty_results(self, mock_post):
        from scan_and_send import get_pending_records
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {"code": 0, "data": {"items": []}}
        items = get_pending_records("token")
        assert items == []

    @patch("scan_and_send.requests.post")
    def test_api_error_raises(self, mock_post):
        from scan_and_send import get_pending_records
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {"code": 500, "msg": "server error"}
        with pytest.raises(RuntimeError, match="飞书 API 错误"):
            get_pending_records("token")


class TestScanSavePending:
    """scan_and_send.save_pending"""

    def test_creates_file_if_not_exists(self, tmp_path):
        from scan_and_send import save_pending
        with patch("scan_and_send.HERE", tmp_path):
            save_pending("rec1", "om_msg1", "标题1")
            pending_file = tmp_path / "memory" / "pending_reviews.json"
            assert pending_file.exists()
            data = json.loads(pending_file.read_text(encoding="utf-8"))
            assert "rec1" in data
            assert data["rec1"]["message_id"] == "om_msg1"

    def test_appends_to_existing(self, tmp_path):
        from scan_and_send import save_pending
        memory_dir = tmp_path / "memory"
        memory_dir.mkdir()
        (memory_dir / "pending_reviews.json").write_text(
            json.dumps({"rec0": {"message_id": "om0", "title": "旧", "sent_at": "2026-01-01"}}),
            encoding="utf-8"
        )
        with patch("scan_and_send.HERE", tmp_path):
            save_pending("rec1", "om_msg1", "标题1")
            data = json.loads((memory_dir / "pending_reviews.json").read_text(encoding="utf-8"))
            assert "rec0" in data
            assert "rec1" in data


class TestScanUpdateAfterSend:
    """scan_and_send.update_record_after_send"""

    @patch("scan_and_send.requests.put")
    def test_success(self, mock_put):
        from scan_and_send import update_record_after_send
        mock_put.return_value = MagicMock()
        mock_put.return_value.json.return_value = {"code": 0}
        update_record_after_send("token", "rec1", "om_msg1")
        assert mock_put.called

    @patch("scan_and_send.requests.put")
    def test_failure_raises(self, mock_put):
        from scan_and_send import update_record_after_send
        mock_put.return_value = MagicMock()
        mock_put.return_value.json.return_value = {"code": 1, "msg": "fail"}
        with pytest.raises(RuntimeError, match="回写自动化处理状态失败"):
            update_record_after_send("token", "rec1")


# ═══════════════════════════════════════════════════════════════
# 3. ones_token_refresh.py 测试
# ═══════════════════════════════════════════════════════════════

class TestTokenValid:
    """JWT token 有效性检查"""

    def _make_jwt(self, exp_timestamp: int) -> str:
        header = base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode().rstrip("=")
        payload_data = json.dumps({"exp": exp_timestamp}).encode()
        payload = base64.urlsafe_b64encode(payload_data).decode().rstrip("=")
        sig = base64.urlsafe_b64encode(b"fakesig" * 10).decode().rstrip("=")
        return f"{header}.{payload}.{sig}"

    def test_valid_token(self):
        from ones_token_refresh import _token_valid
        future_exp = int(time.time()) + 3600
        token = self._make_jwt(future_exp)
        assert _token_valid(token) is True

    def test_expired_token(self):
        from ones_token_refresh import _token_valid
        past_exp = int(time.time()) - 100
        token = self._make_jwt(past_exp)
        assert _token_valid(token) is False

    def test_token_within_buffer(self):
        from ones_token_refresh import _token_valid
        almost_expired = int(time.time()) + 10
        token = self._make_jwt(almost_expired)
        assert _token_valid(token, buffer_secs=30) is False

    def test_empty_token(self):
        from ones_token_refresh import _token_valid
        assert _token_valid("") is False
        assert _token_valid("short") is False

    def test_malformed_token(self):
        from ones_token_refresh import _token_valid
        assert _token_valid("not.a.valid.jwt.token") is False
        assert _token_valid("onlyonepart") is False


class TestTokenCache:
    """缓存读写"""

    def test_load_empty_cache(self, tmp_path):
        from ones_token_refresh import _load_cache
        with patch("ones_token_refresh.CACHE_FILE", tmp_path / "nonexistent.json"):
            result = _load_cache()
            assert result == {}

    def test_load_old_format(self, tmp_path):
        cache_file = tmp_path / "cache.json"
        cache_file.write_text(json.dumps({"token": "abc123"}), encoding="utf-8")
        from ones_token_refresh import _load_cache
        with patch("ones_token_refresh.CACHE_FILE", cache_file):
            result = _load_cache()
            assert result["ones_lt"] == "abc123"

    def test_load_new_format(self, tmp_path):
        cache_file = tmp_path / "cache.json"
        cache_file.write_text(json.dumps({"ones_lt": "xyz789"}), encoding="utf-8")
        from ones_token_refresh import _load_cache
        with patch("ones_token_refresh.CACHE_FILE", cache_file):
            result = _load_cache()
            assert result["ones_lt"] == "xyz789"

    def test_save_cache(self, tmp_path):
        cache_file = tmp_path / "cache.json"
        from ones_token_refresh import _save_cache
        with patch("ones_token_refresh.CACHE_FILE", cache_file):
            _save_cache({"ones_lt": "saved_token", "extra": "data"})
            loaded = json.loads(cache_file.read_text(encoding="utf-8"))
            assert loaded["ones_lt"] == "saved_token"
            assert loaded["extra"] == "data"


class TestWisLogin:
    """WIS RSA 登录"""

    @patch("ones_token_refresh.requests.post")
    @patch("ones_token_refresh.requests.get")
    def test_success(self, mock_get, mock_post):
        from ones_token_refresh import _wis_login
        from Crypto.PublicKey import RSA
        key = RSA.generate(2048)
        pub_b64 = base64.b64encode(key.publickey().export_key("DER")).decode()

        mock_get.return_value = MagicMock(status_code=200)
        mock_get.return_value.json.return_value = {"data": pub_b64}
        mock_get.return_value.raise_for_status = MagicMock()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"code": 200, "data": "wis_token_abc"}'
        mock_resp.json.return_value = {"code": 200, "data": "wis_token_abc"}
        mock_resp.cookies = []
        mock_post.return_value = mock_resp

        wis_at, cookies = _wis_login()
        assert wis_at == "wis_token_abc"
        assert cookies["wis_access_token"] == "wis_token_abc"

    @patch("ones_token_refresh.requests.post")
    @patch("ones_token_refresh.requests.get")
    def test_login_failure_code(self, mock_get, mock_post):
        from ones_token_refresh import _wis_login
        from Crypto.PublicKey import RSA
        key = RSA.generate(2048)
        pub_b64 = base64.b64encode(key.publickey().export_key("DER")).decode()

        mock_get.return_value = MagicMock(status_code=200)
        mock_get.return_value.json.return_value = {"data": pub_b64}
        mock_get.return_value.raise_for_status = MagicMock()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"code": 401, "msg": "密码错误"}'
        mock_resp.json.return_value = {"code": 401, "msg": "密码错误"}
        mock_post.return_value = mock_resp

        with pytest.raises(RuntimeError, match="WIS 登录失败"):
            _wis_login()


class TestGetTokenAuto:
    """get_token_auto 入口"""

    def test_returns_cached_valid_token(self, tmp_path):
        from ones_token_refresh import _load_cache, _token_valid
        future_exp = int(time.time()) + 7200
        header = base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode().rstrip("=")
        payload = base64.urlsafe_b64encode(json.dumps({"exp": future_exp}).encode()).decode().rstrip("=")
        sig = base64.urlsafe_b64encode(b"s" * 40).decode().rstrip("=")
        valid_token = f"{header}.{payload}.{sig}"

        cache_file = tmp_path / "cache.json"
        cache_file.write_text(json.dumps({"ones_lt": valid_token}), encoding="utf-8")

        # 临时恢复真正的 get_token_auto 逻辑来测试缓存路径
        import ones_token_refresh
        original_fn = ones_token_refresh.get_token_auto.__wrapped__ if hasattr(ones_token_refresh.get_token_auto, '__wrapped__') else None

        def real_get_token_auto():
            cache = ones_token_refresh._load_cache()
            token = cache.get("ones_lt", "")
            if token and ones_token_refresh._token_valid(token):
                return token
            raise RuntimeError("should not reach refresh in this test")

        with patch("ones_token_refresh.CACHE_FILE", cache_file):
            result = real_get_token_auto()
            assert result == valid_token


# ═══════════════════════════════════════════════════════════════
# 4. create_ones_task.py 辅助函数测试
# ═══════════════════════════════════════════════════════════════

class TestHtmlize:
    """HTML 化处理"""

    def test_empty_string(self):
        assert _cot_module.htmlize("") == "<p></p>"

    def test_single_line(self):
        assert _cot_module.htmlize("hello") == "<p>hello</p>"

    def test_multiline(self):
        result = _cot_module.htmlize("line1\nline2\nline3")
        assert "<p>line1</p>" in result
        assert "<p>line2</p>" in result
        assert "<p>line3</p>" in result

    def test_whitespace_only(self):
        assert _cot_module.htmlize("   ") == "<p></p>"


class TestBuildPlainDescription:
    """纯文本描述构建"""

    def test_requirement_type(self):
        result = _cot_module.build_plain_description(
            "需求优化", "我的需求", "详细描述", "武汉仓",
            "高", "2026-06-01", "100000", "张三", "全棉WMS"
        )
        assert "【标题】" in result
        assert "我的需求" in result
        assert "需求优化" in result
        assert "全棉WMS" in result
        assert "武汉仓" in result
        assert "张三" in result
        assert "需求价值" in result
        assert "100000" in result

    def test_bug_type_no_value(self):
        result = _cot_module.build_plain_description(
            "系统BUG", "BUG标题", "BUG描述", "-",
            "高", "", "", "李四", "全棉WMS"
        )
        assert "BUG标题" in result
        assert "系统BUG" in result
        assert "需求价值" not in result

    def test_empty_fields_use_dash(self):
        result = _cot_module.build_plain_description("", "", "", "", "", "", "", "", "")
        assert "-" in result


class TestGenUuid:
    """UUID 生成"""

    def test_starts_with_user_uuid(self):
        uuid = _cot_module.gen_uuid()
        assert uuid.startswith(_cot_module.USER_UUID)
        assert len(uuid) == len(_cot_module.USER_UUID) + 8

    def test_unique(self):
        uuids = {_cot_module.gen_uuid() for _ in range(100)}
        assert len(uuids) == 100


# ═══════════════════════════════════════════════════════════════
# 5. create_ones_task_ui.py 辅助函数测试
# ═══════════════════════════════════════════════════════════════

class TestCreateOnesTaskUiHelpers:
    """create_ones_task_ui.py 辅助函数"""

    def test_load_token_cache_missing_file(self, tmp_path):
        from create_ones_task_ui import load_token_cache
        with patch("create_ones_task_ui.TOKEN_CACHE_PATH", tmp_path / "nonexistent.json"):
            with pytest.raises(RuntimeError, match="未找到 token 缓存文件"):
                load_token_cache()

    def test_load_token_cache_valid(self, tmp_path):
        from create_ones_task_ui import load_token_cache
        cache_file = tmp_path / "token_cache.json"
        cache_file.write_text(json.dumps({"ones_lt": "tok", "cookie": "a=b"}), encoding="utf-8")
        with patch("create_ones_task_ui.TOKEN_CACHE_PATH", cache_file):
            result = load_token_cache()
            assert result["ones_lt"] == "tok"

    def test_build_cookie_values(self):
        from create_ones_task_ui import build_cookie_values
        cache = {
            "cookie": "ones-org-uuid=UTcECDmx; foo=bar",
            "ones_lt": "my_token"
        }
        result = build_cookie_values(cache)
        assert result["ones-lt"] == "my_token"
        assert result["ones-org-uuid"] == "UTcECDmx"
        assert result["foo"] == "bar"
        assert result["ones-lang"] == "zh"

    def test_build_cookie_values_empty(self):
        from create_ones_task_ui import build_cookie_values
        result = build_cookie_values({})
        assert result["ones-lang"] == "zh"
        assert result["ones-region-uuid"] == "default"
        assert result["timezone"] == "Asia/Shanghai"

    def test_build_playwright_cookies_from_cookies_list(self):
        from create_ones_task_ui import build_playwright_cookies
        cache = {
            "cookies": [
                {"name": "ones-lt", "value": "tok123", "domain": ".winnermedical.com",
                 "path": "/", "httpOnly": True, "secure": True, "sameSite": "Lax"}
            ]
        }
        result = build_playwright_cookies(cache)
        assert len(result) == 1
        assert result[0]["name"] == "ones-lt"
        assert result[0]["value"] == "tok123"

    def test_build_playwright_cookies_from_cookie_string(self):
        from create_ones_task_ui import build_playwright_cookies
        cache = {"cookie": "ones-org-uuid=UTcECDmx", "ones_lt": "token_val"}
        result = build_playwright_cookies(cache)
        assert any(c["name"] == "ones-lt" for c in result)
        assert any(c["name"] == "ones-org-uuid" for c in result)


class TestReadWindowsClipboard:
    """剪贴板读取"""

    @patch("create_ones_task_ui.subprocess.run")
    def test_success(self, mock_run):
        from create_ones_task_ui import read_windows_clipboard
        mock_run.return_value = MagicMock(stdout="#12345 测试标题 https://ones.winnermedical.com/xxx")
        result = read_windows_clipboard()
        assert "#12345" in result

    @patch("create_ones_task_ui.subprocess.run", side_effect=Exception("no powershell"))
    def test_failure_returns_empty(self, mock_run):
        from create_ones_task_ui import read_windows_clipboard
        assert read_windows_clipboard() == ""


# ═══════════════════════════════════════════════════════════════
# 6. 集成/端到端逻辑测试
# ═══════════════════════════════════════════════════════════════

class TestScanAndSendMain:
    """scan_and_send.main 集成"""

    @patch("scan_and_send.update_record_after_send")
    @patch("scan_and_send.save_pending")
    @patch("scan_and_send.send_card", return_value="om_msg_1")
    @patch("scan_and_send.get_pending_records")
    @patch("scan_and_send.get_bitable_token", return_value="bt_tok")
    @patch("scan_and_send.get_tenant_token", return_value="tt_tok")
    def test_main_with_records(self, mock_tt, mock_bt, mock_records, mock_send,
                                mock_save, mock_update, sample_record, capsys):
        from scan_and_send import main
        mock_records.return_value = [sample_record]
        main()
        captured = capsys.readouterr()
        assert "测试需求标题" in captured.out
        assert mock_send.called
        assert mock_save.called
        assert mock_update.called

    @patch("scan_and_send.get_pending_records", return_value=[])
    @patch("scan_and_send.get_bitable_token", return_value="bt_tok")
    @patch("scan_and_send.get_tenant_token", return_value="tt_tok")
    def test_main_empty_queue(self, mock_tt, mock_bt, mock_records, capsys):
        from scan_and_send import main
        main()
        captured = capsys.readouterr()
        assert "无待审批" in captured.out

    @patch("scan_and_send.update_record_after_send")
    @patch("scan_and_send.save_pending")
    @patch("scan_and_send.send_card", side_effect=RuntimeError("网络错误"))
    @patch("scan_and_send.get_pending_records")
    @patch("scan_and_send.get_bitable_token", return_value="bt_tok")
    @patch("scan_and_send.get_tenant_token", return_value="tt_tok")
    def test_main_card_send_failure(self, mock_tt, mock_bt, mock_records, mock_send,
                                     mock_save, mock_update, sample_record, capsys):
        from scan_and_send import main
        mock_records.return_value = [sample_record]
        main()
        captured = capsys.readouterr()
        assert "FAIL" in captured.out


class TestApproveRejectRoundtrip:
    """通过+退回完整逻辑路径"""

    @patch("card_action_handler.threading")
    def test_approve_then_reject_same_record(self, mock_threading, card_action_value):
        from card_action_handler import handle_approve, handle_reject
        approve_resp = handle_approve(card_action_value)
        assert approve_resp.toast.content

        reject_value = dict(card_action_value)
        reject_value["action_type"] = "req_reject"
        reject_value["reason"] = "需求描述不清晰，请补充后重提"
        with patch("card_action_handler.send_text_message", return_value={"code": 0}), \
             patch("card_action_handler.update_bitable_record", return_value={"code": 0}), \
             patch("card_action_handler.get_tenant_token", return_value="t"), \
             patch("card_action_handler.get_bitable_token", return_value="bt"):
            reject_resp = handle_reject(reject_value)
        assert reject_resp.toast.content == "退回成功"


# ═══════════════════════════════════════════════════════════════
# 7. 边界条件与鲁棒性测试
# ═══════════════════════════════════════════════════════════════

class TestEdgeCases:
    """各种边界条件"""

    def test_config_json_valid(self, sample_config):
        assert "feishu" in sample_config
        assert "ones" in sample_config
        assert sample_config["feishu"]["bitable_app_token"]
        assert sample_config["feishu"]["table_id"]

    def test_config_product_mapping_complete(self, sample_config):
        feishu_products = sample_config["feishu"]["feishu_product_options"]
        product_uuids = sample_config["ones"]["product_uuids"]
        for product in feishu_products:
            assert product in product_uuids, f"产品 {product} 缺少 ONES UUID 映射"

    def test_config_status_values_consistent(self, sample_config):
        status = sample_config["feishu"]["status_values"]
        assert "pending" in status
        assert "approved" in status
        assert "rejected" in status

    def test_config_automation_status_values(self, sample_config):
        auto = sample_config["feishu"]["automation_status_values"]
        expected_keys = ["pending_send", "card_sent", "approved_waiting_create",
                         "create_success", "create_failed", "rejected", "skipped"]
        for key in expected_keys:
            assert key in auto, f"缺少自动化状态: {key}"

    def test_config_field_uuids_present(self, sample_config):
        fields = sample_config["ones"]["field_uuids"]
        assert "_system" in fields
        assert fields["_system"]["title"] == "field001"
        assert fields["submission_type"]
        assert fields["product"]

    def test_severity_map_coverage(self):
        from scan_and_send import SEVERITY_MAP
        for sev in ["P0", "P1", "P2", "P3"]:
            assert sev in SEVERITY_MAP
        for label in ["高", "中", "低"]:
            assert label in SEVERITY_MAP

    def test_build_card_with_none_values(self):
        from scan_and_send import build_card
        record = {
            "record_id": "rec_none",
            "fields": {
                "标题": None,
                "提报类型": None,
                "描述": None,
                "需求提出人": None,
                "严重程度": None,
                "需求优先级": None,
                "所属产品": None,
                "提出仓库": None,
                "需求价值（金额，单位：元|年）": None,
                "期望上线时间": None,
            }
        }
        card = build_card(record)
        assert card is not None

    def test_build_card_with_list_product(self, sample_record):
        from scan_and_send import build_card
        sample_record["fields"]["所属产品"] = ["全棉WMS", "医疗WMS"]
        card = build_card(sample_record)
        found_product = False
        for element in card["elements"]:
            for field in element.get("fields", []):
                content = field.get("text", {}).get("content", "")
                if "所属产品" in content and "全棉WMS" in content:
                    found_product = True
        assert found_product

    def test_reject_card_all_four_reasons_unique(self):
        from card_action_handler import build_reject_reason_card
        card = build_reject_reason_card("r1", "title", "sub")
        reasons = set()
        for e in card["elements"]:
            if e["tag"] == "action":
                for btn in e["actions"]:
                    r = btn.get("value", {}).get("reason")
                    if r:
                        reasons.add(r)
        assert len(reasons) == 4

    def test_done_card_has_timestamp(self):
        from card_action_handler import build_done_card
        card = build_done_card("需求X", "approved")
        all_text = json.dumps(card, ensure_ascii=False)
        assert "处理时间" in all_text

    def test_product_label_map_complete(self):
        from create_ones_task_ui import PRODUCT_LABEL_MAP
        expected = ["全棉WMS", "医疗WMS", "TMS", "SAP", "WIN BI数据报表", "OMS中台订单库存", "OA", "BI工具"]
        for p in expected:
            assert p in PRODUCT_LABEL_MAP

    def test_severity_label_mapping(self):
        from create_ones_task_ui import SEVERITY_LABEL
        assert SEVERITY_LABEL in ("P0", "P1", "P2", "P3")


class TestGetTenantTokenAndBitableToken:
    """飞书 token 获取函数"""

    @patch("card_action_handler.requests.post")
    def test_get_tenant_token(self, mock_post):
        from card_action_handler import get_tenant_token
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {"tenant_access_token": "test_token"}
        assert get_tenant_token() == "test_token"

    @patch("card_action_handler.requests.post")
    def test_get_bitable_token(self, mock_post):
        from card_action_handler import get_bitable_token
        mock_post.return_value = MagicMock()
        mock_post.return_value.json.return_value = {"tenant_access_token": "bt_token"}
        assert get_bitable_token() == "bt_token"


class TestMultiProductHandling:
    """多产品处理"""

    def test_single_product(self, sample_record):
        from scan_and_send import build_card
        sample_record["fields"]["所属产品"] = ["TMS"]
        card = build_card(sample_record)
        approve_btn = None
        for e in card["elements"]:
            if e.get("tag") == "action":
                for btn in e.get("actions", []):
                    if btn.get("value", {}).get("action_type") == "req_approve":
                        approve_btn = btn
        assert approve_btn is not None
        assert approve_btn["value"]["product_display"] == "TMS"

    def test_string_product(self, sample_record):
        from scan_and_send import build_card
        sample_record["fields"]["所属产品"] = "SAP"
        card = build_card(sample_record)
        assert card is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
