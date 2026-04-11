@echo off
setlocal

echo [STEP] Check existing ffmpeg...
where ffmpeg >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  for /f "delims=" %%i in ('where ffmpeg') do (
    echo [OK] ffmpeg found: %%i
    goto :done
  )
)

echo [STEP] Try install by winget...
where winget >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  winget install -e --id Gyan.FFmpeg
  if "%ERRORLEVEL%"=="0" goto :recheck
)

echo [STEP] winget failed or unavailable, try chocolatey...
where choco >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  choco install ffmpeg -y
  if "%ERRORLEVEL%"=="0" goto :recheck
)

echo [WARN] Auto install failed.
echo [HINT] Manual option:
echo 1) Download ffmpeg static build and unzip to D:\ffmpeg\bin\ffmpeg.exe
echo 2) Re-run: D:\FY003\scripts\build_video.bat
goto :end

:recheck
echo [STEP] Re-check ffmpeg...
where ffmpeg >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  for /f "delims=" %%i in ('where ffmpeg') do echo [OK] ffmpeg found: %%i
  goto :done
)

if exist "D:\ffmpeg\bin\ffmpeg.exe" (
  echo [OK] ffmpeg found: D:\ffmpeg\bin\ffmpeg.exe
  goto :done
)

echo [WARN] ffmpeg still not found in PATH.
echo [HINT] Open a new terminal and run: where ffmpeg
goto :end

:done
echo [OK] Now run:
echo   D:\FY003\scripts\build_video.bat

:end
pause
exit /b 0
