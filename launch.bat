@echo off
setlocal

cd /d "%~dp0"

echo ==============================
echo        TabAware Launcher
echo ==============================
echo.

REM Check Node
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js first.
    pause
    exit /b
)

REM Check npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found.
    pause
    exit /b
)

REM Install dependencies
echo [1/4] Installing dependencies...
call npm install

REM Ensure required packages
echo [2/4] Installing required packages...
call npm install bcryptjs jsonwebtoken cors express sqlite3

REM Start server
echo [3/4] Starting server...
start "TabAware Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

REM Wait for server to boot
timeout /t 6 >nul

REM Open app
echo [4/4] Opening app...
start http://localhost:3000

REM Open Chrome extensions page properly
start chrome "chrome://extensions/"

echo.
echo ==============================
echo  If extension not working:
echo  1. Click Reload in chrome://extensions
echo  2. Check background console
echo ==============================
echo.

pause
endlocal