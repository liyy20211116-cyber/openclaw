@echo off
chcp 65001 >nul
cd /d D:\FY003
powershell -NoProfile -ExecutionPolicy Bypass -File ".\openclaw_仅启动.ps1"
