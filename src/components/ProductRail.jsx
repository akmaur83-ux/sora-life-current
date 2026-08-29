import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductCard from './ProductCard.jsx';

// V2 product rail.
//
// Native horizontal scroll with scroll-snap on mobile (2.2 cards visible, so
// the partial card advertises the scroll), a real grid from 768 up. No carousel
// library, no arrows, no JS — it works with a keyboard, a trackpad and a screen
// reader as-is.
export default function ProductRail({
  eyebrow,
  title,
  products,
  link,
  linkLabel = 'View all',
  limit = 8,
  minItems = 1,
}) {
  const items = Array.isArray(products) ? products.slice(0, limit) : [];
  if (items.length < minItems) return null;

  return (
    <section className="v2-sec">
      <div className="v2-wrap">
        <div className="v2-sechead">
          <div>
            {eyebrow && <p className="v2-eyebrow">{eyebrow}</p>}
            {title && <h2 className="v2-h2">{title}</h2>}
          </div>
          {link && (
            <Link to={link} className="v2-more">
              {linkLabel} <Icon name="chevronRight" size={12} stroke={1.8} />
            </Link>
          )}
        </div>

        <div className="v2-rail v2-rail--cards">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}
