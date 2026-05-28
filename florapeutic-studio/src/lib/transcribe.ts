// Invisible audio -> transcript step.
//
// We send the recorded/uploaded audio to OpenAI's transcription endpoint and
// get back plain text — the teaching content the rest of the pipeline builds
// on. We are NOT cloning or imitating the voice; we only read WHAT was taught
// and the teaching style, then turn that into a script + creative visuals.
//
// OpenAI's API allows direct browser requests, so no proxy is needed here.
// The key lives only in this browser's localStorage.

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const MODEL = "whisper-1"; // universally available; swap to "gpt-4o-transcribe" if enabled on your account

export async function transcribeAudio(args: {
  apiKey: string;
  audio: Blob;
  filename?: string;
}): Promise<string> {
  const form = new FormData();
  const name = args.filename ?? "audio.webm";
  form.append("file", args.audio, name);
  form.append("model", MODEL);
  form.append("response_format", "text");
  // Nudge the model toward our domain vocabulary for better accuracy.
  form.append(
    "prompt",
    "Florapeutic flower preservation: freeze-drying, resin, pressed petals, shadow box, bridal bouquet, donation, eucalyptus, native blooms."
  );

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const err = await res.json();
      detail = err?.error?.message ?? detail;
    } catch {
      /* response wasn't JSON */
    }
    throw new Error(detail);
  }

  // response_format=text returns the transcript as a plain string.
  const text = (await res.text()).trim();
  if (!text) throw new Error("Transcription came back empty — is there audible speech in the file?");
  return text;
}
