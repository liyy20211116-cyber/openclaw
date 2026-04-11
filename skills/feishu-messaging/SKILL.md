---
name: feishu-messaging
description: "当需要通过飞书发送消息、管理群聊、推送通知、与团队成员沟通时使用。支持文本、富文本、卡片、文件等消息类型。"
metadata: { "openclaw": { "emoji": "💬", "os": ["win32"] } }
---

# Feishu Messaging — 飞书消息通信

所有角色共享的飞书消息发送和群聊管理能力。

## 适用场景

- 向指定用户或群聊发送消息
- 发送审批通知、进度汇报
- 推送报警和异常提醒
- 管理群聊成员和设置
- 发送交互式卡片消息

## 可用 MCP 工具

| 工具 | 用途 |
|------|------|
| `im_v1_message_create` | 发送消息（文本/富文本/卡片/文件） |
| `im_v1_message_list` | 获取聊天历史记录 |
| `im_v1_chat_create` | 创建群聊 |
| `im_v1_chat_list` | 获取群聊列表 |
| `im_v1_chatMembers_get` | 获取群成员列表 |
| `contact_v3_user_batchGetId` | 通过邮箱/手机号获取用户 ID |

## 消息类型

### 文本消息

```json
{
  "receive_id": "oc_xxx",
  "msg_type": "text",
  "content": "{\"text\": \"消息内容\"}"
}
```

### 富文本消息

```json
{
  "receive_id": "oc_xxx",
  "msg_type": "post",
  "content": "{\"zh_cn\": {\"title\": \"标题\", \"content\": [[{\"tag\": \"text\", \"text\": \"正文\"}]]}}"
}
```

### 交互式卡片

```json
{
  "receive_id": "oc_xxx",
  "msg_type": "interactive",
  "content": "{\"elements\": [{\"tag\": \"div\", \"text\": {\"content\": \"**内容**\", \"tag\": \"lark_md\"}}]}"
}
```

## 消息场景模板

### 任务通知
```
📋 新任务分配
任务：{任务名称}
负责人：{角色名}
截止时间：{deadline}
优先级：{priority}
```

### 进度汇报
```
📊 项目进度更新
项目：{项目名}
完成度：{percent}%
本周完成：{items}
待处理：{pending}
```

### 异常告警
```
⚠️ 异常告警
类型：{alert_type}
详情：{description}
影响范围：{scope}
建议处理：{suggestion}
```

## 各角色典型用法

| 角色 | 场景 |
|------|------|
| 贾维斯 | 任务分配通知、CEO 日报推送、跨部门协调 |
| 赫敏 | 部署结果通知、服务告警、技术方案评审 |
| 麦格教授 | 需求评审通知、验收结果通知 |
| 卢娜 | 内容发布通知、数据日报推送 |
| 弗雷德 | 商务跟进提醒、成交通知 |
| 珀西 | 预算预警、财务日报 |
| 斯内普 | 安全告警、审计发现通知 |
| 多比 | 客户问题跟进通知、满意度调查 |

## 注意事项

- receive_id_type 根据接收方类型选择（chat_id 发群、open_id 发个人）
- 卡片消息 content 必须是 JSON 字符串（双重序列化）
- 消息内容不包含敏感信息（密码、Token 等）
- 高频消息注意飞书 API 频率限制
- 重要通知同时发群和个人，确保送达
