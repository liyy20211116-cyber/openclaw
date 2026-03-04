# 复现图片中的 OpenClaw Gateway Dashboard 前端

图片中的界面是 **OpenClaw Gateway Dashboard（Control UI）**，即技能管理、聊天、频道等页面的那个前端。相关前端在 OpenClaw 仓库的 **`ui/`** 目录，由 **Vite + Lit** 构建，通过 **Gateway** 提供。

---

## 最快方式（推荐）

**前提**：本机已安装 **Node.js ≥ 22**（[下载](https://nodejs.org/)）。

| 场景 | 操作 |
|------|------|
| 首次安装并启动 | 先 `cd D:\FY003`，再执行 `.\openclaw_安装并启动.ps1` |
| 已安装，只启动 | 先 `cd D:\FY003`，再执行 `.\openclaw_仅启动.ps1` |
| 任意目录执行 | `& "D:\FY003\openclaw_安装并启动.ps1"` 或 `& "D:\FY003\openclaw_仅启动.ps1"` |
| 手动一条命令 | `npm install -g openclaw@latest` → `openclaw gateway --port 18789` |

启动后在浏览器打开：**http://127.0.0.1:18789/** 即可看到与图片一致的 Dashboard。

---

## 方式一：直接使用（推荐，和图片一致）

想得到**和图片一模一样**的前端，只需安装并运行 OpenClaw Gateway，Control UI 会由 Gateway 自动提供。

### 1. 安装 OpenClaw

- 需要 **Node ≥ 22**。
- 全局安装：

```bash
npm install -g openclaw@latest
# 或：pnpm add -g openclaw@latest
```

### 2. 首次配置（可选）

```bash
openclaw onboard --install-daemon
```

按向导完成 Gateway、工作区、频道、技能等配置。

### 3. 启动 Gateway

```bash
openclaw gateway --port 18789 --verbose
```

### 4. 打开前端（和图片一致）

在浏览器访问：

- **http://127.0.0.1:18789/**  
  或 **http://localhost:18789/**

即可看到与图片相同的 **OPENCLAW GATEWAY DASHBOARD**（顶栏 Logo、版本/健康状况、导航标签「聊天」「概览」「频道」「实例」「会话」「使用情况」「定时任务」「代理」「技能」以及「已安装技能」卡片等）。

- 首次连接若提示配对，在终端执行：`openclaw devices list` → `openclaw devices approve <requestId>`。
- 文档说明：[Control UI - Quick open (local)](https://docs.openclaw.ai/control-ui)。

---

## 方式二：从源码构建/开发同一套前端

若需要**查看或修改**这套前端的代码（例如改样式、加页面），可以从源码构建。

### 1. 克隆仓库

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

### 2. 安装依赖（推荐 pnpm）

```bash
pnpm install
```

### 3. 构建前端

```bash
pnpm ui:build
```

首次运行会自动安装 `ui/` 下依赖；构建产物在 **`dist/control-ui`**，由 Gateway 在运行时提供。

### 4. 运行 Gateway 并访问

```bash
pnpm build
pnpm openclaw gateway --port 18789
```

浏览器打开：**http://127.0.0.1:18789/** ，界面与图片一致。

### 5. 仅前端开发（Vite 热更新）

不打包，用 Vite 开发服务器，并连接已有 Gateway：

```bash
pnpm ui:dev
```

浏览器打开例如：

- **http://localhost:5173/**  
  若 Gateway 在别的机器/端口，可加参数：  
  **http://localhost:5173/?gatewayUrl=ws://<网关主机>:18789**

前端源码位置：**`openclaw/ui/`**，主要技术：

- **Vite 7**：构建与开发服务器  
- **Lit**：组件与页面  
- 入口：`ui/index.html`，逻辑在 `ui/src/`

---

## 相关链接

| 说明     | 链接 |
|----------|------|
| OpenClaw 仓库 | https://github.com/openclaw/openclaw |
| 前端目录 | https://github.com/openclaw/openclaw/tree/main/ui |
| Control UI 文档 | https://docs.openclaw.ai/control-ui |
| 模型/提供商文档 | https://docs.openclaw.ai/concepts/model-providers |

---

## 小结

- **只要和图片一样的前端**：安装 `openclaw` → 运行 `openclaw gateway` → 浏览器打开 **http://127.0.0.1:18789/** 即可。
- **要改前端或学习实现**：克隆 [openclaw/openclaw](https://github.com/openclaw/openclaw)，在根目录执行 `pnpm ui:build` 或 `pnpm ui:dev`，代码在 **`ui/`** 目录。
