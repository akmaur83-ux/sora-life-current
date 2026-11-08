import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { useConsumerCare } from '../../lib/consumerCare.js';
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

/** Description as sentences, for "About this item" (up to six, none longer than a line or two). */
export function aboutBullets(text, limit = 6) {
  return String(text || '').replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((x) => x.trim())
    .filter((x) => x.length > 12 && x.length <= 220).slice(0, limit);
}

/** The marketplace "key / value" table at the top of the details: only rows the catalogue carries. */
export function PdpFactTable({ rows, title = 'Product details' }) {
  const shown = (rows || []).filter((r) => r && r[1] != null && String(r[1]).trim());
  if (!shown.length) return null;
  return (
    <section className="pdpk-facts" aria-label={title}>
      <h2 className="pdpk-h">{title}</h2>
      <table><tbody>{shown.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
    </section>
  );
}

export function PdpAbout({ bullets }) {
  if (!bullets || bullets.length < 2) return null;
  return (
    <section className="pdpk-about" aria-labelledby="pdpk-about-h">
      <h2 className="pdpk-h" id="pdpk-about-h">About this item</h2>
      <ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul>
    </section>
  );
}

/**
 * "Compare with similar items": this product and up to three others from the same
 * shelf, each row the catalogue's own figure. items: { key, href, name, image, price,
 * mrp, pct, size, brand, current? }.
 */
export function PdpCompare({ items }) {
  const list = (items || []).filter(Boolean).slice(0, 4);
  if (list.length < 2) return null;
  const rows = [
    ['Price', (p) => <b className="pdpk-cmp__price">{money(p.price)}</b>],
    ['M.R.P.', (p) => (p.mrp > p.price ? <s>{money(p.mrp)}</s> : '—')],
    ['Discount', (p) => (p.pct > 0 ? <span className="pdpk-cmp__off">-{p.pct}%</span> : '—')],
    ['Size', (p) => p.size || '—'],
    ['Brand', (p) => p.brand || '—'],
    ['Delivery', () => 'Free, standard'],
  ];
  return (
    <section className="pdpk-cmp" aria-labelledby="pdpk-cmp-h">
      <h2 className="pdpk-h pdpk-h--lg" id="pdpk-cmp-h">Compare with similar items</h2>
      <div className="pdpk-cmp__scroll">
        <table>
          <thead>
            <tr><td />{list.map((p) => (
              <th key={p.key} scope="col" className={p.current ? 'is-current' : undefined}>
                {p.current ? <span className="pdpk-cmp__item">{p.image && <img src={p.image} alt="" width="120" height="120" loading="lazy" />}<span>{p.name}</span><em>This item</em></span>
                  : <Link to={p.href} className="pdpk-cmp__item">{p.image && <img src={p.image} alt="" width="120" height="120" loading="lazy" />}<span>{p.name}</span></Link>}
              </th>
            ))}</tr>
          </thead>
          <tbody>{rows.map(([label, cell]) => (
            <tr key={label}><th scope="row">{label}</th>{list.map((p) => <td key={p.key} className={p.current ? 'is-current' : undefined}>{cell(p)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

/** Payment, shipping & returns, and who sells it — store-wide facts and the published consumer care. */
export function PdpService() {
  const care = useConsumerCare();
  return (
    <section className="pdpk-svc" aria-label="Payment, delivery and seller">
      <div>
        <h2 className="pdpk-h"><Icon name="card" size={18} /> Payment options</h2>
        <ul><li>UPI, credit and debit cards, net banking</li><li>Cash on Delivery</li><li>Payments processed securely by Razorpay</li></ul>
      </div>
      <div>
        <h2 className="pdpk-h"><Icon name="truck" size={18} /> Shipping &amp; returns</h2>
        <ul><li>Free Standard Delivery on every order, 6-7 days</li><li>Returns within 7 days of delivery</li><li><Link to="/shipping">Shipping policy</Link> · <Link to="/returns">Returns policy</Link></li></ul>
      </div>
      <div>
        <h2 className="pdpk-h"><Icon name="shield" size={18} /> Sold &amp; supported by</h2>
        <ul>
          <li><b>{care.legalName || 'SORA LIFESTYLE'}</b></li>
          {care.address && <li>{care.address}</li>}
          {care.phone && <li><a href={`tel:${String(care.phone).replace(/[^0-9+]/g, '')}`}>{care.phone}</a>{care.hours ? ` · ${care.hours}` : ''}</li>}
          {care.email && <li><a href={`mailto:${care.email}`}>{care.email}</a></li>}
        </ul>
      </div>
    </section>
  );
}
