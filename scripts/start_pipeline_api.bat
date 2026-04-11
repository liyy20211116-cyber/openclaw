@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0.."
set "PY=%ROOT%\scripts\pipeline_api.py"

if not exist "%PY%" (
    echo [ERROR] Not found: %PY%
    exit /b 1
)

:: Check if already running on port 18781
powershell -NoProfile -Command ^
  "if (Get-NetTCPConnection -LocalPort 18781 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] Pipeline API is already running on port 18781.
    exit /b 0
)

start "Pipeline API" /min py -3 "%PY%"
echo [OK] Pipeline API started on http://127.0.0.1:18781
exit /b 0
