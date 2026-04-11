# SKILL: 需求审核自动化流程

## 触发条件

当用户说以下任意一种时，执行本 Skill：
- "扫描新需求" / "拉一下待审核" / "开始审核流程"
- 收到飞书卡片回调，`action.value.action_type = req_approve` 或 `req_reject`

---

## 完整流程图

```
[STEP 0] 获取 ONES access_token
    ↓
[STEP 1] 读取多维表格（状态=待审核）
    ↓
[STEP 2] 发送审核卡片给审核人
    ↓ 等待回调
    ├── ✅ 通过 → [STEP 3A] 按提报类型分支创建 ONES 工作项 → [STEP 4A] 回写表格 → [STEP 5A] 通知提报人已通过
    └── ❌ 不通过 → [STEP 3B] 更新表格状态 → [STEP 4B] 通知提报人拒绝原因
```

---

## STEP 0：获取并验证 ONES Bearer Token

> **认证说明**：ONES token 通过 WIS 域账号 SSO 全自动获取，**无需任何手动操作**。
> `ones_token_refresh.py` 中的 `get_token_auto()` 负责管理完整生命周期。

### 0-A：调用自动刷新模块

在任何需要调用 ONES API 的 Python 脚本中：

```python
import sys, os
sys.path.insert(0, r"d:\FY003\openclaw_agents\req-review-agent")
from ones_token_refresh import get_token_auto

token = get_token_auto()  # 自动从缓存获取或触发 WIS SSO 刷新（约 40 秒）
cookie = f"ones-lang=zh; ones-tz=Asia%2FShanghai; ones-region-uuid=default; ones-org-uuid=UTcECDmx; ones-lt={token}"
headers = {
    "Authorization": f"Bearer {token}",
    "Cookie": cookie,
    "Content-Type": "application/json",
    "Referer": "https://ones.winnermedical.com/project/"
}
```

### 自动刷新流程（后台透明执行）

1. 检查 `token_cache.json` 中的 `ones_lt`（JWT `exp` 字段，提前 2 分钟刷新）
2. 若过期：WIS RSA 加密登录（91764）→ Playwright SSO redirect → 捕获 `ones-lt` cookie
3. 新 token 写回 `token_cache.json`，有效期约 1 小时

---

**所有 ONES API 请求均携带：**
```
Authorization: Bearer {token}
Content-Type: application/json
Cookie: ones-lang=zh; ones-org-uuid=UTcECDmx; ones-region-uuid=default
Referer: https://ones.winnermedical.com/project/
```

---

## STEP 1：从飞书多维表格读取待审核需求

```
工具：bitable_v1_appTableRecord_search
app_token: EI2CbmJb1aDlVosGmnocIdAznab
table_id:  tbl3Ci7REHJK8LQT
filter:
  conjunction: and
  conditions:
    - field_name: "状态"
      operator: is
      value: ["待审批"]
field_names: ["提报类型","标题","描述","需求提出人","期望上线时间",
              "需求价值（金额，单位：元|年）","严重程度","需求优先级","所属产品","提出仓库"]
```

### 处理规则
- 返回 0 条 → 回复"当前无待审批需求"，流程结束。
- 返回 ≥1 条 → 逐条执行 STEP 2（无需提前改状态，通过后再改为"已提交ones"，拒绝后改为"退回需求"）。

---

## STEP 2：发送飞书审核卡片

```
工具：im_v1_message_create
receive_id_type: open_id
receive_id: oc_cdd9020e9d68680bb4b33c0a10dae244
msg_type: interactive
content: 读取 templates/card-review.json，替换以下占位符：
  {{RECORD_ID}}       → record.record_id
  {{REQ_TYPE}}        → record.fields["提报类型"]（需求优化 / 系统BUG）
  {{REQ_TITLE}}       → record.fields["标题"]
  {{SUBMITTER_NAME}}  → record.fields["需求提出人"][0].name
  {{SUBMITTER_ID}}    → record.fields["需求提出人"][0].open_id
  {{DESCRIPTION}}     → record.fields["描述"]（截断至300字）
  {{PRODUCT}}         → record.fields["所属产品"]
  {{PRIORITY}}        → record.fields["需求优先级"]（需求优化有此字段）
  {{SEVERITY}}        → record.fields["严重程度"]（系统BUG有此字段，需求优化填"-"）
  {{VALUE_AMOUNT}}    → record.fields["需求价值（金额，单位：元/年）"]（无则填"-"）
  {{EXPECTED_DATE}}   → record.fields["期望上线时间"]（毫秒时间戳 → YYYY-MM-DD，无则填"-"）
  {{SUBMIT_TIME}}     → 当前时间 YYYY-MM-DD HH:mm
```

记录 `{ record_id, message_id, sent_at }` 追加到 `memory/pending_reviews.json`。

---

## STEP 3A：审核通过 → 按类型创建 ONES 工作项

**触发：** `action.value.action_type == "req_approve"`

### 从回调提取参数
```
record_id     = action.value.record_id
submitter_id  = action.value.submitter_id
req_type      = action.value.req_type      // "需求优化" 或 "系统BUG"
req_title     = action.value.req_title
description   = action.value.description
product       = action.value.product
priority      = action.value.priority
severity      = action.value.severity
value_amount  = action.value.value_amount
expected_date = action.value.expected_date
```

### 分支判断：提报类型

---

### ONES 创建工单 — 通用格式（两种类型共用）

