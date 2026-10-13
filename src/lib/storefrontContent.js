import { safeVisualUrl } from './homepageAppearance.js';
import { DEFAULT_FASHION_STOREFRONT, DEFAULT_LIFESTYLE_STOREFRONT } from './storefrontCustomization.js';

// ============================================================
// Storefront content — what an admin edits, publishes, and the site bakes in.
//
// One record per store (migration 0037): a DRAFT the admin edits (version-
// checked) and a PUBLISHED copy. The site's build (build/publish-content.mjs)
// reads the published records, checks them with validateStorefrontContent()
// below, copies their uploaded images into the deployment and writes them into
// index.html as one JSON block. The page reads that block before its first
// render (readInlinedContent), so a visitor never sees built-in content first
// and never downloads a replaced image: there is no fetch to wait for.
//
// The rules are strict: a value that breaks one is REJECTED — refused by the
// editor before it is saved, and refused by the build before it is published —
// never rendered and never silently swapped. An empty field means "the built-in
// value" (the defaults in storefrontCustomization.js).
// ============================================================

export const STOREFRONT_CONTENT_STORES = Object.freeze(['wellness', 'fashion', 'homeliving', 'grocery', 'lifestyle']);
export const STOREFRONT_LABELS = Object.freeze({ wellness: 'Wellness homepage', fashion: 'Fashion', homeliving: 'Home & Living', grocery: 'Grocery', lifestyle: 'Lifestyle' });

/** Where the build writes the published content into index.html, and the element it becomes. */
export const INLINE_MARKER = '<!--sora-content-->';
export const INLINE_ID = 'sora-content';

const text = (max) => ({ type: 'text', max });
const link = () => ({ type: 'link', max: 240 });
const image = () => ({ type: 'image' });
const group = (fields) => ({ type: 'group', fields });
const list = (length, fields) => ({ type: 'list', length, fields });

// Mirrors normalizeFashionStorefront / normalizeLifestyleStorefront exactly (field names and
// lengths); test-storefront-publish.mjs pins that the two agree.
const SLIDE = {
  id: { type: 'id' }, tall: image(), wide: image(), alt: text(180),
  eyebrowOne: text(50), eyebrowTwo: text(50), headlineOne: text(60), headlineTwo: text(60),
  subtitle: text(160), ctaLabel: text(45), ctaLink: link(), note: text(70),
};
export const STOREFRONT_SCHEMAS = Object.freeze({
  wellness: group({}),
  homeliving: group({}),
  grocery: group({}),
  fashion: group({
    header: group({ tagline: text(60), searchPlaceholder: text(90) }),
    hero: group({ eyebrow: text(70), title: text(90), subtitle: text(140), ctaLabel: text(40), ctaLink: link(), note: text(60), image: image() }),
    sections: group({ categoriesTitle: text(70), categoriesCta: text(30), brandsTitle: text(80), brandsCta: text(30), productsTitle: text(70) }),
  }),
  lifestyle: group({
    header: group({ tagline: text(60) }),
    heroSlides: list(DEFAULT_LIFESTYLE_STOREFRONT.heroSlides.length, SLIDE),
    fashionBanner: group(Object.fromEntries(Object.entries(SLIDE).filter(([k]) => !['id', 'tall', 'wide'].includes(k)).concat([['image', image()]]))),
    sections: group({ fashionCategoriesTitle: text(80), fashionCategoriesCta: text(30), trendingTitle: text(70), trendingCta: text(30) }),
    promo: group({ image: image(), headline: text(100), ctaLabel: text(45), ctaLink: link() }),
  }),
});
export const STOREFRONT_DEFAULTS = Object.freeze({ fashion: DEFAULT_FASHION_STOREFRONT, lifestyle: DEFAULT_LIFESTYLE_STOREFRONT });

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const STORAGE_PATH = '/storage/v1/object/public/product-images/';

/** An image uploaded through the admin: a Supabase project's product-images object, https, nothing else. */
export function isUploadedImage(value) {
  if (typeof value !== 'string') return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  // Exactly as written: the parser would quietly resolve "/../" and other oddities.
  if (url.href !== value) return false;
  return url.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) && !url.port && !url.username
    && url.pathname.startsWith(STORAGE_PATH) && /^[A-Za-z0-9/_.-]+$/.test(url.pathname.slice(STORAGE_PATH.length))
    && !url.pathname.includes('..') && !url.search && !url.hash && safeVisualUrl(value) === url.href;
}

