// ============================================================
// Home & Living wishlist — this browser's saved Home & Living products (owner,
// 2026-11-08: the hearts were inert). The same shape as the fashion list
// (fashionWishlist.js): localStorage, product ids only, read by the header
// count, the hearts on cards and the gallery, and /homeliving/wishlist.
// ============================================================
import { useSyncExternalStore } from 'react';

export const HOMELIVING_WISH_KEY = 'sora.homeliving.wish.v1';
let ids = null;
const listeners = new Set();

function read() {
  if (ids) return ids;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(HOMELIVING_WISH_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    ids = Array.isArray(parsed) ? [...new Set(parsed.map(String))] : [];
  } catch { ids = []; }
  return ids;
}
function write(next) {
  ids = [...new Set(next.map(String))];
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(HOMELIVING_WISH_KEY, JSON.stringify(ids)); } catch { /* private mode */ }
  for (const l of listeners) l();
}

export const homelivingWishlist = {
  get: read,
  has: (id) => read().includes(String(id)),
  toggle: (id) => { const key = String(id); const cur = read(); write(cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]); return !cur.includes(key); },
  remove: (id) => write(read().filter((x) => x !== String(id))),
  clear: () => write([]),
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
};

export function useHomeLivingWishlist() {
  // The server snapshot is the same cache: without localStorage it is empty,
  // and a harness that seeds it renders what it seeded.
  const list = useSyncExternalStore(homelivingWishlist.subscribe, read, read);
  return { ids: list, count: list.length, has: (id) => list.includes(String(id)), toggle: homelivingWishlist.toggle };
}
