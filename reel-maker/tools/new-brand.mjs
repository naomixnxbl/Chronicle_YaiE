// Duplicate this reel-maker into a fresh, fully-branded copy for another business.
//
// What it does (no manual editing needed):
//   1. Copies the whole project to a sibling folder (original stays untouched).
//   2. Pulls the business's logo + a brand colour from its website.
//   3. Reads the site (+ any extra context links) and uses Claude to write the
//      brand voice, default copy and tagline.
//   4. Writes the copy's brand.config.json + drops in the logo.
//
// Usage:
//   node tools/new-brand.mjs --name "Acme Robotics" --site https://acme.com \
//     [--slug acme] [--accent "#ff5a36"] [--context "https://acme.com/about,https://acme.com/blog"] \
//     [--out ../acme-reel-maker]
//
// Everything except --name is optional. With no --site it scaffolds a copy with
// placeholder copy you can edit (or re-run later). An ANTHROPIC_API_KEY in
// reel-maker/.env enables the auto-written voice/copy; without it you get sensible
// placeholders.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, ".."); // the reel-maker root

try {
  process.loadEnvFile(path.join(PROJECT_DIR, ".env"));
} catch {
  /* no .env — Claude step will be skipped, placeholders used */
}

// ---------- args ----------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const val = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "true";
    args[key] = val;
  }
}

const name = args.name;
if (!name) {
  console.error('Missing --name. Example:\n  node tools/new-brand.mjs --name "Acme Robotics" --site https://acme.com');
  process.exit(1);
}
const slug = (args.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const site = args.site && args.site !== "true" ? args.site : null;
const accentOverride = args.accent && args.accent !== "true" ? args.accent : null;
const contextLinks = (args.context && args.context !== "true" ? args.context : "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const outDir = path.resolve(PROJECT_DIR, args.out && args.out !== "true" ? args.out : `../${slug}-reel-maker`);

const log = (...m) => console.log(...m);

// ---------- 1. copy the project ----------
const SKIP = new Set(["node_modules", "out", ".git", ".DS_Store"]);
const SKIP_PUBLIC = new Set(["uploads"]); // generated user content, don't copy

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    // drop per-render upload folders but keep the demo/brand/music assets
    if (entry.isDirectory() && path.relative(PROJECT_DIR, s) === path.join("public", "uploads")) continue;
    if (entry.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(outDir)) {
  console.error(`Refusing to overwrite existing folder: ${outDir}\nDelete it or pass a different --out.`);
  process.exit(1);
}
log(`\n→ Copying project to ${outDir}`);
copyTree(PROJECT_DIR, outDir);
// start the copy's uploads/out clean
fs.mkdirSync(path.join(outDir, "public", "uploads"), { recursive: true });
fs.mkdirSync(path.join(outDir, "out"), { recursive: true });

// ---------- 2. fetch site: logo + colour + text ----------
const fetchText = async (url) => {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 reel-maker-brand-bot" }, redirect: "follow" });
    if (!r.ok) return "";
    return await r.text();
  } catch {
    return "";
  }
};

const absUrl = (u, base) => {
  try { return new URL(u, base).href; } catch { return null; }
};

function extractLogoCandidates(html, base) {
  const cands = [];
  const push = (u) => { const a = absUrl(u, base); if (a) cands.push(a); };
  // apple-touch-icon (usually a clean square logo), then og:image, then icons, then <img> with "logo"
  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi)) {
    const href = m[0].match(/href=["']([^"']+)["']/i); if (href) push(href[1]);
  }
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]*>/gi)) {
    const c = m[0].match(/content=["']([^"']+)["']/i); if (c) push(c[1]);
  }
  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)) {
    const href = m[0].match(/href=["']([^"']+)["']/i); if (href) push(href[1]);
  }
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    if (/logo/i.test(m[0])) { const src = m[0].match(/src=["']([^"']+)["']/i); if (src) push(src[1]); }
  }
  return [...new Set(cands)];
}

