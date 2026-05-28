import { AUDIENCES, PLATFORMS, THEMES } from "../lib/brandVoice";
import type { Platform, ProjectState } from "../lib/types";

export default function SetupStep({
  project,
  update,
  onNext,
}: {
  project: ProjectState;
  update: (patch: Partial<ProjectState>) => void;
  onNext: () => void;
}) {
  const togglePlatform = (p: Platform) => {
    const has = project.platforms.includes(p);
    const next = has
      ? project.platforms.filter((x) => x !== p)
      : [...project.platforms, p];
    update({ platforms: next.length ? next : project.platforms });
  };

  const canContinue = project.topic.trim().length > 2 && project.platforms.length > 0;

  return (
    <section className="card">
      <h2>What are we teaching today?</h2>
      <p className="lead">
        Every Florapeutic video starts with a moment worth remembering. Tell me the
        gist — I'll keep your voice warm, Australian, and never clinical.
      </p>

      <div className="field">
        <label htmlFor="topic">
          Topic <span className="hint">— what does this video teach?</span>
        </label>
        <input
          id="topic"
          type="text"
          placeholder="e.g. Why we freeze-dry bridal bouquets instead of pressing them"
          value={project.topic}
          onChange={(e) => update({ topic: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Content theme</label>
        <div className="pill-group">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`pill ${project.theme === t.id ? "selected" : ""}`}
              onClick={() => update({ theme: t.id })}
              title={t.blurb}
            >
              <span className="pill-ico">{t.ico}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Audience angle</label>
        <div className="pill-group">
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              className={`pill ${project.audience === a.id ? "selected" : ""}`}
              onClick={() => update({ audience: a.id })}
              title={a.blurb}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          {AUDIENCES.find((a) => a.id === project.audience)?.blurb}
        </p>
      </div>

      <div className="field">
        <label>Where will it go? <span className="hint">— pick any</span></label>
        <div className="pill-group">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              className={`pill ${project.platforms.includes(p.id) ? "selected" : ""}`}
              onClick={() => togglePlatform(p.id)}
              title={p.spec}
            >
              <span className="pill-ico">{p.ico}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="points">
          Key talking points <span className="hint">— optional facts, client stories, details</span>
        </label>
        <textarea
          id="points"
          rows={3}
          placeholder="e.g. Mention the 400+ stems from an average Sydney wedding; we donate offcuts to aged-care homes"
          value={project.talkingPoints}
          onChange={(e) => update({ talkingPoints: e.target.value })}
        />
      </div>

      <div className="actions">
        <span />
        <button className="btn btn-primary" onClick={onNext} disabled={!canContinue}>
          Next — add your audio →
        </button>
      </div>
    </section>
  );
}
