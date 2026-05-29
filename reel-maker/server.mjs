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

PAIRING (elegant editorial pairs): when TWO photos clearly belong to the SAME moment or topic — e.g. two angles of the same talk, two people in the same discussion, before/after of one activity — you MAY put them in a single slide that shows both with ONE shared caption. Use this sparingly (at most one or two pairs in a reel) and only when it genuinely strengthens the story. Everything else stays a single photo.

Return "sequence" as a list of slides. Each slide has "indices" (ONE or TWO photo indices, matching the bracketed numbers shown with each photo) and a "caption". Every photo index must appear exactly once across all slides.

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
        ? "TARGET FORMAT: 9:16 vertical (Reels). PAIR GENEROUSLY: a single wide (landscape) photo looks weak in a tall frame, so pair two related landscape photos into one stacked slide wherever it makes sense — aim for most slides to be pairs. Keep portrait shots or a strong hero/group photo as singles. Still respect the narrative arc."
        : format === "square"
        ? "TARGET FORMAT: 1:1 square. Pairing is optional — use it only for genuinely related moments."
        : "TARGET FORMAT: 16:9 landscape. Mostly single photos; pair only two clearly-related shots occasionally.";

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
const REFINE_SYSTEM = `You adjust the settings for a ${brand.name} promo reel based on a short instruction from the user.

You are given the CURRENT settings as JSON and the user's instruction. Return the COMPLETE updated settings (same shape), changing ONLY what the instruction implies and keeping everything else byte-identical.

Field guide:
- format: "reels" (9:16) | "square" (1:1) | "landscape" (16:9)
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
    if (!openai) return res.status(400).json({ error: "Refine needs OPENAI_API_KEY in reel-maker/.env." });
    const { current, instruction } = req.body || {};
    if (!instruction || !current) return res.status(400).json({ error: "Missing instruction or current settings." });
    const tracks = fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f));

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: REFINE_SYSTEM },
        {
          role: "user",
          content:
            `Available music tracks: ${JSON.stringify(tracks)} (or null).\n\n` +
            `CURRENT settings:\n${JSON.stringify(current, null, 2)}\n\n` +
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
app.post("/post/draft", async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ error: "Caption AI needs OPENAI_API_KEY in reel-maker/.env." });
    const meta = req.body || {};
    const reelContext = meta.reelContext || "";
    const slideCaptions = Array.isArray(meta.captions) ? meta.captions : [];
    const sys =
      `You write social-media post copy for ${brand.name} — one draft per platform (Instagram, LinkedIn, Facebook).\n\n` +
      `BRAND & VOICE: ${brand.voice}\n\n` +
      `Each platform has a distinct voice — match it. Captions MUST be visually structured (multiple lines / paragraphs) so they're scroll-friendly. Use REAL LINE BREAKS (\\n) inside the caption text — don't write one long wall of prose.\n\n` +
      `INSTAGRAM — vibey, lowercase-leaning, human, ENERGETIC and full of feeling. Use 3–5 emojis strategically to add emotion + visual rhythm (one near the hook, one mid-body, one at the CTA — not clumped). Structure exactly like this (with blank lines between):\n\n` +
      `<HOOK — one short, scroll-stopping line, often a question or a punchy declaration> [emoji]\n\n<BODY — 1–2 short sentences on what's actually happening, vivid and specific, name names/places/numbers where fitting> [emoji]\n\n<CTA — one warm invitation> [emoji]\n\nHashtags: 10, all lowercase, leading "#". Mix: 2 brand/community + 4 broad-reach + 4 niche/topical. Returned in the hashtags array, not inside the caption.\n\n` +
      `LINKEDIN — professional, sentence-case, formal-but-warm. STRUCTURED with line breaks between paragraphs. Modern LinkedIn welcomes ONE strategic emoji at the start or in the CTA line (👏 🚀 💡 🤝 ✨ are normal). Structure:\n\n` +
      `<HOOK — one sentence framing the moment or insight>\n\n<BODY — 2–3 sentences with the substance: what happened, who was there, what it meant>\n\n<CTA — a thoughtful invitation: a question, a "join us" line, an event nudge>\n\nHashtags: 3–5, CamelCase (#WesternSydneyTech, #AICommunity). In the hashtags array.\n\n` +
      `FACEBOOK — conversational, warm and personal, like talking to a community group. Structured with line breaks. 2–3 strategic emojis for warmth. Structure:\n\n` +
      `<HOOK — one friendly opener> [emoji]\n\n<BODY — 1–2 sentences, the story in plain warm language>\n\n<CTA — friendly invitation, often a question> [emoji]\n\nHashtags: 3–5, lowercase. In the hashtags array.\n\n` +
      `RULES FOR ALL:\n` +
      `- Caption MUST contain literal line breaks (\\n\\n between paragraphs). Never one solid block.\n` +
      `- No quotation marks around the whole caption. No "link in bio" filler.\n` +
      `- Reflect the actual reel content, not generic copy. Name the event, the place (Western Sydney / Parramatta), the people if relevant.\n` +
      `- Emojis must feel intentional, not decorative spam — but DO use them; flat emoji-less captions feel corporate and dead.`;
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
      `BRAND & VOICE: ${brand.voice}\n\n` +
      `PLATFORM CONVENTIONS: ${platformVoice}\n\n` +
      `Apply the user's instruction. Keep what they didn't ask to change. Return the FULL revised caption + hashtags — not a diff.\n` +
      `IMPORTANT: If the instruction doesn't mention hashtags, return the CURRENT hashtags EXACTLY as provided (don't regenerate them). Only the caption changes.`;
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

