#!/bin/bash
# Double-click launcher for macOS. Opens the Reel Maker and your browser.
# (If double-clicking does nothing the first time, right-click → Open, or run:
#  chmod +x start.command )

cd "$(dirname "$0")" || exit 1

echo "=============================="
echo "   Reel Maker — starting up"
echo "=============================="
echo

# 1. Node installed?
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Please install the LTS version from https://nodejs.org , then run this again."
  echo
  read -r -p "Press Enter to close."
  exit 1
fi

# 2. First run? install dependencies (downloads packages + a headless browser).
if [ ! -d node_modules ]; then
  echo "First run — installing dependencies (this takes a few minutes)..."
  npm install || { echo "Install failed."; read -r -p "Press Enter to close."; exit 1; }
  echo
fi

# 3. API key present? (only needed for the AI story / refine features)
if [ ! -f .env ]; then
  echo "NOTE: no .env file found — AI features (Build the story, refine) will be off."
  echo "      Create a file named .env containing:  ANTHROPIC_API_KEY=sk-ant-..."
  echo
fi

# 4. Tidy old renders so the disk doesn't fill up.
node tools/cleanup.mjs >/dev/null 2>&1 || true

# 5. Open the browser shortly after the server boots.
( sleep 4 && open "http://localhost:4321" ) &

echo "Starting the server. Your browser will open automatically."
echo "Keep this window open while you use the tool. Close it (or press Ctrl+C) to stop."
echo
npm start
