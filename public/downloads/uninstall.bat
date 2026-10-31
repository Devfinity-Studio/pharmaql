@echo off
setlocal
cd /d "%~dp0"
title PharmaQL API Server - Service Uninstaller

echo ========================================================
echo  PharmaQL API Server - Windows Service Uninstaller
echo ========================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [PharmaQL Installer] Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/k ""%~dpnx0""' -Verb RunAs"
    exit /b
)

"%~dp0api-server.exe" --uninstall
echo.
pause
