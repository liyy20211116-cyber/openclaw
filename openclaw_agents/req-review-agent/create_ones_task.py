"""
create_ones_task.py — 在 ONES 创建工单（需求/缺陷共用）
返回: task_uuid 和 ones_url

用法:
python create_ones_task.py <title> <description_plain> <severity_uuid> <issue_type_uuid> [product_uuid] [req_type] [warehouse] [priority] [expected_date] [value_amount] [submitter_name] [product_display]
"""
import json, requests, os, random, string, sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from ones_token_refresh import get_token_auto

HERE = Path(__file__).parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))

T = get_token_auto()
C = (
    "ones-lang=zh; ones-tz=Asia%2FShanghai; ones-region-uuid=default; "
    f"ones-org-uuid=UTcECDmx; ones-lt={T}"
)
H = {
    "Authorization": f"Bearer {T}", "Cookie": C,
    "Content-Type": "application/json",
    "Referer": "https://ones.winnermedical.com/project/"
}

ONES_CFG  = CONFIG["ones"]
USER_UUID = ONES_CFG["reviewer_ones_user_uuid"]
TEAM_UUID = ONES_CFG["team_uuid"]
PROJ_UUID = ONES_CFG["project_uuid"]
URL       = f"https://ones.winnermedical.com/project/api/project/team/{TEAM_UUID}/tasks/add"
LINK_TPL  = f"https://ones.winnermedical.com/project/#/team/{TEAM_UUID}/project/{PROJ_UUID}/issue/{{uuid}}"

FIELDS = ONES_CFG.get("field_uuids", {})
PRIORITY_UUIDS = ONES_CFG.get("priority_uuids", {})
REQ_PRIORITY_UUIDS = ONES_CFG.get("req_priority_option_uuids", {})
VALUE_TYPE_UUIDS = ONES_CFG.get("value_type_option_uuids", {})
SUBMISSION_TYPE_UUIDS = ONES_CFG.get("submission_type_option_uuids", {})


def gen_uuid():
    return USER_UUID + ''.join(random.choices(string.ascii_letters + string.digits, k=8))


