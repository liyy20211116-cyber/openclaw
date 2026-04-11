@echo off
setlocal

set "ROOT=D:\FY003"
set "PS1=%ROOT%\scripts\build_video.ps1"

if not exist "%PS1%" (
  echo [ERROR] Not found: %PS1%
  echo.
  pause
  exit /b 1
)

cd /d "%ROOT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo [ERROR] build_video.ps1 failed with code %EXITCODE%
  pause
  exit /b %EXITCODE%
)

echo.
echo [OK] Build video finished.
pause
exit /b 0
