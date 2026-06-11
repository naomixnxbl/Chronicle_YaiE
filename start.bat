@echo off
REM WSTI Reel Maker - launcher for Windows.
REM Double-click this file to start the app.
REM A black window opens, the server runs, and your browser opens after ~7s.
REM Close this window to stop the app.

setlocal
cd /d "%~dp0reel-maker"

REM Make sure Node + Git are visible even if winget added them after this session opened.
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Program Files (x86)\nodejs"

cls
echo ==================================================
echo             WSTI Reel Maker
echo ==================================================
echo.

REM --- sanity checks --------------------------------------------------------
if not exist .env (
  echo WARNING: No .env file found.
  echo Run install.bat first to set up the app.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo WARNING: Libraries not installed yet ^(no node_modules folder^).
  echo Run install.bat first.
  echo.
  pause
  exit /b 1
)

REM --- check the .env was actually filled in -------------------------------
findstr /C:"PASTE_YOUR_KEY_HERE" .env >nul
if not errorlevel 1 (
  echo WARNING: Your .env still has placeholder keys.
  echo.
  echo Open .env, replace PASTE_YOUR_KEY_HERE with your real OpenAI and
  echo Blotato keys, save it, then double-click start.bat again.
  echo.
  echo Opening .env in Notepad now...
  notepad .env
  pause
  exit /b 1
)

REM --- check Node is reachable ---------------------------------------------
node --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Run install.bat to install it.
  echo.
  pause
  exit /b 1
)

REM --- if port 4321 is already taken, kill the old process -----------------
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4321 ^| findstr LISTENING') do (
  echo Stopping a previous copy of the app ^(PID %%a^)...
  taskkill /F /PID %%a >nul 2>&1
)

REM --- open browser after a short delay -----------------------------------
start /B cmd /C "timeout /t 7 /nobreak >nul && start http://localhost:4321"

echo --^> Starting server. The app will open in your browser shortly.
echo --^> Keep this window open while you use the app.
echo --^> To stop: close this window.
echo.

REM --- run the server ------------------------------------------------------
node server.mjs

pause
