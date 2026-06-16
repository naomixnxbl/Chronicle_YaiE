// WSTI Reel Maker — local web server.
// Upload photos + captions in the browser, render a branded MP4, download it.
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import OpenAI from "openai";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load reel-maker/.env (for OPENAI_API_KEY) if present.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  /* no .env file — narrative feature stays disabled until a key is added */
}
const PORT = process.env.PORT || 4321;
const BASE = `http://localhost:${PORT}`;
const openai = process.env.OPENAI_API_KEY ? new OpenAI() : null;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o"; // vision + structured outputs

// Blotato — schedules posts to Instagram / LinkedIn / Facebook. Needs the user
// to have connected those accounts in the Blotato dashboard first; we look them
// up via /v2/users/me/accounts at request time.
const BLOTATO_KEY = process.env.BLOTATO_API_KEY || null;
const BLOTATO_BASE = "https://backend.blotato.com/v2";

// Tavily — used to fetch a small pool of currently-trending hashtags before we
// draft post captions. Optional: without TAVILY_API_KEY in .env the system
// silently falls back to the AI's training-data hashtag suggestions.
const TAVILY_KEY = process.env.TAVILY_API_KEY || null;
const TRENDING_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — trends don't move that fast
let trendingCache = { at: 0, tags: null };
async function fetchTrendingForBrand() {
  if (!TAVILY_KEY) return null;
  if (trendingCache.tags && (Date.now() - trendingCache.at) < TRENDING_TTL_MS) return trendingCache.tags;
  // Query is brand-aware: ties trending tags to the audience this brand actually reaches.
  const q = `trending hashtags Instagram LinkedIn for ${brand.name.toLowerCase()} — AI community, Western Sydney, tech meetups, AI for jobs`;
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_KEY}` },
      body: JSON.stringify({ query: q, max_results: 5, search_depth: "basic", include_answer: false }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    // Tavily returns { results: [{ title, url, content }, ...] }. Extract hashtag-shaped
    // tokens from the content blobs and dedupe.
    const text = (j.results || []).map((res) => `${res.title || ""} ${res.content || ""}`).join(" ");
    const tags = Array.from(new Set(text.match(/#[\p{L}\p{N}_]{3,40}/giu) || []))
      .filter((t) => !/^#(the|and|for|with)/i.test(t))
      .slice(0, 12);
    if (!tags.length) return null;
    trendingCache = { at: Date.now(), tags };
    return tags;
  } catch {
    return null;
  }
}

async function blotato(method, path, body) {
  if (!BLOTATO_KEY) throw new Error("Blotato key missing (BLOTATO_API_KEY in .env).");
  const r = await fetch(`${BLOTATO_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "blotato-api-key": BLOTATO_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!r.ok) throw new Error(`Blotato ${method} ${path} → ${r.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

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

// Single source of truth for who this instance is branded for. Swap this file
// (and the logo in public/brand/) to rebrand the whole tool — see tools/new-brand.mjs.
const brand = JSON.parse(fs.readFileSync(path.join(__dirname, "brand.config.json"), "utf8"));

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
app.use("/brand", express.static(path.join(PUBLIC_DIR, "brand")));
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "form.html")));

// Brand identity for this instance — the form fetches this to fill its defaults.
app.get("/api/brand", (req, res) => {
  res.json({
    id: brand.id,
    name: brand.name,
    wordmark: brand.wordmark,
    logoImage: brand.logoImage,
    accent: brand.accent,
    bg: brand.bg,
    tagline: brand.tagline ?? "",
    defaultCopy: brand.defaultCopy,
  });
});

// ---- Brand setup intake -----------------------------------------------------
// Three easy ways to seed the brand voice without copy-pasting captions:
//   • /api/brand/from-url   — paste a website URL, AI extracts voice + colour
//   • /api/brand/from-doc   — drop a PDF/DOCX/TXT brand-book, AI distils it
//   • /api/brand/logo       — drop a logo image, saved as the brand logo
// All three write back to brand.config.json so the change persists across restarts.

// Common: ask the AI to distill a chunk of text into brand fields.
async function distillBrandFromText(rawText, sourceLabel) {
  if (!openai) throw new Error("Caption AI needs OPENAI_API_KEY in reel-maker/.env.");
  const text = String(rawText || "").slice(0, 20000); // cap input — gpt is fine with ~5k tokens
  if (text.length < 80) throw new Error("Not enough text to learn from (got " + text.length + " chars).");
  const sys = `You are extracting brand identity from a piece of source text (${sourceLabel}). Return a tight JSON object with:
- name: the brand/organisation name
- voice: 2-3 sentences capturing the brand's tone, values, themes, recurring phrases, who they serve, what they sound like — written for an AI that will draft social posts in this voice
- accent: a hex colour that looks like the brand's primary colour (look for any explicit colour mentions, or infer from sector/personality)
- defaultCopy: { kicker, title, subtitle, ctaHeadline, ctaSub, website, handle } — short defaults that match this brand. Leave empty string if you genuinely can't tell.
Be specific. Quote phrases from the source. If the source is thin, say so in the voice field instead of inventing things.`;
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      name: { type: "string" },
      voice: { type: "string" },
      accent: { type: "string" },
      defaultCopy: {
        type: "object", additionalProperties: false,
        properties: { kicker: { type: "string" }, title: { type: "string" }, subtitle: { type: "string" }, ctaHeadline: { type: "string" }, ctaSub: { type: "string" }, website: { type: "string" }, handle: { type: "string" } },
        required: ["kicker", "title", "subtitle", "ctaHeadline", "ctaSub", "website", "handle"],
      },
    },
    required: ["name", "voice", "accent", "defaultCopy"],
  };
  const r = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 1200,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `SOURCE (${sourceLabel}):\n\n${text}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "brand_distill", strict: true, schema } },
  });
  const m = r.choices?.[0]?.message;
  if (m?.refusal) throw new Error(m.refusal);
  return JSON.parse(m.content);
}

// Persist a partial brand update to brand.config.json safely (reads fresh from disk
// to avoid clobbering anything edited while the server was running).
function saveBrandPatch(patch) {
  const cfgPath = path.join(__dirname, "brand.config.json");
  const onDisk = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const merged = { ...onDisk, ...patch };
  // defaultCopy is nested — shallow-merge it so partial updates don't blow away unset fields
  if (patch.defaultCopy) merged.defaultCopy = { ...(onDisk.defaultCopy || {}), ...patch.defaultCopy };
  fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2) + "\n");
  // Update in-memory brand so subsequent requests see the change without a restart.
  Object.assign(brand, merged);
}

