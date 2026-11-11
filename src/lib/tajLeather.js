import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { selectWeaversRange } from './weaversVilla.js';

// ============================================================
// Taj Leather (partner, 2026-11-11: "tie-up"). Their genuine leather jackets and
// coats live in Fashion › Men (Leather Jackets, Leather Coats) and Fashion › Women
// (the same two), their laptop bags in Leather Goods › Laptop & Travel Bags, at Taj
// Leather's own prices.
//
//   * the range — a sliding row of their jackets and coats, sub-categories taking
//     turns (the Weavers Villa rule: selectWeaversRange), cropped toward the top so
//     the model's face stays in frame;
//   * the posters — Taj Leather's own campaign posters ("The Leather Edit", the
//     women's jacket), copies served from this site (/img/partners/taj-leather),
//     each opening its listing. Their shoe and handbag posters are not used: those
//     products are not on SORA.
//
// Shown on the wellness homepage and the Fashion home; editable in Storefronts →
// Wellness (hide, wording, links). Nothing to show renders nothing.
// ============================================================
export const TAJ_BRAND = 'Taj Leather';
// Their range sits in Men's and Women's (2026-11-11: the departments show it), so "all of it" is the brand's search.
export const TAJ_LISTING = '/fashion/search?q=taj%20leather';
export const TAJ_RANGE_LIMIT = 12;

export const TAJ_SECTION = Object.freeze({ hidden: false, title: 'Leather Jackets by Taj Leather', more: 'View All', link: '' });
export const TAJ_POSTERS_SECTION = Object.freeze({ hidden: false, eyebrow: 'New on SORA Lifestyle', title: 'Taj Leather', text: 'Genuine leather jackets and coats for men and women, at Taj Leather’s own prices.', cta: 'Shop leather jackets', link: TAJ_LISTING });

const P = '/img/partners/taj-leather';
export const TAJ_POSTERS = Object.freeze([
  Object.freeze({ id: 'leather-edit', href: '/fashion/c/mens-leather-jackets', alt: 'The Leather Edit: men’s leather jackets by Taj Leather', wide: `${P}/leather-edit-wide.webp`, tall: `${P}/leather-edit-tall.webp` }),
  Object.freeze({ id: 'womens-jacket', href: '/fashion/c/womens-leather-jackets', alt: 'Premium leather jacket: women’s leather jackets by Taj Leather', wide: `${P}/womens-jacket-wide.webp`, tall: null }),
]);

/** The range's rows: active fashion rows of the brand; a failed read counts as none. */
export async function fetchTajRows(client = supabase, limit = 72) {
  const { data, error } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, category_id, sort_order, created_at')
    .eq('store', 'fashion').eq('brand', TAJ_BRAND).eq('is_active', true).gt('stock', 0)
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data;
}

/** The range's cards: null until the read answers. */
export function useTajRange(limit = TAJ_RANGE_LIMIT) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    fetchTajRows(supabase).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);
  // Jackets and coats only: their laptop bags stay in Leather Goods, out of this row.
  return useMemo(() => (rows ? selectWeaversRange(rows.filter((r) => !/laptop|bag\b/i.test(String(r.name || ''))), limit).map((c) => ({ ...c, image: c.image ? String(c.image).replace(/width=\d+/, 'width=700') : c.image })) : null), [rows, limit]);
}
