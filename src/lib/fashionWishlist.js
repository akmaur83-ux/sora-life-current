// ============================================================
// Fashion wishlist — this browser's saved fashion products.
//
// Kept apart from the wellness wishlist on purpose: that list is keyed on
// wellness product ids and synced to customer_wishlist, and a fashion id
// dropped into it would render nothing there. This one is local to the
// browser (localStorage), holds fashion product ids only, and is read by
// the fashion header count, the hearts and /fashion/wishlist.
// ============================================================
import { useSyncExternalStore } from 'react';

export const FASHION_WISH_KEY = 'sora.fashion.wish.v1';
let ids = null;
const listeners = new Set();

function read() {
  if (ids) return ids;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FASHION_WISH_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    ids = Array.isArray(parsed) ? [...new Set(parsed.map(String))] : [];
  } catch { ids = []; }
  return ids;
}
function write(next) {
  ids = [...new Set(next.map(String))];
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(FASHION_WISH_KEY, JSON.stringify(ids)); } catch { /* private mode */ }
  for (const l of listeners) l();
}

export const fashionWishlist = {
  get: read,
  has: (id) => read().includes(String(id)),
  toggle: (id) => { const key = String(id); const cur = read(); write(cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]); return !cur.includes(key); },
  remove: (id) => write(read().filter((x) => x !== String(id))),
  clear: () => write([]),
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
};

export function useFashionWishlist() {
  // The server snapshot is the same cache: without localStorage it is empty,
  // and a harness that seeds it renders what it seeded.
  const list = useSyncExternalStore(fashionWishlist.subscribe, read, read);
  return { ids: list, count: list.length, has: (id) => list.includes(String(id)), toggle: fashionWishlist.toggle };
}
