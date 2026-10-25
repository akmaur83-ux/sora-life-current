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
// Two readings of the same schema:
//   validateStorefrontContent — STRICT. A value that breaks a rule is refused by
//     the editor before it is saved and by the build before it is published.
//   readSection — LENIENT, for the page. Each field that does not pass its rule
//     falls back to the built-in value; a page never renders a broken one.
// An empty field means "the built-in value" (the section's defaults, which live
// beside the component that renders them).
// ============================================================

export const STOREFRONT_CONTENT_STORES = Object.freeze(['wellness', 'fashion', 'homeliving', 'grocery', 'lifestyle']);
export const STOREFRONT_LABELS = Object.freeze({ wellness: 'Wellness homepage', fashion: 'Fashion', homeliving: 'Home & Living', grocery: 'Grocery', lifestyle: 'Lifestyle' });

/** Where the build writes the published content into index.html, and the element it becomes. */
export const INLINE_MARKER = '<!--sora-content-->';
export const INLINE_ID = 'sora-content';

/** Text position presets for copy laid over a photograph (wide screens; a phone keeps the layout it has). */
export const POSITIONS = Object.freeze(['left', 'center', 'right']);
export const POSITION_LABELS = Object.freeze({ left: 'Left', center: 'Centre', right: 'Right' });

// Field builders. The label is the admin's; the rules ignore it.
const text = (max, label) => ({ type: 'text', max, label });
const link = (label = 'Link') => ({ type: 'link', max: 240, label });
const image = (label) => ({ type: 'image', label });
const group = (fields, label) => ({ type: 'group', fields, label });
const list = (length, fields, label, itemLabel) => ({ type: 'list', length, fields, label, itemLabel });
/** Show or hide: `hidden: true` takes the section (or the item) off the page. */
const hidden = () => ({ type: 'bool', label: 'Hide' });
/** A preset, never free placement. */
const position = () => ({ type: 'enum', options: POSITIONS, label: 'Text position' });
/** A fixed number of lines (a headline set in lines); an empty line is the built-in line. */
const lines = (length, max, label) => ({ type: 'lines', length, max, label });
/** Two uploads, phone and desktop, set together. */
const pic = (label = 'Photograph') => ({ type: 'pic', label });
/** A photograph and the background colour matched to it, set together: phone, desktop and the colour. */
const tone = (label = 'Photograph and its background colour') => ({ type: 'tone', label });

// Mirrors normalizeFashionStorefront / normalizeLifestyleStorefront exactly (field names and
// lengths); test-storefront-publish.mjs pins that the two agree.
const SLIDE = {
  id: { type: 'id' }, tall: image(), wide: image(), alt: text(180),
  eyebrowOne: text(50), eyebrowTwo: text(50), headlineOne: text(60), headlineTwo: text(60),
  subtitle: text(160), ctaLabel: text(45), ctaLink: link(), note: text(70),
};

// ---- Sections shared in shape ---------------------------------------------------------------
/** A banner: copy over one photograph, one link. */
const banner = (label, extra = {}) => group({
  hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(2, 40, 'Headline'), text: text(200, 'Subline'),
  cta: text(40, 'Button label'), link: link('Button link'), picture: pic(), alt: text(180, 'Photograph description'), ...extra,
}, label);
/** A tile in a grid: a name, where it goes, its photograph. */
const tile = (extra = {}) => ({ hidden: hidden(), title: text(40, 'Name'), ...extra, link: link('Opens'), picture: pic(), alt: text(180, 'Photograph description') });
/** A row of shopping facts (delivery, returns, support): words and where each goes. */
const facts = (length, label, withLink = true) => group({
  hidden: hidden(),
  items: list(length, { hidden: hidden(), title: text(40, 'Title'), text: text(60, 'Line under it'), ...(withLink ? { link: link('Opens') } : {}) }, 'Items', 'Item'),
}, label);

