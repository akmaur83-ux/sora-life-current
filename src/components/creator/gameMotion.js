import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../../lib/motion.js';

// ============================================================
// Creator Game motion helpers (owner, 2026-11-22: "beautiful n attractive
// bnao isko animations ke sath"). Portal chunk only.
//   useInView  — `seen` once a section scrolls in (starts its entrance),
//                `live` while it is on screen (its loops run only then).
//   useCountUp — a number that climbs to its value when its section is seen.
// Reduced motion / no IntersectionObserver: everything is simply shown.
// ============================================================

export const motionOk = () => typeof window !== 'undefined' && !reducedMotion();

export function useInView() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver !== 'function' || !motionOk()) { setSeen(true); setLive(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      setLive(e.isIntersecting);
      if (e.isIntersecting) setSeen(true);
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen, live];
}

/** Class names for a section: entrance once, loops only while visible. */
export const inViewClass = (seen, live) => `${seen ? ' is-in' : ''}${live ? ' is-live' : ''}`;

const ease = (t) => 1 - (1 - t) ** 3;

export function useCountUp(target, run, duration = 1100) {
  const to = Number(target) || 0;
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!run || !motionOk() || to === 0) { setV(to); return undefined; }
    let raf = 0; const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setV(Math.round(to * ease(p)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, run, duration]);
  return v;
}

/** Badge ids earned since this creator last looked (first visit: none). */
const badgeKey = (cid) => `sora.creator.badges.${cid}`;
export function newBadgeIds(creatorId, earnedIds) {
  if (!creatorId || typeof window === 'undefined') return [];
  let raw = null;
  try { raw = window.localStorage.getItem(badgeKey(creatorId)); } catch { return []; }
  if (raw == null) { rememberBadges(creatorId, earnedIds); return []; }
  let seen = [];
  try { seen = JSON.parse(raw) || []; } catch { seen = []; }
  return earnedIds.filter((id) => !seen.includes(id));
}
export function rememberBadges(creatorId, earnedIds) {
  try { window.localStorage.setItem(badgeKey(creatorId), JSON.stringify(earnedIds)); } catch { /* private mode */ }
}
