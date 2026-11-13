import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// A brand's own page (/brands/:id, 2026-11-13 redesign). The partner brands kept in
// the Fashion / Home & Living catalogue are read by their brand name; the wellness
// brands (Biosash, Atomy) come from the loaded wellness catalogue. Only what can be
// bought: active, in stock, priced, with a picture. An M.R.P. more than 60% above
// the price is not shown (the partners' rule since their tie-ups).
// ============================================================
export const BRAND_SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'new', label: 'Newest' },
  { id: 'low', label: 'Price: low to high' },
  { id: 'high', label: 'Price: high to low' },
];

const inStock = (r) => {
  const vs = (Array.isArray(r.variants) ? r.variants : []).filter((v) => v && v.is_active !== false);
  return vs.length ? vs.some((v) => Number(v.stock) > 0) : Number(r.stock) > 0;
};
const showMrp = (price, mrp) => mrp > price && (mrp - price) / mrp <= 0.6;

/** Catalogue rows → cards. Pure. */
export function catalogueBrandCards(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap((r, i) => {
    const image = Array.isArray(r?.images) ? r.images.find(Boolean) : null;
    const price = cataloguePrice(r || {});
    if (!r?.slug || !image || !(price > 0) || r.is_demo || !inStock(r) || (r.store !== 'fashion' && r.store !== 'homeliving')) return [];
    const mrp = Number(r.mrp) || 0;
    return [{
      key: `${r.store}-${r.id}`, name: String(r.name || '').trim(), image, price, mrp: showMrp(price, mrp) ? mrp : 0,
      href: r.store === 'fashion' ? `/fashion/p/${r.slug}` : `/homeliving/p/${r.slug}`,
      category: r.category?.name || '', at: Date.parse(r.created_at || '') || 0, order: i,
    }];
  });
}

/** Wellness products of a brand → cards. Pure. */
export function wellnessBrandCards(products, isBrand) {
  return (Array.isArray(products) ? products : []).flatMap((p, i) => {
    if (!p?.slug || !isBrand(p) || !(Number(p.stock) > 0) || !(Number(p.price) > 0) || !p.image) return [];
    const price = Number(p.price); const mrp = Number(p.mrp) || 0;
    return [{ key: `wellness-${p.id}`, name: String(p.name || '').trim(), image: p.image, price, mrp: showMrp(price, mrp) ? mrp : 0, href: `/product/${p.slug}`, category: p.categoryName || p.category || '', at: 0, order: i, whole: true }];
  });
}

/** Filter by category, then sort. Pure. */
export function arrangeBrandCards(cards, { category = '', sort = 'featured' } = {}) {
  const list = category ? cards.filter((c) => c.category === category) : [...cards];
  if (sort === 'low') list.sort((a, b) => a.price - b.price || a.order - b.order);
  else if (sort === 'high') list.sort((a, b) => b.price - a.price || a.order - b.order);
  else if (sort === 'new') list.sort((a, b) => b.at - a.at || a.order - b.order);
  else {
    // Featured: the brand's biggest categories first (a jacket maker opens on jackets), the catalogue's order within.
    const rank = new Map(brandCategories(list).map((c, i) => [c.name, i]));
    list.sort((a, b) => (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99) || a.order - b.order);
  }
  return list;
}

/** The categories present, most products first. Pure. */
export function brandCategories(cards) {
  const n = new Map();
  for (const c of cards) if (c.category) n.set(c.category, (n.get(c.category) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
}

export async function fetchBrandRows(brand, client = supabase) {
  const rows = [];
  for (let from = 0; from < 3000; from += 1000) {
    const { data, error } = await client.from('catalogue_products')
      .select('id, store, name, slug, mrp, sale_price, images, stock, is_demo, created_at, sort_order, category:catalogue_categories(name), variants:catalogue_variants(stock, is_active)')
      .eq('brand', brand).eq('is_active', true).in('store', ['fashion', 'homeliving'])
      .order('sort_order', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
    if (error || !Array.isArray(data)) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/** The brand's cards: null while loading. */
export function useCatalogueBrand(brand) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!brand) { setRows([]); return undefined; }
    let live = true;
    setRows(null);
    fetchBrandRows(brand).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, [brand]);
  return useMemo(() => (rows ? catalogueBrandCards(rows) : null), [rows]);
}
