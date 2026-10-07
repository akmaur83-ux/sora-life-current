import { bY as buildTree, bK as safeVisualUrl, bZ as validatePlacement, bH as supabase, bw as uploadImage, u as useParams, Z as useNavigate, j as jsxRuntimeExports, b as Link, b_ as useSearchParams, r as reactExports, s as money, _ as useLocation } from '../bundle.js';

const CATALOGUE_STORES = {
  fashion: 'Fashion',
  homeliving: 'Home & Living',
  grocery: 'Grocery'
};
function requireCatalogueStore(store) {
  if (!Object.hasOwn(CATALOGUE_STORES, store)) throw new Error('Choose Fashion, Home & Living or Grocery.');
  return store;
}

// What each store does with the data entered here, said plainly where it is
// entered. Grocery rows can be published to /grocery but checkout does not
// price them (api/_lib/pricing.js takes only fashion and homeliving lines),
// and the grocery storefront reads no variants. GST: checkout deliberately
// ignores catalogue_products.gst_rate for every catalogue line (pricing.js
// sets gst_rate null) until the HSN codes and rates are audited, so the rate
// is captured now and applied later.
const GROCERY_NOT_SOLD = 'Grocery cannot be sold yet. Checkout does not price grocery items: a published grocery product shows on /grocery but cannot be bought. Sizes and variants entered here are not read anywhere yet.';
const GROCERY_VARIANTS_UNREAD = 'Not read anywhere yet: the grocery storefront shows the product only, and ignores these rows.';
function gstNote(store) {
  requireCatalogueStore(store);
  if (store === 'grocery') return 'GST rate is recorded only. Grocery cannot be sold yet, so no rate is charged anywhere.';
  return `GST rate is recorded, not yet applied at checkout. Checkout still uses the default GST rate for every ${CATALOGUE_STORES[store]} line until the HSN audit is complete.`;
}
const text = value => String(value ?? '').trim();
const catalogueSlug = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- Errors the editor can act on -------------------------------------------------
// A form shows these beside the field they name. Every message is collected
// before any is thrown, so one save reports every problem at once instead of
// one per attempt.
class CatalogueInputError extends Error {
  constructor(fieldErrors) {
    const messages = Object.values(fieldErrors);
    super(messages.length === 1 ? messages[0] : `Fix the ${messages.length} highlighted fields.`);
    this.name = 'CatalogueInputError';
    this.fieldErrors = fieldErrors;
  }
}
/** The row moved (or vanished) after the editor read it; nothing was written. */
class CatalogueStaleWriteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CatalogueStaleWriteError';
    this.isStaleWrite = true;
  }
}
/** Row-level security refused the write: the session is not an admin_users member. */
class CatalogueRefusedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CatalogueRefusedError';
    this.isRefused = true;
  }
}
function collector() {
  const errors = {};
  return {
    errors,
    fail(field, message) {
      if (!errors[field]) errors[field] = message;
    },
    take(field, read) {
      try {
        return read();
      } catch (error) {
        if (!errors[field]) errors[field] = error.message;
        return undefined;
      }
    },
    done() {
      if (Object.keys(errors).length) throw new CatalogueInputError(errors);
    }
  };
}
const SLUG_RULE = 'Use lowercase letters, numbers and single hyphens in the slug.';
const SKU_RULE = 'SKU must be 1–64 letters, numbers, dots, slashes, hyphens or underscores, starting with a letter or number.';
function slug(value, name) {
  const result = text(value) || catalogueSlug(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(result)) throw new Error(SLUG_RULE);
  return result;
}
function sku(value) {
  const result = text(value) || null;
  if (result && !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(result)) throw new Error(SKU_RULE);
  return result;
}
const INT_MAX = 2147483647;
function wholeNumber(value, message, {
  min = 0,
  max = INT_MAX
} = {}) {
  const n = Number(value);
  if (value == null || text(value) === '' || !Number.isInteger(n) || n < min || n > max) throw new Error(message);
  return n;
}
function amount(value, message, {
  optional = false,
  min = 0.01,
  max = 99999999.99
} = {}) {
  if (optional && (value == null || text(value) === '')) return null;
  const n = Number(value);
  if (value == null || text(value) === '' || !Number.isFinite(n) || n < min || n > max) throw new Error(message);
  return Math.round(n * 100) / 100;
}
const displayOrder = value => wholeNumber(value ?? 0, 'Display order must be a whole number.', {
  min: -2147483648
});
/** 4, 6 or 8 digits (the database CHECK). Spaces and dots are dropped: "6302 10 90" and "6302.10.90" are both 63021090. */
function hsnCode(value) {
  const digits = text(value).replace(/[\s.]/g, '');
  if (!digits) return null;
  if (!/^[0-9]{4}([0-9]{2}){0,2}$/.test(digits)) throw new Error('HSN code must be 4, 6 or 8 digits.');
  return digits;
}
const gstRate = value => amount(value, 'GST rate must be a number from 0 to 100, or blank.', {
  optional: true,
  min: 0,
  max: 100
});
const colourHex = value => {
  const hex = text(value) || null;
  if (hex && !/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Colour hex must look like #123ABC.');
  return hex;
};

// One rule per field: how a value is read, and what is wrong with it. The
// payload builders below use them, and so does the CSV planner — so a cell is
// read exactly as the editor reads the same field.
const PRODUCT_FIELD_RULES = {
  name: v => {
    const t = text(v);
    if (!t) throw new Error('Enter a product name.');
    return t;
  },
  slug: v => slug(v, ''),
  brand: v => text(v),
  description: v => text(v),
  mrp: v => amount(v, 'Enter an MRP of at least ₹0.01.'),
  sale_price: v => amount(v, 'Selling price must be at least ₹0.01, or blank to sell at MRP.', {
    optional: true
  }),
  sku: v => sku(v),
  net_content: v => text(v) || null,
  hsn_code: v => hsnCode(v),
  gst_rate: v => gstRate(v),
  stock: v => wholeNumber(v ?? 0, 'Stock must be a whole number, 0 or more.'),
  sort_order: v => displayOrder(v),
  is_new: v => v === true,
  is_bestseller: v => v === true
};
const VARIANT_FIELD_RULES = {
  colour_hex: v => colourHex(v),
  sku: v => sku(v),
  stock: v => wholeNumber(v, 'Stock must be a whole number, 0 or more.'),
  price_override: v => amount(v, 'Price override must be at least ₹0.01, or blank to use the product price.', {
    optional: true
  }),
  is_active: v => v !== false,
  sort_order: v => displayOrder(v)
};
const P = PRODUCT_FIELD_RULES,
  V = VARIANT_FIELD_RULES;
function categoryOptions(categories) {
  const tree = buildTree(categories);
  return tree.list.map(row => ({
    ...row,
    label: tree.ancestors(row.id).map(item => item.name).join(' / ')
  })).sort((a, b) => a.label.localeCompare(b.label));
}
function catalogueProductPayload(input, categories) {
  const c = collector();
  const name = text(input.name);
  if (!name) c.fail('name', 'Enter a product name.');
  const category = categories.find(row => row.id === input.category_id);
  if (!category) c.fail('category_id', 'Choose a category in this store.');else if (input.is_active && buildTree(categories).ancestors(category.id).some(row => !row.is_active)) c.fail('category_id', 'Activate this category and its parent categories before publishing.');
  const productSlug = name || text(input.slug) ? c.take('slug', () => slug(input.slug, name)) : undefined;
  const mrp = c.take('mrp', () => P.mrp(input.mrp));
  const sale_price = c.take('sale_price', () => P.sale_price(input.sale_price));
  if (sale_price != null && mrp != null && sale_price > mrp) c.fail('sale_price', `Selling price cannot be more than the MRP (₹${mrp}).`);
  const row = {
    name,
    slug: productSlug,
    category_id: category?.id,
    brand: P.brand(input.brand),
    description: P.description(input.description),
    mrp,
    sale_price,
    sku: c.take('sku', () => P.sku(input.sku)),
    net_content: P.net_content(input.net_content),
    hsn_code: c.take('hsn_code', () => P.hsn_code(input.hsn_code)),
    gst_rate: c.take('gst_rate', () => P.gst_rate(input.gst_rate)),
    stock: c.take('stock', () => P.stock(input.stock)),
    sort_order: c.take('sort_order', () => P.sort_order(input.sort_order)),
    is_active: input.is_active === true,
    is_new: P.is_new(input.is_new),
    is_bestseller: P.is_bestseller(input.is_bestseller)
  };
  c.done();
  return row;
}
function catalogueCategoryPayload(input, categories, id = null) {
  const c = collector();
  const name = text(input.name);
  if (!name) c.fail('name', 'Enter a category name.');
  const parent_id = input.parent_id || null;
  if (parent_id && !categories.some(row => row.id === parent_id)) c.fail('parent_id', 'Choose a parent category in this store.');else if (!validatePlacement(categories, {
    id,
    parentId: parent_id
  }).ok) c.fail('parent_id', 'Categories allow up to three levels and cannot contain a circular parent.');
  const categorySlug = name || text(input.slug) ? c.take('slug', () => slug(input.slug, name)) : undefined;
  // Same rule as the unique index: a slug is unique among one parent's children in one store.
  if (categorySlug && categories.some(row => row.id !== id && (row.parent_id || null) === parent_id && row.slug === categorySlug)) {
    // When the slug was made from the name, the Slug field is empty — say which slug clashed.
    c.fail('slug', text(input.slug) ? 'Another category under the same parent already uses this slug.' : `Another category under the same parent already uses the slug “${categorySlug}” made from the name. Enter a different slug.`);
  }
  const image_url = text(input.image_url) ? safeVisualUrl(input.image_url) : null;
  if (text(input.image_url) && !image_url) c.fail('image_url', 'Enter a public HTTPS image URL or a local image path.');
  const row = {
    name,
    slug: categorySlug,
    parent_id,
    tagline: text(input.tagline),
    image_url,
    sort_order: c.take('sort_order', () => displayOrder(input.sort_order)),
    is_active: input.is_active !== false
  };
  c.done();
  return row;
}
function catalogueVariantPayload(input, store, siblings = []) {
  requireCatalogueStore(store);
  const c = collector();
  const size = text(input.size),
    colour = text(input.colour);
  if (!size) c.fail('size', store === 'fashion' ? 'Enter a size. Use “One size” for a single option.' : 'Enter a size or option.');
  if (store === 'fashion' && !colour) c.fail('colour', 'Enter a colour. Use “Default” for a single option.');
  const colour_hex = c.take('colour_hex', () => V.colour_hex(input.colour_hex));
  // Same rule as the unique constraint on (product, size, colour).
  if (size && siblings.some(row => row.id !== input.id && text(row.size) === size && text(row.colour) === colour)) {
    c.fail('size', `This product already has a ${colour ? `${size} / ${colour}` : size} variant.`);
  }
  const row = {
    size,
    colour,
    colour_hex,
    sku: c.take('sku', () => V.sku(input.sku)),
    stock: c.take('stock', () => V.stock(input.stock)),
    price_override: c.take('price_override', () => V.price_override(input.price_override)),
    is_active: V.is_active(input.is_active),
    sort_order: c.take('sort_order', () => V.sort_order(input.sort_order))
  };
  c.done();
  return row;
}
function assertCataloguePublishable(store, product) {
  requireCatalogueStore(store);
  if (!(product.images || []).some(url => safeVisualUrl(url))) throw new Error('Add a product image before publishing.');
  if (store === 'fashion' && !(product.variants || []).some(row => row.is_active !== false)) throw new Error('Add at least one active size/colour variant with stock before publishing. Zero stock is allowed for sold-out products.');
}
/** The storefront page for a product, or null where the store has none (grocery has no product pages yet). */
function catalogueProductHref(store, slug) {
  requireCatalogueStore(store);
  if (store === 'grocery') return null;
  return `/${store}/p/${encodeURIComponent(slug)}`;
}

// ---- Database refusals, translated ----------------------------------------------
// The checks above run first; these catch what only the database can know
// (another admin took the slug a moment ago) and anything that slipped past.
// Constraint names are the ones 0033/0034/0035 give the catalogue tables.
const CONSTRAINT_FIELDS = {
  catalogue_products_store_slug_key: ['slug', 'Another product in this store already uses this slug.'],
  catalogue_products_slug_check: ['slug', SLUG_RULE],
  catalogue_products_store_sku_key: ['sku', 'Another product in this store already uses this SKU.'],
  catalogue_products_sku_chk: ['sku', SKU_RULE],
  catalogue_products_name_check: ['name', 'Enter a product name.'],
  catalogue_products_mrp_check: ['mrp', 'MRP cannot be negative.'],
  catalogue_products_sale_price_check: ['sale_price', 'Selling price must be between 0 and the MRP.'],
  catalogue_products_stock_chk: ['stock', 'Stock cannot be negative.'],
  catalogue_products_hsn_code_chk: ['hsn_code', 'HSN code must be 4, 6 or 8 digits.'],
  catalogue_products_gst_rate_chk: ['gst_rate', 'GST rate must be between 0 and 100.'],
  catalogue_categories_store_parent_slug_key: ['slug', 'Another category under the same parent already uses this slug.'],
  catalogue_categories_slug_check: ['slug', SLUG_RULE],
  catalogue_categories_name_check: ['name', 'Enter a category name.'],
  catalogue_categories_check: ['parent_id', 'A category cannot be its own parent.'],
  catalogue_variants_sku_key: ['sku', 'Another variant already uses this SKU. Variant SKUs are unique across every store.'],
  catalogue_variants_product_id_size_colour_key: ['size', 'This product already has a variant with this size and colour.'],
  catalogue_variants_size_check: ['size', 'Enter a size or option.'],
  catalogue_variants_colour_chk: ['colour', 'Enter a colour. Fashion variants need one.'],
  catalogue_variants_colour_hex_check: ['colour_hex', 'Colour hex must look like #123ABC.'],
  catalogue_variants_stock_check: ['stock', 'Stock cannot be negative.'],
  catalogue_variants_price_override_check: ['price_override', 'Price override cannot be negative.']
};
function catalogueWriteError(error, kind = 'row') {
  if (!error || error instanceof CatalogueInputError || error.isStaleWrite || error.isRefused) return error;
  const message = String(error.message || '');
  if (error.code === '42501' || /row-level security/i.test(message)) {
    return new CatalogueRefusedError(`The database refused to save this ${kind}: this account is not a catalogue admin. Sign in again with an admin account.`);
  }
  const constraint = /constraint "([^"]+)"/.exec(message)?.[1];
  if (constraint && CONSTRAINT_FIELDS[constraint]) {
    const [field, text] = CONSTRAINT_FIELDS[constraint];
    return new CatalogueInputError({
      [field]: text
    });
  }
  // The category depth/cycle trigger raises check_violation with its own message.
  if (error.code === '23514' && /catalogue_categories/.test(message)) return new CatalogueInputError({
    parent_id: 'Categories allow up to three levels and cannot contain a circular parent.'
  });
  return error;
}

