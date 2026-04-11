# 需求审核自动化 Agent

**流程：** 飞书多维表格（稳健集团·数字化需求&BUG收集池）→ 审核卡片 → ONES 工作项 → 回写链接 / 通知提报人

---

## 目录结构

```
req-review-agent/
├── IDENTITY.md              # Agent 角色定义
├── SKILL-req-review.md      # 完整业务流程（核心）
├── config.json              # 配置文件（飞书/ONES 参数）
├── README.md                # 本文件
├── templates/
│   ├── card-review.json     # 发给审核人的交互卡片
│   └── card-reject.json     # 发给提报人的拒绝通知卡片
└── memory/
    ├── pending_reviews.json # 等待回调的审核记录（运行时生成）
    └── processed_log.json   # 已处理流水（运行时生成）
```

---

## 已配置完成的项目

| 配置项 | 值 |
|--------|-----|
| 飞书多维表格 App Token | EI2CbmJb1aDlVosGmnocIdAznab |
| 飞书表格 Table ID | tbl3Ci7REHJK8LQT |
| 审核人 open_id | oc_cdd9020e9d68680bb4b33c0a10dae244 |
| 审核人姓名 | 李原野 |
| ONES 地址 | https://ones.winnermedical.com |
| ONES Team UUID | BSsxXFv2 |
| ONES Project UUID | QE2GXyz1K1Z1aDui |
| ONES Client ID | b8f49ff2a7184ac363ccf31f9a6fc5de |
| ONES Client Secret | c4c67603f4e446ea64f299cb5cdfbbb5 |

---

## 还需要填写的项目（ONES UUID）

`config.json` 中所有 `"TODO:"` 开头的值，需要通过调用 ONES API 查询获得。
**按以下顺序执行 3 个查询，即可获得全部 UUID。**

---

### 查询 1：获取工作项类型 UUID（业务需求 + 问题缺陷）

```
GET https://ones.winnermedical.com/project/api/project/QE2GXyz1K1Z1aDui/issue_type
Authorization: Bearer {access_token}
```

在返回结果中找到 `name = "业务需求"` 和 `name = "问题缺陷"` 的 `uuid`，分别填入：
- `config.ones.issue_types.requirement.issue_type_uuid`
- `config.ones.issue_types.bug.issue_type_uuid`

---

### 查询 2：获取字段 UUID（所属产品、期望上线时间、严重程度等）

```
GET https://ones.winnermedical.com/project/api/project/QE2GXyz1K1Z1aDui/field
Authorization: Bearer {access_token}
```

在返回结果中按 `name` 找以下字段的 `uuid`：

| config 中的 key | 对应 ONES 字段名 |
|-----------------|----------------|
| `field_uuids.product` | 所属产品 |
| `field_uuids.submitter` | 需求提出人 |
| `field_uuids.expected_date` | 期望上线时间 |
| `field_uuids.background` | 背景 |
| `field_uuids.value_text` | 需求价值 |
| `field_uuids.value_amount` | 需求价值（金额，单位：元/年）|
| `field_uuids.value_type` | 价值类型 |
| `field_uuids.severity` | 严重程度 |
| `field_uuids.bug_submitter` | 提出人（问题缺陷用）|

同时，在 `严重程度` 字段的 `options` 数组中，找到 P0/P1/P2/P3 各选项的 `uuid`，填入 `config.ones.severity_uuids`。

---

### 查询 3：获取优先级 UUID

```
GET https://ones.winnermedical.com/project/api/project/QE2GXyz1K1Z1aDui/priority
Authorization: Bearer {access_token}
```

在返回结果中找到 `name = "高"/"中"/"低"` 的 `uuid`，填入 `config.ones.priority_uuids`。

---

### 查询 4：获取李原野的 ONES user UUID（负责人）

```
GET https://ones.winnermedical.com/project/api/team/BSsxXFv2/member
Authorization: Bearer {access_token}
```

在返回结果中搜索 `name = "李原野"` 的 `uuid`，填入 `config.ones.reviewer_ones_user_uuid`。

---

### 如何获取 access_token（用于上面的查询）

```bash
curl -X POST https://ones.winnermedical.com/project/api/auth/oauth2/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "b8f49ff2a7184ac363ccf31f9a6fc5de",
    "client_secret": "c4c67603f4e446ea64f299cb5cdfbbb5"
  }'
```

返回的 `access_token` 用于后续所有查询的 `Authorization: Bearer {token}` 头。

> 如果 ONES 不支持 client_credentials 直接获取 token，则需要用 ONES 账号登录后从浏览器开发者工具 Network 中拿 `Ones-Auth-Token`，填入 config.json 的 `ones.auth_token` 字段（需同时填 `ones.user_id`）。

---

## 多维表格字段对应关系

| 飞书字段名 | 类型 | 说明 |
|-----------|------|------|
| 链接 | 超链接 | 审核通过后由 Agent 回写 ONES 链接 |
| 提报类型 | 单选 | 需求优化 / 系统BUG，决定 ONES 工作项类型 |
| 标题 | 文本 | 映射到 ONES summary |
| 描述 | 多行文本 | 映射到 ONES description 和背景 |
| 需求提出人 | 人员 | 拒绝时用于通知；通过时填入 ONES 需求提出人 |
| 期望上线时间 | 日期 | 映射到 ONES 期望上线时间 |
| 需求价值（金额，单位：元/年）| 数字 | 映射到 ONES 同名字段（仅业务需求）|
| 严重程度 | 单选 P0-P3 | 映射到 ONES 严重程度（仅系统BUG）|
| 需求优先级 | 单选 高/中/低 | 映射到 ONES priority（仅业务需求）|
| 所属产品 | 单选 | 映射到 ONES 所属产品 |
| 状态 | 单选 | 待审核→审核中→已通过/已拒绝（由 Agent 维护）|
| 拒绝原因 | 多行文本 | 拒绝时由 Agent 回写 |
| 审核时间 | 日期 | 审核完成后由 Agent 回写 |

> ⚠️ 如果多维表格当前没有"待审核"这个状态选项，需要在表格的"状态"字段中手动添加：待审核、审核中、已通过、已拒绝 四个选项。

---

## 使用方法

在 OpenClaw 中切换到本 Agent 工作区，发送：

```
扫描新需求
```

Agent 将：
1. 拉取所有"待审核"记录
2. 每条推送一张审核卡片到你的飞书
3. 你点击"✅ 通过"或"❌ 不通过"
4. 自动完成 ONES 填报 + 表格回写 + 提报人通知

---

## 安全说明

- `Client Secret` 不要提交到公共 Git 仓库，`.gitignore` 中已排除 `config.json`（如未排除请手动添加）
- 若 `access_token` 有时效，Agent 会在每次流程启动时重新获取