// ---- The stores ---------------------------------------------------------------------------
const WELLNESS = {
  hero: group({
    hidden: hidden(),
    slides: list(2, {
      hidden: hidden(),
      eyebrow: lines(2, 50, 'Eyebrow (two parts)'),
      title: lines(2, 40, 'Headline (the second line is the orange one)'),
      ctaLabel: text(40, 'Button label (no label, no button)'), ctaLink: link('Button link'),
      picture: tone('Photograph and the page colour it sits on'), alt: text(180, 'Photograph description'),
      position: position(),
    }, 'Slides', 'Slide'),
  }, 'Hero'),
  trust: group({
    hidden: hidden(),
    items: list(4, {
      hidden: hidden(), title: lines(2, 30, 'Title (a phone shows it as these two lines)'),
      note: text(40, 'Line under it (a phone shows it only under a one-line title)'), link: link('Opens (empty: the built-in page, or none)'),
    }, 'Items', 'Item'),
  }, 'Trust strip'),
  tiles: group({
    hidden: hidden(),
    fashion: group({
      hidden: hidden(), title: lines(3, 24, 'Headline'), cta: text(30, 'Button label'), link: link('Opens'),
      picture: tone('Photograph and the panel colour matched to it'), alt: text(180, 'Photograph description'),
    }, 'Fashion tile (the large one)'),
    nutrition: group({ hidden: hidden(), title: lines(2, 24, 'Headline'), link: link('Opens'), picture: tone('Photograph and the tile colour behind it') }, 'Health & Nutrition tile'),
    living: group({ hidden: hidden(), title: lines(2, 24, 'Headline'), link: link('Opens'), picture: tone('Photograph and the tile colour behind it') }, 'Home & Living tile'),
  }, 'Store tiles'),
  stores: group({
    hidden: hidden(), title: text(60, 'Heading'), more: text(30, 'View-all label'), link: link('View-all link'),
    items: list(6, { hidden: hidden(), name: text(30, 'Name'), link: link('Opens'), picture: tone('Photograph and the circle colour behind it') }, 'Circles', 'Circle'),
  }, 'Explore the stores'),
  promo: group({
    hidden: hidden(), title: text(60, 'Headline'), text: text(160, 'Subline'), cta: text(40, 'Button label'), link: link('Opens'),
    picture: pic(), alt: text(180, 'Photograph description'), position: position(),
  }, 'Festive promo'),
  newArrivals: group({
    hidden: hidden(), title: text(60, 'Heading'), more: text(30, 'View-all label'),
    link: link('View-all link (empty: the store of the newest arrival)'),
  }, 'New arrivals (the products flagged new; hidden while none are)'),
  lifestyleBanner: banner('Lifestyle banner', { position: position() }),
  jewelleryBanner: banner('Jewellery banner', { position: position() }),
  storeCarousel: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), text: text(200, 'Subline'),
    cards: list(2, {
      hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(2, 40, 'Headline'), text: text(200, 'Subline'),
      cta: text(40, 'Button label'), link: link('Card link'), picture: pic(), alt: text(180, 'Photograph description'),
      details: lines(3, 40, 'Three short features'),
    }, 'Store cards', 'Card'),
  }, 'Store carousel'),
};

const FASHION_STRIPS = group({
  delivery: group({ hidden: hidden(), location: text(60, 'Where we deliver'), promise: text(60, 'Delivery time') }, 'Delivery strip (under the search bar)'),
  benefits: group({
    hidden: hidden(),
    signIn: text(30, 'Sign-in title'), signInText: text(60, 'Sign-in line'),
    account: text(30, 'Signed-in title'), accountText: text(60, 'Signed-in line'),
    items: list(4, { hidden: hidden(), line1: text(30, 'First line'), line2: text(30, 'Second line') }, 'Benefits', 'Benefit'),
  }, 'Benefits strip (on /fashion)'),
}, 'Fashion strips');

const WOMEN = group({
  hero: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(3, 30, 'Headline'), intro: text(200, 'Subline'),
    cta: text(40, 'Button label'), link: link('Button link (empty: the Women listing)'), picture: pic(), alt: text(180, 'Photograph description'), position: position(),
  }, 'Hero'),
  categories: group({ hidden: hidden(), title: text(60, 'Heading'), items: list(6, tile(), 'Category tiles', 'Tile') }, 'Shop by category'),
  products: group({ hidden: hidden(), newTitle: text(60, 'Heading when new pieces are flagged'), title: text(60, 'Heading otherwise'), viewAll: text(30, 'View-all label') }, 'Product row'),
  edits: group({ hidden: hidden(), items: list(4, { ...tile({ text: text(120, 'Line') }), cta: text(40, 'Link label') }, 'Edits', 'Edit') }, 'Edits'),
  capsule: group({ hidden: hidden(), title: text(60, 'Heading'), cta: text(30, 'Link label'), items: list(4, tile({ caption: text(80, 'Caption') }), 'Looks', 'Look') }, 'The capsule edit'),
  sarees: banner('Saree store banner', { title: text(80, 'Headline') }),
  jewellery: banner('Jewellery store banner', { title: text(80, 'Headline') }),
  services: facts(3, 'Shopping information'),
}, "Women's page");

