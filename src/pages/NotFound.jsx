import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { products } from '../data/products.js';
import { money } from '../lib/format.js';
import { slugWords, similarByWords, searchFor } from '../lib/notFoundHelp.js';

// ============================================================
// Not found (round 17, 2026-11-20: not a dead end). A search box and the main ways
// in; and for an old wellness product link (/product/<slug>), live products named
// like it and a search for its words (notFoundHelp.js).
// ============================================================
export default function NotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const m = /^\/product\/([^/?#]+)/.exec(pathname || '');
  const words = m ? slugWords(m[1]) : [];
  const like = m ? similarByWords((products || []).filter((p) => Number(p.stock) > 0 && p.image), words, (p) => `${p.name} ${p.brand || ''}`, 4) : [];
  const go = (e) => { e.preventDefault(); const t = q.trim(); if (t) navigate(`/shop?q=${encodeURIComponent(t)}`); };
  return (
    <div className="container section">
      <div className="state">
        <span className="state-ic"><Icon name="leaf" size={32} /></span>
        <h3 style={{ fontSize: 'var(--text-4xl)' }}>{m ? 'No longer here' : '404'}</h3>
        <p>{m ? 'This product is no longer in the shop — it may have sold out or been replaced.' : "We couldn't find that page. It may have moved, or the link is out of date."}</p>
        <form className="sora-nf__search" role="search" onSubmit={go}>
          <label className="sr-only" htmlFor="sora-nf-q">Search the shop</label>
          <input id="sora-nf-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={words.length ? words.join(' ') : 'Search the shop'} />
          <button type="submit" className="btn">Search</button>
        </form>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {words.length > 0 && <Link to={searchFor('wellness', words)} className="btn">Search for “{words.join(' ')}”</Link>}
          <Link to="/" className="btn btn-outline">Back home</Link>
          <Link to="/categories" className="btn btn-outline">All categories</Link>
        </div>
      </div>
      {like.length > 0 && (
        <section className="sora-nf__like" aria-labelledby="sora-nf-like-h">
          <h2 className="serif" id="sora-nf-like-h">You might be looking for</h2>
          <ul className="hx-offers__grid">
            {like.map((p) => (
              <li key={p.id}><Link to={`/product/${p.slug}`} className="hx-deals__card">
                <span className="hx-deals__img"><img src={p.image} alt="" width="300" height="300" loading="lazy" decoding="async" /></span>
                <span className="hx-deals__name">{p.name}</span>
                <span className="hx-deals__price"><b>{money(p.price)}</b></span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
