# OpenClaw 安装与启动步骤

## 1. 推荐方式（培训现场）

学员使用一键脚本：

```powershell
.\一键启动.bat
```

它会执行：

- 检查 Node.js 版本是否 >= 22
- 如果本机未安装 `openclaw`，自动安装 `openclaw@latest`
- 如果本机已安装 `openclaw`，直接启动 Gateway
- 启动 `openclaw gateway --port 18789 --verbose`

如果需要直接运行底层英文脚本，可使用：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\OpenClaw快速启动.ps1
```

## 2. 管理员方式（自己日常使用）

如果需要查看状态、重启、停止或打开面板，使用：

```powershell
.\OpenClaw控制台.bat
```

它会进入管理菜单，可执行启动、重启、停止、查看状态等操作。
如果打开 Dashboard 后提示输入 token，脚本会自动把 Gateway token 复制到剪贴板。

## 3. 手动方式（备用）

```powershell
npm install -g openclaw@latest
openclaw gateway --port 18789 --verbose
```

## 4. 成功标志

- 终端出现启动日志且无阻断报错
- 可访问 `http://127.0.0.1:18789/`

## 5. 日常最短启动流程

```powershell
openclaw gateway stop
openclaw gateway --port 18789 --verbose
```

## 6. 常用命令

```powershell
openclaw gateway status
openclaw logs --follow
openclaw gateway stop
```

## 7. 停止服务

在运行窗口按 `Ctrl + C`。
