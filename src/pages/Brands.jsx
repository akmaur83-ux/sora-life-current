import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import Icon from '../components/Icon.jsx';
import { products } from '../data/products.js';
import { productBrandName } from '../lib/homeMerchandising.js';
import { BRANDS, brandImage, brandCounts } from '../lib/brands.js';
import { usePageMeta } from '../lib/pageMeta.js';

// /brands — every partner brand on SORA Lifestyle (brands.js has the list).
const isBiosash = (p) => productBrandName(p).toLowerCase() === 'biosash';
const brandOf = (p) => String(p?.brand || productBrandName(p) || '').trim();

/** Live product counts of the partner brands kept in the Fashion / Home & Living catalogue; {} until read. */
function useCatalogueCounts() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let live = true;
    const names = BRANDS.map((b) => b.catalogueBrand).filter(Boolean);
    Promise.all(names.map((n) => supabase.from('catalogue_products').select('id', { count: 'exact', head: true }).eq('brand', n).eq('is_active', true)
      .then(({ count, error }) => [n, error ? null : count], () => [n, null])))
      .then((pairs) => { if (live) setCounts(Object.fromEntries(pairs.filter(([, c]) => Number.isFinite(c)))); });
    return () => { live = false; };
  }, []);
  return counts;
}

export default function Brands() {
  const counts = brandCounts(products, brandOf, useCatalogueCounts());
  usePageMeta({ title: 'Our brands', description: 'The brands you can shop at SORA LIFESTYLE: Biosash, Atomy, Weavers Villa, Leather Factory, Taj Leather and Ansari Fashion.', path: '/brands' });
  return (
    <div className="hx hx-brands">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Our brands</span></nav>
        <h1 className="hx-offers__h">Our brands</h1>
        <p className="hx-offers__lede">The makers we partner with, across wellness, fashion and home. Each one sells here at its own prices.</p>
        <ul className="hx-brands__grid">
          {BRANDS.map((b, i) => {
            const img = brandImage(b, products, isBiosash);
            return (
              <li key={b.id}>
                <Link to={b.page} className="hx-brands__card">
                  <span className={`hx-brands__img${b.imageFrom ? ' is-whole' : ''}`}>
                    {img && <img src={img} alt="" width="600" height="450" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />}
                  </span>
                  <span className="hx-brands__body">
                    <em>{b.store}{counts[b.id] ? ` · ${counts[b.id]} products` : ''}</em>
                    <b>{b.name}</b>
                    <span>{b.text}</span>
                    <i>Shop {b.name} <Icon name="arrowRight" size={14} /></i>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
