@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set "ROOT=%~dp0"
set "DOC_INDEX=%ROOT%README.md"
set "DOC_ENV=%ROOT%01_安装环境要求.md"
set "DOC_INSTALL=%ROOT%02_OpenClaw安装与启动.md"
set "DOC_CONFIG=%ROOT%03_OpenClaw配置说明.md"
set "DOC_FEISHU=%ROOT%04_飞书接入配置与联调.md"
set "CHECK_PS1=%ROOT%openclaw_飞书联调自检.ps1"

echo ============================================================
echo OpenClaw 飞书培训一键启动
echo ============================================================
echo.
echo [1/6] 打开培训文档（安装 / 使用 / 配置 / 飞书打通）
if exist "%DOC_INDEX%" start "" "%DOC_INDEX%"
if exist "%DOC_ENV%" start "" "%DOC_ENV%"
if exist "%DOC_INSTALL%" start "" "%DOC_INSTALL%"
if exist "%DOC_CONFIG%" start "" "%DOC_CONFIG%"
if exist "%DOC_FEISHU%" start "" "%DOC_FEISHU%"

echo.
echo [2/6] 检查 Node.js 与 npm
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Node.js，请先安装 Node.js ^>= 22: https://nodejs.org/
  exit /b 1
)
for /f %%v in ('node -v') do set "NODE_VER=%%v"
echo [INFO ] 当前 Node.js 版本: %NODE_VER%
for /f "tokens=1 delims=." %%m in ("%NODE_VER:v=%") do set "NODE_MAJOR=%%m"
if "%NODE_MAJOR%"=="" (
  echo [ERROR] 无法解析 Node.js 版本
  exit /b 1
)
if %NODE_MAJOR% LSS 22 (
  echo [ERROR] Node.js 版本过低，需要 ^>= 22
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 npm，请修复 Node.js 安装后重试
  exit /b 1
)
echo [ OK  ] Node.js / npm 检查通过

echo.
echo [3/6] 检查并安装 OpenClaw（如未安装）
where openclaw >nul 2>nul
if errorlevel 1 (
  echo [INFO ] 未检测到 openclaw，开始安装 openclaw@latest ...
  call npm install -g openclaw@latest
  if errorlevel 1 (
    echo [ERROR] openclaw 安装失败，请检查网络或 npm 源后重试
    exit /b 1
  )
) else (
  echo [ OK  ] 已检测到 openclaw
)

echo.
echo [4/6] 安装 Feishu 插件
call openclaw plugins install @openclaw/feishu
if errorlevel 1 (
  echo [WARN ] Feishu 插件安装失败，可能是网络问题，可稍后手动执行:
  echo        openclaw plugins install @openclaw/feishu
)

echo.
echo [5/6] 运行飞书联调自检（如脚本存在）
if exist "%CHECK_PS1%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CHECK_PS1%"
) else (
  echo [WARN ] 未找到自检脚本: %CHECK_PS1%
)

echo.
echo [6/6] 输出培训实操命令
echo ------------------------------------------------------------
echo A. 安装与启动（如需）
echo    npm install -g openclaw@latest
echo    openclaw gateway --port 18789 --verbose
echo.
echo B. 飞书配置（交互）
echo    openclaw channels add
echo.
echo C. 应用配置后重启
echo    openclaw gateway restart
echo    openclaw gateway status
echo.
echo D. 联调与日志
echo    openclaw logs --follow
echo    openclaw pairing list feishu
echo    openclaw pairing approve feishu ^<配对码^>
echo ------------------------------------------------------------
echo.
echo [DONE ] 培训启动准备完成，可按已打开文档开始实操。
exit /b 0

