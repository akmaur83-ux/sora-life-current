// ============================================================
// CATALOG — normalized product data, swappable at runtime.
//
// Default source: the real Biosash data baked into the JS bundle
// (biosash.js) — exactly as before. If the app successfully fetches
// the live Supabase `products` table at bootstrap (see main.jsx),
// `applyCatalog()` replaces this data with the admin-managed one.
// Every exported name below is a *live binding* (`let`, not `const`),
// so existing imports across the app keep working unchanged either way.
//
// UI components only ever read from this module — never hard-code
// products. Facts (name/price/image) are never fabricated; discounts
// are an explicit Sora Life promo layered on a verified original price.
// ============================================================
import { BIOSASH_PRODUCTS } from './biosash.js';
import { categoryBySlug } from './categories.js';

const DISCOUNT_TIERS = [10, 15, 18, 20];

// ---- turn one "resolved" raw record into the full product shape ----
function normalizeProduct(p) {
  const originalPrice = Number(p.originalPrice) > 0 ? Number(p.originalPrice) : 0;
  const priceVerified = originalPrice > 0;
  const discountPercent = priceVerified ? Number(p.discountPercent) || 0 : 0;
  const salePrice = priceVerified
    ? (p.salePrice != null ? Math.round(Number(p.salePrice)) : Math.round(originalPrice * (1 - discountPercent / 100)))
    : 0;

  const badges = [];
  if (p.isNew) badges.push({ type: 'new', label: 'New' });
  if (p.isBestseller) badges.push({ type: 'best', label: 'Bestseller' });
  if (discountPercent > 0) badges.push({ type: 'sale', label: `${discountPercent}% OFF` });

  return {
    id: p.id,
    // Database surrogate id (products.id). Needed to join priced variants,
    // whose product_id references it — the catalogue `id` is the biosash
    // code ('b82'), which would never match.
    dbId: p.dbId ?? null,
    slug: p.slug,
    name: p.name,
    category: p.category,
    categories: p.categories && p.categories.length ? p.categories : [p.category],
    form: p.form || null,
    originalPrice,
    discountPercent,
    salePrice,
    priceVerified,
    price: priceVerified ? salePrice : originalPrice,
    mrp: originalPrice,
    discountPct: discountPercent,
    currency: '₹',
    onSale: discountPercent > 0,
    image: p.image,
    gallery: p.gallery && p.gallery.length ? p.gallery : [],
    // Structured multi-image gallery (product_media rows). Attached later by
    // applyProductMedia(); empty here so a product with no media rows falls
    // back to its single primary image via productGallery().
    media: Array.isArray(p.media) ? p.media : [],
    permalink: p.permalink || null,
    rating: p.reviewCount > 0 ? p.rating : 0,
    reviewCount: p.reviewCount || 0,
    reviews: [],
    badges,
    flags: [],
    variants: p.variants || null,
    stock: Number.isFinite(p.stock) ? p.stock : (p.inStock ? 40 : 0),
    sortOrder: p.sortOrder || 0,
    shortDescription: p.description
      ? p.description
      : `${categoryBySlug[p.category]?.name || 'Sea buckthorn'}${p.form ? ' · ' + p.form : ''}`,
    description: p.description || '',
    ingredients: p.ingredients || [],
    benefits: p.benefits || [],
    usage: p.usage || '',
    isNew: !!p.isNew,
    isBestseller: !!p.isBestseller,
    isFeatured: !!p.isFeatured,
  };
}

// ---- default/fallback seed: the real Biosash bundle, same discount-tier
//      assignment as before (deterministic per id) ----
function seedFromBiosash() {
  return BIOSASH_PRODUCTS.map((p, i) => {
    const originalPrice = Number(p.price) > 0 ? Number(p.price) : 0;
    const idNum = parseInt(String(p.id).replace(/\D/g, ''), 10) || i;
    const discountPercent = originalPrice > 0 ? DISCOUNT_TIERS[idNum % DISCOUNT_TIERS.length] : 0;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      categories: p.categories || [p.category],
      form: p.form || null,
      originalPrice,
      discountPercent,
      image: p.image,
      gallery: p.gallery,
      permalink: p.permalink,
      rating: p.rating || 0,
      reviewCount: p.reviewCount || 0,
      inStock: p.inStock,
      variants: p.variants || null,
      description: '',
    };
  });
}

