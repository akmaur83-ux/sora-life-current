import { useEffect, useState } from 'react';
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
export const FAR_FLAKES = layer(26, [2, 3], [13, 18], [10, 30], 3);
export const FLAKES = layer(22, [4, 7], [9, 13], [20, 50], 5);
export const NEAR_FLAKES = layer(9, [9, 13], [6, 8], [40, 80], 7);
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
  return (
    <svg className="sora-winter__wind" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
      {GUSTS.map(([top, d, delay, curl], k) => {
        const y = (top / 100) * 300;
        return (
          <path key={k} pathLength="100" style={{ '--d': `${d}s`, '--delay': `${delay}s` }}
            d={`M-20 ${y} C 80 ${y - 18 * curl}, 150 ${y + 14 * curl}, 220 ${y} S 330 ${y - 26 * curl}, 300 ${y - 8 * curl} S 360 ${y + 10 * curl}, 420 ${y - 4 * curl}`} />
        );
      })}
    </svg>
  );
}

// The muffler's path round the heading: the back half over the top, the front half under.
const BACK = 'M14 92 A186 36 0 0 1 386 92';
const FRONT = 'M386 92 A186 36 0 0 1 14 92';
function MufflerBand({ d, part }) {
  return (
    <g className={`sora-muffler sora-muffler--${part}`} mask={`url(#sw-wrap-${part})`}>
      <path d={d} className="sora-muffler__base" />
      <path d={d} className="sora-muffler__stripe" />
      <path d={d} className="sora-muffler__knit" />
    </g>
  );
}

/** The heading: knitted lettering inside a muffler that wraps round it and keeps turning. */
function Title() {
  return (
    <h2 className="sora-winter__title" aria-label="Winter deals">
      <svg viewBox="0 0 400 178" aria-hidden="true" overflow="visible">
        <defs>
          {/* A knit: rows of small V stitches over cream — the letters' own texture. */}
          <pattern id="sw-knit" width="7" height="6" patternUnits="userSpaceOnUse">
            <rect width="7" height="6" fill="#FBF3E4" />
            <path d="M0.5 0.5 L3.5 4.5 L6.5 0.5" fill="none" stroke="#E4D2AC" strokeWidth="1.1" strokeLinecap="round" />
          </pattern>
          {['back', 'front'].map((part) => (
            <mask key={part} id={`sw-wrap-${part}`} maskUnits="userSpaceOnUse" x="-20" y="0" width="440" height="200">
              <path d={part === 'back' ? BACK : FRONT} pathLength="100" className={`sora-muffler__reveal sora-muffler__reveal--${part}`} />
            </mask>
          ))}
        </defs>
        <MufflerBand d={BACK} part="back" />
        <g className="sora-winter__letters">
          <text x="200" y="98" textAnchor="middle" textLength="334" lengthAdjust="spacingAndGlyphs" className="sora-winter__puff" fill="url(#sw-knit)">winter deals</text>
          <text x="199" y="96" textAnchor="middle" textLength="334" lengthAdjust="spacingAndGlyphs" className="sora-winter__shine">winter deals</text>
        </g>
        <MufflerBand d={FRONT} part="front" />
        {/* The two ends, hanging from the front and flapping in the wind. */}
        <g className="sora-muffler__ends">
          <g className="sora-muffler__end sora-muffler__end--a">
            <path d="M300 118 l10 44 l18 -3 l-6 -44 z" className="sora-muffler__tail" />
            <path d="M304 134 l18 -3 M307 148 l18 -3" className="sora-muffler__tailstripe" />
            <path d="M310 162 l-1 8 M314 161 l-1 8 M318 161 l0 8 M322 160 l0 8 M326 159 l1 8" className="sora-muffler__fringe" />
          </g>
          <g className="sora-muffler__end sora-muffler__end--b">
            <path d="M318 116 l22 38 l16 -8 l-20 -36 z" className="sora-muffler__tail" />
            <path d="M326 128 l16 -8 M333 141 l16 -8" className="sora-muffler__tailstripe" />
            <path d="M341 154 l2 8 M345 152 l3 7 M349 150 l3 7 M353 148 l3 7" className="sora-muffler__fringe" />
          </g>
        </g>
      </svg>
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

export default function WinterDeals() {
  const deals = useWinterDeals();
  if (!deals) return null;
  const { tiles } = deals;
  const heroes = deals.heroes?.length ? deals.heroes : deals.hero ? [deals.hero] : [];
  return (
    <section className="sora-winter" aria-label="Winter deals">
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
        <div className={`sora-winter__grid${heroes.length ? '' : ' sora-winter__grid--nohero'}`}>
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
