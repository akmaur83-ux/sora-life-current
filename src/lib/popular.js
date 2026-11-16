import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// "Popular this week" (owner, 2026-11-16: more features, round 9). A product page
// opened in this browser is counted once a day (0046_product_views.sql: the store and
// the slug, nothing personal). The homepage row shows the products opened at least 5
// times in the last 7 days, most first, in stock only; fewer than 4 such products and
// the row does not show at all. No made-up numbers: the counts are never displayed.
// ============================================================
export const POPULAR_MIN_CARDS = 4;
const SEEN_KEY = 'sora.viewed.v1';
const PATHS = [[/^\/product\/([a-z0-9][a-z0-9-]*)\/?$/, 'wellness'], [/^\/fashion\/p\/([a-z0-9][a-z0-9-]*)\/?$/, 'fashion'], [/^\/homeliving\/p\/([a-z0-9][a-z0-9-]*)\/?$/, 'homeliving']];

/** The product page a path is, as { store, slug }, or null. Pure. */
export function viewOf(pathname) {
  for (const [re, store] of PATHS) { const m = re.exec(String(pathname || '')); if (m && m[1].length <= 160) return { store, slug: m[1] }; }
  return null;
}

/** Whether this browser already counted the page today; marks it if not. `day` is YYYY-MM-DD. */
export function firstViewToday(store, slug, day, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  const key = `${store}/${slug}`;
  try {
    const raw = storage ? JSON.parse(storage.getItem(SEEN_KEY) || '{}') : {};
    const seen = raw && raw.day === day && Array.isArray(raw.keys) ? raw.keys : [];
    if (seen.includes(key)) return false;
    if (storage) storage.setItem(SEEN_KEY, JSON.stringify({ day, keys: [...seen, key].slice(-300) }));
    return true;
  } catch { return true; }
}

/** Counts a product page view (once a day per browser). False when not a product page or already counted. */
export function logView(pathname, client = supabase, now = new Date()) {
  const v = viewOf(pathname);
  if (!v || !client) return false;
  if (!firstViewToday(v.store, v.slug, now.toISOString().slice(0, 10))) return false;
  client.from('product_views').insert({ store: v.store, slug: v.slug }).then(() => {}, () => {});
  return true;
}

/**
 * The row's cards, in the order the aggregate gave: wellness from the loaded catalogue
 * (`wellnessBySlug`), fashion and Home & Living from their catalogue rows; anything not
 * found, inactive or out of stock is left out. Pure.
 */
export function popularCards(ranked, wellnessBySlug = {}, catalogueRows = []) {
  const rows = new Map(catalogueRows.map((r) => [`${r.store}/${r.slug}`, r]));
  const out = [];
  for (const { store, slug } of ranked || []) {
    if (store === 'wellness') {
      const p = wellnessBySlug[slug];
      if (p && Number(p.stock) > 0 && p.image) out.push({ key: `wellness-${slug}`, name: p.name, href: `/product/${slug}`, price: Number(p.price), image: p.image });
      continue;
    }
    const r = rows.get(`${store}/${slug}`);
    const image = r && Array.isArray(r.images) ? r.images[0] : null;
    if (r && r.is_active && Number(r.stock) > 0 && image) {
      out.push({ key: `${store}-${slug}`, name: r.name, href: store === 'fashion' ? `/fashion/p/${slug}` : `/homeliving/p/${slug}`, price: cataloguePrice(r), image });
    }
  }
  return out;
}

/** The aggregate and the catalogue rows it names; empty on any failure. */
export async function fetchPopular(client = supabase) {
  if (!client) return { ranked: [], rows: [] };
  const { data, error } = await client.rpc('popular_products', { days: 7, max_rows: 16 });
  if (error || !Array.isArray(data) || !data.length) return { ranked: [], rows: [] };
  const slugs = data.filter((d) => d.store !== 'wellness').map((d) => d.slug);
  if (!slugs.length) return { ranked: data, rows: [] };
  const res = await client.from('catalogue_products').select('store, slug, name, mrp, sale_price, images, stock, is_active').in('slug', slugs);
  return { ranked: data, rows: res.error || !Array.isArray(res.data) ? [] : res.data };
}

/** The homepage row's cards; [] until known, and [] when fewer than POPULAR_MIN_CARDS. */
export function usePopular(wellnessBySlug) {
  const [got, setGot] = useState(null);
  useEffect(() => {
    let live = true;
    fetchPopular().then((r) => { if (live) setGot(r); }, () => { if (live) setGot({ ranked: [], rows: [] }); });
    return () => { live = false; };
  }, []);
  if (!got) return [];
  const cards = popularCards(got.ranked, wellnessBySlug, got.rows);
  return cards.length >= POPULAR_MIN_CARDS ? cards : [];
}