// ---- Optimistic concurrency --------------------------------------------------------
// The editor holds the product's updated_at from when it loaded the row and
// sends it back with the save; a row that moved since is refused rather than
// overwritten. One wrinkle: every gallery write rewrites the product's
// images[] cache (the 0034 media trigger), which moves its updated_at too.
// After its OWN gallery write the editor re-reads the product and adopts the
// new token only if nothing it edits has changed — if another admin saved
// the product in between, the old token stays and the next save is refused.
const PRODUCT_EDITABLE_FIELDS = ['name', 'slug', 'category_id', 'brand', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'sort_order', 'is_active', 'is_new', 'is_bestseller'];
const same = (a, b) => a == null && b == null || a != null && b != null && String(a) === String(b);
function versionAfterOwnWrite(base, fresh, fields = PRODUCT_EDITABLE_FIELDS) {
  if (!base || !fresh) return base?.updated_at ?? null;
  return fields.every(field => same(base[field], fresh[field])) ? fresh.updated_at : base.updated_at;
}

/**
 * What a form shows after a failed save: the field errors it can place
 * beside a visible field, and a banner for everything else. A field error
 * for a field the form does not render (fashion has no product-stock input)
 * goes in the banner, so no reason is ever swallowed.
 */
function catalogueFailureView(error, visibleFields = []) {
  if (error?.fieldErrors) {
    const entries = Object.entries(error.fieldErrors);
    const fields = Object.fromEntries(entries.filter(([field]) => visibleFields.includes(field)));
    const hidden = entries.filter(([field]) => !visibleFields.includes(field)).map(([, message]) => message);
    const count = Object.keys(fields).length;
    const banner = ['Nothing was saved.', count ? `Fix the highlighted field${count === 1 ? '' : 's'} below.` : '', ...hidden].filter(Boolean).join(' ');
    return {
      fields,
      banner,
      stale: false
    };
  }
  return {
    fields: {},
    banner: error?.message || 'Something went wrong. Nothing was saved.',
    stale: !!error?.isStaleWrite
  };
}

// ---- Demo rows ------------------------------------------------------------------
// The 0033–0035 seeds are marked is_demo. "Delete demo rows" in one store is
// decided here from the rows alone, so the admin can read exactly what will
// go before anything does:
//   * every demo product goes, with its variants and images (both cascade)
//   * a demo category goes only if nothing real sits in it or anywhere under
//     it — deleting a category sets its products' category to NULL (0033:
//     on delete set null), which would orphan a real product — and a parent
//     can only go after its children (on delete restrict), so the order is
//     deepest first
//   * every demo category kept is listed with the reason
// Demo variants on a real product are not touched: the product is real.
const someNames = rows => {
  const names = rows.map(r => `“${r.name}”`);
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
};
function planDemoDelete(categories, products) {
  const byParent = new Map();
  for (const c of categories) byParent.set(c.parent_id || null, [...(byParent.get(c.parent_id || null) || []), c]);
  const below = (id, depth = 0) => depth > 3 ? [] : (byParent.get(id) || []).flatMap(child => [child, ...below(child.id, depth + 1)]);
  const depthOf = c => {
    let d = 1,
      parent = c.parent_id;
    while (parent && d < 5) {
      d += 1;
      parent = categories.find(x => x.id === parent)?.parent_id;
    }
    return d;
  };
  const realProducts = products.filter(p => p.is_demo !== true);
  const remove = [],
    kept = [];
  for (const category of categories.filter(c => c.is_demo === true)) {
    const tree = [category, ...below(category.id)];
    const ids = new Set(tree.map(c => c.id));
    const real = realProducts.filter(p => ids.has(p.category_id));
    const realCategories = tree.filter(c => c.is_demo !== true);
    const reasons = [];
    if (real.length) reasons.push(`${real.length} real product${real.length === 1 ? ' is' : 's are'} filed ${tree.length > 1 ? 'in it or under it' : 'in it'}: ${someNames(real)}`);
    if (realCategories.length) reasons.push(`it holds the real categor${realCategories.length === 1 ? 'y' : 'ies'} ${someNames(realCategories)}`);
    if (reasons.length) kept.push({
      id: category.id,
      name: category.name,
      reasons
    });else remove.push({
      id: category.id,
      name: category.name,
      depth: depthOf(category)
    });
  }
  remove.sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name));
  const demo = products.filter(p => p.is_demo === true);
  return {
    products: demo.map(p => ({
      id: p.id,
      name: p.name,
      variants: (p.variants || []).length,
      images: (p.media || []).length
    })),
    categories: remove,
    keptCategories: kept,
    demoVariantsOnRealProducts: realProducts.reduce((n, p) => n + (p.variants || []).filter(v => v.is_demo === true).length, 0)
  };
}

// ============================================================
// Catalogue images: every upload becomes a WebP under 150 KB, in the browser,
// before it leaves the admin's machine.
//
// The ladder: longest side 1600 px, then 1400, 1200, 1000, 800; at each size
// quality 0.82 down to 0.5. The first rung that fits wins, so an image is only
// made smaller or softer than it must be. A source is never upscaled, and it
// is never shrunk below 800 px to make the size: an image that cannot fit at
// 800 px is refused rather than shipped as a thumbnail — a product page needs
// the detail.
//
// The decode and encode steps are injectable: the browser path uses
// createImageBitmap and a canvas; tests drive the ladder with a fake codec.
// ============================================================

const WEBP_MAX_BYTES = 150000; // "under 150 KB" in either reading of a KB
const WEBP_SIDES = [1600, 1400, 1200, 1000, 800];
const WEBP_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5];
const SOURCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SOURCE_MAX_BYTES = 25 * 1024 * 1024;

/** Every size × quality the ladder will try for a source of this size, in order. */
function webpAttempts(width, height) {
  const longest = Math.max(width, height);
  const attempts = [],
    seen = new Set();
  for (const side of WEBP_SIDES) {
    const scale = Math.min(1, side / longest);
    const w = Math.max(1, Math.round(width * scale)),
      h = Math.max(1, Math.round(height * scale));
    if (seen.has(`${w}x${h}`)) continue; // a small source collapses several rungs into one
    seen.add(`${w}x${h}`);
    for (const quality of WEBP_QUALITIES) attempts.push({
      width: w,
      height: h,
      quality
    });
  }
  return attempts;
}
const kb$1 = bytes => `${Math.round(bytes / 1000)} KB`;
const webpName = name => `${String(name || 'image').replace(/\.[^.\\/]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'image'}.webp`;
async function decodeInBrowser(file) {
  if (typeof globalThis.createImageBitmap !== 'function') throw new Error('This browser cannot read images for upload.');
  try {
    return await globalThis.createImageBitmap(file);
  } catch {
    throw new Error(`“${file.name}” could not be read as an image.`);
  }
}
async function encodeInBrowser(bitmap, {
  width,
  height,
  quality
}) {
  const canvas = typeof globalThis.OffscreenCanvas === 'function' ? new globalThis.OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), {
    width,
    height
  });
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (canvas.convertToBlob) return canvas.convertToBlob({
    type: 'image/webp',
    quality
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image could not be encoded.')), 'image/webp', quality));
}

/**
 * Turn an uploaded image into a WebP File under maxBytes.
 * Resolves { file, width, height, quality, bytes, sourceBytes }.
 */
async function compressToWebp(file, {
  decode = decodeInBrowser,
  encode = encodeInBrowser,
  maxBytes = WEBP_MAX_BYTES
} = {}) {
  if (!file || typeof file !== 'object') throw new Error('No image selected.');
  if (!SOURCE_TYPES.includes(file.type)) throw new Error(`“${file.name}” is ${file.type ? `a ${file.type} file` : 'not an image'}. Use JPEG, PNG or WebP.`);
  if (!(file.size > 0)) throw new Error(`“${file.name}” is empty.`);
  if (file.size > SOURCE_MAX_BYTES) throw new Error(`“${file.name}” is ${Math.round(file.size / 1024 / 1024)} MB. Use an image under 25 MB.`);
  const image = await decode(file);
  try {
    if (!(image.width > 0 && image.height > 0)) throw new Error(`“${file.name}” has no usable size.`);
    for (const attempt of webpAttempts(image.width, image.height)) {
      const blob = await encode(image, attempt);
      // Safari's canvas silently falls back to PNG for an encoder it lacks.
      if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot create WebP images. Upload from Chrome, Edge or Firefox.');
      if (blob.size <= maxBytes) {
        return {
          file: new File([blob], webpName(file.name), {
            type: 'image/webp'
          }),
          width: attempt.width,
          height: attempt.height,
          quality: attempt.quality,
          bytes: blob.size,
          sourceBytes: file.size
        };
      }
    }
  } finally {
    image.close?.();
  }
  throw new Error(`“${file.name}” could not be brought under ${kb$1(maxBytes)} at ${WEBP_SIDES[WEBP_SIDES.length - 1]} px or more. Crop it closer, or use a less detailed image.`);
}

// Uses existing admin RLS. No service credentials, schema changes or wellness writes.
const PRODUCT_SELECT = '*, variants:catalogue_variants (*), media:catalogue_product_media (*)';
async function result(query, kind) {
  const {
    data,
    error
  } = await query;
  if (error) throw catalogueWriteError(error, kind);
  return data;
}
async function allRows(table, store, select = '*') {
  requireCatalogueStore(store);
  const rows = [];
  for (let start = 0;; start += 500) {
    const page = await result(supabase.from(table).select(select).eq('store', store).order('sort_order', {
      ascending: true
    }).order('id', {
      ascending: true
    }).range(start, start + 499));
    rows.push(...(page || []));
    if (!page || page.length < 500) return rows;
  }
}

/**
 * UPDATE one row only if it is still the version the editor read.
 *
 * `expectedUpdatedAt` becomes an equality filter, so a row that moved since
 * matches nothing and nothing is written. Zero rows then has three possible
 * causes, and the admin needs to know which: the row is gone, the row moved
 * (someone else saved), or the row is unchanged — which means row-level
 * security filtered the UPDATE out, i.e. this session is not an admin.
 */
async function guardedUpdate(table, filters, row, expectedUpdatedAt, kind) {
  if (!expectedUpdatedAt) {
    throw new CatalogueStaleWriteError(`Reload this ${kind} before saving: the editor did not record which version it opened.`);
  }
  let query = supabase.from(table).update(row);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  // `.select()` without `.single()`: zero rows is the expected result of a
  // lost race, and must not surface as a generic "no rows" error.
  const data = await result(query.eq('updated_at', expectedUpdatedAt).select(), kind);
  if (data?.length) return data[0];
  let check = supabase.from(table).select('id, updated_at');
  for (const [key, value] of Object.entries(filters)) check = check.eq(key, value);
  const current = await result(check.maybeSingle());
  if (!current) throw new CatalogueStaleWriteError(`This ${kind} could not be found — it may have been deleted while you were editing. Nothing was saved.`);
  if (current.updated_at !== expectedUpdatedAt) {
    throw new CatalogueStaleWriteError(`This ${kind} was changed elsewhere after you opened it. Nothing was saved — reload to see the current version, then reapply your changes.`);
  }
  throw new CatalogueRefusedError(`The database refused to save this ${kind}: this account is not a catalogue admin. Sign in again with an admin account.`);
}

/**
 * Write one row with no version check (reorder, primary, detach — each states
 * its own intent and is safe to repeat), and still explain zero rows: the row
 * is gone, or row-level security filtered the write out.
 */
async function writeOne(query, table, filters, kind) {
  const data = await result(query.select('id'), kind);
  if (data?.length) return data[0];
  let check = supabase.from(table).select('id');
  for (const [key, value] of Object.entries(filters)) check = check.eq(key, value);
  const current = await result(check.maybeSingle());
  if (!current) throw new CatalogueStaleWriteError(`This ${kind} was already removed — reload to see the current gallery. Nothing was saved.`);
  throw new CatalogueRefusedError(`The database refused to change this ${kind}: this account is not a catalogue admin. Sign in again with an admin account.`);
}

/** A field's value as its rule reads it, or null if the rule refuses it (that refusal is reported separately). */
const readable = (rule, value) => {
  try {
    return rule(value);
  } catch {
    return null;
  }
};

/**
 * Product slugs and SKUs another product in this store already holds: { field: message }.
 * `autoSlug`: the slug was made from the name, so the Slug field is empty — the message names it.
 */
async function productKeyClashes(store, id, keys, {
  autoSlug = false
} = {}) {
  const errors = {};
  for (const field of ['slug', 'sku']) {
    if (!keys[field]) continue;
    let query = supabase.from('catalogue_products').select('id').eq('store', store).eq(field, keys[field]);
    if (id) query = query.neq('id', id);
    const taken = await result(query.limit(1));
    if (!taken?.length) continue;
    errors[field] = field === 'sku' ? 'Another product in this store already uses this SKU.' : autoSlug ? `Another product in this store already uses the slug “${keys.slug}” made from the name. Enter a different slug.` : 'Another product in this store already uses this slug.';
  }
  return errors;
}

/** Variant SKUs are unique across EVERY store (the 0033 constraint), so the check is not store-scoped. */
async function variantSkuClash(id, sku) {
  if (!sku) return {};
  let query = supabase.from('catalogue_variants').select('id, store').eq('sku', sku);
  if (id) query = query.neq('id', id);
  const taken = await result(query.limit(1));
  return taken?.length ? {
    sku: `This SKU is already used by another variant${taken[0].store ? ` (${taken[0].store} store)` : ''}. Variant SKUs are unique across every store.`
  } : {};
}

/**
 * The payload rules, then the availability checks — run even when a rule
 * failed, so one save reports every problem (a clashing slug as well as a
 * bad HSN), never one per attempt. A field's own rule error wins over a clash.
 */
async function validated(build, clashes) {
  let row = null,
    ruleErrors = {};
  try {
    row = build();
  } catch (error) {
    if (!error.fieldErrors) throw error;
    ruleErrors = error.fieldErrors;
  }
  const errors = {
    ...(await clashes(row)),
    ...ruleErrors
  };
  if (Object.keys(errors).length) throw new CatalogueInputError(errors);
  return row;
}
const listStoreCategories = store => allRows('catalogue_categories', store);
const listStoreProducts = store => allRows('catalogue_products', store, PRODUCT_SELECT);
async function getStoreProduct(store, id) {
  requireCatalogueStore(store);
  const row = await result(supabase.from('catalogue_products').select(PRODUCT_SELECT).eq('store', store).eq('id', id).maybeSingle());
  // A save path that re-reads the product finds it gone: say so, as a stale write — nothing was saved.
  if (!row) throw new CatalogueStaleWriteError('This product could not be found in this store — it may have been deleted. Nothing was saved.');
  return row;
}
/**
 * Create a draft (no id) or update a product. An update must carry the
 * updated_at the editor loaded; it is refused, not applied, if the row moved.
 */
async function saveStoreProduct(store, id, input, expectedUpdatedAt = null) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  const autoSlug = !String(input.slug ?? '').trim();
  const row = await validated(() => catalogueProductPayload(input, categories), built => productKeyClashes(store, id, built || {
    slug: readable(PRODUCT_FIELD_RULES.slug, autoSlug ? catalogueSlug(input.name) : input.slug),
    sku: readable(PRODUCT_FIELD_RULES.sku, input.sku)
  }, {
    autoSlug
  }));
  // First create a draft; images/variants can then be saved against its real id.
  if (!id) return result(supabase.from('catalogue_products').insert({
    ...row,
    store,
    is_active: false
  }).select().single(), 'product');
  if (row.is_active) assertCataloguePublishable(store, await getStoreProduct(store, id));
  return guardedUpdate('catalogue_products', {
    store,
    id
  }, row, expectedUpdatedAt, 'product');
}
async function saveStoreCategory(store, id, input, expectedUpdatedAt = null) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  if (id && !categories.some(row => row.id === id)) throw new Error('Category not found in this store.');
  const row = catalogueCategoryPayload(input, categories, id);
  if (id) return guardedUpdate('catalogue_categories', {
    store,
    id
  }, row, expectedUpdatedAt, 'category');
  return result(supabase.from('catalogue_categories').insert({
    ...row,
    store
  }).select().single(), 'category');
}
async function saveStoreVariant(store, productId, id, input, expectedUpdatedAt = null) {
  requireCatalogueStore(store);
  const product = await getStoreProduct(store, productId);
  if (id && !(product.variants || []).some(v => v.id === id)) throw new Error('Variant not found on this product.');
  const row = await validated(() => catalogueVariantPayload({
    ...input,
    id
  }, store, product.variants || []), built => variantSkuClash(id, built ? built.sku : readable(VARIANT_FIELD_RULES.sku, input.sku)));
  if (id) return guardedUpdate('catalogue_variants', {
    store,
    product_id: productId,
    id
  }, row, expectedUpdatedAt, 'variant');
  return result(supabase.from('catalogue_variants').insert({
    ...row,
    store,
    product_id: productId
  }).select().single(), 'variant');
}
// ---- Images ---------------------------------------------------------------------
// Every catalogue upload is converted to a WebP under 150 KB in the browser
// first (storeCatalogueImage.js), then stored through the same admin-only
// path every product image uses: uploadImage → the product-images bucket,
// whose storage policy admits admin_users members only.
const BUCKET_PREFIX = '/storage/v1/object/public/product-images/';
/** The object path inside product-images, recorded on the media row so a later clean-up can find the file. */
function storagePathOf(url) {
  const at = String(url || '').indexOf(BUCKET_PREFIX);
  if (at < 0) return null;
  const path = decodeURIComponent(String(url).slice(at + BUCKET_PREFIX.length).split('?')[0]);
  return /^[A-Za-z0-9/_.-]+$/.test(path) && !path.includes('..') ? path : null;
}
/** Store a converted image; a refusal from the bucket's policy reads as one. */
async function storeWebp(store, webp) {
  try {
    return await uploadImage(webp.file, `catalogue/${store}`);
  } catch (error) {
    throw catalogueWriteError(error, 'image');
  }
}
async function uploadStoreImageFile(store, file) {
  requireCatalogueStore(store);
  const webp = await compressToWebp(file);
  const url = await storeWebp(store, webp);
  return {
    url,
    storage_path: storagePathOf(url),
    bytes: webp.bytes,
    width: webp.width,
    height: webp.height
  };
}
/** One image (a category picture, or the add-by-URL form's upload): the WebP's public URL. */
async function uploadStoreImage(store, file) {
  return (await uploadStoreImageFile(store, file)).url;
}
/**
 * Add several images to a product's gallery, one at a time. A file that fails
 * (unreadable, cannot fit 150 KB, upload refused) is reported and the rest go
 * on. The first image a product ever gets becomes its primary.
 * onProgress(index, { name, status: converting|uploading|added|failed, bytes?, error? })
 */