def htmlize(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return "<p></p>"
    parts = [p for p in text.splitlines()]
    return "<p>" + "</p>\n<p>".join(parts) + "</p>"


def build_plain_description(req_type: str, title: str, desc_plain: str, warehouse: str,
                            priority: str, expected_date: str, value_amount: str,
                            submitter_name: str, product_display: str) -> str:
    blocks = [
        f"【标题】\n{title}",
        f"【提报类型】\n{req_type or '-'}",
        f"【所属产品】\n{product_display or '-'}",
        f"【提出仓库】\n{warehouse or '-'}",
        f"【提报人】\n{submitter_name or '-'}",
        f"【优先级】\n{priority or '-'}",
        f"【期望上线时间】\n{expected_date or '-'}",
    ]
    if req_type == "需求优化":
        blocks.append(f"【需求价值（元/年）】\n{value_amount or '-'}")
    blocks.append(f"【详细描述】\n{desc_plain or '-'}")
    return "\n\n".join(blocks)


# ── 从命令行读入参数 ─────────────────────────────────────
title          = sys.argv[1] if len(sys.argv) > 1 else "【API测试删除】退货装箱加工报表修改"
desc_plain_raw = sys.argv[2] if len(sys.argv) > 2 else "API测试，请忽略并删除"
severity_uuid  = sys.argv[3] if len(sys.argv) > 3 else ONES_CFG.get("severity_option_uuids", {}).get("P2", "da53MmEu")
issue_type     = sys.argv[4] if len(sys.argv) > 4 else ONES_CFG.get("issue_types", {}).get("bug", {}).get("issue_type_uuid", "TNVWjjtZ")
product_uuid   = sys.argv[5] if len(sys.argv) > 5 else ONES_CFG.get("product_uuids", {}).get("全棉WMS", "QE2GXyz1QGmiMX55")
req_type       = sys.argv[6] if len(sys.argv) > 6 else "需求优化"
warehouse      = sys.argv[7] if len(sys.argv) > 7 else ""
priority       = sys.argv[8] if len(sys.argv) > 8 else ""
expected_date  = sys.argv[9] if len(sys.argv) > 9 else ""
value_amount   = sys.argv[10] if len(sys.argv) > 10 else ""
submitter_name = sys.argv[11] if len(sys.argv) > 11 else ""
product_display = sys.argv[12] if len(sys.argv) > 12 else ""

full_plain_desc = build_plain_description(
    req_type, title, desc_plain_raw, warehouse, priority,
    expected_date, value_amount, submitter_name, product_display
)
desc_html = htmlize(full_plain_desc)

task_uuid = gen_uuid()
field_values = [
    {"field_uuid": "field001", "type": 2,  "value": title},
    {"field_uuid": "field016", "type": 20, "value": desc_html},
    {"field_uuid": "ScqUnZYX", "type": 15, "value": full_plain_desc},
    {"field_uuid": "field004", "type": 8,  "value": USER_UUID},
    {"field_uuid": "field029", "type": 44, "value": [product_uuid]},
]

# 缺陷保留严重程度；需求不强塞严重程度
if req_type == "系统BUG":
    field_values.append({"field_uuid": "field038", "type": 1, "value": severity_uuid})

# 标准优先级字段（高/中/低）
if priority and PRIORITY_UUIDS.get(priority):
    field_values.append({"field_uuid": "field006", "type": 1, "value": PRIORITY_UUIDS[priority]})

# 提报类型
if FIELDS.get("submission_type") and SUBMISSION_TYPE_UUIDS.get(req_type):
    field_values.append({
        "field_uuid": FIELDS["submission_type"],
        "type": 1,
        "value": SUBMISSION_TYPE_UUIDS[req_type]
    })

# 需求类增强字段
if req_type == "需求优化":
    if FIELDS.get("req_priority") and REQ_PRIORITY_UUIDS.get(priority):
        field_values.append({
            "field_uuid": FIELDS["req_priority"],
            "type": 1,
            "value": REQ_PRIORITY_UUIDS[priority]
        })
    if FIELDS.get("value_type") and VALUE_TYPE_UUIDS.get("管理价值"):
        field_values.append({
            "field_uuid": FIELDS["value_type"],
            "type": 1,
            "value": VALUE_TYPE_UUIDS["管理价值"]
        })
    if FIELDS.get("value_amount") and value_amount not in ("", "-", None):
        try:
            amount = int(float(value_amount))
            field_values.append({
                "field_uuid": FIELDS["value_amount"],
                "type": 4,
                "value": amount
            })
        except Exception:
            pass

payload = {
    "tasks": [{
        "uuid": task_uuid,
        "assign": USER_UUID,
        "summary": title,
        "parent_uuid": "",
        "issue_type_uuid": issue_type,
        "project_uuid": PROJ_UUID,
        "watchers": [USER_UUID],
        "field_values": field_values
    }]
}

r = requests.post(URL, headers=H, json=payload, timeout=30)
result = r.json()

if r.status_code == 200 and result.get("tasks"):
    real_uuid = result["tasks"][0].get("uuid", task_uuid)
    link = LINK_TPL.format(uuid=real_uuid)
    print(f"[OK] task_uuid={real_uuid}")
    print(f"[OK] ones_url={link}")
    print(f"[OK] req_type={req_type} priority={priority} warehouse={warehouse} expected_date={expected_date}")
    print(json.dumps({"task_uuid": real_uuid, "ones_url": link}, ensure_ascii=False))
elif result.get("bad_tasks"):
    bad = result["bad_tasks"][0]
    print(f"[ERROR] 创建失败: {bad}", file=sys.stderr)
    sys.exit(1)
else:
    print(f"[ERROR] 未知响应 {r.status_code}: {r.text[:400]}", file=sys.stderr)
    sys.exit(1)