const MEN = group({
  hero: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(2, 30, 'Headline'), intro: text(200, 'Subline'),
    cta: text(40, 'Button label'), link: link('Button link (empty: the Men listing)'), note: text(40, 'Edition note'),
    picture: pic(), alt: text(180, 'Photograph description'), position: position(),
  }, 'Hero'),
  highlights: facts(4, 'Highlights'),
  collections: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), more: text(30, 'Explore-all label'), items: list(3, tile(), 'Collections', 'Collection') }, 'Collections'),
  editorial: group({ hidden: hidden(), items: list(2, { ...tile({ eyebrow: text(60, 'Eyebrow'), text: text(160, 'Line') }), cta: text(40, 'Link label') }, 'Edits', 'Edit') }, 'Style edits'),
  products: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), more: text(30, 'Explore-all label') }, 'Product row'),
  looks: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), more: text(30, 'Explore-all label'), items: list(4, tile(), 'Looks', 'Look') }, 'Shop the look'),
  closing: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), cta: text(40, 'Button label'), link: link('Button link (empty: the Men listing)') }, 'Closing'),
}, "Men's page");

const SAREES = group({
  hero: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(2, 40, 'Headline'), intro: text(200, 'Subline'),
    cta: text(40, 'Button label'), link: link('Button link (empty: the Women listing)'), position: position(),
    slides: list(2, { picture: pic(), alt: text(180, 'Photograph description') }, 'Photographs (the arrows step between them)', 'Photograph'),
  }, 'Hero'),
  collections: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(2, 40, 'Heading'), text: lines(2, 60, 'Subline'), viewAll: text(30, 'View-all label'),
    items: list(6, tile({ caption: text(60, 'Caption') }), 'Collections', 'Collection'),
  }, 'Collections'),
  editorial: group({ hidden: hidden(), items: list(2, { ...tile({ eyebrow: text(60, 'Eyebrow'), text: text(160, 'Line') }), cta: text(40, 'Button label') }, 'Edits', 'Edit') }, 'Featured edits'),
  products: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), text: lines(2, 60, 'Subline') }, 'Product row'),
  promo: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(2, 40, 'Headline'), cta: text(40, 'Button label'), link: link('Button link (empty: the Women listing)'), picture: pic(), alt: text(180, 'Photograph description') }, 'Closing banner'),
  services: facts(4, 'Shopping information'),
}, 'Saree page');

const JEWELLERY = group({
  hero: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: lines(2, 40, 'Headline'), intro: text(200, 'Subline'),
    cta: text(40, 'Button label'), link: link('Button link (empty: the Jewellery listing)'), picture: pic(), alt: text(180, 'Photograph description'), position: position(),
  }, 'Hero'),
  trust: group({
    hidden: hidden(),
    items: list(4, { hidden: hidden(), title: text(40, 'Title'), note: text(40, 'Line under it'), phone: lines(2, 30, 'On a phone (two lines)'), link: link('Opens') }, 'Items', 'Item'),
  }, 'Trust strip'),
  categories: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), intro: text(160, 'Subline'), items: list(7, tile(), 'Category circles', 'Circle') }, 'Shop by category'),
  loved: group({ hidden: hidden(), title: text(80, 'Heading'), viewAll: text(30, 'View-all label') }, 'Product row'),
  edits: group({ hidden: hidden(), items: list(2, { hidden: hidden(), title: lines(3, 30, 'Headline'), cta: text(40, 'Button label'), link: link('Opens'), picture: pic(), alt: text(180, 'Photograph description') }, 'Banners', 'Banner') }, 'Wedding and gifts banners'),
  story: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), text: text(240, 'Text'), cta: text(40, 'Button label'), link: link('Button link'), picture: pic(), alt: text(180, 'Photograph description') }, 'Story'),
  newsletter: group({ hidden: hidden(), title: text(80, 'Heading'), text: text(200, 'Text'), picture: pic(), alt: text(180, 'Photograph description') }, 'Newsletter'),
}, 'Jewellery page');

