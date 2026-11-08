import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { searchItems } from './searchMatch.js';
import { cataloguePrice } from './newArrivals.js';

// ============================================================
// One search across the stores (owner, 2026-11-08: more features). The wellness
// search box and /shop?q= already search the wellness catalogue; this adds the
// Fashion and Home & Living products that match the same words (searchMatch.js),
// so "shawl" or "bedsheet" typed on the main site finds them.
//
// One small read of their active rows (name, brand, category, picture, price),
// made the first time someone searches and shared for the visit. A failed read is
// no extra results, never an error.
// ============================================================
const STORE_LABEL = { fashion: 'Fashion', homeliving: 'Home & Living' };
let rowsPromise = null;

function loadRows(client = supabase) {
  if (!rowsPromise) {
    rowsPromise = Promise.all([
      client.from('catalogue_products').select('id, store, name, slug, brand, images, mrp, sale_price, category_id').in('store', ['fashion', 'homeliving']).eq('is_active', true).order('sort_order', { ascending: true }).limit(2000),
      client.from('catalogue_categories').select('id, name').in('store', ['fashion', 'homeliving']),
    ]).then(([p, c]) => {
      if (p.error || !Array.isArray(p.data)) { rowsPromise = null; return []; }
      const cat = new Map((c.data || []).map((x) => [String(x.id), x.name]));
      return toSearchRows(p.data, cat);
    }, () => { rowsPromise = null; return []; });
  }
  return rowsPromise;
}

/** Catalogue rows as search rows: what a suggestion or a result card shows. */
export function toSearchRows(rows, categoryNames = new Map()) {
  return (rows || []).filter((r) => r && r.slug && STORE_LABEL[r.store]).map((r) => {
    const price = cataloguePrice(r);
    const image = Array.isArray(r.images) ? r.images.find(Boolean) : null;
    return {
      key: `${r.store}-${r.id}`, store: r.store, storeLabel: STORE_LABEL[r.store],
      href: r.store === 'fashion' ? `/fashion/p/${r.slug}` : `/homeliving/p/${r.slug}`,
      name: r.name, brand: r.brand, category: categoryNames.get(String(r.category_id)) || '',
      image: image ? String(image).replace(/([?&])width=\d+/, '$1width=500') : null,
      price, mrp: Number(r.mrp) || 0,
    };
  }).filter((r) => r.price > 0);
}

/** The Fashion and Home & Living matches for `query`: null until loaded (only once `enabled`). */
export function useOtherStoreMatches(query, enabled = true) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!enabled || rows) return undefined;
    let live = true;
    loadRows().then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, [enabled, rows]);
  if (!rows) return null;
  return searchItems(rows, query);
}
