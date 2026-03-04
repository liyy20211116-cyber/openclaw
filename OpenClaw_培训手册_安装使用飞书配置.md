# OpenClaw 培训手册（安装、使用、飞书配置）

## 1. 培训目标

本手册用于帮助参训人员在 Windows 环境下完成以下内容：

1. 安装并启动 OpenClaw Gateway  
2. 掌握基础使用流程  
3. 完成飞书侧接入配置并验证联通性  

---

## 2. 培训前准备

### 2.1 适用环境

- 操作系统：Windows 10/11  
- 终端：PowerShell  
- 网络：可访问 npm 与飞书相关服务  

### 2.2 前置软件

- Node.js（**必须 >= 22**）
- npm（通常随 Node.js 一起安装）

检查命令：

```powershell
node -v
npm -v
```

---

## 3. 一键安装并启动（推荐培训演示方式）

你已有脚本：`openclaw_安装并启动.ps1`，其核心逻辑为：

- 自动检查 Node.js 版本是否 >= 22  
- 自动执行全局安装：`npm install -g openclaw@latest`  
- 自动启动网关：`openclaw gateway --port 18789 --verbose`  

### 3.1 执行步骤

在 PowerShell 中进入脚本目录后运行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\openclaw_安装并启动.ps1
```

启动成功后你会看到：

- Gateway 地址：`http://127.0.0.1:18789/`
- 日志提示：`Press Ctrl+C to stop.`

---

## 4. 日常使用流程（给学员）

### 4.1 启动服务

方式 A（推荐）：直接运行脚本

```powershell
.\openclaw_安装并启动.ps1
```

方式 B（已安装后手动启动）：

```powershell
openclaw gateway --port 18789 --verbose
```

### 4.2 访问与验证

1. 浏览器打开：`http://127.0.0.1:18789/`  
2. 查看是否能正常加载 Dashboard  
3. 观察终端日志是否持续输出且无报错  

### 4.3 停止服务

在运行终端按 `Ctrl + C`。  

---

## 5. 飞书配置（培训重点）

> 说明：不同团队接入方式可能不同。培训建议分为“机器人 Webhook 模式”和“飞书应用 Bot 模式”两类讲解。

## 5.1 方案 A：机器人 Webhook（快速接入）

适合：先快速打通消息链路，验证告警/通知。

步骤：

1. 在飞书群中添加自定义机器人  
2. 获取机器人 Webhook 地址  
3. 在 OpenClaw 配置中填写该 Webhook（字段名以你们实际配置为准）  
4. 保存后重启 Gateway  
5. 发送测试消息并确认群内能收到  

建议配置项示例（按你们系统实际字段调整）：

```yaml
feishu:
  enabled: true
  mode: webhook
  webhook_url: "https://open.feishu.cn/open-apis/bot/v2/hook/xxxx"
```

## 5.2 方案 B：飞书应用 Bot（标准化接入）

适合：后续需要更完整权限控制、用户身份能力与可扩展集成。

步骤：

1. 在飞书开放平台创建企业自建应用  
2. 开启机器人能力并发布版本  
3. 配置事件订阅（如消息接收、回调）  
4. 获取 `App ID` 与 `App Secret`  
5. 在 OpenClaw 配置中填写凭据并启用签名校验（若有）  
6. 重启 Gateway 并执行联调测试  

建议配置项示例（按你们系统实际字段调整）：

```yaml
feishu:
  enabled: true
  mode: app_bot
  app_id: "cli_xxx"
  app_secret: "xxx"
  encrypt_key: ""
  verification_token: ""
```

---

## 6. 联调验收清单（培训结束前逐项打勾）

- [ ] Node.js 版本 >= 22  
- [ ] `openclaw` 安装成功  
- [ ] Gateway 成功启动且 Dashboard 可访问  
- [ ] 飞书配置项填写完整  
- [ ] 测试消息成功发送到目标群或目标用户  
- [ ] 重启后配置仍生效  

---

## 7. 常见问题与处理

### 7.1 提示 Node.js 版本过低

现象：脚本报错 `Node.js >= 22 required`。  
处理：升级 Node.js 后重新执行脚本。

### 7.2 `npm install -g openclaw@latest` 失败

常见原因：

- 网络受限
- npm 源不可达
- 权限不足

建议：

1. 先检查网络与代理  
2. 必要时切换 npm 镜像源  
3. 使用管理员权限 PowerShell 重试  

### 7.3 飞书收不到消息

排查顺序：

1. 检查 OpenClaw 终端日志是否发送成功  
2. 检查 Webhook 是否过期或被重置  
3. 检查飞书应用权限、发布状态、可用范围  
4. 检查签名密钥/Token 是否一致  

---

## 8. 培训讲师建议流程（60 分钟）

1. 10 分钟：背景与目标介绍  
2. 15 分钟：现场安装与启动演示  
3. 20 分钟：飞书两种接入方式实操  
4. 10 分钟：联调验收清单走查  
5. 5 分钟：常见问题答疑  

---

## 9. 讲师备注

- 若你们团队已确定唯一接入方式，建议删除另一种配置说明，避免学员混淆。  
- 培训前请准备“可用飞书测试群 + 可用凭据”，减少现场等待时间。  