async function addStoreImages(store, productId, files, onProgress = () => {}) {
  requireCatalogueStore(store);
  const results = [];
  for (const [index, file] of [...files].entries()) {
    const report = (status, extra = {}) => onProgress(index, {
      name: file?.name || `Image ${index + 1}`,
      status,
      ...extra
    });
    try {
      report('converting');
      const webp = await compressToWebp(file);
      report('uploading', {
        bytes: webp.bytes
      });
      const public_url = await storeWebp(store, webp);
      const product = await getStoreProduct(store, productId); // re-read: order and primary as they are now
      const media = product.media || [];
      const row = {
        product_id: productId,
        public_url,
        storage_path: storagePathOf(public_url),
        alt_text: product.name,
        sort_order: media.length ? Math.max(...media.map(m => Number(m.sort_order) || 0)) + 1 : 0,
        is_primary: !media.length
      };
      await result(supabase.from('catalogue_product_media').insert(row).select().single(), 'image');
      report('added', {
        bytes: webp.bytes
      });
      results.push({
        name: file?.name,
        ok: true,
        bytes: webp.bytes
      });
    } catch (error) {
      report('failed', {
        error: error.message
      });
      results.push({
        name: file?.name,
        ok: false,
        error: error.message
      });
    }
  }
  return results;
}
/** Put the gallery in this order (sort_order 0…n-1). The ids must be exactly the product's images. */
async function reorderStoreMedia(store, productId, orderedIds) {
  const product = await getStoreProduct(store, productId);
  const media = product.media || [];
  if (orderedIds.length !== media.length || !media.every(m => orderedIds.includes(m.id))) {
    throw new CatalogueStaleWriteError('The gallery changed while you were reordering it. Nothing was saved — reload and try again.');
  }
  for (const [index, id] of orderedIds.entries()) {
    if (Number(media.find(m => m.id === id).sort_order) === index) continue;
    await writeOne(supabase.from('catalogue_product_media').update({
      sort_order: index
    }).eq('product_id', productId).eq('id', id), 'catalogue_product_media', {
      product_id: productId,
      id
    }, 'image');
  }
}
/** Make one image the primary; the 0034 trigger demotes the others. */
async function setStoreMediaPrimary(store, productId, id) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some(m => m.id === id)) throw new CatalogueStaleWriteError('That image is no longer on this product. Reload to see the current gallery.');
  await writeOne(supabase.from('catalogue_product_media').update({
    is_primary: true
  }).eq('product_id', productId).eq('id', id), 'catalogue_product_media', {
    product_id: productId,
    id
  }, 'image');
}
/** Change an image's alt text, refused if the image changed since it was read. */
async function saveStoreMediaAlt(store, productId, id, altText, expectedUpdatedAt) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some(m => m.id === id)) throw new CatalogueStaleWriteError('That image is no longer on this product. Reload to see the current gallery.');
  const alt_text = String(altText || '').trim();
  if (alt_text.length > 300) throw new CatalogueInputError({
    alt_text: 'Keep alt text under 300 characters.'
  });
  return guardedUpdate('catalogue_product_media', {
    product_id: productId,
    id
  }, {
    alt_text
  }, expectedUpdatedAt, 'image');
}
async function saveStoreMedia(store, productId, id, input) {
  requireCatalogueStore(store);
  const public_url = safeVisualUrl(input.public_url);
  if (!public_url) throw new CatalogueInputError({
    public_url: 'Enter a public HTTPS image URL or a local image path.'
  });
  const product = await getStoreProduct(store, productId);
  if (id && !(product.media || []).some(m => m.id === id)) throw new Error('Image not found on this product.');
  if (id && product.media.find(m => m.id === id)?.is_primary && input.is_primary !== true) throw new Error('Choose another gallery image as primary before clearing this one.');
  const sort_order = Number(input.sort_order ?? 0);
  if (!Number.isInteger(sort_order) || sort_order < -2147483648 || sort_order > 2147483647) throw new CatalogueInputError({
    sort_order: 'Image order must be a whole number.'
  });
  const row = {
    public_url,
    alt_text: String(input.alt_text || '').trim(),
    sort_order,
    is_primary: input.is_primary === true || !(product.media || []).length
  };
  const query = id ? supabase.from('catalogue_product_media').update(row).eq('product_id', productId).eq('id', id) : supabase.from('catalogue_product_media').insert({
    ...row,
    product_id: productId
  });
  // Existing media trigger updates images[] for both storefronts. Never write the cache directly.
  return result(query.select().single(), 'image');
}
async function removeStoreMedia(store, productId, id) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some(m => m.id === id)) throw new Error('Image not found on this product.');
  if (product.is_active && product.media.length < 2) throw new Error('Keep one image on a published product, or save it as a draft first.');
  // Detach only; never delete an original Storage object.
  await writeOne(supabase.from('catalogue_product_media').delete().eq('product_id', productId).eq('id', id), 'catalogue_product_media', {
    product_id: productId,
    id
  }, 'image');
}

// ---- CSV import: apply a plan ----------------------------------------------------
/**
 * Apply a plan from storeCatalogueCsv.js, row by row, through the editor's
 * own save functions — the same validation, uniqueness checks and
 * stale-write guard (each row carries the updated_at it was planned
 * against). A row that fails is reported; the rest go on, as in the
 * wellness content import.
 */
async function applyCatalogueImport(store, plan, onProgress = () => {}) {
  requireCatalogueStore(store);
  const done = [],
    failed = [];
  for (const [index, change] of (plan?.changes || []).entries()) {
    try {
      if (plan.kind === 'products') await saveStoreProduct(store, change.kind === 'create' ? null : change.id, change.input, change.expectedUpdatedAt);else await saveStoreVariant(store, change.productId, change.kind === 'create' ? null : change.variantId, change.input, change.expectedUpdatedAt);
      done.push(change);
    } catch (error) {
      const reason = error.isStaleWrite ? 'Changed since this file was planned — choose the file again to plan against the current values.' : error.fieldErrors ? Object.values(error.fieldErrors).join(' ') : error.message;
      failed.push({
        line: change.line,
        key: change.slug || change.label,
        reason
      });
    }
    onProgress(index + 1, plan.changes.length);
  }
  return {
    done,
    failed
  };
}

// ---- Deletes ----------------------------------------------------------------------
/** DELETE one row only if it is still the version the admin was looking at; zero rows is explained. */
async function guardedDelete(table, filters, expectedUpdatedAt, kind) {
  if (!expectedUpdatedAt) throw new CatalogueStaleWriteError(`Reload before deleting this ${kind}: the page did not record which version it showed.`);
  let query = supabase.from(table).delete();
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const data = await result(query.eq('updated_at', expectedUpdatedAt).select('id'), kind);
  if (data?.length) return;
  let check = supabase.from(table).select('id, updated_at');
  for (const [key, value] of Object.entries(filters)) check = check.eq(key, value);
  const current = await result(check.maybeSingle());
  if (!current) throw new CatalogueStaleWriteError(`This ${kind} was already deleted. Reload to see the current list.`);
  if (current.updated_at !== expectedUpdatedAt) throw new CatalogueStaleWriteError(`This ${kind} was changed elsewhere after you opened it. Nothing was deleted — reload and check it first.`);
  throw new CatalogueRefusedError(`The database refused to delete this ${kind}: this account is not a catalogue admin. Sign in again with an admin account.`);
}
/**
 * Delete one size × colour for good. Carts holding it then show it as no
 * longer sold (the cart hydrators' "variant missing" path) and the server
 * refuses it at checkout; past orders keep their own copy of the line.
 * A published Fashion product keeps at least one active variant — the same
 * rule publishing enforces.
 */
async function deleteStoreVariant(store, productId, id, expectedUpdatedAt) {
  requireCatalogueStore(store);
  const product = await getStoreProduct(store, productId);
  const variant = (product.variants || []).find(v => v.id === id);
  if (!variant) throw new CatalogueStaleWriteError('This variant is no longer on the product. Reload to see the current sizes.');
  if (store === 'fashion' && product.is_active && !product.variants.some(v => v.id !== id && v.is_active !== false)) {
    throw new Error('A published Fashion product needs at least one active size/colour. Add another first, or unpublish the product.');
  }
  await guardedDelete('catalogue_variants', {
    store,
    product_id: productId,
    id
  }, expectedUpdatedAt, 'variant');
}

/** What "delete demo rows" would do in this store, read fresh (planDemoDelete). */
async function previewStoreDemoDelete(store) {
  requireCatalogueStore(store);
  const [categories, products] = await Promise.all([listStoreCategories(store), listStoreProducts(store)]);
  return planDemoDelete(categories, products);
}
const sameIds = (a, b) => JSON.stringify(a.map(x => String(x.id)).sort()) === JSON.stringify(b.map(x => String(x.id)).sort());
/**
 * Delete the demo rows the admin reviewed — and only if a fresh look agrees
 * with what they reviewed. Products first (their variants and images
 * cascade), then the demo categories with nothing real in them, deepest
 * first; immediately before the categories go, the store is checked again
 * for a real product filed in one of them since.
 */
async function deleteStoreDemoRows(store, reviewed) {
  requireCatalogueStore(store);
  const fresh = await previewStoreDemoDelete(store);
  if (!reviewed || !sameIds(fresh.products, reviewed.products) || !sameIds(fresh.categories, reviewed.categories)) {
    throw new CatalogueStaleWriteError('The demo rows changed since you reviewed them. Nothing was deleted — review them again.');
  }
  const summary = {
    products: 0,
    variants: 0,
    images: 0,
    categories: 0,
    kept: fresh.keptCategories
  };
  if (fresh.products.length) {
    const gone = await result(supabase.from('catalogue_products').delete().eq('store', store).eq('is_demo', true).in('id', fresh.products.map(p => p.id)).select('id'), 'product');
    if (!gone?.length) throw new CatalogueRefusedError('The database refused to delete the demo products: this account is not a catalogue admin. Nothing was deleted.');
    const ids = new Set(gone.map(r => String(r.id)));
    for (const p of fresh.products) if (ids.has(String(p.id))) {
      summary.products += 1;
      summary.variants += p.variants;
      summary.images += p.images;
    }
  }
  if (fresh.categories.length) {
    const ids = fresh.categories.map(c => c.id);
    const real = await result(supabase.from('catalogue_products').select('id, name').eq('store', store).eq('is_demo', false).in('category_id', ids).limit(1));
    if (real?.length) {
      throw new CatalogueStaleWriteError(`${summary.products} demo product${summary.products === 1 ? ' was' : 's were'} deleted, but no category was: “${real[0].name}” was filed in one of them meanwhile. Review the demo rows again.`);
    }
    for (const depth of [...new Set(fresh.categories.map(c => c.depth))].sort((a, b) => b - a)) {
      const level = fresh.categories.filter(c => c.depth === depth).map(c => c.id);
      const gone = await result(supabase.from('catalogue_categories').delete().eq('store', store).eq('is_demo', true).in('id', level).select('id'), 'category');
      summary.categories += gone?.length || 0;
    }
    if (!summary.categories && !summary.products) throw new CatalogueRefusedError('The database refused to delete the demo categories: this account is not a catalogue admin. Nothing was deleted.');
  }
  return summary;
}

