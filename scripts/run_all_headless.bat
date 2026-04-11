@echo off
setlocal

set "ROOT=D:\FY003"
set "DAILY=%ROOT%\scripts\run_daily_headless.bat"
set "BUILD=%ROOT%\scripts\build_video_headless.bat"

if not exist "%DAILY%" exit /b 1
if not exist "%BUILD%" exit /b 1

cd /d "%ROOT%"
call "%DAILY%"
if errorlevel 1 exit /b %ERRORLEVEL%

call "%BUILD%"
if errorlevel 1 exit /b %ERRORLEVEL%

exit /b 0
