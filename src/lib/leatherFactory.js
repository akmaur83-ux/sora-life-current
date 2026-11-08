import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { selectWeaversRange } from './weaversVilla.js';

// ============================================================
// Leather Factory on the wellness homepage (partner, 2026-11-08): their wallets,
// handbags, belts and bags now live in Fashion › Leather Goods. Two pieces, as for
// Weavers Villa:
//
//   * the range — a sliding row of their pieces, sub-categories taking turns
//     (the same rule as Weavers Villa: selectWeaversRange);
//   * the showcase — a poster band of category tiles, each a packshot served from
//     this site (/img/partners/leather-factory) opening that sub-category.
//
// Their own short films carry wholesale prices and "DM to order" lettering, so
// they are not shown on SORA.
// ============================================================
export const LF_BRAND = 'Leather Factory';
export const LF_LISTING = '/fashion/c/leather-goods';

export const LF_SECTION = Object.freeze({ hidden: false, title: 'Leather Goods by Leather Factory', more: 'View All', link: '' });
export const LF_SHOWCASE = Object.freeze({
  hidden: false,
  eyebrow: 'New on SORA Lifestyle',
  title: 'Leather Factory',
  text: 'Wallets, handbags, belts, card holders and travel bags from a leather goods maker in New Delhi.',
  cta: 'Shop leather goods',
  link: LF_LISTING,
});

export const LF_TILES = Object.freeze([
  ['handbags', 'Handbags'], ['mens-wallets', "Men's Wallets"], ['belts', 'Belts'], ['sling-bags', 'Sling Bags'],
  ['laptop-travel-bags', 'Laptop Bags'], ['clutches', 'Clutches'], ['card-holders', 'Card Holders'],
  ['passport-holders', 'Passport Holders'], ['pouches', 'Pouches'],
].map(([slug, label]) => Object.freeze({ id: slug, label, href: `/fashion/c/${slug}`, image: `/img/partners/leather-factory/${slug}.webp` })));

/** The range's rows: active fashion rows of the brand; a failed read counts as none. */
export async function fetchLeatherRows(client = supabase, limit = 72) {
  const { data, error } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, category_id, sort_order, created_at')
    .eq('store', 'fashion').eq('brand', LF_BRAND).eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data;
}

/** The range's cards (packshots, drawn whole): null until the read answers. */
export function useLeatherRange(limit = 12) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    fetchLeatherRows(supabase).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);
  return useMemo(() => (rows ? selectWeaversRange(rows, limit).map((c) => ({ ...c, whole: true })) : null), [rows, limit]);
}
