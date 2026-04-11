---
name: feishu-workflow-bitable
description: "当用户要求把任务、流程节点、执行步骤、负责人、状态同步到飞书多维表格时使用。优先用 bitable 做任务板、工作流台账、需求池、执行跟踪。"
metadata: { "openclaw": { "emoji": "📊", "os": ["win32"] } }
---

# Feishu Workflow Bitable

用于把工作流拆解成结构化记录，写入飞书多维表格。

## 适用场景

- 帮我同步到多维表格
- 帮我做任务台账
- 帮我把流程拆成执行项
- 帮我维护需求池 / 项目跟踪表
- 帮我把负责人、状态、截止时间写进去

## 常用工具

- `feishu_bitable_get_meta`
- `feishu_bitable_list_fields`
- `feishu_bitable_list_records`
- `feishu_bitable_create_record`
- `feishu_bitable_update_record`
- `feishu_bitable_create_app`
- `feishu_bitable_create_field`

## 推荐使用流程

### 已有多维表格 URL 时

先解析 URL：

```json
{ "url": "https://xxx.feishu.cn/base/ABC123?table=tblxxxx" }
```

使用工具：`feishu_bitable_get_meta`

### 查看字段

```json
{ "app_token": "app_token", "table_id": "table_id" }
```

使用工具：`feishu_bitable_list_fields`

### 新增记录

```json
{
  "app_token": "app_token",
  "table_id": "table_id",
  "fields": {
    "任务名称": "完成方案整理",
    "负责人": "张三",
    "状态": "待开始"
  }
}
```

使用工具：`feishu_bitable_create_record`

### 更新记录

```json
{
  "app_token": "app_token",
  "table_id": "table_id",
  "record_id": "recxxxx",
  "fields": {
    "状态": "已完成"
  }
}
```

使用工具：`feishu_bitable_update_record`

## 默认字段建议

如果用户让你新建一个工作流表，优先建议这些字段：

- 任务名称
- 所属流程
- 负责人
- 状态
- 优先级
- 截止时间
- 备注

## 工作原则

- 多维表格适合做“跟踪”和“台账”，不适合堆大段正文
- 如果用户要的是制度说明，优先写文档；如果要的是执行管理，优先写 bitable
- 不要凭空假设字段名，优先先读字段再写入

## 对外回复

完成后告诉用户：

- 已写入或更新哪张表
- 新增/更新了多少条记录
- 涉及哪些关键字段