const HOMELIVING = {
  hero: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), headline: text(60, 'Headline'), sub: text(200, 'Subline'),
    cta: text(40, 'Button label'), link: link('Button link'), note: text(60, 'Script note'),
    picture: tone('Photograph and the wash colour behind the copy'), position: position(),
  }, 'Hero'),
  trust: group({ hidden: hidden(), items: list(4, { hidden: hidden(), title: text(40, 'Title'), sub: text(60, 'Line under it') }, 'Items', 'Item') }, 'Trust strip'),
  categories: group({ hidden: hidden(), eyebrow: text(60, 'Eyebrow'), title: text(80, 'Heading'), more: text(30, 'View-all label'), link: link('View-all link') }, 'Category circles'),
  featured: group({ hidden: hidden(), title: text(80, 'Heading'), sub: text(120, 'Subline'), more: text(30, 'View-all label'), link: link('View-all link') }, 'Featured row'),
  promo: group({
    hidden: hidden(), eyebrow: text(60, 'Eyebrow'), headline: text(80, 'Headline'), sub: text(200, 'Subline'),
    cta: text(40, 'Button label'), link: link('Button link'), picture: tone('Photograph and the panel colour it fades into'),
    badges: list(3, { hidden: hidden(), title: text(40, 'Badge') }, 'Badges', 'Badge'),
  }, 'Promo banner'),
};

const GROCERY = {
  trust: group({ hidden: hidden(), items: list(3, { hidden: hidden(), title: text(40, 'Title'), sub: text(60, 'Line under it') }, 'Items', 'Item') }, 'Trust strip'),
  hero: group({
    hidden: hidden(), headline: text(80, 'Headline'), sub: text(200, 'Subline'), cta: text(40, 'Button label'), link: link('Button link'),
    note: text(60, 'Script note'), picture: tone('Photograph and the wash colour behind the copy'), position: position(),
  }, 'Hero'),
  categories: group({ hidden: hidden() }, 'Category circles'),
  daily: group({ hidden: hidden(), title: text(80, 'Heading'), sub: text(120, 'Subline'), more: text(30, 'See-all label'), link: link('See-all link') }, 'Daily essentials'),
  promo: group({
    hidden: hidden(), headline: text(80, 'Headline'), sub: text(200, 'Subline'), cta: text(40, 'Button label'), link: link('Button link'),
    picture: tone('Photograph and the panel colour beside it'),
  }, 'Promo banner'),
};

export const STOREFRONT_SCHEMAS = Object.freeze({
  wellness: group(WELLNESS),
  homeliving: group(HOMELIVING),
  grocery: group(GROCERY),
  fashion: group({
    header: group({ tagline: text(60), searchPlaceholder: text(90) }),
    hero: group({ eyebrow: text(70), title: text(90), subtitle: text(140), ctaLabel: text(40), ctaLink: link(), note: text(60), image: image() }),
    sections: group({ categoriesTitle: text(70), categoriesCta: text(30), brandsTitle: text(80), brandsCta: text(30), productsTitle: text(70) }),
    strips: FASHION_STRIPS,
    women: WOMEN,
    men: MEN,
    sarees: SAREES,
    jewellery: JEWELLERY,
  }),
  lifestyle: group({
    header: group({ tagline: text(60) }),
    heroSlides: list(DEFAULT_LIFESTYLE_STOREFRONT.heroSlides.length, SLIDE),
    fashionBanner: group(Object.fromEntries(Object.entries(SLIDE).filter(([k]) => !['id', 'tall', 'wide'].includes(k)).concat([['image', image()]]))),
    sections: group({ fashionCategoriesTitle: text(80), fashionCategoriesCta: text(30), trendingTitle: text(70), trendingCta: text(30) }),
    promo: group({ image: image(), headline: text(100), ctaLabel: text(45), ctaLink: link() }),
  }),
});
/** The keys the Fashion and Lifestyle home pages have always had (storefrontCustomization.js normalises them). */
export const STOREFRONT_HOME_KEYS = Object.freeze({ fashion: Object.freeze(['header', 'hero', 'sections']), lifestyle: Object.freeze(Object.keys(DEFAULT_LIFESTYLE_STOREFRONT)) });
export const STOREFRONT_DEFAULTS = Object.freeze({ fashion: DEFAULT_FASHION_STOREFRONT, lifestyle: DEFAULT_LIFESTYLE_STOREFRONT });

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const STORAGE_PATH = '/storage/v1/object/public/product-images/';
const COLOUR = /^#[0-9a-fA-F]{6}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const LINK = /^\/(?!\/)[^\s\\]*$/;

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

