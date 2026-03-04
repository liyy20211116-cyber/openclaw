# OpenClaw 飞书应用打通（公司内训版）

> 适用对象：讲师、实施负责人、运维负责人  
> 目标：在 60 分钟内完成“安装 -> 配置 -> 联调 -> 验收”闭环  
> 环境：Windows + PowerShell + 飞书企业自建应用

---

## 1. 培训目标与交付物

### 1.1 培训目标

1. 让参训人员掌握 OpenClaw 飞书接入的标准流程  
2. 现场完成飞书应用联通并可稳定收发消息  
3. 明确排障 SOP 与验收标准，支持后续规模化复用

### 1.2 交付物

- 一份可运行配置（`openclaw.json` 或 CLI 渠道配置）
- 一条私聊联通记录（可截图）
- 一条群聊联通记录（可截图）
- 一份验收打勾清单

---

## 2. 课前准备（讲师必须完成）

### 2.1 基础环境

- [ ] Node.js `>=22`
- [ ] npm 可用
- [ ] 能访问 npm 与飞书开放平台
- [ ] 已具备飞书应用管理权限

检查命令：

```powershell
node -v
npm -v
openclaw --version
```

### 2.2 培训资产

- [ ] 已准备脚本：`openclaw_安装并启动.ps1`
- [ ] 已准备飞书测试群：`OpenClaw-测试群`
- [ ] 已准备演示账号（可私聊机器人）
- [ ] 已准备应用凭据（App ID / App Secret）

---

## 3. 标准授课流程（60 分钟）

### 3.1 第一阶段：安装与启动（15 分钟）

讲师动作：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\openclaw_安装并启动.ps1
```

成功标准：

- 可访问 `http://127.0.0.1:18789/`
- 终端无持续报错

### 3.2 第二阶段：飞书应用配置（20 分钟）

在飞书开放平台完成：

1. 创建企业自建应用
2. 开启机器人能力
3. 获取 `App ID` 与 `App Secret`
4. 配置权限（至少含接收消息与机器人发消息能力）
5. 事件订阅添加 `im.message.receive_v1`
6. 发布应用版本

### 3.3 第三阶段：OpenClaw 渠道接入（15 分钟）

讲师动作：

```powershell
openclaw plugins install @openclaw/feishu
openclaw channels add
openclaw gateway restart
openclaw gateway status
```

> `openclaw channels add` 过程中选择 `Feishu`，录入 App ID / App Secret。

### 3.4 第四阶段：联调与验收（10 分钟）

```powershell
openclaw logs --follow
openclaw pairing list feishu
openclaw pairing approve feishu <配对码>
```

验收动作：

1. 私聊机器人发送“联调测试”
2. 群聊中 @机器人发送“群聊测试”
3. 检查两类消息均有回复

---

## 4. 推荐配置模板（公司统一）

> 文件：`C:\Users\<用户名>\.openclaw\openclaw.json`

```json5
{
  channels: {
    feishu: {
      enabled: true,
      connectionMode: "websocket",
      dmPolicy: "pairing",
      groupPolicy: "open",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "公司AI助手"
        }
      }
    }
  }
}
```

### 4.1 国际版 Lark（如适用）

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

## 5. 验收清单（课堂结束前逐项打勾）

- [ ] `openclaw plugins install @openclaw/feishu` 成功
- [ ] 飞书应用已发布
- [ ] 事件订阅已配置 `im.message.receive_v1`
- [ ] 网关状态正常（`openclaw gateway status`）
- [ ] 私聊收发成功
- [ ] 群聊 @机器人收发成功
- [ ] 配对授权流程可执行
- [ ] 排障命令已演示（`openclaw logs --follow`）

---

## 6. 标准排障 SOP（统一话术）

### 6.1 收不到消息

1. 应用是否发布  
2. 事件是否包含 `im.message.receive_v1`  
3. 网关是否运行  
4. 查看实时日志定位鉴权/权限错误

### 6.2 收到但不回复

1. 是否完成配对批准  
2. 群聊是否 @机器人  
3. `groupPolicy` / `allowFrom` 是否限制  
4. 应用是否具备发送权限

### 6.3 App Secret 泄露

1. 飞书侧立即重置 Secret  
2. 更新 OpenClaw 配置  
3. 重启网关并复测

---

## 7. 培训后动作

1. 将本手册与极简版下发到参训群  
2. 收集每位学员的联调截图  
3. 汇总常见问题沉淀到内部 FAQ  
4. 指定后续支持负责人

---

## 8. 参考链接

- OpenClaw 官网文档：`https://docs.openclaw.ai/`
- OpenClaw 仓库：`https://github.com/openclaw/openclaw`
- 模型提供商：`https://docs.openclaw.ai/concepts/model-providers`

