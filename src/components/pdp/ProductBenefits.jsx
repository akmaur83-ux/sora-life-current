import Icon from '../Icon.jsx';
import { benefitsFor } from '../../data/pdpContent.js';

// ============================================================
// "What each ingredient does" — ingredient-level explanation.
//
// The heading names what the data IS. The source labels this section
// "Benefits", but what it actually contains is one entry per botanical —
// "Zingiber Officinale (Ginger) contains gingerols, which help reduce
// inflammation" — not marketing benefits of the finished product. Calling
// that "Why you'll love it" would have been a claim the data does not make.
// The data is stored exactly as parsed; only the label was corrected.
//
// A list, not a grid of bordered cards. The content runs to seven entries on
// some products, each a full sentence: four boxes could not hold that, and
// capping at four silently threw the rest away. A rule between rows separates
// them for free and keeps the page clear of card soup.
//
// Renders ONLY real product data. When the catalogue has none for this
// product the section is omitted entirely.
// ============================================================
export default function ProductBenefits({ product }) {
  const { items } = benefitsFor(product);
  if (!items.length) return null;

  return (
    <section className="pdp-sec pdp-benefits" aria-labelledby="pdp-benefits-h">
      <h2 id="pdp-benefits-h" className="pdp-sec__title serif">What each ingredient does</h2>
      <ul className="pdp-benefits__list">
        {items.map((b) => (
          <li key={b.label} className="pdp-benefits__row">
            <span className="pdp-benefits__ic" aria-hidden="true"><Icon name={b.icon} size={15} /></span>
            <div className="pdp-benefits__body">
              <strong>{b.label}</strong>
              {b.text && <p>{b.text}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
