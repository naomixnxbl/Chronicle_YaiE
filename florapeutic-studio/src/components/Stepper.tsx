interface StepDef {
  id: number;
  label: string;
  ico: string;
}

const STEPS: StepDef[] = [
  { id: 0, label: "Setup", ico: "🌱" },
  { id: 1, label: "Audio", ico: "🎙️" },
  { id: 2, label: "Script", ico: "✍️" },
  { id: 3, label: "Video", ico: "🎬" },
];

export default function Stepper({
  current,
  maxReached,
  onJump,
}: {
  current: number;
  maxReached: number;
  onJump: (id: number) => void;
}) {
  return (
    <nav className="stepper" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        const reachable = s.id <= maxReached;
        return (
          <div key={s.id} style={{ display: "contents" }}>
            <button
              className={`step-pill ${active ? "active" : ""} ${done ? "done" : ""}`}
              onClick={() => reachable && onJump(s.id)}
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
            >
              <span className="step-dot">{done ? "✓" : i + 1}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="step-sep">·</span>}
          </div>
        );
      })}
    </nav>
  );
}
