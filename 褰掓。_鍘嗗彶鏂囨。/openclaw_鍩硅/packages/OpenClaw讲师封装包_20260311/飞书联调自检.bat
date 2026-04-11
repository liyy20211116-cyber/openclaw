@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%飞书联调自检.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo 自检未通过，请根据上面的提示先修复环境。
)
pause
exit /b %EXIT_CODE%
