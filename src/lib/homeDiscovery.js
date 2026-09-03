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

/** Products a concern actually resolves to — the same set its link opens. */
export function concernMatches(concern, productList = products) {
  if (concern?.categorySlug) return getByCategory(concern.categorySlug);
  if (!concern?.query) return [];
  const found = searchProducts(concern.query);
  if (!Array.isArray(productList) || productList === products) return found;
  // Tests pass their own catalogue; keep the result inside it.
  const ids = new Set(productList.map((p) => p.id));
  return found.filter((p) => ids.has(p.id));
}

export function concernDestination(concern) {
  return concern?.categorySlug
    ? `/category/${concern.categorySlug}`
    : `/shop?q=${encodeURIComponent(concern.query)}`;
}

/**
 * Concern cards the current catalogue can genuinely support.
 *
 * Returns [] when too few qualify, which hides the section entirely rather
 * than shipping a thin rail of near-empty results.
 */
export function selectConcernCards(productList = products, registry = CONCERNS, images = discoveryImages()) {
  const assigned = images?.concerns || {};
  const cards = registry
    .map((concern) => {
      const matches = concernMatches(concern, productList);
      const groupImage = categoryImage(CONCERN_GROUP_IMAGE[concern.group] || '');
      const image = assigned[concern.id] || groupImage || null;
      return {
        id: concern.id,
        label: concern.label,
        group: concern.group,
        to: concernDestination(concern),
        count: matches.length,
        image,
        imageSource: assigned[concern.id] ? 'admin' : (groupImage ? 'group' : 'product'),
        // Last resort only, when the group has no artwork of its own.
        product: image ? null : firstImaged(matches),
      };
    })
    .filter((card) => card.count >= MIN_CONCERN_PRODUCTS && (card.image || card.product));
  return cards.length >= MIN_CONCERNS_TO_RENDER ? cards : [];
}

export const CONCERN_REGISTRY = CONCERNS;
export const CONCERN_GROUP_SLUGS = CONCERN_GROUP_IMAGE;
