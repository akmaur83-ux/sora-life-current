import { useEffect, useState } from 'react';
import ProductRail from './ProductRail.jsx';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import { supabase } from '../lib/supabase.js';
import { productById } from '../data/products.js';

// ============================================================
// "Order again" (round 35, owner 2026-11-21 — Blinkit/Zepto's buy-again row, SORA's look):
// for a signed-in shopper, the wellness products from their own recent orders that are
// still on sale and in stock, newest first, each with its card's Add / − qty + control.
// Nothing for a guest, nothing when there is nothing to show. Their orders are read under
// RLS ("orders customer read") — only their own rows, only the items column.
// Fashion and Home & Living lines need a size or colour chosen again, so they are left to
// the account page's "Buy it again" for now.
// ============================================================

/** Unique, still-buyable wellness products from orders (newest first), at most `max`. Pure. */
export function orderAgainProducts(orders, byId = productById, max = 12) {
  const out = []; const seen = new Set();
  for (const o of Array.isArray(orders) ? orders : []) {
    if (o?.status === 'cancelled') continue;
    for (const l of Array.isArray(o?.items) ? o.items : []) {
      if (!l || l.catalogue) continue;
      const key = l.biosash_id ?? l.product_id;
      const p = key != null ? byId[key] : null;
      if (!p || seen.has(p.id) || !(Number(p.stock) > 0) || !(Number(p.price) > 0)) continue;
      seen.add(p.id); out.push(p);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export default function OrderAgain() {
  const { session } = useCustomerAuth();
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!session || !supabase) { setItems([]); return undefined; }
    let live = true;
    supabase.from('orders').select('status, items').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (live) setItems(orderAgainProducts(data)); }, () => { if (live) setItems([]); });
    return () => { live = false; };
  }, [session]);
  if (items.length < 2) return null;
  return <ProductRail eyebrow="Welcome back" title="Order again" products={items} link="/account/orders" linkLabel="Your orders" limit={12} />;
}
