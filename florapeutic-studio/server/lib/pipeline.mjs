// Orchestrates one video job: audio → transcript → on-brand brief → HeyGen
// Video Agent (script, presenter, b-roll, captions, music) → Florapeutic brand
// outro. Educational & Awareness both use this presenter flow.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { keys, ROOT } from "./env.mjs";
import { transcribe } from "./openai.mjs";
import { brandify } from "./assemble.mjs";
import { startVideoAgent, waitAvatarVideo, downloadHeyGen, buildBrief } from "./heygen.mjs";

const OUT_DIR = path.join(ROOT, "public", "generated");
fs.mkdirSync(OUT_DIR, { recursive: true });

const jobs = new Map();
export const getJob = (id) => jobs.get(id);

export function startJob(opts) {
  const id = crypto.randomUUID();
  const job = { id, status: "queued", pct: 0, step: "Queued", videoUrl: null, error: null, logs: [] };
  jobs.set(id, job);
  run(job, opts).catch((e) => {
    job.status = "error";
    job.error = e.message;
    job.logs.push("ERROR: " + e.message);
  });
  return job;
}

function set(job, pct, step) {
  job.pct = pct;
  job.step = step;
  job.logs.push(`[${pct}%] ${step}`);
}

// Generate the HeyGen video from a finished prompt, append the brand outro, save.
async function renderAndBrand(job, work, prompt, startPct) {
  job.agentPrompt = prompt;
  set(job, startPct, "HeyGen Video Agent is generating (script, visuals, animations)…");
  const vid = await startVideoAgent(keys.heygen, prompt);
  let pct = startPct;
  const url = await waitAvatarVideo(keys.heygen, vid, () => {
    pct = Math.min(88, pct + 1);
    job.pct = pct;
    job.step = "HeyGen Video Agent rendering…";
  });

  set(job, 90, "Downloading your video…");
  const raw = path.join(work, "heygen.mp4");
  await downloadHeyGen(url, raw);

  set(job, 95, "Adding the Florapeutic brand outro…");
  const branded = await brandify(work, raw);
  const publicName = `${job.id}.mp4`;
  fs.copyFileSync(branded, path.join(OUT_DIR, publicName));
  job.videoUrl = `/generated/${publicName}`;
  set(job, 100, "Done");
  job.status = "done";
}

async function run(job, { audioPath, audioName, scriptOverride, contentType = "educational", directPrompt = null }) {
  if (!keys.heygen) throw new Error("HeyGen key missing — set VITE_HEYGEN_KEY in .env.local");
  job.status = "running";
  const work = path.join(OUT_DIR, job.id);
  fs.mkdirSync(work, { recursive: true });

  // REFINE: a full prompt (original brief + the client's changes) is supplied.
  if (directPrompt) {
    await renderAndBrand(job, work, directPrompt, 25);
    return;
  }

  // 1. content: typed text needs no AI; audio is transcribed with OpenAI Whisper.
  let transcript = scriptOverride;
  if (!transcript) {
    if (!keys.openai) throw new Error("Audio needs an OpenAI key for transcription (HeyGen can't read audio). Or type your topic in the Script step.");
    set(job, 8, "Transcribing your audio…");
    transcript = await transcribe(keys.openai, audioPath, audioName);
  }
  job.transcript = transcript;

  // 2. on-brand brief (local, no AI) → HeyGen Video Agent → brand outro.
  set(job, 18, `Preparing the ${contentType} brief for HeyGen…`);
  await renderAndBrand(job, work, buildBrief(transcript, contentType), 30);
}
