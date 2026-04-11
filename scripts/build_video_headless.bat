@echo off
setlocal

set "ROOT=D:\FY003"
set "PS1=%ROOT%\scripts\build_video.ps1"

if not exist "%PS1%" exit /b 1

cd /d "%ROOT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
exit /b %ERRORLEVEL%