// ============================================================
// Claim warnings — WARN, never block.
//
// Product copy is screened for three kinds of claim SORA LIFE cannot back
// without proof it does not hold today:
//   * medical or treatment claims — the Biosash ingest screen's vocabulary
//     (scripts/ingest-biosash-content.mjs, DISEASE_TERMS + TREATMENT_TERMS),
//     matched the same way: whole words, case-insensitive, an optional
//     plural, deliberately blunt ("treats" flags even when innocent)
//   * speed claims — delivery and dispatch promises (standard delivery is
//     6–7 days; Express and Scheduled were withdrawn) and "instant results"
//   * sustainability claims — eco, organic, biodegradable, recycled, carbon
//     neutral… each needs a certificate or evidence behind it
//
// The result says which word matched and shows it in context, so the admin
// can judge; nothing here stops a save or an import.
// test-store-catalogue-claims.mjs pins that the medical list still contains
// every term the ingest screen uses.
// ============================================================

const MEDICAL_TERMS = [
// Named conditions (the ingest screen's DISEASE_TERMS).
'impotence', 'impotency', 'erectile dysfunction', 'premature ejaculation', 'infertility', 'libido', 'sexual weakness', 'sexual dysfunction', 'aphrodisiac', 'arthritis', 'osteoarthritis', 'rheumatism', 'rheumatoid', 'gout', 'diabetes', 'diabetic', 'blood sugar', 'insulin', 'cancer', 'tumour', 'tumor', 'carcinogen', 'chemotherapy', 'blood pressure', 'hypertension', 'hypotension', 'cholesterol', 'asthma', 'bronchitis', 'tuberculosis', 'pneumonia', 'ulcer', 'piles', 'haemorrhoid', 'hemorrhoid', 'constipation', 'jaundice', 'hepatitis', 'liver disease', 'kidney stone', 'renal', 'thyroid', 'anaemia', 'anemia', 'osteoporosis', 'depression', 'anxiety disorder', 'insomnia', 'alzheimer', 'dementia', 'infection', 'inflammatory disease', 'immunity booster', 'menopause', 'menstrual disorder', 'leucorrhoea', 'leukorrhea', 'obesity', 'stroke', 'heart disease', 'cardiac', 'migraine', 'epilepsy',
// Treatment language (the ingest screen's TREATMENT_TERMS).
'cure', 'cures', 'curing', 'treat', 'treats', 'treating', 'treatment of', 'remedy', 'remedies', 'heals', 'healing of', 'prevents disease', 'medicine for', 'medicinal use', 'therapeutic', 'clinically proven', 'doctor recommended', 'prescription'];
const SUSTAINABILITY_TERMS = ['eco-friendly', 'eco friendly', 'environment-friendly', 'environment friendly', 'environmentally friendly', 'earth-friendly', 'earth friendly', 'planet-friendly', 'planet friendly', 'sustainable', 'sustainably', 'sustainability', 'biodegradable', 'compostable', 'recyclable', 'recycled', 'upcycled', 'organic', 'carbon neutral', 'carbon-neutral', 'net zero', 'net-zero', 'zero waste', 'zero-waste', 'plastic-free', 'plastic free', 'chemical-free', 'chemical free', 'toxin-free', 'non-toxic', 'ethically sourced', 'ethically made', 'fair trade', 'fairtrade', 'renewable', 'low impact', 'low-impact', 'green choice'];

// Speed is phrased too many ways for a word list; each pattern names what it caught.
const SPEED_PATTERNS = [/\b(?:fast|faster|fastest|quick|quicker|express|speedy|rapid|super[- ]?fast|lightning[- ]?fast|instant)(?:\s*(?:&|and)\s*[a-z]+)?\s+(?:delivery|deliveries|shipping|dispatch)\b/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\bovernight\s+(?:delivery|shipping|dispatch)\b/i, /\bdeliver(?:ed|s|y)?\s+(?:in|within)\s+(?:\d+|one|two|three)\s*(?:-\s*\d+\s*)?(?:hours?|hrs?|days?|business days?)\b/i, /\b(?:within|in)\s+(?:24|48|72)\s*(?:hours?|hrs?)\b/i, /\b(?:ships?|dispatched|dispatches)\s+(?:today|same day|immediately|within\s+\d+)/i, /\binstant(?:ly)?\s+(?:results?|relief|effect)\b/i, /\bresults?\s+in\s+\d+\s*(?:minutes?|hours?|days?)\b/i];
const CLAIM_KINDS = {
  medical: 'Medical or treatment claim',
  speed: 'Speed claim',
  sustainability: 'Sustainability claim'
};
const escape = term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termPattern = term => new RegExp(`(^|[^a-z])(${escape(term)}(?:e?s)?)(?=[^a-z]|$)`, 'i');
const MEDICAL = MEDICAL_TERMS.map(term => [term, termPattern(term)]);
const GREEN = SUSTAINABILITY_TERMS.map(term => [term, termPattern(term)]);

