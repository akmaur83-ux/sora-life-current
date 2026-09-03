import { categories } from '../data/categories.js';
import { products, getByCategory, searchProducts, productGallery } from '../data/products.js';
import { homepage } from './settings.js';
import { safeVisualUrl } from './homepageAppearance.js';

// ============================================================
// HOMEPAGE DISCOVERY — "Shop by category" and "Shop by concerns".
//
// Both rails are built from the LIVE catalogue at render time. Nothing here
// invents a category, a concern, a product count or an image path:
//
//   * a category card appears only for a category that actually holds
//     products, and links to that category's existing route;
//   * a concern card appears only when its destination genuinely returns
//     enough products, and its backing test IS its destination — so the card
//     can never promise a result the linked page does not show.
//
// Concerns are commerce labels ("Acne Care", "Hair Fall Care"), never claims
// of treatment, cure or medical efficacy. A concern the current catalogue
// cannot support is hidden rather than shipped as a dead card.
// ============================================================

// A concern must lead somewhere worth going. Below this it is hidden.
export const MIN_CONCERN_PRODUCTS = 3;
// Fewer than this and the whole concerns rail is not worth a section.
export const MIN_CONCERNS_TO_RENDER = 3;

// Category artwork committed under public/category-images/. Listed explicitly
// because the browser cannot test for a file's existence — an unlisted slug
// falls back to real product imagery instead of a guessed path.
const CATEGORY_IMAGE_SLUGS = new Set([
  'bath-body', 'body-building', 'hair-care', 'juices-drinks', 'mens-care',
  'personal-care', 'skin-care', 'supplements', 'wellness',
]);

function categoryImage(slug) {
  return CATEGORY_IMAGE_SLUGS.has(slug) ? `/public/category-images/${slug}.webp` : null;
}

// A concern is a need, not a product, so its fallback is the owned contextual
// artwork for the area of the range it belongs to — never a product bottle,
// which reads as merchandising rather than discovery. A bottle is only used if
// there is no group artwork at all.
const CONCERN_GROUP_IMAGE = {
  Skin: 'skin-care',
  Hair: 'hair-care',
  Wellness: 'wellness',
  'Personal care': 'personal-care',
};

// ------------------------------------------------------------
// Admin-assigned artwork.
//
// Stored inside the existing `homepage` site_settings row as
//   discovery: { categories: { [slug]: url }, concerns: { [id]: url } }
// so nothing new is provisioned and no migration is needed. Every value is
// put through safeVisualUrl(), the same guard the rest of the homepage
// appearance settings use, so a bad or hostile URL is dropped rather than
// rendered. An unset entry simply falls through to the built-in artwork.
// ------------------------------------------------------------
export function sanitizeDiscoveryImages(raw) {
  const clean = (group) => {
    const out = {};
    const src = raw && typeof raw[group] === 'object' && raw[group] ? raw[group] : {};
    for (const [key, value] of Object.entries(src)) {
      const url = safeVisualUrl(value);
      if (url) out[key] = url;
    }
    return out;
  };
  return { categories: clean('categories'), concerns: clean('concerns') };
}

/** The saved discovery artwork for the current build/session. */
export function discoveryImages(source = homepage) {
  return sanitizeDiscoveryImages(source?.discovery);
}

// ------------------------------------------------------------
// Admin-chosen products per concern.
//
// Stored alongside the artwork, in the same `homepage` site_settings row:
//   discovery: { concernProducts: { [concernId]: [slug, slug, ...] } }
//
// Only the product SLUG is stored. It is the catalogue's stable public key —
// it already names every /product/:slug route — so a mapping keeps working
// when a product is renamed, repriced or restocked. Deliberately no name,
// price or image is copied here: a snapshot of those would go stale silently.
//
// An unknown concern key, a non-slug value, a duplicate or anything past the
// cap is dropped rather than persisted. An empty selection is not stored at
// all, which is exactly how a concern falls back to automatic matching.
// ------------------------------------------------------------
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;
export const MAX_CONCERN_PRODUCTS = 24;

export function sanitizeConcernProducts(raw, registry = CONCERNS) {
  const known = new Set((Array.isArray(registry) ? registry : []).map((c) => c.id));
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (!known.has(key) || !Array.isArray(value)) continue;
    const picked = [];
    const seen = new Set();
    for (const entry of value) {
      if (picked.length >= MAX_CONCERN_PRODUCTS) break;
      if (typeof entry !== 'string') continue;
      const slug = entry.trim();
      if (!SLUG_RE.test(slug) || seen.has(slug)) continue;
      seen.add(slug);
      picked.push(slug);
    }
    if (picked.length) out[key] = picked;
  }
  return out;
}

/** The saved concern -> product-slug mapping for the current session. */
export function discoveryConcernProducts(source = homepage) {
  return sanitizeConcernProducts(source?.discovery?.concernProducts);
}

