// ============================================================
// Home & Living listing — the pure rules.
//
// Everything /homeliving/category/<slug> decides without React or the
// network: which category a slug means, what a category covers (itself
// and everything below it), the breadcrumb, and the listing state that
// lives in the URL — filters, sort and view — read and written exactly as
// the fashion listing does (src/lib/fashion.js), with the same key names,
// so a filtered view is shareable and the back button restores it.
//
// Facets: price band, size, colour, brand, discount, rating. Size and
// colour come from a product's variants and only appear when a product
// in the listing carries them; discount and rating only when a product
// in the listing has one. A facet that could only ever say "nothing
// matches" is not offered.
// ============================================================

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v) => String(v ?? '').trim();

// ---- Categories (flat today; one parent level is honoured if it ever appears) ----

export const STORE_HOME = { name: 'Home & Living', href: '/homeliving' };
export const categoryHref = (node) => `/homeliving/category/${node.slug}`;

/** `/homeliving/category/<slug>` → the shallowest active category with that slug. */
export function resolveCategory(categories, slug) {
  const s = str(slug).toLowerCase();
  if (!s) return null;
  const list = Array.isArray(categories) ? categories : [];
  const depth = (c) => { let d = 1; let cur = c; const seen = new Set(); while (cur && cur.parent_id && !seen.has(cur.id)) { seen.add(cur.id); cur = list.find((x) => String(x.id) === String(cur.parent_id)); if (cur) d += 1; } return d; };
  const matches = list.filter((c) => c && str(c.slug).toLowerCase() === s && c.is_active !== false);
  if (matches.length === 0) return null;
  matches.sort((a, b) => depth(a) - depth(b) || num(a.sort_order) - num(b.sort_order));
  return matches[0];
}

/** Active direct children, in order. */
export function categoryChildren(categories, node) {
  if (!node) return [];
  return (Array.isArray(categories) ? categories : [])
    .filter((c) => c && c.is_active !== false && c.parent_id != null && String(c.parent_id) === String(node.id))
    .sort((a, b) => num(a.sort_order) - num(b.sort_order) || str(a.name).localeCompare(str(b.name)));
}

/** The ids a listing for `node` covers: itself plus everything below it. */
export function categoryScope(categories, node) {
  if (!node) return null;
  const ids = new Set([String(node.id)]);
  const stack = [node];
  while (stack.length) {
    const cur = stack.shift();
    for (const c of categoryChildren(categories, cur)) if (!ids.has(String(c.id))) { ids.add(String(c.id)); stack.push(c); }
  }
  return ids;
}

/** Home & Living › ancestors › node. Stops on a cycle so a bad row cannot hang the page. */
export function breadcrumbFor(categories, node) {
  const trail = [{ ...STORE_HOME }];
  if (!node) return trail;
  const list = Array.isArray(categories) ? categories : [];
  const chain = []; const seen = new Set(); let cur = node;
  while (cur && !seen.has(String(cur.id))) { seen.add(String(cur.id)); chain.unshift(cur); cur = cur.parent_id ? list.find((x) => String(x.id) === String(cur.parent_id)) : null; }
  for (const c of chain) trail.push({ name: c.name, href: categoryHref(c) });
  return trail;
}

// ---- Listing state in the URL ---------------------------------------------------

export const HOMELIVING_SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'discount', label: 'Biggest discount' },
  { id: 'rating', label: 'Top rated' },
  { id: 'new', label: 'Newest' },
];
export const PRICE_BANDS = [
  { id: 'under-500', label: 'Under ₹500', min: 0, maxExclusive: 500 },
  { id: '500-999', label: '₹500 – ₹999', min: 500, maxExclusive: 1000 },
  { id: '1000-1999', label: '₹1,000 – ₹1,999', min: 1000, maxExclusive: 2000 },
  { id: '2000-plus', label: '₹2,000 & above', min: 2000, maxExclusive: Infinity },
];
export const DISCOUNT_STEPS = [10, 25, 40, 50];
export const RATING_STEPS = [4, 3];
export const VIEWS = ['grid', 'list'];

const SORT_IDS = new Set(HOMELIVING_SORTS.map((s) => s.id));
const PRICE_IDS = new Set(PRICE_BANDS.map((b) => b.id));
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const uniq = (arr) => [...new Set(arr)];

export function readListingState(searchParams) {
  const p = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
  const discount = num(p.get('discount')); const rating = num(p.get('rating'));
  return {
    sort: SORT_IDS.has(p.get('sort')) ? p.get('sort') : 'featured',
    price: PRICE_IDS.has(p.get('price')) ? p.get('price') : null,
    sizes: uniq(list(p.get('size'))),
    colours: uniq(list(p.get('colour'))),
    brands: uniq(list(p.get('brand'))),
    discount: DISCOUNT_STEPS.includes(discount) ? discount : null,
    rating: RATING_STEPS.includes(rating) ? rating : null,
    view: VIEWS.includes(p.get('view')) ? p.get('view') : 'grid',
  };
}

