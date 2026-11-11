import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { products } from '../data/products.js';
import { ATOMY_SECTION, ATOMY_SHOWCASE, ATOMY_TILES, ATOMY_LISTING, selectAtomyRange } from '../lib/atomy.js';

// ============================================================
// Atomy on the wellness homepage (partner, 2026-11-11) — atomy.js has what is
// shown and why: the sliding row of their products, then a poster band of
// category tiles. Editable in Storefronts → Wellness; hidden or empty, nothing.
// ============================================================
export { ATOMY_SECTION, ATOMY_SHOWCASE };

/** `items` is for a test; the page passes nothing and the live catalogue is read. */
export function AtomyRange({ items: given, autoplayMs } = {}) {
  const section = useStorefrontSection('wellness', 'atomy', ATOMY_SECTION);
  const items = given ?? selectAtomyRange(products);
  return (
    <SlidingRail id="atomy" label="Atomy products" section={section} defaults={ATOMY_SECTION}
      link={section.link || ATOMY_LISTING} items={items} {...(autoplayMs ? { autoplayMs } : {})} />
  );
}

export function AtomyShowcase({ tiles = ATOMY_TILES } = {}) {
  const s = useStorefrontSection('wellness', 'atomyShowcase', ATOMY_SHOWCASE);
  if (s.hidden || !tiles.length) return null;
  return (
    <section className="hx hx-wv hx-lf hx-atomy" aria-labelledby="hx-atomy-h">
      <div className="hx-wrap">
        <div className="hx-wv__head">
          <div className="hx-wv__copy">
            {s.eyebrow && <p className="hx-wv__eyebrow">{s.eyebrow}</p>}
            <h2 className="hx-wv__h" id="hx-atomy-h">{s.title}</h2>
            {s.text && <p className="hx-wv__text">{s.text}</p>}
          </div>
          {s.cta && <Link to={s.link || ATOMY_LISTING} className="hx-wv__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
        </div>
        <ul className="hx-wv__films hx-lf__tiles" aria-label="Atomy categories">
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
