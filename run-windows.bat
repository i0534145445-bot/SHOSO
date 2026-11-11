@echo off
chcp 65001 >nul
title SHOSO Music
cd /d "%~dp0"

echo ================================================
echo   SHOSO Music - Windows desktop music player
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Download the LTS installer from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies, this can take a few minutes...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo Starting SHOSO Music...
call npm run start:app
if errorlevel 1 pause
