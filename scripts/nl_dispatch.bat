@echo off
setlocal

chcp 65001 >nul

set "ROOT=D:\FY003"
set "PS1=%ROOT%\scripts\nl_dispatch.ps1"

if "%~1"=="" (
  echo Usage: nl_dispatch.bat "你的自然语言指令"
  exit /b 2
)

if not exist "%PS1%" (
  echo [ERROR] Not found: %PS1%
  exit /b 1
)

set "NLD_TEXT=%*"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
exit /b %ERRORLEVEL%
