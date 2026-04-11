@echo off
chcp 65001 >nul
title OpenClaw 重新登录
set "ROOT=%~dp0"
cd /d "%ROOT%"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%openclaw_reauth.ps1"
if not "%ERRORLEVEL%"=="0" (
  echo.
  echo 重新登录时出现错误，错误码: %ERRORLEVEL%
  pause
  exit /b %ERRORLEVEL%
)
pause
