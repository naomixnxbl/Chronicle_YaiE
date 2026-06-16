#!/bin/bash
# WSTI Reel Maker — create a Desktop shortcut to start.command.
# Double-click this once. After that, you can launch the app from your Desktop
# (or drag the alias into your Dock) without navigating into the project folder.

set -e
cd "$(dirname "$0")"

START_FILE="$(pwd)/start.command"
DESKTOP="$HOME/Desktop"
ALIAS_NAME="WSTI Reel Maker"
ALIAS_PATH="$DESKTOP/$ALIAS_NAME"

cat <<BANNER
==================================================
   Create a Desktop shortcut for WSTI Reel Maker
==================================================

This will put an alias on your Desktop so you can launch
the app without navigating into the project folder.

Where it will live: $ALIAS_PATH

BANNER

read -r -p "Press Enter to create (or close this window to cancel)... " _ < /dev/tty

if [ ! -f "$START_FILE" ]; then
  echo "ERROR: start.command not found at $START_FILE"
  echo "Make sure this file lives in the same folder as start.command."
  read -r -p "Press Enter to close..." _ < /dev/tty
  exit 1
fi

# Remove an old alias if it exists
if [ -e "$ALIAS_PATH" ]; then
  echo "→ Removing existing shortcut..."
  rm -f "$ALIAS_PATH"
fi

# Use AppleScript to create a proper Finder alias (preserves icon + double-click behaviour).
osascript <<APPLESCRIPT
tell application "Finder"
    set startFile to POSIX file "$START_FILE" as alias
    set desktopFolder to (path to desktop folder) as alias
    set newAlias to make new alias file at desktopFolder to startFile
    set name of newAlias to "$ALIAS_NAME"
end tell
APPLESCRIPT

echo ""
echo "✓ Done!"
echo "  Look on your Desktop for: $ALIAS_NAME"
echo "  Double-click it to launch the app."
echo ""
echo "  Bonus: drag the alias into your Dock for one-click launch from anywhere."
echo ""
read -r -p "Press Enter to close..." _ < /dev/tty
