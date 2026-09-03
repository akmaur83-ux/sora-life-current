import ProductCard from '../ProductCard.jsx';
import { products } from '../../data/products.js';
import { selectPdpRecommendations } from '../../lib/pdpRecommendations.js';

// ============================================================
// PDP-only recommendation grid. It keeps the frozen ProductCard intact and
// selects only active, in-stock, payable products from the real catalogue.
// ============================================================
export default function ProductRecommendations({ product }) {
  const related = selectPdpRecommendations(product, products, 12);
  if (!related.length) return null;
  return (
    <section className="v2-sec pdp-recommendations" aria-labelledby="pdp-recommendations-h">
      <div className="v2-wrap">
        <div className="v2-sechead">
          <div>
            <p className="v2-eyebrow">Continue shopping</p>
            <h2 id="pdp-recommendations-h" className="v2-h2">You might also like</h2>
          </div>
        </div>
        <div className="pdp-recommendations__grid">
          {related.map((item) => <ProductCard key={item.id} product={item} />)}
        </div>
      </div>
    </section>
  );
}
