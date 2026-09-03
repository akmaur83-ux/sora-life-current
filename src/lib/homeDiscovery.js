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

// ============================================================
// DISCOVERY CARDS — the admin-owned model behind both lower rails.
//
// The two lower rails stopped being a view of the catalogue and became
// merchandising an admin composes: a card carries its own display name, its
// own artwork, its own hand-picked products, its own position and its own
// on/off switch. Cards live in the SAME `homepage` site_settings row, as two
// ordered arrays — order in the array IS order on the page.
//
//   discovery.categoryCards = [{ id, name, image, productSlugs[], enabled }]
//   discovery.concernCards  = [{ id, name, group, image, productSlugs[], enabled }]
//
// THE `id` IS THE ONLY STABLE THING. It is generated once from the name and
// never changes again, so renaming a card cannot break its saved artwork, its
// saved products, or a link somebody has already shared.
//
// NOTHING HERE TOUCHES THE CATALOGUE. A card is presentation: deleting one
// removes a tile from the homepage and nothing else. The real categories, the
// real products and the /category/:slug routes are owned by the catalogue and
// are read-only from here — which is also why the round rail under the hero,
// which renders those real categories, is entirely unaffected by this file.
// ============================================================
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const MAX_DISCOVERY_CARDS = 24;
const MAX_CARD_NAME = 60;
const MAX_CARD_GROUP = 40;

/** One line of admin-entered text: no control characters, no runaway length. */
function cleanLine(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Product slugs only — deduped, charset-checked and capped. */
function cleanSlugList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    if (out.length >= MAX_CONCERN_PRODUCTS) break;
    if (typeof entry !== 'string') continue;
    const slug = entry.trim();
    if (!SLUG_RE.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

/**
 * Everything an admin can save about a rail, checked on the way in and on the
 * way out. A card without a usable id or a visible name is not a card, so it
 * is dropped rather than stored as a blank tile.
 */
export function sanitizeDiscoveryCards(raw, { withGroup = false } = {}) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of raw) {
    if (out.length >= MAX_DISCOVERY_CARDS) break;
    if (!entry || typeof entry !== 'object') continue;
    const id = typeof entry.id === 'string' ? entry.id.trim().toLowerCase() : '';
    if (!ID_RE.test(id) || seen.has(id)) continue;
    const name = cleanLine(entry.name, MAX_CARD_NAME);
    if (!name) continue;
    seen.add(id);
    const card = {
      id,
      name,
      image: safeVisualUrl(entry.image) || '',
      productSlugs: cleanSlugList(entry.productSlugs),
      enabled: entry.enabled !== false,
    };
    if (withGroup) card.group = cleanLine(entry.group, MAX_CARD_GROUP);
    out.push(card);
  }
  return out;
}

/**
 * A stable id for a new card, derived from its name.
 *
 * The plain form is used whenever it is free, so ids and the URLs built from
 * them stay readable. A collision appends a short suffix and tries again — an
 * admin never has to invent an id, and never has to resolve a clash by hand.
 */
