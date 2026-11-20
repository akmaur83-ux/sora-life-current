import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

// ============================================================
// Two small lines under a product's name (round 11, 2026-11-20):
//   * "Made in India" — only when the product's own record says its country of
//     origin is India (catalogue_products.country_of_origin = 'IN');
//   * "How to care for leather" — on leather or suede products (by the product's
//     material, or its name when no material is recorded), linking the care guide.
// Nothing is guessed: no record, no badge.
// ============================================================

/** Whether a product is leather or suede, by its material (or name). Pure. */
export function isLeather(material, name = '') {
  const t = `${material || ''} ${material ? '' : name || ''}`.toLowerCase();
  return /\b(leather|suede|nubuck)\b/.test(t) && !/\b(faux|vegan|pu|pu-leather|artificial|synthetic|rexine)\b/.test(t);
}
export const madeInIndia = (origin) => String(origin || '').trim().toUpperCase() === 'IN' || /^india$/i.test(String(origin || '').trim());

export default function ProductOrigin({ origin, material, name }) {
  const india = madeInIndia(origin);
  const leather = isLeather(material, name);
  if (!india && !leather) return null;
  return (
    <p className="sora-origin">
      {india && <span className="sora-origin__in"><Icon name="mapPin" size={14} /> Made in India</span>}
      {leather && <Link to="/guides/leather-care" className="sora-origin__care">How to care for leather <Icon name="arrowRight" size={13} /></Link>}
    </p>
  );
}
