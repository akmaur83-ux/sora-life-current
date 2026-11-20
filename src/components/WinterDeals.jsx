import { Link } from 'react-router-dom';
import { useWinterDeals } from '../lib/winterDeals.js';

// ============================================================
// The winter band (owner, 2026-11-20). Night-blue, falling snow, the heading's letters
// bobbing, tiles rising in one after another — and nothing moves for a shopper whose
// device asks for less motion (sora-ds.css). Numbers come from lib/winterDeals.js.
// ============================================================
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Hanging ornaments (left %, string length px, swing seconds, delay s), twinkling stars
// (left %, top %, size px, delay s) and the pom-poms along the hem — round 25, 2026-11-20.
export const ORNAMENTS = Object.freeze([[6, 34, 3.4, 0], [17, 18, 2.9, .6], [83, 22, 3.1, .3], [94, 38, 3.6, .9]]);
export const TWINKLES = Object.freeze([[12, 30, 10, 0], [30, 14, 7, 1.1], [70, 12, 8, .5], [88, 46, 9, 1.6], [50, 6, 6, 2.2], [4, 62, 7, .8]]);
export const POMPOMS = 24;
// The nearer layer of snow: bigger, softer, faster.
export const NEAR_FLAKES = Object.freeze([[9, 11, 7, 2, 30], [29, 9, 8, 5, -26], [52, 12, 6.5, 0, 24], [73, 10, 7.5, 4, -30], [90, 9, 8.5, 1, 20], [41, 8, 7, 6, -18]]);

// Fixed flakes (no Math.random: the same band every render): left %, size px, seconds, delay s, drift px.
export const FLAKES = Object.freeze([
  [4, 6, 9, 0, 18], [11, 4, 12, 3, -12], [18, 8, 10, 6, 22], [26, 5, 13, 1, -16], [33, 3, 8, 4, 10],
  [40, 7, 11, 7, -20], [47, 4, 14, 2, 14], [54, 6, 9, 5, -10], [61, 3, 12, 8, 16], [68, 8, 10, 1, -22],
  [74, 5, 13, 6, 12], [80, 4, 9, 3, -14], [86, 7, 11, 0, 20], [92, 3, 12, 5, -8], [97, 5, 10, 2, 12],
  [8, 3, 15, 9, 8], [36, 4, 16, 10, -6], [58, 5, 15, 11, 10], [77, 3, 16, 12, -10], [22, 6, 14, 13, 14],
]);

function Flake() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="sora-winter__star">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2 2.5M12 2l2 2.5M12 22l-2-2.5M12 22l2-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Title() {
  const words = ['winter', 'deals'];
  let i = 0;
  return (
    <h2 className="sora-winter__title" aria-label="Winter deals">
      {words.map((w) => (
        <span key={w} className="sora-winter__word" aria-hidden="true">
          {[...w].map((ch) => { i += 1; return <span key={i} style={{ '--i': i }}>{ch}</span>; })}
        </span>
      ))}
    </h2>
  );
}

export default function WinterDeals() {
  const deals = useWinterDeals();
  if (!deals) return null;
  const { hero, tiles } = deals;
  return (
    <section className="sora-winter" aria-label="Winter deals">
      <div className="sora-winter__snow" aria-hidden="true">
        {FLAKES.map(([x, s, d, delay, drift], k) => (
          <i key={k} style={{ '--x': `${x}%`, '--s': `${s}px`, '--d': `${d}s`, '--delay': `-${delay}s`, '--drift': `${drift}px` }} />
        ))}
      </div>
      <div className="sora-winter__snow sora-winter__snow--near" aria-hidden="true">
        {NEAR_FLAKES.map(([x, s, d, delay, drift], k) => (
          <i key={k} style={{ '--x': `${x}%`, '--s': `${s}px`, '--d': `${d}s`, '--delay': `-${delay}s`, '--drift': `${drift}px` }} />
        ))}
      </div>
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
          <Flake />
          <Title />
          <Flake />
        </div>
        <p className="sora-winter__sub">Jackets, shawls and mufflers in stock, with the discount shown on every piece</p>
        <div className={`sora-winter__grid${hero ? '' : ' sora-winter__grid--nohero'}`}>
          {hero && (
            <Link to={hero.href} className="sora-winter__hero" style={{ '--n': 0 }}>
              <span className="sora-winter__eyebrow">Winter deal</span>
              <s className="sora-winter__mrp" aria-label={`MRP ${rupees(hero.mrp)}`}>{rupees(hero.mrp)}</s>
              <strong className="sora-winter__price">{rupees(hero.price)}</strong>
              <span className="sora-winter__name">{hero.name.split(' - ')[0]}</span>
              <img src={hero.image} alt="" width="160" height="160" decoding="async" />
              <span className="sora-winter__save">{hero.off}% off</span>
            </Link>
          )}
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
      <div className="sora-winter__hem" aria-hidden="true">
        {Array.from({ length: POMPOMS }, (_, k) => <i key={k} style={{ '--k': k }} />)}
      </div>
    </section>
  );
}
