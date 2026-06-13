@echo off
title TypRun Build

cd /d "%~dp0"

echo ========================================
echo  TypRun Production Build
echo ========================================
echo.

REM ===== Check node =====
where node >nul 2>nul
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

REM ===== Clean previous build =====
if exist "dist\" (
    echo [Clean] Removing old dist folder ...
    rmdir /s /q dist
)

echo --------------------------------------------------
echo  Building production bundle ...
echo --------------------------------------------------
echo.

call npm run build
if errorlevel 1 (
    echo.
    echo [FAIL] Build failed. See errors above.
    pause
    exit /b 1
)

echo.
echo ==================================================
echo  [SUCCESS] Build complete.
echo.
echo  Output folder: %~dp0dist
echo.
echo  Upload the CONTENTS of the "dist" folder to the site webroot:
echo    https://typrun.com/   (same place as typrain_api / typrain_admin)
echo  (base is "/" so upload dist contents directly into webroot)
echo ==================================================
echo.

REM ===== Open dist folder in Explorer =====
start "" "%~dp0dist"

pause
