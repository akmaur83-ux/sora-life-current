// ============================================================
// Category Experience — the spotlight stage that opens a category page.
//
// STORAGE
// Everything lives under the EXISTING `homepage` site_settings key, beside
// `discovery`, as `homepage.categoryExperience`. That key is already on the
// public-read allowlist (migrations 0009 + 0015: branding, announcement,
// contact, homepage, storefront_theme), already has a subscribe/snapshot
// pair in settings.js, and already carries a nested curated sub-object. So
// this feature needs NO migration and NO new RLS policy. A new top-level key
// would have needed both.
//
// WHAT ADMIN OWNS vs WHAT THE CATALOGUE OWNS
// Admin owns presentation: which products, in what order, on what background,
// with an optional headline/subline it authored. The catalogue owns every
// fact — name, pack size, price, rating, image. Nothing here invents a
// benefit, a claim, a rating or a "bestseller" status, and a stored item that
// no longer resolves to a live, purchasable product is dropped rather than
// rendered from its own stale copy.
//
// Pure and dependency-light on purpose, so the rules run directly in tests.
// ============================================================

import { categories as allCategories, categoryBySlug } from '../data/categories.js';
import { products as allProducts, isPurchasable } from '../data/products.js';
import { safeVisualUrl } from './homepageAppearance.js';
import { homepage } from './settings.js';

/**
 * A structural ceiling on stored items, NOT a merchandising cap.
 *
 * Every eligible product in a category may take part in the spotlight: the
 * stage mounts three seats no matter how deep the pool is (see
 * visibleWindow), so a 46-product category costs exactly what a 3-product one
 * costs. The two real caps that used to live here — 12 curated, 8 automatic —
 * were removed because they hid products for no benefit.
 *
 * This bound only stops a malformed or hostile settings value from putting an
 * unbounded array into the homepage row. It sits well above the entire
 * catalogue (164 products), so no real category can reach it.
 */
export const MAX_STORED_ITEMS = 250;
export const MIN_INTERVAL_MS = 3000;
export const MAX_INTERVAL_MS = 15000;
export const DEFAULT_INTERVAL_MS = 5200;

/**
 * Per-item visual adjustment. Packshots are not framed consistently — some
 * sit tight in their canvas, others float in blank space — so the owner
 * nudges each one rather than every product inheriting one compromise.
 * Bounded so a stored value can never blow the product off the stage.
 */
export const MIN_ITEM_SCALE = 0.75;
export const MAX_ITEM_SCALE = 1.35;
export const DEFAULT_ITEM_SCALE = 1;
export const ITEM_OFFSET_LIMIT = 60;

/**
 * Category-level default backgrounds, keyed by the `tone` the categories
 * table already carries. Muted and warm on purpose — this is a wellness
 * marketplace, not a toy store. Admin can override per category and per item.
 */
const TONE_THEMES = {
  forest: { background: '#E8EFE8', gradient: 'linear-gradient(168deg, #EDF2EC 0%, #DCE7DC 100%)' },
  lime:   { background: '#EDF0DF', gradient: 'linear-gradient(168deg, #F2F4E4 0%, #E2E8D2 100%)' },
  clay:   { background: '#F4EADF', gradient: 'linear-gradient(168deg, #F7EFE6 0%, #EDDFCE 100%)' },
  rose:   { background: '#F7EAE6', gradient: 'linear-gradient(168deg, #FAF0EC 0%, #F1DED8 100%)' },
  plum:   { background: '#EFE9F1', gradient: 'linear-gradient(168deg, #F4EFF5 0%, #E6DCEA 100%)' },
  teal:   { background: '#E4EEEE', gradient: 'linear-gradient(168deg, #EBF3F2 0%, #D8E7E6 100%)' },
  moss:   { background: '#E9EEE6', gradient: 'linear-gradient(168deg, #EFF3EC 0%, #DEE7DA 100%)' },
  sky:    { background: '#E7EDF3', gradient: 'linear-gradient(168deg, #EEF2F7 0%, #DCE5EF 100%)' },
};
/** Used when a category has no tone, or an unknown one. */
export const NEUTRAL_THEME = {
  background: '#F1EDE4',
  gradient: 'linear-gradient(168deg, #F6F2EA 0%, #E9E3D7 100%)',
};

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * A CSS colour we are willing to inline as a style value.
 *
 * Deliberately narrow: hex, rgb/rgba, hsl/hsla and a bare keyword. This value
 * reaches an inline style attribute, so anything with a bracket, semicolon,
 * quote or url() is refused rather than escaped.
 */
