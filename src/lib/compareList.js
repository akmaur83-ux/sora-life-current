import { useSyncExternalStore } from 'react';

// ============================================================
// The compare list (owner, 2026-11-13: "Compare drawer"). Up to four products from
// one store, picked from their product pages, kept in this browser only. The tray
// (CompareTray.jsx) shows them; /compare lays them side by side.
// ============================================================
export const COMPARE_KEY = 'sora.compare.v1';
export const COMPARE_MAX = 4;
const subs = new Set();
let cache = null;

const read = () => {
  if (cache) return cache;
  try { const v = JSON.parse(window.localStorage.getItem(COMPARE_KEY) || '[]'); cache = Array.isArray(v) ? v.slice(0, COMPARE_MAX) : []; } catch { cache = []; }
  return cache;
};
const write = (list) => {
  cache = list;
  try { window.localStorage.setItem(COMPARE_KEY, JSON.stringify(list)); } catch { /* storage off */ }
  subs.forEach((fn) => fn());
};

/** Add or remove; another store's product starts a fresh list; the oldest drops past four. Pure. */
export function toggleCompare(list, item) {
  const cur = Array.isArray(list) ? list : [];
  if (!item?.key) return cur;
  if (cur.some((x) => x.key === item.key)) return cur.filter((x) => x.key !== item.key);
  const same = cur.filter((x) => x.store === item.store);
  return [...same, item].slice(-COMPARE_MAX);
}

export const compareApi = {
  toggle: (item) => write(toggleCompare(read(), item)),
  remove: (key) => write(read().filter((x) => x.key !== key)),
  clear: () => write([]),
};

const empty = [];
export function useCompareList() {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => (typeof window === 'undefined' ? empty : read()), () => empty);
}
