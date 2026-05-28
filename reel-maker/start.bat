@echo off
REM Double-click launcher for Windows. Opens the Reel Maker and your browser.
cd /d "%~dp0"

echo ==============================
echo    Reel Maker - starting up
echo ==============================
echo.

REM 1. Node installed?
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install the LTS version from https://nodejs.org , then run this again.
  echo.
  pause
  exit /b 1
)

REM 2. First run? install dependencies (downloads packages + a headless browser).
if not exist node_modules (
  echo First run - installing dependencies ^(this takes a few minutes^)...
  call npm install
  if errorlevel 1 ( echo Install failed. & pause & exit /b 1 )
  echo.
)

REM 3. API key present? (only needed for AI story / refine features)
if not exist .env (
  echo NOTE: no .env file found - AI features will be off.
  echo       Create a file named .env containing:  ANTHROPIC_API_KEY=sk-ant-...
  echo.
)

REM 4. Tidy old renders so the disk doesn't fill up.
call node tools/cleanup.mjs >nul 2>nul

REM 5. Start the server in its own window, then open the browser.
echo Starting the server. Your browser will open in a few seconds.
echo Close the server window to stop the tool.
echo.
start "Reel Maker server" cmd /k "npm start"
timeout /t 5 >nul
start "" "http://localhost:4321"
exit /b 0
