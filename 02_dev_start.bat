@echo off
title Typrain Dev Server

cd /d "%~dp0"

echo ========================================
echo  Typrain Dev Server
echo ========================================
echo.

REM ===== Check node =====
where node > nul 2>nul
if errorlevel 1 (
    echo [ERROR] node not found.
    echo Run 01_setup_node.bat first as Administrator.
    pause
    exit /b 1
)

REM ===== npm install if node_modules missing =====
if not exist "node_modules\" (
    echo [First run] Installing dependencies, takes 1 to 2 min ...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [FAIL] npm install failed.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed.
    echo.
)

echo --------------------------------------------------
echo  Dev server starting at http://localhost:5173
echo  Browser will open automatically.
echo  Press Ctrl+C then Y to stop the server.
echo --------------------------------------------------
echo.

call npm run dev

echo.
echo (Dev server stopped.)
pause