// ---- build derived indices from a resolved-raw list ----
function buildCatalog(rawList) {
  const list = rawList.map(normalizeProduct).sort((a, b) => (a.sortOrder - b.sortOrder) || 0);
  const byCat = {};
  list.forEach((p) => { (byCat[p.category] ||= []).push(p.id); });
  list.forEach((p) => {
    const same = (byCat[p.category] || []).filter((id) => id !== p.id);
    const others = list.filter((o) => o.category !== p.category).map((o) => o.id);
    p.relatedIds = [...same, ...others].slice(0, 6);
  });
  return {
    products: list,
    productBySlug: Object.fromEntries(list.map((p) => [p.slug, p])),
    productById: Object.fromEntries(list.map((p) => [p.id, p])),
  };
}

const initial = buildCatalog(seedFromBiosash());
export let products = initial.products;
export let productBySlug = initial.productBySlug;
export let productById = initial.productById;
export let catalogSource = 'static'; // 'static' | 'supabase'

/**
 * Replace the live catalog (called once at app bootstrap after a
 * successful Supabase fetch). `rawList` items use the same "resolved"
 * shape as normalizeProduct() expects.
 */
// Bumped whenever the catalogue or its variants are replaced. Consumers that
// memoise data derived from products (e.g. priced cart lines) include this in
// their dependencies so they recompute once the async Supabase data lands.
let catalogVersion = 0;
export function getCatalogVersion() { return catalogVersion; }

// True once the authoritative Supabase catalogue has replaced the bundled seed.
// Lets product routes tell "still hydrating" apart from a genuine 404.
export function isCatalogHydrated() { return catalogSource === 'supabase'; }

// Pure view decision for a product route, kept out of the component so it is
// unit-testable without a DOM. `found` = the slug resolved to a product;
// `settled` = the catalogue has hydrated OR a safety timeout has elapsed.
//   found            -> 'product'
//   !found & settled  -> 'notfound'   (catalogue is in; slug really is unknown)
//   !found & !settled -> 'loading'    (catalogue still landing; don't flash 404)
export function productRouteState(found, settled) {
  if (found) return 'product';
  return settled ? 'notfound' : 'loading';
}

export function applyCatalog(rawList, source = 'supabase') {
  if (!Array.isArray(rawList) || rawList.length === 0) return false;

  // The products table has no variants column, so a Supabase row carries
  // `variants: undefined` and would wipe the pack sizes the bundled catalogue
  // knows about. Carry those labels across by slug. They stay display-only
  // (no price) until real priced rows arrive via applyVariants().
  const staticVariantsBySlug = new Map();
  for (const p of BIOSASH_PRODUCTS) {
    if (p.slug && Array.isArray(p.variants) && p.variants.length) {
      staticVariantsBySlug.set(p.slug, p.variants);
    }
  }
  const merged = rawList.map((row) => (
    (!row.variants || !row.variants.length) && staticVariantsBySlug.has(row.slug)
      ? { ...row, variants: staticVariantsBySlug.get(row.slug) }
      : row
  ));

  const built = buildCatalog(merged);
  products = built.products;
  productBySlug = built.productBySlug;
  productById = built.productById;
  catalogSource = source;
  priceRange = getPriceRange();
  catalogVersion += 1;
  return true;
}

export function getByCategory(slug) {
  return products.filter((p) => (p.categories || [p.category]).includes(slug));
}
export function categoryCount(slug) { return getByCategory(slug).length; }

function inStock(list) { return list.filter((p) => p.stock > 0); }

export function getBestsellers(n = 12) {
  const flagged = inStock(products).filter((p) => p.isBestseller);
  if (flagged.length >= n) return flagged.slice(0, n);
  const picks = [...flagged];
  const used = new Set(picks.map((p) => p.id));
  const byCat = {};
  inStock(products).forEach((p) => { (byCat[p.category] ||= []).push(p); });
  for (const cat of Object.keys(byCat)) {
    const first = byCat[cat][0];
    if (first && !used.has(first.id)) { picks.push(first); used.add(first.id); }
  }
  for (const p of inStock(products)) { if (picks.length >= n) break; if (!used.has(p.id)) { picks.push(p); used.add(p.id); } }
  return picks.slice(0, n);
}
export function getNewArrivals(n = 8) {
  const flagged = inStock(products).filter((p) => p.isNew);
  if (flagged.length >= n) return flagged.slice(0, n);
  const rest = inStock([...products].sort((a, b) => Number(String(b.id).replace(/\D/g, '')) - Number(String(a.id).replace(/\D/g, ''))));
  const used = new Set(flagged.map((p) => p.id));
  const picks = [...flagged];
  for (const p of rest) { if (picks.length >= n) break; if (!used.has(p.id)) { picks.push(p); used.add(p.id); } }
  return picks.slice(0, n);
}
export function getFeatured(n = 8) {
  const flagged = inStock(products).filter((p) => p.isFeatured);
  return flagged.length ? flagged.slice(0, n) : getBestsellers(n);
}
export function getRelated(product) {
  return (product.relatedIds || []).map((id) => productById[id]).filter(Boolean);
}

