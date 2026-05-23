// WSTI Reel Maker — local web server.
// Upload photos + captions in the browser, render a branded MP4, download it.
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load reel-maker/.env (for ANTHROPIC_API_KEY) if present.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  /* no .env file — narrative feature stays disabled until a key is added */
}
const PORT = process.env.PORT || 4321;
const BASE = `http://localhost:${PORT}`;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const clamp = (v, lo, hi, dflt) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
};

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const MUSIC_DIR = path.join(PUBLIC_DIR, "music");
const OUT_DIR = path.join(__dirname, "out");
for (const d of [UPLOADS_DIR, MUSIC_DIR, OUT_DIR]) fs.mkdirSync(d, { recursive: true });

// ---- Remotion bundle (built once, reused for every render) ----
let serveUrlPromise = null;
const getServeUrl = () => {
  if (!serveUrlPromise) {
    serveUrlPromise = (async () => {
      await ensureBrowser();
      console.log("Bundling Remotion project (one-time)...");
      const url = await bundle({
        entryPoint: path.join(__dirname, "src", "index.ts"),
        publicDir: PUBLIC_DIR,
      });
      console.log("Bundle ready.");
      return url;
    })();
  }
  return serveUrlPromise;
};

// ---- uploads ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, req.jobId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Keep upload order via a zero-padded index prefix.
    req._n = (req._n ?? 0) + 1;
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${String(req._n).padStart(2, "0")}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024, files: 20 } });
// In-memory uploads for the narrative step (images go straight to Claude, not disk).
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });
const assignJobId = (req, res, next) => {
  req.jobId = crypto.randomBytes(6).toString("hex");
  next();
};

const jobs = new Map(); // jobId -> { status, progress, file, error }

const app = express();
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/music", express.static(MUSIC_DIR));
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "form.html")));

// List background music tracks the user has dropped into public/music/
app.get("/api/music", (req, res) => {
  const files = fs
    .readdirSync(MUSIC_DIR)
    .filter((f) => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f));
  res.json(files);
});

// ---- narrative: arrange photos into a story + write captions (Claude vision) ----
const STORY_SYSTEM = `You are the story editor for WSTI (Western Sydney Tech Innovators), a 3,400+ member community in Western Sydney focused on hands-on AI and emerging tech. The brand voice is warm, human, energetic and inclusive — proud of its people, never corporate or stiff.

Your job: turn a set of event photos into a punchy ~30-second reel.

Given the reel's goal and each photo (image + a short note), produce:
1. The best NARRATIVE ORDER — a clear arc: hook (grab attention) -> build (what's happening) -> peak (energy/payoff) -> community (the people) -> lead into the call to action. Use EVERY photo exactly once.
2. A short on-screen CAPTION for each slide.
3. Intro copy (title + subtitle) and outro copy (closing headline + sub-line).

PAIRING (elegant editorial pairs): when TWO photos clearly belong to the SAME moment or topic — e.g. two angles of the same talk, two people in the same discussion, before/after of one activity — you MAY put them in a single slide that shows both with ONE shared caption. Use this sparingly (at most one or two pairs in a reel) and only when it genuinely strengthens the story. Everything else stays a single photo.

Return "sequence" as a list of slides. Each slide has "indices" (ONE or TWO photo indices, matching the bracketed numbers shown with each photo) and a "caption". Every photo index must appear exactly once across all slides.

Caption voice — be CREATIVE, WARM and WSTI:
- 2 to 5 words. Vivid, human, a little playful. Celebrate the people, the energy, the curiosity, Western Sydney pride.
- Reflect what's actually in the photo(s). For a pair, write one caption that ties both together.
- Avoid generic/corporate lines ("great event", "amazing time"). No emojis, no hashtags, no end punctuation.
- Title <= 8 words. Subtitle <= 8 words. Closing headline <= 5 words. Closing sub <= 10 words.`;

const STORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sequence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          indices: { type: "array", items: { type: "integer" } },
          caption: { type: "string" },
        },
        required: ["indices", "caption"],
      },
    },
    title: { type: "string" },
    subtitle: { type: "string" },
    ctaHeadline: { type: "string" },
    ctaSub: { type: "string" },
  },
  required: ["sequence", "title", "subtitle", "ctaHeadline", "ctaSub"],
};

