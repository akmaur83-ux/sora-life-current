// ============================================================
// Lifestyle storefront — the data layer behind /lifestyle.
//
// /lifestyle brings the fashion and Home & Living stores together under
// one roof. It owns no catalogue of its own: the Home & Living categories
// and products come through src/data/homelivingHomepage.js and the fashion
// ones through src/lib/fashionApi.js — the same catalogue_* rows those
// stores render (migration 0034, per-store since 0035). Every section
// links INTO one of the two stores; nothing is sold from here.
//
// Homepage content that is not catalogue — the hero slides, the fashion
// banner, the feature tiles, the promo strip, the tagline — stays here as
// plain objects, and every word of it is rendered as HTML text over a
// photograph. The delivery promise is the one factual claim the page
// makes: "Standard Delivery / 6-7 days" (the Home & Living window).
// Nothing here says otherwise, and nothing here claims a benefit to the
// planet.
// ============================================================
import { useSyncExternalStore } from 'react';
import { HOMELIVING_DELIVERY_WINDOW, getHomeLivingCategories, getHomeLivingProducts, homelivingProductView } from './homelivingHomepage.js';
import { getFashionCategories, getFashionProducts } from '../lib/fashionApi.js';
import { buildTree, productView as fashionProductView } from '../lib/fashion.js';
import { circleArt } from '../fashion/fashionArt.js';

export const LIFESTYLE_TAGLINE = 'Live a better you';

/** Delivery promise. The Home & Living window; the only factual claim on the page. */
export const LIFESTYLE_DELIVERY_WINDOW = HOMELIVING_DELIVERY_WINDOW;

/** Under 1024px the portrait file is chosen; from 1024 the landscape. One media query, shared by every <picture> on the page. */
export const TALL_MEDIA = '(max-width: 1023px)';

/**
 * The hero carousel. Each slide is one scene twice — a 4:5 portrait whose
 * subject sits low (the copy takes the empty upper-left) and a 16:9
 * landscape whose subject sits right (the copy takes the left). With one
 * slide the counter and arrows are not rendered.
 */
export const HERO_SLIDES = [
  {
    id: 'home',
    tall: '/img/doorway-living-tall.webp',
    wide: '/img/doorway-living-wide.webp',
    alt: 'Cream sofa with green cushions and a throw, a wooden coffee table and a jute rug in soft light',
    eyebrow: ['Beautiful spaces', 'Happier days'],
    headline: ['Make Home', 'a Happier Place'],
    sub: 'Home essentials for a calmer, warmer and more you.',
    cta: 'Shop Home & Living',
    href: '/homeliving',
    note: 'Good spaces, better days',
  },
  {
    id: 'bedroom',
    tall: '/img/lifestyle-hero-bedroom-tall.webp',
    wide: '/img/homeliving-hero.webp',
    alt: 'A cane headboard, botanical bedsheets, green cushions and a quilt in a sunlit bedroom',
    eyebrow: ['Bedsheets', 'Quilts & cushions'],
    headline: ['Sleep Softer,', 'Wake Brighter'],
    sub: 'Cotton bedsheets, quilts and cushion covers for calmer rooms.',
    cta: 'Shop Bedsheets',
    href: '/homeliving/category/bedsheets',
    note: 'Rest well, every night',
  },
  {
    id: 'fashion',
    tall: '/img/doorway-fashion-tall.webp',
    wide: '/img/doorway-fashion-wide.webp',
    alt: 'Camel coat and cream turtleneck, seated against a sunlit plaster wall',
    eyebrow: ['Your style', 'Your story'],
    headline: ['Fashion', 'for Everyday'],
    sub: 'Clothing, footwear, bags and more — all in one place.',
    cta: 'Explore Fashion',
    href: '/fashion',
    note: 'Wear what feels you',
  },
];

/** The fashion doorway card between the two category rows. The photo's subject sits right; the copy takes the left. */
export const FASHION_BANNER = {
  image: '/img/doorway-fashion-wide.webp',
  alt: 'Camel coat and cream turtleneck, seated against a sunlit plaster wall',
  eyebrow: ['Your style', 'Your story'],
  headline: ['Fashion', 'for Everyday'],
  sub: 'Clothing, footwear, bags and more — all in one place.',
  cta: 'Explore Fashion',
  href: '/fashion',
  note: 'Wear what feels you',
};

export const HOME_CATEGORIES = { label: 'Shop Home & Living by category', viewAll: '/homeliving' };
export const FASHION_CATEGORIES = { title: 'Shop Fashion Categories', viewAll: '/fashion' };

/** The two feature tiles. Both are facts about what we sell and how it ships. */
export const FEATURES = [
  { icon: 'leaf', title: 'Natural Fabrics', sub: 'Cotton, linen and jute' },
  { icon: 'truck', title: 'Standard Delivery', sub: LIFESTYLE_DELIVERY_WINDOW },
];

export const TRENDING = { title: 'Trending Now', viewAll: '/homeliving', limit: 4 };

export const PROMO = {
  image: '/img/homeliving-promo.webp',
  headline: 'Made for everyday living',
  cta: 'Shop Home & Living',
  href: '/homeliving',
};

