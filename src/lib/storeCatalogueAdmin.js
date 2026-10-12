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

// ---- Declarations and jewellery (migration 0036) ---------------------------------
// What a listing declares (country of origin, who made, packed or imported it),
// a garment's material, care and fit, and a jewellery piece's metal, purity,
// making charges, pricing mode, weights and stones. Formats are enforced here and
// by the database; COMPLETENESS is only ever warned about (declarationWarnings):
// the owner's rule, so a live product is never locked until someone backfills it.
export const METALS = ['gold', 'silver', 'platinum', 'gold_plated', 'silver_plated', 'brass', 'stainless_steel', 'other'];
export const METAL_LABELS = { gold: 'Gold', silver: 'Silver', platinum: 'Platinum', gold_plated: 'Gold plated', silver_plated: 'Silver plated', brass: 'Brass', stainless_steel: 'Stainless steel', other: 'Other' };
/** BIS fineness (parts per thousand) → how the grade reads. Only gold, silver and platinum carry a purity. */
export const PURITY = {
  gold: { 375: '9K', 585: '14K', 750: '18K', 833: '20K', 916: '22K', 958: '23K', 995: '24K', 999: '24K' },
  silver: { 800: '800', 835: '835', 900: '900', 925: 'Sterling (925)', 970: '970', 990: '990', 999: 'Fine (999)' },
  platinum: { 850: '850', 900: '900', 950: '950' },
};
export const FITS = ['Regular', 'Slim', 'Relaxed', 'Oversized', 'Straight', 'Skinny', 'Loose', 'Tailored'];
export const STONE_ORIGINS = ['natural', 'lab_grown', 'simulant'];
export const STONE_ORIGIN_LABELS = { natural: 'Natural', lab_grown: 'Lab-grown', simulant: 'Simulant' };
export const MAKING_TYPES = ['per_gram', 'percent', 'flat'];
export const MAKING_LABELS = { per_gram: '₹ per gram', percent: 'Percent of metal value', flat: 'Flat ₹ per piece' };
export const PRICING_MODES = ['fixed', 'rate_linked'];
export const RATE_LINKED_NOT_LIVE = 'A rate-linked product cannot go live yet: its price needs the metal-rate engine. Keep it as a draft, or set the pricing to fixed.';