/** The match with about 30 characters either side, cut at whole words. */
function excerpt(text, index, length) {
  const start = Math.max(0, index - 30),
    end = Math.min(text.length, index + length + 30);
  let slice = text.slice(start, end);
  const inWord = i => /\S/.test(text[i - 1] || '') && /\S/.test(text[i] || '');
  if (start > 0 && inWord(start)) slice = slice.replace(/^\S*\s*/, ''); // began mid-word: drop the fragment
  if (end < text.length && inWord(end)) slice = slice.replace(/\s*\S*$/, '');
  return `${start > 0 ? '…' : ''}${slice.replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

/** Every claim in one piece of text: [{ kind, term, excerpt }], one per distinct term, in reading order. */
function claimWarnings(text) {
  const source = String(text || '');
  if (!source.trim()) return [];
  const found = [];
  const add = (kind, match, offset) => {
    const term = match.trim().toLowerCase();
    if (found.some(f => f.kind === kind && f.term === term)) return;
    found.push({
      kind,
      term,
      at: offset,
      excerpt: excerpt(source, offset, match.length)
    });
  };
  for (const [, re] of MEDICAL) {
    const m = re.exec(source);
    if (m) add('medical', m[2], m.index + m[1].length);
  }
  for (const re of SPEED_PATTERNS) {
    const m = re.exec(source);
    if (m) add('speed', m[0], m.index);
  }
  for (const [, re] of GREEN) {
    const m = re.exec(source);
    if (m) add('sustainability', m[2], m.index + m[1].length);
  }
  // A longer term already covers a shorter one at the same place ("treatment of" / "treat").
  const kept = found.filter(f => !found.some(g => g !== f && g.kind === f.kind && g.term.length > f.term.length && g.at <= f.at && f.at < g.at + g.term.length));
  return kept.sort((a, b) => a.at - b.at).map(({
    kind,
    term,
    excerpt: e
  }) => ({
    kind,
    term,
    excerpt: e
  }));
}

/** Warnings for a product's customer-facing copy, each tagged with the field it came from. */
function productClaimWarnings(product) {
  return [['name', 'Name'], ['description', 'Description']].flatMap(([field, label]) => claimWarnings(product?.[field]).map(w => ({
    ...w,
    field,
    label
  })));
}

// ============================================================
// Store catalogue — CSV bulk import, the wellness pattern (productContentCsv.js
// and ContentCoverage's apply) carried over to the catalogue tables.
//
//   export → edit in a spreadsheet → import → PLAN → read it → APPLY
//
// Nothing here writes. A plan says, row by row, what WOULD change; the page
// applies it through the same save functions the editor uses — same
// validation, same uniqueness checks, same stale-write guard (each planned
// row carries the updated_at it was planned against).
//
// The rules, as in the wellness import:
//   * a BLANK cell means "no opinion, leave it alone" — never "clear it";
//     clearing is a deliberate act and belongs in the editor
//   * FILL-ONLY by default: a cell fills a field that is empty; a field that
//     already has a value is reported as kept, not changed. Overwrite is a
//     separate, explicit choice. (Prices, stock and flags always have a
//     value, so changing them needs Overwrite.)
//   * each cell is read by the editor's own rule for that field
//     (PRODUCT_FIELD_RULES / VARIANT_FIELD_RULES); then the row as it would
//     be written — current values plus only the changes that apply — is
//     validated whole. A row with any problem is skipped with its reason,
//     never half-applied
//   * new rows are created only when asked, and products only as drafts —
//     publishing stays a per-product act with its image (and, for fashion,
//     variant) checks; is_active is not a product import column
//
// Two files: products (one row per product) and variants (one row per size ×
// colour, matched on the product's slug, the size and the colour).
// ============================================================
const PRODUCT_CSV_COLUMNS = ['id', 'slug', 'name', 'brand', 'category', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'is_new', 'is_bestseller', 'sort_order'];
const VARIANT_CSV_COLUMNS = ['product_slug', 'size', 'colour', 'colour_hex', 'sku', 'stock', 'price_override', 'is_active', 'sort_order'];
const PRODUCT_FIELDS$1 = ['slug', 'name', 'brand', 'category_id', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'is_new', 'is_bestseller', 'sort_order'];
const VARIANT_FIELDS$1 = ['colour_hex', 'sku', 'stock', 'price_override', 'is_active', 'sort_order'];
const MONEY = new Set(['mrp', 'sale_price', 'price_override']);
const NUMBER = new Set(['mrp', 'sale_price', 'price_override', 'gst_rate', 'stock', 'sort_order']);
const BOOLEAN = new Set(['is_new', 'is_bestseller', 'is_active']);
const FIELD_LABELS = {
  slug: 'Slug',
  name: 'Name',
  brand: 'Brand',
  category_id: 'Category',
  description: 'Description',
  mrp: 'MRP',
  sale_price: 'Selling price',
  sku: 'SKU',
  net_content: 'Pack / dimensions',
  hsn_code: 'HSN code',
  gst_rate: 'GST rate',
  stock: 'Stock',
  is_new: 'New arrival',
  is_bestseller: 'Bestseller',
  sort_order: 'Display order',
  colour_hex: 'Colour hex',
  price_override: 'Price override',
  is_active: 'Active'
};

// ---------- parse ----------
/**
 * RFC 4180-ish: quoted fields, doubled quotes, newlines inside quotes, a
 * spreadsheet's byte-order mark. The same parser as productContentCsv.js —
 * copied, not imported, so this admin chunk does not pull the wellness
 * importer into a shared chunk and reshuffle the storefront bundle's exports.
 * test-store-catalogue-csv.mjs pins that the two agree.
 */
function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [],
    cur = '',
    quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === ',') {
      row.push(cur);
      cur = '';
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

// ---------- export ----------
const cell = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// A byte-order mark, so a spreadsheet opens "40 × 40 cm" and "₹" as written; parseCsv strips it.
const csv = (columns, rows) => `﻿${[columns.join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\n')}\n`;
/** Each category's path by slug ("clothing/shirts") — the form the export writes and the import reads. */
function categoryPaths(categories) {
  const byId = new Map(categories.map(c => [c.id, c]));
  const path = (c, depth = 0) => c.parent_id && byId.has(c.parent_id) && depth < 3 ? `${path(byId.get(c.parent_id), depth + 1)}/${c.slug}` : c.slug;
  return new Map(categories.map(c => [c.id, path(c)]));
}
function productsToCsv(products, categories) {
  const paths = categoryPaths(categories);
  return csv(PRODUCT_CSV_COLUMNS, products.map(p => ({
    ...p,
    category: paths.get(p.category_id) || ''
  })));
}
function variantsToCsv(products) {
  const rows = [];
  for (const p of products) for (const v of p.variants || []) rows.push({
    ...v,
    product_slug: p.slug
  });
  return csv(VARIANT_CSV_COLUMNS, rows);
}

// ---------- reading ----------
const blank = v => String(v ?? '').trim() === '';
const present = v => v !== null && v !== undefined && v !== '';
function sameValue(field, a, b) {
  if (!present(a) && !present(b)) return true;
  if (!present(a) || !present(b)) return false;
  if (NUMBER.has(field)) return Number(a) === Number(b);
  return String(a) === String(b);
}
/** A cell, read by the editor's rule for its field. Throws with the reason. */
function readCell(field, raw, rules) {
  const s = String(raw).trim();
  if (BOOLEAN.has(field)) {
    if (/^(true|yes|y|1)$/i.test(s)) return true;
    if (/^(false|no|n|0)$/i.test(s)) return false;
    throw new Error(`${FIELD_LABELS[field]}: use yes or no.`);
  }
  return rules[field](MONEY.has(field) ? s.replace(/[₹,\s]/g, '') : s);
}
function resolveCategory(value, categories) {
  const want = String(value).trim().toLowerCase().replace(/\s*\/\s*/g, '/');
  const paths = categoryPaths(categories);
  for (const c of categories) if (paths.get(c.id) === want) return c.id;
  for (const row of categoryOptions(categories)) if (row.label.toLowerCase().replace(/\s*\/\s*/g, '/') === want) return row.id;
  return null;
}
/** Which of a row's values change, and which are kept by fill-only. */
function diffRow(current, values, fields, {
  overwrite,
  creating
}) {
  const diffs = [],
    applied = {};
  for (const field of fields) {
    if (!(field in values)) continue;
    const before = current ? current[field] : null;
    if (sameValue(field, before, values[field])) continue;
    if (!creating && present(before) && !overwrite) {
      diffs.push({
        field,
        before,
        after: values[field],
        skipped: true,
        reason: 'already has a value (fill-only)'
      });
      continue;
    }
    diffs.push({
      field,
      before,
      after: values[field]
    });
    applied[field] = values[field];
  }
  return {
    diffs,
    applied
  };
}
const reasons = error => (error?.fieldErrors ? Object.values(error.fieldErrors) : [error?.message || String(error)]).join(' ');
const linesOf = (map, line) => [...map.values()].find(lines => lines.includes(line)) || [line];

// ---------- plan: products ----------
function planProductImport(text, {
  store,
  products,
  categories,
  overwrite = false,
  create = false
}) {
  const rows = parseCsv(text);
  if (!rows.length) return {
    ok: false,
    reason: 'The file is empty.',
    changes: [],
    kept: [],
    skipped: []
  };
  const head = rows[0].map(h => h.trim().toLowerCase());
  if (!head.includes('slug') && !head.includes('id')) return {
    ok: false,
    reason: 'The file needs a "slug" or "id" column to match products on.',
    changes: [],
    kept: [],
    skipped: []
  };
  const ignored = head.filter(h => h && !PRODUCT_CSV_COLUMNS.includes(h));
  const col = name => head.indexOf(name);
  const byId = new Map(products.map(p => [String(p.id), p]));
  const bySlug = new Map(products.map(p => [p.slug, p]));
  const planned = [],
    skipped = [],
    keyLines = new Map();
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r],
      line = r + 1;
    const id = col('id') >= 0 ? String(cells[col('id')] ?? '').trim() : '';
    const slugCell = col('slug') >= 0 ? String(cells[col('slug')] ?? '').trim() : '';
    const current = id ? byId.get(id) : bySlug.get(slugCell);
    if (id && !current) {
      skipped.push({
        line,
        key: id,
        reason: 'No product in this store has this id.'
      });
      continue;
    }
    if (!current && !slugCell) {
      skipped.push({
        line,
        key: '',
        reason: 'A row needs a slug (or the id of an existing product).'
      });
      continue;
    }
    const creating = !current;
    const key = creating ? `slug:${slugCell}` : `id:${current.id}`;
    keyLines.set(key, [...(keyLines.get(key) || []), line]);
    if (creating && !create) {
      skipped.push({
        line,
        key: slugCell,
        reason: 'No product in this store has this slug. Tick "Create new products" to add it as a draft.'
      });
      continue;
    }
    const values = {},
      problems = [];
    for (const column of PRODUCT_CSV_COLUMNS) {
      if (column === 'id' || col(column) < 0 || blank(cells[col(column)])) continue; // blank: no opinion
      const raw = cells[col(column)];
      try {
        if (column === 'category') {
          const categoryId = resolveCategory(raw, categories);
          if (!categoryId) throw new Error(`Category "${String(raw).trim()}" is not a ${CATALOGUE_STORES[store]} category — use the path from the export, e.g. "${[...categoryPaths(categories).values()].find(p => p.includes('/')) || [...categoryPaths(categories).values()][0] || 'parent/child'}".`);
          values.category_id = categoryId;
        } else values[column] = readCell(column, raw, PRODUCT_FIELD_RULES);
      } catch (error) {
        problems.push(error.message);
      }
    }
    if (problems.length) {
      skipped.push({
        line,
        key: slugCell || current?.slug,
        reason: problems.join(' ')
      });
      continue;
    }
    const {
      diffs,
      applied
    } = diffRow(current, values, PRODUCT_FIELDS$1, {
      overwrite,
      creating
    });
    const label = {
      line,
      id: current?.id ?? null,
      slug: creating ? slugCell : current.slug,
      name: applied.name ?? current?.name ?? values.name ?? ''
    };
    if (!creating && !diffs.some(d => !d.skipped)) {
      if (diffs.length) planned.push({
        ...label,
        kind: 'kept',
        diffs,
        input: null
      });
      continue;
    }
    // The row as it would be written: current values plus only what applies.
    const input = creating ? {
      slug: slugCell,
      stock: 0,
      sort_order: 0,
      ...applied,
      is_active: false
    } : {
      ...current,
      ...applied
    };
    try {
      catalogueProductPayload(input, categories);
    } catch (error) {
      skipped.push({
        line,
        key: label.slug,
        reason: reasons(error)
      });
      continue;
    }
    // Claim warnings for the copy this row would write (warn, never block).
    const warnings = productClaimWarnings({
      name: applied.name,
      description: applied.description
    });
    planned.push({
      ...label,
      kind: creating ? 'create' : 'update',
      diffs,
      input,
      warnings,
      expectedUpdatedAt: current?.updated_at ?? null
    });
  }
  // One product twice in a file: neither row is guessed between.
  const twice = new Set([...keyLines.values()].filter(l => l.length > 1).flat());
  // Slugs and SKUs must still be unique in the store once the whole file applies.
  const after = new Map(products.map(p => [String(p.id), {
    slug: p.slug,
    sku: p.sku || null
  }]));
  for (const c of planned) if (c.input && !twice.has(c.line)) after.set(c.id ? String(c.id) : `new:${c.line}`, {
    slug: c.input.slug,
    sku: c.input.sku || null
  });
  const taken = (field, value, self) => value && [...after.entries()].some(([k, v]) => k !== self && v[field] === value);
  const changes = [],
    kept = [];
  for (const c of planned) {
    if (twice.has(c.line)) {
      skipped.push({
        line: c.line,
        key: c.slug,
        reason: `This product appears more than once in the file (lines ${linesOf(keyLines, c.line).join(', ')}).`
      });
      continue;
    }
    const self = c.id ? String(c.id) : `new:${c.line}`;
    const clash = c.input && (taken('slug', c.input.slug, self) ? `Another product would have the slug "${c.input.slug}".` : taken('sku', c.input.sku, self) ? `Another product would have the SKU "${c.input.sku}".` : null);
    if (clash) {
      skipped.push({
        line: c.line,
        key: c.slug,
        reason: clash
      });
      continue;
    }
    (c.kind === 'kept' ? kept : changes).push(c);
  }
  for (const line of twice) if (!planned.some(c => c.line === line) && !skipped.some(s => s.line === line)) skipped.push({
    line,
    key: '',
    reason: 'This product appears more than once in the file.'
  });
  skipped.sort((a, b) => a.line - b.line);
  return {
    ok: true,
    kind: 'products',
    ignored,
    changes,
    kept,
    skipped
  };
}

// ---------- plan: variants ----------
function planVariantImport(text, {
  store,
  products,
  overwrite = false,
  create = false
}) {
  const rows = parseCsv(text);
  if (!rows.length) return {
    ok: false,
    reason: 'The file is empty.',
    changes: [],
    kept: [],
    skipped: []
  };
  const head = rows[0].map(h => h.trim().toLowerCase());
  if (!head.includes('product_slug') || !head.includes('size')) return {
    ok: false,
    reason: 'The file needs "product_slug" and "size" columns to match variants on.',
    changes: [],
    kept: [],
    skipped: []
  };
  const ignored = head.filter(h => h && !VARIANT_CSV_COLUMNS.includes(h));
  const col = name => head.indexOf(name);
  const bySlug = new Map(products.map(p => [p.slug, p]));
  const planned = [],
    skipped = [],
    keyLines = new Map();
  const siblingsOf = new Map(); // product id → its variants as they will be after earlier rows
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r],
      line = r + 1;
    const productSlug = String(cells[col('product_slug')] ?? '').trim();
    const size = String(cells[col('size')] ?? '').trim();
    const colour = col('colour') >= 0 ? String(cells[col('colour')] ?? '').trim() : '';
    const key = `${productSlug} · ${colour ? `${size} / ${colour}` : size}`;
    const product = bySlug.get(productSlug);
    if (!product) {
      skipped.push({
        line,
        key,
        reason: `No ${CATALOGUE_STORES[store]} product has the slug "${productSlug}".`
      });
      continue;
    }
    if (!size) {
      skipped.push({
        line,
        key,
        reason: 'A row needs a size.'
      });
      continue;
    }
    keyLines.set(`${product.id}|${size}|${colour}`, [...(keyLines.get(`${product.id}|${size}|${colour}`) || []), line]);
    const siblings = siblingsOf.get(product.id) || [...(product.variants || [])];
    const current = siblings.find(v => !String(v.id).startsWith('planned-') && String(v.size).trim() === size && String(v.colour || '').trim() === colour) || null;
    const creating = !current;
    if (creating && !create) {
      skipped.push({
        line,
        key,
        reason: 'This product has no variant with this size and colour. Tick "Create new variants" to add it.'
      });
      continue;
    }
    const values = {},
      problems = [];
    for (const field of VARIANT_FIELDS$1) {
      if (col(field) < 0 || blank(cells[col(field)])) continue;
      try {
        values[field] = readCell(field, cells[col(field)], VARIANT_FIELD_RULES);
      } catch (error) {
        problems.push(error.message);
      }
    }
    if (problems.length) {
      skipped.push({
        line,
        key,
        reason: problems.join(' ')
      });
      continue;
    }
    const {
      diffs,
      applied
    } = diffRow(current, values, VARIANT_FIELDS$1, {
      overwrite,
      creating
    });
    const label = {
      line,
      productId: product.id,
      product: product.name,
      variantId: current?.id ?? null,
      label: key
    };
    if (!creating && !diffs.some(d => !d.skipped)) {
      if (diffs.length) planned.push({
        ...label,
        kind: 'kept',
        diffs,
        input: null
      });
      continue;
    }
    const input = creating ? {
      size,
      colour,
      is_active: true,
      sort_order: siblings.length,
      ...applied
    } : {
      ...current,
      ...applied
    };
    try {
      catalogueVariantPayload({
        ...input,
        id: current?.id
      }, store, siblings);
    } catch (error) {
      skipped.push({
        line,
        key,
        reason: reasons(error)
      });
      continue;
    }
    if (creating) siblingsOf.set(product.id, [...siblings, {
      ...input,
      id: `planned-${line}`
    }]);
    planned.push({
      ...label,
      kind: creating ? 'create' : 'update',
      diffs,
      input,
      expectedUpdatedAt: current?.updated_at ?? null
    });
  }
  const twice = new Set([...keyLines.values()].filter(l => l.length > 1).flat());
  // Variant SKUs are unique across every store; this file and this store are checked here, the rest on save.
  const skus = new Map();
  for (const p of products) for (const v of p.variants || []) if (v.sku) skus.set(v.sku, String(v.id));
  const changes = [],
    kept = [];
  for (const c of planned) {
    if (twice.has(c.line)) {
      skipped.push({
        line: c.line,
        key: c.label,
        reason: `This variant appears more than once in the file (lines ${linesOf(keyLines, c.line).join(', ')}).`
      });
      continue;
    }
    const sku = c.input?.sku,
      self = c.variantId ? String(c.variantId) : `new:${c.line}`;
    if (sku && skus.has(sku) && skus.get(sku) !== self) {
      skipped.push({
        line: c.line,
        key: c.label,
        reason: `Another variant already has the SKU "${sku}". Variant SKUs are unique across every store.`
      });
      continue;
    }
    if (sku) skus.set(sku, self);
    (c.kind === 'kept' ? kept : changes).push(c);
  }
  skipped.sort((a, b) => a.line - b.line);
  return {
    ok: true,
    kind: 'variants',
    ignored,
    changes,
    kept,
    skipped
  };
}

/** "MRP: 1299 → 1199" — how a diff reads in the plan. */
function describeDiff(diff, categories = []) {
  const show = (field, v) => {
    if (!present(v)) return '(empty)';
    if (field === 'category_id') return categoryPaths(categories).get(v) || v;
    if (BOOLEAN.has(field)) return v ? 'yes' : 'no';
    const s = String(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  };
  return `${FIELD_LABELS[diff.field] || diff.field}: ${show(diff.field, diff.before)} → ${show(diff.field, diff.after)}`;
}

const EMPTY_PRODUCT = {
  name: '',
  slug: '',
  brand: '',
  description: '',
  category_id: '',
  mrp: '',
  sale_price: '',
  sku: '',
  net_content: '',
  hsn_code: '',
  gst_rate: '',
  stock: 0,
  sort_order: 0,
  is_active: false,
  is_new: false,
  is_bestseller: false
};
const EMPTY_CATEGORY = {
  name: '',
  slug: '',
  parent_id: '',
  tagline: '',
  image_url: '',
  sort_order: 0,
  is_active: true
};
const EMPTY_VARIANT = {
  size: '',
  colour: '',
  colour_hex: '',
  sku: '',
  stock: 0,
  price_override: '',
  is_active: true,
  sort_order: 0
};

// The fields each form renders. A save error for one of these is shown beside
// it; anything else goes in the form's banner (catalogueFailureView).
const PRODUCT_FIELDS = store => ['name', 'slug', 'category_id', 'brand', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', ...(store === 'fashion' ? [] : ['stock']), 'sort_order', 'description'];
const CATEGORY_FIELDS = ['name', 'slug', 'parent_id', 'sort_order', 'tagline', 'image_url'];
const VARIANT_FIELDS = ['size', 'colour', 'colour_hex', 'sku', 'stock', 'price_override', 'sort_order'];
const IMAGE_FIELDS = ['public_url'];

/** One form's save outcome: errors beside fields, a banner, and whether it was a stale write. */
function useFormErrors(visible) {
  const [state, setState] = reactExports.useState({
    fields: {},
    banner: '',
    stale: false
  });
  return {
    ...state,
    capture: error => setState(catalogueFailureView(error, visible)),
    reset: () => setState({
      fields: {},
      banner: '',
      stale: false
    }),
    clear: field => setState(old => old.fields[field] ? {
      ...old,
      fields: Object.fromEntries(Object.entries(old.fields).filter(([key]) => key !== field))
    } : old)
  };
}
function Field({
  label,
  field,
  value,
  set,
  type = 'text',
  required = false,
  hint,
  min,
  max,
  step,
  multiline = false,
  errors,
  form = 'sc'
}) {
  const error = errors?.fields?.[field];
  const errorId = error ? `${form}-${field}-error` : undefined;
  const change = e => {
    errors?.clear(field);
    set({
      ...value,
      [field]: e.target.value
    });
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: `field sc-field${error ? ' sc-field--error' : ''}`,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "label",
      children: label
    }), multiline ? /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
      className: "textarea",
      rows: "4",
      "aria-invalid": error ? true : undefined,
      "aria-describedby": errorId,
      value: value[field] ?? '',
      onChange: change
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      className: "input",
      type: type,
      required: required,
      min: min,
      max: max,
      step: step,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": errorId,
      value: value[field] ?? '',
      onChange: change
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "hint err",
      id: errorId,
      children: error
    }), hint && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "hint",
      children: hint
    })]
  });
}
function Check({
  label,
  field,
  value,
  set
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: "adm-checkrow",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
      type: "checkbox",
      checked: !!value[field],
      onChange: e => set({
        ...value,
        [field]: e.target.checked
      })
    }), label]
  });
}
function CategorySelect({
  categories,
  value,
  onChange,
  label = 'Category / subcategory',
  optional = false,
  errors,
  field = 'category_id',
  form = 'sc'
}) {
  const error = errors?.fields?.[field];
  const errorId = error ? `${form}-${field}-error` : undefined;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: `field sc-field${error ? ' sc-field--error' : ''}`,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "label",
      children: label
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
      className: "select",
      required: !optional,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": errorId,
      value: value || '',
      onChange: e => {
        errors?.clear(field);
        onChange(e.target.value);
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
        value: "",
        children: optional ? 'Top-level category' : 'Choose a category'
      }), categoryOptions(categories).map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("option", {
        value: row.id,
        children: [row.label, row.is_active ? '' : ' (hidden)']
      }, row.id))]
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "hint err",
      id: errorId,
      children: error
    })]
  });
}
function Messages({
  error,
  message,
  stale = false
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [error && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      children: [error, stale && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-light sc-reload",
        onClick: () => window.location.reload(),
        children: "Reload and discard my edits"
      })]
    }), message && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      role: "status",
      children: message
    })]
  });
}
function Upload({
  store,
  onUpload,
  onBusy,
  onError,
  disabled = false
}) {
  const [busy, setBusy] = reactExports.useState(false);
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    onBusy(true);
    onError('');
    try {
      onUpload(await uploadStoreImage(store, file));
    } catch (error) {
      onError(error.message || 'Image upload failed.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: "sc-upload",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
      children: busy ? 'Uploading image…' : 'Upload image'
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      disabled: busy || disabled,
      onChange: upload
    })]
  });
}

