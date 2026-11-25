import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { NEW_JEWELLERY_SECTION, NEW_JEWELLERY_TILES, KIARA, JOIYA } from '../lib/newJewellery.js';

// ============================================================
// New in Jewellery (homepage) — newJewellery.js has what is shown and why.
// A bento: the first photograph large, four beside it (desktop); on a phone, the first
// full width and the other four two by two. Photographs load lazily at their real size.
// ============================================================
export { NEW_JEWELLERY_SECTION };

export default function NewJewellery({ tiles = NEW_JEWELLERY_TILES } = {}) {
  const s = useStorefrontSection('wellness', 'newJewellery', NEW_JEWELLERY_SECTION);
  if (s.hidden || !tiles.length) return null;
  return (
    <section className="hx hx-nj" aria-labelledby="hx-nj-h">
      <div className="hx-wrap">
        <div className="hx-nj__head">
          <div>
            {s.eyebrow && <p className="hx-nj__eyebrow">{s.eyebrow}</p>}
            <h2 className="hx-nj__h" id="hx-nj-h">{s.title}</h2>
            {s.text && <p className="hx-nj__text">{s.text}</p>}
          </div>
          <div className="hx-nj__actions">
            <Link to={KIARA.href} className="hx-nj__brand">{KIARA.name}</Link>
            <Link to={JOIYA.href} className="hx-nj__brand">{JOIYA.name}</Link>
            {s.cta && <Link to={s.link || NEW_JEWELLERY_SECTION.link} className="hx-nj__cta">{s.cta} <Icon name="arrowRight" size={16} /></Link>}
          </div>
        </div>
        <ul className="hx-nj__grid">
          {tiles.map((t, i) => (
            <li key={t.id} className={i === 0 ? 'hx-nj__cell hx-nj__cell--lead' : 'hx-nj__cell'}>
              <Link to={t.href} className="hx-nj__tile">
                <img src={t.image} alt={t.alt} width="900" height="1200" loading="lazy" decoding="async" />
                <span className="hx-nj__label">
                  <span className="hx-nj__chip">{t.brand}</span>
                  <span className="hx-nj__name">{t.label} <Icon name="arrowRight" size={i === 0 ? 18 : 15} /></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
