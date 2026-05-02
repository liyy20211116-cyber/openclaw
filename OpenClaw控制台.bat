@echo off
chcp 65001 >nul
title OpenClaw 控制台
set "ROOT=%~dp0"
cd /d "%ROOT%"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%openclaw_console.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo 控制台退出码: %EXIT_CODE%
  pause
  exit /b %EXIT_CODE%
)
exit /b 0
