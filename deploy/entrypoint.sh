#!/bin/sh
# Container entrypoint for WSTI Reel Maker.
#
# Wires the optional /data persistent volume into the app's filesystem so
# uploads, renders, music tracks, and brand-settings changes survive a
# redeploy. If no volume is mounted at /data, falls back to in-image paths
# (everything is ephemeral in that case).

set -e

DATA_DIR="${DATA_DIR:-/data}"

if [ -d "$DATA_DIR" ] || mkdir -p "$DATA_DIR" 2>/dev/null; then
  echo "→ Persistent data dir: $DATA_DIR"

  mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/music" "$DATA_DIR/out" "$DATA_DIR/post"

  # Seed brand.config.json on first run (volume starts empty).
  if [ ! -f "$DATA_DIR/brand.config.json" ] && [ -f /app/brand.config.json ]; then
    cp /app/brand.config.json "$DATA_DIR/brand.config.json"
    echo "→ Seeded brand.config.json into volume"
  fi

  # Replace the image's paths with symlinks into the volume.
  # Anything written to these paths now persists across container restarts.
  rm -rf /app/public/uploads && ln -s "$DATA_DIR/uploads" /app/public/uploads
  rm -rf /app/public/music && ln -s "$DATA_DIR/music" /app/public/music
  rm -rf /app/out && ln -s "$DATA_DIR/out" /app/out

  # brand.config.json: symlink so the server reads + writes go to the volume.
  if [ -f "$DATA_DIR/brand.config.json" ]; then
    rm -f /app/brand.config.json
    ln -s "$DATA_DIR/brand.config.json" /app/brand.config.json
  fi

  # Logo files inside public/brand/ — uploaded logos land here. Persist them too.
  mkdir -p "$DATA_DIR/brand"
  # Seed default logo on first run
  if [ ! -f "$DATA_DIR/brand/wsti-logo.png" ] && [ -f /app/public/brand/wsti-logo.png ]; then
    cp /app/public/brand/wsti-logo.png "$DATA_DIR/brand/wsti-logo.png"
  fi
  rm -rf /app/public/brand && ln -s "$DATA_DIR/brand" /app/public/brand
fi

cd /app
exec node server.mjs
