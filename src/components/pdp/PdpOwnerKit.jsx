import Icon from '../Icon.jsx';
import { money } from '../../lib/format.js';

// ============================================================
// The owner's product-page pieces (2026-11-08), shared by the wellness PDP:
// the assurance strip over the page, the five assurances under the offers,
// the "Save ₹… on this item" line and the name with its middle words picked
// out. The Home & Living PDP has its own copies of the same pieces.
//
// Every line is a store-wide fact (free standard delivery on every order,
// Cash on Delivery at checkout, returns within 7 days of delivery, payments
// through Razorpay). Nothing product-specific is claimed here.
// ============================================================

const STRIP = [
  { icon: 'leaf', label: 'Premium Wellness' },
  { icon: 'shield', label: 'Trusted Quality' },
  { icon: 'truck', label: 'Free Delivery' },
  { icon: 'return', label: 'Easy Returns' },
];

const ASSURANCES = [
  { icon: 'truck', label: ['Free', 'Delivery'] },
  { icon: 'card', label: ['Cash on', 'Delivery'] },
  { icon: 'return', label: ['7-Day', 'Returns'] },
  { icon: 'lock', label: ['Secure', 'Payments'] },
  { icon: 'shield', label: ['Genuine', 'Products'] },
];

export function PdpAssuranceStrip() {
  return (
    <ul className="pdpk-strip" aria-label="Why shop with us">
      {STRIP.map((a) => <li key={a.label}><Icon name={a.icon} size={16} /> {a.label}</li>)}
    </ul>
  );
}

export function PdpAssurances() {
  return (
    <ul className="pdpk-feats">
      {ASSURANCES.map((a) => <li key={a.icon}><span aria-hidden="true"><Icon name={a.icon} size={20} /></span>{a.label[0]}<br />{a.label[1]}</li>)}
    </ul>
  );
}

/** What the struck MRP saves on the chosen pack (or the product), or 0. */
export function savingOf(product, variant = null) {
  if (!product || product.priceVerified === false) return 0;
  const price = Number(variant?.price ?? product.price) || 0;
  const mrp = Number(variant?.mrp ?? product.mrp) || 0;
  return mrp > price && price > 0 ? mrp - price : 0;
}

export function PdpSaving({ product, variant = null }) {
  const saving = savingOf(product, variant);
  if (!saving) return null;
  return <p className="pdpk-save">Save {money(saving, product.currency)} on this item</p>;
}

/** The name with its middle words picked out ("Wellsash <Sea Buckthorn> Juice"); short names stay whole. */
export function titleParts(name) {
  const [main, ...rest] = String(name || '').split(' — ');
  const w = main.split(' ').filter(Boolean);
  const tail = rest.length ? ` — ${rest.join(' — ')}` : '';
  if (w.length < 4) return [main + tail, '', ''];
  return [w.slice(0, 1).join(' '), w.slice(1, -1).join(' '), w[w.length - 1] + tail];
}

/** The chosen pack's (or product's) price, M.R.P. and discount, for the price block. */
export function priceParts(product, variant = null) {
  const price = Number(variant?.price ?? product?.price) || 0;
  const mrp = Number(variant?.mrp ?? product?.mrp) || 0;
  const pct = variant
    ? (variant.discountPct ?? (mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0))
    : (product?.discountPct || 0);
  return { price, mrp: mrp > price ? mrp : 0, pct };
}

const digits = (n, currency) => money(n, currency).replace(/^[^0-9]+/, '');

/** "-18% ₹656" with a small raised ₹, M.R.P. under it — the marketplace price block. */
export function PdpPrice({ product, variant = null }) {
  if (product?.priceVerified === false) return <p className="pdpk-price"><span className="pdpk-price__tbd">Price coming soon</span></p>;
  const { price, mrp, pct } = priceParts(product, variant);
  return (
    <div className="pdpk-pricebox">
      <p className="pdpk-price">
        {pct > 0 && <span className="pdpk-price__off">-{pct}%</span>}
        <span className="pdpk-price__now"><sup>₹</sup>{digits(price, product.currency)}</span>
      </p>
      {mrp > 0 && <p className="pdpk-price__mrp">M.R.P.: <s>{money(mrp, product.currency)}</s></p>}
    </div>
  );
}
