@echo off
setlocal

set "ROOT=D:\FY003"
set "DAILY_PS1=%ROOT%\scripts\run_daily.ps1"
set "BUILD_PS1=%ROOT%\scripts\build_video.ps1"

if not exist "%DAILY_PS1%" (
  echo [ERROR] Not found: %DAILY_PS1%
  pause
  exit /b 1
)

if not exist "%BUILD_PS1%" (
  echo [ERROR] Not found: %BUILD_PS1%
  pause
  exit /b 1
)

cd /d "%ROOT%"

echo [STEP 1/2] Run daily pipeline...
powershell -NoProfile -ExecutionPolicy Bypass -File "%DAILY_PS1%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo [ERROR] run_daily.ps1 failed with code %EXITCODE%
  pause
  exit /b %EXITCODE%
)

echo [STEP 2/2] Build video...
powershell -NoProfile -ExecutionPolicy Bypass -File "%BUILD_PS1%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo [ERROR] build_video.ps1 failed with code %EXITCODE%
  pause
  exit /b %EXITCODE%
)

echo.
echo [OK] Full pipeline finished.
echo Output folder: D:\FY003\output
pause
exit /b 0
