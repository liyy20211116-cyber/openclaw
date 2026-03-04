# OpenClaw 培训手册（公司定制版）

> 用途：用于公司内部统一培训，讲师可按本模板直接授课。  
> 说明：文中所有 `{{...}}` 为待替换项，请在培训前完成替换。

---

## 1. 培训基本信息

- 培训主题：OpenClaw 安装、使用、飞书接入
- 培训对象：`{{部门/角色}}`
- 讲师：`{{讲师姓名}}`
- 培训时长：`{{60}}` 分钟
- 培训日期：`{{YYYY-MM-DD}}`
- 培训环境：Windows + PowerShell

---

## 2. 统一环境基线（公司标准）

### 2.1 软件版本

- Node.js：`{{>=22，建议22.x LTS}}`
- npm：`{{>=10}}`
- OpenClaw：`latest`

### 2.2 固定端口与地址

- Gateway 端口：`18789`
- Dashboard 地址：`http://127.0.0.1:18789/`

### 2.3 启动脚本（公司统一）

- 脚本文件：`openclaw_安装并启动.ps1`
- 脚本作用：
  - 检查 Node.js 版本（>=22）
  - 安装 `openclaw@latest`
  - 启动 `openclaw gateway --port 18789 --verbose`

---

## 3. 讲师课前准备清单（必须完成）

- [ ] 准备培训机器并确认可联网
- [ ] 校验 Node.js 与 npm 版本
- [ ] 本地可成功运行 `openclaw_安装并启动.ps1`
- [ ] 准备飞书测试群：`{{群名称}}`
- [ ] 准备飞书配置凭据（Webhook 或 App ID/Secret）
- [ ] 准备演示账号：`{{演示账号}}`
- [ ] 准备截图素材（可选）：安装成功、Dashboard、飞书消息到达

---

## 4. 培训流程（讲师版）

## 4.1 第 1 阶段：安装与启动（15 分钟）

讲师口径：

1. 先解释依赖约束：Node.js 必须 >= 22  
2. 演示脚本一键安装与启动  
3. 展示成功标志（Dashboard 可访问、终端无报错）  

演示命令：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\openclaw_安装并启动.ps1
```

验收标准：

- 终端出现 `Install done. Starting Gateway on port 18789...`
- 浏览器可打开 `http://127.0.0.1:18789/`

## 4.2 第 2 阶段：日常使用（10 分钟）

讲师口径：

1. 说明“启动、验证、停止”三步法  
2. 强调日志查看习惯与异常定位顺序  

演示命令：

```powershell
openclaw gateway --port 18789 --verbose
```

停止方式：

- 运行窗口按 `Ctrl + C`

## 4.3 第 3 阶段：飞书接入（20 分钟）

讲师口径：

1. 快速打通用 Webhook 模式  
2. 企业标准化接入用 App Bot 模式  
3. 两种模式均要做“发送测试消息”闭环验证  

---

## 5. 飞书配置参数总表（公司定制）

> 培训前请把以下信息填完整，避免现场卡顿。

| 配置项 | 值 | 负责人 | 备注 |
|---|---|---|---|
| 接入模式 | `{{webhook / app_bot}}` | `{{姓名}}` | 推荐先 webhook 后 app_bot |
| Webhook URL | `{{https://open.feishu.cn/open-apis/bot/v2/hook/...}}` | `{{姓名}}` | 仅 webhook 模式 |
| App ID | `{{cli_xxx}}` | `{{姓名}}` | 仅 app_bot 模式 |
| App Secret | `{{xxx}}` | `{{姓名}}` | 仅 app_bot 模式 |
| Verification Token | `{{xxx}}` | `{{姓名}}` | 仅 app_bot 模式 |
| Encrypt Key | `{{xxx}}` | `{{姓名}}` | 若启用加密 |
| 测试群名称 | `{{OpenClaw-测试群}}` | `{{姓名}}` | 用于验收 |

---

## 6. 飞书配置模板（直接替换）

## 6.1 Webhook 模式模板

```yaml
feishu:
  enabled: true
  mode: webhook
  webhook_url: "{{WEBHOOK_URL}}"
```

## 6.2 App Bot 模式模板

```yaml
feishu:
  enabled: true
  mode: app_bot
  app_id: "{{APP_ID}}"
  app_secret: "{{APP_SECRET}}"
  verification_token: "{{VERIFICATION_TOKEN}}"
  encrypt_key: "{{ENCRYPT_KEY}}"
```

---

## 7. 学员实操任务（课堂）

任务 A：启动并验证 Gateway

- [ ] 成功运行 `openclaw_安装并启动.ps1`
- [ ] 成功打开 Dashboard
- [ ] 截图保存：`{{学员名}}_gateway_ok.png`

任务 B：完成飞书接入并验证

- [ ] 填写飞书配置
- [ ] 重启服务
- [ ] 成功收到测试消息
- [ ] 截图保存：`{{学员名}}_feishu_ok.png`

---

## 8. 故障排查 SOP（统一话术）

### 8.1 安装失败

- 检查 Node.js 版本是否满足要求
- 检查网络与 npm 源可达性
- 以管理员 PowerShell 重新执行

### 8.2 服务启动失败

- 检查端口 `18789` 是否被占用
- 检查 `openclaw` 是否安装成功
- 查看终端错误日志关键字（error、failed、permission）

### 8.3 飞书消息收不到

- 检查配置值是否有空格或粘贴错误
- 检查飞书应用发布状态和权限范围
- 检查签名密钥与 Token 是否一致
- 先用 webhook 验证链路，再切换 app_bot

---

## 9. 培训结束验收（讲师签字）

- [ ] 参训人数：`{{N}}`
- [ ] 实操通过人数：`{{M}}`
- [ ] 通过率：`{{M/N}}`
- [ ] 典型问题已复盘
- [ ] 后续支持人已指定：`{{姓名}}`

讲师签字：`{{签字}}`  
日期：`{{YYYY-MM-DD}}`

---

## 10. 你下一步只需做三件事

1. 将本文所有 `{{...}}` 替换为你们真实信息  
2. 用真实配置跑一遍完整链路（安装 -> 启动 -> 飞书收消息）  
3. 把此文作为培训统一讲义发给学员  
