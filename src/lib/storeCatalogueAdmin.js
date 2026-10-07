import { buildTree, validatePlacement } from './fashion.js';
import { safeVisualUrl } from './homepageAppearance.js';

export const CATALOGUE_STORES = { fashion: 'Fashion', homeliving: 'Home & Living', grocery: 'Grocery' };
export function requireCatalogueStore(store) {
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
export const GROCERY_NOT_SOLD = 'Grocery cannot be sold yet. Checkout does not price grocery items: a published grocery product shows on /grocery but cannot be bought. Sizes and variants entered here are not read anywhere yet.';
export const GROCERY_VARIANTS_UNREAD = 'Not read anywhere yet: the grocery storefront shows the product only, and ignores these rows.';
export function gstNote(store) {
  requireCatalogueStore(store);
  if (store === 'grocery') return 'GST rate is recorded only. Grocery cannot be sold yet, so no rate is charged anywhere.';
  return `GST rate is recorded, not yet applied at checkout. Checkout still uses the default GST rate for every ${CATALOGUE_STORES[store]} line until the HSN audit is complete.`;
}
const text = (value) => String(value ?? '').trim();
export const catalogueSlug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- Errors the editor can act on -------------------------------------------------
// A form shows these beside the field they name. Every message is collected
// before any is thrown, so one save reports every problem at once instead of
// one per attempt.
export class CatalogueInputError extends Error {
  constructor(fieldErrors) {
    const messages = Object.values(fieldErrors);
    super(messages.length === 1 ? messages[0] : `Fix the ${messages.length} highlighted fields.`);
    this.name = 'CatalogueInputError';
    this.fieldErrors = fieldErrors;
  }
}
/** The row moved (or vanished) after the editor read it; nothing was written. */
export class CatalogueStaleWriteError extends Error {
  constructor(message) { super(message); this.name = 'CatalogueStaleWriteError'; this.isStaleWrite = true; }
}
/** Row-level security refused the write: the session is not an admin_users member. */
export class CatalogueRefusedError extends Error {
  constructor(message) { super(message); this.name = 'CatalogueRefusedError'; this.isRefused = true; }
}

function collector() {
  const errors = {};
  return {
    errors,
    fail(field, message) { if (!errors[field]) errors[field] = message; },
    take(field, read) { try { return read(); } catch (error) { if (!errors[field]) errors[field] = error.message; return undefined; } },
    done() { if (Object.keys(errors).length) throw new CatalogueInputError(errors); },
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
function wholeNumber(value, message, { min = 0, max = INT_MAX } = {}) {
  const n = Number(value);
  if (value == null || text(value) === '' || !Number.isInteger(n) || n < min || n > max) throw new Error(message);
  return n;
}
function amount(value, message, { optional = false, min = 0.01, max = 99999999.99 } = {}) {
  if (optional && (value == null || text(value) === '')) return null;
  const n = Number(value);
  if (value == null || text(value) === '' || !Number.isFinite(n) || n < min || n > max) throw new Error(message);
  return Math.round(n * 100) / 100;
}
const displayOrder = (value) => wholeNumber(value ?? 0, 'Display order must be a whole number.', { min: -2147483648 });
/** 4, 6 or 8 digits (the database CHECK). Spaces and dots are dropped: "6302 10 90" and "6302.10.90" are both 63021090. */
function hsnCode(value) {
  const digits = text(value).replace(/[\s.]/g, '');
  if (!digits) return null;
  if (!/^[0-9]{4}([0-9]{2}){0,2}$/.test(digits)) throw new Error('HSN code must be 4, 6 or 8 digits.');
  return digits;
}
const gstRate = (value) => amount(value, 'GST rate must be a number from 0 to 100, or blank.', { optional: true, min: 0, max: 100 });
const colourHex = (value) => {
  const hex = text(value) || null;
  if (hex && !/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Colour hex must look like #123ABC.');
  return hex;
};

// One rule per field: how a value is read, and what is wrong with it. The
// payload builders below use them, and so does the CSV planner — so a cell is
// read exactly as the editor reads the same field.
export const PRODUCT_FIELD_RULES = {
  name: (v) => { const t = text(v); if (!t) throw new Error('Enter a product name.'); return t; },
  slug: (v) => slug(v, ''),
  brand: (v) => text(v),
  description: (v) => text(v),
  mrp: (v) => amount(v, 'Enter an MRP of at least ₹0.01.'),
  sale_price: (v) => amount(v, 'Selling price must be at least ₹0.01, or blank to sell at MRP.', { optional: true }),
  sku: (v) => sku(v),
  net_content: (v) => text(v) || null,
  hsn_code: (v) => hsnCode(v),
  gst_rate: (v) => gstRate(v),
  stock: (v) => wholeNumber(v ?? 0, 'Stock must be a whole number, 0 or more.'),
  sort_order: (v) => displayOrder(v),
  is_new: (v) => v === true,
  is_bestseller: (v) => v === true,
};
export const VARIANT_FIELD_RULES = {
  colour_hex: (v) => colourHex(v),
  sku: (v) => sku(v),
  stock: (v) => wholeNumber(v, 'Stock must be a whole number, 0 or more.'),
  price_override: (v) => amount(v, 'Price override must be at least ₹0.01, or blank to use the product price.', { optional: true }),
  is_active: (v) => v !== false,
  sort_order: (v) => displayOrder(v),
};
const P = PRODUCT_FIELD_RULES, V = VARIANT_FIELD_RULES;

export function categoryOptions(categories) {
  const tree = buildTree(categories);
  return tree.list.map((row) => ({ ...row, label: tree.ancestors(row.id).map((item) => item.name).join(' / ') }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export function catalogueProductPayload(input, categories) {
  const c = collector();
  const name = text(input.name);
  if (!name) c.fail('name', 'Enter a product name.');
  const category = categories.find((row) => row.id === input.category_id);
  if (!category) c.fail('category_id', 'Choose a category in this store.');
  else if (input.is_active && buildTree(categories).ancestors(category.id).some((row) => !row.is_active)) c.fail('category_id', 'Activate this category and its parent categories before publishing.');
  const productSlug = name || text(input.slug) ? c.take('slug', () => slug(input.slug, name)) : undefined;
  const mrp = c.take('mrp', () => P.mrp(input.mrp));
  const sale_price = c.take('sale_price', () => P.sale_price(input.sale_price));
  if (sale_price != null && mrp != null && sale_price > mrp) c.fail('sale_price', `Selling price cannot be more than the MRP (₹${mrp}).`);
  const row = {
    name, slug: productSlug, category_id: category?.id, brand: P.brand(input.brand), description: P.description(input.description),
    mrp, sale_price, sku: c.take('sku', () => P.sku(input.sku)), net_content: P.net_content(input.net_content),
    hsn_code: c.take('hsn_code', () => P.hsn_code(input.hsn_code)), gst_rate: c.take('gst_rate', () => P.gst_rate(input.gst_rate)),
    stock: c.take('stock', () => P.stock(input.stock)),
    sort_order: c.take('sort_order', () => P.sort_order(input.sort_order)),
    is_active: input.is_active === true, is_new: P.is_new(input.is_new), is_bestseller: P.is_bestseller(input.is_bestseller),
  };
  c.done();
  return row;
}
export function catalogueCategoryPayload(input, categories, id = null) {
  const c = collector();
  const name = text(input.name);
  if (!name) c.fail('name', 'Enter a category name.');
  const parent_id = input.parent_id || null;
  if (parent_id && !categories.some((row) => row.id === parent_id)) c.fail('parent_id', 'Choose a parent category in this store.');
  else if (!validatePlacement(categories, { id, parentId: parent_id }).ok) c.fail('parent_id', 'Categories allow up to three levels and cannot contain a circular parent.');
  const categorySlug = name || text(input.slug) ? c.take('slug', () => slug(input.slug, name)) : undefined;
  // Same rule as the unique index: a slug is unique among one parent's children in one store.
  if (categorySlug && categories.some((row) => row.id !== id && (row.parent_id || null) === parent_id && row.slug === categorySlug)) {
    // When the slug was made from the name, the Slug field is empty — say which slug clashed.
    c.fail('slug', text(input.slug) ? 'Another category under the same parent already uses this slug.'
      : `Another category under the same parent already uses the slug “${categorySlug}” made from the name. Enter a different slug.`);
  }
  const image_url = text(input.image_url) ? safeVisualUrl(input.image_url) : null;
  if (text(input.image_url) && !image_url) c.fail('image_url', 'Enter a public HTTPS image URL or a local image path.');
  const row = { name, slug: categorySlug, parent_id, tagline: text(input.tagline), image_url,
    sort_order: c.take('sort_order', () => displayOrder(input.sort_order)), is_active: input.is_active !== false };
  c.done();
  return row;
}
export function catalogueVariantPayload(input, store, siblings = []) {
  requireCatalogueStore(store);
  const c = collector();
  const size = text(input.size), colour = text(input.colour);
  if (!size) c.fail('size', store === 'fashion' ? 'Enter a size. Use “One size” for a single option.' : 'Enter a size or option.');
  if (store === 'fashion' && !colour) c.fail('colour', 'Enter a colour. Use “Default” for a single option.');
  const colour_hex = c.take('colour_hex', () => V.colour_hex(input.colour_hex));
  // Same rule as the unique constraint on (product, size, colour).
  if (size && siblings.some((row) => row.id !== input.id && text(row.size) === size && text(row.colour) === colour)) {
    c.fail('size', `This product already has a ${colour ? `${size} / ${colour}` : size} variant.`);
  }
  const row = { size, colour, colour_hex, sku: c.take('sku', () => V.sku(input.sku)),
    stock: c.take('stock', () => V.stock(input.stock)),
    price_override: c.take('price_override', () => V.price_override(input.price_override)),
    is_active: V.is_active(input.is_active),
    sort_order: c.take('sort_order', () => V.sort_order(input.sort_order)) };
  c.done();
  return row;
}
export function assertCataloguePublishable(store, product) {
  requireCatalogueStore(store);
  if (!(product.images || []).some((url) => safeVisualUrl(url))) throw new Error('Add a product image before publishing.');
  if (store === 'fashion' && !(product.variants || []).some((row) => row.is_active !== false)) throw new Error('Add at least one active size/colour variant with stock before publishing. Zero stock is allowed for sold-out products.');
}
/** The storefront page for a product, or null where the store has none (grocery has no product pages yet). */
export function catalogueProductHref(store, slug) {
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
  catalogue_variants_price_override_check: ['price_override', 'Price override cannot be negative.'],
};
export function catalogueWriteError(error, kind = 'row') {
  if (!error || error instanceof CatalogueInputError || error.isStaleWrite || error.isRefused) return error;
  const message = String(error.message || '');
  if (error.code === '42501' || /row-level security/i.test(message)) {
    return new CatalogueRefusedError(`The database refused to save this ${kind}: this account is not a catalogue admin. Sign in again with an admin account.`);
  }
  const constraint = /constraint "([^"]+)"/.exec(message)?.[1];
  if (constraint && CONSTRAINT_FIELDS[constraint]) {
    const [field, text] = CONSTRAINT_FIELDS[constraint];
    return new CatalogueInputError({ [field]: text });
  }
  // The category depth/cycle trigger raises check_violation with its own message.
  if (error.code === '23514' && /catalogue_categories/.test(message)) return new CatalogueInputError({ parent_id: 'Categories allow up to three levels and cannot contain a circular parent.' });
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
export const PRODUCT_EDITABLE_FIELDS = ['name', 'slug', 'category_id', 'brand', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'sort_order', 'is_active', 'is_new', 'is_bestseller'];
const same = (a, b) => (a == null && b == null) || (a != null && b != null && String(a) === String(b));
export function versionAfterOwnWrite(base, fresh, fields = PRODUCT_EDITABLE_FIELDS) {
  if (!base || !fresh) return base?.updated_at ?? null;
  return fields.every((field) => same(base[field], fresh[field])) ? fresh.updated_at : base.updated_at;
}

/**
 * What a form shows after a failed save: the field errors it can place
 * beside a visible field, and a banner for everything else. A field error
 * for a field the form does not render (fashion has no product-stock input)
 * goes in the banner, so no reason is ever swallowed.
 */
export function catalogueFailureView(error, visibleFields = []) {
  if (error?.fieldErrors) {
    const entries = Object.entries(error.fieldErrors);
    const fields = Object.fromEntries(entries.filter(([field]) => visibleFields.includes(field)));
    const hidden = entries.filter(([field]) => !visibleFields.includes(field)).map(([, message]) => message);
    const count = Object.keys(fields).length;
    const banner = ['Nothing was saved.', count ? `Fix the highlighted field${count === 1 ? '' : 's'} below.` : '', ...hidden].filter(Boolean).join(' ');
    return { fields, banner, stale: false };
  }
  return { fields: {}, banner: error?.message || 'Something went wrong. Nothing was saved.', stale: !!error?.isStaleWrite };
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
const someNames = (rows) => { const names = rows.map((r) => `“${r.name}”`); return names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', '); };
export function planDemoDelete(categories, products) {
  const byParent = new Map();
  for (const c of categories) byParent.set(c.parent_id || null, [...(byParent.get(c.parent_id || null) || []), c]);
  const below = (id, depth = 0) => (depth > 3 ? [] : (byParent.get(id) || []).flatMap((child) => [child, ...below(child.id, depth + 1)]));
  const depthOf = (c) => { let d = 1, parent = c.parent_id; while (parent && d < 5) { d += 1; parent = categories.find((x) => x.id === parent)?.parent_id; } return d; };
  const realProducts = products.filter((p) => p.is_demo !== true);
  const remove = [], kept = [];
  for (const category of categories.filter((c) => c.is_demo === true)) {
    const tree = [category, ...below(category.id)];
    const ids = new Set(tree.map((c) => c.id));
    const real = realProducts.filter((p) => ids.has(p.category_id));
    const realCategories = tree.filter((c) => c.is_demo !== true);
    const reasons = [];
    if (real.length) reasons.push(`${real.length} real product${real.length === 1 ? ' is' : 's are'} filed ${tree.length > 1 ? 'in it or under it' : 'in it'}: ${someNames(real)}`);
    if (realCategories.length) reasons.push(`it holds the real categor${realCategories.length === 1 ? 'y' : 'ies'} ${someNames(realCategories)}`);
    if (reasons.length) kept.push({ id: category.id, name: category.name, reasons });
    else remove.push({ id: category.id, name: category.name, depth: depthOf(category) });
  }
  remove.sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name));
  const demo = products.filter((p) => p.is_demo === true);
  return {
    products: demo.map((p) => ({ id: p.id, name: p.name, variants: (p.variants || []).length, images: (p.media || []).length })),
    categories: remove,
    keptCategories: kept,
    demoVariantsOnRealProducts: realProducts.reduce((n, p) => n + (p.variants || []).filter((v) => v.is_demo === true).length, 0),
  };
}
