#!/bin/bash
# WSTI Reel Maker — one-time installer.
# Double-click this file in Finder. It will:
#   1. Install Homebrew (if missing)
#   2. Install Node.js + ffmpeg + git (if missing)
#   3. Install the app's libraries (~800 MB)
#   4. Create a template .env file and open it in TextEdit so you can paste your keys
#
# Anyone non-technical can run this. The Terminal window opens automatically,
# shows progress, then closes. No commands to type.

set -e

# Move into the directory this script lives in, then into reel-maker.
cd "$(dirname "$0")/reel-maker"

clear
cat <<'BANNER'
==================================================
        WSTI Reel Maker — one-time setup
==================================================

This will install Homebrew (if missing), Node.js,
ffmpeg, and the app's libraries (~800 MB).

It takes about 10 minutes.

You may be asked to type your Mac login password
(it won't show as you type — that's normal).

BANNER
read -r -p "Press Enter to begin (or close this window to cancel)... " _ < /dev/tty

# --- 1. Homebrew ---------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
  echo ""
  echo "→ Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo "✓ Homebrew installed"
else
  echo "✓ Homebrew already installed"
fi

# Make sure brew is on PATH for this session (Homebrew's installer prints these
# lines for the user to add; we add them on-the-fly so the rest of this script
# can find brew without restarting the Terminal).
if [ -d /opt/homebrew/bin ]; then export PATH="/opt/homebrew/bin:$PATH"; fi
if [ -d /usr/local/bin ]; then export PATH="/usr/local/bin:$PATH"; fi

# --- 2. Node, ffmpeg, git ------------------------------------------------
echo ""
echo "→ Installing Node.js, ffmpeg, and git (skipping any already installed)..."
brew install node ffmpeg git 2>&1 | tail -10 || true
echo "✓ Tools ready"

# Verify Node version is >= 22.
NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VER" ] || [ "$NODE_VER" -lt 22 ]; then
  echo ""
  echo "⚠️  Node.js v22 or higher is required (you have $(node --version 2>/dev/null || echo 'none'))."
  echo "    Try running: brew upgrade node"
  read -r -p "Press Enter to continue anyway (the app may not work)... " _ < /dev/tty
fi

# --- 3. npm install ------------------------------------------------------
echo ""
echo "→ Installing the app's libraries (this is the slow bit — 3 to 10 minutes)..."
echo "  Don't close this window. You'll see lots of text scroll by — that's normal."
echo ""
npm install --no-fund --no-audit 2>&1 | tail -20
echo "✓ Libraries installed"

# --- 4. .env template + open in TextEdit ---------------------------------
if [ ! -f .env ]; then
  echo ""
  echo "→ Creating a template .env file for your secret keys..."
  cat > .env <<'ENV'
OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_LINKEDIN_ACCOUNT_ID=16494
BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
BLOTATO_FACEBOOK_ACCOUNT_ID=24876
JAMENDO_CLIENT_ID=c3e0222e
ENV
  echo "✓ Template .env created"

  echo ""
  echo "==================================================="
  echo "  Now: paste your real keys into the .env file"
  echo "==================================================="
  echo ""
  echo "Opening .env in TextEdit. Replace PASTE_YOUR_KEY_HERE with:"
  echo "  • Your OpenAI key (from platform.openai.com/api-keys)"
  echo "  • Your Blotato key (from blotato.com → settings → API)"
  echo ""
  echo "Save (Cmd+S) and close TextEdit when done."
  echo ""

  # Open the .env in TextEdit. TextEdit treats files without extensions as
  # plain text by default, so this is perfectly fine.
  open -a TextEdit .env
else
  echo ""
  echo "✓ .env already exists — leaving it as-is."
fi

echo ""
echo "==================================================="
echo "  ✓ Setup complete!"
echo "==================================================="
echo ""
echo "Next: double-click 'start.command' (in the same folder as this file)"
echo "to launch the app. It will open in your browser automatically."
echo ""
echo "You can close this window now."
echo ""
read -r -p "Press Enter to close..." _ < /dev/tty
