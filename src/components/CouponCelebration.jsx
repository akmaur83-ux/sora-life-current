import { useEffect, useMemo, useRef } from 'react';
import Icon from './Icon.jsx';
import { money } from '../lib/format.js';

// ============================================================
// COUPON CELEBRATION
//
// The moment a coupon lands: code, what it saved, the new total. Every
// figure is read straight off the server's quote — `saved` is
// breakdown.couponDiscount and `total` is breakdown.grandTotal — and nothing
// in this file adds, subtracts or compares them. The cart-integrity suite
// asserts that.
//
// PERFORMANCE — this runs on a phone with a 4× CPU throttle and must hold
// 60fps WHILE the confetti is falling, so the design is:
//
//   * Confetti is CSS keyframes, not JS. Each particle's start position,
//     drift, spin and delay are custom properties written ONCE at mount; from
//     then on the compositor owns it and the main thread does nothing per
//     frame.
//   * Only transform and opacity animate. No top/left, no filter, no
//     box-shadow, no backdrop-filter on the scrim.
//   * will-change is scoped to the particles and only while they exist —
//     the component unmounts them when it closes.
//   * 36 particles. Enough to read as a burst; few enough that layer memory
//     on a 2× phone is trivial.
//
// prefers-reduced-motion drops the particles entirely and reduces the card
// to a fade. The information is identical; only the motion is gone.
// ============================================================

const PARTICLES = 36;
const AUTO_CLOSE_MS = 3000;

// Brand tokens only. The palette is the storefront's, not a party shop's.
const TONES = ['honey', 'honey-light', 'forest', 'clay', 'cream'];

/**
 * A stable, deterministic scatter. Seeded from the code so two celebrations
 * of different coupons differ, but the same coupon (which cannot be
 * celebrated twice anyway) would look the same in a screenshot.
 */
function scatter(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  return Array.from({ length: PARTICLES }, (_, i) => ({
    id: i,
    tone: TONES[i % TONES.length],
    // Where it starts across the card, and how far it drifts sideways.
    x: Math.round(rnd() * 100),
    dx: Math.round((rnd() - 0.5) * 160),
    // How far it falls and how many turns it makes on the way.
    dy: Math.round(220 + rnd() * 260),
    spin: Math.round((rnd() - 0.5) * 900),
    // Staggered so the burst reads as a shower rather than a curtain.
    delay: Math.round(rnd() * 320),
    duration: Math.round(1400 + rnd() * 700),
    // Two shapes — a slip and a dot — so the shower has some texture.
    shape: rnd() > 0.35 ? 'slip' : 'dot',
    scale: (0.7 + rnd() * 0.6).toFixed(2),
  }));
}

/**
 * @param coupon     the server's public view: { code, title }
 * @param breakdown  the server's breakdown for the cart WITH the coupon
 * @param onClose    () => void
 */
export default function CouponCelebration({ coupon, breakdown, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const reduced = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const particles = useMemo(() => (reduced ? [] : scatter(coupon?.code || '')), [coupon?.code, reduced]);

  // Auto-close, Escape, and scroll lock for the three seconds it is up.
  useEffect(() => {
    const timer = setTimeout(() => closeRef.current?.(), AUTO_CLOSE_MS);
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  if (!coupon || !breakdown) return null;

  // Read, never computed. These are the server's figures for this exact cart.
  const saved = breakdown.couponDiscount;
  const total = breakdown.grandTotal;

  return (
    <div
      className={`celebrate ${reduced ? 'is-reduced' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebrate-h"
      aria-describedby="celebrate-d"
    >
      <div className="celebrate__card" onClick={(e) => e.stopPropagation()}>
        {/* The shower. Absolutely positioned inside the card so it is clipped
            to the card's own bounds — nothing paints across the whole page. */}
        {particles.length > 0 && (
          <div className="celebrate__confetti" aria-hidden="true">
            {particles.map((p) => (
              <i
                key={p.id}
                className={`celebrate__bit is-${p.tone} is-${p.shape}`}
                style={{
                  '--x': `${p.x}%`,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                  '--spin': `${p.spin}deg`,
                  '--delay': `${p.delay}ms`,
                  '--dur': `${p.duration}ms`,
                  '--s': p.scale,
                }}
              />
            ))}
          </div>
        )}

        {/* Two ribbon curls behind the badge. Same rules: transform + opacity. */}
        {!reduced && (
          <div className="celebrate__ribbons" aria-hidden="true">
            <i className="celebrate__ribbon is-left" />
            <i className="celebrate__ribbon is-right" />
          </div>
        )}

        <button
          type="button"
          className="celebrate__close"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="x" size={18} />
        </button>

        <div className="celebrate__badge" aria-hidden="true">
          <Icon name="check" size={26} />
        </div>

        <p className="celebrate__eyebrow">Coupon applied</p>
        <h2 id="celebrate-h" className="celebrate__code">{coupon.code}</h2>
        {coupon.title && <p className="celebrate__title">{coupon.title}</p>}

        <p id="celebrate-d" className="celebrate__saved">
          <span className="celebrate__savedlabel">You save</span>
          <span className="celebrate__savedamt">{money(saved)}</span>
        </p>

        <p className="celebrate__total">
          New total <strong>{money(total)}</strong>
        </p>

        <button type="button" className="celebrate__ok" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}
