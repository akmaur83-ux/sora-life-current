import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// A category rail for the wellness homepage: the live products of one
// catalogue category (today Home & Living's Beds and Bedsheets), in the
// order the catalogue already puts them in — sort_order, then newest.
//
// Two small reads, the same shape as newArrivals.js:
//   catalogue_categories  the active category with this slug in this store,
//                         for its id alone.
//   catalogue_products    that category's active rows with their first
//                         picture (images[0]: the 0034 trigger keeps the
//                         primary shot first), name, slug and prices.
//
// Never padded: no category, no rows, or nothing buyable — no section. A
// read that fails counts as none, so a homepage never breaks on it.
// ============================================================
export const CATEGORY_RAIL_LIMIT = 12;

const HREF = {
  fashion: (slug) => `/fashion/p/${slug}`,
  homeliving: (slug) => `/homeliving/p/${slug}`,
};

/** Where "View All" goes when its link is left empty: the category's own listing. */
export const categoryListing = (store, slug) => (store === 'fashion' ? `/fashion/${slug}` : `/homeliving/category/${slug}`);

const str = (v) => String(v ?? '').trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const time = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };

/** The active category's id, or null when there is no such category. */
export async function fetchCategoryId(client, store, slug) {
  const { data, error } = await client.from('catalogue_categories')
    .select('id')
    .eq('store', store).eq('slug', str(slug)).eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1);
  if (error || !Array.isArray(data) || !data.length) return null;
  return data[0]?.id ?? null;
}

/** The category's live rows, the catalogue's own order first; a read that fails counts as none. */
export async function fetchCategoryRailRows(client = supabase, { store, slug, limit = CATEGORY_RAIL_LIMIT } = {}) {
  const categoryId = await fetchCategoryId(client, store, slug);
  if (categoryId == null) return [];
  const { data, error } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, sort_order, created_at')
    .eq('store', store).eq('category_id', categoryId).eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data;
}

/**
 * The cards: { key, store, name, href, image, price }, the catalogue's order kept.
 * A row without a slug, without a payable price or from another store is left out.
 */
export function selectCategoryRail(rows = [], { store, limit = CATEGORY_RAIL_LIMIT } = {}) {
  const items = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.store !== store || !HREF[store] || !str(row.slug)) continue;
    const price = cataloguePrice(row);
    if (!(price > 0)) continue;
    const image = Array.isArray(row.images) ? row.images.find(Boolean) || null : null;
    items.push({
      key: `${store}-${row.id}`, store, name: str(row.name),
      href: HREF[store](row.slug), image, price,
      at: num(row.sort_order), newest: time(row.created_at),
    });
  }
  return items
    .sort((a, b) => (a.at - b.at) || (b.newest - a.newest) || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map(({ at, newest, ...card }) => card);
}

/** The rail's cards: null until the reads answer, then the list (empty when the category has none). */
export function useCategoryRail(store, slug, limit = CATEGORY_RAIL_LIMIT) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    setRows(null);
    fetchCategoryRailRows(supabase, { store, slug, limit }).then(
      (r) => { if (live) setRows(r); },
      () => { if (live) setRows([]); },
    );
    return () => { live = false; };
  }, [store, slug, limit]);
  return useMemo(() => (rows ? selectCategoryRail(rows, { store, limit }) : null), [rows, store, limit]);
}