// ---- Links into the two stores ---------------------------------------------------
export const homeCategoryHref = (c) => `/homeliving/category/${c.slug}`;
export const fashionCategoryHref = (c) => `/fashion/c/${c.slug}`;
export const productHref = (p) => (p.store === 'fashion' ? `/fashion/p/${p.slug}` : `/homeliving/p/${p.slug}`);

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * The fashion circles, as the fashion homepage draws them: Clothing's
 * children (Men, Women, Kids) then the other roots (Beauty, Footwear,
 * Bags & Accessories), active only, each with its circle art resolved by
 * fashionArt.js (slug art → the row's image_url → the initial letter).
 */
export function fashionCircles(categories) {
  const tree = buildTree(Array.isArray(categories) ? categories : []);
  const clothing = tree.roots.find((r) => r.slug === 'clothing');
  return [...(clothing ? tree.children(clothing.id) : []), ...tree.roots.filter((r) => r !== clothing)]
    .filter((c) => c.is_active !== false)
    .map((c) => ({ id: String(c.id), name: c.name, slug: c.slug, href: fashionCategoryHref(c), art: circleArt(c) }));
}

/**
 * One shape for a product from either store — what the Trending row needs
 * and where it links. Prices are the stores' own rules (fashion.js
 * productView; homelivingHomepage.js homelivingProductView), never
 * recomputed here.
 */
export function lifestyleProductView(row, store) {
  if (!row) return null;
  if (store === 'fashion') {
    const v = fashionProductView(row, row.fashion_variants);
    return { id: `fashion:${v.id}`, store, slug: v.slug, name: v.name, brand: v.brand, image: v.image, mrp: v.mrp, price: v.price, hasDiscount: v.hasDiscount, isBestseller: v.isBestseller, isNew: v.isNew, rating: v.rating, sortOrder: v.sortOrder };
  }
  const v = homelivingProductView(row);
  return { id: `homeliving:${v.id}`, store: 'homeliving', slug: String(v.slug || ''), name: String(v.name || ''), brand: String(v.brand || ''), image: v.gallery[0]?.url || null, mrp: v.mrp, price: v.price, hasDiscount: v.price < v.mrp, isBestseller: v.is_bestseller === true, isNew: v.is_new === true, rating: v.rating, sortOrder: num(v.sort_order) };
}

const rank = (a, b) => (b.isBestseller - a.isBestseller) || (b.isNew - a.isNew) || (b.rating - a.rating) || (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name);

/**
 * Both stores in one row: each store's products ranked on their own —
 * bestsellers, then new arrivals, then the best rated, then the store's own
 * order — and the two lists interleaved (fashion, Home & Living, fashion…)
 * so a row of four always shows both stores while both have something.
 */
export function trendingOf(products, limit = TRENDING.limit) {
  const lists = ['fashion', 'homeliving'].map((store) => products.filter((p) => p && p.store === store && p.slug && p.name).sort(rank));
  const out = [];
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length && out.length < limit) out.push(l[i]);
  }
  return out;
}

// ---- The catalogue the page renders ----------------------------------------------
// Both stores' rows, loaded once per session and shared. `seed` sets it for
// server rendering and tests. Components subscribe with
// useLifestyleCatalogue() and get { status, error, homeCategories,
// fashionCategories, products }.
const EMPTY = Object.freeze({ status: 'loading', error: null, homeCategories: [], fashionCategories: [], products: [] });
let snapshot = EMPTY;
let loading = null;
const listeners = new Set();
const publish = (next) => { snapshot = next; for (const l of listeners) l(); };
const active = (rows) => (Array.isArray(rows) ? rows : []).filter((r) => r && r.is_active !== false);
const shape = ({ homeCategories, homeProducts, fashionCategories, fashionProducts }) => ({
  homeCategories: active(homeCategories),
  fashionCategories: fashionCircles(active(fashionCategories)),
  products: [
    ...active(fashionProducts).map((p) => lifestyleProductView(p, 'fashion')),
    ...active(homeProducts).map((p) => lifestyleProductView(p, 'homeliving')),
  ],
});

export function seedLifestyleCatalogue({ homeCategories = [], homeProducts = [], fashionCategories = [], fashionProducts = [] } = {}) {
  publish({ status: 'ready', error: null, ...shape({ homeCategories, homeProducts, fashionCategories, fashionProducts }) });
}
export function resetLifestyleCatalogue() { loading = null; publish(EMPTY); }

function loadLifestyleCatalogue() {
  if (snapshot.status === 'ready' || loading) return loading;
  loading = Promise.all([getHomeLivingCategories(), getHomeLivingProducts(), getFashionCategories(), getFashionProducts()])
    .then(([homeCategories, homeProducts, fashionCategories, fashionProducts]) => publish({ status: 'ready', error: null, ...shape({ homeCategories, homeProducts, fashionCategories, fashionProducts }) }))
    .catch((e) => { loading = null; publish({ ...snapshot, status: 'error', error: e?.message || 'Could not load the catalogue' }); });
  return loading;
}

const subscribe = (fn) => {
  listeners.add(fn);
  if (snapshot.status === 'loading') loadLifestyleCatalogue();
  return () => listeners.delete(fn);
};
const getSnapshot = () => snapshot;

/** { status: 'loading' | 'ready' | 'error', error, homeCategories, fashionCategories, products } */
export function useLifestyleCatalogue() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
/** The same snapshot outside React (server rendering, tests). */
export const getLifestyleCatalogue = getSnapshot;
