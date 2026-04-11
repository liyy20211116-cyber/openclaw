@echo off
chcp 65001 >nul 2>&1
title Jarvis 一人公司操作系统
cd /d "%~dp0"

echo.
echo   Jarvis 一人公司操作系统 - 正在启动桌面应用...
echo.

if not exist "node_modules\electron\cli.js" (
    echo   [!] 首次运行，正在安装依赖...
    call npm install
    echo.
)

if not exist "dist-electron\main.js" (
    echo   [!] 编译 Electron 主进程...
    call npx tsc -p tsconfig.electron.json
    echo.
)

echo   启动中，请稍候...
echo.

call npx tsx scripts/desktop-dev.ts