/** Claim warnings: shown, never blocking (claimWarnings.js). */
function ClaimList({
  warnings
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
    className: "sc-list sc-claims__list",
    children: warnings.map((w, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: CLAIM_KINDS[w.kind]
      }), " in ", w.label.toLowerCase(), ": \u201C", w.term, "\u201D \u2014 ", /*#__PURE__*/jsxRuntimeExports.jsx("q", {
        children: w.excerpt
      })]
    }, `${w.field}-${w.kind}-${w.term}-${i}`))
  });
}
function ClaimNotice({
  warnings
}) {
  if (!warnings?.length) return null;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-banner sc-info sc-claims",
    role: "status",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
      children: "Saved \u2014 check this copy before customers read it."
    }), " SORA LIFE cannot back these claims without proof (a certificate, a courier promise, clinical evidence). This is a warning, not a block: edit the copy if it overstates.", /*#__PURE__*/jsxRuntimeExports.jsx(ClaimList, {
      warnings: warnings
    })]
  });
}
function CategoryEditor({
  store,
  categories,
  initial,
  onSaved,
  onCancel
}) {
  const [form, setForm] = reactExports.useState(initial || EMPTY_CATEGORY);
  const [busy, setBusy] = reactExports.useState(false),
    [uploading, setUploading] = reactExports.useState(false),
    [uploadError, setUploadError] = reactExports.useState('');
  const errors = useFormErrors(CATEGORY_FIELDS);
  async function save(e) {
    e.preventDefault();
    if (busy || uploading) return;
    setBusy(true);
    errors.reset();
    setUploadError('');
    // initial.updated_at is the version this form opened; a category saved elsewhere since is refused.
    try {
      await saveStoreCategory(store, initial?.id, form, initial?.updated_at);
      onSaved();
    } catch (err) {
      errors.capture(err);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
    className: "surface sc-panel",
    onSubmit: save,
    noValidate: true,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: initial ? 'Edit category' : 'Add category'
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: errors.banner || uploadError,
      stale: errors.stale
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
      disabled: busy || uploading,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "cat",
          errors: errors,
          label: "Category name",
          field: "name",
          value: form,
          set: setForm,
          required: true
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "cat",
          errors: errors,
          label: "Slug",
          field: "slug",
          value: form,
          set: setForm,
          hint: form.slug ? 'Changing a slug changes its storefront link.' : `Automatic: ${catalogueSlug(form.name) || 'category-name'}`
        }), /*#__PURE__*/jsxRuntimeExports.jsx(CategorySelect, {
          form: "cat",
          errors: errors,
          field: "parent_id",
          categories: categories.filter(row => row.id !== initial?.id),
          value: form.parent_id,
          optional: true,
          label: "Parent category (up to 3 levels)",
          onChange: parent_id => setForm({
            ...form,
            parent_id
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "cat",
          errors: errors,
          label: "Display order",
          field: "sort_order",
          type: "number",
          step: "1",
          value: form,
          set: setForm
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        form: "cat",
        errors: errors,
        label: "Tagline",
        field: "tagline",
        value: form,
        set: setForm
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        form: "cat",
        errors: errors,
        label: "Category image URL",
        field: "image_url",
        value: form,
        set: setForm
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Upload, {
      store: store,
      disabled: busy,
      onUpload: image_url => setForm(old => ({
        ...old,
        image_url
      })),
      onBusy: setUploading,
      onError: setUploadError
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
      disabled: busy || uploading,
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Check, {
        label: "Visible on storefront",
        field: "is_active",
        value: form,
        set: setForm
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          children: busy ? 'Saving…' : 'Save category'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-outline btn-sm",
          type: "button",
          onClick: onCancel,
          children: "Cancel"
        })]
      })]
    })]
  });
}
function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// CSV bulk import — the wellness pattern: export, edit, choose the file, read
// the plan, apply. Nothing is written until Apply; storeCatalogueCsv.js plans,
// applyCatalogueImport writes each row through the editor's own save.
function CatalogueImport({
  store,
  products,
  categories,
  onApplied
}) {
  const [kind, setKind] = reactExports.useState('products');
  const [overwrite, setOverwrite] = reactExports.useState(false),
    [create, setCreate] = reactExports.useState(false);
  const [file, setFile] = reactExports.useState(null);
  const [busy, setBusy] = reactExports.useState(false),
    [progress, setProgress] = reactExports.useState(''),
    [message, setMessage] = reactExports.useState(''),
    [error, setError] = reactExports.useState(''),
    [failures, setFailures] = reactExports.useState([]);
  const plan = reactExports.useMemo(() => {
    if (!file || file.kind !== kind) return null;
    return kind === 'products' ? planProductImport(file.text, {
      store,
      products,
      categories,
      overwrite,
      create
    }) : planVariantImport(file.text, {
      store,
      products,
      overwrite,
      create
    });
  }, [file, kind, store, products, categories, overwrite, create]);
  const noun = kind === 'products' ? 'products' : 'variants';
  const creates = plan?.changes?.filter(c => c.kind === 'create').length || 0;
  const updates = (plan?.changes?.length || 0) - creates;
  async function choose(e) {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen) return;
    setMessage('');
    setError('');
    setFailures([]);
    try {
      setFile({
        name: chosen.name,
        kind,
        text: await chosen.text()
      });
    } catch {
      setError(`“${chosen.name}” could not be read.`);
    }
  }
  async function apply() {
    if (!plan?.changes?.length || busy) return;
    if (!window.confirm(`Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'} to ${CATALOGUE_STORES[store]} ${noun}?\n\n` + `${updates} to update, ${creates} to create${kind === 'products' && creates ? ' (as drafts)' : ''}.\n` + `${overwrite ? 'EXISTING VALUES WILL BE OVERWRITTEN.' : 'Fill-only: existing values are kept.'}`)) return;
    setBusy(true);
    setMessage('');
    setError('');
    setFailures([]);
    try {
      const {
        done,
        failed
      } = await applyCatalogueImport(store, plan, (n, total) => setProgress(`${n} of ${total}`));
      const created = done.filter(c => c.kind === 'create').length;
      setMessage(`${done.length - created} ${noun} updated, ${created} created${kind === 'products' && created ? ' as drafts' : ''}.${failed.length ? ` ${failed.length} not applied — see below.` : ''}`);
      setFailures(failed);
      setFile(null);
      onApplied();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel sc-import",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Bulk import (CSV)"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-chipbar",
      "aria-label": "What to import",
      children: [['products', 'Products'], ['variants', 'Sizes & colours (variants)']].map(([id, label]) => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: `adm-chip${kind === id ? ' active' : ''}`,
        "aria-pressed": kind === id,
        disabled: busy,
        onClick: () => {
          setKind(id);
          setFile(null);
          setMessage('');
          setFailures([]);
        },
        children: label
      }, id))
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("ol", {
      className: "sc-steps",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("li", {
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          disabled: busy,
          onClick: () => downloadText(`sora-${store}-${noun}-${new Date().toISOString().slice(0, 10)}.csv`, kind === 'products' ? productsToCsv(products, categories) : variantsToCsv(products)),
          children: ["Export current ", noun, " (CSV)"]
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        children: ["Edit it in a spreadsheet. ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: "A blank cell leaves that field alone"
        }), " \u2014 it never clears it.", kind === 'products' ? ' Category is the path the export shows, e.g. clothing/shirts.' : ' Rows are matched on product_slug, size and colour.']
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "sc-file",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            children: "Choose the edited file"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "file",
            accept: ".csv,text/csv",
            disabled: busy,
            onChange: choose
          })]
        }), " \u2014 you will see exactly what would change. Nothing is saved until you apply it."]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "sc-options",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          checked: overwrite,
          disabled: busy,
          onChange: e => setOverwrite(e.target.checked)
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: "Overwrite existing values."
          }), " Off (fill-only): a cell only fills an empty field. Prices, stock and flags always have a value, so changing them needs this."]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          checked: create,
          disabled: busy,
          onChange: e => setCreate(e.target.checked)
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
            children: ["Create new ", noun]
          }), " for rows that match nothing", kind === 'products' ? ' — as drafts; publish each from its editor once it has images' : '', "."]
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error || (plan && !plan.ok ? plan.reason : ''),
      message: message
    }), !!failures.length && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "Not applied"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
        className: "sc-list",
        children: failures.map(f => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: ["Line ", f.line, f.key ? ` (${f.key})` : '', ": ", f.reason]
        }, f.line))
      })]
    }), plan?.ok && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "sc-plan",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "sc-plan__summary",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: file.name
        }), " \u2014 ", updates, " to update \xB7 ", creates, " to create \xB7 ", plan.kept.length, " kept by fill-only \xB7 ", plan.skipped.length, " skipped", plan.changes.some(c => c.warnings?.length) ? ` · ${plan.changes.filter(c => c.warnings?.length).length} with claim warnings` : '']
      }), !!plan.ignored.length && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "hint",
        children: ["Columns not imported: ", plan.ignored.join(', '), "."]
      }), !!plan.changes.length && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Line"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: kind === 'products' ? 'Product' : 'Variant'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "What changes"
              })]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: plan.changes.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: c.line
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                children: [c.kind === 'create' && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "badge sc-new",
                  children: "New"
                }), " ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                  children: kind === 'products' ? c.name : c.label
                }), kind === 'products' && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                  className: "hint",
                  children: [" ", c.slug]
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("ul", {
                  className: "sc-diffs",
                  children: c.diffs.map(d => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
                    className: d.skipped ? 'is-kept' : '',
                    children: [describeDiff(d, categories), d.skipped ? ' — kept (fill-only)' : '']
                  }, d.field))
                }), !!c.warnings?.length && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                  className: "sc-claims sc-claims--row",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                    children: "Check before applying"
                  }), " (a warning, not a block):", /*#__PURE__*/jsxRuntimeExports.jsx(ClaimList, {
                    warnings: c.warnings
                  })]
                })]
              })]
            }, c.line))
          })]
        })
      }), !!plan.kept.length && /*#__PURE__*/jsxRuntimeExports.jsxs("details", {
        className: "sc-kept",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("summary", {
          children: [plan.kept.length, " row", plan.kept.length === 1 ? '' : 's', " where every change was kept by fill-only"]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
          className: "sc-list",
          children: plan.kept.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
            children: ["Line ", c.line, " (", c.slug || c.label, "): ", c.diffs.map(d => describeDiff(d, categories)).join('; ')]
          }, c.line))
        })]
      }), !!plan.skipped.length && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-banner err",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
          children: [plan.skipped.length, " row", plan.skipped.length === 1 ? '' : 's', " skipped \u2014 nothing from ", plan.skipped.length === 1 ? 'it' : 'them', " will be written"]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
          className: "sc-list",
          children: plan.skipped.map(s => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
            children: ["Line ", s.line, s.key ? ` (${s.key})` : '', ": ", s.reason]
          }, s.line))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn",
          disabled: busy || !plan.changes.length,
          onClick: apply,
          children: busy ? `Applying… ${progress}` : `Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'}`
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          disabled: busy,
          onClick: () => setFile(null),
          children: "Discard plan"
        })]
      })]
    })]
  });
}