/** A photograph the site ships: an image file under /img/, nothing else. */
const SHIPPED = /^\/img\/[A-Za-z0-9/_.-]+\.(webp|png|jpe?g|avif)$/;

function checkImage(value, mode) {
  const local = safeVisualUrl(value);
  if (local && value.startsWith('/') && !value.startsWith('//')) {                          // a file the site ships
    // The editor takes only an /img/ image; the build keeps letting through any safe path an older editor saved.
    return mode === 'published' || (SHIPPED.test(value) && !value.includes('..')) ? null : 'Use an image uploaded here, or a path the site ships (/img/…).';
  }
  if (isUploadedImage(value)) return null;                                                   // uploaded here
  if (mode === 'published' && local) return null;                                            // an older saved URL; left as it is
  return 'Use an image uploaded here, or a path the site ships (/img/…).';
}

/** The field names an image-pair value carries. */
const PIC_KEYS = Object.freeze(['phone', 'desktop']);
const TONE_KEYS = Object.freeze(['colour', 'phone', 'desktop']);

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
  const textRule = (spec, input, path) => {
    if (typeof input !== 'string') { errors[path] = 'Expected text.'; return undefined; }
    const value = input.trim();
    if (CONTROL.test(value)) { errors[path] = 'Remove the control characters.'; return undefined; }
    if (value && value.length > spec.max) errors[path] = `Keep it to ${spec.max} characters (it has ${value.length}).`;
    return value;
  };
  const imagePair = (keys, input, path, colour) => {
    if (!isObject(input)) { errors[path] = 'Expected a photograph.'; return {}; }
    const out = {};
    for (const [key, v] of Object.entries(input)) {
      if (!keys.includes(key)) { errors[`${path}.${key}`] = 'Not a field of this storefront.'; continue; }
      if (typeof v !== 'string') { errors[`${path}.${key}`] = 'Expected text.'; continue; }
      const value = v.trim();
      out[key] = value;
      if (!value) continue;
      if (key === 'colour') { if (!COLOUR.test(value)) errors[`${path}.colour`] = 'Use a colour like #F4EFE6.'; continue; }
      const problem = checkImage(value, mode);
      if (problem) errors[`${path}.${key}`] = problem;
    }
    const set = keys.filter((k) => out[k]);
    if (set.length && set.length !== keys.length) {
      errors[path] = colour
        ? 'Set the photograph (phone and desktop) and its background colour together, or leave all three empty.'
        : 'Upload both photographs, phone and desktop, or leave both empty.';
    }
    return out;
  };
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
    if (spec.type === 'bool') {
      if (typeof input !== 'boolean') { errors[path] = 'Expected on or off.'; return undefined; }
      return input;
    }
    if (spec.type === 'pic') return imagePair(PIC_KEYS, input, path, false);
    if (spec.type === 'tone') return imagePair(TONE_KEYS, input, path, true);
    if (spec.type === 'lines') {
      if (!Array.isArray(input)) { errors[path] = 'Expected lines of text.'; return []; }
      if (input.length > spec.length) errors[path] = `At most ${spec.length} lines.`;
      return input.slice(0, spec.length).map((line, i) => textRule(spec, line, `${path}.${i}`) ?? '');
    }
    if (typeof input !== 'string') { errors[path] = 'Expected text.'; return undefined; }
    const value = input.trim();
    if (spec.type === 'id') return value;
    if (CONTROL.test(value)) { errors[path] = 'Remove the control characters.'; return undefined; }
    if (!value) return '';
    if (spec.type === 'enum' && !spec.options.includes(value)) errors[path] = `Choose one of: ${spec.options.join(', ')}.`;
    if (spec.type === 'text' && value.length > spec.max) errors[path] = `Keep it to ${spec.max} characters (it has ${value.length}).`;
    if (spec.type === 'link' && (!LINK.test(value) || value.length > spec.max)) errors[path] = 'Use a page of this site, starting with / (e.g. /fashion/c/clothing).';
    if (spec.type === 'image') { const problem = checkImage(value, mode); if (problem) errors[path] = problem; }
    return value;
  };
  const value = walk(schema, raw, '');
  return { value, errors };
}