export function makeDiscoveryId(name, taken = []) {
  const base = cleanLine(name, MAX_CARD_NAME)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  const stem = ID_RE.test(base) ? base : 'card';
  const used = new Set(taken);
  if (!used.has(stem)) return stem;
  for (let i = 0; i < 64; i += 1) {
    const candidate = `${stem}-${Math.random().toString(36).slice(2, 6)}`;
    if (ID_RE.test(candidate) && !used.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now().toString(36)}`;
}

/**
 * Today's built-in rails, expressed as cards.
 *
 * This is the upgrade path: before an admin has saved anything, the rails are
 * these, which is byte-for-byte what they were before cards existed. The
 * saved artwork and the saved concern products are folded in, so nothing an
 * admin already configured is lost when the new shape takes over.
 */
export function defaultCategoryCards(categoryList = categories, images = discoveryImages()) {
  const assigned = images?.categories || {};
  return (Array.isArray(categoryList) ? categoryList : [])
    .filter((c) => c?.slug && c?.name && ID_RE.test(c.slug))
    .map((c) => ({
      id: c.slug, name: c.name, image: assigned[c.slug] || '', productSlugs: [], enabled: true,
    }));
}

export function defaultConcernCards(
  registry = CONCERNS, images = discoveryImages(), manual = discoveryConcernProducts(),
) {
  const assigned = images?.concerns || {};
  return (Array.isArray(registry) ? registry : []).map((c) => ({
    id: c.id,
    name: c.label,
    group: c.group || '',
    image: assigned[c.id] || '',
    productSlugs: Array.isArray(manual?.[c.id]) ? [...manual[c.id]] : [],
    enabled: true,
  }));
}

/**
 * The two card lists for the current settings, whatever shape they are saved
 * in. `*AreCurated` says whether an admin has taken ownership of that rail —
 * the automatic minimums below only police the built-in defaults, never a
 * list somebody deliberately composed.
 */
export function normalizeDiscovery(raw, { categoryList = categories, registry = CONCERNS } = {}) {
  const source = raw === undefined ? homepage?.discovery : raw;
  const images = sanitizeDiscoveryImages(source);
  const manual = sanitizeConcernProducts(source?.concernProducts, registry);
  const savedCategories = sanitizeDiscoveryCards(source?.categoryCards);
  const savedConcerns = sanitizeDiscoveryCards(source?.concernCards, { withGroup: true });
  return {
    categoryCards: savedCategories.length ? savedCategories : defaultCategoryCards(categoryList, images),
    concernCards: savedConcerns.length ? savedConcerns : defaultConcernCards(registry, images, manual),
    categoriesAreCurated: savedCategories.length > 0,
    concernsAreCurated: savedConcerns.length > 0,
  };
}

/**
 * What the admin editor saves back.
 *
 * The cards are authoritative, but the pre-card keys are rewritten from them
 * as a faithful mirror rather than dropped. They are never edited separately,
 * so they cannot drift — and keeping them means a rollback to the previous
 * build still finds every image and every concern mapping where it expects.
 */
export function discoveryPayload(categoryCards, concernCards) {
  const cats = sanitizeDiscoveryCards(categoryCards);
  const cons = sanitizeDiscoveryCards(concernCards, { withGroup: true });
  const categories_ = {};
  const concerns_ = {};
  const concernProducts = {};
  for (const c of cats) if (c.image) categories_[c.id] = c.image;
  for (const c of cons) {
    if (c.image) concerns_[c.id] = c.image;
    if (c.productSlugs.length) concernProducts[c.id] = [...c.productSlugs];
  }
  return {
    categoryCards: cats,
    concernCards: cons,
    categories: categories_,
    concerns: concerns_,
    concernProducts,
  };
}

/**
 * Catalogue search for the admin's product picker.
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

/** The catalogue category a card's id names, if any. Read-only lookup. */
function catalogueCategoryFor(id, categoryList = categories) {
  return (Array.isArray(categoryList) ? categoryList : []).find((c) => c?.slug === id) || null;
}

/** The products behind a category card: hand-picked first, category second. */
export function collectionProducts(card, productList = products, categoryList = categories) {
  if (!card) return [];
  const list = Array.isArray(productList) ? productList : [];
  const curated = resolveConcernProducts(card.productSlugs, list);
  if (curated.length) return curated;
  // An uncurated card whose id names a real category is still just a shortcut
  // to that category — that is what every card was before this existed.
  return catalogueCategoryFor(card.id, categoryList)
    ? list.filter((p) => (p.categories || [p.category]).includes(card.id))
    : [];
}

/** Resolve a ?collection= value. Disabled and unknown ids resolve to null. */
export function findCollectionCard(param, cards) {
  if (typeof param !== 'string') return null;
  const key = param.trim().toLowerCase();
  if (!key) return null;
  const list = Array.isArray(cards) ? cards : normalizeDiscovery().categoryCards;
  return list.find((c) => c.enabled && c.id === key) || null;
}

/**
 * Category cards for the "Shop by category" rail, in the admin's order.
 *
 * A card is dropped when nothing stands behind it, so an empty or misconfigured
 * entry never ships as a dead tile.
 */
export function selectCategoryCards(
  categoryList = categories,
  productList = products,
  images = discoveryImages(),
  savedCards = undefined,
) {
  const saved = sanitizeDiscoveryCards(
    savedCards === undefined ? homepage?.discovery?.categoryCards : savedCards,
  );
  const cards = saved.length ? saved : defaultCategoryCards(categoryList, images);
  return cards
    .filter((card) => card.enabled)
    .map((card) => {
      const backing = collectionProducts(card, productList, categoryList);
      const curated = resolveConcernProducts(card.productSlugs, productList).length > 0;
      const category = catalogueCategoryFor(card.id, categoryList);
      // An uncurated card still carrying its category's own name opens the
      // real category page. Curate it, or rename it, and it opens the curated
      // listing instead — so the heading a customer lands on is always the
      // name they clicked.
      const usesCategoryRoute = !curated && category && category.name === card.name;
      const asset = categoryImage(card.id);
      return {
        id: card.id,
        // `slug` is kept as an alias: it is what the rail and the older tests
        // read, and for every migrated card it is still the category slug.
        slug: card.id,
        name: card.name,
        to: usesCategoryRoute ? `/category/${card.id}` : `/shop?collection=${encodeURIComponent(card.id)}`,
        // Admin artwork wins; the committed category asset is the fallback.
        image: card.image || asset,
        imageSource: card.image ? 'admin' : (asset ? 'asset' : 'product'),
        fallbackProduct: firstImaged(backing),
        count: backing.length,
        source: curated ? 'admin' : 'catalogue',
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
/** The products behind a concern card: hand-picked first, legacy matcher second. */
export function concernCardProducts(card, productList = products, registry = CONCERNS) {
  if (!card) return [];
  const curated = resolveConcernProducts(card.productSlugs, productList);
  if (curated.length) return curated;
  // Only a card that corresponds to a built-in concern has a matcher at all.
  // A concern an admin invented has no text query to fall back on, so it stays
  // empty — and therefore hidden — until products are chosen for it.
  const legacy = (Array.isArray(registry) ? registry : []).find((c) => c.id === card.id);
  return legacy ? concernMatches(legacy, productList, {}) : [];
}

/** Resolve a ?concern= value: card id first, then its readable name form. */
export function findConcernCard(param, cards) {
  if (typeof param !== 'string') return null;
  const key = param.trim().toLowerCase();
  if (!key) return null;
  const list = Array.isArray(cards) ? cards : normalizeDiscovery().concernCards;
  const nameSlug = (c) => String(c?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return list.find((c) => c.enabled && c.id === key)
    || list.find((c) => c.enabled && nameSlug(c) === key)
    || null;
}

export function selectConcernCards(
  productList = products,
  registry = CONCERNS,
  images = discoveryImages(),
  manual = discoveryConcernProducts(),
  savedCards = undefined,
) {
  const saved = sanitizeDiscoveryCards(
    savedCards === undefined ? homepage?.discovery?.concernCards : savedCards,
    { withGroup: true },
  );
  const isCurated = saved.length > 0;
  const cards = isCurated ? saved : defaultConcernCards(registry, images, manual);
  const out = cards
    .filter((card) => card.enabled)
    .map((card) => {
      const chosen = resolveConcernProducts(card.productSlugs, productList);
      const legacy = (Array.isArray(registry) ? registry : []).find((c) => c.id === card.id) || null;
      const matches = chosen.length ? chosen : (legacy ? concernMatches(legacy, productList, {}) : []);
      const group = card.group || legacy?.group || '';
      const groupImage = categoryImage(CONCERN_GROUP_IMAGE[group] || '');
      const image = card.image || groupImage || null;
      return {
        id: card.id,
        label: card.name,
        group,
        to: `/shop?concern=${encodeURIComponent(card.id)}`,
        count: matches.length,
        source: chosen.length ? 'admin' : 'auto',
        image,
        imageSource: card.image ? 'admin' : (groupImage ? 'group' : 'product'),
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
  // The rail minimum exists to stop the BUILT-IN default shipping a thin rail
  // nobody chose. Once an admin owns the list, their list is the answer.
  return isCurated || out.length >= MIN_CONCERNS_TO_RENDER ? out : [];
}

export const CONCERN_REGISTRY = CONCERNS;
export const CONCERN_GROUP_SLUGS = CONCERN_GROUP_IMAGE;
