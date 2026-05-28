# 🌸 Florapeutic Content Studio

Turn a voice recording (or a typed topic) into a finished, on-brand video for
**Florapeutic** — the Sydney flower preservation & donation business. Built around
HeyGen's **Video Agent**, with OpenAI for transcription + script enhancement, and a
signature butterfly brand outro on every video.

> Flora + therapeutic. Flowers as memories, not products.

---

## What it does

```
🎙️ record / upload audio  (or type a topic)
      → transcribe (OpenAI Whisper)        ← only for audio
      → optional ✨ Enhance script (OpenAI) ← with Revert-to-original
      → on-brand brief (local, no AI)
      → 🎬 HeyGen Video Agent generates the whole video
           (script, illustrated presenter, b-roll, captions, music)
      → 🦋 Florapeutic brand outro appended (butterfly + wordmark)
      → preview · Download (HD) · type feedback to Regenerate · ＋ Create new
```

- **Two video types:** Educational, Awareness.
- **Brand outro on every video** — a butterfly glides corner-to-corner and "Florapeutic"
  blooms in the centre (rendered locally with ffmpeg, identical every time).
- **Feedback loop:** after the preview, describe changes → it regenerates via HeyGen.
- **Refresh keeps your work; closing the tab resets it** (sessionStorage).

---

## Setup

Requires [Node.js](https://nodejs.org) 18+ and **ffmpeg** (`brew install ffmpeg`).

```bash
npm install
cp .env.local.example .env.local   # then add your keys
npm run studio                      # runs web (5180) + backend (5181)
```

Open **http://localhost:5180**.

### API keys (`.env.local`)

| Key | Used for |
|-----|----------|
| `VITE_OPENAI_KEY` | Transcription (Whisper) + script enhancement (GPT-4o) |
| `VITE_HEYGEN_KEY` | Video generation (HeyGen Video Agent) |

`.env.local` is gitignored — keys never get committed.

---

## Project structure

```
src/                      React + Vite frontend (Setup → Audio → Script → Video)
  steps/                  the four wizard steps
  lib/                    types, brand voice, backend client, transcription
server/
  index.mjs               Express API (port 5181)
  lib/
    pipeline.mjs          job orchestration
    openai.mjs            transcribe + enhance
    heygen.mjs            Video Agent (brief → video)
    assemble.mjs          ffmpeg brand-outro builder
    brand.py              brand-outro assets (butterfly, wordmark, gradient)
```

## API (local backend)

- `POST /api/generate` — multipart `audio` (or `script`) + `contentType` → returns `{ id }`
- `POST /api/enhance` — `{ draft }` → `{ script }` (OpenAI)
- `POST /api/refine` — `{ prevPrompt, feedback, contentType }` → `{ id }` (regenerate)
- `GET  /api/jobs/:id` — job status / progress / result url
- `GET  /api/health` — which keys are configured

---

Made for Florapeutic · North Parramatta, Sydney · [florapeutic.com.au](https://florapeutic.com.au)
