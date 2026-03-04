# OpenClaw 飞书应用打通（学员10分钟极简版）

> 目标：10 分钟内完成飞书机器人联通并收到回复

---

## 1. 先决条件

- 你是 Windows 环境
- 已安装 Node.js（`>=22`）
- 有飞书应用的 `App ID` 和 `App Secret`

检查：

```powershell
node -v
npm -v
```

---

## 2. 一次性执行命令

```powershell
npm install -g openclaw@latest
openclaw plugins install @openclaw/feishu
openclaw channels add
openclaw gateway restart
openclaw gateway status
openclaw logs --follow
```

> 在 `openclaw channels add` 里选择 `Feishu`，输入 `App ID` 与 `App Secret`。

---

## 3. 飞书侧最少配置

在飞书开放平台（应用后台）确保：

1. 机器人能力已开启
2. 事件订阅已添加：`im.message.receive_v1`
3. 应用已发布

---

## 4. 联调

1. 在飞书私聊机器人发消息：`你好`
2. 如果收到配对码，执行：

```powershell
openclaw pairing list feishu
openclaw pairing approve feishu <配对码>
```

3. 再发一次消息，确认机器人回复

---

## 5. 群聊测试（可选）

在群里 @机器人 发送 `群聊测试`，确认有回复。

---

## 6. 常见问题（只看这三条）

1. **收不到消息**：检查应用是否发布、事件是否有 `im.message.receive_v1`
2. **不回复**：先完成 pairing approve，再重发
3. **仍失败**：看日志 `openclaw logs --follow`，优先排查权限/鉴权错误

---

## 7. 完成标准

- [ ] 私聊能正常收发
- [ ] 配对流程可通过
- [ ] （可选）群聊 @机器人能回复

