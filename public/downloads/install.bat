@echo off
setlocal
cd /d "%~dp0"
title PharmaQL API Server - Windows Service Setup

echo ========================================================
echo  PharmaQL API Server - Windows Service Installation
echo ========================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [PharmaQL Installer] Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/k ""%~dpnx0""' -Verb RunAs"
    exit /b
)

echo [PharmaQL Installer] Running elevated service setup...
"%~dp0api-server.exe" --install --source-dir "%~dp0"
echo.
pause
