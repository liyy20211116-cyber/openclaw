@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%OpenClaw快速启动.ps1"