export function safeColor(value) {
  const v = str(value, 40);
  if (!v) return '';
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  if (/^(?:rgb|hsl)a?\(\s*[\d.,%\s/deg]+\)$/i.test(v)) return v;
  if (/^[a-z]{3,20}$/i.test(v)) return v;
  return '';
}

/**
 * A CSS gradient we are willing to inline.
 *
 * Only the gradient functions, and only characters that can appear inside
 * one. No url(), no var(), no expression, no nesting of other functions.
 */
export function safeGradient(value) {
  const v = str(value, 240);
  if (!v) return '';
  if (!/^(?:linear|radial|conic)-gradient\(/i.test(v)) return '';
  if (!v.endsWith(')')) return '';
  if (/[;{}<>"'\\]|url\(|var\(|expression|image-set|@import/i.test(v)) return '';
  // Balanced parens, and only one function deep.
  const opens = (v.match(/\(/g) || []).length;
  const closes = (v.match(/\)/g) || []).length;
  if (opens !== closes) return '';
  if (!/^[a-z0-9\s(),.#%\-/]+$/i.test(v)) return '';
  return v;
}

/** Resolve a theme object from raw stored values, falling back cleanly. */
export function sanitizeTheme(raw, fallback = NEUTRAL_THEME) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const background = safeColor(src.background) || fallback.background;
  const gradient = safeGradient(src.gradient) || (safeColor(src.background) ? '' : fallback.gradient);
  return { background, gradient };
}

/** The built-in theme for a category, from the `tone` its record already has. */
export function categoryToneTheme(slug) {
  const tone = categoryBySlug[slug]?.tone;
  return TONE_THEMES[tone] || NEUTRAL_THEME;
}

/**
 * Clamp to a range, falling back when the stored value is not a usable number.
 *
 * null / undefined / '' are treated as ABSENT, not as zero. Number(null) is 0,
 * which is finite — so without this guard a missing scale would clamp to the
 * 0.75 minimum and silently shrink every un-tuned packshot.
 */
const clampNum = (v, min, max, fallback) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const clampInterval = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(v)));
};

/** Stable id for a curated item. Slug-derived, de-duplicated against `taken`. */
export function makeSpotlightId(productSlug, taken = []) {
  const base = String(productSlug || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; i < 200; i += 1) {
    const next = `${base}-${i}`;
    if (!used.has(next)) return next;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Clean one stored spotlight item.
 *
 * `productSlug` is the only load-bearing field — it is what the item resolves
 * against at render time. Everything else is optional presentation, and a
 * malformed value is dropped rather than allowed to reach the DOM.
 */
export function sanitizeSpotlightItem(raw, taken = []) {
  if (!raw || typeof raw !== 'object') return null;
  const productSlug = str(raw.productSlug ?? raw.productId ?? raw.slug, 120);
  if (!productSlug) return null;
  return {
    id: str(raw.id, 60) || makeSpotlightId(productSlug, taken),
    productSlug,
    // Optional cutout/hero asset. Same URL policy the homepage visuals use.
    spotlightImage: safeVisualUrl(raw.spotlightImage) || '',
    // Owner-authored, and shown verbatim. Never generated from product data.
    headline: str(raw.headline, 60),
    subline: str(raw.subline, 90),
    background: safeColor(raw.background),
    gradient: safeGradient(raw.gradient),
    // Generated once by the Admin packshot preprocessor. It is deliberately
    // separate from the owner's fields above, so a later re-import can refresh
    // the automatic suggestion without ever overwriting a manual decision.
    autoTheme: {
      background: safeColor(raw.autoTheme?.background),
      gradient: safeGradient(raw.autoTheme?.gradient),
    },
    // Owner's per-packshot framing nudge. Rounded so the stored value stays
    // tidy, and bounded so it can only ever adjust, never break, the shot.
    visualScale: Math.round(
      clampNum(raw.visualScale, MIN_ITEM_SCALE, MAX_ITEM_SCALE, DEFAULT_ITEM_SCALE) * 100,
    ) / 100,
    verticalOffset: Math.round(clampNum(raw.verticalOffset, -ITEM_OFFSET_LIMIT, ITEM_OFFSET_LIMIT, 0)),
    enabled: raw.enabled !== false,
  };
}

/** Clean one category's configuration. */
export function sanitizeCategoryConfig(raw, slug) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const taken = [];
  const items = (Array.isArray(src.items) ? src.items : [])
    .slice(0, MAX_STORED_ITEMS)
    .map((it) => {
      const clean = sanitizeSpotlightItem(it, taken);
      if (clean) taken.push(clean.id);
      return clean;
    })
    .filter(Boolean);
  return {
    // OPT-IN, and deliberately so. A category shows the spotlight only after
    // the owner has explicitly switched it on; no configuration and an absent
    // `enabled` both mean off. The automatic fallback pool is still here and
    // still uncapped — it just cannot publish itself. Without this gate,
    // deploying the feature would light up every category at once using
    // whatever catalogue images happen to exist, which for this catalogue
    // means rectangular lifestyle photos in a stage built for cutouts.
    enabled: src.enabled === true,
    autoRotate: src.autoRotate !== false,
    intervalMs: clampInterval(src.intervalMs),
    theme: sanitizeTheme(src.theme, categoryToneTheme(slug)),
    items,
  };
}

/** Clean the whole `homepage.categoryExperience` blob. */
export function normalizeCategoryExperience(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawCats = src.categories && typeof src.categories === 'object' ? src.categories : {};
  const out = {};
  for (const cat of allCategories) {
    if (Object.prototype.hasOwnProperty.call(rawCats, cat.slug)) {
      out[cat.slug] = sanitizeCategoryConfig(rawCats[cat.slug], cat.slug);
    }
  }
  return { categories: out };
}

/** Config for one category, defaulted when the admin has never touched it. */
export function categoryConfig(slug, source = homepage) {
  const all = normalizeCategoryExperience(source?.categoryExperience);
  return all.categories[slug] || sanitizeCategoryConfig({}, slug);
}

/** What gets written back to settings. Empty categories are not persisted. */
export function categoryExperiencePayload(bySlug) {
  const out = {};
  for (const [slug, cfg] of Object.entries(bySlug || {})) {
    if (!categoryBySlug[slug]) continue;
    const clean = sanitizeCategoryConfig(cfg, slug);
    // "Nothing meaningful configured" — off, untouched settings, no items.
    // Such a category is not persisted, so an absent key and a pristine one
    // mean the same thing: no spotlight.
    const isDefault = !clean.enabled && clean.autoRotate
      && clean.intervalMs === DEFAULT_INTERVAL_MS
      && clean.items.length === 0
      && clean.theme.background === categoryToneTheme(slug).background;
    if (isDefault) continue;
    out[slug] = clean;
  }
  return { categories: out };
}

/**
 * Is this product fit to headline a category?
 *
 * The same bar the storefront already applies elsewhere: a real product, a
 * usable slug, a payable price, and in stock. No invented featured/bestseller
 * status — ordering is the admin's job, or catalogue order.
 */
export function isSpotlightEligible(product) {
  if (!product || !product.slug || typeof product.slug !== 'string') return false;
  if (product.isActive === false) return false;
  if (!isPurchasable(product)) return false;
  if (product.stock === 0) return false;
  return true;
}

/**
 * Choose the products for a category's stage.
 *
 * Curated items win, in the admin's order, resolved against the LIVE
 * catalogue — a curated slug that no longer exists, was deactivated or sold
 * out is skipped, so a stale mapping can thin the stage but never put a dead
 * product on it. When nothing usable is curated, fall back to the category's
 * own products in catalogue order.
 */
export function resolveSpotlightItems(slug, {
  config = null,
  productList = allProducts,
  catalogue = null,
} = {}) {
  const cfg = config || categoryConfig(slug);
  const bySlug = catalogue || Object.fromEntries(
    (productList || []).filter((p) => p?.slug).map((p) => [p.slug, p]),
  );

  const curated = cfg.items
    .filter((it) => it.enabled)
    .map((it) => ({ item: it, product: bySlug[it.productSlug] }))
    .filter(({ product }) => isSpotlightEligible(product))
    // A curated item must still belong to the category it was curated for;
    // a product that has since been recategorised does not linger here.
    .filter(({ product }) => (product.categories || [product.category]).includes(slug))
    .map(({ item, product }) => buildSlide(item, product, cfg, slug));

  if (curated.length) return curated;

  return (productList || [])
    .filter((p) => (p.categories || [p.category]).includes(slug))
    .filter(isSpotlightEligible)
    // No slice: every eligible product in the category rotates. Only three
    // seats are ever mounted, so the pool's depth costs nothing.
    .map((product) => buildSlide(null, product, cfg, slug));
}

/**
 * One rendered slide: catalogue facts + admin presentation, already merged.
 *
 * `image` follows the required priority — configured spotlight asset, then a
 * transparent-looking product asset, then the ordinary product image. When we
 * cannot tell that an image is a cutout, `framed` is true and the component
 * presents it in a contained panel instead of pretending it floats.
 */
function buildSlide(item, product, cfg, slug) {
  const configured = item?.spotlightImage || '';
  const productImage = product.image || product.gallery?.[0] || '';
  const image = configured || productImage;
  const cutout = Boolean(configured) || looksTransparent(configured || productImage);
  const autoBackground = item?.autoTheme?.background || '';
  const autoGradient = item?.autoTheme?.gradient || '';
  const background = item?.background || autoBackground || cfg.theme.background;
  const gradient = item?.gradient
    || (item?.background ? '' : (autoGradient || (autoBackground ? '' : cfg.theme.gradient)));
  const theme = { background, gradient };
  return {
    id: item?.id || `auto-${product.slug}`,
    productSlug: product.slug,
    product,
    name: product.name,
    // Genuine catalogue facts only.
    form: product.form || null,
    rating: product.reviewCount > 0 && product.rating > 0 ? product.rating : null,
    reviewCount: product.reviewCount > 0 ? product.reviewCount : 0,
    price: product.price,
    // Owner-authored, optional, never synthesised.
    headline: item?.headline || '',
    subline: item?.subline || '',
    image,
    framed: !cutout,
    // Applied to the product visual only — never to the seat, whose transform
    // is the reshuffle animation.
    visualScale: item?.visualScale ?? DEFAULT_ITEM_SCALE,
    verticalOffset: item?.verticalOffset ?? 0,
    theme,
    mobileTheme: mobileSpotlightTheme(theme, Boolean(autoBackground) && !item?.background && !item?.gradient),
    categorySlug: slug,
  };
}

/** Mobile-only presentation derived from an already stored auto colour.
 * No import, pixels or settings write is required. Manual themes are returned
 * verbatim; the original desktop/tablet theme remains on slide.theme. */
export function mobileSpotlightTheme(theme, automatic = false) {
  let value = theme.background;
  if (/^#[0-9a-f]{3}$/i.test(value)) value = '#' + [...value.slice(1)].map((c) => c + c).join('');
  const rgb = /^#[0-9a-f]{6}$/i.test(value)
    ? [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) : null;
  const luminance = (channels) => channels.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ink = rgb && luminance(rgb) < 0.18 ? '#FFFFFF' : '#16211B';
  if (!automatic || !rgb) return { ...theme, ink };
  const high = Math.max(...rgb), low = Math.min(...rgb), delta = high - low;
  const light = (high + low) / 2;
  let hue = 0;
  if (delta) {
    if (high === rgb[0]) hue = ((rgb[1] - rgb[2]) / delta) % 6;
    else if (high === rgb[1]) hue = (rgb[2] - rgb[0]) / delta + 2;
    else hue = (rgb[0] - rgb[1]) / delta + 4;
  }
  hue = (hue + 6) % 6;
  const sourceSaturation = delta ? delta / (1 - Math.abs(2 * light - 1)) : 0;
  // Neutral packaging keeps a neutral field; coloured packaging gets richer chroma.
  const saturation = sourceSaturation < 0.08 ? sourceSaturation : Math.max(0.62, Math.min(0.82, sourceSaturation * 1.18));
  const atLightness = (l) => {
    const c = (1 - Math.abs(2 * l - 1)) * saturation;
    const x = c * (1 - Math.abs((hue % 2) - 1));
    const channels = hue < 1 ? [c, x, 0] : hue < 2 ? [x, c, 0] : hue < 3 ? [0, c, x]
      : hue < 4 ? [0, x, c] : hue < 5 ? [x, 0, c] : [c, 0, x];
    return channels.map((v) => v + l - c / 2);
  };
  const stop = (target) => {
    let left = 0, right = 1;
    for (let i = 0; i < 22; i += 1) {
      const mid = (left + right) / 2;
      if (luminance(atLightness(mid)) < target) left = mid; else right = mid;
    }
    return '#' + atLightness(left).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const dark = stop(0.055), middle = stop(0.105), bright = stop(0.17);
  return { background: middle, gradient: `linear-gradient(115deg, ${dark} 0%, ${middle} 52%, ${bright} 100%)`, ink: '#FFFFFF' };
}

/** A cheap, honest guess: only PNG/WebP/AVIF can carry an alpha channel. */
export function looksTransparent(url) {
  if (typeof url !== 'string' || !url) return false;
  const path = url.split('?')[0].split('#')[0];
  return /\.(png|webp|avif)$/i.test(path);
}

/** Wrap an index into range. Used by every navigation path. */
export function wrapIndex(i, len) {
  if (!Number.isFinite(len) || len <= 0) return 0;
  return ((Math.trunc(i) % len) + len) % len;
}

/**
 * The only slides the stage may render: previous, active, next.
 *
 * This is the whole virtualization strategy — a 100-product category renders
 * three nodes, not a hundred. With one slide there are no neighbours; with
 * two, prev and next are the same slide, so it is offered once rather than
 * twice in the same position.
 */
export function visibleWindow(items, index) {
  const len = items.length;
  if (!len) return { prev: null, active: null, next: null };
  const active = { slide: items[wrapIndex(index, len)], index: wrapIndex(index, len), role: 'active' };
  if (len === 1) return { prev: null, active, next: null };
  const prevIdx = wrapIndex(index - 1, len);
  const nextIdx = wrapIndex(index + 1, len);
  const prev = { slide: items[prevIdx], index: prevIdx, role: 'prev' };
  if (len === 2) return { prev, active, next: null };
  return { prev, active, next: { slide: items[nextIdx], index: nextIdx, role: 'next' } };
}

/**
 * Should the stage render on the storefront?
 *
 * Two conditions, both required: the owner has explicitly enabled this
 * category, AND there is something eligible to show. `enabled` is never
 * inferred from the presence of products — see sanitizeCategoryConfig.
 */
export function spotlightVisible(slug, items, config = null) {
  const cfg = config || categoryConfig(slug);
  return cfg.enabled === true && items.length > 0;
}

/**
 * Has the owner configured anything here yet?
 *
 * Used by Admin to say "READY — NOT LIVE": items are assigned and waiting,
 * but the category has not been published.
 */
export function categoryIsReadyButOff(config) {
  return Boolean(config) && config.enabled !== true && config.items.length > 0;
}
