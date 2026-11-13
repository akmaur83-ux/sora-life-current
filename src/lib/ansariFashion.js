import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { selectWeaversRange } from './weaversVilla.js';

// ============================================================
// Ansari Fashion, Banaras (partner, 2026-11-13: "tie-up"). Their Banarasi suit sets
// (mostly unstitched, three pieces) and sarees live in Fashion › Women (Suits &
// Dress Materials, Sarees), so the Women page and the saree store show them too.
// Prices are theirs; an M.R.P. more than 60% above the price is not shown.
//
//   * the posters — their three category photographs (copies served from this site,
//     /img/partners/ansari-fashion), each with our own label, opening its listing.
//     Their sale banners ("extra 10% on prepaid" and the like) are not used: those
//     are their store's offers, not SORA's.
//   * the range — a sliding row of their pieces, the two categories taking turns.
//
// On the wellness homepage and the Fashion home; editable in Storefronts → Wellness.
// ============================================================
export const ANSARI_BRAND = 'Ansari Fashion';
export const ANSARI_LISTING = '/fashion/search?q=ansari%20fashion';
export const ANSARI_RANGE_LIMIT = 12;

export const ANSARI_SECTION = Object.freeze({ hidden: false, title: 'Banarasi suits & sarees by Ansari Fashion', more: 'View All', link: '' });
export const ANSARI_POSTERS_SECTION = Object.freeze({ hidden: false, eyebrow: 'New on SORA Lifestyle', title: 'Ansari Fashion, Banaras', text: 'Banarasi silk and cotton suit sets, Jamdani weaves and sarees, at Ansari Fashion’s own prices.', cta: 'Shop Ansari Fashion', link: ANSARI_LISTING });

const P = '/img/partners/ansari-fashion';
export const ANSARI_POSTERS = Object.freeze([
  Object.freeze({ id: 'suits', label: 'Suits & Dress Materials', href: '/fashion/c/suits-dress-materials', image: `${P}/suit-sets.webp`, alt: 'A woman in a cream Banarasi suit with a woven dupatta' }),
  Object.freeze({ id: 'banarasi', label: 'Banarasi Silk Suits', href: '/fashion/search?q=banarasi%20silk', image: `${P}/banarasi-suits.webp`, alt: 'A woman in a pink Banarasi silk suit with a zari dupatta' }),
  Object.freeze({ id: 'sarees', label: 'Sarees', href: '/fashion/c/sarees', image: `${P}/sarees.webp`, alt: 'A woman in a Banarasi silk saree' }),
]);

/** The range's rows: active, in-stock fashion rows of the brand; a failed read counts as none. */
export async function fetchAnsariRows(client = supabase, limit = 72) {
  const { data, error } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, category_id, sort_order, created_at')
    .eq('store', 'fashion').eq('brand', ANSARI_BRAND).eq('is_active', true).gt('stock', 0)
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data;
}

/** A card-sized copy of their picture (their CDN resizes on w-…). */
export const ansariCard = (src) => (src ? String(src).replace(/\bw-\d+\b/, 'w-700') : src);

/** The range's cards: null until the read answers. */
export function useAnsariRange(limit = ANSARI_RANGE_LIMIT) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    fetchAnsariRows(supabase).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);
  return useMemo(() => (rows ? selectWeaversRange(rows, limit).map((c) => ({ ...c, image: ansariCard(c.image) })) : null), [rows, limit]);
}
