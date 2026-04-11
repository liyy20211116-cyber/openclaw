@echo off
chcp 65001 >nul
title OpenClaw Quick Start
set "ROOT=%~dp0"
cd /d "%ROOT%"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%openclaw_quickstart.ps1"
