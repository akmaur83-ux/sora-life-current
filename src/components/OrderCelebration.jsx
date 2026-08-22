import { useEffect, useMemo, useState } from 'react';

// ============================================================
// Order-confirmed celebration — the success icon plus a short,
// self-cleaning particle burst.
//
// Deliberately NOT generic confetti: a small, curated set of soft
// botanical/gold particles in the existing SORA LIFE palette, a warm
// radial glow, an expanding ring and a checkmark that draws itself.
//
// Everything is CSS transform/opacity (no rAF loop, no library). The
// particle DOM is unmounted once the burst finishes so nothing lingers.
// ============================================================

// Curated, fixed particle set — stable across renders (no per-render
// randomness, which would reshuffle the burst on any state change).
// angle in degrees, dist in px, size in px, delay in ms.
const PARTICLES = [
  { angle: -90, dist: 78, size: 7, delay: 0, kind: 'dot', tone: 'gold' },
  { angle: -50, dist: 66, size: 5, delay: 60, kind: 'spark', tone: 'gold-soft' },
  { angle: -18, dist: 84, size: 8, delay: 20, kind: 'leaf', tone: 'green' },
  { angle: 16, dist: 62, size: 5, delay: 90, kind: 'dot', tone: 'cream' },
  { angle: 48, dist: 80, size: 7, delay: 40, kind: 'leaf', tone: 'gold' },
  { angle: 88, dist: 70, size: 6, delay: 110, kind: 'dot', tone: 'green-soft' },
  { angle: 126, dist: 76, size: 5, delay: 30, kind: 'spark', tone: 'gold' },
  { angle: 160, dist: 64, size: 7, delay: 100, kind: 'dot', tone: 'cream' },
  { angle: -140, dist: 82, size: 6, delay: 50, kind: 'leaf', tone: 'green' },
  { angle: -112, dist: 60, size: 5, delay: 130, kind: 'dot', tone: 'gold-soft' },
  { angle: 4, dist: 96, size: 4, delay: 150, kind: 'spark', tone: 'gold' },
  { angle: 178, dist: 90, size: 4, delay: 70, kind: 'dot', tone: 'green-soft' },
];

// A few extremely subtle particles that drift upward after the burst,
// then stop — the celebration always finishes, never loops.
const DRIFT = [
  { x: -54, size: 5, delay: 520, kind: 'leaf', tone: 'green-soft' },
  { x: 40, size: 4, delay: 700, kind: 'dot', tone: 'gold-soft' },
  { x: -14, size: 4, delay: 900, kind: 'spark', tone: 'gold' },
  { x: 62, size: 5, delay: 1080, kind: 'leaf', tone: 'green' },
];

const BURST_LIFETIME = 2000; // ms — after this the particle DOM is removed

export default function OrderCelebration() {
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;

  // Reduced motion: no particles at all — just the static success state.
  // Mobile: fewer particles, shorter travel (scaled below).
  const [showParticles, setShowParticles] = useState(!reduced);

  const { burst, drift, scale } = useMemo(() => ({
    burst: reduced ? [] : (isNarrow ? PARTICLES.filter((_, i) => i % 2 === 0) : PARTICLES),
    drift: reduced ? [] : (isNarrow ? DRIFT.slice(0, 2) : DRIFT),
    scale: isNarrow ? 0.62 : 1, // shorter travel distance on small screens
  }), [reduced, isNarrow]);

  useEffect(() => {
    if (!showParticles) return;
    const t = setTimeout(() => setShowParticles(false), BURST_LIFETIME);
    return () => clearTimeout(t);
  }, [showParticles]);

  return (
    <div className="confirm__celebrate">
      {/* Warm radial glow — expands gently and fades back out */}
      {!reduced && <span className="confirm__glow" aria-hidden="true" />}

      {/* Expanding ring around the icon */}
      <span className="confirm__ring" aria-hidden="true" />

      {/* Success icon with a checkmark that draws itself */}
      <div className="confirm__tick">
        <svg viewBox="0 0 52 52" width="44" height="44" aria-hidden="true">
          <path
            className="confirm__check-path"
            d="M14 27.5 L22.5 36 L38 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showParticles && (
        <div className="confirm__particles" aria-hidden="true">
          {burst.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist * scale;
            const ty = Math.sin(rad) * p.dist * scale;
            return (
              <span
                key={`b${i}`}
                className={`confirm__p confirm__p--${p.kind} tone-${p.tone}`}
                style={{
                  '--tx': `${tx.toFixed(1)}px`,
                  '--ty': `${ty.toFixed(1)}px`,
                  '--sz': `${p.size}px`,
                  animationDelay: `${300 + p.delay}ms`,
                }}
              />
            );
          })}
          {drift.map((p, i) => (
            <span
              key={`d${i}`}
              className={`confirm__p confirm__p--${p.kind} confirm__p--drift tone-${p.tone}`}
              style={{
                '--tx': `${(p.x * scale).toFixed(1)}px`,
                '--sz': `${p.size}px`,
                animationDelay: `${p.delay}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
