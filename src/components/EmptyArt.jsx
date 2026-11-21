// ============================================================
// Empty-state art (round 37, owner 2026-11-21): an empty bag (or a heart) drawn here,
// swinging gently from a hook while a few snowflakes fall behind it — SORA's own drawing,
// no stock art, no words. Transform-only movement; still under reduced motion.
// ============================================================
const FLAKES = [[18, 0, 3], [44, 1.1, 2], [78, .5, 3], [96, 1.6, 2], [30, 2.1, 2], [64, 2.6, 3]];

export default function EmptyArt({ kind = 'bag' }) {
  return (
    <span className="sora-empty" aria-hidden="true">
      <svg viewBox="0 0 120 110" width="120" height="110">
        <g className="sora-empty__snow">
          {FLAKES.map(([x, d, r], i) => <circle key={i} cx={x} cy="-6" r={r} style={{ animationDelay: `${d}s` }} />)}
        </g>
        <path d="M60 4 v10" className="sora-empty__string" />
        <g className="sora-empty__swing">
          {kind === 'heart' ? (
            <path d="M60 98 C 30 78, 22 60, 30 46 C 38 33, 54 35, 60 47 C 66 35, 82 33, 90 46 C 98 60, 90 78, 60 98 Z" className="sora-empty__shape" />
          ) : (
            <>
              <path d="M44 40 C 44 22, 76 22, 76 40" className="sora-empty__handle" />
              <path d="M30 38 H 90 L 96 98 H 24 Z" className="sora-empty__shape" />
              <path d="M30 38 H 90" className="sora-empty__rim" />
            </>
          )}
        </g>
      </svg>
    </span>
  );
}
