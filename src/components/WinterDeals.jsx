import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWinterDeals, HERO_EVERY_MS } from '../lib/winterDeals.js';

// ============================================================
// The winter band (owner, 2026-11-20). Night-blue; snow in three layers swaying in the
// wind, gusts sweeping across; the heading in round, knitted lettering with a striped
// muffler that wraps itself round it and keeps turning, its ends flapping; the hero tile
// turning through the deals every 1.5 s. Nothing moves for a shopper whose device asks
// for less motion (sora-ds.css). Every number comes from lib/winterDeals.js.
// ============================================================
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Hanging ornaments (left %, string length px, swing seconds, delay s), twinkling stars
// (left %, top %, size px, delay s) and the pom-poms along the hem — round 25, 2026-11-20.
export const ORNAMENTS = Object.freeze([[6, 34, 3.4, 0], [17, 18, 2.9, .6], [83, 22, 3.1, .3], [94, 38, 3.6, .9]]);
export const TWINKLES = Object.freeze([[12, 30, 10, 0], [30, 14, 7, 1.1], [70, 12, 8, .5], [88, 46, 9, 1.6], [50, 6, 6, 2.2], [4, 62, 7, .8]]);
export const POMPOMS = 24;

// Snow in three layers (round 27): far (tiny, slow), mid, near (big, soft, fast). Spread by a
// fixed rule, not Math.random, so the band is the same on every render:
// [left %, size px, fall seconds, delay s, wind drift px].
const layer = (n, size, secs, drift, seed) => Object.freeze(Array.from({ length: n }, (_, k) => [
  (k * 37 + seed * 11) % 100,
  size[0] + ((k * 7 + seed) % (size[1] - size[0] + 1)),
  secs[0] + ((k * 5 + seed) % (secs[1] - secs[0] + 1)),
  (k * 1.7 + seed) % secs[1],
  (k % 2 ? -1 : 1) * (drift[0] + ((k * 13) % (drift[1] - drift[0] + 1))),
]));
// Counts kept low for phones (2026-11-21, speed): enough to read as snowfall, no more.
export const FAR_FLAKES = layer(12, [2, 3], [13, 18], [10, 30], 3);
export const FLAKES = layer(13, [4, 7], [9, 13], [20, 50], 5);
export const NEAR_FLAKES = layer(5, [9, 13], [6, 8], [40, 80], 7);
// Gusts of wind: [top %, seconds, delay s, curl].
export const GUSTS = Object.freeze([[18, 4.5, 0, 1], [46, 5.5, 1.8, -1], [70, 5, 3.2, 1], [32, 6, 4.4, -1]]);

function Flake() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="sora-winter__star">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2 2.5M12 2l2 2.5M12 22l-2-2.5M12 22l2-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Snow({ flakes, className }) {
  return (
    <div className={`sora-winter__snow ${className}`} aria-hidden="true">
      {flakes.map(([x, s, d, delay, drift], k) => (
        <i key={k} style={{ '--x': `${x}%`, '--s': `${s}px`, '--d': `${d}s`, '--delay': `-${delay}s`, '--drift': `${drift}px` }} />
      ))}
    </div>
  );
}

function Wind() {
  // Gusts as small streaks sliding across (transform + opacity only: no repainting).
  return (
    <div className="sora-winter__wind" aria-hidden="true">
      {GUSTS.map(([top, d, delay, curl], k) => (
        <span key={k} style={{ '--top': `${top}%`, '--d': `${d}s`, '--delay': `${delay}s` }}>
          <svg viewBox="0 0 120 20" width="120" height="20"><path d={curl > 0 ? 'M2 12 C 30 2, 55 18, 80 9 S 112 4, 118 10' : 'M2 8 C 30 18, 55 2, 80 11 S 112 16, 118 10'} /></svg>
        </span>
      ))}
    </div>
  );
}

