// OpenAI helpers: transcription (Whisper) and on-brand script enhancement.
import fs from "node:fs";

const BASE = "https://api.openai.com/v1";

// Audio → text. HeyGen can't read audio, so this is the only audio→text step.
export async function transcribe(apiKey, audioPath, filename) {
  const form = new FormData();
  const buf = fs.readFileSync(audioPath);
  // OpenAI detects format from the filename extension — pass a real one.
  const name = filename && /\.[a-z0-9]+$/i.test(filename) ? filename : "audio.wav";
  form.append("file", new Blob([buf]), name);
  form.append("model", "whisper-1");
  form.append("response_format", "text");
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcribe ${res.status}: ${await res.text()}`);
  return (await res.text()).trim();
}

// Rewrite rough notes/script into a polished, on-brand Florapeutic script.
export async function enhanceScriptOpenAI(apiKey, draft) {
  const sys = `You are the scriptwriter for Florapeutic, a Sydney flower PRESERVATION & DONATION business (flora + therapeutic) — event flowers become preserved keepsakes; blooms are donated to lonely elderly Australians. Voice: warm, sentimental, Australian (AU spelling), human — like a caring friend. Flowers are MEMORIES, not products. Never herbal-medicine words. No pushy sales. Never claim preservation lasts "forever". Soften unverified stats ("most", not a hard %).
Rewrite the user's notes/script into a polished, emotionally engaging spoken script: open on a strong hook, keep an arc, every line earning its place, speakable and warm. Return ONLY the script text — no preamble, no headings.`;
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.8,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: draft || "Write a short Florapeutic educational script about why we repurpose event flowers." },
      ],
    }),
  });
  if (!res.ok) throw new Error(`enhance ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content.trim();
}
