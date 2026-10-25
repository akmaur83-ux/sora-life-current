import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { productById, catalogSource, isPurchasable } from '../data/products.js';

// ============================================================
// New arrivals for the wellness homepage: the products flagged new
// (is_new), newest first, from the stores a customer can buy from —
// wellness, fashion and Home & Living; grocery cannot be bought, so it
// is not read. Never padded: with nothing flagged there is no section.
//
// Two small reads of flagged rows only:
//   products            the wellness rows' ids and dates. What a wellness
//                       card shows — its name, picture and price — comes
//                       from the catalogue the site already loaded, so it
//                       matches every other card, and only once that is
//                       the real catalogue (never the bundled stand-in).
//   catalogue_products  the fashion and Home & Living rows with their first
//                       picture (images[0]: the 0034 trigger keeps the
//                       primary shot first) and prices.
// A product that cannot be bought (no payable price) is left out.
// ============================================================
export const NEW_ARRIVALS_LIMIT = 12;

const HREF = {
  wellness: (slug) => `/product/${slug}`,
  fashion: (slug) => `/fashion/p/${slug}`,
  homeliving: (slug) => `/homeliving/p/${slug}`,
};

/** Where "View All" goes when its link is left empty: the listing of the newest arrival's store. */
export const STORE_LISTING = Object.freeze({ wellness: '/shop?sort=new', fashion: '/fashion', homeliving: '/homeliving' });

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const time = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };

/** A fashion or Home & Living card's figure: the sale price when set and below the MRP, else the MRP (as fashion.js and homelivingHomepage.js). */
export const cataloguePrice = (row) => {
  const mrp = num(row?.mrp);
  const sale = row?.sale_price == null ? null : num(row.sale_price);
  return sale != null && sale > 0 && sale < mrp ? sale : mrp;
};

/** The flagged rows, newest first; a read that fails counts as none. */
export async function fetchNewArrivalRows(client = supabase, limit = NEW_ARRIVALS_LIMIT) {
  const [wellness, catalogue] = await Promise.all([
    client.from('products')
      .select('id, biosash_id, created_at')
      .eq('is_active', true).eq('is_new', true)
      .order('created_at', { ascending: false }).limit(limit),
    client.from('catalogue_products')
      .select('id, store, name, slug, mrp, sale_price, images, created_at')
      .eq('is_active', true).eq('is_new', true).in('store', ['fashion', 'homeliving'])
      .order('created_at', { ascending: false }).limit(limit),
  ]);
  return {
    wellness: !wellness.error && Array.isArray(wellness.data) ? wellness.data : [],
    catalogue: !catalogue.error && Array.isArray(catalogue.data) ? catalogue.data : [],
  };
}

/**
 * The cards, newest first across the stores: { key, store, name, href, image, price }.
 * `byId` is the loaded wellness catalogue by id; `realCatalogue` says it is the one read from
 * the database. Wellness rows wait for it; a product without a payable price is left out.
 */
export function selectNewArrivals({ wellness = [], catalogue = [] } = {}, { byId = {}, realCatalogue = false, limit = NEW_ARRIVALS_LIMIT } = {}) {
  const items = [];
  if (realCatalogue) {
    for (const row of wellness) {
      const p = byId[row.biosash_id || row.id];
      if (!p || !p.slug || !isPurchasable(p)) continue;
      items.push({ key: `wellness-${p.id}`, store: 'wellness', name: p.name, href: HREF.wellness(p.slug), image: p.image || null, price: p.price, at: time(row.created_at) });
    }
  }
  for (const row of catalogue) {
    if ((row.store !== 'fashion' && row.store !== 'homeliving') || !row.slug) continue;
    const price = cataloguePrice(row);
    if (!(price > 0)) continue;
    const image = Array.isArray(row.images) ? row.images.find(Boolean) || null : null;
    items.push({ key: `${row.store}-${row.id}`, store: row.store, name: String(row.name || '').trim(), href: HREF[row.store](row.slug), image, price, at: time(row.created_at) });
  }
  return items
    .sort((a, b) => (b.at - a.at) || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map(({ at, ...card }) => card);
}

/** The section's cards: null until the reads answer, then the list (empty when nothing is flagged). */
export function useNewArrivals() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    fetchNewArrivalRows().then(
      (r) => { if (live) setRows(r); },
      () => { if (live) setRows({ wellness: [], catalogue: [] }); },
    );
    return () => { live = false; };
  }, []);
  const real = catalogSource === 'supabase';
  return useMemo(() => (rows ? selectNewArrivals(rows, { byId: productById, realCatalogue: real }) : null), [rows, real, productById]);
}
