import Icon from '../Icon.jsx';
import { howToUseFor } from '../../data/pdpContent.js';

// ============================================================
// "How to use" — the product's own directions.
//
// Renders ONLY real product.usage. No generic "read the pack / storage /
// safety" filler — when the catalogue has no usage text for this product
// the whole section is omitted (howToUseFor() returns empty).
// ============================================================
export default function ProductHowToUse({ product }) {
  const { text } = howToUseFor(product);
  if (!text) return null;

  return (
    <section className="pdp-sec pdp-howto" aria-labelledby="pdp-howto-h">
      <h2 id="pdp-howto-h" className="pdp-sec__title serif">How to use</h2>
      <div className="pdp-howto__body">
        <span className="pdp-howto__ic"><Icon name="droplet" size={20} /></span>
        <p className="pdp-howto__text">{text}</p>
      </div>
    </section>
  );
}
