import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { products } from '../data/products.js';
import { productBrandName } from '../lib/homeMerchandising.js';
import { BRANDS, brandImage, brandCounts } from '../lib/brands.js';

// ============================================================
// "Our brands" on the homepage (2026-11-13 redesign: one sliding row in place of the
// ten partner sections, one after another). A card per brand — picture, name, what
// they make, how many products — opening the brand's own page (/brands/:id).
// ============================================================
const brandOf = (p) => String(p?.brand || productBrandName(p) || '').trim();

function useCounts() {
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

export default function BrandCarousel() {
  const counts = brandCounts(products, brandOf, useCounts());
  return (
    <section className="hx sora-bc" aria-labelledby="sora-bc-h">
      <div className="hx-wrap">
        <div className="hx-stores__head">
          <h2 className="hx-stores__h" id="sora-bc-h">Shop by brand</h2>
          <Link to="/brands" className="hx-more">All brands <Icon name="arrowRight" size={15} /></Link>
        </div>
        <ul className="sora-bc__row">
          {BRANDS.map((b) => {
            const img = brandImage(b, products, (p) => brandOf(p).toLowerCase() === b.name.toLowerCase());
            return (
              <li key={b.id}>
                <Link to={b.page} className="sora-bc__card">
                  <span className={`sora-bc__img${b.imageFrom ? ' is-whole' : ''}`}>{img && <img src={img} alt="" width="420" height="520" loading="lazy" decoding="async" />}</span>
                  <span className="sora-bc__body">
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
    </section>
  );
}
