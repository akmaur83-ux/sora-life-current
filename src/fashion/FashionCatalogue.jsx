import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getFashionCategories, getFashionProducts } from '../lib/fashionApi.js';
import { buildTree, productView } from '../lib/fashion.js';

// ============================================================
// The fashion catalogue, loaded once per session and shared by every
// fashion page. `initial` seeds the state for server rendering and tests;
// without it the provider fetches categories and products (with their
// variants) and builds the tree and the card views.
// ============================================================
const Ctx = createContext(null);
let cache = null; // { categories, products } — one fetch per session

function shape(categories, products) {
  const tree = buildTree(categories);
  const views = (Array.isArray(products) ? products : []).filter((p) => p && p.is_active !== false).map((p) => productView(p, p.fashion_variants));
  return {
    tree, views,
    bySlug: new Map(views.map((v) => [v.slug, v])),
    byId: new Map(views.map((v) => [v.id, v])),
  };
}

export function FashionCatalogueProvider({ initial = null, children }) {
  const [state, setState] = useState(() => {
    if (initial) return { status: 'ready', error: null, ...shape(initial.categories, initial.products) };
    if (cache) return { status: 'ready', error: null, ...shape(cache.categories, cache.products) };
    return { status: 'loading', error: null, ...shape([], []) };
  });
  useEffect(() => {
    if (initial || cache) return undefined;
    let alive = true;
    Promise.all([getFashionCategories(), getFashionProducts()])
      .then(([categories, products]) => {
        cache = { categories, products };
        if (alive) setState({ status: 'ready', error: null, ...shape(categories, products) });
      })
      .catch((e) => { if (alive) setState((s) => ({ ...s, status: 'error', error: e?.message || 'Could not load the fashion catalogue' })); });
    return () => { alive = false; };
  }, [initial]);
  const value = useMemo(() => state, [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFashionCatalogue() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFashionCatalogue outside FashionCatalogueProvider');
  return v;
}
