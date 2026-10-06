import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';

// ============================================================
// Home & Living product card — image, brand line, name, size, price, and
// the buy action. The image and the name link to the product page.
// `product` is the data layer's view of a catalogue_products row (schema
// field names: images[], net_content, mrp, sale_price) plus `price` and its
// active `variants`. Nothing here computes a price. A product without
// variants is added straight from the card on its own stock; a product with
// variants has a size (and colour) to choose, so the card sends the
// customer to the product page to choose it.
// ============================================================
export const productHref = (product) => `/homeliving/p/${product.slug}`;

export default function HomeLivingProductCard({ product, layout = 'grid', mediaLoading = 'lazy' }) {
  const { addHomeLivingToCart } = useStore();
  const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : null;
  const href = productHref(product);
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const inStock = Number(product.stock) > 0;
  return (
    <article className={`hl-card${layout === 'list' ? ' hl-card--list' : ''}`} data-product={product.slug}>
      <div className="hl-card__media">
        <Link to={href} className="hl-card__img" aria-label={product.name}>
          {image
            ? <img src={image} alt="" loading={mediaLoading} decoding="async" width="400" height="400" />
            : <span className="hl-card__noimg" aria-hidden="true">{product.name.slice(0, 1)}</span>}
        </Link>
        <button type="button" className="hl-card__heart" aria-label={`Save ${product.name} to wishlist`} aria-disabled="true"><Icon name="heart" size={16} /></button>
      </div>
      <div className="hl-card__body">
        <p className="hl-card__brand">{product.brand}</p>
        <h3 className="hl-card__name"><Link to={href}>{product.name}</Link></h3>
        <p className="hl-card__size">{product.net_content}</p>
        <p className="hl-price" data-price={product.price}>
          <strong>{money(product.price)}</strong>
          {product.mrp > product.price && <s className="hl-price__mrp">{money(product.mrp)}</s>}
        </p>
        {hasVariants
          ? <Link to={href} className="hl-btn hl-add hl-card__add hl-card__add--choose">Choose options</Link>
          : (
            <button type="button" className="hl-btn hl-add hl-card__add" disabled={!inStock} onClick={inStock ? () => addHomeLivingToCart(product, null, 1) : undefined}>
              {inStock ? <><Icon name="bag" size={16} /> Add to cart</> : 'Out of stock'}
            </button>
          )}
      </div>
    </article>
  );
}