// The muffler (round 28, owner 2026-11-21: "muffler smoothly text ke andr bahr se slide kre"):
// a knitted band in a wave that threads through the letters — over one, under the next —
// slides in from the left, rests and ripples, then slides out to the right and comes again.
// Over/under is two copies of the band: one under the letters, one over them shown only in
// alternate columns, so as the band moves it goes in and out of the words.
const WAVE = 'M-6 104 Q 19 90 44 104 T 94 104 T 144 104 T 194 104 T 244 104 T 294 104 T 344 104 T 394 104 T 420 100';

/** One copy of the knitted band (static drawing; it moves as a whole layer — cheap to animate). */
function Band({ ends }) {
  return (
    <svg viewBox="0 26 400 106" aria-hidden="true" overflow="visible">
      <path d={WAVE} className="sora-muffler__base" />
      <path d={WAVE} className="sora-muffler__stripe" />
      <path d={WAVE} className="sora-muffler__knit" />
      {ends && (
        <>
          <path d="M-6 97 l-10 -3 M-6 101 l-11 -1 M-6 105 l-11 1 M-6 109 l-10 3" className="sora-muffler__fringe" />
          <path d="M420 93 l10 -4 M420 97 l11 -2 M420 101 l11 0 M420 105 l11 2" className="sora-muffler__fringe" />
        </>
      )}
    </svg>
  );
}

/**
 * The heading: big round lettering with a dark rim, a muffler threading through it.
 * Speed (2026-11-21, measured 11 fps on the homepage): three stacked layers instead of one
 * animated SVG — the band under the words, the words (never repainted), and the band over
 * them seen through fixed columns. Only whole layers slide, which the GPU does for free.
 */
function Title() {
  return (
    <h2 className="sora-winter__title" aria-label="Winter deals">
      <span className="sora-muffler sora-muffler--under" aria-hidden="true"><span className="sora-muffler__slide"><Band ends /></span></span>
      <svg className="sora-winter__words" viewBox="0 26 400 106" aria-hidden="true" overflow="visible">
        <defs>
          {/* A faint knit on the letters: light enough that the words read first. */}
          <pattern id="sw-knit" width="8" height="7" patternUnits="userSpaceOnUse">
            <rect width="8" height="7" fill="#FFF7E6" />
            <path d="M1 1 L4 5 L7 1" fill="none" stroke="#F1E4C6" strokeWidth=".9" strokeLinecap="round" />
          </pattern>
        </defs>
        <text x="200" y="104" textAnchor="middle" textLength="352" lengthAdjust="spacingAndGlyphs" className="sora-winter__halo">winter deals</text>
        <text x="200" y="104" textAnchor="middle" textLength="352" lengthAdjust="spacingAndGlyphs" className="sora-winter__puff" fill="url(#sw-knit)">winter deals</text>
      </svg>
      <span className="sora-muffler sora-muffler--over" aria-hidden="true"><span className="sora-muffler__slide"><Band /></span></span>
    </h2>
  );
}

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** The hero tile, turning through the deals (owner: "har 1.5 second mein product change"). */
function HeroDeal({ heroes }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = heroes.length;
  useEffect(() => {
    if (n < 2 || paused || reducedMotion()) return undefined;
    const t = window.setInterval(() => { if (!document.hidden) setI((v) => (v + 1) % n); }, HERO_EVERY_MS);
    return () => window.clearInterval(t);
  }, [n, paused]);
  // The next picture is fetched ahead, so the change never shows an empty frame.
  useEffect(() => { if (n > 1) { const img = new Image(); img.src = heroes[(i + 1) % n].image; } }, [i, n, heroes]);
  const h = heroes[i % n];
  return (
    <Link to={h.href} className="sora-winter__hero" style={{ '--n': 0 }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span className="sora-winter__eyebrow">Winter deal</span>
      <span key={i} className="sora-winter__heroin">
        <s className="sora-winter__mrp" aria-label={`MRP ${rupees(h.mrp)}`}>{rupees(h.mrp)}</s>
        <strong className="sora-winter__price">{rupees(h.price)}</strong>
        <span className="sora-winter__name">{h.name.split(' - ')[0]}</span>
        <span className="sora-winter__heroimg">
          <img src={h.image} alt="" width="160" height="160" decoding="async" />
          <span className="sora-winter__save">{h.off}% off</span>
        </span>
      </span>
      {n > 1 && (
        <span className="sora-winter__dots" aria-hidden="true">
          {heroes.map((x, k) => <i key={x.href} className={k === i % n ? 'is-on' : ''} />)}
        </span>
      )}
    </Link>
  );
}

/**
 * The band sleeps off screen (2026-11-21, speed): its animations pause once it has scrolled
 * out of view and wake when it comes back, so the rest of the page scrolls at full speed.
 */
function useAwake() {
  const ref = useRef(null);
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver(([e]) => setAwake(e.isIntersecting), { rootMargin: '80px 0px' });
    io.observe(el);
    return () => io.disconnect();
  });
  return [ref, awake];
}