function extractThemeColor(html) {
  const m = html.match(/<meta[^>]+name=["']theme-color["'][^>]*>/i);
  if (m) { const c = m[0].match(/content=["']([^"']+)["']/i); if (c && /^#?[0-9a-f]{3,8}$/i.test(c[1].trim())) return c[1].trim().startsWith("#") ? c[1].trim() : "#" + c[1].trim(); }
  return null;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}

const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

// pick a vivid-ish colour from the logo (skip near-greys / near-white / near-black)
async function accentFromImage(buf) {
  try {
    const { dominant } = await sharp(buf).stats();
    if (dominant) {
      const { r, g, b } = dominant;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat > 0.25 && max > 40 && min < 230) return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  } catch { /* ignore */ }
  return null;
}

let logoRel = null; // path stored in brand.config (staticFile-relative)
let accent = accentOverride;
let siteText = "";

if (site) {
  log(`→ Fetching ${site}`);
  const html = await fetchText(site);
  if (html) {
    siteText = visibleText(html);
    if (!accent) accent = extractThemeColor(html);
    // try logo candidates in order until one downloads as a real image
    for (const url of extractLogoCandidates(html, site)) {
      try {
        const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        // normalise to png for the form header / video lockup
        const png = await sharp(buf).resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        const rel = `brand/${slug}-logo.png`;
        fs.writeFileSync(path.join(outDir, "public", rel), png);
        logoRel = rel;
        log(`  ✓ logo  → public/${rel}  (from ${url})`);
        if (!accent) accent = await accentFromImage(png);
        break;
      } catch { /* try next candidate */ }
    }
    if (!logoRel) log("  ⚠ no usable logo found on the page — copy will use the wordmark text. Drop a PNG in public/brand/ and point brand.config.json at it.");
  } else {
    log("  ⚠ could not fetch the site (network/blocked). Continuing with placeholders.");
  }
}

// gather extra context
let contextText = "";
for (const url of contextLinks) {
  log(`→ Fetching context ${url}`);
  const t = visibleText(await fetchText(url));
  if (t) contextText += `\n\n[${url}]\n${t.slice(0, 2500)}`;
}

if (!accent) accent = "#3BCB97"; // safe default
accent = accent.toUpperCase();

// ---------- 3. Claude: brand voice + copy ----------
const wordmarkFallback = (() => {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4) return words.map((w) => w[0]).join("").toUpperCase();
  return name.toUpperCase().slice(0, 14);
})();

let generated = null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
if (anthropic && (siteText || contextText)) {
  log("→ Writing brand voice + copy with Claude…");
  const SCHEMA = {
    type: "object", additionalProperties: false,
    properties: {
      wordmark: { type: "string" },
      voice: { type: "string" },
      tagline: { type: "string" },
      defaultCopy: {
        type: "object", additionalProperties: false,
        properties: {
          kicker: { type: "string" }, title: { type: "string" }, subtitle: { type: "string" },
          ctaHeadline: { type: "string" }, ctaSub: { type: "string" }, website: { type: "string" }, handle: { type: "string" },
        },
        required: ["kicker", "title", "subtitle", "ctaHeadline", "ctaSub", "website", "handle"],
      },
    },
    required: ["wordmark", "voice", "tagline", "defaultCopy"],
  };
  try {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1200,
      system: [{ type: "text", text:
        "You set up the brand identity for a photo-to-reel video maker for a specific business. " +
        "From the website text, infer who they are and write: a short WORDMARK (the lockup label, e.g. an acronym or short name, UPPER or brand case), " +
        "a VOICE paragraph (who they are + tone, used to steer caption writing — concrete, not generic), a one-sentence TAGLINE for the tool's homepage, " +
        "and DEFAULT COPY for a promo reel: kicker (small label, often the org name in caps), title (<=8 words), subtitle (<=8 words), " +
        "ctaHeadline (<=5 words), ctaSub (<=10 words), website (bare domain), handle (a plausible @handle). " +
        "Match the business's actual field and tone. No emojis, no hashtags." }],
      messages: [{ role: "user", content:
        `Business name: ${name}\nWebsite: ${site || "(none)"}\n\nWEBSITE TEXT:\n${siteText || "(none)"}\n\nEXTRA CONTEXT:${contextText || " (none)"}` }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    });
    const tb = resp.content.find((b) => b.type === "text");
    if (tb) generated = JSON.parse(tb.text);
    log("  ✓ brand voice + copy written");
  } catch (e) {
    log("  ⚠ Claude step failed (" + (e.message || e) + ") — using placeholders.");
  }
} else if (!anthropic) {
  log("→ No ANTHROPIC_API_KEY — skipping auto copy (placeholders used). Add a key to reel-maker/.env and re-run, or edit brand.config.json.");
}

// ---------- 4. write brand.config.json ----------
const g = generated || {};
const config = {
  id: slug,
  name,
  wordmark: g.wordmark || wordmarkFallback,
  logoImage: logoRel, // null if no logo found → lockup uses the wordmark text
  useBuiltinMark: false, // the WSTI swoosh is WSTI-only
  accent,
  bg: "#0B121F",
  defaultCopy: g.defaultCopy || {
    kicker: name.toUpperCase(),
    title: `Inside ${name}`,
    subtitle: "Real moments, real people",
    ctaHeadline: "Get involved",
    ctaSub: `Learn more about ${name}`,
    website: site ? new URL(site).host.replace(/^www\./, "") : "",
    handle: "@" + slug.replace(/-/g, ""),
  },
  tagline: g.tagline || "Drop your event photos in, add a few notes, and turn them into a polished branded reel.",
  voice: g.voice || `${name} — write warm, human, energetic captions that celebrate the people and the moment. Avoid corporate filler.`,
};
fs.writeFileSync(path.join(outDir, "brand.config.json"), JSON.stringify(config, null, 2) + "\n");

log("\n✅ Done. New branded copy ready:\n");
log(`   ${outDir}`);
log(`   • name:    ${config.name}`);
log(`   • wordmark:${config.wordmark}`);
log(`   • accent:  ${config.accent}`);
log(`   • logo:    ${config.logoImage || "(none — wordmark text)"}`);
log("\nNext:");
log(`   cd ${outDir}`);
log("   npm install      # reuse the original's node_modules by copying, or install fresh");
log("   npm start        # → http://localhost:4321");
log("\nReview brand.config.json and tweak voice/copy/colour if needed, then render.\n");
