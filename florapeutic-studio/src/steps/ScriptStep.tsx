import { useEffect, useRef, useState } from "react";
import { enhanceScript } from "../lib/backend";
import { transcribeAudio } from "../lib/transcribe";
import type { ApiKeys, ProjectState } from "../lib/types";

export default function ScriptStep({
  project,
  update,
  keys,
  onNext,
  onBack,
}: {
  project: ProjectState;
  update: (patch: Partial<ProjectState>) => void;
  keys: ApiKeys;
  onNext: () => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preEnhance, setPreEnhance] = useState<string | null>(null); // script before enhancing
  const triedTranscribe = useRef(false);

  const words = project.script.trim() ? project.script.trim().split(/\s+/).length : 0;

  // Invisible step: as soon as we land here with fresh audio, transcribe it
  // and seed the script with what was actually taught.
  useEffect(() => {
    if (triedTranscribe.current) return;
    if (!project.audioBlob || project.transcript) return;
    triedTranscribe.current = true;
    (async () => {
      setTranscribing(true);
      setError(null);
      try {
        const text = await transcribeAudio({
          audio: project.audioBlob!,
          filename: project.audioName ?? "audio.webm",
        });
        update({
          transcript: text,
          script: project.script.trim() ? project.script : text,
        });
      } catch (e) {
        setError(
          `Transcription failed: ${e instanceof Error ? e.message : "unknown error"}. You can still write or paste the script below.`
        );
      } finally {
        setTranscribing(false);
      }
    })();
  }, [project.audioBlob, project.transcript]);

  const revert = () => {
    if (preEnhance === null) return;
    update({ script: preEnhance });
    setPreEnhance(null);
  };

  const enhance = async () => {
    setError(null);
    setBusy(true);
    const original = project.script; // remember so the user can revert
    try {
      // OpenAI-powered enhancement via the backend (no Anthropic key needed).
      const result = await enhanceScript(project.transcript || project.script || project.topic);
      setPreEnhance(original);
      update({ script: result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong enhancing the script.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>Shape the script</h2>
      <p className="lead">
        Your audio becomes the script automatically — same teaching, same style, just
        clearer. Then enhance it into a punchy, on-brand piece with vivid visual cues for
        the creative video.
      </p>

      {error && (
        <div className="banner error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {transcribing && (
        <div className="banner info">
          <span className="spin">✿</span>
          <span>Transcribing your audio in the background… your words will appear below.</span>
        </div>
      )}

      {project.transcript && !transcribing && (
        <div className="banner info">
          <span>🌿</span>
          <span>Transcribed from your audio — edit freely, then enhance.</span>
        </div>
      )}

      {project.audioBlob && !project.transcript && !transcribing && (
        <div className="banner warn">
          <span>🎙️</span>
          <span>Add your OpenAI key to <code>.env.local</code> to enable audio transcription, or just write/paste your script below.</span>
        </div>
      )}

      <div className="script-editor">
        <div className="toolbar">
          <button className="btn btn-bloom" onClick={enhance} disabled={busy || transcribing}>
            {busy ? <><span className="spin">✿</span> Enhancing…</> : <>✨ Enhance with AI</>}
          </button>
          {preEnhance !== null && !busy && (
            <button className="ghost-btn" onClick={revert} title="Undo the enhancement">
              ↩ Revert to original
            </button>
          )}
          <span className="wordcount">{words} words</span>
        </div>
        <textarea
          value={project.script}
          onChange={(e) => update({ script: e.target.value })}
          placeholder={transcribing ? "Listening to your audio…" : PLACEHOLDER}
        />
      </div>

      <div className="actions">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={words < 10}>
          Next — generate the video →
        </button>
      </div>
    </section>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--ink)",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "underline",
  font: "inherit",
};

const PLACEHOLDER = `Your transcript will land here automatically once your audio is processed.

Or write it yourself — start with a hook, then teach in your own words:

The smell of your wedding bouquet fades in 48 hours. The memory doesn't have to.

[B-ROLL: bridal bouquet on a windowsill, soft morning light]
[TEXT: 48 hours]

Most people don't realise pressing flattens a bouquet — freeze-drying keeps every petal's shape...

[B-ROLL: macro of a freeze-dried rose, petals intact]

Follow @florapeutic for more flower stories.`;
