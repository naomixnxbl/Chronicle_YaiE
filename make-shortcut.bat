@echo off
REM WSTI Reel Maker - create a Desktop shortcut to start.bat.
REM Double-click this once. After that, you can launch the app from your Desktop
REM (or pin to the taskbar) without navigating into the project folder.

setlocal
cd /d "%~dp0"

set "START_FILE=%~dp0start.bat"
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP%\WSTI Reel Maker.lnk"

cls
echo ==================================================
echo   Create a Desktop shortcut for WSTI Reel Maker
echo ==================================================
echo.
echo This will put a shortcut on your Desktop so you can
echo launch the app without navigating into the project folder.
echo.
echo Where it will live: %SHORTCUT%
echo.
pause

if not exist "%START_FILE%" (
  echo.
  echo ERROR: start.bat not found at %START_FILE%
  echo Make sure this file lives in the same folder as start.bat.
  pause
  exit /b 1
)

REM Remove any existing shortcut first
if exist "%SHORTCUT%" del "%SHORTCUT%"

REM Use PowerShell to create the .lnk shortcut (no admin needed)
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%SHORTCUT%'); $sc.TargetPath = '%START_FILE%'; $sc.WorkingDirectory = '%~dp0'; $sc.Description = 'WSTI Reel Maker'; $sc.Save()"

if errorlevel 1 (
  echo.
  echo ERROR: Could not create the shortcut.
  pause
  exit /b 1
)

echo.
echo Done!
echo   Look on your Desktop for: WSTI Reel Maker
echo   Double-click it to launch the app.
echo.
echo Bonus: right-click the Desktop shortcut to
echo "Pin to taskbar" for one-click launch from your taskbar.
echo.
pause
