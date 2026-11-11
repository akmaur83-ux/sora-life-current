import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { TAJ_SECTION, TAJ_POSTERS_SECTION, TAJ_POSTERS, TAJ_LISTING, useTajRange } from '../lib/tajLeather.js';

// ============================================================
// Taj Leather (partner, 2026-11-11) — tajLeather.js has what is shown and why:
// their campaign posters (each a link to its listing) and the sliding row of their
// jackets and coats. On the wellness homepage and the Fashion home.
// ============================================================
export { TAJ_SECTION, TAJ_POSTERS_SECTION };

/** `items` is for a test; the page passes nothing and the live catalogue is read. */
export function TajLeatherRange({ items: given, autoplayMs } = {}) {
  const section = useStorefrontSection('wellness', 'tajLeather', TAJ_SECTION);
  const loaded = useTajRange();
  const items = (given ?? loaded) || [];
  return (
    <div className="hx-wv-range">
      <SlidingRail id="taj" label="Taj Leather jackets" section={section} defaults={TAJ_SECTION}
        link={section.link || TAJ_LISTING} items={items} {...(autoplayMs ? { autoplayMs } : {})} />
    </div>
  );
}

/** Their posters, side by side on a wide screen, one above the other on a phone (the tall cut where there is one). */
export function TajLeatherPosters({ posters = TAJ_POSTERS, heading = true } = {}) {
  const s = useStorefrontSection('wellness', 'tajPosters', TAJ_POSTERS_SECTION);
  if (s.hidden || !posters.length) return null;
  return (
    <section className="hx hx-taj" aria-labelledby={heading ? 'hx-taj-h' : undefined} aria-label={heading ? undefined : 'Taj Leather'}>
      <div className="hx-wrap">
        {heading && (
          <div className="hx-taj__head">
            <div>
              {s.eyebrow && <p className="hx-taj__eyebrow">{s.eyebrow}</p>}
              <h2 className="hx-taj__h" id="hx-taj-h">{s.title}</h2>
              {s.text && <p className="hx-taj__text">{s.text}</p>}
            </div>
            {s.cta && <Link to={s.link || TAJ_LISTING} className="hx-taj__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
          </div>
        )}
        <ul className="hx-taj__posters">
          {posters.map((p, i) => (
            <li key={p.id}>
              <Link to={p.href} className="hx-taj__poster">
                <picture>
                  {p.tall && <source media="(max-width: 599px)" srcSet={p.tall} width="900" height="1350" />}
                  <img src={p.wide} alt={p.alt} width="1600" height="900" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                </picture>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
