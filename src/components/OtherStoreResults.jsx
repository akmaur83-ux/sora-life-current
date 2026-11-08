import { Link } from 'react-router-dom';
import { money } from '../lib/format.js';
import { useOtherStoreMatches } from '../lib/crossStoreSearch.js';

// The Fashion and Home & Living products that match a wellness search
// (/shop?q=…; crossStoreSearch.js). Nothing matching, or not loaded: nothing.
export default function OtherStoreResults({ query, limit = 24 }) {
  const q = String(query || '').trim();
  const found = useOtherStoreMatches(q, q.length >= 2);
  if (!found || found.length === 0) return null;
  const stores = [...new Set(found.map((f) => f.storeLabel))].join(' and ');
  return (
    <section className="v2-wrap hx-xs" aria-labelledby="hx-xs-h">
      <h2 className="hx-xs__h" id="hx-xs-h">Also in {stores} <span>{found.length} {found.length === 1 ? 'product' : 'products'} for “{q}”</span></h2>
      <ul className="hx-xs__grid">
        {found.slice(0, limit).map((p) => (
          <li key={p.key}>
            <Link to={p.href} className="hx-xs__card">
              <span className="hx-xs__img">{p.image && <img src={p.image} alt="" width="300" height="300" loading="lazy" decoding="async" />}</span>
              <span className="hx-xs__store">{p.storeLabel}</span>
              <span className="hx-xs__name">{p.name}</span>
              <span className="hx-xs__price"><b>{money(p.price)}</b>{p.mrp > p.price && <s>{money(p.mrp)}</s>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
