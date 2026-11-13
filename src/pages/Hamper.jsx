import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';
import { products } from '../data/products.js';
import { categories } from '../data/categories.js';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// Build your hamper (owner, 2026-11-13: "Apna Diwali hamper banao"). Pick three to
// six wellness products, see the total, and put them all in the bag in one tap.
// Each goes in at its own price, one of each; nothing is discounted or bundled
// here — the bag and checkout price them as always.
// ============================================================
export const HAMPER_MIN = 3;
export const HAMPER_MAX = 6;

/** In-stock, priced wellness products with a picture. Pure. */
export const hamperPool = (list) => (Array.isArray(list) ? list : []).filter((p) => p && p.slug && p.image && Number(p.stock) > 0 && Number(p.price) > 0);

/** Pick or drop one; never past the maximum. Pure. */
export function toggleHamper(picked, id) {
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  return picked.length >= HAMPER_MAX ? picked : [...picked, id];
}

export const hamperTotal = (items) => items.reduce((n, p) => n + Number(p.price || 0), 0);

export default function Hamper() {
  const { addToCart } = useStore();
  const navigate = useNavigate();
  const pool = hamperPool(products);
  const cats = categories.filter((c) => pool.some((p) => p.category === c.slug));
  const [cat, setCat] = useState('');
  const [picked, setPicked] = useState([]);
  usePageMeta({ title: 'Build your hamper', description: 'Pick three to six wellness favourites and put them all in your bag in one tap.', path: '/hamper' });
  const shown = cat ? pool.filter((p) => p.category === cat) : pool;
  const chosen = picked.map((id) => pool.find((p) => p.id === id)).filter(Boolean);
  const ready = chosen.length >= HAMPER_MIN;
  const addAll = () => { chosen.forEach((p) => addToCart(p, 1)); navigate('/cart'); };
  return (
    <div className="hx sora-hamper">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Build your hamper</span></nav>
        <h1 className="hx-offers__h">Build your hamper</h1>
        <p className="hx-offers__lede">Pick {HAMPER_MIN} to {HAMPER_MAX} wellness favourites for someone you love, then add them all to your bag in one tap.</p>
        <div className="sora-brand__cats" role="group" aria-label="Category">
          <button type="button" aria-pressed={!cat} className={`hx-offers__chip${!cat ? ' is-on' : ''}`} onClick={() => setCat('')}>All</button>
          {cats.map((c) => <button key={c.slug} type="button" aria-pressed={cat === c.slug} className={`hx-offers__chip${cat === c.slug ? ' is-on' : ''}`} onClick={() => setCat(c.slug)}>{c.name}</button>)}
        </div>
        <ul className="hx-offers__grid sora-hamper__grid">
          {shown.map((p) => {
            const on = picked.includes(p.id);
            const full = !on && picked.length >= HAMPER_MAX;
            return (
              <li key={p.id}>
                <button type="button" className={`sora-hamper__card${on ? ' is-on' : ''}`} aria-pressed={on} disabled={full} onClick={() => setPicked((x) => toggleHamper(x, p.id))}>
                  <span className="hx-deals__img sora-brand__whole"><img src={p.image} alt="" width="300" height="300" loading="lazy" decoding="async" /><i className="sora-hamper__tick" aria-hidden="true"><Icon name={on ? 'check' : 'plus'} size={16} /></i></span>
                  <span className="hx-deals__name">{p.name}</span>
                  <span className="hx-deals__price"><b>{money(p.price)}</b></span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sora-hamper__bar" role="region" aria-label="Your hamper">
        <div className="sora-hamper__bar-in">
          <ul className="sora-hamper__picked">
            {chosen.map((p) => <li key={p.id}><img src={p.image} alt={p.name} width="40" height="40" /></li>)}
            {Array.from({ length: Math.max(0, HAMPER_MIN - chosen.length) }, (_, i) => <li key={`e${i}`} className="is-empty" aria-hidden="true" />)}
          </ul>
          <p><b>{chosen.length} of {HAMPER_MAX}</b> · {money(hamperTotal(chosen))}<span>{ready ? 'Ready to add' : `Pick ${HAMPER_MIN - chosen.length} more`}</span></p>
          <button type="button" className="sora-hamper__go" disabled={!ready} onClick={addAll}>Add all to bag</button>
        </div>
      </div>
    </div>
  );
}
