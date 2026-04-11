# OpenClaw 安装与启动步骤

## 1. 推荐方式（培训现场）

使用一键脚本：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\openclaw_安装并启动.ps1
```

脚本会执行：

- 检查 Node.js 版本是否 >= 22
- 安装 `openclaw@latest`
- 启动 `openclaw gateway --port 18789 --verbose`

## 2. 手动方式（备用）

```powershell
npm install -g openclaw@latest
openclaw gateway --port 18789 --verbose
```

## 3. 成功标志

- 终端出现启动日志且无阻断报错
- 可访问 `http://127.0.0.1:18789/`

## 4. 日常最短启动流程

```powershell
cd D:\FY003
openclaw gateway stop
openclaw gateway --port 18789 --verbose
```

## 5. 常用命令

```powershell
openclaw gateway status
openclaw logs --follow
openclaw gateway stop
```

## 6. 停止服务

在运行窗口按 `Ctrl + C`。
