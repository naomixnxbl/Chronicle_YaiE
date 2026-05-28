import { useEffect, useRef, useState } from "react";
import Decor from "./components/Decor";
import Stepper from "./components/Stepper";
import SetupStep from "./steps/SetupStep";
import AudioStep from "./steps/AudioStep";
import ScriptStep from "./steps/ScriptStep";
import VideoStep from "./steps/VideoStep";
import { emptyProject, type ProjectState } from "./lib/types";
import { loadKeys, loadProject, saveProject, clearProject } from "./lib/storage";

export default function App() {
  const [project, setProject] = useState<ProjectState>(() => ({
    ...emptyProject,
    ...(loadProject() ?? {}),
    audioUrl: null, // object URLs don't survive reloads
  }));
  const keys = loadKeys(); // from .env.local (no Settings page)
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  // Persist project to sessionStorage so a refresh keeps work (cleared on close).
  useEffect(() => {
    saveProject(project);
  }, [project]);

  const update = (patch: Partial<ProjectState>) =>
    setProject((p) => ({ ...p, ...patch }));

  const goto = (n: number) => {
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const next = () => goto(step + 1);
  const back = () => goto(Math.max(0, step - 1));

  const restart = () => {
    if (project.audioUrl) URL.revokeObjectURL(project.audioUrl);
    clearProject();
    setProject({ ...emptyProject });
    setMaxReached(0);
    goto(0);
  };

  return (
    <>
      <Decor />
      <div className="app" ref={topRef}>
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">🌸</div>
            <div>
              <div className="brand-name">
                Flora<span>peutic</span>
              </div>
              <div className="brand-tag">Content Studio</div>
            </div>
          </div>
        </header>

        <div className="hero">
          <h1>
            Turn your voice into <em>flower stories</em>
          </h1>
          <p>
            Record or upload your audio, shape an on-brand script, and generate a
            beautiful, ready-to-post video — warm, Australian, and never clinical.
          </p>
        </div>

        <Stepper current={step} maxReached={maxReached} onJump={goto} />

        {step === 0 && <SetupStep project={project} update={update} onNext={next} />}
        {step === 1 && (
          <AudioStep project={project} update={update} onNext={next} onBack={back} />
        )}
        {step === 2 && (
          <ScriptStep project={project} update={update} keys={keys} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <VideoStep project={project} update={update} onBack={back} onRestart={restart} />
        )}

        <p className="footer-note">
          Made for Florapeutic · North Parramatta, Sydney ·{" "}
          <a href="https://florapeutic.com.au/quote/" target="_blank" rel="noreferrer">
            florapeutic.com.au
          </a>
        </p>
      </div>
    </>
  );
}
