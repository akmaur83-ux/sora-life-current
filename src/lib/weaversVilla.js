import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// Weavers Villa on the wellness homepage (owner, 2026-11-08: "tie-up", their
// whole catalogue now lives in Fashion › Shawls & Stoles and Home & Living ›
// Table Covers). Two pieces:
//
//   * the range — a sliding row of their shawls, stoles and dupattas straight
//     under the Biosash range, the same row type (SlidingRail);
//   * the showcase — their own short films, one tile per kind of piece, each
//     opening that sub-category. The films are copies re-encoded for the web
//     and served from this site (/video/weavers-villa), so the page's
//     media-src stays 'self'.
//
// One read for the range: active fashion rows with brand "Weavers Villa", a
// few columns, the catalogue's own order. The cards then take turns across
// sub-categories so the row is not twelve of one kind. A failed read counts
// as none and the section renders nothing; never padded.
// ============================================================
export const WEAVERS_BRAND = 'Weavers Villa';
export const WEAVERS_RANGE_LIMIT = 12;
export const WEAVERS_LISTING = '/fashion/c/shawls-stoles';

/** The sections' built-in content (Storefronts → Wellness). */
export const WEAVERS_SECTION = Object.freeze({ hidden: false, title: 'Shawls & Stoles by Weavers Villa', more: 'View All', link: '' });
export const WEAVERS_SHOWCASE = Object.freeze({
  hidden: false,
  eyebrow: 'Now on SORA Lifestyle',
  title: 'Weavers Villa',
  text: 'Winter shawls, stoles, phulkari dupattas, mufflers and gift sets: the full Weavers Villa collection.',
  cta: 'Shop the collection',
  link: WEAVERS_LISTING,
});

/** The films, in the order they play along the row, each with where its tile opens. */
export const WEAVERS_FILMS = Object.freeze([
  { id: '0e053f13', label: "Women's Shawls", href: '/fashion/c/womens-shawls' },
  { id: '9530163f', label: "Men's Shawls", href: '/fashion/c/mens-shawls' },
  { id: '4f1440d9', label: 'Dupattas & Phulkari', href: '/fashion/c/dupattas-phulkari' },
  { id: '8a9a44c5', label: 'Stoles', href: '/fashion/c/stoles' },
  { id: '913fba8f', label: 'Embroidered Shawls', href: '/fashion/c/womens-shawls' },
  { id: 'c4953552', label: 'Mufflers & Caps', href: '/fashion/c/mufflers-caps' },
  { id: '1af80d20', label: 'Table Covers', href: '/homeliving/category/table-covers' },
  { id: '283b0a85', label: 'Kullu Shawls', href: '/fashion/c/womens-shawls' },
  { id: '6e5c05cd', label: 'Statement Shawls', href: '/fashion/c/womens-shawls' },
  { id: '8b4ab5ca', label: 'Gift Box Sets', href: '/fashion/c/shawl-gift-sets' },
].map((f) => Object.freeze({ ...f, video: `/video/weavers-villa/${f.id}.mp4`, poster: `/video/weavers-villa/${f.id}.webp` })));

const str = (v) => String(v ?? '').trim();

/** A card-sized copy of a partner picture: their CDN resizes on `width`. */
export const cardImage = (src) => (src ? String(src).replace(/([?&])width=\d+/, '$1width=700') : null);

/** The range's rows; a failed read counts as none. */
export async function fetchWeaversRows(client = supabase, limit = 72) {
  const { data, error } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, category_id, sort_order, created_at')
    .eq('store', 'fashion').eq('brand', WEAVERS_BRAND).eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data;
}

/**
 * The cards: { key, name, href, price, image }. Sub-categories take turns, each
 * keeping the catalogue's order; a row without a slug, a price or a picture is left out.
 */
export function selectWeaversRange(rows = [], limit = WEAVERS_RANGE_LIMIT) {
  const queues = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.store !== 'fashion' || !str(row.slug)) continue;
    const price = cataloguePrice(row);
    const image = Array.isArray(row.images) ? row.images.find(Boolean) : null;
    if (!(price > 0) || !image) continue;
    const k = row.category_id ?? 'none';
    if (!queues.has(k)) queues.set(k, []);
    queues.get(k).push({ key: `fashion-${row.id}`, name: str(row.name), href: `/fashion/p/${row.slug}`, price, image: cardImage(image) });
  }
  const lanes = [...queues.values()];
  const out = [];
  while (out.length < limit && lanes.some((q) => q.length)) {
    for (const q of lanes) if (q.length && out.length < limit) out.push(q.shift());
  }
  return out;
}

/** The range's cards: null until the read answers, then the list. */
export function useWeaversRange(limit = WEAVERS_RANGE_LIMIT) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    fetchWeaversRows(supabase).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);
  return useMemo(() => (rows ? selectWeaversRange(rows, limit) : null), [rows, limit]);
}