/** Only non-default values are written, so a clean listing has a clean URL. */
export function updateListingState(searchParams, patch) {
  const p = new URLSearchParams(searchParams);
  const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
  const setList = (key, arr) => { const v = uniq((Array.isArray(arr) ? arr : []).map(str).filter(Boolean)); if (v.length) p.set(key, v.join(',')); else p.delete(key); };
  if (has('sort')) { if (SORT_IDS.has(patch.sort) && patch.sort !== 'featured') p.set('sort', patch.sort); else p.delete('sort'); }
  if (has('price')) { if (PRICE_IDS.has(patch.price)) p.set('price', patch.price); else p.delete('price'); }
  if (has('sizes')) setList('size', patch.sizes);
  if (has('colours')) setList('colour', patch.colours);
  if (has('brands')) setList('brand', patch.brands);
  if (has('discount')) { if (DISCOUNT_STEPS.includes(num(patch.discount))) p.set('discount', String(num(patch.discount))); else p.delete('discount'); }
  if (has('rating')) { if (RATING_STEPS.includes(num(patch.rating))) p.set('rating', String(num(patch.rating))); else p.delete('rating'); }
  if (has('view')) { if (patch.view === 'list') p.set('view', 'list'); else p.delete('view'); }
  return p;
}

export const CLEAR_FILTERS = Object.freeze({ price: null, sizes: [], colours: [], brands: [], discount: null, rating: null });

export function activeFilterCount(state) {
  return (state.price ? 1 : 0) + state.sizes.length + state.colours.length + state.brands.length + (state.discount ? 1 : 0) + (state.rating ? 1 : 0);
}

/** The choices the panel offers, from what is actually in the listing. */
export function filterOptions(products) {
  const sizes = new Map(); const colours = new Map(); const brands = new Map();
  let anyDiscount = false; let anyRating = false;
  for (const p of Array.isArray(products) ? products : []) {
    for (const s of p.sizes || []) sizes.set(s, (sizes.get(s) || 0) + 1);
    for (const s of p.swatches || []) if (!colours.has(s.colour)) colours.set(s.colour, s.hex);
    if (p.brand) brands.set(p.brand, (brands.get(p.brand) || 0) + 1);
    if (num(p.discount_percent) > 0) anyDiscount = true;
    if (num(p.rating) > 0) anyRating = true;
  }
  const sizeOrder = ['Single', 'Double', 'Queen', 'King', 'Super King', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const sortSizes = (a, b) => { const ia = sizeOrder.indexOf(a); const ib = sizeOrder.indexOf(b); if (ia >= 0 && ib >= 0) return ia - ib; if (ia >= 0) return -1; if (ib >= 0) return 1; return a.localeCompare(b, 'en', { numeric: true }); };
  return {
    sizes: [...sizes.keys()].sort(sortSizes),
    colours: [...colours.entries()].map(([colour, hex]) => ({ colour, hex })).sort((a, b) => a.colour.localeCompare(b.colour)),
    brands: [...brands.keys()].sort(),
    discounts: anyDiscount ? DISCOUNT_STEPS : [],
    ratings: anyRating ? RATING_STEPS : [],
  };
}

export function matchesFilters(product, state) {
  if (state.price) {
    const band = PRICE_BANDS.find((b) => b.id === state.price);
    if (band && !(product.price >= band.min && product.price < band.maxExclusive)) return false;
  }
  if (state.sizes.length && !state.sizes.some((s) => (product.sizes || []).includes(s))) return false;
  if (state.colours.length && !state.colours.some((c) => (product.swatches || []).some((s) => s.colour === c))) return false;
  if (state.brands.length && !state.brands.includes(product.brand)) return false;
  if (state.discount && num(product.discount_percent) < state.discount) return false;
  if (state.rating && num(product.rating) < state.rating) return false;
  return true;
}

export function sortProducts(products, sort) {
  const arr = [...products];
  const featured = (a, b) => ((b.is_bestseller === true) - (a.is_bestseller === true)) || ((b.is_new === true) - (a.is_new === true)) || (num(a.sort_order) - num(b.sort_order)) || str(a.name).localeCompare(str(b.name));
  switch (sort) {
    case 'price-asc': return arr.sort((a, b) => a.price - b.price || featured(a, b));
    case 'price-desc': return arr.sort((a, b) => b.price - a.price || featured(a, b));
    case 'discount': return arr.sort((a, b) => num(b.discount_percent) - num(a.discount_percent) || featured(a, b));
    case 'rating': return arr.sort((a, b) => num(b.rating) - num(a.rating) || num(b.review_count) - num(a.review_count) || featured(a, b));
    case 'new': return arr.sort((a, b) => ((b.is_new === true) - (a.is_new === true)) || (num(a.sort_order) - num(b.sort_order)));
    default: return arr.sort(featured);
  }
}

/** Scope (a Set of category ids, or null for everything) → filters → sort. */
export function applyListing(products, state, scope = null) {
  const pool = Array.isArray(products) ? products : [];
  const inScope = scope ? pool.filter((p) => p.category_id != null && scope.has(String(p.category_id))) : pool;
  return sortProducts(inScope.filter((p) => matchesFilters(p, state)), state.sort);
}