// "Delete demo rows" for one store: review exactly what goes and what stays
// (planDemoDelete), then delete — refused if the rows changed since review.
function DemoRows({
  store,
  onClose,
  onDeleted
}) {
  const [plan, setPlan] = reactExports.useState(null),
    [busy, setBusy] = reactExports.useState(true),
    [error, setError] = reactExports.useState(''),
    [done, setDone] = reactExports.useState(null);
  reactExports.useEffect(() => {
    let current = true;
    previewStoreDemoDelete(store).then(p => {
      if (current) setPlan(p);
    }).catch(err => {
      if (current) setError(err.message);
    }).finally(() => {
      if (current) setBusy(false);
    });
    return () => {
      current = false;
    };
  }, [store]);
  const nothing = plan && !plan.products.length && !plan.categories.length;
  async function remove() {
    if (!window.confirm(`Delete ${plan.products.length} demo product${plan.products.length === 1 ? '' : 's'} and ${plan.categories.length} demo categor${plan.categories.length === 1 ? 'y' : 'ies'} from ${CATALOGUE_STORES[store]}? This cannot be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      setDone(await deleteStoreDemoRows(store, plan));
      onDeleted();
    } catch (err) {
      setError(err.message);
      if (err.isStaleWrite) {
        try {
          setPlan(await previewStoreDemoDelete(store));
        } catch {/* the error already says to review again */}
      }
    } finally {
      setBusy(false);
    }
  }
  const keptList = rows => /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
    className: "sc-list",
    children: rows.map(k => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: k.name
      }), " \u2014 kept: ", k.reasons.join('; '), "."]
    }, k.id))
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel sc-demo-panel",
    "aria-label": "Demo rows",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h2", {
      children: ["Demo rows in ", CATALOGUE_STORES[store]]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error
    }), done ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-banner ok",
        role: "status",
        children: ["Deleted ", done.products, " demo product", done.products === 1 ? '' : 's', " (with ", done.variants, " variant", done.variants === 1 ? '' : 's', " and ", done.images, " image", done.images === 1 ? '' : 's', ") and ", done.categories, " demo categor", done.categories === 1 ? 'y' : 'ies', "."]
      }), !!done.kept.length && /*#__PURE__*/jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, {
        children: keptList(done.kept)
      })]
    }) : busy && !plan ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      role: "status",
      children: "Checking for demo rows\u2026"
    }) : plan && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [nothing ? /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "adm-empty",
        children: ["No demo rows to delete in ", CATALOGUE_STORES[store], "."]
      }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "These go: the demo products with their variants and images, then the demo categories that hold nothing real."
        }), !!plan.products.length && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h3", {
            children: [plan.products.length, " demo product", plan.products.length === 1 ? '' : 's']
          }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
            className: "sc-list",
            children: plan.products.map(p => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
              children: [p.name, p.variants || p.images ? ` (${[p.variants && `${p.variants} variant${p.variants === 1 ? '' : 's'}`, p.images && `${p.images} image${p.images === 1 ? '' : 's'}`].filter(Boolean).join(', ')})` : '']
            }, p.id))
          })]
        }), !!plan.categories.length && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h3", {
            children: [plan.categories.length, " demo categor", plan.categories.length === 1 ? 'y' : 'ies']
          }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
            className: "sc-list",
            children: plan.categories.map(c => /*#__PURE__*/jsxRuntimeExports.jsx("li", {
              children: c.name
            }, c.id))
          })]
        })]
      }), !!plan.keptCategories.length && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: "Kept"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          children: "A category is never deleted while something real sits in it \u2014 that would leave the real product without a category."
        }), keptList(plan.keptCategories)]
      }), !!plan.demoVariantsOnRealProducts && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "hint",
        children: [plan.demoVariantsOnRealProducts, " demo variant", plan.demoVariantsOnRealProducts === 1 ? '' : 's', " on real products ", plan.demoVariantsOnRealProducts === 1 ? 'is' : 'are', " left alone."]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: "Carts holding a deleted product drop it; past orders keep their own copy. Image files stay in storage."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [!nothing && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn sc-danger-btn",
          disabled: busy,
          onClick: remove,
          children: busy ? 'Deleting…' : 'Delete these demo rows'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          disabled: busy,
          onClick: onClose,
          children: "Close"
        })]
      })]
    }), done && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "sc-actions",
      children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-outline btn-sm",
        onClick: onClose,
        children: "Close"
      })
    })]
  });
}
function CatalogueList({
  store
}) {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = reactExports.useState([]),
    [products, setProducts] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true),
    [loaded, setLoaded] = reactExports.useState(false),
    [error, setError] = reactExports.useState(''),
    [editing, setEditing] = reactExports.useState(null);
  const [revision, setRevision] = reactExports.useState(0);
  const tab = ['categories', 'import'].includes(params.get('tab')) ? params.get('tab') : 'products';
  const category = params.get('category') || '',
    search = params.get('q') || '';
  reactExports.useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    Promise.all([listStoreCategories(store), listStoreProducts(store)]).then(([cats, rows]) => {
      if (current) {
        setCategories(cats);
        setProducts(rows);
        setLoaded(true);
      }
    }).catch(err => {
      if (current) setError(err.message);
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [store, revision]);
  const update = patch => setParams(old => {
    const next = new URLSearchParams(old);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);else next.delete(key);
    }
    return next;
  }, {
    replace: true
  });
  const status = ['published', 'draft'].includes(params.get('status')) ? params.get('status') : '';
  const [demoOpen, setDemoOpen] = reactExports.useState(false);
  const shown = products.filter(row => (!category || row.category_id === category) && (!status || status === 'published' === (row.is_active === true)) && `${row.name} ${row.sku || ''} ${row.brand}`.toLowerCase().includes(search.toLowerCase()));
  const categoriesById = new Map(categoryOptions(categories).map(row => [row.id, row.label]));
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-chipbar",
      "aria-label": "Catalogue section",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'products' ? ' active' : ''}`,
        onClick: () => update({
          tab: ''
        }),
        children: "Products"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'categories' ? ' active' : ''}`,
        onClick: () => update({
          tab: 'categories'
        }),
        children: "Categories & subcategories"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'import' ? ' active' : ''}`,
        onClick: () => update({
          tab: 'import'
        }),
        children: "Bulk import (CSV)"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error
    }), loading && !loaded ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      role: "status",
      children: "Loading catalogue\u2026"
    }) : error && !loaded ? /*#__PURE__*/jsxRuntimeExports.jsx("button", {
      className: "btn btn-outline",
      onClick: () => setRevision(n => n + 1),
      children: "Retry loading"
    }) : tab === 'import' ? /*#__PURE__*/jsxRuntimeExports.jsx(CatalogueImport, {
      store: store,
      products: products,
      categories: categories,
      onApplied: () => setRevision(n => n + 1)
    }) : tab === 'products' ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-toolbar",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "sc-field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "label",
            children: "Search products"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: search,
            onChange: e => update({
              q: e.target.value
            }),
            placeholder: "Name, brand or SKU"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "sc-field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "label",
            children: "Category / subcategory"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            className: "select",
            value: category,
            onChange: e => update({
              category: e.target.value
            }),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "",
              children: "All categories"
            }), categoryOptions(categories).map(row => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: row.id,
              children: row.label
            }, row.id))]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "sc-field sc-field--narrow",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "label",
            children: "Status"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            className: "select",
            value: status,
            onChange: e => update({
              status: e.target.value
            }),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "",
              children: "Published and drafts"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "published",
              children: "Published only"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "draft",
              children: "Drafts only"
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-sm",
          to: `/admin/store-catalogue/${store}/new${category ? `?category=${encodeURIComponent(category)}` : ''}`,
          children: "+ Add product"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          "aria-expanded": demoOpen,
          onClick: () => setDemoOpen(open => !open),
          children: "Remove demo rows\u2026"
        })]
      }), demoOpen && /*#__PURE__*/jsxRuntimeExports.jsx(DemoRows, {
        store: store,
        onClose: () => setDemoOpen(false),
        onDeleted: () => setRevision(n => n + 1)
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "hint",
        children: [shown.length, " of ", products.length, " products", status ? ` · ${status === 'published' ? 'published only' : 'drafts only'}` : ' · includes drafts']
      }), !shown.length ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No products in this selection. Add a product, or choose another category."
      }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Product"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Category"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Price"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Stock"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Status"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Actions"
              })]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: shown.map(row => {
              const variants = (row.variants || []).filter(v => v.is_active !== false);
              const stock = store === 'fashion' || variants.length ? variants.reduce((n, v) => n + Number(v.stock || 0), 0) : row.stock;
              return /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    className: "adm-row-name",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                      className: "adm-thumb",
                      children: row.images?.[0] && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
                        src: row.images[0],
                        alt: "",
                        loading: "lazy"
                      })
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                        children: row.name
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                        children: row.sku || row.slug
                      })]
                    })]
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: categoriesById.get(row.category_id) || 'Unassigned'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: money(row.sale_price ?? row.mrp)
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: stock || 0
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [row.is_active ? 'Published' : 'Draft', row.is_demo && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "badge sc-demo",
                    title: "Placeholder from the store's seed data",
                    children: "Demo"
                  })]
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                    className: "inline-link",
                    to: `/admin/store-catalogue/${store}/${row.id}`,
                    children: "Edit"
                  }), row.is_active && catalogueProductHref(store, row.slug) && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                    children: [" \xB7 ", /*#__PURE__*/jsxRuntimeExports.jsx("a", {
                      className: "inline-link",
                      href: catalogueProductHref(store, row.slug),
                      target: "_blank",
                      rel: "noreferrer",
                      children: "View"
                    })]
                  })]
                })]
              }, row.id);
            })
          })]
        })
      })]
    }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "sc-actions",
        children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          disabled: !!editing,
          onClick: () => setEditing('new'),
          children: "+ Add category"
        })
      }), editing && /*#__PURE__*/jsxRuntimeExports.jsx(CategoryEditor, {
        store: store,
        categories: categories,
        initial: editing === 'new' ? null : editing,
        onCancel: () => setEditing(null),
        onSaved: () => {
          setEditing(null);
          setRevision(n => n + 1);
        }
      }, editing === 'new' ? 'new' : editing.id), !categories.length && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "adm-empty",
        children: "Add your first category before adding products."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Category"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Products"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Status"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: categoryOptions(categories).map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: row.label
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: products.filter(p => p.category_id === row.id).length
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: row.is_active ? 'Visible' : 'Hidden'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-outline btn-sm",
                  disabled: !!editing,
                  onClick: () => setEditing(categories.find(cat => cat.id === row.id)),
                  children: "Edit"
                })
              })]
            }, row.id))
          })]
        })
      })]
    })]
  });
}
function VariantsEditor({
  store,
  product,
  onChanged
}) {
  const [form, setForm] = reactExports.useState(EMPTY_VARIANT),
    [editing, setEditing] = reactExports.useState(null);
  const [busy, setBusy] = reactExports.useState(false),
    [message, setMessage] = reactExports.useState('');
  const errors = useFormErrors(VARIANT_FIELDS);
  async function remove(row) {
    const label = row.colour ? `${row.size} / ${row.colour}` : row.size;
    if (!window.confirm(`Delete the ${label} variant? This cannot be undone.\n\nCarts holding it will show it as no longer sold, and checkout will refuse it. Past orders keep their own copy.\n\nTo hide it for now instead, edit it and untick "Active variant".`)) return;
    setBusy(true);
    errors.reset();
    setMessage('');
    try {
      await deleteStoreVariant(store, product.id, row.id, row.updated_at);
      if (editing === row.id) {
        setEditing(null);
        setForm(EMPTY_VARIANT);
      }
      await onChanged();
      setMessage(`Variant ${label} deleted.`);
    } catch (err) {
      errors.capture(err);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    errors.reset();
    setMessage('');
    // form.updated_at is the version the Edit button loaded; a new variant has none and needs none.
    try {
      await saveStoreVariant(store, product.id, editing, form, editing ? form.updated_at : null);
      setForm(EMPTY_VARIANT);
      setEditing(null);
      await onChanged();
      setMessage('Variant saved.');
    } catch (err) {
      errors.capture(err);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Sizes, colours & stock"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: store === 'fashion' ? 'Fashion stock comes from these variants. For a single option use “One size” and its colour, or “Default”.' : 'Optional: add sizes or colours for this product. When active variants exist, their stock is used instead of product stock.'
    }), store === 'grocery' && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-banner sc-info sc-note",
      role: "note",
      children: GROCERY_VARIANTS_UNREAD
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: errors.banner,
      message: message,
      stale: errors.stale
    }), !!product.variants?.length && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Size / option"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Colour"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Stock"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Price"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Status"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: product.variants.map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.size
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.colour || '—'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.stock
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.price_override == null ? 'Product price' : money(row.price_override)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.is_active ? 'Active' : 'Hidden'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "sc-actions sc-actions--row",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  type: "button",
                  className: "btn btn-outline btn-sm",
                  disabled: busy,
                  onClick: () => {
                    setEditing(row.id);
                    setForm(row);
                    setMessage('');
                    errors.reset();
                  },
                  children: "Edit"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  type: "button",
                  className: "btn btn-ghost btn-sm sc-danger",
                  disabled: busy,
                  onClick: () => remove(row),
                  children: "Delete"
                })]
              })
            })]
          }, row.id))
        })]
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsx("form", {
      onSubmit: save,
      noValidate: true,
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
        disabled: busy,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: editing ? 'Edit variant' : 'Add variant'
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "var",
            errors: errors,
            label: "Size / option",
            field: "size",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "var",
            errors: errors,
            label: `Colour${store === 'fashion' ? '' : ' (optional)'}`,
            field: "colour",
            value: form,
            set: setForm,
            required: store === 'fashion'
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "var",
            errors: errors,
            label: "Colour hex (optional)",
            field: "colour_hex",
            value: form,
            set: setForm,
            hint: "Example: #A9B48C"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "var",
            errors: errors,
            label: "Variant SKU (optional)",
            field: "sku",
            value: form,
            set: setForm,
            hint: "Unique across every store, not just this one."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "var",
            errors: errors,
            label: "Stock quantity",
            field: "stock",
            type: "number",
            min: "0",
            step: "1",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "var",
            errors: errors,
            label: "Price override \u20B9 (optional)",
            field: "price_override",
            type: "number",
            min: "0.01",
            step: "0.01",
            value: form,
            set: setForm,
            hint: "Leave blank to use the product selling price."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "var",
            errors: errors,
            label: "Display order",
            field: "sort_order",
            type: "number",
            step: "1",
            value: form,
            set: setForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Check, {
          label: "Active variant",
          field: "is_active",
          value: form,
          set: setForm
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm",
            type: "submit",
            children: busy ? 'Saving…' : 'Save variant'
          }), editing && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-outline btn-sm",
            type: "button",
            onClick: () => {
              setEditing(null);
              setForm(EMPTY_VARIANT);
              errors.reset();
            },
            children: "Cancel edit"
          })]
        })]
      })
    })]
  });
}