// ---- The page's reading: lenient, field by field -----------------------------------------------
const goodText = (v, max) => typeof v === 'string' && !!v.trim() && v.trim().length <= max && !CONTROL.test(v);
const goodImage = (v) => typeof v === 'string' && !!v.trim() && checkImage(v.trim(), 'published') === null;
const goodLink = (v, max) => typeof v === 'string' && LINK.test(v.trim()) && v.trim().length <= max && !!v.trim();

/**
 * One field (or group, or list) as the page should render it: the published value where it
 * passes its rule, the built-in value where it does not. Never throws; never returns a value
 * that broke a rule. `defaults` carries the section's built-in content in the schema's shape
 * (plus anything only the component uses, which passes through untouched).
 */
export function readSection(spec, raw, defaults) {
  if (!spec) return defaults;
  switch (spec.type) {
    case 'group': {
      const base = isObject(defaults) ? defaults : {};
      const source = isObject(raw) ? raw : {};
      const out = { ...base };
      for (const [key, field] of Object.entries(spec.fields)) out[key] = readSection(field, source[key], base[key]);
      return out;
    }
    case 'list': {
      const base = Array.isArray(defaults) ? defaults : [];
      const source = Array.isArray(raw) ? raw : [];
      return base.map((item, i) => readSection(group(spec.fields), source[i], item));
    }
    case 'lines': {
      const base = Array.isArray(defaults) ? defaults : [];
      const source = Array.isArray(raw) ? raw : [];
      return base.map((line, i) => (goodText(source[i], spec.max) ? source[i].trim() : line));
    }
    case 'text': return goodText(raw, spec.max) ? raw.trim() : defaults;
    case 'link': return goodLink(raw, spec.max) ? raw.trim() : defaults;
    case 'image': return goodImage(raw) ? raw.trim() : defaults;
    case 'bool': return typeof raw === 'boolean' ? raw : (defaults ?? false);
    case 'enum': return typeof raw === 'string' && spec.options.includes(raw.trim()) ? raw.trim() : defaults;
    case 'pic': return isObject(raw) && goodImage(raw.phone) && goodImage(raw.desktop)
      ? { phone: raw.phone.trim(), desktop: raw.desktop.trim() } : defaults;
    case 'tone': return isObject(raw) && goodImage(raw.phone) && goodImage(raw.desktop) && typeof raw.colour === 'string' && COLOUR.test(raw.colour.trim())
      ? { colour: raw.colour.trim(), phone: raw.phone.trim(), desktop: raw.desktop.trim() } : defaults;
    default: return defaults;
  }
}

/** The schema at a dotted path inside a store ("women.hero"), or null. */
export function sectionSpec(store, path) {
  let spec = STOREFRONT_SCHEMAS[store] || null;
  for (const key of String(path || '').split('.').filter(Boolean)) spec = spec?.type === 'group' ? spec.fields[key] || null : null;
  return spec;
}

/** The raw value at a dotted path inside a store's content, or undefined. */
export function sectionContent(content, path) {
  let node = content;
  for (const key of String(path || '').split('.').filter(Boolean)) node = isObject(node) ? node[key] : undefined;
  return node;
}

/** Every image path in a store's content, in order. */
export function contentImages(store, content) {
  const found = [];
  const walk = (spec, input) => {
    if (spec.type === 'group' && isObject(input)) for (const [k, v] of Object.entries(input)) { if (spec.fields[k]) walk(spec.fields[k], v); }
    else if (spec.type === 'list' && Array.isArray(input)) input.forEach((entry) => walk(group(spec.fields), entry));
    else if (spec.type === 'image' && typeof input === 'string' && input) found.push(input);
    else if ((spec.type === 'pic' || spec.type === 'tone') && isObject(input)) for (const k of PIC_KEYS) { if (typeof input[k] === 'string' && input[k]) found.push(input[k]); }
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
    if ((spec.type === 'pic' || spec.type === 'tone') && isObject(input)) return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, PIC_KEYS.includes(k) && typeof v === 'string' && v ? swap(v) : v]));
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
