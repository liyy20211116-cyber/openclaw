@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%open_training_courseware.ps1"