// The gallery: several uploads at once (each made a WebP under 150 KB first),
// drag — or ← / → — to reorder, one primary, alt text per image. Every change
// goes through catalogue_product_media; the 0034 trigger rewrites images[].
const UPLOAD_STATUS = {
  converting: 'Converting to WebP…',
  uploading: 'Uploading…',
  added: 'Added',
  failed: 'Not added'
};
const kb = bytes => `${Math.round(bytes / 1000)} KB`;
function galleryOrder(media) {
  return [...(media || [])].sort((a, b) => a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)));
}
/** The order after dropping `dragged` onto `target`: it takes the target's place. */
function dropOrder(ids, dragged, target) {
  if (dragged === target || !ids.includes(dragged) || !ids.includes(target)) return ids;
  const next = ids.filter(id => id !== dragged);
  next.splice(ids.indexOf(target), 0, dragged);
  return next;
}
function GalleryEditor({
  store,
  product,
  onChanged
}) {
  const media = galleryOrder(product.media);
  const [busy, setBusy] = reactExports.useState(false),
    [message, setMessage] = reactExports.useState('');
  const [queue, setQueue] = reactExports.useState([]),
    [alts, setAlts] = reactExports.useState({}),
    [over, setOver] = reactExports.useState(null);
  const [urlForm, setUrlForm] = reactExports.useState({
    public_url: '',
    alt_text: ''
  });
  const errors = useFormErrors(IMAGE_FIELDS);
  const dragged = reactExports.useRef(null);
  async function run(task, done) {
    if (busy) return;
    setBusy(true);
    errors.reset();
    setMessage('');
    try {
      await task();
      await onChanged();
      if (done) setMessage(done);
    } catch (err) {
      errors.capture(err);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function upload(fileList) {
    const files = [...(fileList || [])];
    if (!files.length || busy) return;
    setQueue(files.map(file => ({
      name: file.name,
      status: 'converting'
    })));
    let results = [];
    await run(async () => {
      results = await addStoreImages(store, product.id, files, (index, state) => setQueue(old => old.map((row, i) => i === index ? state : row)));
    });
    if (!results.length) return;
    const added = results.filter(r => r.ok).length,
      failed = results.length - added;
    setMessage(`${added} of ${results.length} image${results.length === 1 ? '' : 's'} added${failed ? ` — ${failed} not added (see below)` : ''}.`);
  }
  const persistOrder = ids => run(() => reorderStoreMedia(store, product.id, ids), 'Order saved.');
  const move = (id, delta) => {
    const ids = media.map(m => m.id),
      at = ids.indexOf(id),
      to = at + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    return persistOrder(ids);
  };
  function drop(targetId) {
    const from = dragged.current;
    dragged.current = null;
    setOver(null);
    if (!from || from === targetId) return;
    return persistOrder(dropOrder(media.map(m => m.id), from, targetId));
  }
  async function saveAlt(row) {
    const next = alts[row.id];
    if (next === undefined || next.trim() === (row.alt_text || '')) return;
    await run(() => saveStoreMediaAlt(store, product.id, row.id, next, row.updated_at), 'Alt text saved.');
    setAlts(old => {
      const copy = {
        ...old
      };
      delete copy[row.id];
      return copy;
    });
  }
  function remove(row) {
    if (!window.confirm('Remove this image from the gallery? The original file will be kept.')) return;
    return run(() => removeStoreMedia(store, product.id, row.id), 'Image removed from gallery.');
  }
  async function addByUrl(e) {
    e.preventDefault();
    const next = media.length ? Math.max(...media.map(m => Number(m.sort_order) || 0)) + 1 : 0;
    await run(async () => {
      await saveStoreMedia(store, product.id, null, {
        ...urlForm,
        alt_text: urlForm.alt_text || product.name,
        sort_order: next
      });
      setUrlForm({
        public_url: '',
        alt_text: ''
      });
    }, 'Image saved.');
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Product images"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Customers see the primary image first, then the others in this order. Drag an image onto another to move it there, or use \u2190 and \u2192."
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: errors.banner,
      message: message,
      stale: errors.stale
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
      className: `sc-drop${busy ? ' is-busy' : ''}`,
      onDragOver: e => e.preventDefault(),
      onDrop: e => {
        if (dragged.current) return;
        e.preventDefault();
        upload(e.dataTransfer?.files);
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: busy ? 'Working…' : 'Add images'
      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "hint",
        children: "Choose or drop several at once: JPEG, PNG or WebP. Each is converted to WebP under 150 KB before it is uploaded."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
        type: "file",
        multiple: true,
        accept: "image/jpeg,image/png,image/webp",
        disabled: busy,
        onChange: e => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          upload(files);
        }
      })]
    }), !!queue.length && /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
      className: "sc-queue",
      "aria-live": "polite",
      children: queue.map((row, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        className: `sc-queue__item is-${row.status}`,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: row.name
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          children: [UPLOAD_STATUS[row.status], row.bytes && row.status === 'added' ? ` · ${kb(row.bytes)} WebP` : '', row.error ? `: ${row.error}` : '']
        })]
      }, `${i}-${row.name}`))
    }), !media.length ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-empty",
      children: "No images yet. Add at least one before publishing."
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
      className: "sc-gallery",
      "aria-label": "Gallery order",
      children: media.map((row, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        className: `sc-image${over === row.id ? ' is-over' : ''}`,
        draggable: !busy,
        onDragStart: e => {
          dragged.current = row.id;
          e.dataTransfer?.setData?.('text/plain', row.id);
        },
        onDragEnd: () => {
          dragged.current = null;
          setOver(null);
        },
        onDragOver: e => {
          if (dragged.current) {
            e.preventDefault();
            setOver(row.id);
          }
        },
        onDrop: e => {
          if (!dragged.current) return;
          e.preventDefault();
          e.stopPropagation?.();
          drop(row.id);
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("img", {
          src: row.public_url,
          alt: row.alt_text || product.name,
          draggable: false
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-image__meta",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "sc-image__pos",
            children: i + 1
          }), row.is_primary ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "badge sc-primary",
            children: "Primary"
          }) : /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-outline btn-sm",
            disabled: busy,
            onClick: () => run(() => setStoreMediaPrimary(store, product.id, row.id), 'Primary image changed.'),
            children: "Make primary"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "sc-field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: "label",
            children: ["Alt text, image ", i + 1]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: alts[row.id] ?? row.alt_text ?? '',
            disabled: busy,
            onChange: e => setAlts(old => ({
              ...old,
              [row.id]: e.target.value
            })),
            onBlur: () => saveAlt(row),
            onKeyDown: e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveAlt(row);
              }
            }
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-light btn-sm",
            "aria-label": `Move image ${i + 1} earlier`,
            disabled: busy || i === 0,
            onClick: () => move(row.id, -1),
            children: "\u2190"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-light btn-sm",
            "aria-label": `Move image ${i + 1} later`,
            disabled: busy || i === media.length - 1,
            onClick: () => move(row.id, 1),
            children: "\u2192"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-outline btn-sm",
            disabled: busy,
            onClick: () => remove(row),
            children: "Remove"
          })]
        })]
      }, row.id))
    }), /*#__PURE__*/jsxRuntimeExports.jsx("form", {
      onSubmit: addByUrl,
      noValidate: true,
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
        disabled: busy,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: "Add by URL"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          children: "For an image already hosted, or a bundled /img/\u2026 path. It is added as it is \u2014 not converted."
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "img",
            errors: errors,
            label: "Image URL",
            field: "public_url",
            value: urlForm,
            set: setUrlForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "img",
            errors: errors,
            label: "Image description / alt text",
            field: "alt_text",
            value: urlForm,
            set: setUrlForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "sc-actions",
          children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm",
            type: "submit",
            children: "Save image"
          })
        })]
      })
    })]
  });
}
function ProductEditor({
  store,
  productId
}) {
  const navigate = useNavigate(),
    [params] = useSearchParams(),
    location = useLocation();
  const isNew = productId === 'new';
  // Warnings from the last save (or from the draft this editor was just created as).
  const [claims, setClaims] = reactExports.useState(() => location?.state?.claimWarnings || []);
  const [categories, setCategories] = reactExports.useState([]),
    [product, setProduct] = reactExports.useState(null);
  const [form, setForm] = reactExports.useState({
    ...EMPTY_PRODUCT,
    category_id: params.get('category') || ''
  });
  const [loading, setLoading] = reactExports.useState(true),
    [busy, setBusy] = reactExports.useState(false),
    [message, setMessage] = reactExports.useState(''),
    [loadError, setLoadError] = reactExports.useState(''),
    [refreshError, setRefreshError] = reactExports.useState('');
  const errors = useFormErrors(PRODUCT_FIELDS(store));
  // The version of the row this form is editing, and that row's editable
  // values. Refs, not state: neither is rendered, and the token must be
  // current inside an in-flight save.
  const base = reactExports.useRef(null);
  reactExports.useEffect(() => {
    let current = true;
    Promise.all([listStoreCategories(store), isNew ? Promise.resolve(null) : getStoreProduct(store, productId)]).then(([cats, row]) => {
      if (!current) return;
      setCategories(cats);
      setProduct(row);
      if (row) {
        setForm(row);
        base.current = row;
      }
    }).catch(err => {
      if (current) setLoadError(err.message);
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [store, productId, isNew]);
  // After this editor's own gallery or variant write. A gallery write moves the
  // product's updated_at (the images[] cache trigger), so the token is adopted
  // from the fresh row — but only when nothing this form saves has changed
  // under it. If another admin saved the product meanwhile, the old token
  // stays and the next save here is refused instead of overwriting theirs.
  async function refresh() {
    try {
      const fresh = await getStoreProduct(store, productId);
      if (versionAfterOwnWrite(base.current, fresh) === fresh.updated_at) base.current = fresh;
      setProduct(fresh);
    } catch {
      setRefreshError('Changes were saved, but the updated product could not be loaded. Reload this page before making more changes.');
    }
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    errors.reset();
    setMessage('');
    setRefreshError('');
    setClaims([]);
    try {
      const row = await saveStoreProduct(store, isNew ? null : productId, form, isNew ? null : base.current?.updated_at);
      // Warn, never block: the save has already happened.
      const warnings = productClaimWarnings(row);
      if (isNew) {
        navigate(`/admin/store-catalogue/${store}/${row.id}`, {
          replace: true,
          state: warnings.length ? {
            claimWarnings: warnings
          } : undefined
        });
        return;
      }
      setClaims(warnings);
      base.current = {
        ...base.current,
        ...row
      };
      setForm(old => ({
        ...old,
        ...row
      }));
      await refresh();
      setMessage(row.is_active ? 'Published. Refresh the storefront to see your changes.' : 'Draft saved. Add images and stock/variants, then publish above.');
    } catch (err) {
      errors.capture(err);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    role: "status",
    children: "Loading product\u2026"
  });
  if (loadError) return /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
    error: loadError
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form sc-product",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "sc-actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
        className: "inline-link",
        to: `/admin/store-catalogue/${store}`,
        children: "\u2190 Back to products"
      }), product?.is_active && catalogueProductHref(store, product.slug) && /*#__PURE__*/jsxRuntimeExports.jsx("a", {
        className: "inline-link",
        href: catalogueProductHref(store, product.slug),
        target: "_blank",
        rel: "noreferrer",
        children: "View product \u2197"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: errors.banner || refreshError,
      message: message,
      stale: errors.stale
    }), /*#__PURE__*/jsxRuntimeExports.jsx(ClaimNotice, {
      warnings: claims
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      className: "surface sc-panel",
      onSubmit: save,
      noValidate: true,
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: isNew ? 'Add product' : product?.name
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: isNew ? '1. Create a draft → 2. Add images and stock/variants → 3. Publish.' : `Status: ${product?.is_active ? 'Published' : 'Draft — not visible to customers'}. Images and variants have their own save buttons below.`
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
        disabled: busy,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Product name",
            field: "name",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Slug",
            field: "slug",
            value: form,
            set: setForm,
            hint: form.slug ? 'Changing a slug changes the product link.' : `Automatic: ${catalogueSlug(form.name) || 'product-name'}`
          }), /*#__PURE__*/jsxRuntimeExports.jsx(CategorySelect, {
            form: "prod",
            errors: errors,
            categories: categories,
            value: form.category_id,
            onChange: category_id => setForm({
              ...form,
              category_id
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Brand",
            field: "brand",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "MRP \u20B9",
            field: "mrp",
            type: "number",
            min: "0.01",
            step: "0.01",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Selling price \u20B9 (optional)",
            field: "sale_price",
            type: "number",
            min: "0.01",
            max: form.mrp || undefined,
            step: "0.01",
            value: form,
            set: setForm,
            hint: "Leave blank to sell at MRP. Discount is calculated automatically."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Product SKU (optional)",
            field: "sku",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Pack / dimensions (optional)",
            field: "net_content",
            value: form,
            set: setForm,
            hint: "Example: Set of 2 \xB7 40 \xD7 40 cm"
          }), store !== 'fashion' && /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Stock quantity (without variants)",
            field: "stock",
            type: "number",
            min: "0",
            step: "1",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Display order",
            field: "sort_order",
            type: "number",
            step: "1",
            value: form,
            set: setForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: "Tax"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "HSN code (optional)",
            field: "hsn_code",
            value: form,
            set: setForm,
            hint: "4, 6 or 8 digits. Example: 6302 (bed linen)."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "GST rate % (optional)",
            field: "gst_rate",
            type: "number",
            min: "0",
            max: "100",
            step: "0.01",
            value: form,
            set: setForm,
            hint: "0 to 100. Leave blank if not yet known."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "adm-banner sc-info sc-note",
          role: "note",
          children: gstNote(store)
        }), !categories.length && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
            to: `/admin/store-catalogue/${store}?tab=categories`,
            children: "Create a category first"
          }), "."]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "prod",
          errors: errors,
          label: "Description",
          field: "description",
          value: form,
          set: setForm,
          multiline: true
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Check, {
            label: "New arrival",
            field: "is_new",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Check, {
            label: "Bestseller",
            field: "is_bestseller",
            value: form,
            set: setForm
          }), !isNew && /*#__PURE__*/jsxRuntimeExports.jsx(Check, {
            label: "Published / visible to customers",
            field: "is_active",
            value: form,
            set: setForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn",
          type: "submit",
          disabled: !categories.length,
          children: busy ? 'Saving…' : isNew ? 'Create draft & continue' : 'Save product'
        })]
      })]
    }), !isNew && product && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(GalleryEditor, {
        store: store,
        product: product,
        onChanged: refresh
      }), /*#__PURE__*/jsxRuntimeExports.jsx(VariantsEditor, {
        store: store,
        product: product,
        onChanged: refresh
      })]
    })]
  });
}
function StoreCatalogue() {
  const {
      store,
      productId
    } = useParams(),
    navigate = useNavigate();
  if (!Object.hasOwn(CATALOGUE_STORES, store)) return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-empty",
    children: ["Choose a store: ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
      to: "/admin/store-catalogue/fashion",
      children: "Fashion"
    }), " \xB7 ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
      to: "/admin/store-catalogue/homeliving",
      children: "Home & Living"
    }), " \xB7 ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
      to: "/admin/store-catalogue/grocery",
      children: "Grocery"
    })]
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-catalogue",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Store Products"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Manage products and categories for Fashion, Home & Living and Grocery. Lifestyle brings Fashion and Home & Living together."
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
        className: "btn btn-outline btn-sm",
        to: "/admin/storefronts",
        children: "Storefront design"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "sc-toolbar",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "sc-field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "label",
          children: "Store"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
          className: "select",
          value: store,
          disabled: !!productId,
          onChange: e => navigate(`/admin/store-catalogue/${e.target.value}`),
          children: Object.entries(CATALOGUE_STORES).map(([id, label]) => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: id,
            children: label
          }, id))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("a", {
        className: "inline-link",
        href: `/${store}`,
        target: "_blank",
        rel: "noreferrer",
        children: ["View ", CATALOGUE_STORES[store], " \u2197"]
      }), store !== 'grocery' && /*#__PURE__*/jsxRuntimeExports.jsx("a", {
        className: "inline-link",
        href: "/lifestyle",
        target: "_blank",
        rel: "noreferrer",
        children: "View Lifestyle \u2197"
      })]
    }), store === 'grocery' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner sc-info",
      role: "note",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "Not for sale yet."
      }), " ", GROCERY_NOT_SOLD]
    }), productId ? /*#__PURE__*/jsxRuntimeExports.jsx(ProductEditor, {
      store: store,
      productId: productId
    }, `${store}-${productId}`) : /*#__PURE__*/jsxRuntimeExports.jsx(CatalogueList, {
      store: store
    }, store)]
  });
}

export { StoreCatalogue as default, dropOrder };
//# sourceMappingURL=StoreCatalogue.js.map