function checkImage(value, mode) {
  const local = safeVisualUrl(value);
  if (local && value.startsWith('/') && !value.startsWith('//')) return null;              // a file the site ships
  if (isUploadedImage(value)) return null;                                                   // uploaded here
  if (mode === 'published' && local) return null;                                            // an older saved URL; left as it is
  return 'Use an image uploaded here, or a path the site ships (/img/…).';
}

/**
 * Strict check of one store's content. Returns { value, errors }: `value` holds
 * the given fields, trimmed; `errors` maps a field path ("hero.ctaLink",
 * "heroSlides.1.wide") to what is wrong with it. Any error means: do not save,
 * do not publish.
 * mode 'editor' (default): images must be uploaded here or shipped with the site.
 * mode 'published': the build also accepts a safe https image an older editor saved.
 */
export function validateStorefrontContent(store, raw, { mode = 'editor' } = {}) {
  const errors = {};
  const schema = STOREFRONT_SCHEMAS[store];
  if (!schema) return { value: {}, errors: { '': `Unknown storefront "${store}".` } };
  const walk = (spec, input, path) => {
    const at = (key) => (path ? `${path}.${key}` : key);
    if (spec.type === 'group') {
      if (!isObject(input)) { errors[path || ''] = 'Expected a group of fields.'; return {}; }
      const out = {};
      for (const [key, v] of Object.entries(input)) {
        if (!Object.hasOwn(spec.fields, key)) { errors[at(key)] = 'Not a field of this storefront.'; continue; }
        const cleaned = walk(spec.fields[key], v, at(key));
        if (cleaned !== undefined) out[key] = cleaned;
      }
      return out;
    }
    if (spec.type === 'list') {
      if (!Array.isArray(input)) { errors[path] = 'Expected a list.'; return []; }
      if (input.length > spec.length) errors[path] = `At most ${spec.length} entries.`;
      return input.slice(0, spec.length).map((entry, i) => walk(group(spec.fields), entry, `${path}.${i}`));
    }
    if (typeof input !== 'string') { errors[path] = 'Expected text.'; return undefined; }
    const value = input.trim();
    if (spec.type === 'id') return value;
    if (/[\u0000-\u001f\u007f]/.test(value)) { errors[path] = 'Remove the control characters.'; return undefined; }
    if (!value) return '';
    if (spec.type === 'text' && value.length > spec.max) errors[path] = `Keep it to ${spec.max} characters (it has ${value.length}).`;
    if (spec.type === 'link' && (!/^\/(?!\/)[^\s\\]*$/.test(value) || value.length > spec.max)) errors[path] = 'Use a page of this site, starting with / (e.g. /fashion/c/clothing).';
    if (spec.type === 'image') { const problem = checkImage(value, mode); if (problem) errors[path] = problem; }
    return value;
  };
  const value = walk(schema, raw, '');
  return { value, errors };
}

/** Every image path in a store's content, in order. */
export function contentImages(store, content) {
  const found = [];
  const walk = (spec, input) => {
    if (spec.type === 'group' && isObject(input)) for (const [k, v] of Object.entries(input)) { if (spec.fields[k]) walk(spec.fields[k], v); }
    else if (spec.type === 'list' && Array.isArray(input)) input.forEach((entry) => walk(group(spec.fields), entry));
    else if (spec.type === 'image' && typeof input === 'string' && input) found.push(input);
  };
  if (STOREFRONT_SCHEMAS[store]) walk(STOREFRONT_SCHEMAS[store], content);
  return found;
}

/** The same content with each image replaced through `swap(url)`. */
export function mapContentImages(store, content, swap) {
  const walk = (spec, input) => {
    if (spec.type === 'group' && isObject(input)) return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, spec.fields[k] ? walk(spec.fields[k], v) : v]));
    if (spec.type === 'list' && Array.isArray(input)) return input.map((entry) => walk(group(spec.fields), entry));
    if (spec.type === 'image' && typeof input === 'string' && input) return swap(input);
    return input;
  };
  return STOREFRONT_SCHEMAS[store] ? walk(STOREFRONT_SCHEMAS[store], content) : content;
}

/** JSON safe inside <script type="application/json"> in HTML: no "</script", no "<!--", no line separators. */
export function serializeInlinedContent(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** What the build wrote into the page: { stores: { fashion: {...}, ... }, versions }, or null. Never throws. */
export function readInlinedContent(doc = globalThis.document) {
  try {
    const el = doc?.getElementById?.(INLINE_ID);
    if (!el) return null;
    const data = JSON.parse(el.textContent || '');
    return isObject(data) && isObject(data.stores) ? data : null;
  } catch {
    return null;
  }
}