export function searchProducts(q) {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return products.filter((p) =>
    p.name.toLowerCase().includes(t) ||
    (categoryBySlug[p.category]?.name || '').toLowerCase().includes(t) ||
    (p.form || '').toLowerCase().includes(t)
  );
}

export function getPriceRange() {
  if (!products.length) return { min: 0, max: 0 };
  const prices = products.map((p) => p.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
// Back-compat live-binding export (ProductBrowser reads this directly).
export let priceRange = getPriceRange();

/**
 * Attach priced variants (pack sizes) to the in-memory catalogue.
 *
 * Variants are keyed by the products table's numeric id, which the catalogue
 * carries as `dbId`. Products without variants are left exactly as they are,
 * so this is a no-op until variants are configured in admin.
 *
 * Returns true when something changed, so main.jsx can trigger one re-render.
 */
/**
 * Attach structured product media (product_media rows, migration 0016) to the
 * in-memory catalogue, keyed by the products table's numeric id (carried as
 * dbId). Primary-first, then by sort_order. Products with no media rows are
 * left untouched and fall back to their single primary image.
 */
export function applyProductMedia(mediaList) {
  if (!Array.isArray(mediaList) || mediaList.length === 0) return false;
  const byProduct = new Map();
  for (const m of mediaList) {
    if (!m || !m.url) continue;
    const key = String(m.productId);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(m);
  }
  if (byProduct.size === 0) return false;

  let changed = false;
  for (const p of products) {
    const list = byProduct.get(String(p.dbId ?? p.id));
    if (!list || !list.length) continue;
    const sorted = [...list].sort((a, b) =>
      (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || (a.sortOrder - b.sortOrder));
    p.media = sorted.map((m) => ({
      id: m.id, url: m.url, alt: m.alt || p.name, isPrimary: !!m.isPrimary, sortOrder: m.sortOrder,
    }));
    // Keep the single primary image in sync so the grid/cart/wishlist (which
    // read product.image) match the gallery's primary.
    const primary = sorted.find((m) => m.isPrimary) || sorted[0];
    if (primary && primary.url) p.image = primary.url;
    changed = true;
  }
  if (changed) catalogVersion += 1;
  return changed;
}

/**
 * The ordered gallery for a product: its media rows when present, otherwise a
 * one-item fallback built from the single primary image. Never fabricates
 * placeholder tiles. Returns [{ url, alt, isPrimary, sortOrder }].
 */
export function productGallery(product) {
  if (!product) return [];
  if (Array.isArray(product.media) && product.media.length) return product.media;
  if (product.image) return [{ url: product.image, alt: product.name, isPrimary: true, sortOrder: 0 }];
  return [];
}

export function applyVariants(variantList) {
  if (!Array.isArray(variantList) || variantList.length === 0) return false;
  const byProduct = new Map();
  for (const v of variantList) {
    if (v.price == null || !(v.price > 0)) continue; // unpriced variant is not selectable
    const key = String(v.productId);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(v);
  }
  if (byProduct.size === 0) return false;

  let changed = false;
  for (const p of products) {
    const list = byProduct.get(String(p.dbId ?? p.id));
    if (!list || !list.length) continue;
    const sorted = [...list].sort((a, b) => (a.sortOrder - b.sortOrder) || (a.price - b.price));
    p.variants = sorted.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price,
      mrp: v.mrp != null && v.mrp > v.price ? v.mrp : v.price,
      sku: v.sku,
      stock: v.stock,
      image: v.image,
      // Percentage off for this specific pack size.
      discountPct: v.mrp != null && v.mrp > v.price
        ? Math.round(((v.mrp - v.price) / v.mrp) * 100)
        : 0,
    }));
    changed = true;
  }
  if (changed) catalogVersion += 1;
  return changed;
}
