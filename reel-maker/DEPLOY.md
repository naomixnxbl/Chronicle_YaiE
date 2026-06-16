# Deploy guide — Railway

This guide deploys the WSTI Reel Maker to **Railway** so your team can use it via a public URL instead of running it locally. The whole thing takes about 20–30 minutes the first time, then redeploys are one click.

If you're looking for the local-laptop install instead, see [SETUP.md](SETUP.md).

---

## What you'll get

- A public URL like `wsti-reel-maker.up.railway.app` your team can bookmark.
- Brand settings, uploaded photos, rendered MP4s, and music tracks **persist** across redeploys (stored in a Railway volume).
- Render speed roughly matching a laptop — Railway's standard tier is ~1–2 vCPU. A polished reel that takes 10 min on your laptop will take **15–25 min** here. If you need 30-second renders, switch to the Render + Remotion Lambda path (separate guide).
- About **$5–7/month** of usage. Railway gives you a $5 free credit each month that often covers a small team's use entirely.

---

## What you need before starting

1. A **GitHub account** (you almost certainly have one — the code lives at [github.com/naomixnxbl/Chronicle_YaiE](https://github.com/naomixnxbl/Chronicle_YaiE)).
2. A **Railway account** — free to sign up at [railway.com](https://railway.com). Sign in with GitHub for the easiest path.
3. Your **OpenAI API key** and **Blotato API key** (the same keys you'd use locally).
4. About **20 minutes**.

---

## Step 1 — Sign in to Railway

1. Go to [railway.com](https://railway.com).
2. Click **"Login"** → **"Login with GitHub"**.
3. Authorize Railway to read your repos.

You land on your Railway dashboard.

---

## Step 2 — Create a new project from the GitHub repo

1. Click **"+ New Project"** (top-right).
2. Pick **"Deploy from GitHub repo"**.
3. If this is your first time, Railway asks for permission to access your GitHub. Click **"Configure GitHub App"** → tick the **Chronicle_YaiE** repo (or grant access to all repos) → **Install & Authorize**.
4. Back in Railway, the repo list now includes **Chronicle_YaiE**. Click it.

Railway scans the repo, sees the `Dockerfile` at the root, and starts the first build automatically. **Don't worry — this build will fail** because we haven't set the API keys yet. We'll do that next.

---

## Step 3 — Add your secret keys

Railway shows your new service in the dashboard. Click on the service tile to open it.

1. Click the **"Variables"** tab at the top of the service panel.
2. Click **"+ New Variable"** (or **"Raw Editor"** for paste-multiple).
3. Add each of these one by one (or paste the whole block in Raw Editor):

```
OPENAI_API_KEY=sk-proj-...PASTE_YOUR_KEY_HERE...
BLOTATO_API_KEY=blt_...PASTE_YOUR_KEY_HERE...
BLOTATO_LINKEDIN_ACCOUNT_ID=16494
BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
BLOTATO_FACEBOOK_ACCOUNT_ID=24876
JAMENDO_CLIENT_ID=c3e0222e
DATA_DIR=/data
```

> The `DATA_DIR=/data` line is important — it tells the app where the persistent volume is mounted. We'll add that volume in the next step.

Click **"Add"** (or **"Update Variables"** if you used Raw Editor). Railway saves the variables and queues a redeploy automatically.

---

## Step 4 — Add a persistent volume

Without a volume, every redeploy wipes your uploaded photos, rendered MP4s, and brand settings. The volume keeps everything safe.

1. Still in your service panel, click the **"Settings"** tab.
2. Scroll down to **"Volumes"**.
3. Click **"+ New Volume"**.
4. Mount path: **`/data`** (exactly — the leading slash matters).
5. Size: **1 GB** is plenty to start. You can resize later.
6. Click **"Add"**.

Railway redeploys the service with the volume mounted. Wait for it to finish (about 2 minutes — watch the "Deployments" tab).

---

## Step 5 — Get the public URL

1. Click the **"Settings"** tab again.
2. Scroll to **"Networking"** → **"Public Networking"**.
3. Click **"Generate Domain"**.
4. Railway gives you a URL like `wsti-reel-maker-production.up.railway.app`.

**Click the URL.** The app should load. You'll see the brand picker page.

> **If you see "Application failed to respond"** or a 502, the container is still starting (Remotion's first-time Chromium download can take a few minutes). Wait 2–3 minutes and reload.

---

## Step 6 — Upload your music tracks (optional)

Music tracks were not deployed with the code (they're gitignored). To get the same music library you have locally onto Railway, use the Railway CLI:

**On your laptop:**

```bash
# 1. Install the Railway CLI (one-time)
brew install railwayapp/railway/railway

# 2. Log in
railway login

# 3. Link this repo to your Railway project
cd /path/to/your/local/WSTI_PROJECT
railway link

# 4. SSH into the running container
railway ssh
```

You're now inside the container. Drop into the music folder:

```bash
cd /data/music
exit
```

Then, on your laptop again:

```bash
# Copy your local music tracks into the running container's /data/music
railway run scp /Users/hansika/WSTI_PROJECT/reel-maker/public/music/*.mp3 /data/music/
railway run scp /Users/hansika/WSTI_PROJECT/reel-maker/public/music/*.wav /data/music/
```

Or skip music entirely — the app works fine without it (the music dropdown shows "No music" as the default).

---

## Step 7 — Test a render

1. Open your Railway URL.
2. Pick "Reel".
3. Upload 3–4 photos.
4. Fill the title / subtitle / CTA.
5. Click **Render**.

First render takes longer than subsequent ones (Chromium warmup ~5–10 sec). After that, expect renders in the 15–25 min range on Railway's standard tier. If that's too slow for your workflow, see the **"Faster renders"** section below.

---

## Day-to-day: pushing updates

Whenever you push commits to `main` on the GitHub repo, **Railway redeploys automatically**. Your settings, brand config, uploaded photos, and renders all stay in the volume.

To push a change:

```bash
cd /Users/hansika/WSTI_PROJECT
git add ...
git commit -m "your message"
git push origin main
```

Railway picks it up within seconds. Watch the **"Deployments"** tab for progress (~2–3 min per deploy).

---

## Cost & usage

Railway charges per resource-hour:

- **Free credit**: $5/month included on the Hobby plan.
- **Standard tier (1–2 vCPU, 1 GB RAM)**: ~$5–7/month if the app stays running 24/7. Less if it sleeps.
- **Volume storage**: $0.25/GB/month — so a 1 GB volume is ~$0.25/month.
- **Bandwidth**: $0.05/GB outbound — most teams use < 1 GB/month.

You can set a **monthly spending limit** in Railway → Settings → Usage to avoid surprises.

---

## Faster renders (optional upgrade)

The 15–25 min render time is from running both the web app AND the heavy frame-rendering on the same small container. Two ways to speed it up:

1. **Bump up the Railway service** — Settings → Resources → bump CPU + RAM. A 2 vCPU / 4 GB tier roughly halves render time. Costs ~$15–20/month.
2. **Move rendering to Remotion Lambda** — keep the web app on Railway, send the render work to AWS Lambda (which runs ~50 workers in parallel). Reels render in 30–60 seconds instead of 10+ min. Costs ~$0.05 per render. Bigger setup (~1 hour, needs an AWS account). Ask me to write the Lambda guide if you want this.

---

## Common issues

### Build fails with "no space left on device"

Railway's free tier has a build-time disk limit. The Chromium pre-download in our Dockerfile is the usual culprit. Solution: edit the Dockerfile, comment out the `RUN node -e "import('@remotion/renderer')..."` line. The trade-off is that the very first render will be 30 sec slower (Chromium downloads at runtime instead of build time).

### "Application failed to respond" after deploy

Container is still booting. Remotion's first-launch can take 2–3 min. Wait, then reload. If it persists, check the **"Logs"** tab for the actual error.

### Render fails with "Error loading image"

Probably a stale Remotion bundle after you uploaded a new logo. We added a cache-invalidation hook in `/api/brand/logo`, so this shouldn't happen — but if it does, restart the service from the Railway dashboard (Settings → Redeploy).

### Blotato 401 errors when trying to post

Your Blotato API key has expired. Generate a new one at [blotato.com](https://blotato.com) → settings → API. Update it in Railway → Variables. The service auto-redeploys with the new key.

### Bills are higher than expected

Open Railway → your project → Usage tab. The two biggest cost drivers are:

- **Active resource-hours**: did you leave it running 24/7 even when nobody was using it? Enable **"Sleep when idle"** in Settings → Resources.
- **Bandwidth**: are you downloading many MP4s from the deployed URL? Each render downloaded to a teammate's laptop counts toward egress.

---

## How to tear it down

If you want to stop being billed entirely:

1. Railway → your project → Settings → **Danger Zone** → **Delete Service**.
2. Confirm.

The volume is deleted with the service (the brand settings + uploads are gone). The GitHub repo and your local code are untouched.

To pause without deleting: Settings → Resources → **Pause Service**. Resumes instantly when you click Resume; no charges while paused (except $0.25/month for the volume).
