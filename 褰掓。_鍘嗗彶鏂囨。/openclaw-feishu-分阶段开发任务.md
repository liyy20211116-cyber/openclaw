# OpenClaw + 飞书机器人分阶段开发任务清单

## 使用说明

- 本清单用于实际执行，不是讨论稿。
- 每个任务包含：输入、动作、命令、产出、验收、回滚。
- 仅在当前阶段验收通过后进入下一阶段。

## 阶段总览

- P0：安全与治理基线确认
- P1：环境与依赖部署
- P2：OpenClaw 安装与模型认证（ChatGPT OAuth）
- P3：飞书应用配置与通道绑定
- P4：联调验收与灰度上线
- P5：稳态运维与优化

---

## P0：安全与治理基线确认（必须先做）

### 任务 P0-1：凭据治理

- 输入：飞书 `App ID`、`App Secret`
- 动作：
  - 立即轮换飞书 `App Secret`
  - 只保存在本机环境变量或本地 `.env`
  - 从历史文档/聊天中清理旧密钥
- 产出：新密钥生效且仅本地可见
- 验收：
  - 未在仓库和文档中发现明文 `App Secret`
  - 飞书控制台显示新密钥可用
- 回滚：无（如异常，再次轮换）

### 任务 P0-2：范围与触发策略确认

- 动作：
  - 固定群聊仅 `@机器人` 触发
  - 固定白名单（用户/群）
- 产出：策略写入配置基线
- 验收：未命中白名单不触发

---

## P1：环境与依赖部署

### 任务 P1-1：基础环境检查

- 动作：检查 Windows + WSL2 + Node 版本
- 命令（WSL2）：
  - `node -v`
  - `npm -v`
- 验收：
  - Node >= 22
  - npm 可用

### 任务 P1-2：项目运行目录与环境变量

- 动作：
  - 创建固定运行目录
  - 创建 `.env`（本地，不入库）
- 模板：
  - `FEISHU_APP_ID=...`
  - `FEISHU_APP_SECRET=...`
- 验收：
  - `.env` 存在且内容正确
  - 已加入忽略规则（如使用 git）

---

## P2：OpenClaw 安装与模型认证（ChatGPT OAuth）

### 任务 P2-1：安装 OpenClaw

- 命令（WSL2）：
  - `npm install -g openclaw@latest`
  - `openclaw onboard --install-daemon`
- 产出：OpenClaw CLI + Gateway daemon
- 验收：
  - `openclaw --version` 可用
  - `openclaw doctor` 无阻断错误

### 任务 P2-2：模型 OAuth 认证

- 命令：
  - `openclaw models auth login --provider openai-codex`
  - `openclaw models set openai-codex/gpt-5.3-codex`
  - `openclaw models list`
- 验收：
  - 默认模型是 `openai-codex/gpt-5.3-codex`
  - OAuth 状态有效

### 任务 P2-3：网关启动基线

- 命令：
  - `openclaw gateway --port 18789 --verbose`
- 验收：
  - 网关成功启动
  - 日志中无持续性报错

---

## P3：飞书应用配置与通道绑定

### 任务 P3-1：飞书应用能力配置

- 动作：
  - 开启机器人能力
  - 开启事件订阅（按 OpenClaw 当前支持模式）
  - 最小权限开通（消息收发）
  - 机器人加入测试群
- 验收：
  - 飞书侧显示机器人在线可交互

### 任务 P3-2：OpenClaw 通道配置

- 动作：
  - 通过环境变量注入 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`
  - 打开群聊 mention gating
  - 配置 allowlist
- 验收：
  - OpenClaw 启动日志显示飞书通道初始化成功

---

## P4：联调验收与灰度上线

### 任务 P4-1：联调用例执行

- 用例：
  1. 私聊消息 -> 正常回复
  2. 群聊不 @ -> 不触发
  3. 群聊 @ -> 正常回复
  4. 多轮对话 -> 上下文连贯
- 验收：
  - 核心用例全部通过

### 任务 P4-2：灰度策略

- 动作：
  - 先放开 1 个用户 + 1 个群
  - 观察 24 小时日志和 token 消耗
- 验收：
  - 无高频错误
  - 成本在预期范围

---

## P5：稳态运维与优化

### 任务 P5-1：运维固化

- 动作：
  - daemon 常驻与开机自启确认
  - 日志留存周期设置
  - 每周健康检查（`openclaw doctor`）
- 验收：
  - 异常可定位、可恢复

### 任务 P5-2：安全与成本优化

- 动作：
  - 周期轮换 Secret（30~90 天）
  - 审查白名单
  - 响应长度/重试策略微调
- 验收：
  - 触发范围可控
  - token 消耗可控

---

## 建议执行节奏（3 天）

- Day 1：P0 + P1 + P2
- Day 2：P3 + P4
- Day 3：P5 + 复盘

---

## 执行状态（由实施过程更新）

- [x] 已完成：需求基线文档
- [x] 已完成：详细落地方案文档
- [ ] 待完成：P0 凭据轮换（用户后续自行执行）
- [x] 已完成：P1 环境核验（Node v22.17.1 / npm 10.9.2）
- [x] 已完成：P2 OpenClaw 安装与 OAuth（`openai-codex` 已完成 OAuth）
- [x] 已完成：P3 飞书绑定（`channels status --probe` 显示 configured/running/works）
- [~] 进行中：P4 联调验收（待完成私聊/群聊@真实消息回归）
- [ ] 待完成：P5 稳态优化
