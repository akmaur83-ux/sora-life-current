import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';
import { viewOf } from './popular.js';

// ============================================================
// "More like what you viewed" (owner, 2026-11-20: more features, round 15). From this
// browser's own recently viewed list (kept in this browser only, PdpOwnerKit.jsx), the
// last few products' categories, and other in-stock products from them that the
// visitor has not opened yet — the categories taking turns. Nothing leaves the
// browser but the product slugs needed to look the categories up. Fewer than four
// cards and the row does not show.
// ============================================================
export const LIKE_MIN = 4;
export const LIKE_MAX = 12;
export const LIKE_SEEDS = 4;

/** The last few product pages viewed, as { store, slug }, newest first, no repeats. Pure. */
export function viewedSeeds(recent, max = LIKE_SEEDS) {
  const out = []; const seen = new Set();
  for (const r of Array.isArray(recent) ? recent : []) {
    const v = viewOf(String(r?.href || '').split('?')[0]);
    if (!v || seen.has(`${v.store}/${v.slug}`)) continue;
    seen.add(`${v.store}/${v.slug}`); out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** Lanes of cards (one per seed category) → one list, lanes taking turns, viewed ones and repeats left out. Pure. */
export function interleave(lanes, exclude = new Set(), max = LIKE_MAX) {
  const out = []; const seen = new Set(exclude);
  for (let i = 0; out.length < max && lanes.some((l) => l.length > i); i += 1) {
    for (const l of lanes) {
      const c = l[i];
      if (c && !seen.has(c.slugKey) && out.length < max) { seen.add(c.slugKey); out.push(c); }
    }
  }
  return out;
}

const inStock = (r) => {
  const vs = (Array.isArray(r.variants) ? r.variants : []).filter((v) => v && v.is_active !== false);
  return vs.length ? vs.some((v) => Number(v.stock) > 0) : Number(r.stock) > 0;
};

/** Wellness lanes: the seed product's category, other in-stock products in it. Pure. */
export function wellnessLanes(seeds, bySlug, all) {
  return seeds.filter((s) => s.store === 'wellness' && bySlug[s.slug]).map((s) => {
    const cat = bySlug[s.slug].category;
    return (all || []).filter((p) => p.category === cat && p.slug && p.image && Number(p.stock) > 0 && Number(p.price) > 0)
      .map((p) => ({ key: `wellness-${p.id}`, slugKey: `wellness/${p.slug}`, name: p.name, href: `/product/${p.slug}`, image: p.image, price: Number(p.price) }));
  });
}

/** Catalogue rows → a lane per seed category, in the seeds' order. Pure. */
export function catalogueLanes(seedRows, rows) {
  const byCat = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const image = Array.isArray(r?.images) ? r.images.find(Boolean) : null;
    const price = cataloguePrice(r || {});
    if (!r?.slug || !image || !(price > 0) || r.is_demo || !inStock(r)) continue;
    if (!byCat.has(r.category_id)) byCat.set(r.category_id, []);
    byCat.get(r.category_id).push({ key: `${r.store}-${r.id}`, slugKey: `${r.store}/${r.slug}`, name: String(r.name || '').trim(), href: r.store === 'fashion' ? `/fashion/p/${r.slug}` : `/homeliving/p/${r.slug}`, image, price });
  }
  const cats = [...new Set((seedRows || []).map((s) => s.category_id).filter(Boolean))];
  return cats.map((c) => byCat.get(c) || []);
}

export async function fetchLikeRows(seeds, client = supabase) {
  const slugs = seeds.filter((s) => s.store !== 'wellness').map((s) => s.slug);
  if (!slugs.length || !client) return { seedRows: [], rows: [] };
  const { data: seedRows } = await client.from('catalogue_products').select('slug, store, category_id').in('slug', slugs);
  const order = new Map(slugs.map((s, i) => [s, i]));
  const sorted = (seedRows || []).sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
  const cats = [...new Set(sorted.map((r) => r.category_id).filter(Boolean))];
  if (!cats.length) return { seedRows: sorted, rows: [] };
  const { data } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, stock, is_demo, category_id, variants:catalogue_variants(stock, is_active)')
    .in('category_id', cats).eq('is_active', true).order('sort_order', { ascending: true }).limit(160);
  return { seedRows: sorted, rows: data || [] };
}

/** The row's cards; [] until known or when fewer than LIKE_MIN. */
export function useViewedLike(recent, bySlug, all) {
  const [cards, setCards] = useState([]);
  const sig = viewedSeeds(recent).map((s) => `${s.store}/${s.slug}`).join('|');
  useEffect(() => {
    let live = true;
    const seeds = viewedSeeds(recent);
    if (!seeds.length) { setCards([]); return undefined; }
    const exclude = new Set((Array.isArray(recent) ? recent : []).map((r) => viewOf(String(r?.href || '').split('?')[0])).filter(Boolean).map((v) => `${v.store}/${v.slug}`));
    fetchLikeRows(seeds).then(({ seedRows, rows }) => {
      if (!live) return;
      const lanes = [...catalogueLanes(seedRows, rows), ...wellnessLanes(seeds, bySlug || {}, all)];
      const list = interleave(lanes, exclude);
      setCards(list.length >= LIKE_MIN ? list : []);
    }, () => { if (live) setCards([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return cards;
}
