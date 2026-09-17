import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';

// ============================================================
// Grocery product card — image, brand line, name, net content, price, Add.
// `product` is a catalogue_products row (schema field names: images[],
// net_content, mrp, sale_price) plus the data layer's `price`. Add puts the
// product into the SHARED cart in the grocery namespace (store.jsx →
// addGroceryToCart); the line carries the id only. Nothing here computes
// a price.
// ============================================================
export default function GroceryProductCard({ product, mediaLoading = 'lazy' }) {
  const { addGroceryToCart } = useStore();
  const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : null;
  return (
    <article className="gs-card" data-product={product.slug}>
      <div className="gs-card__media">
        {image
          ? <img src={image} alt="" loading={mediaLoading} decoding="async" width="400" height="400" />
          : <span className="gs-card__noimg" aria-hidden="true">{product.name.slice(0, 1)}</span>}
        <button type="button" className="gs-card__heart" aria-label={`Save ${product.name} to wishlist`} aria-disabled="true"><Icon name="heart" size={16} /></button>
      </div>
      <div className="gs-card__body">
        <p className="gs-card__brand">{product.brand}</p>
        <h3 className="gs-card__name">{product.name}</h3>
        <p className="gs-card__pack">{product.net_content}</p>
        <div className="gs-card__foot">
          <p className="gs-price" data-price={product.price}>
            <strong>{money(product.price)}</strong>
            {product.mrp > product.price && <s className="gs-price__mrp">{money(product.mrp)}</s>}
          </p>
          <button type="button" className="gs-add" onClick={() => addGroceryToCart(product)} aria-label={`Add ${product.name} ${product.net_content} to cart`}>Add</button>
        </div>
      </div>
    </article>
  );
}
