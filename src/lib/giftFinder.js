import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// Gift finder (owner, 2026-11-20: more features, round 13) — /gifts. Who it is for
// × what to spend, over what is live and in stock today:
//   * for her / for him — Fashion categories that make gifts;
//   * for the home — Home & Living;
//   * wellness — the wellness store's own products.
// The budget is the price the shopper pays. Cheapest first within a budget; nothing
// is ranked as "best". A recipient or budget with nothing in it says so.
// ============================================================
export const RECIPIENTS = Object.freeze([
  { id: 'her', label: 'For her', store: 'fashion', slugs: ['womens-shawls', 'stoles', 'dupattas-phulkari', 'handbags', 'clutches', 'sling-bags', 'pouches', 'shawl-gift-sets', 'womens-leather-jackets'] },
  { id: 'him', label: 'For him', store: 'fashion', slugs: ['mens-wallets', 'belts', 'card-holders', 'passport-holders', 'mens-shawls', 'mufflers-caps', 'leather-gift-sets', 'laptop-travel-bags', 'mens-leather-jackets'] },
  { id: 'home', label: 'For the home', store: 'homeliving', slugs: ['table-covers', 'rugs-mats', 'cushion-covers', 'bedsheets', 'quilts-blankets', 'towels'] },
  { id: 'wellness', label: 'Wellness', store: 'wellness', slugs: [] },
]);
export const BUDGETS = Object.freeze([
  { id: 'u1000', label: 'Under ₹1,000', min: 0, max: 999 },
  { id: '1000-2500', label: '₹1,000–2,500', min: 1000, max: 2500 },
  { id: '2500-5000', label: '₹2,500–5,000', min: 2501, max: 5000 },
  { id: '5000', label: 'Above ₹5,000', min: 5001, max: Infinity },
]);
export const GIFT_LIMIT = 24;

const inStock = (r) => {
  const vs = (Array.isArray(r.variants) ? r.variants : []).filter((v) => v && v.is_active !== false);
  return vs.length ? vs.some((v) => Number(v.stock) > 0) : Number(r.stock) > 0;
};

/** Catalogue rows → gift cards { key, name, href, image, price, slug } for a recipient. Pure. */
export function catalogueGifts(rows, recipient) {
  const want = new Set(recipient.slugs);
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const image = Array.isArray(r?.images) ? r.images.find(Boolean) : null;
    const price = cataloguePrice(r || {});
    if (r?.store !== recipient.store || !want.has(r?.category?.slug) || !r.slug || !image || !(price > 0) || r.is_demo || !inStock(r)) continue;
    out.push({ key: `${r.store}-${r.id}`, name: String(r.name || '').trim(), href: r.store === 'fashion' ? `/fashion/p/${r.slug}` : `/homeliving/p/${r.slug}`, image, price, mrp: Number(r.mrp) || null });
  }
  return out;
}

/** Wellness products → gift cards. Pure. */
export function wellnessGifts(products) {
  return (Array.isArray(products) ? products : [])
    .filter((p) => p && p.slug && p.image && Number(p.price) > 0 && Number(p.stock) > 0)
    .map((p) => ({ key: `wellness-${p.id}`, name: p.name, href: `/product/${p.slug}`, image: p.image, price: Number(p.price), mrp: Number(p.mrp) || null }));
}

/** Cards in the budget, cheapest first, at most `limit`. Pure. */
export function inBudget(cards, budget, limit = GIFT_LIMIT) {
  const b = BUDGETS.find((x) => x.id === budget) || null;
  return (Array.isArray(cards) ? cards : [])
    .filter((c) => !b || (c.price >= b.min && c.price <= b.max))
    .sort((a, b2) => a.price - b2.price || a.name.localeCompare(b2.name))
    .slice(0, limit);
}

/** How many cards fall in each budget, for the chips. Pure. */
export const budgetCounts = (cards) => Object.fromEntries(BUDGETS.map((b) => [b.id, (cards || []).filter((c) => c.price >= b.min && c.price <= b.max).length]));

export async function fetchGiftRows(client = supabase) {
  const slugs = RECIPIENTS.flatMap((r) => r.slugs);
  const { data, error } = await client.from('catalogue_products')
    .select('id, store, name, slug, mrp, sale_price, images, stock, is_demo, category:catalogue_categories!inner(slug), variants:catalogue_variants(stock, is_active)')
    .in('store', ['fashion', 'homeliving']).eq('is_active', true).in('category.slug', slugs)
    .order('sort_order', { ascending: true }).limit(2000);
  return error || !Array.isArray(data) ? [] : data;
}

/** All cards for a recipient; null while loading. */
export function useGiftCards(recipientId, wellnessProducts) {
  const [rows, setRows] = useState(null);
  useEffect(() => { let live = true; fetchGiftRows().then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); }); return () => { live = false; }; }, []);
  const recipient = RECIPIENTS.find((r) => r.id === recipientId) || RECIPIENTS[0];
  return useMemo(() => {
    if (recipient.store === 'wellness') return wellnessGifts(wellnessProducts);
    return rows ? catalogueGifts(rows, recipient) : null;
  }, [rows, recipient, wellnessProducts]);
}
