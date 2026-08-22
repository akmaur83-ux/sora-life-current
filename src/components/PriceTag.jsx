import { money } from '../lib/format.js';

// Prominent sale price + struck MRP + optional % off.
// Reads the single pricing source on the product (price = sale, mrp = original).
export default function PriceTag({ product, showOff = true, size }) {
  const { price, mrp, discountPct, currency, priceVerified } = product;

  if (priceVerified === false) {
    return <span className="price"><span className="price-tbd muted">Price coming soon</span></span>;
  }

  const hasDiscount = mrp > price;
  return (
    <span className={`price ${size === 'lg' ? 'price--lg' : ''}`}>
      <span className="now">{money(price, currency)}</span>
      {hasDiscount && <span className="was"><span className="was-lbl">MRP</span> {money(mrp, currency)}</span>}
      {showOff && discountPct > 0 && <span className="off">{discountPct}% off</span>}
    </span>
  );
}
