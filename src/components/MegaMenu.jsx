import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { categories as wellnessCategories } from '../data/categories.js';
import { products as wellnessProducts } from '../data/products.js';
import { fetchCategoryCovers } from '../lib/insights.js';
import { flatTiles } from '../lib/allCategories.js';

// ============================================================
// The mega menu (owner, 2026-11-13: "store-wise mega menu with images"). On a
// desktop, pointing at Wellness, Fashion or Home & Living in the store bar opens a
// panel of that store's categories, each with a picture (the category's own, else
// its first product's — catalogue_category_covers). Read once, on first open.
// ============================================================
let catalogueCache = null;
async function loadCatalogueCategories() {
  if (catalogueCache) return catalogueCache;
  if (!supabase) return { rows: [], covers: {} };
  const [{ data }, covers] = await Promise.all([
    supabase.from('catalogue_categories').select('id, name, slug, parent_id, store, sort_order, image_url, is_demo').eq('is_active', true).in('store', ['fashion', 'homeliving']).order('sort_order', { ascending: true }),
    fetchCategoryCovers(),
  ]);
  catalogueCache = { rows: (data || []).filter((r) => !r.is_demo), covers };
  return catalogueCache;
}

/** Fashion: roots with their children; a root's picture is its own, else its first child's. Pure. */
export function fashionMenu(rows, covers) {
  const f = (rows || []).filter((r) => r.store === 'fashion');
  const kids = (id) => f.filter((r) => r.parent_id === id);
  const pic = (r) => r.image_url || covers[r.id] || null;
  return f.filter((r) => !r.parent_id).map((r) => {
    const children = kids(r.id).filter((c) => pic(c) || kids(c.id).length);
    const image = pic(r) || children.map(pic).find(Boolean) || null;
    return { id: r.id, name: r.name, href: `/fashion/c/${r.slug}`, image, children: children.slice(0, 7).map((c) => ({ id: c.id, name: c.name, href: `/fashion/c/${c.slug}` })) };
  }).filter((g) => g.image || g.children.length);
}

export default function MegaMenu({ store, onClose }) {
  const [data, setData] = useState(catalogueCache);
  useEffect(() => { if (!data && store !== 'wellness') loadCatalogueCategories().then(setData, () => setData({ rows: [], covers: {} })); }, [store, data]);
  let body = null;
  if (store === 'wellness') {
    const tiles = flatTiles(wellnessCategories, wellnessProducts, { catOf: (p) => p.category, imageOf: (p) => p.image, href: (c) => `/category/${c.slug}`, key: (c) => c.slug }).slice(0, 10);
    body = <ul className="sora-mega__tiles">{tiles.map((t) => <li key={t.key}><Link to={t.href} onClick={onClose}><span className="sora-mega__img is-whole">{t.image && <img src={t.image} alt="" width="120" height="120" loading="lazy" />}</span><b>{t.name}</b></Link></li>)}</ul>;
  } else if (!data) {
    body = <p className="sora-mega__wait">Loading…</p>;
  } else if (store === 'fashion') {
    body = (
      <div className="sora-mega__cols">
        {fashionMenu(data.rows, data.covers).slice(0, 6).map((g) => (
          <div key={g.id} className="sora-mega__col">
            <Link to={g.href} className="sora-mega__head" onClick={onClose}><span className="sora-mega__img">{g.image && <img src={g.image} alt="" width="200" height="140" loading="lazy" />}</span><b>{g.name} <Icon name="chevronRight" size={13} /></b></Link>
            <ul>{g.children.map((c) => <li key={c.id}><Link to={c.href} onClick={onClose}>{c.name}</Link></li>)}</ul>
          </div>
        ))}
      </div>
    );
  } else {
    const hl = (data.rows || []).filter((r) => r.store === 'homeliving');
    body = <ul className="sora-mega__tiles">{hl.map((r) => <li key={r.id}><Link to={`/homeliving/category/${r.slug}`} onClick={onClose}><span className="sora-mega__img">{(r.image_url || data.covers[r.id]) && <img src={r.image_url || data.covers[r.id]} alt="" width="120" height="120" loading="lazy" />}</span><b>{r.name}</b></Link></li>)}</ul>;
  }
  const all = { wellness: ['/shop', 'Shop all wellness'], fashion: ['/fashion', 'Visit the Fashion store'], homeliving: ['/homeliving', 'Visit Home & Living'] }[store];
  return (
    <div className="sora-mega" role="region" aria-label={`${store} categories`}>
      <div className="sora-mega__in">
        {body}
        {all && <Link to={all[0]} className="sora-mega__all" onClick={onClose}>{all[1]} <Icon name="arrowRight" size={14} /></Link>}
      </div>
    </div>
  );
}
