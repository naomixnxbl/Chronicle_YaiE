// HeyGen video engine — the Video Agent auto-generates the whole video
// (script, presenter, b-roll, captions, music) from an on-brand brief.
const BASE = "https://api.heygen.com";

// Build the Video Agent brief locally (NO OpenAI) — HeyGen's agent writes the
// script and produces everything itself. We just hand it an on-brand,
// engagement-focused directive + the founder's talking points.
export function buildBrief(content, contentType = "educational") {
  const goal = {
    educational: "Teach ONE memorable idea and make the viewer feel it; end with 'Learn more at florapeutic.com.au'.",
    ad: "Make the viewer want to preserve their own flowers; end with 'Get a quote at florapeutic.com.au'.",
    awareness: "Move the viewer about flower waste and shared joy; end with 'Follow @florapeutic and share this'.",
  }[contentType] || "Teach one memorable idea and make the viewer feel it.";

  return `Create a BEAUTIFUL, PROFESSIONAL, production-ready ~30-40 second ${contentType} video for Florapeutic — a Sydney business that turns event flowers (weddings, funerals, milestones) into preserved keepsakes and donates blooms to lonely elderly Australians. Flowers are MEMORIES, not products. This must look broadcast-quality and polished — ready to publish, not a draft.

Write the script yourself from the talking points below — but ELEVATE it: open on a scroll-stopping emotional hook in the first 2 seconds, follow an arc (hook → why it matters → a human moment → uplift → a feeling + call to action), every line earning its place, warm and conversational.

Voice & style: warm, sentimental, Australian (Australian English). Cinematic, tender, high-end visuals — soft natural window light, shallow depth of field, real-feeling flowers, petals, hands, weddings, an elderly person's quiet joy; a warm, friendly ILLUSTRATED (cartoon, not photoreal) female presenter who feels like a caring friend; gorgeous b-roll matched to each beat; smooth transitions; bold, clean, readable captions that punch the key words; tasteful gentle music that builds to an emotional lift. Cohesive Florapeutic branding throughout. Never corporate, never herbal-medicine claims; soften any unverified statistic ("most" rather than a hard %). ${goal}

Talking points:
${content}`;
}

// Video Agent: give it a prompt/brief and HeyGen auto-writes, picks visuals,
// generates B-roll (Sora/Veo), motion graphics, captions, music, and assembles
// the whole video. Returns video_id (poll with waitAvatarVideo — same status API).
// Pinned presenter avatar so every video uses the SAME face. Empty string =
// let the Video Agent auto-pick. Set this to your chosen avatar_id.
export const PRESENTER_AVATAR_ID = "";

export async function startVideoAgent(apiKey, prompt, avatarId = PRESENTER_AVATAR_ID) {
  const body = avatarId ? { prompt, avatar_id: avatarId } : { prompt };
  const res = await fetch(`${BASE}/v1/video_agent/generate`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error || data.code >= 400) throw new Error(`video_agent: ${JSON.stringify(data.error || data.message || data)}`);
  const id = data.data?.video_id;
  if (!id) throw new Error("video_agent: no video_id returned");
  return id;
}

// Poll until the HeyGen video is done; returns the (signed) mp4 url.
export async function waitAvatarVideo(apiKey, videoId, onLog = () => {}, maxMinutes = 25) {
  const deadline = Date.now() + maxMinutes * 60 * 1000;
  while (Date.now() < deadline) {
    await wait(5000);
    const res = await fetch(`${BASE}/v1/video_status.get?video_id=${videoId}`, { headers: { "X-Api-Key": apiKey } });
    const data = await res.json();
    const st = data.data?.status;
    onLog(`heygen: ${st}`);
    if (st === "completed") {
      const url = data.data?.video_url;
      if (!url) throw new Error("heygen completed but no url");
      return url;
    }
    if (st === "failed") throw new Error(`heygen failed: ${JSON.stringify(data.data?.error || data.data)}`);
  }
  throw new Error("heygen timed out");
}

export async function downloadHeyGen(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`heygen download ${res.status}`);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
