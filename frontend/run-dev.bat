@echo off
REM Run Next.js dev server in a new terminal window and open browser
cd /d "%~dp0"
echo Checking Node and npm...
node -v >nul 2>&1
if errorlevel 1 (
    echo Node is not installed or not found in PATH
    pause
    exit /b 1
)
npm -v >nul 2>&1
if errorlevel 1 (
    echo npm is not installed or not found in PATH
    pause
    exit /b 1
)

set "PORT=3001"
echo Starting Next.js dev server on port %PORT%...
start "Next.js (dev)" cmd /k npm run dev

REM Wait briefly, then open the browser to the app
timeout /t 2 /nobreak >nul
start http://localhost:%PORT%

exit /b 0