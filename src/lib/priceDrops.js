import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// ============================================================
// "Price dropped" (owner, 2026-11-20: round 20). The live products whose price today is
// below the highest price recorded for them in the last 30 days (0048's view, over the
// price history 0043 keeps). Read once per visit and shared by every card; a product
// not in the list shows nothing. Never invented: no history, no badge.
// ============================================================
let cache = null; let pending = null;

/** Rows → { productId: amount dropped (₹, whole) }; only real drops of ₹1 or more. Pure. */
export function dropMap(rows) {
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const was = Number(r?.was_price); const now = Number(r?.now_price);
    if (r?.product_id && was > 0 && now > 0 && was - now >= 1) out[r.product_id] = Math.round(was - now);
  }
  return out;
}

export function loadPriceDrops(client = supabase) {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = (client ? client.from('catalogue_price_drops').select('product_id, was_price, now_price').limit(5000) : Promise.resolve({ data: [] }))
      .then(({ data, error }) => { cache = error ? {} : dropMap(data); return cache; }, () => { cache = {}; return cache; });
  }
  return pending;
}

/** How much this product's price fell (₹), or 0. */
export function usePriceDrop(productId) {
  const [drops, setDrops] = useState(cache);
  useEffect(() => { let live = true; if (!cache) loadPriceDrops().then((m) => { if (live) setDrops(m); }); return () => { live = false; }; }, []);
  return (drops && productId && drops[productId]) || 0;
}
