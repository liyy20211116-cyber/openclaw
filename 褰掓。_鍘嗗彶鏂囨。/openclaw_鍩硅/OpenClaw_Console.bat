@echo off
chcp 65001 >nul
title OpenClaw Console
set "ROOT=%~dp0"
cd /d "%ROOT%"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%openclaw_console.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Console launcher failed with exit code %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)
