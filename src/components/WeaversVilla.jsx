import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import {
  WEAVERS_SECTION, WEAVERS_SHOWCASE, WEAVERS_FILMS, WEAVERS_LISTING, useWeaversRange,
} from '../lib/weaversVilla.js';

// ============================================================
// Weavers Villa on the wellness homepage (owner, 2026-11-08) — weaversVilla.js
// has what is shown and why. Two sections, straight under the Biosash range:
//
//   WeaversVillaRange     the sliding row of their shawls (SlidingRail, the
//                         New Arrivals row type), cards cropped toward the top
//                         so a model's face stays in frame;
//   WeaversVillaShowcase  a dark poster band — the partner's name, a line, one
//                         button — over a row of their short films. Each film is
//                         muted, plays only while on screen, never under
//                         prefers-reduced-motion (the poster frame stays), and
//                         loads nothing until it is near the viewport.
//
// Both editable in Storefronts → Wellness (hide, wording, links); hidden, or no
// shawls to show, renders nothing.
// ============================================================
export { WEAVERS_SECTION, WEAVERS_SHOWCASE };

/** `items` is for a test; the page passes nothing and the live catalogue is read. */
export function WeaversVillaRange({ items: given, autoplayMs } = {}) {
  const section = useStorefrontSection('wellness', 'weaversVilla', WEAVERS_SECTION);
  const loaded = useWeaversRange();
  const items = (given ?? loaded) || [];
  return (
    <div className="hx-wv-range">
      <SlidingRail id="weavers" label="Weavers Villa shawls" section={section} defaults={WEAVERS_SECTION}
        link={section.link || WEAVERS_LISTING} items={items} {...(autoplayMs ? { autoplayMs } : {})} />
    </div>
  );
}

/** One film tile: plays while on screen, nothing loaded before it is near. */
function Film({ film }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof window === 'undefined' || typeof IntersectionObserver !== 'function') return undefined;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !still?.matches) {
        if (v.preload !== 'auto') v.preload = 'auto';
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else if (!v.paused) v.pause();
    }, { rootMargin: '120px 0px', threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <li className="hx-wv__film">
      <Link to={film.href} className="hx-wv__tile">
        <span className="hx-wv__media">
          <video ref={ref} className="hx-wv__video" src={film.video} poster={film.poster}
            muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} width={720} height={960} />
        </span>
        <span className="hx-wv__label">{film.label} <Icon name="arrowRight" size={14} /></span>
      </Link>
    </li>
  );
}

export function WeaversVillaShowcase({ films = WEAVERS_FILMS } = {}) {
  const s = useStorefrontSection('wellness', 'weaversShowcase', WEAVERS_SHOWCASE);
  if (s.hidden || !films.length) return null;
  return (
    <section className="hx hx-wv" aria-labelledby="hx-wv-h">
      <div className="hx-wrap">
        <div className="hx-wv__head">
          <div className="hx-wv__copy">
            {s.eyebrow && <p className="hx-wv__eyebrow">{s.eyebrow}</p>}
            <h2 className="hx-wv__h" id="hx-wv-h">{s.title}</h2>
            {s.text && <p className="hx-wv__text">{s.text}</p>}
          </div>
          {s.cta && <Link to={s.link || WEAVERS_LISTING} className="hx-wv__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
        </div>
        <ul className="hx-wv__films" aria-label="Weavers Villa collections">
          {films.map((f) => <Film key={f.id} film={f} />)}
        </ul>
      </div>
    </section>
  );
}
