# Reel Maker — Architecture & Operations Guide

A plain-English tour of how this tool works, the tech behind it, what every file
does, how far it scales, and how to keep it running. Written to onboard a new
teammate (or future-you).

---

## 1. The big idea

A **local web app that turns photos into a branded video**, with AI helping
arrange the story and write captions. No cloud, no database — it runs as one
small Node server on your machine. The video is **built from code** (React
components rendered to frames), so every reel comes out pixel-consistent and
on-brand.

End-to-end flow:

```
Browser (form.html)                 Server (server.mjs)              Remotion
  upload photos ───────────────────▶ /story  ──▶ OpenAI (vision) ──▶ order + captions
  edit / arrange                      /refine ──▶ OpenAI (text)   ──▶ tweaked settings
  click render ─────────────────────▶ /render ──▶ Remotion renderer ─▶ frames ─▶ MP4
  poll progress ◀──────────────────── /progress/:id
  watch + download ◀───────────────── /download/:id
```

**Key mental model:** there are **two separate programs** sharing one folder:
1. the **server** (`*.mjs`, runs in Node), and
2. the **video** (`src/*.tsx`, runs inside Remotion's headless Chrome).

They talk via a JSON `inputProps` object. That's why `brand.config.json` is plain
JSON — both worlds can read it.

---

## 2. Tech stack (and why)

| Layer | Tech | Why it's here |
|---|---|---|
| Video engine | **Remotion 4** (React-based) | Describe video as React components. Deterministic → same input, same output = "same brand look every time". |
| Rendering | `@remotion/renderer` + headless **Chrome** | Screenshots each frame in a real browser, then **ffmpeg** (bundled) stitches them into an H.264 MP4. |
| Server | **Node.js + Express** | Tiny HTTP server: serves the form, takes uploads, runs renders, returns the file. |
| Uploads | **Multer** | Parses multipart form-data. Disk mode for render, memory mode for the AI vision step. |
| Image processing | **Sharp** | Downscales photos before the model (cost/size) and before render (speed); auto-rotates by EXIF; recolours logos in the cloner. |
| AI | **OpenAI SDK** (`gpt-4o`, structured outputs) | Vision: orders photos + writes captions. Text: turns "make captions smaller" into concrete settings. Also writes brand voice in the cloner. Model overridable via `OPENAI_MODEL`. |
| Frontend | **Vanilla HTML/CSS/JS** (one file) | No build step. Wizard, drag-drop, persistence, undo are hand-written JS — deliberately dependency-free. |
| Fonts | `@remotion/google-fonts` (Anton, Inter, Montserrat) + Google Fonts CDN (Fraunces, Inter) | Loaded inside the render so text is identical on any machine. |
| Language | **TypeScript** (video) + **plain ESM `.mjs`** (server/tools) | TS gives the video props type-safety; the server stays plain JS so it needs no compile step. |

---

## 3. Every file & folder

### Root config
- `package.json` — dependencies + the 4 commands (`start`, `studio`, `test-render`, `new-brand`).
- `tsconfig.json` — TypeScript settings (`resolveJsonModule` lets the video import `brand.config.json`).
- `.env` — **secrets** (`OPENAI_API_KEY`). Gitignored — never pushed. Teammates must add their own.
- `.gitignore` — keeps `node_modules`, `out`, `.env`, uploads out of git.
- `remotion.config.ts` — Remotion render settings (codec / image format).
- **`brand.config.json`** ⭐ — single source of truth for identity (name, logo, accent, copy, voice). **Swap this file = rebrand the whole tool.**

### The server brain
- **`server.mjs`** ⭐ — the heart. All routes (`/`, `/api/brand`, `/api/music`, `/story`, `/refine`, `/render`, `/progress/:id`, `/download/:id`), the in-memory `jobs` map, the one-time Remotion bundle, and the two AI **system prompts** (brand-aware).

### The video (`src/`)
- `index.ts` — entry point; registers the composition with Remotion.
- `Root.tsx` — declares the `WstiReel` composition (id, fps, size, default props).
- **`WstiReel.tsx`** ⭐ — the actual *design*: intro/outro, photo & duo slides, captions, grain/grade/light-leak/particle overlays, transitions, the brand lockup, and the Instagram **"energy" branch** (`energy = format === "reels"`).
- **`schema.ts`** ⭐ — the contract: the `ReelProps` type, default props (from `brand.config.json`), and `getTimeline()` so server and video agree on duration.

### The frontend
- **`public/form.html`** ⭐ — the entire UI in one file: 3-step wizard, drag-drop, photo reorder/pairing, the `/api/brand` loader, silent draft persistence (sessionStorage + IndexedDB), refine + undo.

### Assets in `public/` (Remotion can only read files under `public/`)
- `brand/` — logos (served at `/brand`). `demo/`, `photos/` — sample images.
- `music/` — background tracks (auto-listed by `/api/music`). `sfx/click.wav` — outro click.
- `uploads/` — **per-render user photos** (grows over time → see Maintenance).

### Tools
- **`tools/new-brand.mjs`** ⭐ — the cloner: copies the project, scrapes a site for logo + colour, calls OpenAI for voice/copy, writes a new `brand.config.json`.
- `tools/make_*.py` — one-off scripts that generated the demo music/sfx (not runtime).
- `test-render.mjs` — renders the demo reel from the CLI; smoke test.

### Generated (gitignored)
- `out/` — finished MP4s. `node_modules/` — installed deps (~550 MB).

---

## 4. Technical aspects worth understanding

- **Render pipeline (the expensive part).** Photos downscaled by Sharp → Remotion launches headless Chrome → renders each frame as a screenshot (~600 frames @ 30fps) → ffmpeg encodes to MP4. Runs `concurrency: 8` (8 cores). A ~20s reel ≈ 1–2 min on a 10-core machine. **CPU-bound — this is the scaling bottleneck.**
- **Async job pattern.** `/render` returns a `jobId` immediately and renders in the background; the browser **polls** `/progress/:id`. Jobs live in an in-memory `Map` → **wiped on restart** (the UI shows a "render expired" message and asks you to re-render).
- **The two AI calls** use structured JSON output (schemas) so responses parse reliably. `/story` is multimodal (sends the images). Prompts are injected with `brand.voice` so captions match the business.
- **Persistence (drafts).** `sessionStorage` holds text/settings/step (survives refresh, dies on tab close); **IndexedDB** holds photo blobs. Reopening with no session clears IndexedDB. 100% client-side — the server knows nothing about it.
- **The brand system.** `brand.config.json` is read by the server (prompts, defaults), the video (lockup/colour), and the form (`/api/brand`). One file, three consumers → the cloner is one command.

---

## 5. Deployment & scale

It's a **single-process local tool today, not a scaled web service.** Two very
different limits:

| Activity | Capacity | Why |
|---|---|---|
| Browse form, upload, AI story/refine | dozens–hundreds concurrently | Light I/O; model calls run async |
| **Render video** | ~1–3 at once per machine | Each render eats 8 cores; no queue → simultaneous renders thrash CPU |

A single decent server (8–16 cores) comfortably serves a small team or class.
Concurrent, steady rendering demand hits a wall.

**To scale (cheapest → most scalable):**
1. **Add a render queue** (BullMQ + Redis): renders run one/few at a time; users wait instead of crashing each other. Smallest change, biggest stability win.
2. **Vertical scale**: a big multi-core cloud box (16–64 cores). Simple, linear-ish.
3. **Remotion Lambda**: official serverless rendering on AWS. Fans each render across Lambdas → hundreds/thousands concurrent, pay-per-render. Same Remotion code.

**Before any public deploy:** auth (none today), HTTPS, rate limiting,
file-type/size validation, per-user isolation of uploads/outputs.

---

## 6. Maintenance

**Routine**
- **Disk cleanup (most important).** `public/uploads/` and `out/` grow forever. Add a scheduled job to delete files older than ~24–48h, or the disk fills.
- **Dependency updates.** `npm outdated` occasionally; Remotion ships often. Re-run `npm install` + `npm run test-render` after updating.
- **API key.** Rotate the OpenAI key periodically; watch usage/billing.
- **Chrome/ffmpeg.** Remotion manages its own Chrome; `npx remotion browser ensure` keeps it current.

**Operational**
- **Process manager** in prod (PM2 / systemd / Docker) for auto-restart. In-memory jobs are lost on restart (acceptable — users re-render).
- **Logs & errors.** Currently console only. For deploy, add a logger / Sentry so failed renders are visible.
- **Backups.** Code is in git. Only stateful bits worth backing up: brand configs + custom logos/music.

**Per-brand**
- New business = `npm run new-brand -- --name "X" --site https://x.com` → review the generated `brand.config.json` (logo + colour are best-effort) → run it.

---

## 7. Priorities if taking this further
1. **Render queue first** — the difference between "demo" and "won't fall over".
2. **Disk-cleanup cron** — silent killer otherwise.
3. **Auth + validation** before anyone outside the team uses it.
4. When demand is real, **Remotion Lambda** — don't rebuild, just change where it renders.

---

## 8. Quick command reference

```bash
npm start          # run the app → http://localhost:4321
npm run studio     # Remotion Studio: live-edit the video template
npm run test-render# render the demo reel → out/test.mp4 (smoke test)
npm run new-brand -- --name "Acme" --site https://acme.com   # clone for a new business
PORT=4322 npm start# run a second brand alongside the first
```
