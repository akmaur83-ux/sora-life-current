import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';

// ============================================================
// Home & Living product card — image, brand line, name, size, price.
// `product` is a catalogue_products row (schema field names: images[],
// net_content, mrp, sale_price) plus the data layer's `price`. Nothing
// here computes a price. There is no Add button yet: this store has no
// cart namespace until the cart is next opened, so the card shows and
// does not sell.
// ============================================================
export default function HomeLivingProductCard({ product, mediaLoading = 'lazy' }) {
  const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : null;
  return (
    <article className="hl-card" data-product={product.slug}>
      <div className="hl-card__media">
        {image
          ? <img src={image} alt="" loading={mediaLoading} decoding="async" width="400" height="400" />
          : <span className="hl-card__noimg" aria-hidden="true">{product.name.slice(0, 1)}</span>}
        <button type="button" className="hl-card__heart" aria-label={`Save ${product.name} to wishlist`} aria-disabled="true"><Icon name="heart" size={16} /></button>
      </div>
      <div className="hl-card__body">
        <p className="hl-card__brand">{product.brand}</p>
        <h3 className="hl-card__name">{product.name}</h3>
        <p className="hl-card__size">{product.net_content}</p>
        <p className="hl-price" data-price={product.price}>
          <strong>{money(product.price)}</strong>
          {product.mrp > product.price && <s className="hl-price__mrp">{money(product.mrp)}</s>}
        </p>
      </div>
    </article>
  );
}