app.post("/story", memUpload.array("photos", 20), async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(400).json({
        error: "Narrative AI is off. Add ANTHROPIC_API_KEY to reel-maker/.env and restart the server.",
      });
    }
    const meta = JSON.parse(req.body.meta || "{}");
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: "No photos uploaded." });
    const contexts = Array.isArray(meta.contexts) ? meta.contexts : [];
    const reelContext = (meta.reelContext || "").trim();
    const format = meta.format || "reels";
    const formatNote =
      format === "reels"
        ? "TARGET FORMAT: 9:16 vertical (Reels). PAIR GENEROUSLY: a single wide (landscape) photo looks weak in a tall frame, so pair two related landscape photos into one stacked slide wherever it makes sense — aim for most slides to be pairs. Keep portrait shots or a strong hero/group photo as singles. Still respect the narrative arc."
        : format === "square"
        ? "TARGET FORMAT: 1:1 square. Pairing is optional — use it only for genuinely related moments."
        : "TARGET FORMAT: 16:9 landscape. Mostly single photos; pair only two clearly-related shots occasionally.";

    const content = [
      {
        type: "text",
        text:
          `Reel goal / context:\n${reelContext || "(none provided — infer a strong WSTI community story)"}\n\n` +
          `${formatNote}\n\n` +
          `Here are ${files.length} photos, each shown with its index in [brackets] and a short note. Study every image.`,
      },
    ];
    // Downscale every photo before sending to Claude — keeps the request small
    // (full-res phone photos blow past the API size limit) and is plenty for vision.
    for (let i = 0; i < files.length; i++) {
      const small = await sharp(files[i].buffer)
        .rotate() // honour EXIF orientation
        .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toBuffer();
      content.push({ type: "text", text: `Photo [${i}] — note: ${(contexts[i] || "").trim() || "(no note)"}` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: small.toString("base64") } });
    }
    content.push({
      type: "text",
      text: "Now return the reel as JSON: the photos in the best narrative order (each with index + caption), plus title, subtitle, ctaHeadline, ctaSub.",
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      system: [{ type: "text", text: STORY_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      output_config: { effort: "high", format: { type: "json_schema", schema: STORY_SCHEMA } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text returned from model");
    const data = JSON.parse(textBlock.text);
    console.log(`Story: ordered ${data.sequence?.length} photos (cache read ${response.usage?.cache_read_input_tokens ?? 0} tok)`);
    res.json(data);
  } catch (err) {
    console.error("Story failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---- refine: turn a natural-language tweak into adjusted settings ----
const REFINE_SYSTEM = `You adjust the settings for a WSTI promo reel based on a short instruction from the user.

You are given the CURRENT settings as JSON and the user's instruction. Return the COMPLETE updated settings (same shape), changing ONLY what the instruction implies and keeping everything else byte-identical.

Field guide:
- format: "reels" (9:16) | "square" (1:1) | "landscape" (16:9)
- perPhotoSeconds: 1.5-6 (higher = slower pace)
- accent: hex colour (the brand default is #3BCB97 green)
- music: must be one of the available track filenames, or null for none
- title / subtitle: intro copy. ctaHeadline / ctaSub: closing copy. kicker, website, handle: brand lines
- captions: array of the on-screen photo captions, IN ORDER. Keep the SAME number of items and order; you may reword or shorten them. Captions should be 2-5 words, punchy, no emojis/hashtags.
- captionScale: 0.6-1.6 (text size; 1 = default, lower = smaller)
- grain: 0-1 (film grain). grade: 0-1 (cinematic colour). lightLeak: 0-1 (drifting leaks). particles: boolean (floating bokeh)
- Brand voice: professional, energetic, inclusive, Western Sydney AI community.

If the user asks for something not controllable here (a brand-new effect, a specific transition, reordering photos, adding/removing photos), leave settings unchanged for that part and explain briefly in "_note". Otherwise set "_note" to a one-line summary of what you changed.`;

const REFINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    format: { type: "string", enum: ["reels", "square", "landscape"] },
    perPhotoSeconds: { type: "number" },
    accent: { type: "string" },
    music: { type: ["string", "null"] },
    title: { type: "string" },
    subtitle: { type: "string" },
    kicker: { type: "string" },
    ctaHeadline: { type: "string" },
    ctaSub: { type: "string" },
    website: { type: "string" },
    handle: { type: "string" },
    captions: { type: "array", items: { type: "string" } },
    captionScale: { type: "number" },
    grain: { type: "number" },
    grade: { type: "number" },
    lightLeak: { type: "number" },
    particles: { type: "boolean" },
    _note: { type: "string" },
  },
  required: [
    "format", "perPhotoSeconds", "accent", "music", "title", "subtitle", "kicker",
    "ctaHeadline", "ctaSub", "website", "handle", "captions", "captionScale",
    "grain", "grade", "lightLeak", "particles", "_note",
  ],
};

app.post("/refine", async (req, res) => {
  try {
    if (!anthropic) return res.status(400).json({ error: "Refine needs ANTHROPIC_API_KEY in reel-maker/.env." });
    const { current, instruction } = req.body || {};
    if (!instruction || !current) return res.status(400).json({ error: "Missing instruction or current settings." });
    const tracks = fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f));

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      system: [{ type: "text", text: REFINE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content:
            `Available music tracks: ${JSON.stringify(tracks)} (or null).\n\n` +
            `CURRENT settings:\n${JSON.stringify(current, null, 2)}\n\n` +
            `Instruction: ${instruction}`,
        },
      ],
      output_config: { effort: "medium", format: { type: "json_schema", schema: REFINE_SCHEMA } },
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No response from model");
    res.json(JSON.parse(textBlock.text));
  } catch (err) {
    console.error("Refine failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Kick off a render. Returns { jobId } immediately; poll /progress/:id.
app.post("/render", assignJobId, upload.array("photos", 20), async (req, res) => {
  try {
    const jobId = req.jobId;
    const meta = JSON.parse(req.body.meta || "{}");
    const files = (req.files || []).sort((a, b) => a.filename.localeCompare(b.filename));
    if (files.length === 0) return res.status(400).json({ error: "No photos uploaded." });

    const captions = Array.isArray(meta.captions) ? meta.captions : [];
    // Downscale to a render-friendly size (1800px) so Chrome isn't decoding
    // multi-MB full-res photos on every frame — the biggest render speed-up.
    const optUrls = [];
    for (let i = 0; i < files.length; i++) {
      const optName = `opt-${String(i).padStart(2, "0")}.jpg`;
      await sharp(files[i].path)
        .rotate()
        .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toFile(path.join(UPLOADS_DIR, jobId, optName));
      optUrls.push(`${BASE}/uploads/${jobId}/${optName}`);
    }

    // Build slides: meta.slides gives [{caption, count}] over the flattened files;
    // fall back to one slide per file (with captions[]) if not provided.
    let slides;
    if (Array.isArray(meta.slides) && meta.slides.length) {
      let cursor = 0;
      slides = meta.slides.map((s) => {
        const count = Math.max(1, Math.min(2, Number(s.count) || 1));
        const images = optUrls.slice(cursor, cursor + count);
        cursor += count;
        return { images, caption: (s.caption || "").trim() };
      });
    } else {
      slides = optUrls.map((u, i) => ({ images: [u], caption: (captions[i] || "").trim() }));
    }

    const inputProps = {
      format: meta.format || "reels",
      slides,
      kicker: meta.kicker ?? "",
      title: meta.title ?? "",
      subtitle: meta.subtitle ?? "",
      ctaHeadline: meta.ctaHeadline ?? "",
      ctaSub: meta.ctaSub ?? "",
      website: meta.website ?? "",
      handle: meta.handle ?? "",
      accent: meta.accent || "#3bcb97",
      bg: meta.bg || "#0B121F",
      perPhotoSeconds: Number(meta.perPhotoSeconds) || 3,
      music: meta.music ? `${BASE}/music/${meta.music}` : null,
      captionScale: clamp(meta.captionScale, 0.6, 1.6, 1),
      grain: clamp(meta.grain, 0, 1, 1),
      particles: meta.particles !== false,
      grade: clamp(meta.grade, 0, 1, 1),
      lightLeak: clamp(meta.lightLeak, 0, 1, 1),
    };

    jobs.set(jobId, { status: "rendering", progress: 0, file: null, error: null });
    res.json({ jobId });

    // Render in the background.
    (async () => {
      try {
        const serveUrl = await getServeUrl();
        const composition = await selectComposition({ serveUrl, id: "WstiReel", inputProps });
        const outputLocation = path.join(OUT_DIR, `${jobId}.mp4`);
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          outputLocation,
          inputProps,
          concurrency: 8, // use more of the 10 cores (default is ~half)
          onProgress: ({ progress }) => {
            const j = jobs.get(jobId);
            if (j) j.progress = progress;
          },
        });
        jobs.set(jobId, { status: "done", progress: 1, file: outputLocation, error: null });
        console.log(`Rendered ${jobId}.mp4 (${composition.durationInFrames} frames)`);
      } catch (err) {
        console.error("Render failed:", err);
        jobs.set(jobId, { status: "error", progress: 0, file: null, error: String(err.message || err) });
      }
    })();
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get("/progress/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: "Unknown job" });
  res.json({ status: j.status, progress: j.progress, error: j.error });
});

app.get("/download/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j || j.status !== "done" || !j.file) return res.status(404).send("Not ready");
  if (req.query.inline === "1") {
    // sendFile supports HTTP range requests + sets video/mp4 — needed for in-browser <video> playback
    return res.sendFile(j.file, { headers: { "Content-Type": "video/mp4" } });
  }
  res.download(j.file, `wsti-reel-${req.params.id}.mp4`);
});

app.listen(PORT, () => {
  console.log(`\n  WSTI Reel Maker running →  ${BASE}\n`);
  getServeUrl(); // warm the bundle so the first render is fast
});