/**
 * Catalogue search for the admin's concern picker.
 *
 * Lives here rather than inside the .jsx so the rule that decides what an
 * admin is offered is plain, testable code rather than component internals.
 * Matches on the fields an admin actually types — name, pack size, brand —
 * excludes what is already chosen, and stops at `limit` because a picker is
 * for finding one product, not for browsing the catalogue.
 */
export function searchCatalogueForPicker(catalogue, term, { exclude = [], limit = 8 } = {}) {
  const t = String(term || '').trim().toLowerCase();
  if (!t) return [];
  const chosen = new Set(exclude);
  const hits = [];
  for (const p of Array.isArray(catalogue) ? catalogue : []) {
    if (hits.length >= limit) break;
    if (!p?.slug || chosen.has(p.slug)) continue;
    if (`${p.name || ''} ${p.form || ''} ${p.brand || ''}`.toLowerCase().includes(t)) hits.push(p);
  }
  return hits;
}

/**
 * Resolve stored slugs against the live catalogue, in the admin's order.
 *
 * A slug that no longer resolves, or resolves to a deactivated product, is
 * skipped silently — a stale mapping can thin a concern out but can never
 * put a dead card or a missing product on the page. Stock is deliberately
 * NOT filtered here, so a concern lists exactly what the rest of Shop lists
 * (the "In stock only" filter still applies on top, as everywhere else).
 */
export function resolveConcernProducts(slugs, productList = products) {
  if (!Array.isArray(slugs) || !slugs.length) return [];
  const list = Array.isArray(productList) ? productList : [];
  const bySlug = new Map(list.map((p) => [p?.slug, p]));
  const out = [];
  for (const slug of slugs) {
    const found = bySlug.get(slug);
    if (found && found.isActive !== false) out.push(found);
  }
  return out;
}

/** First product in `list` that has usable artwork, for a card's fallback image. */
function firstImaged(list) {
  return (list || []).find((p) => {
    const gallery = productGallery(p);
    return Array.isArray(gallery) ? gallery.length > 0 : !!p?.image;
  }) || (list || [])[0] || null;
}

/**
 * Category cards for the "Shop by category" rail.
 *
 * Ordered by the catalogue's own category order so admin changes carry
 * through, and skipping any category with nothing to sell.
 */
export function selectCategoryCards(categoryList = categories, productList = products, images = discoveryImages()) {
  const assigned = images?.categories || {};
  const list = Array.isArray(categoryList) ? categoryList : [];
  return list
    .filter((c) => c?.slug && c?.name)
    .map((c) => {
      const inCategory = (Array.isArray(productList) ? productList : [])
        .filter((p) => (p.categories || [p.category]).includes(c.slug));
      return {
        slug: c.slug,
        name: c.name,
        to: `/category/${c.slug}`,
        // Admin artwork wins; the committed category asset is the fallback.
        image: assigned[c.slug] || categoryImage(c.slug),
        imageSource: assigned[c.slug] ? 'admin' : (categoryImage(c.slug) ? 'asset' : 'product'),
        fallbackProduct: firstImaged(inCategory),
        count: inCategory.length,
      };
    })
    .filter((card) => card.count > 0 && (card.image || card.fallbackProduct));
}

// ------------------------------------------------------------
// Concern registry.
//
// `query` is BOTH the backing test and the destination, so a card's promise
// and the page it opens can never drift apart. Category-shaped entries use
// `categorySlug` instead and link to that category.
//
// Entries the current catalogue cannot back are filtered out at render time,
// so this list can safely describe more of the range than any one catalogue
// holds — the richer the catalogue, the more of it lights up.
// ------------------------------------------------------------
const CONCERNS = [
  // Skin
  { id: 'acne', label: 'Acne Care', group: 'Skin', query: 'acne' },
  { id: 'brightening', label: 'Brightening', group: 'Skin', query: 'brightening' },
  { id: 'detan', label: 'De-Tan Care', group: 'Skin', query: 'detan' },
  { id: 'dry-skin', label: 'Dry Skin Care', group: 'Skin', query: 'moisturiser' },
  { id: 'face-care', label: 'Face Care', group: 'Skin', query: 'face' },
  { id: 'scrubs', label: 'Scrub & Polish', group: 'Skin', query: 'scrub' },
  // Hair
  { id: 'hair-fall', label: 'Hair Fall Care', group: 'Hair', query: 'hair fall' },
  { id: 'dandruff', label: 'Dandruff Care', group: 'Hair', query: 'dandruff' },
  { id: 'hair-oils', label: 'Hair Oils', group: 'Hair', query: 'hair oil' },
  { id: 'shampoo', label: 'Shampoo & Wash', group: 'Hair', query: 'shampoo' },
  // Wellness
  { id: 'immunity', label: 'Immunity Support', group: 'Wellness', query: 'immunity' },
  { id: 'vitamins', label: 'Daily Vitamins', group: 'Wellness', query: 'vitamin' },
  { id: 'digestion', label: 'Digestive Wellness', group: 'Wellness', query: 'digestive' },
  { id: 'strength', label: 'Strength & Fitness', group: 'Wellness', query: 'protein' },
  { id: 'herbal', label: 'Herbal & Ayurvedic', group: 'Wellness', query: 'tulsi' },
  // Personal care
  { id: 'intimate', label: 'Intimate Care', group: 'Personal care', query: 'intimate' },
  { id: 'grooming', label: "Men's Grooming", group: 'Personal care', query: 'beard' },
  { id: 'soaps', label: 'Soaps & Bathing', group: 'Personal care', query: 'soap' },
  { id: 'massage', label: 'Massage & Body Oils', group: 'Personal care', query: 'massage' },
];

