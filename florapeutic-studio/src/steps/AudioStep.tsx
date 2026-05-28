import { useEffect, useRef, useState } from "react";
import type { ProjectState } from "../lib/types";

export default function AudioStep({
  project,
  update,
  onNext,
  onBack,
}: {
  project: ProjectState;
  update: (patch: Partial<ProjectState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
      }
    };
  }, []);

  const setAudio = (blob: Blob, name: string) => {
    if (project.audioUrl) URL.revokeObjectURL(project.audioUrl);
    const url = URL.createObjectURL(blob);
    // Keep the raw blob for transcription; clear anything derived from a
    // previous recording so the new audio is freshly transcribed.
    update({ audioUrl: url, audioName: name, audioBlob: blob, transcript: "", script: "", videoUrl: null });
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudio(blob, `voice-recording-${Date.now()}.webm`);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Couldn't access your microphone. Check your browser's mic permission and try again.");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("That doesn't look like an audio file. Please choose an MP3, WAV, M4A or similar.");
      return;
    }
    setError(null);
    setAudio(file, file.name);
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <section className="card">
      <h2>Bring your teaching</h2>
      <p className="lead">
        Teach the topic out loud — record it here or upload a file. We'll quietly turn it
        into a transcript and use your words and teaching style as the script. We never
        clone or imitate your voice; the audio is just the source of <em>what</em> you teach.
      </p>

      {error && (
        <div className="banner error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="audio-modes">
        <div className={`audio-tile ${recording ? "live" : ""}`}>
          <div className="tile-ico">🎙️</div>
          <h3>Record now</h3>
          <p>Press the bloom and start teaching. Stop whenever you're done.</p>
          <button
            className={`rec-btn ${recording ? "recording" : ""}`}
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? "⏹" : "●"}
          </button>
          {recording && <div className="rec-timer">{mm}:{ss}</div>}
        </div>

        <div className="audio-tile">
          <div className="tile-ico">📁</div>
          <h3>Upload a file</h3>
          <p>Already have a recording? Drop in an MP3, WAV, M4A or WebM.</p>
          <label className="file-drop">
            <input type="file" accept="audio/*" onChange={onFile} />
            <span className="ghost-btn" style={{ pointerEvents: "none" }}>
              ⬆️ Choose audio file
            </span>
          </label>
        </div>
      </div>

      {project.audioUrl && (
        <div className="audio-ready">
          <span style={{ fontSize: 22 }}>🌿</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 14 }}>{project.audioName}</strong>
            <audio src={project.audioUrl} controls />
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>
        Next, your audio is transcribed automatically in the background (using your OpenAI
        key). No audio? You can still continue and write the script by hand.
      </p>

      <div className="actions">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={onNext}>
          Next — write the script →
        </button>
      </div>
    </section>
  );
}
