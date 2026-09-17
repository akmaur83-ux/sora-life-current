// ============================================================
// Grocery store — the data layer behind /grocery.
//
// Catalogue rows come from the shared catalogue tables (migration 0034)
// under store = 'grocery': categories from catalogue_categories, products
// from catalogue_products. Rows keep the schema's field names — image_url,
// images[], net_content, mrp, sale_price — so what a component reads is
// what the table holds. The one derived field is `price`: the figure a card
// shows (sale_price when set and below mrp, else mrp), decided here, never
// in a component. The payable amount is always the server's.
//
// Homepage content that is not catalogue — the hero slides, the promo
// strip, the tagline, the delivery window — stays here as plain objects.
// Every word is rendered as HTML text over a photograph.
// ============================================================
import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase.js';

export const GROCERY_STORE = 'grocery';

export const GROCERY_TAGLINE = 'Good food, brighter days';

/** Delivery promise. One string, used by the header badge and the trust strip. */
export const GROCERY_DELIVERY_WINDOW = '6-7 days';

export const HERO_SLIDES = [
  {
    id: 'freshness',
    image: '/img/grocery-hero.webp',
    headline: 'Freshness for a Brighter Everyday',
    sub: 'Staples, snacks, spices & more for your happy home.',
    cta: 'Shop Groceries',
    href: '/grocery/category/everyday-staples',
    note: 'Good food, happier homes',
  },
];

export const DAILY_ESSENTIALS = {
  title: 'Daily essentials',
  sub: 'Good food for a brighter you',
  seeAll: '/grocery/category/everyday-staples',
  limit: 4,
};

export const PROMO = {
  image: '/img/grocery-promo.webp',
  headline: 'Fresh ingredients. Happier meals.',
  sub: 'Quality groceries for every home.',
  cta: 'Shop Fresh',
  href: '/grocery/category/everyday-staples',
};

export const categoryHref = (c) => `/grocery/category/${c.slug}`;

// ---- Row shapes ----------------------------------------------------------------
const CATEGORY_COLUMNS = 'id, store, parent_id, name, slug, tagline, image_url, sort_order, is_active';
const PRODUCT_COLUMNS = 'id, store, name, slug, brand, description, category_id, mrp, sale_price, discount_percent, images, sku, hsn_code, gst_rate, net_content, stock, rating, review_count, is_active, is_new, is_bestseller, sort_order, is_demo';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** The figure a card shows: sale_price when set and below mrp, else mrp. Same rule as fashion.js → productView. */
export const priceOf = (row) => {
  const mrp = num(row?.mrp);
  const sale = row?.sale_price == null ? null : num(row.sale_price);
  return sale != null && sale > 0 && sale < mrp ? sale : mrp;
};

/** A product row for the homepage and the cart: the row as stored, plus `price`. */
export const groceryProductView = (row) => (row ? { ...row, mrp: num(row.mrp), sale_price: row.sale_price == null ? null : num(row.sale_price), price: priceOf(row), images: Array.isArray(row.images) ? row.images.filter(Boolean) : [] } : null);

// ---- Reads -----------------------------------------------------------------------
export async function getGroceryCategories() {
  const { data, error } = await supabase
    .from('catalogue_categories')
    .select(CATEGORY_COLUMNS)
    .eq('store', GROCERY_STORE)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getGroceryProducts() {
  const { data, error } = await supabase
    .from('catalogue_products')
    .select(PRODUCT_COLUMNS)
    .eq('store', GROCERY_STORE)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** The products behind a set of cart lines (any active state — the cart says why a line is blocked). */
export async function getGroceryProductsByIds(ids) {
  const clean = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!clean.length) return [];
  const { data, error } = await supabase
    .from('catalogue_products')
    .select(PRODUCT_COLUMNS)
    .eq('store', GROCERY_STORE)
    .in('id', clean);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ---- The catalogue the pages render ------------------------------------------------
// Loaded once per session and shared by every grocery page; `seed` sets it
// for server rendering and tests. Components subscribe with
// useGroceryCatalogue() and get { status, error, categories, products }.
const EMPTY = Object.freeze({ status: 'loading', error: null, categories: [], products: [] });
let snapshot = EMPTY;
let loading = null;
const listeners = new Set();
const publish = (next) => { snapshot = next; for (const l of listeners) l(); };
const shape = (categories, products) => ({
  categories: (Array.isArray(categories) ? categories : []).filter((c) => c && c.is_active !== false),
  products: (Array.isArray(products) ? products : []).filter((p) => p && p.is_active !== false).map(groceryProductView),
});

export function seedGroceryCatalogue({ categories = [], products = [] } = {}) {
  publish({ status: 'ready', error: null, ...shape(categories, products) });
}
export function resetGroceryCatalogue() { loading = null; publish(EMPTY); }

function loadGroceryCatalogue() {
  if (snapshot.status === 'ready' || loading) return loading;
  loading = Promise.all([getGroceryCategories(), getGroceryProducts()])
    .then(([categories, products]) => publish({ status: 'ready', error: null, ...shape(categories, products) }))
    .catch((e) => { loading = null; publish({ ...snapshot, status: 'error', error: e?.message || 'Could not load the grocery catalogue' }); });
  return loading;
}

const subscribe = (fn) => {
  listeners.add(fn);
  if (snapshot.status === 'loading') loadGroceryCatalogue();
  return () => listeners.delete(fn);
};
const getSnapshot = () => snapshot;

/** { status: 'loading' | 'ready' | 'error', error, categories, products } — categories and products carry the schema's field names. */
export function useGroceryCatalogue() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
/** The same snapshot outside React (server rendering, tests). */
export const getGroceryCatalogue = getSnapshot;