export default function WinterDeals() {
  const deals = useWinterDeals();
  const [ref, awake] = useAwake();
  // While the deals load (undefined) the band is drawn at once — heading, snow, tiles as
  // placeholders — so the page's largest paint does not wait on the catalogue (2026-11-21:
  // it waited 8.6 s on a slow phone). Out of season or nothing to show (null): no band.
  if (deals === null) return null;
  const loading = deals === undefined;
  const tiles = loading ? [] : deals.tiles;
  const heroes = loading ? [] : deals.heroes?.length ? deals.heroes : deals.hero ? [deals.hero] : [];
  return (
    <section ref={ref} className={`sora-winter${awake ? '' : ' is-asleep'}`} aria-label="Winter deals">
      <Snow flakes={FAR_FLAKES} className="sora-winter__snow--far" />
      <Snow flakes={FLAKES} className="" />
      <Wind />
      <div className="sora-winter__deco" aria-hidden="true">
        {ORNAMENTS.map(([x, len, d, delay], k) => (
          <span key={k} className="sora-winter__orn" style={{ '--x': `${x}%`, '--len': `${len}px`, '--d': `${d}s`, '--delay': `-${delay}s` }}><Flake /></span>
        ))}
        {TWINKLES.map(([x, y, s, delay], k) => (
          <span key={k} className="sora-winter__twinkle" style={{ '--x': `${x}%`, '--y': `${y}%`, '--s': `${s}px`, '--delay': `${delay}s` }} />
        ))}
      </div>
      <div className="sora-winter__in">
        <div className="sora-winter__head">
          <Title />
        </div>
        <p className="sora-winter__sub">Jackets, shawls and mufflers in stock, with the discount shown on every piece</p>
        <div className={`sora-winter__grid${heroes.length || loading ? '' : ' sora-winter__grid--nohero'}`} aria-busy={loading || undefined}>
          {loading && [0, 1, 2, 3, 4].map((k) => <span key={k} className={`sora-winter__ghost${k === 0 ? ' sora-winter__ghost--hero' : ''}`} aria-hidden="true" />)}
          {heroes.length > 0 && <HeroDeal heroes={heroes} />}
          {tiles.map((t, n) => (
            <Link key={t.id} to={t.href} className="sora-winter__tile" style={{ '--n': n + 1 }}>
              <span className="sora-winter__badge"><span>Up to</span><b>{t.upTo}%<small>OFF</small></b></span>
              <span className="sora-winter__tname">{t.title}</span>
              <span className="sora-winter__pile">
                {t.images.map((src, k) => <img key={k} src={src} alt="" width="72" height="72" loading="lazy" decoding="async" style={{ '--k': k }} />)}
              </span>
            </Link>
          ))}
        </div>
        <Link to="/fashion/winter" className="sora-winter__all">
          <span><b>The winter edit</b> — every jacket, shawl and muffler in one place</span>
          <span aria-hidden="true">›</span>
        </Link>
      </div>
      <Snow flakes={NEAR_FLAKES} className="sora-winter__snow--near" />
      <div className="sora-winter__hem" aria-hidden="true">
        {Array.from({ length: POMPOMS }, (_, k) => <i key={k} style={{ '--k': k }} />)}
      </div>
    </section>
  );
}
