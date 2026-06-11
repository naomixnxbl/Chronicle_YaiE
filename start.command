#!/bin/bash
# WSTI Reel Maker — start the app.
# Double-click this file in Finder. It will:
#   1. Make sure brew tools are on PATH
#   2. Start the server
#   3. Open the app in your default browser
#
# Keep this Terminal window open while you use the app.
# Close it (or press Ctrl+C) to stop the app.

cd "$(dirname "$0")/reel-maker"

# Make brew's binaries findable (matches what the Homebrew installer prints).
if [ -d /opt/homebrew/bin ]; then export PATH="/opt/homebrew/bin:$PATH"; fi
if [ -d /usr/local/bin ]; then export PATH="/usr/local/bin:$PATH"; fi

clear
cat <<'BANNER'
==================================================
            WSTI Reel Maker
==================================================
BANNER

# --- sanity checks -------------------------------------------------------
if [ ! -f .env ]; then
  echo ""
  echo "⚠️  No .env file found."
  echo "    Run 'install.command' first to set up the app."
  echo ""
  read -r -p "Press Enter to close..." _ < /dev/tty
  exit 1
fi

if [ ! -d node_modules ]; then
  echo ""
  echo "⚠️  Libraries not installed yet (no node_modules folder)."
  echo "    Run 'install.command' first."
  echo ""
  read -r -p "Press Enter to close..." _ < /dev/tty
  exit 1
fi

# --- check the .env was actually filled in -------------------------------
if grep -q "PASTE_YOUR_KEY_HERE" .env; then
  echo ""
  echo "⚠️  Your .env still has placeholder keys."
  echo "    Open .env, replace PASTE_YOUR_KEY_HERE with your real OpenAI"
  echo "    and Blotato keys, save it, then run this script again."
  echo ""
  echo "    Opening .env in TextEdit now..."
  open -a TextEdit .env
  read -r -p "Press Enter to close..." _ < /dev/tty
  exit 1
fi

# --- if port 4321 is already taken, kill the old process -----------------
OLD_PID=$(lsof -ti :4321 2>/dev/null | head -1)
if [ -n "$OLD_PID" ]; then
  echo "→ Stopping a previous copy of the app (PID $OLD_PID)..."
  kill "$OLD_PID" 2>/dev/null || true
  sleep 2
fi

# --- open browser after a delay so the server has time to start ----------
( sleep 7 && open "http://localhost:4321" ) &

echo ""
echo "→ Starting server. The app will open in your browser shortly."
echo "→ Keep this window open while you use the app."
echo "→ To stop: close this window, or press Ctrl+C."
echo ""

# --- run the server ------------------------------------------------------
node server.mjs
