import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import { useStore } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import { products as allProducts, isPurchasable } from '../data/products.js';

// ============================================================
// The cart's two Blinkit/Zepto touches (round 35, owner 2026-11-21), in SORA's look:
//   CartSavings     "You're saving ₹X on this order" — MRP and coupon savings, from the
//                   server's quote when it has answered, else the cart's own MRP figure.
//   BeforeCheckout  a row of small, in-stock wellness add-ons at ₹499 or less that are not
//                   already in the bag, one tap each. An item added leaves the row.
// ============================================================

/** Total saved on this order: product (MRP) discount + coupon, from the quote or the cart. Pure. */
export function orderSavings(breakdown, cartSavingsValue = 0) {
  if (breakdown) return Math.max(0, (Number(breakdown.productDiscount) || 0) + (Number(breakdown.couponDiscount) || 0));
  return Math.max(0, Number(cartSavingsValue) || 0);
}

export function CartSavings({ breakdown, fallback = 0 }) {
  const saved = orderSavings(breakdown, fallback);
  if (!(saved >= 1)) return null;
  return (
    <p className="sora-saved" role="status">
      <Icon name="tag" size={16} />
      <span>You’re saving <b>{money(saved)}</b> on this order</span>
    </p>
  );
}

export const ADDON_MAX_PRICE = 499;
/** Small add-ons: in stock, buyable, at most ₹499, not in the bag; bestsellers first, then cheapest. Pure. */
export function addOnPicks(list, cartIds, max = 10) {
  const inBag = new Set((cartIds || []).map(String));
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && !inBag.has(String(p.id)) && Number(p.stock) > 0 && Number(p.price) > 0 && Number(p.price) <= ADDON_MAX_PRICE && isPurchasable(p))
    .sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0) || Number(a.price) - Number(b.price))
    .slice(0, max);
}

export function BeforeCheckout() {
  const { cart, addToCart } = useStore();
  const picks = addOnPicks(allProducts, (cart || []).filter((l) => !l.catalogue).map((l) => l.id));
  if (picks.length < 3) return null;
  return (
    <section className="sora-addons" aria-labelledby="sora-addons-h">
      <h2 id="sora-addons-h" className="sora-addons__h">Before you checkout</h2>
      <p className="sora-addons__sub">Small things, ₹{ADDON_MAX_PRICE} or less</p>
      <ul className="sora-addons__row">
        {picks.map((p) => (
          <li key={p.id} className="sora-addons__item">
            <Link to={`/product/${p.slug}`} className="sora-addons__pic" aria-label={p.name}><ProductImage product={p} frame="v2" variant="card" loading="lazy" /></Link>
            <Link to={`/product/${p.slug}`} className="sora-addons__name">{p.name}</Link>
            <span className="sora-addons__price">{money(p.price)}{Number(p.mrp) > Number(p.price) && <s>{money(p.mrp)}</s>}</span>
            <button type="button" className="sora-addons__add" onClick={() => addToCart(p)} aria-label={`Add ${p.name} to bag`}><Icon name="plus" size={14} stroke={2} /> Add</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
