import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// ============================================================
// Shop insights on the client (owner, 2026-11-13: features 23, 26, 33, 36):
// writes the search log, reads the public aggregates (0043_insights.sql).
// Nothing personal is sent: the search text, the store and the result count.
// ============================================================
const logged = new Set();

/** Search text worth logging: trimmed, collapsed, 1–80 characters. Pure. */
export function cleanQuery(q) {
  const s = String(q || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return s.length >= 1 && s.length <= 80 ? s : '';
}

/** One row per store + query per page load; a failure is silent. */
export function logSearch(store, q, results, client = supabase) {
  const text = cleanQuery(q);
  if (!client || !text || !['wellness', 'fashion', 'homeliving', 'grocery'].includes(store)) return false;
  const key = `${store}|${text}`;
  if (logged.has(key)) return false;
  logged.add(key);
  client.from('search_log').insert({ q: text, store, results: Math.max(0, Math.min(99999, Math.round(Number(results) || 0))) }).then(() => {}, () => {});
  return true;
}

let popularCache = null;
/** Queries people searched at least 3 times in two weeks that found something; [] until known. */
export function usePopularSearches() {
  const [list, setList] = useState(popularCache || []);
  useEffect(() => {
    if (popularCache || !supabase) return undefined;
    let live = true;
    supabase.rpc('popular_searches', { days: 14, max_rows: 8 }).then(({ data }) => {
      popularCache = Array.isArray(data) ? data.map((r) => r.q).filter(Boolean) : [];
      if (live) setList(popularCache);
    }, () => {});
    return () => { live = false; };
  }, []);
  return list;
}

/** A product's daily prices, oldest first: [{ day, price, mrp }]. */
export async function fetchPriceHistory(productId, client = supabase) {
  if (!client || !productId) return [];
  const { data, error } = await client.from('catalogue_price_history').select('recorded_on, price, mrp')
    .eq('product_id', productId).order('recorded_on', { ascending: true }).limit(120);
  if (error || !Array.isArray(data)) return [];
  return data.map((r) => ({ day: r.recorded_on, price: Number(r.price), mrp: r.mrp == null ? null : Number(r.mrp) }));
}

/** The last `days` of a history, and its low, high and whether today is the lowest. Pure. */
export function priceSummary(history, days = 30, today = new Date().toISOString().slice(0, 10)) {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400e3).toISOString().slice(0, 10);
  const pts = (Array.isArray(history) ? history : []).filter((p) => p.day >= from && Number.isFinite(p.price));
  if (pts.length < 2) return null;
  const prices = pts.map((p) => p.price);
  const low = Math.min(...prices); const high = Math.max(...prices); const now = prices[prices.length - 1];
  return { points: pts, low, high, now, isLowest: now === low && high > low, days };
}

let coversCache = null;
/** category id → first product picture (catalogue_category_covers); {} until read. */
export async function fetchCategoryCovers(client = supabase) {
  if (coversCache) return coversCache;
  if (!client) return {};
  const { data } = await client.from('catalogue_category_covers').select('category_id, image');
  coversCache = Object.fromEntries((Array.isArray(data) ? data : []).map((r) => [r.category_id, r.image]));
  return coversCache;
}
