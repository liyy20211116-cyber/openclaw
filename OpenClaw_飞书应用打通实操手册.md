# OpenClaw 打通飞书应用实操手册（Windows）

> 目标：在 Windows 环境下，将 OpenClaw 与飞书（Feishu/Lark）应用打通，并完成可验证联调。  
> 推荐模式：**WebSocket 长连接模式**（无需公网回调地址）。

---

## 1. 前置条件

- 操作系统：Windows 10/11
- Node.js：`>=22`
- OpenClaw：已安装（或可在线安装）
- 你有飞书企业管理员/应用管理权限

检查版本：

```powershell
node -v
npm -v
openclaw --version
```

---

## 2. 安装与启动 OpenClaw（若你尚未启动）

你已有脚本 `openclaw_安装并启动.ps1`，可直接使用：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\openclaw_安装并启动.ps1
```

或手动执行：

```powershell
npm install -g openclaw@latest
openclaw gateway --port 18789 --verbose
```

启动后控制台地址：

- `http://127.0.0.1:18789/`

---

## 3. 安装 Feishu 插件

```powershell
openclaw plugins install @openclaw/feishu
```

---

## 4. 飞书开放平台配置（应用侧）

登录飞书开放平台：`https://open.feishu.cn/app`  
若是国际版 Lark：`https://open.larksuite.com/app`

### 4.1 创建企业自建应用

1. 创建应用
2. 开启「机器人」能力
3. 记录凭证：
   - `App ID`（如 `cli_xxx`）
   - `App Secret`

### 4.2 配置权限（关键）

至少确保包含消息接收和机器人发消息相关权限，建议按 OpenClaw 文档中的批量权限导入。

### 4.3 配置事件订阅（推荐 WebSocket）

在飞书应用的事件订阅中：

1. 选择「使用长连接接收事件（WebSocket）」
2. 添加事件：`im.message.receive_v1`

### 4.4 发布应用

在「版本管理与发布」中创建版本并发布，确保应用处于可用状态。

---

## 5. OpenClaw 渠道配置（推荐用 CLI 交互）

```powershell
openclaw channels add
```

选择 `Feishu` 后，按提示输入：

- `App ID`
- `App Secret`

完成后重启网关：

```powershell
openclaw gateway restart
```

---

## 6. 配置文件方式（可选，便于审计）

配置文件位置：`~/.openclaw/openclaw.json`  
Windows 通常在：`C:\Users\<你的用户名>\.openclaw\openclaw.json`

推荐（WebSocket）示例：

```json5
{
  channels: {
    feishu: {
      enabled: true,
      connectionMode: "websocket",
      dmPolicy: "pairing",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "我的AI助手"
        }
      }
    }
  }
}
```

### 6.1 Lark 国际版补充

若你是 Lark 国际版租户，请增加：

```json5
{
  channels: {
    feishu: {
      domain: "lark"
    }
  }
}
```

---

## 7. 首次联调（必须执行）

### 7.1 启动状态检查

```powershell
openclaw gateway status
openclaw logs --follow
```

### 7.2 飞书发送测试消息

在飞书里给机器人发一条消息，例如：`你好，测试联通`

### 7.3 配对授权（默认策略）

默认 `dmPolicy: "pairing"`，陌生用户会收到配对码。  
在命令行批准配对：

```powershell
openclaw pairing list feishu
openclaw pairing approve feishu <配对码>
```

批准后再次发消息，应收到正常回复。

---

## 8. 群聊打通要点

默认群聊行为通常需要 @ 机器人才触发。常用配置：

```json5
{
  channels: {
    feishu: {
      groupPolicy: "open",
      groups: {
        "oc_xxx": {
          requireMention: true
        }
      }
    }
  }
}
```

仅允许特定群组：

```json5
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["oc_xxx", "oc_yyy"]
    }
  }
}
```

---

## 9. 常见故障与排查顺序

### 9.1 机器人收不到消息

1. 飞书应用是否已发布
2. 事件是否已添加 `im.message.receive_v1`
3. 是否启用长连接 WebSocket
4. 网关是否在运行（`openclaw gateway status`）
5. 实时日志是否有鉴权或权限报错（`openclaw logs --follow`）

### 9.2 机器人不回消息

1. 是否需要先完成配对批准
2. 群聊里是否 @ 机器人
3. `groupPolicy` / `allowFrom` 是否限制了发送者
4. 应用是否有 `im:message:send_as_bot` 等发送权限

### 9.3 凭据泄露

1. 在飞书侧重置 `App Secret`
2. 更新 `openclaw.json`
3. 重启网关

---

## 10. 验收清单（打勾即完成）

- [ ] `openclaw plugins install @openclaw/feishu` 成功
- [ ] 飞书应用已发布，机器人能力已开启
- [ ] 事件订阅包含 `im.message.receive_v1`
- [ ] OpenClaw 配置完成并重启网关
- [ ] 私聊消息可正常收发
- [ ] （如需）群聊 @ 机器人可正常收发
- [ ] 配对与访问控制策略符合公司安全要求

---

## 11. 可直接复制的最小化命令流

```powershell
npm install -g openclaw@latest
openclaw plugins install @openclaw/feishu
openclaw channels add
openclaw gateway restart
openclaw gateway status
openclaw logs --follow
```

---

## 12. 参考文档

- OpenClaw 首页与快速开始：`https://docs.openclaw.ai/`
- OpenClaw 仓库：`https://github.com/openclaw/openclaw`
- OpenClaw 模型提供商文档：`https://docs.openclaw.ai/concepts/model-providers`
- OpenClaw Feishu 渠道文档（本地包内）：`node_modules/openclaw/docs/zh-CN/channels/feishu.md`