// 1) Paste a website URL — server fetches HTML, strips tags, AI distills voice.
app.post("/api/brand/from-url", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Provide a full URL starting with http(s)://" });
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ReelMaker brand-intake" }, redirect: "follow" });
    if (!r.ok) return res.status(400).json({ error: "Could not fetch URL: " + r.status });
    const html = await r.text();
    // Quick HTML → text: strip script/style, then tags, collapse whitespace.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const distilled = await distillBrandFromText(text, "website " + url);
    if (!distilled.defaultCopy.website) distilled.defaultCopy.website = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    saveBrandPatch(distilled);
    res.json({ ok: true, applied: distilled });
  } catch (err) {
    console.error("from-url failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// 2) Drop a brand-book file — PDF, DOCX, or plain text. AI distills it.
const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/api/brand/from-doc", docUpload.single("doc"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    const buf = req.file.buffer;
    const name = (req.file.originalname || "").toLowerCase();
    let text = "";
    if (name.endsWith(".pdf") || req.file.mimetype === "application/pdf") {
      // pdf-parse exports differently across versions — handle both default + named export.
      const mod = await import("pdf-parse");
      const pdfParse = mod.default || mod.pdf || mod;
      const parsed = await pdfParse(buf);
      text = parsed.text || "";
    } else if (name.endsWith(".docx") || req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value || "";
    } else if (name.endsWith(".txt") || name.endsWith(".md") || req.file.mimetype?.startsWith("text/")) {
      text = buf.toString("utf8");
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use PDF, DOCX, TXT, or MD." });
    }
    const distilled = await distillBrandFromText(text, "uploaded doc " + req.file.originalname);
    saveBrandPatch(distilled);
    res.json({ ok: true, applied: distilled, charsParsed: text.length });
  } catch (err) {
    console.error("from-doc failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// 3) Drop a logo image — saved into public/brand/ and wired into brand config.
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post("/api/brand/logo", logoUpload.single("logo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    if (!req.file.mimetype?.startsWith("image/")) return res.status(400).json({ error: "File must be an image." });
    const ext = (req.file.mimetype === "image/svg+xml") ? "svg"
      : (req.file.mimetype === "image/png") ? "png"
      : (req.file.mimetype === "image/webp") ? "webp" : "png";
    const brandDir = path.join(PUBLIC_DIR, "brand");
    fs.mkdirSync(brandDir, { recursive: true });
    const outName = `${brand.id || "brand"}-logo.${ext}`;
    const outPath = path.join(brandDir, outName);
    if (ext === "svg") {
      // Leave SVG as-is (vector — no rasterising).
      fs.writeFileSync(outPath, req.file.buffer);
    } else {
      // Normalize raster logos: rotate (EXIF), resize to a reasonable max,
      // re-encode as PNG to preserve transparency.
      await sharp(req.file.buffer).rotate().resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(outPath);
    }
    saveBrandPatch({ logoImage: `brand/${outName}`, useBuiltinMark: false });
    // Invalidate the cached Remotion bundle so the next /render rebundles and
    // picks up the new logo file. Without this, the bundle's `public/` snapshot
    // is stale and the renderer 404s when fetching the new logo URL.
    serveUrlPromise = null;
    console.log(`Logo uploaded → ${outName}. Bundle cache invalidated; next render will rebuild it.`);
    res.json({ ok: true, logoImage: `brand/${outName}` });
  } catch (err) {
    console.error("logo upload failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Voice examples — real WSTI posts that the AI uses as canonical samples for
// each platform's tone. Persisted back into brand.config.json so the Brand
// Voice page can edit them without a code change.
app.get("/api/voice-examples", (req, res) => {
  res.json({
    instagram: Array.isArray(brand.voiceExamples?.instagram) ? brand.voiceExamples.instagram : [],
    linkedin: Array.isArray(brand.voiceExamples?.linkedin) ? brand.voiceExamples.linkedin : [],
    facebook: Array.isArray(brand.voiceExamples?.facebook) ? brand.voiceExamples.facebook : [],
  });
});
app.post("/api/voice-examples", (req, res) => {
  try {
    const body = req.body || {};
    const clean = (arr) => (Array.isArray(arr) ? arr : [])
      .map((s) => String(s || "").trim())
      .filter((s) => s.length > 0 && !/^PASTE/i.test(s));
    const next = {
      instagram: clean(body.instagram),
      linkedin: clean(body.linkedin),
      facebook: clean(body.facebook),
    };
    // Read fresh from disk so we don't accidentally overwrite other edits made
    // to brand.config.json while the server was running.
    const cfgPath = path.join(__dirname, "brand.config.json");
    const onDisk = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    onDisk.voiceExamples = next;
    fs.writeFileSync(cfgPath, JSON.stringify(onDisk, null, 2) + "\n");
    // Update in-memory brand so subsequent /post/draft calls see the change without a restart.
    brand.voiceExamples = next;
    res.json({ ok: true, counts: { instagram: next.instagram.length, linkedin: next.linkedin.length, facebook: next.facebook.length } });
  } catch (err) {
    console.error("Voice examples save failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// List background music tracks the user has dropped into public/music/
app.get("/api/music", (req, res) => {
  const files = fs
    .readdirSync(MUSIC_DIR)
    .filter((f) => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f));
  res.json(files);
});

// ---- Jamendo: free royalty-free music search + one-click add to the library ----
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || null;

// Search Jamendo. Returns a simplified list with stream + download URLs.
// Query: ?q=upbeat lofi  &speed=high|medium|low  &limit=10
app.get("/api/music/search", async (req, res) => {
  try {
    if (!JAMENDO_CLIENT_ID) return res.status(400).json({ error: "Jamendo is off. Add JAMENDO_CLIENT_ID to reel-maker/.env (free at https://developer.jamendo.com)." });
    const q = (req.query.q || "").toString().trim();
    const speed = (req.query.speed || "").toString();
    const limit = Math.max(1, Math.min(30, Number(req.query.limit) || 12));
    const params = new URLSearchParams({ client_id: JAMENDO_CLIENT_ID, format: "json", limit: String(limit), order: "popularity_total", audioformat: "mp32" });
    if (q) params.set("fuzzytags", q.split(/\s+/).filter(Boolean).join("+"));
    if (["verylow", "low", "medium", "high", "veryhigh"].includes(speed)) params.set("speed", speed);
    const url = `https://api.jamendo.com/v3.0/tracks/?${params}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Jamendo ${r.status}`);
    const j = await r.json();
    const tracks = (j.results || []).filter((t) => t.audiodownload && t.audiodownload_allowed).map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist_name,
      duration: t.duration,
      stream: t.audio,
      download: t.audiodownload,
      image: t.image || t.album_image,
      tags: ((t.musicinfo && t.musicinfo.tags && [...(t.musicinfo.tags.genres || []), ...(t.musicinfo.tags.vartags || [])]) || []).slice(0, 6),
    }));
    res.json({ tracks });
  } catch (err) {
    console.error("Music search failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Download a Jamendo track into the local music library so it shows in the dropdown.
// Body: { id, name, artist, download }
app.post("/api/music/add", async (req, res) => {
  try {
    const { id, name, artist, download } = req.body || {};
    if (!download) return res.status(400).json({ error: "Missing track download URL." });
    const safe = `${(name || "track").toString()}-${(artist || "").toString()}`
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || `jamendo-${id}`;
    const filename = `${safe}.mp3`;
    const dest = path.join(MUSIC_DIR, filename);
    if (fs.existsSync(dest)) return res.json({ filename, alreadyExisted: true });
    const r = await fetch(download);
    if (!r.ok) throw new Error(`Download failed (${r.status})`);
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    res.json({ filename });
  } catch (err) {
    console.error("Music add failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---- narrative: arrange photos into a story + write captions (OpenAI vision) ----
const STORY_SYSTEM = `You are the story editor for ${brand.name}.

BRAND & VOICE: ${brand.voice}

Your job: turn a set of event photos into a punchy ~30-second reel.

Given the reel's goal and each photo (image + a short note), produce:
1. The best NARRATIVE ORDER — a clear arc: hook (grab attention) -> build (what's happening) -> peak (energy/payoff) -> community (the people) -> lead into the call to action. Use EVERY photo exactly once.
2. A short on-screen CAPTION for each slide.
3. Intro copy (title + subtitle) and outro copy (closing headline + sub-line).

NEVER GROUP / PAIR PHOTOS AUTOMATICALLY. Every photo gets its own slide. The "indices" array MUST contain exactly ONE photo index per slide. Photo pairing is a manual choice the user makes on the upload screen — never something you decide for them.

Return "sequence" as a list of slides. Each slide has "indices" — an array of ONE photo index — and a "caption". Every photo index must appear exactly once across all slides.

Caption voice — be CREATIVE and ON-BRAND (match the voice above):
- 2 to 5 words. Vivid, human, a little playful. Celebrate the people, the energy, and what makes this community special.
- Write them lowercase or in natural sentence case — NEVER Title Case Every Word. They should feel spoken and human (e.g. "where curiosity meets code", "3,400 strong, and growing"), not like ad headlines ("Ideas In Action").
- Reflect what's actually in the photo(s). For a pair, write one caption that ties both together.
- Avoid generic/corporate lines ("great event", "amazing time", "join the movement"). No emojis, no hashtags, no end punctuation.
- Title <= 8 words. Subtitle <= 8 words. Closing headline <= 5 words. Closing sub <= 10 words. Same human, lowercase-leaning tone for these.`;

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
    if (!openai) {
      return res.status(400).json({
        error: "Narrative AI is off. Add OPENAI_API_KEY to reel-maker/.env and restart the server.",
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
        ? "TARGET FORMAT: 9:16 vertical (Reels). One photo per slide. Do NOT pair photos under any circumstances."
        : format === "square"
        ? "TARGET FORMAT: 1:1 square. One photo per slide. Do NOT pair photos."
        : "TARGET FORMAT: 16:9 landscape. One photo per slide. Do NOT pair photos.";

    const content = [
      {
        type: "text",
        text:
          `Reel goal / context:\n${reelContext || `(none provided — infer a strong ${brand.name} community story)`}\n\n` +
          `${formatNote}\n\n` +
          `Here are ${files.length} photos, each shown with its index in [brackets] and a short note. Study every image.`,
      },
    ];
    // Downscale every photo before sending to the model — keeps the request small
    // (full-res phone photos blow past the API size limit) and is plenty for vision.
    for (let i = 0; i < files.length; i++) {
      const small = await sharp(files[i].buffer)
        .rotate() // honour EXIF orientation
        .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toBuffer();
      content.push({ type: "text", text: `Photo [${i}] — note: ${(contexts[i] || "").trim() || "(no note)"}` });
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${small.toString("base64")}` } });
    }
    content.push({
      type: "text",
      text: "Now return the reel as JSON: the photos in the best narrative order (each with index + caption), plus title, subtitle, ctaHeadline, ctaSub.",
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: STORY_SYSTEM },
        { role: "user", content },
      ],
      response_format: { type: "json_schema", json_schema: { name: "reel", strict: true, schema: STORY_SCHEMA } },
    });

    const msg = response.choices?.[0]?.message;
    if (msg?.refusal) throw new Error(msg.refusal);
    if (!msg?.content) throw new Error("No text returned from model");
    const data = JSON.parse(msg.content);
    console.log(`Story: ordered ${data.sequence?.length} photos (${response.usage?.total_tokens ?? 0} tok)`);
    res.json(data);
  } catch (err) {
    console.error("Story failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---- refine: turn a natural-language tweak into adjusted settings ----
// Note: we no longer let the AI change `format` because every render produces
// all three aspect ratios — the user picks per-platform on step 4 instead.
// `template` swaps the visual style (slot architecture in src/templates/).
const REFINE_SYSTEM = `You adjust the settings for a ${brand.name} promo reel based on a short instruction from the user.

You are given the CURRENT settings as JSON and the user's instruction. Return the COMPLETE updated settings (same shape), changing ONLY what the instruction implies and keeping everything else byte-identical.

Field guide:
- template: "signature" (bold/energetic default) | "polaroid" (scrapbook with handwritten captions) | "editorial" (magazine serif, LinkedIn-friendly) | "bold" (huge typography, photo as backdrop) | "documentary" (letterbox, heavy grain, subtitles) | "mono" (B&W with accent splash)
- perPhotoSeconds: 1.5-6 (higher = slower pace)
- accent: hex colour (the brand default is ${brand.accent})
- music: must be one of the available track filenames, or null for none
- title / subtitle: intro copy. ctaHeadline / ctaSub: closing copy. kicker, website, handle: brand lines
- captions: array of the on-screen photo captions, IN ORDER. Keep the SAME number of items and order; you may reword or shorten them. Captions should be 2-5 words, punchy, no emojis/hashtags.
- captionScale: 0.6-1.6 (text size; 1 = default, lower = smaller)
- grain: 0-1 (film grain). grade: 0-1 (cinematic colour). lightLeak: 0-1 (drifting leaks). particles: boolean (floating bokeh)
- Brand voice: ${brand.voice}

If the user asks for something not controllable here (a brand-new effect, a specific transition, reordering photos, adding/removing photos), leave settings unchanged for that part and explain briefly in "_note". Otherwise set "_note" to a one-line summary of what you changed.`;

const REFINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    template: { type: "string", enum: ["signature", "polaroid", "editorial", "bold", "documentary", "mono"] },
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
    "template", "perPhotoSeconds", "accent", "music", "title", "subtitle", "kicker",
    "ctaHeadline", "ctaSub", "website", "handle", "captions", "captionScale",
    "grain", "grade", "lightLeak", "particles", "_note",
  ],
};

app.post("/refine", async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ error: "Refine needs OPENAI_API_KEY in reel-maker/.env." });
    const { current, instruction } = req.body || {};
    if (!instruction || !current) return res.status(400).json({ error: "Missing instruction or current settings." });
    const tracks = fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f));

    // Old drafts may not carry `template` yet — default it so strict-schema validation passes.
    const normalized = { ...current, template: current?.template || "signature" };
    // Don't send the deprecated `format` field — the AI shouldn't see it (and the schema doesn't accept it).
    delete normalized.format;

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: REFINE_SYSTEM },
        {
          role: "user",
          content:
            `Available music tracks: ${JSON.stringify(tracks)} (or null).\n\n` +
            `CURRENT settings:\n${JSON.stringify(normalized, null, 2)}\n\n` +
            `Instruction: ${instruction}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "settings", strict: true, schema: REFINE_SCHEMA } },
    });
    const msg = response.choices?.[0]?.message;
    if (msg?.refusal) throw new Error(msg.refusal);
    if (!msg?.content) throw new Error("No response from model");
    res.json(JSON.parse(msg.content));
  } catch (err) {
    console.error("Refine failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---- Posting to socials via Blotato (Instagram / LinkedIn / Facebook) ----

// List the user's connected social accounts (filtered to IG/LinkedIn/Facebook).
// For Facebook and LinkedIn, also fetches subaccounts (pages) so the UI can pick which page to post to.
app.get("/post/accounts", async (req, res) => {
  try {
    if (!BLOTATO_KEY) return res.status(400).json({ error: "Blotato is off. Add BLOTATO_API_KEY to reel-maker/.env." });
    const data = await blotato("GET", "/users/me/accounts");
    const wanted = new Set(["instagram", "linkedin", "facebook"]);
    // Pin a specific account per platform via env vars (e.g. BLOTATO_LINKEDIN_ACCOUNT_ID).
    const PREFERRED = {
      linkedin: process.env.BLOTATO_LINKEDIN_ACCOUNT_ID || null,
      instagram: process.env.BLOTATO_INSTAGRAM_ACCOUNT_ID || null,
      facebook: process.env.BLOTATO_FACEBOOK_ACCOUNT_ID || null,
    };
    const accounts = (data.items || [])
      .filter((a) => wanted.has(a.platform))
      .filter((a) => !PREFERRED[a.platform] || String(a.id) === String(PREFERRED[a.platform]));
    // For FB/LinkedIn, fetch pages (subaccounts) so the post can target a page.
    for (const a of accounts) {
      if (a.platform === "facebook" || a.platform === "linkedin") {
        try { const sub = await blotato("GET", `/users/me/accounts/${a.id}/subaccounts`); a.pages = sub.items || []; }
        catch { a.pages = []; }
      }
    }
    res.json({ accounts });
  } catch (err) {
    console.error("Accounts fetch failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Draft platform-tailored post captions + hashtags from the reel's meta. Each
// platform gets its own voice/length/hashtag convention — the user picks one,
// reviews, and posts. The same MP4 is posted; only the text differs.
const PLATFORM_DRAFT = {
  type: "object", additionalProperties: false,
  properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
  required: ["caption", "hashtags"],
};
const DRAFT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { instagram: PLATFORM_DRAFT, linkedin: PLATFORM_DRAFT, facebook: PLATFORM_DRAFT },
  required: ["instagram", "linkedin", "facebook"],
};
// Read voiceExamples from brand.config and filter out placeholder strings so
// half-edited configs don't accidentally feed "PASTE HERE" to the AI as real voice.
function realExamples(platform) {
  const ex = brand.voiceExamples?.[platform];
  if (!Array.isArray(ex)) return [];
  return ex.filter((s) => typeof s === "string" && s.trim() && !/^PASTE/i.test(s.trim()));
}

// Build a block of real WSTI posts to show the model as canonical voice samples.
// When the brand config has them, these are the strongest signal in the prompt —
// stronger than the abstract VOICE description.
function voiceBlock(platform) {
  const ex = realExamples(platform);
  if (!ex.length) return ""; // gracefully fall back to platform conventions if none provided
  const list = ex.map((s, i) => `--- ${platform.toUpperCase()} EXAMPLE ${i + 1} ---\n${s}`).join("\n\n");
  return (
    `\n\nCANONICAL ${platform.toUpperCase()} VOICE — these are REAL ${brand.name} posts. Match this tone, sentence rhythm, emoji habits, hashtag style, and signoff patterns. They beat any abstract rule below if there's a conflict:\n\n${list}\n`
  );
}

app.post("/post/draft", async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ error: "Caption AI needs OPENAI_API_KEY in reel-maker/.env." });
    const meta = req.body || {};
    const reelContext = meta.reelContext || "";
    const slideCaptions = Array.isArray(meta.captions) ? meta.captions : [];

    // Live trending hashtag pool from Tavily (best-effort — silently skipped if no key).
    const trending = await fetchTrendingForBrand().catch(() => null);
    const trendingBlock = trending
      ? `\n\nCURRENT TRENDING HASHTAGS (use these where they fit the post — DO NOT force unrelated ones):\n${trending.map((t) => `- ${t}`).join("\n")}\n`
      : "";

    const sys =
      `You write social-media post copy for ${brand.name} — one draft per platform (Instagram, LinkedIn, Facebook). Your job is to maximize reach (algorithmic visibility) while sounding like a real human from this community.\n\n` +
      `BRAND & VOICE: ${brand.voice}\n` +
      voiceBlock("instagram") + voiceBlock("linkedin") + voiceBlock("facebook") +
      trendingBlock +
      `\n=== ALGORITHMIC REACH PLAYBOOK (apply per platform) ===\n\n` +
      `INSTAGRAM — algorithm rewards: scroll-stop in first 3 words, dwell time (caption depth), and SAVES.\n` +
      `- Voice: vibey, lowercase-leaning, energetic. 3–5 strategic emojis (one near hook, one mid-body, one near CTA — never clumped).\n` +
      `- Structure (REAL line breaks between paragraphs):\n` +
      `  • HOOK (1 line, 3–8 words): a question, a bold claim, or a punchy fact. The first 3 words must stop the thumb.\n` +
      `  • BODY (2–4 short paragraphs): tell the story. Name people, places, numbers. ONE save-bait moment — a quotable line or a "screenshot this" insight people want to keep.\n` +
      `  • CTA (1 line): warm invitation — "save this", "tag someone who'd love this", "drop a 💚 if you've been to one".\n` +
      `- Hashtag strategy (return EXACTLY 10–15 in the hashtags array, ALL lowercase, with leading #):\n` +
      `  • 2 brand/community tags (e.g. #wsti, #westernsydneytechinnovators)\n` +
      `  • 3 niche/topical mid-volume tags (e.g. #parramattatech, #aimeetup) — high relevance, less competition\n` +
      `  • 3 broad-reach high-volume tags (e.g. #ai, #techcommunity)\n` +
      `  • 2 community/location tags (e.g. #westernsydney, #sydneystartups)\n` +
      `  • If trending hashtags above fit naturally, weave 1–2 in as REPLACEMENTS, not additions.\n\n` +
      `LINKEDIN — algorithm rewards: dwell time (caption length), saves, and meaningful comments.\n` +
      `- Voice: professional, sentence-case, formal-but-warm. ONE strategic emoji at hook or CTA (✨ 🚀 👏 💡 🤝).\n` +
      `- LENGTH MATTERS: aim for 900–1,400 characters total. Captions over ~210 chars trigger the "…see more" expansion — the click is a strong dwell-time signal. Hit "see more" via a strong hook that demands the click.\n` +
      `- Structure (line breaks every 1–2 sentences for scannability — LinkedIn rewards short paragraphs):\n` +
      `  • HOOK (1 line): a contrarian observation, a number, or a "here's what we learned" line that makes the reader expand.\n` +
      `  • BODY (3–5 short paragraphs): the substance — what happened, who, what it means for the industry/region/jobs.\n` +
      `  • CTA: end with a REAL question that invites comment ("what's working for your team?"), or a "tag your team" line.\n` +
      `- Hashtags: 3–5, CamelCase, in the hashtags array. Mix brand + industry + region (#WesternSydneyTech, #AICommunity, #FutureOfWork).\n\n` +
      `FACEBOOK — algorithm rewards: meaningful conversations (reactions + comments), shares, and dwell time.\n` +
      `- Voice: conversational, warm, like talking to a community group. 2–3 emojis for warmth.\n` +
      `- Structure: HOOK (warm opener with light emoji) → BODY (the story in plain warm language, name people, name the place) → CTA (a friendly question OR "tag a friend who'd love this").\n` +
      `- Questions outperform statements on FB — make the CTA a question whenever it fits.\n` +
      `- Hashtags: 3–5, lowercase, in the hashtags array.\n\n` +
      `RULES FOR ALL:\n` +
      `- Caption MUST contain literal line breaks (\\n\\n between paragraphs). Never one solid block.\n` +
      `- No quotation marks around the whole caption. No "link in bio" filler.\n` +
      `- Reflect the actual reel content. Name the event, the place (Western Sydney / Parramatta), the people if relevant — specificity drives engagement.\n` +
      `- Emojis must feel intentional, not decorative spam — but DO use them; flat emoji-less captions feel corporate and dead.\n` +
      `- DO NOT copy lines verbatim from the canonical voice examples — match the TONE/RHYTHM/STYLE, write fresh content about THIS reel.\n` +
      `- DO NOT invent details that aren't in the reel context or on-screen captions. If a fact isn't given, infer cautiously or leave it out.`;
    const user =
      `Reel goal / context: ${reelContext || "(none — infer from the on-screen captions)"}\n` +
      `Title: ${meta.title || ""}\nSubtitle: ${meta.subtitle || ""}\n` +
      `On-screen captions (the slide-by-slide story):\n${slideCaptions.map((c, i) => `${i + 1}. ${c}`).join("\n") || "(none)"}`;
    const r = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1400,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_schema", json_schema: { name: "post_draft", strict: true, schema: DRAFT_SCHEMA } },
    });
    const m = r.choices?.[0]?.message;
    if (m?.refusal) throw new Error(m.refusal);
    res.json(JSON.parse(m.content));
  } catch (err) {
    console.error("Post draft failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Tweak a single platform's caption + hashtags with a natural-language instruction.
// Body: { platform, caption, hashtags, instruction, meta }
const REFINE_DRAFT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
  required: ["caption", "hashtags"],
};
app.post("/post/refine", async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ error: "Caption AI needs OPENAI_API_KEY in reel-maker/.env." });
    const { platform, caption, hashtags, instruction, meta } = req.body || {};
    if (!platform || !instruction) return res.status(400).json({ error: "Missing platform or instruction." });
    const platformVoice = ({
      instagram: "vibey, lowercase, energetic, 3–5 strategic emojis. STRUCTURE: hook (1 line) \\n\\n body (1–2 sentences) \\n\\n CTA, with line breaks between. 10 lowercase hashtags.",
      linkedin: "professional, sentence-case, formal-but-warm, one strategic emoji (eg ✨ 🚀 👏) at hook or CTA is fine. STRUCTURE: hook \\n\\n body (2–3 sentences) \\n\\n CTA. 3–5 CamelCase hashtags.",
      facebook: "conversational and warm, 2–3 strategic emojis. STRUCTURE: hook \\n\\n body \\n\\n CTA, with line breaks. 3–5 lowercase hashtags.",
    })[platform] || "on-brand";
    const sys =
      `You revise a SINGLE social media post for ${brand.name} on ${platform}.\n\n` +
      `BRAND & VOICE: ${brand.voice}\n` +
      voiceBlock(platform) +
      `\nPLATFORM CONVENTIONS: ${platformVoice}\n\n` +
      `Apply the user's instruction. Keep what they didn't ask to change. Return the FULL revised caption + hashtags — not a diff.\n` +
      `IMPORTANT: If the instruction doesn't mention hashtags, return the CURRENT hashtags EXACTLY as provided (don't regenerate them). Only the caption changes.\n` +
      `IMPORTANT: Do not copy lines verbatim from the canonical voice examples — match the tone/rhythm/style only.`;
    const ctx = meta ? `Reel context: ${meta.reelContext || ""}\nOn-screen captions: ${(meta.captions || []).join(" | ")}` : "";
    const user =
      `${ctx ? ctx + "\n\n" : ""}` +
      `CURRENT caption:\n${caption || "(empty)"}\n\n` +
      `CURRENT hashtags: ${(hashtags || []).join(" ") || "(none)"}\n\n` +
      `User's instruction: ${instruction}`;
    const r = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 700,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_schema", json_schema: { name: "post_refine", strict: true, schema: REFINE_DRAFT_SCHEMA } },
    });
    const m = r.choices?.[0]?.message;
    if (m?.refusal) throw new Error(m.refusal);
    res.json(JSON.parse(m.content));
  } catch (err) {
    console.error("Post refine failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---- POST flow: prepare-photos endpoint ------------------------------------
// The Post path (not Reel) uses this to auto-crop user photos to a target
// platform aspect ratio with sharp's saliency-aware "attention" strategy, then
// ---- Post-edit refine: tweak the Post-mode edit settings with plain English -
// Body: { current: { aspect, enhance, crop, font, captions }, instruction }
// Returns the updated edit state. The Post edit page calls this when the user
// types into the "Tweak anything ✨" prompt box and clicks Apply.
const POST_EDIT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    aspect: { type: "string", enum: ["square", "portrait", "story", "landscape"] },
    enhance: { type: "string", enum: ["on", "off"] },
    crop: { type: "string", enum: ["whole", "cover", "center"] },
    font: { type: "string", enum: ["bold-display", "modern-sans", "editorial-serif", "handwritten", "stencil"] },
    captions: { type: "array", items: { type: "string" } },
    _note: { type: "string" },
  },
  required: ["aspect", "enhance", "crop", "font", "captions", "_note"],
};
app.post("/post/edit-refine", async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ error: "Refine AI needs OPENAI_API_KEY in reel-maker/.env." });
    const { current, instruction } = req.body || {};
    if (!instruction || !current) return res.status(400).json({ error: "Missing instruction or current settings." });
    const sys = `You adjust the photo-post edit settings for ${brand.name} based on a short instruction from the user.

You are given the CURRENT edit state as JSON and the user's instruction. Return the COMPLETE updated state (same shape), changing ONLY what the instruction implies and keeping everything else byte-identical.

Field guide:
- aspect: "square" (1:1 — IG/LinkedIn/FB feed) | "portrait" (4:5 — Instagram-tall) | "story" (9:16 — Reels/Stories) | "landscape" (16:9 — LinkedIn/YouTube)
- enhance: "on" (sharpen + colour pop) | "off" (keep original)
- crop: "whole" (show whole photo with blurred backdrop fill) | "cover" (smart saliency-aware crop) | "center" (centred crop)
- font: "bold-display" (Impact-style, uppercase, tight) | "modern-sans" (clean Helvetica, sentence case) | "editorial-serif" (Playfair / magazine-style) | "handwritten" (Marker Felt, warm) | "stencil" (chunky military)
- captions: array of on-photo text overlays — one entry per photo, IN ORDER. Keep the SAME NUMBER of items as the input. Each caption is 2–5 words, punchy, lowercase-leaning or sentence case (NEVER Title Case Every Word). No emojis, no hashtags, no end punctuation. An empty string "" means no overlay on that photo.
- Brand voice: ${brand.voice}

If the user asks for something not controllable here (add/remove photos, change a logo, etc.), leave everything unchanged and explain briefly in "_note". Otherwise set "_note" to a one-line summary of what you changed.`;
    const user = `CURRENT settings:\n${JSON.stringify(current, null, 2)}\n\nInstruction: ${instruction}`;
    const r = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "post_edit", strict: true, schema: POST_EDIT_SCHEMA } },
    });
    const msg = r.choices?.[0]?.message;
    if (msg?.refusal) throw new Error(msg.refusal);
    if (!msg?.content) throw new Error("No response from model");
    res.json(JSON.parse(msg.content));
  } catch (err) {
    console.error("Post edit refine failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// gentle sharpen + colour pop and an optional caption overlay (SVG composite).
// Output: a list of public URLs the user can then post to socials via /post.

// Output sizes per supported aspect. Square is intentionally Instagram-native.
const POST_ASPECTS = {
  square:    { w: 1080, h: 1080 },
  portrait:  { w: 1080, h: 1350 },
  story:     { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
};

// Font presets — each picks a different vibe. The font stack lists multiple
// candidate families so librsvg (sharp's SVG engine) can resolve whichever
// is installed on this machine. All five rely only on macOS / Windows system
// fonts so no extra binary assets are needed.
const CAPTION_FONTS = {
  "bold-display": {
    label: "Bold Display",
    family: "Impact, 'Helvetica Neue', 'Arial Black', sans-serif",
    weight: 900,
    upper: true,
    letterSpacing: -1.5,
    italic: false,
  },
  "modern-sans": {
    label: "Modern Sans",
    family: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    weight: 800,
    upper: false,
    letterSpacing: -0.5,
    italic: false,
  },
  "editorial-serif": {
    label: "Editorial Serif",
    family: "'Playfair Display', Georgia, 'Times New Roman', Times, serif",
    weight: 800,
    upper: false,
    letterSpacing: 0,
    italic: false,
  },
  "handwritten": {
    label: "Handwritten",
    family: "'Marker Felt', 'Bradley Hand', 'Comic Sans MS', cursive",
    weight: 700,
    upper: false,
    letterSpacing: 0,
    italic: false,
  },
  "stencil": {
    label: "Stencil",
    family: "Stencil, 'Stencil Std', Impact, 'Arial Black', sans-serif",
    weight: 900,
    upper: true,
    letterSpacing: 2,
    italic: false,
  },
};

// Build a caption-overlay SVG. Font choice is configurable via opts.font
// (one of the keys in CAPTION_FONTS); a brand-coloured accent rule sits above
// the text and the last line picks up the brand accent for one highlight word.
function captionSvg(text, w, h, opts = {}) {
  if (!text) return null;
  const accent = opts.accent || "#3BCB97";
  const fontKey = CAPTION_FONTS[opts.font] ? opts.font : "bold-display";
  const F = CAPTION_FONTS[fontKey];
  const safe = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Big enough to read at-a-glance on a phone (was w/24 in v1, now w/16).
  const fontSize = Math.round(w / 16);
  const lineHeight = Math.round(fontSize * 1.0); // tight stack, display-style
  const padTop = Math.round(fontSize * 0.55);
  const padBottom = Math.round(fontSize * 0.9);
  const ruleH = Math.max(4, Math.round(w / 220));
  const ruleW = Math.round(w * 0.10);

  // Word-wrap to fill the band width — display fonts are narrow so we can fit
  // more chars per line than a regular sans. Tighten the char count for serifs
  // (which set wider than the condensed display fonts).
  const charDensity = F.family.includes("serif") ? 0.55 : 0.42;
  const maxCharsPerLine = Math.max(14, Math.floor(w / (fontSize * charDensity)));
  const rawWords = String(text).split(/\s+/).filter(Boolean);
  const words = F.upper ? rawWords.map((w) => w.toUpperCase()) : rawWords;
  const lines = [];
  let cur = "";
  for (const word of words) {
    if ((cur ? cur + " " : "").length + word.length > maxCharsPerLine) {
      if (cur) lines.push(cur);
      cur = word;
    } else {
      cur = cur ? cur + " " + word : word;
    }
  }
  if (cur) lines.push(cur);

  const bandHeight = lines.length * lineHeight + padTop + padBottom + ruleH + Math.round(fontSize * 0.4);
  const bandTop = h - bandHeight;
  const ruleTop = bandTop + padTop;
  const textTop = ruleTop + ruleH + Math.round(fontSize * 0.55) + fontSize * 0.85; // baseline of first line

  // Pick which line gets the accent colour — last line if 2+ lines (the "key"
  // phrase usually lands at the end), otherwise the only line.
  const accentLineIdx = lines.length > 1 ? lines.length - 1 : -1;
  const tspans = lines.map((l, i) => {
    const fill = i === accentLineIdx ? accent : "#ffffff";
    return `<text x="${w / 2}" y="${textTop + i * lineHeight}" font-family="${F.family}" font-weight="${F.weight}" font-size="${fontSize}" letter-spacing="${F.letterSpacing}" font-style="${F.italic ? "italic" : "normal"}" fill="${fill}" text-anchor="middle" style="paint-order: stroke; stroke: rgba(0,0,0,0.85); stroke-width: ${Math.round(fontSize * 0.06)}px; stroke-linejoin: round;">${safe(l)}</text>`;
  }).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity="0.88"/>
        <stop offset="0.7" stop-color="#000" stop-opacity="0.25"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
      <filter id="ds" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="${Math.round(fontSize * 0.05)}" stdDeviation="${Math.round(fontSize * 0.04)}" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect x="0" y="${bandTop}" width="${w}" height="${bandHeight}" fill="url(#g)"/>
    <rect x="${(w - ruleW) / 2}" y="${ruleTop}" width="${ruleW}" height="${ruleH}" rx="${ruleH / 2}" fill="${accent}"/>
    <g filter="url(#ds)">
      ${tspans}
    </g>
  </svg>`);
}

const postPrepareUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

app.post("/post-prepare", postPrepareUpload.array("media", 20), async (req, res) => {
  try {
    const aspectKey = POST_ASPECTS[req.body.aspect] ? req.body.aspect : "square";
    const dims = POST_ASPECTS[aspectKey];
    const enhance = req.body.enhance !== "off";
    // How the photo fills the target aspect:
    //   "whole" (default) — WHOLE photo always visible, blurred backdrop fills the bars.
    //   "cover" — fill edge-to-edge, saliency-aware crop (keeps faces in view).
    //   "center" — fill edge-to-edge, centred crop.
    // Old client values "attention" or empty fall through to "whole" since the
    // user explicitly asked for the whole-photo default.
    const cropChoiceRaw = req.body.crop || "whole";
    const cropChoice = ["whole", "cover", "center"].includes(cropChoiceRaw) ? cropChoiceRaw : "whole";
    const wholePhoto = cropChoice === "whole";
    // Font for text overlays — client passes one of the CAPTION_FONTS keys.
    const fontChoice = CAPTION_FONTS[req.body.font] ? req.body.font : "bold-display";
    const cropMode = cropChoice === "center" ? sharp.position.center : sharp.strategy.attention;
    const manifest = (() => { try { return JSON.parse(req.body.manifest || "[]"); } catch { return []; } })();
    const manifestList = Array.isArray(manifest) ? manifest : [];
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "No media uploaded." });

    const batchId = crypto.randomBytes(6).toString("hex");
    const outDir = path.join(UPLOADS_DIR, "post", batchId);
    fs.mkdirSync(outDir, { recursive: true });

    const items = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const m = manifestList[i] || {};
      const id = m.id || `m${i}`;
      const caption = m.caption || "";
      const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
      const outName = `${String(i).padStart(2, "0")}-${safeId || ("m" + i)}.jpg`;
      const outPath = path.join(outDir, outName);

      // Source buffer (rotated for EXIF).
      const srcBuffer = await sharp(file.buffer).rotate().toBuffer();

      let processedBuf;
      if (wholePhoto) {
        // ----- CONTAIN ON BLURRED BACKDROP (same pattern reel templates use) -----
        // 1. Backdrop: blur + scale the source to fill the target aspect (cover).
        // 2. Foreground: contain the source so the WHOLE image fits (no crop).
        // 3. Composite foreground on backdrop, then optionally apply enhance pass.
        const bgImg = sharp(srcBuffer).resize({ width: dims.w, height: dims.h, fit: "cover", position: sharp.strategy.attention }).blur(28).modulate({ brightness: 0.55, saturation: 1.25 });
        const bg = await bgImg.toBuffer();
        // Foreground at full quality, contained inside the target.
        const fg = await sharp(srcBuffer).resize({ width: dims.w, height: dims.h, fit: "inside", withoutEnlargement: false }).toBuffer();
        // Composite the contained photo centered on the blurred backdrop.
        let composed = sharp(bg).composite([{ input: fg, gravity: "center" }]);
        if (enhance) composed = composed.modulate({ brightness: 1.03, saturation: 1.08 }).sharpen({ sigma: 0.8, m1: 0.6, m2: 2 });
        processedBuf = await composed.jpeg({ quality: 92, progressive: true, chromaSubsampling: "4:4:4" }).toBuffer();
      } else {
        // ----- COVER (legacy) — fill edge-to-edge, saliency-aware crop -----
        let img = sharp(srcBuffer).resize({ width: dims.w, height: dims.h, fit: "cover", position: cropMode });
        if (enhance) img = img.modulate({ brightness: 1.04, saturation: 1.1 }).sharpen({ sigma: 1.0, m1: 0.7, m2: 2 });
        processedBuf = await img.jpeg({ quality: 92, progressive: true, chromaSubsampling: "4:4:4" }).toBuffer();
      }

      // Caption overlay — composited last so it sits on top of the final image.
      if (caption) {
        const svg = captionSvg(caption, dims.w, dims.h, { accent: brand.accent, font: fontChoice });
        await sharp(processedBuf).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 92, progressive: true, chromaSubsampling: "4:4:4" }).toFile(outPath);
      } else {
        await sharp(processedBuf).jpeg({ quality: 92, progressive: true, chromaSubsampling: "4:4:4" }).toFile(outPath);
      }
      items.push({ id, url: `${BASE}/uploads/post/${batchId}/${outName}`, mime: "image/jpeg" });
    }

    res.json({ batchId, aspect: aspectKey, items });
  } catch (err) {
    console.error("Post-prepare failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Read a local /uploads URL and upload its bytes to Blotato, returning the Blotato URL.
// Used by both Reel mode (rendered MP4) and Post mode (prepared photos).
async function uploadLocalToBlotato(localUrl) {
  if (typeof localUrl !== "string" || !localUrl.startsWith(BASE + "/")) {
    throw new Error("Refusing to upload non-local URL: " + localUrl);
  }
  const relativePath = localUrl.slice((BASE + "/").length);
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  // Path-traversal guard — must stay under PUBLIC_DIR.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    throw new Error("Path traversal blocked: " + relativePath);
  }
  if (!fs.existsSync(filePath)) throw new Error("File not found: " + relativePath);
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".mp4" ? "video/mp4" : "image/jpeg";
  const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
  const uploaded = await blotato("POST", "/media", { url: dataUri });
  if (!uploaded?.url) throw new Error("Blotato media upload returned no URL.");
  return uploaded.url;
}

// Post to the chosen socials. Handles BOTH flows:
//   Reel mode: body has { jobId } — uploads the rendered MP4 from the jobs map.
//   Post mode: body has { mediaUrls: [...] } — already-prepared photos from /post-prepare.
//                                              + posting: "carousel" | "separate" (default carousel).
// Per-account caption/hashtags is supported in both modes.
app.post("/post", async (req, res) => {
  try {
    if (!BLOTATO_KEY) return res.status(400).json({ error: "Blotato is off. Add BLOTATO_API_KEY to reel-maker/.env." });
    const { jobId, mediaUrls, posting, caption, hashtags, accounts, scheduledTime } = req.body || {};
    if (!Array.isArray(accounts) || !accounts.length) return res.status(400).json({ error: "Pick at least one account to post to." });

    // --- collect blotato media URLs once (reused across accounts) -----------
    let bloMedia = []; // [blotato-url, ...]
    let isVideo = false;
    let videoFormat = null; // tracks reel-aspect for mediaType:"reel" gating
    if (jobId) {
      // Reel mode: upload the rendered MP4.
      const j = jobs.get(jobId);
      if (!j || j.status !== "done" || !j.file || !fs.existsSync(j.file)) return res.status(400).json({ error: "Render not ready for this job." });
      const buf = fs.readFileSync(j.file);
      const dataUri = `data:video/mp4;base64,${buf.toString("base64")}`;
      const uploaded = await blotato("POST", "/media", { url: dataUri });
      if (!uploaded?.url) throw new Error("Blotato upload returned no URL.");
      bloMedia = [uploaded.url];
      isVideo = true;
      videoFormat = j.format || "reels";
    } else if (Array.isArray(mediaUrls) && mediaUrls.length) {
      // Post mode: upload each prepared photo in order. (Videos later.)
      for (const url of mediaUrls) bloMedia.push(await uploadLocalToBlotato(url));
    } else {
      return res.status(400).json({ error: "Provide either jobId (reel mode) or mediaUrls (post mode)." });
    }

    const fallbackText = [caption || "", Array.isArray(hashtags) ? hashtags.join(" ") : ""].filter(Boolean).join("\n\n");
    // Carousel = send all media in one post per account. Separate = one post per media per account.
    const mode = (posting === "separate" && bloMedia.length > 1) ? "separate" : "carousel";
    // bloMedia[] groupings: carousel = [allUrls]; separate = [[url1],[url2],...]
    const groups = mode === "carousel" ? [bloMedia] : bloMedia.map((u) => [u]);

    const results = [];
    for (const a of accounts) {
      const accountCaption = typeof a.caption === "string" ? a.caption : null;
      const accountTags = Array.isArray(a.hashtags) ? a.hashtags.join(" ") : null;
      const text = (accountCaption !== null || accountTags !== null)
        ? [accountCaption || "", accountTags || ""].filter(Boolean).join("\n\n")
        : fallbackText;
      for (let gi = 0; gi < groups.length; gi++) {
        try {
          const post = {
            accountId: a.id,
            content: { text, mediaUrls: groups[gi], platform: a.platform },
            target: { targetType: a.platform },
          };
          // mediaType=reel only applies to 9:16 vertical videos. Photo posts never set it.
          if (isVideo) {
            if (a.platform === "instagram" && videoFormat === "reels") post.target.mediaType = "reel";
            if (a.platform === "facebook" && videoFormat === "reels") post.target.mediaType = "reel";
          }
          if (a.platform === "facebook" && a.pageId) post.target.pageId = a.pageId;
          if (a.platform === "linkedin" && a.pageId) post.target.pageId = a.pageId;
          const body = scheduledTime ? { post, scheduledTime } : { post };
          const r = await blotato("POST", "/posts", body);
          results.push({ platform: a.platform, group: gi, ok: true, id: r.id || r.postId || null, when: scheduledTime || "now" });
        } catch (e) {
          results.push({ platform: a.platform, group: gi, ok: false, error: String(e.message || e) });
        }
      }
    }
    res.json({ results, mode, mediaCount: bloMedia.length });
  } catch (err) {
    console.error("Post failed:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Aspect ratios the server knows how to render — used to validate meta.format.
const RENDER_FORMATS = ["reels", "square", "landscape"];

// Kick off a render. Returns { jobId } immediately; poll /progress/:id.
// One render per click; the user picks the aspect ratio on step 3 and the
// rendered MP4 is what step 4 previews and posts to whichever platforms they tick.
app.post("/render", assignJobId, upload.array("photos", 20), async (req, res) => {
  try {
    const jobId = req.jobId;
    const meta = JSON.parse(req.body.meta || "{}");
    const files = (req.files || []).sort((a, b) => a.filename.localeCompare(b.filename));
    if (files.length === 0) return res.status(400).json({ error: "No photos uploaded." });

    const captions = Array.isArray(meta.captions) ? meta.captions : [];
    // Downscale to a render-friendly size (1800px) so Chrome isn't decoding
    // multi-MB full-res photos on every frame. `fit: inside` preserves the
    // original aspect ratio — templates use the contained-on-blurred-backdrop
    // pattern to fill the frame WITHOUT cropping the photo. (We tried server-
    // side smart-crop briefly; it lost important edges, so reverted.)
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

    // Shared props across all three formats (format itself is set per-render below).
    const baseProps = {
      slides,
      template: meta.template || "signature",
      kicker: meta.kicker ?? brand.defaultCopy.kicker,
      title: meta.title ?? brand.defaultCopy.title,
      subtitle: meta.subtitle ?? brand.defaultCopy.subtitle,
      ctaHeadline: meta.ctaHeadline ?? brand.defaultCopy.ctaHeadline,
      ctaSub: meta.ctaSub ?? brand.defaultCopy.ctaSub,
      website: meta.website ?? brand.defaultCopy.website,
      handle: meta.handle ?? brand.defaultCopy.handle,
      accent: meta.accent || brand.accent,
      bg: meta.bg || brand.bg,
      wordmark: brand.wordmark,
      logoImage: brand.logoImage,
      useBuiltinMark: brand.useBuiltinMark,
      perPhotoSeconds: Number(meta.perPhotoSeconds) || 3,
      music: meta.music ? `${BASE}/music/${meta.music}` : null,
      captionScale: clamp(meta.captionScale, 0.6, 1.6, 1),
      grain: clamp(meta.grain, 0, 1, 1),
      particles: meta.particles !== false,
      grade: clamp(meta.grade, 0, 1, 1),
      lightLeak: clamp(meta.lightLeak, 0, 1, 1),
    };

    const format = RENDER_FORMATS.includes(meta.format) ? meta.format : "reels";
    const inputProps = { ...baseProps, format };
    jobs.set(jobId, { status: "rendering", progress: 0, file: null, format, error: null });
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
          concurrency: 8,
          onProgress: ({ progress }) => {
            const j = jobs.get(jobId);
            if (j) j.progress = progress;
          },
        });
        const j = jobs.get(jobId);
        if (j) { j.status = "done"; j.progress = 1; j.file = outputLocation; }
        console.log(`Rendered ${jobId}.mp4 (${format}, ${composition.durationInFrames} frames)`);
      } catch (err) {
        console.error("Render failed:", err);
        const j = jobs.get(jobId);
        if (j) { j.status = "error"; j.progress = 0; j.file = null; j.error = String(err.message || err); }
      }
    })();
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// The `jobs` Map is in-memory only, so a server restart wipes it. Both
// /progress and /download fall back to checking the rendered MP4 on disk —
// the user can still preview / download a render they kicked off in a
// previous server run, without having to re-render.
function jobFilePath(jobId) {
  return path.join(OUT_DIR, `${jobId}.mp4`);
}

app.get("/progress/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (j) {
    return res.json({ status: j.status, progress: j.progress, error: j.error, format: j.format });
  }
  // Fallback: file on disk = the render finished before a server restart.
  if (fs.existsSync(jobFilePath(req.params.id))) {
    return res.json({ status: "done", progress: 1, error: null, format: "reels", recovered: true });
  }
  return res.status(404).json({ error: "Unknown job" });
});

app.get("/download/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  const file = (j && j.status === "done" && j.file) ? j.file : jobFilePath(req.params.id);
  if (!fs.existsSync(file)) return res.status(404).send("Not ready");
  if (req.query.inline === "1") {
    // sendFile supports HTTP range requests + sets video/mp4 — needed for in-browser <video> playback
    return res.sendFile(file, { headers: { "Content-Type": "video/mp4" } });
  }
  res.download(file, `${brand.id}-reel-${req.params.id}.mp4`);
});

app.listen(PORT, () => {
  console.log(`\n  ${brand.name} Reel Maker running →  ${BASE}\n`);
  getServeUrl(); // warm the bundle so the first render is fast
});
