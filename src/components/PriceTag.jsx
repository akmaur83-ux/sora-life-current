import { money } from '../lib/format.js';

// Prominent sale price + struck MRP + optional % off.
// Reads the single pricing source on the product (price = sale, mrp = original).
//
// V2 (Phase 1) changes PRESENTATION ONLY. Every pricing calculation below —
// variant override, discount percentage, priceVerified handling — is unchanged
// from V1. Pass variant="v2" for the locked V2 colour hierarchy:
//   price #16211B · MRP #6F675C struck · discount #866419
// Every other call site keeps the legacy `.price` classes untouched.
export default function PriceTag({ product, showOff = true, size, variant = null, v2 = false }) {
  const { currency, priceVerified } = product;
  // When a pack size is selected its own price is what the customer pays,
  // so the whole tag (price, MRP and % off) comes from the variant.
  const price = variant?.price ?? product.price;
  const mrp = variant?.mrp ?? product.mrp;
  const discountPct = variant
    ? (variant.discountPct ?? (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0))
    : product.discountPct;

  if (priceVerified === false) {
    return v2
      ? <span className="v2-price"><span className="v2-price__tbd">Price coming soon</span></span>
      : <span className="price"><span className="price-tbd muted">Price coming soon</span></span>;
  }

  const hasDiscount = mrp > price;

  if (v2) {
    return (
      <span className={`v2-price ${size === 'lg' ? 'v2-price--lg' : ''}`}>
        <span className="v2-price__now">{money(price, currency)}</span>
        {hasDiscount && (
          <span className="v2-price__mrp">
            <span className="v2-price__mrp-lbl">MRP</span>{money(mrp, currency)}
          </span>
        )}
        {showOff && discountPct > 0 && <span className="v2-price__off">{discountPct}% off</span>}
      </span>
    );
  }

  return (
    <span className={`price ${size === 'lg' ? 'price--lg' : ''}`}>
      <span className="now">{money(price, currency)}</span>
      {hasDiscount && <span className="was"><span className="was-lbl">MRP</span> {money(mrp, currency)}</span>}
      {showOff && discountPct > 0 && <span className="off">{discountPct}% off</span>}
    </span>
  );
}
