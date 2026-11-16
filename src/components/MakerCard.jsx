import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { BRANDS } from '../lib/brands.js';

// ============================================================
// About the maker (owner, 2026-11-16: more features, round 9). On a product page of a
// partner brand — Diamond Leather, Taj Leather, Ansari Fashion, Weavers Villa, Leather
// Factory, Atomy, Biosash — a short card: who makes it (the brand's own story from
// Our Brands, lib/brands.js) and a link to their page with everything of theirs on SORA.
// Any other brand shows nothing. Nothing here prices or ranks anything.
// ============================================================

/** The partner brand behind a product's brand name, or null. Matches the catalogue name or the display name, any case. Pure. */
export function makerFor(brandName, brands = BRANDS) {
  const n = String(brandName || '').trim().toLowerCase();
  if (!n) return null;
  return brands.find((b) => b.page && [b.catalogueBrand, b.name].some((x) => x && x.toLowerCase() === n)) || null;
}

export default function MakerCard({ brand }) {
  const m = makerFor(brand);
  if (!m) return null;
  return (
    <section className="sora-maker" aria-labelledby="sora-maker-h">
      {m.image && <img className="sora-maker__img" src={m.image} alt="" width="160" height="160" loading="lazy" decoding="async" />}
      <div className="sora-maker__body">
        <p className="sora-maker__eyebrow">About the maker</p>
        <h2 className="sora-maker__h serif" id="sora-maker-h">{m.name}</h2>
        <p className="sora-maker__story">{m.story || m.text}</p>
        <Link to={m.page} className="sora-maker__cta">See everything from {m.name} <Icon name="arrowRight" size={15} /></Link>
      </div>
    </section>
  );
}
