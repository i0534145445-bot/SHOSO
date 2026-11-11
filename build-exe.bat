@echo off
chcp 65001 >nul
title SHOSO Music - Build Windows EXE
cd /d "%~dp0"

echo ==================================================
echo   SHOSO Music - creating a Windows .exe
echo   (installer + portable, saved in the release folder)
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install the LTS build from https://nodejs.org, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install || goto :fail
)

echo.
echo Building SHOSO Music for Windows...
call npm run dist || goto :fail

echo.
echo Done! Your files are here:
dir /b release\*.exe
echo.
start "" "%~dp0release"
pause
exit /b 0

:fail
echo.
echo [ERROR] The build failed. Copy the messages above for support.
pause
exit /b 1