> **已验证端点**：`POST https://ones.winnermedical.com/project/api/project/team/BSsxXFv2/tasks/add`

**UUID 生成规则**（客户端生成）：`{USER_UUID}{8位随机字母数字}` = `5ktr445N` + random(8)

**产品 UUID 映射**（从 config.ones.product_uuids 查找飞书产品名对应的 ONES UUID）：
- 全棉WMS → QE2GXyz1QGmiMX55
- 医疗WMS → 4Nisyuwu3RpqYEpW
- TMS → QE2GXyz1M9wrK1z3
- SAP → QE2GXyz1LBEv31Ps
- WIN BI数据报表 → AGRwaJXiRNd7vpn2
- OMS中台订单库存 → QE2GXyz13FrYFMEj
- OA → QE2GXyz1BqVWhNhM
- BI工具 → QE2GXyz1WSeEmJo7

```json
POST https://ones.winnermedical.com/project/api/project/team/BSsxXFv2/tasks/add
Authorization: Bearer {token}
Cookie: ones-lang=zh; ones-org-uuid=UTcECDmx; ones-region-uuid=default
Content-Type: application/json
Referer: https://ones.winnermedical.com/project/

{
  "tasks": [{
    "uuid":            "{5ktr445N + 8随机字符}",
    "assign":          "5ktr445N",
    "summary":         "{req_title}",
    "parent_uuid":     "",
    "issue_type_uuid": "{TNVWjjtZ(BUG) | 2cCuqqQw(需求)}",
    "project_uuid":    "QE2GXyz1K1Z1aDui",
    "watchers":        ["5ktr445N"],
    "field_values": [
      {"field_uuid": "field001", "type": 2,  "value": "{req_title}"},
      {"field_uuid": "field016", "type": 20, "value": "<p>{description_html}</p>"},
      {"field_uuid": "ScqUnZYX", "type": 15, "value": "{description_plain}"},
      {"field_uuid": "field038", "type": 1,  "value": "{severity_uuid}"},
      {"field_uuid": "field004", "type": 8,  "value": "5ktr445N"},
      {"field_uuid": "field029", "type": 44, "value": ["{product_uuid}"]}
    ]
  }]
}
```

**严重程度 UUID**（field038，系统BUG用，需求优化传 P3 兜底）：
- P0 → CbHEhDQ4，P1 → Gjh8TNF3，P2 → da53MmEu，P3 → VN4pcKke

**成功响应**：HTTP 200，`response.tasks[0].uuid` 即工单 UUID。
**失败响应**：`response.bad_tasks[0].errcode` 含错误原因。

---

### 3A 公共后续步骤

**提取链接**：
```
ones_link = "https://ones.winnermedical.com/project/#/team/BSsxXFv2/project/QE2GXyz1K1Z1aDui/issue/{response.tasks[0].uuid}"
```

**若 ONES API 失败**：停止，回复审核人"ONES 创建失败：{errcode}，请手动处理"，不更新表格。

---

## STEP 4A：回写飞书多维表格（通过后）

```
工具：bitable_v1_appTableRecord_update
app_token: EI2CbmJb1aDlVosGmnocIdAznab
table_id:  tbl3Ci7REHJK8LQT
record_id: record_id
fields:
  "状态":    "已提交ones"
  "链接":    ones_link
```

---

## STEP 5A：通知提报人已通过（可选）

```
工具：im_v1_message_create
receive_id_type: open_id
receive_id: submitter_id
msg_type: text
content: { "text": "您好，您提报的需求《{req_title}》已通过审核，ONES 工作项已创建：{ones_link}" }
```

---

## STEP 3B：审核拒绝 → 通知提报人

**触发：** `action.value.action_type == "req_reject"`

### 从回调提取参数
```
record_id     = action.value.record_id
submitter_id  = action.value.submitter_id
req_title     = action.value.req_title
reject_reason = action.value.reject_reason（卡片输入框内容）
```

### 更新多维表格

```
工具：bitable_v1_appTableRecord_update
fields:
  "状态":    "退回需求"
```

### 发送拒绝通知给提报人

```
工具：im_v1_message_create
receive_id_type: open_id
receive_id: submitter_id
msg_type: interactive
content: 读取 templates/card-reject.json，替换：
  {{REQ_TITLE}}     → req_title
  {{REJECT_REASON}} → reject_reason
  {{REVIEWER_NAME}} → 李原野
  {{REJECT_TIME}}   → 当前时间 YYYY-MM-DD HH:mm
```

---

## 处理日志

每次完成后，追加记录到 `memory/processed_log.json`：
```json
{
  "record_id": "...",
  "req_type":  "需求优化 | 系统BUG",
  "action":    "approved | rejected",
  "ones_link": "...（通过时）",
  "reject_reason": "...（拒绝时）",
  "processed_at": "YYYY-MM-DD HH:mm:ss"
}
```

---

## 错误处理总表

| 错误场景 | 处理方式 |
|----------|----------|
| ONES token 获取失败 | 停止并告知审核人 ONES 认证失败，检查 Client Secret 是否过期 |
| ONES 创建工作项失败 | 不更新表格，告知审核人失败原因和 ONES 手动入口链接 |
| 飞书更新表格失败 | 输出 ONES 链接，标注"需手动回写表格" |
| 卡片回调字段缺失 | 记录原始 payload 到日志，告知审核人"回调异常，请重新操作" |
| 提报人 open_id 为空 | 跳过私信，在审核人回话中说明情况 |
