import Icon from '../Icon.jsx';
import { benefitsFor } from '../../data/pdpContent.js';

// ============================================================
// "Why you'll love it" — compact 2×2 benefit cards.
//
// Renders ONLY real, product-specific product.benefits. No store-wide or
// category filler — when the catalogue has no benefits for this product
// the whole section is omitted (benefitsFor() returns []).
// ============================================================
export default function ProductBenefits({ product }) {
  const { items } = benefitsFor(product);
  if (!items.length) return null;

  return (
    <section className="pdp-sec pdp-benefits" aria-labelledby="pdp-benefits-h">
      <h2 id="pdp-benefits-h" className="pdp-sec__title serif">Why you&rsquo;ll love it</h2>
      <ul className="pdp-benefits__grid">
        {items.slice(0, 4).map((b) => (
          <li key={b.label} className="pdp-benefits__card">
            <span className="pdp-benefits__ic"><Icon name={b.icon} size={16} /></span>
            <strong>{b.label}</strong>
            {b.text && <span>{b.text}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
