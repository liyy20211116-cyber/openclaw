@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%"
call "%ROOT%OpenClaw控制台.bat"