/** Fabric percentages ("60% cotton, 40% polyester"): the parts and their total, or null when the text gives none. */
export function materialTotal(value) {
  const parts = [...String(value || '').matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  return parts.length ? { parts, total: Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100 } : null;
}
/** The Jewellery category, or one under it: the fashion store's jewellery, which carries metal, purity and weights. */
export function isJewelleryCategory(categories, categoryId) {
  if (!categoryId) return false;
  const path = buildTree(categories).ancestors(categoryId);
  return path.length > 0 && path[0].slug === 'jewellery';
}
const limited = (value, max, label) => {
  const result = text(value) || null;
  if (result && result.length > max) throw new Error(`${label}: keep it under ${max} characters.`);
  return result;
};
const grams = (value, label) => {
  if (value == null || text(value) === '') return null;
  const n = Number(text(value));
  if (!Number.isFinite(n) || n <= 0 || n > 99999.999) throw new Error(`${label} must be grams above 0, e.g. 3.250.`);
  return Math.round(n * 1000) / 1000;
};
const pick = (list, label) => (value) => {
  const result = text(value);
  if (!result) return null;
  const hit = list.find((x) => x.toLowerCase() === result.toLowerCase());
  if (!hit) throw new Error(`${label} must be one of ${list.join(', ')}.`);
  return hit;
};
const DECLARATION_RULES = {
  country_of_origin: (v) => {
    const code = text(v).toUpperCase();
    if (!code) return null;
    if (!/^[A-Z]{2}$/.test(code)) throw new Error('Country of origin must be a 2-letter code such as IN.');
    return code;
  },
  generic_name: (v) => limited(v, 120, 'Generic name'),
  material: (v) => {
    const material = limited(v, 300, 'Material');
    const m = materialTotal(material);
    if (m && m.total !== 100) throw new Error(`Material percentages add up to ${m.total}%, not 100%.`);
    return material;
  },
  care: (v) => limited(v, 1000, 'Care instructions'),
  fit: pick(FITS, 'Fit'),
  metal: (v) => { const m = pick(METALS, 'Metal')(v); return m && m.toLowerCase(); },
  purity: (v) => {
    if (v == null || text(v) === '') return null;
    const n = Number(text(v));
    if (!Number.isInteger(n) || n < 1 || n > 999) throw new Error('Purity is the fineness, a whole number such as 916 (22K) or 925 (sterling).');
    return n;
  },
  making_charge_type: pick(MAKING_TYPES, 'Making charge type'),
  making_charge_value: (v) => amount(v, 'Making charges must be a number, 0 or more.', { optional: true, min: 0 }),
  pricing_mode: (v) => pick(PRICING_MODES, 'Pricing')(v) || 'fixed',
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
  ...DECLARATION_RULES,
};
export const VARIANT_FIELD_RULES = {
  colour_hex: (v) => colourHex(v),
  sku: (v) => sku(v),
  stock: (v) => wholeNumber(v, 'Stock must be a whole number, 0 or more.'),
  price_override: (v) => amount(v, 'Price override must be at least ₹0.01, or blank to use the product price.', { optional: true }),
  is_active: (v) => v !== false,
  sort_order: (v) => displayOrder(v),
  gross_weight_g: (v) => grams(v, 'Gross weight'),
  net_metal_weight_g: (v) => grams(v, 'Net metal weight'),
};
const P = PRODUCT_FIELD_RULES, V = VARIANT_FIELD_RULES;

export function categoryOptions(categories) {
  const tree = buildTree(categories);
  return tree.list.map((row) => ({ ...row, label: tree.ancestors(row.id).map((item) => item.name).join(' / ') }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
/** A company chosen as manufacturer / packer / importer: its id, checked against the Companies list when given. */
function partyRef(value, parties, label) {
  const id = text(value) || null;
  if (id && parties && !parties.some((p) => String(p.id) === id)) throw new Error(`${label}: choose a company from the Companies list.`);
  return id;
}
/**
 * `parties`: the Companies list, to check a chosen manufacturer / packer / importer
 * exists (the database's foreign keys check it again).
 */
export function catalogueProductPayload(input, categories, parties = null) {
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
  Object.assign(row, declarationFields(input, parties, c, row.is_active));
  c.done();
  return row;
}

/** The 0036 fields of a product row, read and cross-checked; problems go to the collector. */
function declarationFields(input, parties, c, isActive) {
  const row = {};
  for (const field of ['country_of_origin', 'generic_name', 'material', 'care', 'fit', 'metal', 'purity', 'making_charge_type', 'making_charge_value', 'pricing_mode']) {
    row[field] = c.take(field, () => P[field](input[field]));
  }
  row.manufacturer_id = c.take('manufacturer_id', () => partyRef(input.manufacturer_id, parties, 'Manufacturer'));
  row.packer_id = c.take('packer_id', () => partyRef(input.packer_id, parties, 'Packer'));
  row.importer_id = c.take('importer_id', () => partyRef(input.importer_id, parties, 'Importer'));
  if (row.purity != null && row.metal !== undefined) {
    if (!PURITY[row.metal]) c.fail('purity', `Purity is only for gold, silver and platinum${row.metal ? `, not ${METAL_LABELS[row.metal].toLowerCase()}` : ': choose the metal first'}.`);
    else if (!PURITY[row.metal][row.purity]) c.fail('purity', `${row.purity} is not a ${row.metal} grade. Use ${Object.entries(PURITY[row.metal]).map(([k, v]) => `${k} (${v})`).join(', ')}.`);
  }
  if (row.making_charge_type !== undefined && row.making_charge_value !== undefined && (row.making_charge_type == null) !== (row.making_charge_value == null)) {
    c.fail('making_charge_value', 'Making charges need both a type and a value.');
  }
  if (row.making_charge_type === 'percent' && row.making_charge_value > 100) c.fail('making_charge_value', 'A making charge percentage cannot be over 100.');
  if (row.pricing_mode === 'rate_linked' && isActive) c.fail('pricing_mode', RATE_LINKED_NOT_LIVE);
  return row;
}
/**
 * Every problem with a row's 0036 fields on their own: { field: message }, empty when
 * none. The pre-import validator runs it on each row, so a declaration problem is
 * listed even while another cell of the row fails (the import stops at the cells).
 */
export function declarationErrors(input, parties = null) {
  const c = collector();
  declarationFields(input, parties, c, input.is_active === true);
  return { ...c.errors };
}

/**
 * What a listing should declare before it goes live, and does not yet. A WARNING
 * list — nothing here stops a save or a publish (the owner's rule: a catalogue
 * must never lock up waiting for a backfill). `jewellery`: the product sits under
 * the Jewellery category.
 */
export function declarationWarnings(product, { store = 'fashion', jewellery = false } = {}) {
  const missing = [];
  const add = (field, label) => missing.push({ field, label });
  if (!text(product?.country_of_origin)) add('country_of_origin', 'country of origin');
  if (!product?.manufacturer_id) add('manufacturer_id', 'manufacturer');
  if (text(product?.country_of_origin) && text(product.country_of_origin) !== 'IN' && !product.importer_id) add('importer_id', 'importer (it is made outside India)');
  if (!text(product?.net_content)) add('net_content', 'net quantity');
  if (store === 'fashion' && !jewellery) {
    if (!text(product?.material)) add('material', 'material');
    if (!text(product?.care)) add('care', 'care instructions');
  }
  if (jewellery) {
    if (!product?.metal) add('metal', 'metal');
    else if (PURITY[product.metal] && product.purity == null) add('purity', 'purity');
    const sizes = (product?.variants || []).filter((v) => v.is_active !== false);
    if (sizes.some((v) => v.gross_weight_g == null || v.net_metal_weight_g == null)) add('variants', 'gross and net weight on every size');
  }
  return missing;
}

/** A company the catalogue names as manufacturer, packer or importer. Names are unique, case aside. */
export function cataloguePartyPayload(input, parties = [], id = null) {
  const c = collector();
  const name = text(input.name);
  if (!name) c.fail('name', 'Enter the company’s name.');
  else if (name.length > 160) c.fail('name', 'Keep the company name under 160 characters.');
  else if (parties.some((p) => String(p.id) !== String(id) && text(p.name).toLowerCase() === name.toLowerCase())) c.fail('name', 'Another company already has this name. Each company once.');
  const address = text(input.address);
  if (!address) c.fail('address', 'Enter the address as it is printed on the label.');
  else if (address.length > 400) c.fail('address', 'Keep the address under 400 characters.');
  const country = text(input.country).toUpperCase() || 'IN';
  if (!/^[A-Z]{2}$/.test(country)) c.fail('country', 'Country must be a 2-letter code such as IN.');
  const phone = text(input.phone) || null;
  if (phone && phone.length > 40) c.fail('phone', 'Keep the phone under 40 characters.');
  const email = text(input.email) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) c.fail('email', 'Enter an email address like name@domain.com.');
  const gstin = text(input.gstin).toUpperCase() || null;
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) c.fail('gstin', 'GSTIN must be 15 characters like 27ABCDE1234F1Z5.');
  c.done();
  return { name, address, country, phone, email, gstin };
}

/** One kind of stone in a jewellery piece. */
export function catalogueStonePayload(input) {
  const c = collector();
  const stone = text(input.stone);
  if (!stone) c.fail('stone', 'Name the stone: diamond, ruby, cubic zirconia…');
  else if (stone.length > 60) c.fail('stone', 'Keep the stone’s name under 60 characters.');
  const origin = text(input.origin);
  if (!STONE_ORIGINS.includes(origin)) c.fail('origin', 'Origin must be natural, lab_grown or simulant: say which.');
  const count = Number(text(input.stone_count));
  if (!Number.isInteger(count) || count < 1) c.fail('stone_count', 'Stone count must be a whole number, 1 or more.');
  const caratText = text(input.total_carat), weightText = text(input.total_weight_g);
  const total_carat = caratText === '' ? null : Number(caratText);
  if (total_carat != null && !(Number.isFinite(total_carat) && total_carat > 0 && total_carat < 10000)) c.fail('total_carat', 'Total carat must be more than 0.');
  const total_weight_g = c.take('total_weight_g', () => grams(weightText, 'Total weight'));
  const lab = text(input.certificate_lab) || null, number = text(input.certificate_no) || null;
  if (!!lab !== !!number) c.fail(lab ? 'certificate_no' : 'certificate_lab', 'A certificate needs both its lab and its number.');
  const row = {
    stone, origin, stone_count: count,
    shape: c.take('shape', () => limited(input.shape, 40, 'Shape')),
    total_carat: total_carat == null ? null : Math.round(total_carat * 1000) / 1000, total_weight_g,
    clarity: c.take('clarity', () => limited(input.clarity, 20, 'Clarity')),
    colour_grade: c.take('colour_grade', () => limited(input.colour_grade, 20, 'Colour grade')),
    certificate_lab: c.take('certificate_lab', () => limited(lab, 40, 'Certificate lab')),
    certificate_no: c.take('certificate_no', () => limited(number, 60, 'Certificate number')),
    sort_order: c.take('sort_order', () => displayOrder(input.sort_order)),
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
    sort_order: c.take('sort_order', () => V.sort_order(input.sort_order)),
    // 0036: a jewellery piece's weights (a ring's change with its size).
    gross_weight_g: c.take('gross_weight_g', () => V.gross_weight_g(input.gross_weight_g)),
    net_metal_weight_g: c.take('net_metal_weight_g', () => V.net_metal_weight_g(input.net_metal_weight_g)) };
  if (row.gross_weight_g != null && row.net_metal_weight_g != null && row.net_metal_weight_g > row.gross_weight_g) {
    c.fail('net_metal_weight_g', `Net metal weight ${row.net_metal_weight_g} g cannot be more than the gross weight ${row.gross_weight_g} g.`);
  }
  c.done();
  return row;
}
export function assertCataloguePublishable(store, product) {
  requireCatalogueStore(store);
  if (!(product.images || []).some((url) => safeVisualUrl(url))) throw new Error('Add a product image before publishing.');
  if (store === 'fashion' && !(product.variants || []).some((row) => row.is_active !== false)) throw new Error('Add at least one active size/colour variant with stock before publishing. Zero stock is allowed for sold-out products.');
  if (product.pricing_mode === 'rate_linked') throw new Error(RATE_LINKED_NOT_LIVE);
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
  // 0036 (default names for its column and table checks and foreign keys).
  catalogue_products_country_chk: ['country_of_origin', 'Country of origin must be a 2-letter code such as IN.'],
  catalogue_products_text_len_chk: ['generic_name', 'Generic name, material or care is too long: 120, 300 and 1000 characters at most.'],
  catalogue_products_metal_chk: ['metal', `Metal must be one of ${METALS.join(', ')}.`],
  catalogue_products_purity_chk: ['purity', 'Purity must be a grade of gold, silver or platinum.'],
  catalogue_products_making_chk: ['making_charge_value', 'Making charges need both a type and a value; a percentage is at most 100.'],
  catalogue_products_pricing_mode_chk: ['pricing_mode', 'Pricing must be fixed or rate_linked.'],
  catalogue_products_rate_linked_live_chk: ['pricing_mode', RATE_LINKED_NOT_LIVE],
  catalogue_products_manufacturer_id_fkey: ['manufacturer_id', 'That company is no longer in the Companies list. Choose another.'],
  catalogue_products_packer_id_fkey: ['packer_id', 'That company is no longer in the Companies list. Choose another.'],
  catalogue_products_importer_id_fkey: ['importer_id', 'That company is no longer in the Companies list. Choose another.'],
  catalogue_variants_weights_chk: ['net_metal_weight_g', 'Weights must be above 0, and the net metal weight cannot be more than the gross weight.'],
  catalogue_parties_name_check: ['name', 'Enter the company’s name (under 160 characters).'],
  catalogue_parties_address_check: ['address', 'Enter the address (under 400 characters).'],
  catalogue_parties_country_check: ['country', 'Country must be a 2-letter code such as IN.'],
  catalogue_parties_phone_check: ['phone', 'Keep the phone under 40 characters.'],
  catalogue_parties_email_check: ['email', 'Enter an email address like name@domain.com.'],
  catalogue_parties_gstin_check: ['gstin', 'GSTIN must be 15 characters like 27ABCDE1234F1Z5.'],
  catalogue_product_stones_stone_check: ['stone', 'Name the stone (under 60 characters).'],
  catalogue_product_stones_origin_check: ['origin', 'Origin must be natural, lab_grown or simulant: say which.'],
  catalogue_product_stones_stone_count_check: ['stone_count', 'Stone count must be a whole number, 1 or more.'],
  catalogue_product_stones_total_carat_check: ['total_carat', 'Total carat must be more than 0.'],
  catalogue_product_stones_total_weight_g_check: ['total_weight_g', 'Total weight must be grams above 0.'],
  catalogue_product_stones_check: ['certificate_no', 'A certificate needs both its lab and its number.'],
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
export const PRODUCT_EDITABLE_FIELDS = ['name', 'slug', 'category_id', 'brand', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'sort_order', 'is_active', 'is_new', 'is_bestseller',
  'country_of_origin', 'generic_name', 'manufacturer_id', 'packer_id', 'importer_id', 'material', 'care', 'fit', 'metal', 'purity', 'making_charge_type', 'making_charge_value', 'pricing_mode'];
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

// ---- Gallery files: their order, and matching them to products by name ---------------
// Files chosen together are taken in file-name order whatever order the file
// dialog hands them over in, numbers compared as numbers (x-2 before x-10), so
// "<slug>-1" is always first — and, in an empty gallery, the primary.
export function sortByFileName(files) {
  return [...(files || [])].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'en', { numeric: true, sensitivity: 'base' }));
}
const BULK_IMAGE_NAME = /^(.+)-(\d{1,4})\.(webp|jpe?g|png)$/i;
/**
 * Plan a bulk gallery upload. Each file named <product slug>-<number>.<webp|jpg|png>
 * goes to that product, in number order; number 1 becomes the primary of an
 * empty gallery. Pure: nothing is read or written.
 *   uploads   [{ product, files, numbers, existing }] — what an upload will add
 *   held      [{ product, files, numbers, existing, reason }] — matched, not uploaded:
 *             two files with one number, or a gallery that already has images
 *             (unless `append`, which adds after them)
 *   unmatched [{ name, reason }] — files that name no product in this store
 */
export function planBulkImages(files, products, { append = false } = {}) {
  const bySlug = new Map((products || []).map((p) => [String(p.slug || '').toLowerCase(), p]));
  const groups = new Map(), unmatched = [];
  for (const file of files || []) {
    const name = String(file?.name || '');
    const match = BULK_IMAGE_NAME.exec(name);
    if (!match) {
      unmatched.push({ name, reason: /\.(webp|jpe?g|png)$/i.test(name) ? 'The name does not end in -<number>, e.g. -1.webp.' : 'Not a JPEG, PNG or WebP file.' });
      continue;
    }
    const slug = match[1].toLowerCase(), product = bySlug.get(slug);
    if (!product) { unmatched.push({ name, reason: `No product in this store has the slug “${slug}”.` }); continue; }
    if (!groups.has(product.id)) groups.set(product.id, { product, entries: [] });
    groups.get(product.id).entries.push({ file, number: Number(match[2]) });
  }
  const uploads = [], held = [];
  for (const { product, entries } of groups.values()) {
    entries.sort((a, b) => a.number - b.number || a.file.name.localeCompare(b.file.name));
    const row = { product, files: entries.map((e) => e.file), numbers: entries.map((e) => e.number), existing: (product.media || []).length };
    const repeated = [...new Set(row.numbers.filter((n, i) => row.numbers.indexOf(n) !== i))];
    if (repeated.length) {
      held.push({ ...row, reason: `More than one file is numbered ${repeated.join(', ')} (${entries.filter((e) => repeated.includes(e.number)).map((e) => e.file.name).join(', ')}). Keep one file per number.` });
    } else if (row.existing && !append) {
      held.push({ ...row, reason: `Already has ${row.existing} image${row.existing === 1 ? '' : 's'}. Tick “Also add to products that already have images” to add these after them.` });
    } else uploads.push(row);
  }
  const byName = (a, b) => String(a.product.name).localeCompare(String(b.product.name));
  return {
    uploads: uploads.sort(byName), held: held.sort(byName),
    unmatched: unmatched.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })),
    fileCount: uploads.reduce((n, row) => n + row.files.length, 0),
  };
}
