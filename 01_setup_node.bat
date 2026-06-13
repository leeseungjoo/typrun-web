@echo off
title Typrain - Node.js Setup

REM ===== Auto-elevate to administrator =====
NET FILE 1>NUL 2>NUL
if '%errorlevel%' NEQ '0' (
    echo.
    echo Administrator rights required. Click [Yes] when prompted.
    echo.
    PowerShell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ========================================
echo  Typrain - Node.js 20.18.0 Setup
echo ========================================
echo.
echo  Run this script only once.
echo  Installs Node.js 20.18.0 LTS via nvm.
echo.
echo --------------------------------------------------
echo.

REM ===== Check nvm exists =====
where nvm > nul 2>nul
if errorlevel 1 (
    echo [ERROR] nvm-windows not found.
    echo Install from: https://github.com/coreybutler/nvm-windows/releases
    pause
    exit /b 1
)

REM ===== Install Node.js =====
echo [1/3] Downloading and installing Node.js 20.18.0 ...
call nvm install 20.18.0
if errorlevel 1 (
    echo.
    echo [FAIL] nvm install failed.
    pause
    exit /b 1
)
echo.

REM ===== Activate =====
echo [2/3] Activating Node.js 20.18.0 ...
call nvm use 20.18.0
if errorlevel 1 (
    echo.
    echo [FAIL] nvm use failed.
    pause
    exit /b 1
)
echo.

REM ===== Verify =====
echo [3/3] Verifying:
echo.
echo  node:
call node -v
echo  npm:
call npm -v
echo.
echo ==========================================
echo  Setup complete!
echo  Now double-click 02_dev_start.bat
echo ==========================================
echo.
pause
