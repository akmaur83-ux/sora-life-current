import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// Winter deals (owner, 2026-11-20: "winter theme ... animation ke sath"). A seasonal
// band at the top of the homepage: one hero deal and four tiles. Every number on it is
// read from the live catalogue — "Up to N% off" is the biggest discount on an item in
// stock in that tile right now, the hero's prices are the product's own — so nothing on
// the band can promise more than the shop gives. A tile with fewer than 2 such items is
// left out; fewer than 3 tiles and the band does not show. Shown 1 Nov to end of Feb.
// ============================================================
export const WINTER_TILES = Object.freeze([
  { id: 'jackets', title: 'Leather jackets', href: '/fashion/winter', slugs: ['mens-leather-jackets', 'womens-leather-jackets'] },
  { id: 'shawls', title: 'Shawls & stoles', href: '/fashion/winter#winter-shawls', slugs: ['womens-shawls', 'mens-shawls', 'stoles'] },
  { id: 'coats', title: 'Leather coats', href: '/fashion/leather#leather-coats', slugs: ['mens-leather-coats', 'womens-leather-coats'] },
  { id: 'caps', title: 'Mufflers & caps', href: '/fashion/winter#winter-caps', slugs: ['mufflers-caps'] },
]);
/** The hero deal comes from the everyday winter pieces, cheapest first. */
const HERO_SLUGS = ['mufflers-caps', 'stoles', 'womens-shawls', 'mens-shawls'];
const ALL_SLUGS = [...new Set([...WINTER_TILES.flatMap((t) => t.slugs), ...HERO_SLUGS])];
export const WINTER_MIN_TILES = 3;
export const HERO_MAX = 8;
export const HERO_EVERY_MS = 1500;

/** Whether the band is in season on this date (India time): November to February. */
export function isWinterSeason(now = Date.now()) {
  const m = Number(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', month: 'numeric' }));
  return m === 11 || m === 12 || m === 1 || m === 2;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const inStock = (r) => {
  const vs = (Array.isArray(r?.variants) ? r.variants : []).filter((v) => v && v.is_active !== false);
  return vs.length ? vs.some((v) => num(v.stock) > 0) : num(r?.stock) > 0;
};
/** Whole-number discount, rounded down so the band never says more than the price does. */
export const offPct = (r) => {
  const mrp = num(r?.mrp); const price = cataloguePrice(r || {});
  return mrp > 0 && price > 0 && price < mrp ? Math.floor((1 - price / mrp) * 100) : 0;
};

/** Rows → { hero, tiles } for the band, or null when there is too little to show. Pure. */
export function winterDeals(rows) {
  const live = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const image = Array.isArray(r?.images) ? r.images.find(Boolean) : null;
    const slug = r?.category?.slug;
    if (!r?.slug || !image || !slug || r.is_demo || !inStock(r) || !(cataloguePrice(r) > 0)) continue;
    live.push({ ...r, cat: slug, image, price: cataloguePrice(r), mrp: num(r.mrp), off: offPct(r) });
  }
  const tiles = WINTER_TILES.map((t) => {
    const items = live.filter((r) => t.slugs.includes(r.cat) && r.off > 0)
      .sort((a, b) => b.off - a.off || num(a.sort_order) - num(b.sort_order));
    return items.length >= 2 ? { ...t, upTo: items[0].off, images: items.slice(0, 3).map((r) => r.image) } : null;
  }).filter(Boolean);
  if (tiles.length < WINTER_MIN_TILES) return null;
  // The hero tile turns through up to HERO_MAX deals (owner, 2026-11-20: "har 1.5 second mein
  // product change"): the cheapest discounted everyday pieces, one picture each, no repeats.
  const seen = new Set();
  const heroes = live.filter((r) => HERO_SLUGS.includes(r.cat) && r.off >= 10)
    .sort((a, b) => a.price - b.price || b.off - a.off)
    .filter((r) => (seen.has(r.image) ? false : (seen.add(r.image), true)))
    .slice(0, HERO_MAX)
    .map((r) => ({ name: r.name, href: `/fashion/p/${r.slug}`, image: r.image, price: r.price, mrp: r.mrp, off: r.off }));
  return { tiles, hero: heroes[0] || null, heroes };
}

/**
 * The band's rows (2026-11-21, speed): from catalogue_deal_rows (0049) — one small row per
 * live product, first picture only, in stock already decided — shaped like the full rows
 * winterDeals() reads. 34 KB instead of 113 KB; the full query stays as the fallback.
 */
export const dealRowToRow = (r) => ({
  slug: r.slug, name: r.name, mrp: r.mrp, sale_price: r.sale_price, sort_order: r.sort_order,
  images: r.image ? [r.image] : [], stock: 1, is_demo: false, category: { slug: r.category_slug },
});
export async function fetchWinterRows(client = supabase) {
  if (!client) return [];
  try {
    const { data, error } = await client.from('catalogue_deal_rows')
      .select('slug, name, mrp, sale_price, sort_order, image, category_slug')
      .eq('store', 'fashion').eq('in_stock', true).in('category_slug', ALL_SLUGS)
      .order('sort_order', { ascending: true }).limit(1200);
    if (!error && Array.isArray(data)) return data.map(dealRowToRow);
  } catch { /* fall back to the full rows */ }
  const { data, error } = await client.from('catalogue_products')
    .select('id, name, slug, mrp, sale_price, images, stock, is_demo, sort_order, category:catalogue_categories!inner(slug), variants:catalogue_variants(stock, is_active)')
    .eq('store', 'fashion').eq('is_active', true).in('category.slug', ALL_SLUGS)
    .order('sort_order', { ascending: true }).limit(1200);
  return error || !Array.isArray(data) ? [] : data;
}

/** The band's data: undefined while loading, null when it should not show. */
// Fetched once per visit (2026-11-21, speed): back to the homepage draws the band at once.
let dealsCache = null;            // { at, value }
let dealsPending = null;
const DEALS_TTL_MS = 5 * 60 * 1000;
function loadDeals() {
  if (dealsCache && Date.now() - dealsCache.at < DEALS_TTL_MS) return Promise.resolve(dealsCache.value);
  if (!dealsPending) {
    dealsPending = fetchWinterRows().then((r) => { const value = winterDeals(r); dealsCache = { at: Date.now(), value }; return value; })
      .finally(() => { dealsPending = null; });
  }
  return dealsPending;
}

export function useWinterDeals(now = Date.now()) {
  const season = isWinterSeason(now);
  const fresh = dealsCache && Date.now() - dealsCache.at < DEALS_TTL_MS ? dealsCache.value : undefined;
  const [deals, setDeals] = useState(season ? fresh : null);
  useEffect(() => {
    if (!season) return undefined;
    let live = true;
    loadDeals().then((v) => { if (live) setDeals(v); }, () => { if (live) setDeals(null); });
    return () => { live = false; };
  }, [season]);
  return deals;
}