// Schedule (or post-now) the rendered MP4 to the chosen accounts.
// body: { jobId, caption, hashtags?[], accounts: [{id, platform, pageId?}], scheduledTime?: ISO8601 }
app.post("/post", async (req, res) => {
  try {
    if (!BLOTATO_KEY) return res.status(400).json({ error: "Blotato is off. Add BLOTATO_API_KEY to reel-maker/.env." });
    const { jobId, caption, hashtags, accounts, scheduledTime } = req.body || {};
    if (!jobId) return res.status(400).json({ error: "Missing jobId." });
    if (!Array.isArray(accounts) || !accounts.length) return res.status(400).json({ error: "Pick at least one account to post to." });
    const j = jobs.get(jobId);
    if (!j || j.status !== "done" || !j.file || !fs.existsSync(j.file)) return res.status(400).json({ error: "Render not ready for this job." });

    // 1. Upload the MP4 to Blotato (base64 data URI works for files within the size limit).
    const buf = fs.readFileSync(j.file);
    const dataUri = `data:video/mp4;base64,${buf.toString("base64")}`;
    const uploaded = await blotato("POST", "/media", { url: dataUri });
    const mediaUrl = uploaded.url;
    if (!mediaUrl) throw new Error("Blotato upload returned no URL.");

    // 2. Build the post body for each selected account and schedule it.
    const text = [caption || "", Array.isArray(hashtags) ? hashtags.join(" ") : ""].filter(Boolean).join("\n\n");
    const results = [];
    for (const a of accounts) {
      try {
        const post = {
          accountId: a.id,
          content: { text, mediaUrls: [mediaUrl], platform: a.platform },
          target: { targetType: a.platform },
        };
        if (a.platform === "instagram") post.target.mediaType = "reel";
        if (a.platform === "facebook") { post.target.mediaType = "reel"; if (a.pageId) post.target.pageId = a.pageId; }
        if (a.platform === "linkedin" && a.pageId) post.target.pageId = a.pageId;
        const body = scheduledTime ? { post, scheduledTime } : { post };
        const r = await blotato("POST", "/posts", body);
        results.push({ platform: a.platform, ok: true, id: r.id || r.postId || null, when: scheduledTime || "now" });
      } catch (e) {
        results.push({ platform: a.platform, ok: false, error: String(e.message || e) });
      }
    }
    res.json({ results, mediaUrl });
  } catch (err) {
    console.error("Post failed:", err);
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
  res.download(j.file, `${brand.id}-reel-${req.params.id}.mp4`);
});

app.listen(PORT, () => {
  console.log(`\n  ${brand.name} Reel Maker running →  ${BASE}\n`);
  getServeUrl(); // warm the bundle so the first render is fast
});
