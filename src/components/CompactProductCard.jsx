import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import PriceTag from './PriceTag.jsx';
import { useStore } from '../lib/store.jsx';
import { branding } from '../lib/settings.js';

// V2 compact horizontal product card.
//
// Used by Home recommendations in Phase 1. PDP "Goes well with" and the cart
// upsell reuse this in later phases — which is why it is its own component
// rather than a mode flag on ProductCard.
//
// Deliberately lighter than the full card: no badge, no category meta, no
// wishlist, so a recommendations rail tapers away from the Bestsellers grid
// rather than competing with it.
export default function CompactProductCard({ product }) {
  const { addToCart } = useStore();
  const out = product.stock === 0;

  return (
    <div className="v2-cc">
      <Link to={`/product/${product.slug}`} className="v2-cc__m" aria-hidden="true" tabIndex={-1}>
        <ProductImage product={product} frame="v2" sizes="80px" />
      </Link>

      <div className="v2-cc__b">
        <span className="v2-cc__brand">{branding.siteName}</span>
        <p className="v2-cc__n">
          <Link to={`/product/${product.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            {product.name}
          </Link>
        </p>
        <PriceTag product={product} showOff={false} v2 />
      </div>

      {!out && (
        <button
          type="button"
          className="v2-cc__add"
          onClick={() => addToCart(product)}
          aria-label={`Add ${product.name} to cart`}
        >
          <Icon name="plus" size={12} stroke={1.8} />
        </button>
      )}
    </div>
  );
}
