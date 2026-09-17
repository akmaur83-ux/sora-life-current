// ============================================================
// Catalogue rows behind the cart — one cache for every store.
//
// A cart line from the fashion or grocery store carries ids only; to show
// a name and a display price the cart needs the catalogue row. This module
// holds those rows, keyed by store + id, fills them on demand, and tells
// the store (via one version number) when they land so the cart re-prices.
//
// One cache rather than one per store, on purpose: src/lib/store.jsx
// subscribes to a single version (the fashion one, since Phase 2), and a
// grocery row arriving must invalidate the same memo. Nothing here knows a
// column name — the per-store modules (fashionCartLine.js,
// groceryCartLine.js) decide what an entry looks like and how it is priced.
// ============================================================

const rows = new Map();      // `${store}:${id}` → entry (whatever the store module keeps)
const known = new Set();     // keys a fetch has answered for, present or not
const inflight = new Map();  // store → the fetch in progress
const listeners = new Set();
let cacheVersion = 0; // not `version`: the test loader puts React in scope, which has one

export const cacheKey = (store, id) => `${store}:${String(id)}`;
export const getCatalogueCartVersion = () => cacheVersion;
export const subscribeCatalogueCart = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const bumpCatalogueCart = () => { cacheVersion += 1; for (const l of listeners) l(); };

/** A fetch has answered for this store + id — present or gone. */
export const isCatalogueIdResolved = (store, id) => known.has(cacheKey(store, id));
export const catalogueRowFor = (store, id) => rows.get(cacheKey(store, id)) || null;

/** Seed entries directly (tests, SSR, or a page that already holds the rows). */
export function seedCatalogueRows(store, entries) {
  for (const { id, entry } of entries || []) {
    if (id == null) continue;
    rows.set(cacheKey(store, id), entry);
    known.add(cacheKey(store, id));
  }
  bumpCatalogueCart();
}

/** Forget one store's rows (or every store's when none is named). */
export function resetCatalogueCart(store = null) {
  for (const k of [...rows.keys()]) if (store == null || k.startsWith(`${store}:`)) rows.delete(k);
  for (const k of [...known]) if (store == null || k.startsWith(`${store}:`)) known.delete(k);
  if (store == null) inflight.clear(); else inflight.delete(store);
  bumpCatalogueCart();
}

/**
 * Fetch any ids of this store not yet resolved. `fetcher(ids)` returns the
 * rows; `shape(row)` turns one into the entry the store module wants. Safe
 * to call on every render: resolved ids are skipped, one fetch per store
 * runs at a time. A failed fetch (network) leaves the ids unresolved —
 * pending in the cart, never pruned.
 */
export async function ensureCatalogueRows(store, ids, fetcher, shape = (row) => row) {
  const want = [...new Set((ids || []).map(String))].filter((id) => !known.has(cacheKey(store, id)));
  if (!want.length) return;
  if (inflight.has(store)) { await inflight.get(store); return ensureCatalogueRows(store, ids, fetcher, shape); }
  const run = (async () => {
    try {
      const list = await fetcher(want);
      for (const row of Array.isArray(list) ? list : []) if (row?.id != null) rows.set(cacheKey(store, row.id), shape(row));
      // Every id we asked about is now answered: a missing one is gone.
      for (const id of want) known.add(cacheKey(store, id));
    } catch { /* network: the lines stay pending */ }
    finally { inflight.delete(store); bumpCatalogueCart(); }
  })();
  inflight.set(store, run);
  await run;
}
