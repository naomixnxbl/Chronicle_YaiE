@echo off
REM WSTI Reel Maker - one-time installer for Windows.
REM Double-click this file in File Explorer. It will:
REM   1. Use winget to install Node.js, ffmpeg, and git (if missing)
REM   2. Install the app's libraries (~800 MB)
REM   3. Create a template .env file and open it in Notepad
REM
REM No commands to type. Anyone non-technical can run this.

setlocal enabledelayedexpansion
cd /d "%~dp0reel-maker"

cls
echo ==================================================
echo         WSTI Reel Maker -- one-time setup
echo ==================================================
echo.
echo This will install:
echo   * Node.js (if missing)
echo   * ffmpeg  (if missing)
echo   * git     (if missing)
echo   * The app's libraries (~800 MB)
echo.
echo Total time: about 10 minutes.
echo.
echo Windows may ask for permission to install --
echo click YES when those popups appear.
echo.
pause

REM --- 1. Check that winget is available -----------------------------------
where winget >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: 'winget' is not on this PC.
  echo.
  echo Open the Microsoft Store, search for "App Installer", install it,
  echo restart this script.
  echo.
  pause
  exit /b 1
)

REM --- 2. Install Node.js, ffmpeg, git via winget --------------------------
echo.
echo --^> Installing Node.js LTS (skipping if already installed)...
winget install --silent --accept-package-agreements --accept-source-agreements -e --id OpenJS.NodeJS.LTS 2>&1 | findstr /R /C:"Successfully installed" /C:"already installed" /C:"newer version"

echo --^> Installing ffmpeg...
winget install --silent --accept-package-agreements --accept-source-agreements -e --id Gyan.FFmpeg 2>&1 | findstr /R /C:"Successfully installed" /C:"already installed" /C:"newer version"

echo --^> Installing git...
winget install --silent --accept-package-agreements --accept-source-agreements -e --id Git.Git 2>&1 | findstr /R /C:"Successfully installed" /C:"already installed" /C:"newer version"

REM --- 3. Make new tools visible to this session ---------------------------
REM winget puts these on the system PATH, but the current cmd window won't
REM see the change until it's reopened -- we add them by hand so the rest of
REM this script can find them right away.
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Program Files (x86)\nodejs"

REM --- 4. Verify Node is reachable; if not, ask user to reopen -------------
node --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js was just installed but isn't visible in this window yet.
  echo.
  echo Please CLOSE this window and DOUBLE-CLICK install.bat ONE MORE TIME
  echo to finish setup.
  echo.
  pause
  exit /b 1
)

REM Check Node version is at least 22
for /f "tokens=1 delims=." %%a in ('node --version') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% LSS 22 (
  echo.
  echo WARNING: Node.js v22 or higher is recommended ^(you have v%NODE_MAJOR%^).
  echo The app may not work correctly. Try: winget upgrade OpenJS.NodeJS.LTS
  echo.
  pause
)

REM --- 5. npm install ------------------------------------------------------
echo.
echo --^> Installing the app's libraries...
echo     This is the slowest step ^(3-10 minutes^). Don't close this window.
echo     You'll see lots of text scroll by -- that's normal.
echo.
call npm install --no-fund --no-audit
if errorlevel 1 (
  echo.
  echo npm install failed. See the messages above for what went wrong.
  echo Common fix: make sure your internet is working, then run install.bat again.
  pause
  exit /b 1
)
echo.
echo Libraries installed.

REM --- 6. .env template + open in Notepad ---------------------------------
if not exist .env (
  echo.
  echo --^> Creating a template .env file for your secret keys...
  (
    echo OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
    echo BLOTATO_API_KEY=PASTE_YOUR_KEY_HERE
    echo BLOTATO_LINKEDIN_ACCOUNT_ID=16494
    echo BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
    echo BLOTATO_FACEBOOK_ACCOUNT_ID=24876
    echo JAMENDO_CLIENT_ID=c3e0222e
  ) > .env
  echo Template .env created.

  echo.
  echo ===================================================
  echo   Now: paste your real keys into the .env file
  echo ===================================================
  echo.
  echo Opening .env in Notepad. Replace PASTE_YOUR_KEY_HERE with:
  echo   * Your OpenAI key  ^(from platform.openai.com/api-keys^)
  echo   * Your Blotato key ^(from blotato.com -^> settings -^> API^)
  echo.
  echo Save ^(Ctrl+S^) and close Notepad when done.
  echo.
  notepad .env
) else (
  echo.
  echo .env already exists -- leaving it as-is.
)

echo.
echo ==================================================
echo   Setup complete!
echo ==================================================
echo.
echo Next: double-click "start.bat" ^(in the folder above^)
echo to launch the app. It will open in your browser.
echo.
echo You can close this window now.
echo.
pause
