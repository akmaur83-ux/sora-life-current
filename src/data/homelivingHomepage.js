// ============================================================
// Home & Living store — the data layer behind /homeliving.
//
// Catalogue rows come from the shared catalogue tables (migration 0034,
// store 'homeliving' since 0035): categories from catalogue_categories,
// products from catalogue_products. Rows keep the schema's field names —
// image_url, images[], net_content, mrp, sale_price — so what a component
// reads is what the table holds. The one derived field is `price`: the
// figure a card shows (sale_price when set and below mrp, else mrp),
// decided here, never in a component. The payable amount is always the
// server's; this store has no cart path yet.
//
// Homepage content that is not catalogue — the hero slide, the trust
// strip, the promo strip, the tagline, the delivery window — stays here as
// plain objects. Every word is rendered as HTML text over a photograph.
// The delivery promise is the one factual claim the store makes:
// "Standard Delivery / 6-7 days". Nothing here says otherwise.
// ============================================================
import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase.js';

export const HOMELIVING_STORE = 'homeliving';

export const HOMELIVING_TAGLINE = 'Comfort for every home';

/** Delivery promise. One string, used by the header badge and the trust strip. */
export const HOMELIVING_DELIVERY_WINDOW = '6-7 days';

export const HERO_SLIDES = [
  {
    id: 'comfort',
    image: '/img/homeliving-hero.webp',
    eyebrow: 'Home & Living',
    headline: 'Comfort Lives Here',
    sub: 'Bedsheets, curtains, cushions, towels and more for a more beautiful home.',
    cta: 'Explore Home Collection',
    href: '/homeliving/category/bedsheets',
    note: 'Better homes, brighter days',
  },
];

/** The four badges under the hero copy. The delivery one is the only factual claim. */
export const TRUST = [
  { icon: 'sparkle', title: 'Premium Fabrics', sub: 'Chosen for touch and wear' },
  { icon: 'shield', title: 'Trusted Quality', sub: 'Checked before it ships' },
  { icon: 'truck', title: 'Standard Delivery', sub: HOMELIVING_DELIVERY_WINDOW },
  { icon: 'home', title: 'For a Happier Home', sub: 'Small details, warmer rooms' },
];

export const CATEGORY_SECTION = {
  eyebrow: 'Explore categories',
  title: 'Everything for a Beautiful Home',
  viewAll: '/homeliving/category/bedsheets',
};

export const FEATURED = {
  title: 'Featured Home Linen',
  sub: 'Soft textures for every room',
  seeAll: '/homeliving/category/bedsheets',
  limit: 4,
};

export const PROMO = {
  image: '/img/homeliving-promo.webp',
  eyebrow: 'Natural fabrics. Timeless homes.',
  headline: 'Bring Home Comfort',
  sub: 'Soft textures. Soothing spaces. A better you.',
  cta: 'Shop Home & Living',
  href: '/homeliving/category/bedsheets',
  badges: [
    { icon: 'leaf', title: 'Natural Fabrics' },
    { icon: 'award', title: 'Long-Lasting Quality' },
    { icon: 'home', title: 'Beautiful Homes, Happier Lives' },
  ],
};

export const categoryHref = (c) => `/homeliving/category/${c.slug}`;

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

/** A product row for the homepage: the row as stored, plus `price`. */
export const homelivingProductView = (row) => (row ? { ...row, mrp: num(row.mrp), sale_price: row.sale_price == null ? null : num(row.sale_price), price: priceOf(row), images: Array.isArray(row.images) ? row.images.filter(Boolean) : [] } : null);

// ---- Reads -----------------------------------------------------------------------
export async function getHomeLivingCategories() {
  const { data, error } = await supabase
    .from('catalogue_categories')
    .select(CATEGORY_COLUMNS)
    .eq('store', HOMELIVING_STORE)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getHomeLivingProducts() {
  const { data, error } = await supabase
    .from('catalogue_products')
    .select(PRODUCT_COLUMNS)
    .eq('store', HOMELIVING_STORE)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ---- The catalogue the pages render ------------------------------------------------
// Loaded once per session and shared by every Home & Living page; `seed`
// sets it for server rendering and tests. Components subscribe with
// useHomeLivingCatalogue() and get { status, error, categories, products }.
const EMPTY = Object.freeze({ status: 'loading', error: null, categories: [], products: [] });
let snapshot = EMPTY;
let loading = null;
const listeners = new Set();
const publish = (next) => { snapshot = next; for (const l of listeners) l(); };
const shape = (categories, products) => ({
  categories: (Array.isArray(categories) ? categories : []).filter((c) => c && c.is_active !== false),
  products: (Array.isArray(products) ? products : []).filter((p) => p && p.is_active !== false).map(homelivingProductView),
});

export function seedHomeLivingCatalogue({ categories = [], products = [] } = {}) {
  publish({ status: 'ready', error: null, ...shape(categories, products) });
}
export function resetHomeLivingCatalogue() { loading = null; publish(EMPTY); }

function loadHomeLivingCatalogue() {
  if (snapshot.status === 'ready' || loading) return loading;
  loading = Promise.all([getHomeLivingCategories(), getHomeLivingProducts()])
    .then(([categories, products]) => publish({ status: 'ready', error: null, ...shape(categories, products) }))
    .catch((e) => { loading = null; publish({ ...snapshot, status: 'error', error: e?.message || 'Could not load the Home & Living catalogue' }); });
  return loading;
}

const subscribe = (fn) => {
  listeners.add(fn);
  if (snapshot.status === 'loading') loadHomeLivingCatalogue();
  return () => listeners.delete(fn);
};
const getSnapshot = () => snapshot;

/** { status: 'loading' | 'ready' | 'error', error, categories, products } — categories and products carry the schema's field names. */
export function useHomeLivingCatalogue() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
/** The same snapshot outside React (server rendering, tests). */
export const getHomeLivingCatalogue = getSnapshot;
