import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { LF_SECTION, LF_SHOWCASE, LF_TILES, LF_LISTING, useLeatherRange } from '../lib/leatherFactory.js';

// ============================================================
// Leather Factory on the wellness homepage (owner, 2026-11-08) — leatherFactory.js
// has what is shown and why. Straight under the Weavers Villa sections:
//
//   LeatherFactoryRange     their pieces in the shared sliding row, packshots whole on white;
//   LeatherFactoryShowcase  a leather-brown poster band — name, line, one button — over a
//                           row of category tiles, each opening its sub-category.
//
// Both editable in Storefronts → Wellness; hidden, or nothing to show, renders nothing.
// ============================================================
export { LF_SECTION, LF_SHOWCASE };

/** `items` is for a test; the page passes nothing and the live catalogue is read. */
export function LeatherFactoryRange({ items: given, autoplayMs } = {}) {
  const section = useStorefrontSection('wellness', 'leatherFactory', LF_SECTION);
  const loaded = useLeatherRange();
  const items = (given ?? loaded) || [];
  return (
    <SlidingRail id="leather" label="Leather Factory pieces" section={section} defaults={LF_SECTION}
      link={section.link || LF_LISTING} items={items} {...(autoplayMs ? { autoplayMs } : {})} />
  );
}

export function LeatherFactoryShowcase({ tiles = LF_TILES } = {}) {
  const s = useStorefrontSection('wellness', 'leatherShowcase', LF_SHOWCASE);
  if (s.hidden || !tiles.length) return null;
  return (
    <section className="hx hx-wv hx-lf" aria-labelledby="hx-lf-h">
      <div className="hx-wrap">
        <div className="hx-wv__head">
          <div className="hx-wv__copy">
            {s.eyebrow && <p className="hx-wv__eyebrow">{s.eyebrow}</p>}
            <h2 className="hx-wv__h" id="hx-lf-h">{s.title}</h2>
            {s.text && <p className="hx-wv__text">{s.text}</p>}
          </div>
          {s.cta && <Link to={s.link || LF_LISTING} className="hx-wv__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
        </div>
        <ul className="hx-wv__films hx-lf__tiles" aria-label="Leather Factory categories">
          {tiles.map((t) => (
            <li key={t.id} className="hx-wv__film">
              <Link to={t.href} className="hx-wv__tile">
                <span className="hx-wv__media hx-lf__media">
                  <img className="hx-lf__img" src={t.image} alt="" width={720} height={720} loading="lazy" decoding="async" />
                </span>
                <span className="hx-wv__label">{t.label} <Icon name="arrowRight" size={14} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
