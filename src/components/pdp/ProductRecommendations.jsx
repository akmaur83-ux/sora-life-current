import ProductRail from '../ProductRail.jsx';
import { getRelated } from '../../data/products.js';

// ============================================================
// PDP recommendations. Reuses the existing ProductRail + ProductCard
// architecture and the real catalogue's `getRelated()` — no new card
// component, no fabricated products. On mobile ProductRail is already a
// snap-scrolling carousel; on desktop it is a 4-up grid.
//
// The "Goes well with" pairing story is handled by the Frequently-bought-
// together block higher up the page, so this stays to a single rail.
// ============================================================
export default function ProductRecommendations({ product }) {
  const related = getRelated(product);
  if (!related.length) return null;
  return (
    <ProductRail
      eyebrow="Complete the ritual"
      title="You might also like"
      products={related}
      limit={4}
    />
  );
}
