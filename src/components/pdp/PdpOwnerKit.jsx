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
