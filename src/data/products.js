// ============================================================
// CATALOG — normalized from the real Biosash data (biosash.js).
// UI components read only from here; the same exported API used by
// the placeholder catalog is preserved, so every page keeps working.
// Facts only (name, price, size, category, image). No fabricated
// ratings, reviews, discounts or "bestseller" flags.
// ============================================================
import { BIOSASH_PRODUCTS } from './biosash.js';
import { categoryBySlug } from './categories.js';

// Sora Life promotional discount tiers. The ORIGINAL price is the verified
// official Biosash price; the discount is a Sora Life promo applied on top.
// Assignment is deterministic per product (stable across reloads/pages).
const DISCOUNT_TIERS = [10, 15, 18, 20];

export const products = BIOSASH_PRODUCTS.map((p, i) => {
  // Verified official Biosash price = ORIGINAL PRICE / MRP. Never invented.
  const originalPrice = Number(p.price) > 0 ? Number(p.price) : 0;
  const priceVerified = originalPrice > 0;
  const idNum = parseInt(String(p.id).replace(/\D/g, ''), 10) || i;
  const discountPercent = priceVerified ? DISCOUNT_TIERS[idNum % DISCOUNT_TIERS.length] : 0;
  // salePrice = originalPrice × (1 − discount/100), rounded to whole rupees.
  const salePrice = priceVerified ? Math.round(originalPrice * (1 - discountPercent / 100)) : 0;

  const badges = [];
  if (discountPercent > 0) badges.push({ type: 'sale', label: `${discountPercent}% OFF` });

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,          // primary storefront category
    categories: p.categories || [p.category], // all storefront categories it belongs to
    form: p.form || null,
    // ---- Pricing (single source of truth) ----
    originalPrice,                 // verified official Biosash price (MRP)
    discountPercent,               // Sora Life promo tier (10/15/18/20)
    salePrice,                     // computed selling price
    priceVerified,
    price: priceVerified ? salePrice : originalPrice, // "now" price used everywhere
    mrp: originalPrice,            // struck-through original
    discountPct: discountPercent,  // used by PriceTag/badges
    currency: '₹',
    onSale: discountPercent > 0,
    image: p.image,                // local official image
    gallery: (p.gallery && p.gallery.length ? p.gallery : []),
    permalink: p.permalink,
    rating: p.reviewCount > 0 ? p.rating : 0,
    reviewCount: p.reviewCount || 0,
    reviews: [],                   // none available from source — not fabricated
    badges,
    flags: [],
    variants: p.variants || null,
    stock: p.inStock ? 40 : 0,
    // Optional editorial fields (empty — not invented). Rendered only if present.
    shortDescription: `${categoryBySlug[p.category]?.name || 'Sea buckthorn'}${p.form ? ' · ' + p.form : ''}`,
    description: '',
    ingredients: [],
    benefits: [],
    usage: '',
    isNew: false,
    isBestseller: false,
    isFeatured: false,
  };
});

// relatedIds — same category first, then fill from the rest
const byCat = {};
products.forEach((p) => { (byCat[p.category] ||= []).push(p.id); });
products.forEach((p) => {
  const same = (byCat[p.category] || []).filter((id) => id !== p.id);
  const others = products.filter((o) => o.category !== p.category).map((o) => o.id);
  p.relatedIds = [...same, ...others].slice(0, 6);
});

export const productBySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
export const productById = Object.fromEntries(products.map((p) => [p.id, p]));

// Category membership (a product can live in several storefront categories)
export function getByCategory(slug) {
  return products.filter((p) => (p.categories || [p.category]).includes(slug));
}
export function categoryCount(slug) { return getByCategory(slug).length; }

// Curated selections to populate homepage rails. These pick real, in-stock
// products spread across the catalog — they do NOT tag individual products
// with unverified "bestseller"/"new" claims.
function inStock(list) { return list.filter((p) => p.stock > 0); }
export function getBestsellers(n = 12) {
  // one strong pick per category, then fill — gives a varied, real selection
  const picks = [];
  const used = new Set();
  for (const c of Object.keys(byCat)) {
    const first = inStock(getByCategory(c))[0];
    if (first && !used.has(first.id)) { picks.push(first); used.add(first.id); }
  }
  for (const p of inStock(products)) { if (picks.length >= n) break; if (!used.has(p.id)) { picks.push(p); used.add(p.id); } }
  return picks.slice(0, n);
}
export function getNewArrivals(n = 8) {
  // "New in" = most recently added (highest source id) — real ordering, no label
  return inStock([...products].sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1)))).slice(0, n);
}
export function getFeatured(n = 8) { return getBestsellers(n); }
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

export const priceRange = (() => {
  const prices = products.map((p) => p.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
})();
