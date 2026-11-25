import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { KIARA_POSTERS_SECTION, KIARA_POSTERS, KIARA_LISTING } from '../lib/kiaraJewels.js';

// ============================================================
// Kiara Jewels posters (partner, 2026-11-25: "home page pe poster dalo") — kiaraJewels.js has
// what is shown and why. The same layout as the Ansari Fashion posters above them (.hx-ans),
// in the jewellery store's gold rather than Ansari's maroon (.hx-kj).
// ============================================================
export { KIARA_POSTERS_SECTION };

export function KiaraPosters({ posters = KIARA_POSTERS } = {}) {
  const s = useStorefrontSection('wellness', 'kiaraPosters', KIARA_POSTERS_SECTION);
  if (s.hidden || !posters.length) return null;
  return (
    <section className="hx hx-ans hx-kj" aria-labelledby="hx-kj-h">
      <div className="hx-wrap">
        <div className="hx-taj__head">
          <div>
            {s.eyebrow && <p className="hx-taj__eyebrow">{s.eyebrow}</p>}
            <h2 className="hx-taj__h" id="hx-kj-h">{s.title}</h2>
            {s.text && <p className="hx-taj__text">{s.text}</p>}
          </div>
          {s.cta && <Link to={s.link || KIARA_LISTING} className="hx-ans__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
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
