---
name: wechat-bot
description: "通过个人微信收发消息（私聊+群聊）、图片/文件/语音，以及群聊智能摘要；面向一人公司场景的微信入口。对标 Hermes v0.8 原生微信能力。"
metadata: { "openclaw": { "emoji": "💚", "os": ["win32"] } }
---

# WeChat Bot — 个人微信 Bot 入口

让 Jarvis 的 9 个 AI 部门除了飞书外，也能通过**个人微信**（扫码登录）被 CEO 随时调用。

## 适用场景

- CEO 在微信里 @Jarvis 下达任务（私聊或工作群）
- AI 员工主动推送每日/每周工作汇报到指定微信群
- 群聊自动摘要（日报/周报）
- 从微信群收集客户需求 → 自动进 CRM
- 接收并处理语音/图片/文件消息

## 后端方案对比

| 方案 | 维护成本 | 封号风险 | 推荐场景 |
|---|---|---|---|
| **wxauto** (PC 微信自动化，Python) | 低 | 低 | **首选**，Windows 桌面 |
| **wechaty + padlocal** | 中 | 中 | 云端部署 |
| **企业微信 Webhook** | 极低 | 无 | 只发通知、不收消息 |
| **Hermes 扫码** | 低 | 低 | 与 Hermes 生态兼容 |

默认实现走 **wxauto**（Python 3.8+，微信 4.0 以下，wxauto 3.9.11.17.5）。

## 目录结构（规划）

```
skills/wechat-bot/
├── SKILL.md                     # 本文件
├── scripts/
│   ├── wx_listen.py             # 消息监听入口（守护进程）
│   ├── wx_send.py               # 发消息 CLI：支持文本/图片/文件
│   ├── wx_group_digest.py       # 群聊摘要：拉取 N 小时消息 + 调 LLM 总结
│   └── wx_contacts_sync.py      # 通讯录同步到 Prisma
├── templates/
│   ├── daily_report.md          # 每日汇报模板
│   └── group_digest.md          # 群摘要模板
└── config.example.json
```

## 核心能力清单

### 1. 发消息（最小可用）

```powershell
python -u D:\FY003\skills\wechat-bot\scripts\wx_send.py `
  --to "AI一人公司研究所" `
  --type text `
  --content "晚上好，今日 KPI 报告已生成，请查收。"
```

支持 `--type text|image|file`。

### 2. 消息监听 + @Jarvis 转发

```powershell
python -u D:\FY003\skills\wechat-bot\scripts\wx_listen.py `
  --forward-to http://127.0.0.1:18781/ceo_chat
```

功能：
- 监听指定群/联系人
- 识别 `@Jarvis` / `#jarvis` 触发词
- 转发给 Jarvis-COO HTTP 入口（SSE 流式返回）
- 把 AI 回复原路发回微信

### 3. 群聊摘要（对标 Vita0519/wechat_summary）

```powershell
python -u D:\FY003\skills\wechat-bot\scripts\wx_group_digest.py `
  --group "AI一人公司研究所" `
  --hours 24 `
  --model glm-4.6
```

产出结构化日报：
- 不多于 10 个话题
- 每话题带热度（🔥 数量）
- 结尾附 Top 3 争议点

### 4. 主动推送定时任务

注册到现有 `scripts/scheduler/`：

```json
{
  "id": "wechat-daily-digest",
  "cron": "0 22 * * *",
  "command": "python D:\\FY003\\skills\\wechat-bot\\scripts\\wx_group_digest.py --group 核心群 --hours 24 --send-back"
}
```

## 与 Jarvis OS 的集成点

1. **CEO 对话入口**：微信 = 飞书的并列入口，走同一个 `/ceo_chat` API
2. **Token 经济**：微信消息归入 `luna-growth` 或 `dobby-customer` 的 Token 预算
3. **审计**：`snape-audit` 自动抽检 AI 回复质量
4. **记忆**：对话写入 `memory/ceo_preferences.md`

## 合规与风险

- 仅用于**本人账号自动化**，不可用于营销群发
- 建议用小号/工作号
- 所有发送动作默认 **dry-run**，需加 `--confirm` 才真正发送
- 敏感词过滤走 `config/company-rules.md`

## 下一步（Roadmap）

- [ ] v0.1：wx_send / wx_listen / wx_group_digest 三件套
- [ ] v0.2：接入 Luna 自动写朋友圈
- [ ] v0.3：集成 Dobby 做 7×24 客服
- [ ] v0.4：语音消息 → Whisper → 任务（对标 Peter 酿酒 Agent）
