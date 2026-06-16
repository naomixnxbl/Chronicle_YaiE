# WSTI Reel Maker — Railway / Docker deployment.
#
# This image runs the Express server + Remotion renderer + ffmpeg in a single
# container. A Railway volume mounted at /data persists uploaded photos,
# rendered MP4s, music tracks, and brand settings across redeploys.
#
# Build:  docker build -t reel-maker .
# Run:    docker run -p 4321:4321 --env-file reel-maker/.env -v reel-data:/data reel-maker

FROM node:22-bookworm-slim

# --- System dependencies -----------------------------------------------------
# - ffmpeg: assembles Remotion's frames into MP4s
# - Chromium libraries: Remotion downloads its own Chromium but needs these libs
#   (libnss3, libatk, etc.) for it to actually launch
# - Fonts: caption SVGs reference Impact, DejaVu, Liberation; emoji support too
# - sharp's native deps come prebuilt with the npm package — no extra install
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates curl wget \
    fontconfig \
    fonts-liberation \
    fonts-dejavu \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Install npm dependencies first (layer caching) --------------------------
COPY reel-maker/package.json reel-maker/package-lock.json ./
RUN npm ci --no-fund --no-audit --omit=dev=false

# --- Copy the rest of the app -----------------------------------------------
COPY reel-maker/ ./

# --- Pre-download Chromium so the first render is fast -----------------------
# Remotion lazy-loads Chromium on the first render (saves image size when
# unused). For a server that WILL render, doing it at build time saves ~30s
# off the cold-start of the first render request.
RUN node -e "import('@remotion/renderer').then(r => r.ensureBrowser({ logLevel: 'error' }))" || true

# --- Volume wiring + entrypoint ---------------------------------------------
# entrypoint.sh symlinks /data/{uploads,music,out,brand.config.json} into the
# app's expected paths so brand changes and file uploads survive redeploys.
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
# Railway sets PORT itself; this is just the in-container default if run elsewhere.
ENV PORT=4321
EXPOSE 4321

CMD ["/entrypoint.sh"]
