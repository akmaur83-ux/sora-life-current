import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { JOIYA_POSTERS_SECTION, JOIYA_POSTERS, JOIYA_LISTING } from '../lib/joiyaJewellery.js';

// ============================================================
// Joiya Jewellery posters (partner, 2026-11-25) — joiyaJewellery.js has what is shown and why.
// The Ansari / Kiara poster layout (.hx-ans), in Joiya's wine (.hx-jy).
// ============================================================
export { JOIYA_POSTERS_SECTION };

export function JoiyaPosters({ posters = JOIYA_POSTERS } = {}) {
  const s = useStorefrontSection('wellness', 'joiyaPosters', JOIYA_POSTERS_SECTION);
  if (s.hidden || !posters.length) return null;
  return (
    <section className="hx hx-ans hx-jy" aria-labelledby="hx-jy-h">
      <div className="hx-wrap">
        <div className="hx-taj__head">
          <div>
            {s.eyebrow && <p className="hx-taj__eyebrow">{s.eyebrow}</p>}
            <h2 className="hx-taj__h" id="hx-jy-h">{s.title}</h2>
            {s.text && <p className="hx-taj__text">{s.text}</p>}
          </div>
          {s.cta && <Link to={s.link || JOIYA_LISTING} className="hx-ans__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
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
