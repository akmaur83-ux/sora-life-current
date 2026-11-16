import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { selectWeaversRange } from './weaversVilla.js';

// ============================================================
// Diamond Leather (partner, 2026-11-16: "another tie up"). A Delhi maker of genuine
// leather jackets (Mohammadpur, near Bhikaji Cama Place). Their 21 men's jackets live in
// Fashion › Men › Leather Jackets, sizes S (42) to 2XL (50), each at the price their own
// shop shows for most sizes.
//
//   * the range — a sliding row of their jackets on the Fashion home (the Weavers Villa
//     rule: selectWeaversRange), editable in Storefronts → Wellness (hide, wording, link);
//   * no posters: their site has product shots only, no campaign art.
// Nothing to show renders nothing.
// ============================================================
export const DIAMOND_BRAND = 'Diamond Leather';
export const DIAMOND_LISTING = '/fashion/search?q=diamond%20leather';
export const DIAMOND_RANGE_LIMIT = 12;

export const DIAMOND_SECTION = Object.freeze({ hidden: false, title: 'Leather Jackets by Diamond Leather', more: 'View All', link: '' });

/** The range's rows: active, in-stock fashion rows of the brand; a failed read counts as none. */
export async function fetchDiamondRows(client = supabase, limit = 48) {
  const { data, error } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, category_id, sort_order, created_at')
    .eq('store', 'fashion').eq('brand', DIAMOND_BRAND).eq('is_active', true).gt('stock', 0)
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data;
}

/** The range's cards: null until the read answers. */
export function useDiamondRange(limit = DIAMOND_RANGE_LIMIT) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    fetchDiamondRows(supabase).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);
  return useMemo(() => (rows ? selectWeaversRange(rows, limit) : null), [rows, limit]);
}
