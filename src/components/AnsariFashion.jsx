import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { SlidingRail } from './HomeCategoryRails.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { ANSARI_SECTION, ANSARI_POSTERS_SECTION, ANSARI_POSTERS, ANSARI_LISTING, useAnsariRange } from '../lib/ansariFashion.js';

// ============================================================
// Ansari Fashion (partner, 2026-11-13) — ansariFashion.js has what is shown and why:
// three category posters (their photographs, our labels), then the sliding row of
// their suits and sarees. On the wellness homepage and the Fashion home.
// ============================================================
export { ANSARI_SECTION, ANSARI_POSTERS_SECTION };

/** `items` is for a test; the page passes nothing and the live catalogue is read. */
export function AnsariRange({ items: given, autoplayMs } = {}) {
  const section = useStorefrontSection('wellness', 'ansari', ANSARI_SECTION);
  const loaded = useAnsariRange();
  const items = (given ?? loaded) || [];
  return (
    <div className="hx-wv-range">
      <SlidingRail id="ansari" label="Ansari Fashion suits and sarees" section={section} defaults={ANSARI_SECTION}
        link={section.link || ANSARI_LISTING} items={items} {...(autoplayMs ? { autoplayMs } : {})} />
    </div>
  );
}

export function AnsariPosters({ posters = ANSARI_POSTERS } = {}) {
  const s = useStorefrontSection('wellness', 'ansariPosters', ANSARI_POSTERS_SECTION);
  if (s.hidden || !posters.length) return null;
  return (
    <section className="hx hx-ans" aria-labelledby="hx-ans-h">
      <div className="hx-wrap">
        <div className="hx-taj__head">
          <div>
            {s.eyebrow && <p className="hx-taj__eyebrow">{s.eyebrow}</p>}
            <h2 className="hx-taj__h" id="hx-ans-h">{s.title}</h2>
            {s.text && <p className="hx-taj__text">{s.text}</p>}
          </div>
          {s.cta && <Link to={s.link || ANSARI_LISTING} className="hx-ans__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
        </div>
        <ul className="hx-ans__posters">
          {posters.map((p) => (
            <li key={p.id}>
              <Link to={p.href} className="hx-ans__poster">
                <img src={p.image} alt={p.alt} width="900" height="1200" loading="lazy" decoding="async" />
                <span className="hx-ans__label">{p.label} <Icon name="arrowRight" size={15} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
