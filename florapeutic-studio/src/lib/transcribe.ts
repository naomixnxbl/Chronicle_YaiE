// Invisible audio -> transcript step.
//
// The browser uploads audio to the local backend, which then transcribes it with
// OpenAI using the secret stored in .env.local. This keeps the OpenAI key off
// the frontend and out of the built bundle.

export async function transcribeAudio(args: {
  audio: Blob;
  filename?: string;
}): Promise<string> {
  const form = new FormData();
  const name = args.filename ?? "audio.webm";
  form.append("audio", args.audio, name);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Transcription failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.transcript) throw new Error("Transcription failed: empty response.");
  return data.transcript;
}
