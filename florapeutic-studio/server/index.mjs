// Florapeutic Studio backend — runs the audio→video pipeline locally.
// Started with `npm run server` (or `npm run studio` to run web + api together).
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { keys, ROOT } from "./lib/env.mjs";
import { startJob, getJob } from "./lib/pipeline.mjs";
import { enhanceScriptOpenAI } from "./lib/openai.mjs";

const PORT = 5181;
const app = express();
app.use(express.json({ limit: "2mb" }));

const upload = multer({ dest: path.join(ROOT, "server", ".uploads") });
fs.mkdirSync(path.join(ROOT, "server", ".uploads"), { recursive: true });

// Health + which keys are configured (booleans only — never echo secrets).
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    keys: {
      openai: Boolean(keys.openai),
      anthropic: Boolean(keys.anthropic),
      higgsfield: Boolean(keys.higgsfield),
      heygen: Boolean(keys.heygen),
    },
  });
});

// Start a job. Accepts either an uploaded audio file ("audio") or a JSON
// { script } to skip transcription.
app.post("/api/generate", upload.single("audio"), (req, res) => {
  try {
    const audioPath = req.file?.path || null;
    const audioName = req.file?.originalname || null;
    const scriptOverride = req.body?.script || null;
    const audience = req.body?.audience || "mixed";
    const aspect = req.body?.aspect || "9:16";
    const contentType = req.body?.contentType || "educational";
    // educational/ad/awareness => Sophia presenter; "story" => animated character
    const mode = contentType === "story" ? "story" : "presenter";
    if (!audioPath && !scriptOverride) return res.status(400).json({ error: "Provide an audio file or a script." });
    const job = startJob({ audioPath, audioName, scriptOverride, audience, aspect, contentType, mode });
    res.json({ id: job.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Enhance a rough script into a polished on-brand script (OpenAI).
app.post("/api/enhance", async (req, res) => {
  try {
    if (!keys.openai) return res.status(400).json({ error: "OpenAI key needed for enhancement." });
    const text = await enhanceScriptOpenAI(keys.openai, req.body?.draft || "");
    res.json({ script: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Regenerate a video with the client's requested changes (HeyGen Video Agent).
app.post("/api/refine", (req, res) => {
  try {
    const { prevPrompt, feedback, contentType = "educational" } = req.body || {};
    if (!prevPrompt || !feedback) return res.status(400).json({ error: "prevPrompt and feedback required." });
    const directPrompt = `${prevPrompt}\n\n--- REVISION REQUESTED BY THE CLIENT ---\nKeep everything that works, but apply these changes and make it even more beautiful and professional:\n${feedback}`;
    const job = startJob({ directPrompt, mode: "presenter", contentType });
    res.json({ id: job.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  const { audioPath, ...safe } = job;
  res.json(safe);
});

// Serve generated videos.
app.use("/generated", express.static(path.join(ROOT, "public", "generated")));

app.listen(PORT, () => {
  console.log(`\n🌸 Florapeutic backend on http://localhost:${PORT}`);
  const have = Object.entries(keys).filter(([, v]) => v).map(([k]) => k);
  console.log(`   keys present: ${have.join(", ") || "none — add them to .env.local"}\n`);
});
