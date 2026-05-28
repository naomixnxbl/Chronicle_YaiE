// Ambient floating butterflies. Pure decoration, behind everything, and
// disabled automatically for users who prefer reduced motion (see styles.css).

function Butterfly({ cls, emoji }: { cls: string; emoji: string }) {
  return (
    <div className={`butterfly ${cls}`} aria-hidden="true">
      <span className="wing">{emoji}</span>
    </div>
  );
}

export default function Decor() {
  return (
    <div className="decor" aria-hidden="true">
      <Butterfly cls="b1" emoji="🦋" />
      <Butterfly cls="b2" emoji="🦋" />
      <Butterfly cls="b3" emoji="🦋" />
    </div>
  );
}
