import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { weddingSections } from './weddingEdit.js';

// ============================================================
// More Fashion edits (owner, 2026-11-20: round 12), built the way the Wedding edit is
// (weddingEdit.js): each section is its categories' live, in-stock pieces, the
// categories taking turns, eight shown, "View all" opening the first category. A
// section with nothing in stock is left out; an edit with nothing at all says so.
//   * /fashion/winter  — jackets and coats for him and her, shawls and stoles,
//     mufflers and caps, winter gifting;
//   * /fashion/leather — every leather maker on SORA in one place: jackets, coats,
//     bags, wallets and small leather, belts, gift sets — with the care guide.
// ============================================================
export const FASHION_EDITS = Object.freeze({
  winter: {
    path: '/fashion/winter', eyebrow: 'Winter is here', title: 'The Winter edit',
    lede: 'Leather jackets and coats, shawls, stoles, mufflers and caps — everything warm in the Fashion store, in one place.',
    meta: 'Leather jackets and coats for men and women, shawls, stoles, mufflers and caps, and winter gift sets at SORA LIFESTYLE.',
    sections: [
      { id: 'him', title: 'Jackets & coats for him', note: 'Bikers, bombers and long leather coats', slugs: ['mens-leather-jackets', 'mens-leather-coats'] },
      { id: 'her', title: 'Jackets & coats for her', note: 'Leather jackets and coats for women', slugs: ['womens-leather-jackets', 'womens-leather-coats'] },
      { id: 'shawls', title: 'Shawls & stoles', note: 'Kullu weaves, woven and embroidered pieces', slugs: ['womens-shawls', 'mens-shawls', 'stoles'] },
      { id: 'caps', title: 'Mufflers & caps', note: 'For the cold mornings', slugs: ['mufflers-caps'] },
      { id: 'gifts', title: 'Winter gifting', note: 'Shawls in gift boxes', slugs: ['shawl-gift-sets'] },
    ],
  },
  leather: {
    path: '/fashion/leather', eyebrow: 'The leather store', title: 'Everything leather',
    lede: 'Jackets, coats, bags, wallets and belts from the leather makers on SORA — Taj Leather, Diamond Leather and Leather Factory.',
    meta: 'Leather jackets, coats, bags, wallets, belts and gift sets from Taj Leather, Diamond Leather and Leather Factory at SORA LIFESTYLE.',
    care: true,
    sections: [
      { id: 'jackets', title: 'Leather jackets', note: 'For men and women', slugs: ['mens-leather-jackets', 'womens-leather-jackets'] },
      { id: 'coats', title: 'Leather coats', note: 'Long and three-quarter coats', slugs: ['mens-leather-coats', 'womens-leather-coats'] },
      { id: 'bags', title: 'Bags', note: 'Handbags, slings, laptop and travel bags, clutches', slugs: ['handbags', 'sling-bags', 'laptop-travel-bags', 'clutches', 'pouches'] },
      { id: 'small', title: 'Wallets & small leather', note: 'Wallets, card and passport holders, keychains', slugs: ['mens-wallets', 'card-holders', 'passport-holders', 'keychains'] },
      { id: 'belts', title: 'Belts', note: 'Leather belts', slugs: ['belts'] },
      { id: 'gifts', title: 'Leather gift sets', note: 'Boxed and ready to give', slugs: ['leather-gift-sets'] },
    ],
  },
});

/** Rows → the edit's sections (the Wedding edit's rule, with this edit's sections). Pure. */
export function editSections(rows, edit, per = 8) {
  return weddingSections(rows, per, edit.sections);
}

export async function fetchEditRows(edit, client = supabase) {
  const slugs = edit.sections.flatMap((s) => s.slugs);
  const { data, error } = await client.from('catalogue_products')
    .select('id, name, slug, mrp, sale_price, images, stock, is_demo, sort_order, category:catalogue_categories!inner(slug), variants:catalogue_variants(stock, is_active)')
    .eq('store', 'fashion').eq('is_active', true).in('category.slug', slugs)
    .order('sort_order', { ascending: true }).limit(1200);
  return error || !Array.isArray(data) ? [] : data;
}

export function useFashionEdit(id) {
  const edit = FASHION_EDITS[id];
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true; setRows(null);
    if (!edit) { setRows([]); return undefined; }
    fetchEditRows(edit).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, [edit]);
  return useMemo(() => (rows && edit ? editSections(rows, edit) : null), [rows, edit]);
}
