// Talks to the local Florapeutic backend (server/) which runs the full
// audio→video pipeline. Falls back cleanly if the backend isn't running.

export interface JobProgress {
  pct: number;
  step: string;
}

export interface JobResult {
  videoUrl: string | null;
  error: string | null;
}

export async function backendHealth(): Promise<{ ok: boolean; keys?: Record<string, boolean> }> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function enhanceScript(draft: string): Promise<string> {
  const res = await fetch("/api/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `enhance failed (${res.status})`);
  }
  return (await res.json()).script;
}

async function pollJob(id: string, onProgress: (p: JobProgress) => void): Promise<JobResult & { prompt?: string }> {
  for (;;) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetch(`/api/jobs/${id}`);
    if (!res.ok) throw new Error(`job poll failed (${res.status})`);
    const job = await res.json();
    onProgress({ pct: job.pct ?? 0, step: job.step ?? "" });
    if (job.status === "done") return { videoUrl: job.videoUrl, error: null, prompt: job.agentPrompt };
    if (job.status === "error") return { videoUrl: null, error: job.error || "generation failed" };
  }
}

// Regenerate the video with the client's requested changes.
export async function refineVideo(
  prevPrompt: string,
  feedback: string,
  contentType: string,
  onProgress: (p: JobProgress) => void
): Promise<JobResult & { prompt?: string }> {
  const res = await fetch("/api/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prevPrompt, feedback, contentType }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `refine failed (${res.status})`);
  }
  const { id } = await res.json();
  return pollJob(id, onProgress);
}

export async function generateVideo(
  opts: { audio?: Blob | null; audioName?: string | null; script?: string; audience?: string; aspect?: string; contentType?: string },
  onProgress: (p: JobProgress) => void
): Promise<JobResult & { prompt?: string }> {
  const form = new FormData();
  if (opts.audio) form.append("audio", opts.audio, opts.audioName ?? "audio.webm");
  if (opts.script) form.append("script", opts.script);
  if (opts.audience) form.append("audience", opts.audience);
  if (opts.aspect) form.append("aspect", opts.aspect);
  if (opts.contentType) form.append("contentType", opts.contentType);

  const start = await fetch("/api/generate", { method: "POST", body: form });
  if (!start.ok) {
    const e = await start.json().catch(() => ({}));
    throw new Error(e.error || `start failed (${start.status})`);
  }
  const { id } = await start.json();
  return pollJob(id, onProgress);
}