/**
 * Products a concern actually resolves to — the same set its link opens.
 *
 * Priority, highest first:
 *   1. the products an admin chose for this concern, in their order;
 *   2. the automatic catalogue match (the behaviour that shipped before);
 *   3. nothing, which hides the card.
 *
 * An admin choice therefore replaces the text search rather than being mixed
 * into it: "show exactly these four" has to mean exactly those four.
 */
export function concernMatches(concern, productList = products, manual = discoveryConcernProducts()) {
  const chosen = resolveConcernProducts(manual?.[concern?.id], productList);
  if (chosen.length) return chosen;
  if (concern?.categorySlug) return getByCategory(concern.categorySlug);
  if (!concern?.query) return [];
  const found = searchProducts(concern.query);
  if (!Array.isArray(productList) || productList === products) return found;
  // Tests pass their own catalogue; keep the result inside it.
  const ids = new Set(productList.map((p) => p.id));
  return found.filter((p) => ids.has(p.id));
}

/** True when this concern is driven by an explicit admin selection. */
export function concernIsCurated(concern, productList = products, manual = discoveryConcernProducts()) {
  return resolveConcernProducts(manual?.[concern?.id], productList).length > 0;
}

/**
 * A readable alias for a concern, derived from its label ("Acne Care" ->
 * "acne-care"). The registry `id` stays the canonical key — it is what names
 * the saved artwork and the saved product mapping — but /shop accepts this
 * form too, so a hand-typed or shared link reads the way a person expects.
 */
export function concernSlug(concern) {
  return String(concern?.label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Resolve a ?concern= value back to its registry entry. Null when unknown. */
export function findConcern(param, registry = CONCERNS) {
  if (typeof param !== 'string') return null;
  const key = param.trim().toLowerCase();
  if (!key) return null;
  const list = Array.isArray(registry) ? registry : [];
  return list.find((c) => c.id === key) || list.find((c) => concernSlug(c) === key) || null;
}

// One destination for every concern, whether it is curated or automatic, so
// the heading, the count and the grid are produced by one code path.
export function concernDestination(concern) {
  return concern?.categorySlug
    ? `/category/${concern.categorySlug}`
    : `/shop?concern=${encodeURIComponent(concern?.id || '')}`;
}

/**
 * Concern cards the current catalogue can genuinely support.
 *
 * Returns [] when too few qualify, which hides the section entirely rather
 * than shipping a thin rail of near-empty results.
 */
export function selectConcernCards(
  productList = products,
  registry = CONCERNS,
  images = discoveryImages(),
  manual = discoveryConcernProducts(),
) {
  const assigned = images?.concerns || {};
  const cards = registry
    .map((concern) => {
      const curated = resolveConcernProducts(manual?.[concern.id], productList);
      const matches = curated.length ? curated : concernMatches(concern, productList, {});
      const groupImage = categoryImage(CONCERN_GROUP_IMAGE[concern.group] || '');
      const image = assigned[concern.id] || groupImage || null;
      return {
        id: concern.id,
        label: concern.label,
        group: concern.group,
        to: concernDestination(concern),
        count: matches.length,
        source: curated.length ? 'admin' : 'auto',
        image,
        imageSource: assigned[concern.id] ? 'admin' : (groupImage ? 'group' : 'product'),
        // Last resort only, when the group has no artwork of its own.
        product: image ? null : firstImaged(matches),
      };
    })
    // An automatic concern still has to clear the minimum, because nobody
    // vouched for what a text search happened to return. A curated one only
    // has to resolve to something: choosing two products is a decision, not
    // a thin result, and second-guessing it would make the picker a lie.
    .filter((card) => card.count >= (card.source === 'admin' ? 1 : MIN_CONCERN_PRODUCTS)
      && (card.image || card.product));
  return cards.length >= MIN_CONCERNS_TO_RENDER ? cards : [];
}

export const CONCERN_REGISTRY = CONCERNS;
export const CONCERN_GROUP_SLUGS = CONCERN_GROUP_IMAGE;
