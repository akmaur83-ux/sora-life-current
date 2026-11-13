import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// The Wedding & Festive edit (2026-11-13: new features) — one page, /fashion/wedding,
// putting together what the Fashion store already has for a wedding: the outfits,
// the dupattas and shawls, the bags, the men's jackets, and gifts. Each section is
// its categories' live, in-stock pieces (eight shown), opening the first category
// for the rest. A section with nothing in stock is left out. Prices are the products'.
// ============================================================
export const WEDDING_SECTIONS = Object.freeze([
  { id: 'outfits', title: 'Suits & sarees', note: 'Banarasi silk and cotton suit sets, sarees', slugs: ['suits-dress-materials', 'sarees'] },
  { id: 'drape', title: 'Dupattas, shawls & stoles', note: 'Phulkari, Kullu and embroidered pieces', slugs: ['dupattas-phulkari', 'womens-shawls', 'stoles'] },
  { id: 'bags', title: 'Clutches & handbags', note: 'To carry through the functions', slugs: ['clutches', 'handbags', 'pouches'] },
  { id: 'him', title: 'For him', note: 'Leather jackets and shawls for the winter weddings', slugs: ['mens-leather-jackets', 'mens-shawls'] },
  { id: 'gifts', title: 'Wedding gifting', note: 'Gift-boxed shawls and leather sets', slugs: ['shawl-gift-sets', 'leather-gift-sets'] },
]);
export const WEDDING_PER_SECTION = 8;

const inStock = (r) => {
  const vs = (Array.isArray(r.variants) ? r.variants : []).filter((v) => v && v.is_active !== false);
  return vs.length ? vs.some((v) => Number(v.stock) > 0) : Number(r.stock) > 0;
};

/** Rows → sections of cards; categories inside a section take turns. Pure. */
export function weddingSections(rows, per = WEDDING_PER_SECTION) {
  const bySlug = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const slug = r?.category?.slug;
    const image = Array.isArray(r?.images) ? r.images.find(Boolean) : null;
    const price = cataloguePrice(r || {});
    if (!slug || !r.slug || !image || !(price > 0) || r.is_demo || !inStock(r)) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push({ key: `fashion-${r.id}`, name: String(r.name || '').trim(), href: `/fashion/p/${r.slug}`, image, price });
  }
  return WEDDING_SECTIONS.map((s) => {
    const lanes = s.slugs.map((slug) => bySlug.get(slug) || []);
    const items = [];
    for (let i = 0; items.length < per && lanes.some((l) => l.length > i); i += 1) for (const l of lanes) if (l[i] && items.length < per) items.push(l[i]);
    return { ...s, href: `/fashion/c/${s.slugs[0]}`, items };
  }).filter((s) => s.items.length);
}

export async function fetchWeddingRows(client = supabase) {
  const slugs = WEDDING_SECTIONS.flatMap((s) => s.slugs);
  const { data, error } = await client.from('catalogue_products')
    .select('id, name, slug, mrp, sale_price, images, stock, is_demo, sort_order, category:catalogue_categories!inner(slug), variants:catalogue_variants(stock, is_active)')
    .eq('store', 'fashion').eq('is_active', true).in('category.slug', slugs)
    .order('sort_order', { ascending: true }).limit(600);
  return error || !Array.isArray(data) ? [] : data;
}

export function useWeddingEdit() {
  const [rows, setRows] = useState(null);
  useEffect(() => { let live = true; fetchWeddingRows().then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); }); return () => { live = false; }; }, []);
  return useMemo(() => (rows ? weddingSections(rows) : null), [rows]);
}
