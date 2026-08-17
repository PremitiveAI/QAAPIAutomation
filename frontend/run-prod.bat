@echo off
REM Build and start Next.js production server in a new terminal window and open browser
cd /d "%~dp0"
echo Checking Node and npm...
node -v >nul 2>&1 || (echo Node is not installed or not found in PATH & pause & exit /b 1)
npm -v >nul 2>&1 || (echo npm is not installed or not found in PATH & pause & exit /b 1)

echo Building app (this may take a minute)...
npm run build || (echo Build failed & pause & exit /b 1)

echo Starting production server...
start "Next.js (prod)" cmd /k "npm run start"

REM Open browser once server is started (port 3000 by default)
start http://localhost:3000

exit /b 0