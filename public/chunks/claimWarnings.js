import { ca as buildTree, bD as safeVisualUrl, cb as validatePlacement, bA as supabase, cc as uploadImage } from '../bundle.js';

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
// A file that already meets the target is used as it is: a real WebP (by its
// bytes, not just its name) of at most 150 KB whose longest side is at most
// 1600 px. Re-encoding it would only cost quality.
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
const kb = bytes => `${Math.round(bytes / 1000)} KB`;
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

/** Whether the file's bytes are a WebP: "RIFF", a length, then "WEBP". */
async function hasWebpHeader(file) {
  try {
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const at = (i, text) => [...text].every((c, k) => b[i + k] === c.charCodeAt(0));
    return b.length === 12 && at(0, 'RIFF') && at(8, 'WEBP');
  } catch {
    return false;
  }
}

/**
 * Turn an uploaded image into a WebP File under maxBytes — or, when it already
 * is one that fits (see above), pass it through unchanged.
 * Resolves { file, width, height, quality, bytes, sourceBytes, unchanged }.
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
    if (file.type === 'image/webp' && file.size <= maxBytes && Math.max(image.width, image.height) <= WEBP_SIDES[0] && (await hasWebpHeader(file))) {
      return {
        file: new File([file], webpName(file.name), {
          type: 'image/webp'
        }),
        width: image.width,
        height: image.height,
        quality: null,
        bytes: file.size,
        sourceBytes: file.size,
        unchanged: true
      };
    }
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
          sourceBytes: file.size,
          unchanged: false
        };
      }
    }
  } finally {
    image.close?.();
  }
  throw new Error(`“${file.name}” could not be brought under ${kb(maxBytes)} at ${WEBP_SIDES[WEBP_SIDES.length - 1]} px or more. Crop it closer, or use a less detailed image.`);
}

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

// ---- Declarations and jewellery (migration 0036) ---------------------------------
// What a listing declares (country of origin, who made, packed or imported it),
// a garment's material, care and fit, and a jewellery piece's metal, purity,
// making charges, pricing mode, weights and stones. Formats are enforced here and
// by the database; COMPLETENESS is only ever warned about (declarationWarnings):
// the owner's rule, so a live product is never locked until someone backfills it.
const METALS = ['gold', 'silver', 'platinum', 'gold_plated', 'silver_plated', 'brass', 'stainless_steel', 'other'];
const METAL_LABELS = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  gold_plated: 'Gold plated',
  silver_plated: 'Silver plated',
  brass: 'Brass',
  stainless_steel: 'Stainless steel',
  other: 'Other'
};
/** BIS fineness (parts per thousand) → how the grade reads. Only gold, silver and platinum carry a purity. */
const PURITY = {
  gold: {
    375: '9K',
    585: '14K',
    750: '18K',
    833: '20K',
    916: '22K',
    958: '23K',
    995: '24K',
    999: '24K'
  },
  silver: {
    800: '800',
    835: '835',
    900: '900',
    925: 'Sterling (925)',
    970: '970',
    990: '990',
    999: 'Fine (999)'
  },
  platinum: {
    850: '850',
    900: '900',
    950: '950'
  }
};
const FITS = ['Regular', 'Slim', 'Relaxed', 'Oversized', 'Straight', 'Skinny', 'Loose', 'Tailored'];
const STONE_ORIGINS = ['natural', 'lab_grown', 'simulant'];
const STONE_ORIGIN_LABELS = {
  natural: 'Natural',
  lab_grown: 'Lab-grown',
  simulant: 'Simulant'
};
const MAKING_TYPES = ['per_gram', 'percent', 'flat'];
const MAKING_LABELS = {
  per_gram: '₹ per gram',
  percent: 'Percent of metal value',
  flat: 'Flat ₹ per piece'
};
const PRICING_MODES = ['fixed', 'rate_linked'];
const RATE_LINKED_NOT_LIVE = 'A rate-linked product cannot go live yet: its price needs the metal-rate engine. Keep it as a draft, or set the pricing to fixed.';

/** Fabric percentages ("60% cotton, 40% polyester"): the parts and their total, or null when the text gives none. */
function materialTotal(value) {
  const parts = [...String(value || '').matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1]));
  return parts.length ? {
    parts,
    total: Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100
  } : null;
}
/** The Jewellery category, or one under it: the fashion store's jewellery, which carries metal, purity and weights. */
function isJewelleryCategory(categories, categoryId) {
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
const pick = (list, label) => value => {
  const result = text(value);
  if (!result) return null;
  const hit = list.find(x => x.toLowerCase() === result.toLowerCase());
  if (!hit) throw new Error(`${label} must be one of ${list.join(', ')}.`);
  return hit;
};
const DECLARATION_RULES = {
  country_of_origin: v => {
    const code = text(v).toUpperCase();
    if (!code) return null;
    if (!/^[A-Z]{2}$/.test(code)) throw new Error('Country of origin must be a 2-letter code such as IN.');
    return code;
  },
  generic_name: v => limited(v, 120, 'Generic name'),
  material: v => {
    const material = limited(v, 300, 'Material');
    const m = materialTotal(material);
    if (m && m.total !== 100) throw new Error(`Material percentages add up to ${m.total}%, not 100%.`);
    return material;
  },
  care: v => limited(v, 1000, 'Care instructions'),
  fit: pick(FITS, 'Fit'),
  metal: v => {
    const m = pick(METALS, 'Metal')(v);
    return m && m.toLowerCase();
  },
  purity: v => {
    if (v == null || text(v) === '') return null;
    const n = Number(text(v));
    if (!Number.isInteger(n) || n < 1 || n > 999) throw new Error('Purity is the fineness, a whole number such as 916 (22K) or 925 (sterling).');
    return n;
  },
  making_charge_type: pick(MAKING_TYPES, 'Making charge type'),
  making_charge_value: v => amount(v, 'Making charges must be a number, 0 or more.', {
    optional: true,
    min: 0
  }),
  pricing_mode: v => pick(PRICING_MODES, 'Pricing')(v) || 'fixed'
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
  is_bestseller: v => v === true,
  ...DECLARATION_RULES
};
const VARIANT_FIELD_RULES = {
  colour_hex: v => colourHex(v),
  sku: v => sku(v),
  stock: v => wholeNumber(v, 'Stock must be a whole number, 0 or more.'),
  price_override: v => amount(v, 'Price override must be at least ₹0.01, or blank to use the product price.', {
    optional: true
  }),
  is_active: v => v !== false,
  sort_order: v => displayOrder(v),
  gross_weight_g: v => grams(v, 'Gross weight'),
  net_metal_weight_g: v => grams(v, 'Net metal weight')
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
/** A company chosen as manufacturer / packer / importer: its id, checked against the Companies list when given. */
function partyRef(value, parties, label) {
  const id = text(value) || null;
  if (id && parties && !parties.some(p => String(p.id) === id)) throw new Error(`${label}: choose a company from the Companies list.`);
  return id;
}
/**
 * `parties`: the Companies list, to check a chosen manufacturer / packer / importer
 * exists (the database's foreign keys check it again).
 */
function catalogueProductPayload(input, categories, parties = null) {
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
    if (!PURITY[row.metal]) c.fail('purity', `Purity is only for gold, silver and platinum${row.metal ? `, not ${METAL_LABELS[row.metal].toLowerCase()}` : ': choose the metal first'}.`);else if (!PURITY[row.metal][row.purity]) c.fail('purity', `${row.purity} is not a ${row.metal} grade. Use ${Object.entries(PURITY[row.metal]).map(([k, v]) => `${k} (${v})`).join(', ')}.`);
  }
  if (row.making_charge_type !== undefined && row.making_charge_value !== undefined && row.making_charge_type == null !== (row.making_charge_value == null)) {
    c.fail('making_charge_value', 'Making charges need both a type and a value.');
  }
  if (row.making_charge_type === 'percent' && row.making_charge_value > 100) c.fail('making_charge_value', 'A making charge percentage cannot be over 100.');
  if (row.pricing_mode === 'rate_linked' && isActive) c.fail('pricing_mode', RATE_LINKED_NOT_LIVE);
  return row;
}

/**
 * What a listing should declare before it goes live, and does not yet. A WARNING
 * list — nothing here stops a save or a publish (the owner's rule: a catalogue
 * must never lock up waiting for a backfill). `jewellery`: the product sits under
 * the Jewellery category.
 */
function declarationWarnings(product, {
  store = 'fashion',
  jewellery = false
} = {}) {
  const missing = [];
  const add = (field, label) => missing.push({
    field,
    label
  });
  if (!text(product?.country_of_origin)) add('country_of_origin', 'country of origin');
  if (!product?.manufacturer_id) add('manufacturer_id', 'manufacturer');
  if (text(product?.country_of_origin) && text(product.country_of_origin) !== 'IN' && !product.importer_id) add('importer_id', 'importer (it is made outside India)');
  if (!text(product?.net_content)) add('net_content', 'net quantity');
  if (store === 'fashion' && !jewellery) {
    if (!text(product?.material)) add('material', 'material');
    if (!text(product?.care)) add('care', 'care instructions');
  }
  if (jewellery) {
    if (!product?.metal) add('metal', 'metal');else if (PURITY[product.metal] && product.purity == null) add('purity', 'purity');
    const sizes = (product?.variants || []).filter(v => v.is_active !== false);
    if (sizes.some(v => v.gross_weight_g == null || v.net_metal_weight_g == null)) add('variants', 'gross and net weight on every size');
  }
  return missing;
}

/** A company the catalogue names as manufacturer, packer or importer. Names are unique, case aside. */
function cataloguePartyPayload(input, parties = [], id = null) {
  const c = collector();
  const name = text(input.name);
  if (!name) c.fail('name', 'Enter the company’s name.');else if (name.length > 160) c.fail('name', 'Keep the company name under 160 characters.');else if (parties.some(p => String(p.id) !== String(id) && text(p.name).toLowerCase() === name.toLowerCase())) c.fail('name', 'Another company already has this name. Each company once.');
  const address = text(input.address);
  if (!address) c.fail('address', 'Enter the address as it is printed on the label.');else if (address.length > 400) c.fail('address', 'Keep the address under 400 characters.');
  const country = text(input.country).toUpperCase() || 'IN';
  if (!/^[A-Z]{2}$/.test(country)) c.fail('country', 'Country must be a 2-letter code such as IN.');
  const phone = text(input.phone) || null;
  if (phone && phone.length > 40) c.fail('phone', 'Keep the phone under 40 characters.');
  const email = text(input.email) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) c.fail('email', 'Enter an email address like name@domain.com.');
  const gstin = text(input.gstin).toUpperCase() || null;
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) c.fail('gstin', 'GSTIN must be 15 characters like 27ABCDE1234F1Z5.');
  c.done();
  return {
    name,
    address,
    country,
    phone,
    email,
    gstin
  };
}

/** One kind of stone in a jewellery piece. */
function catalogueStonePayload(input) {
  const c = collector();
  const stone = text(input.stone);
  if (!stone) c.fail('stone', 'Name the stone: diamond, ruby, cubic zirconia…');else if (stone.length > 60) c.fail('stone', 'Keep the stone’s name under 60 characters.');
  const origin = text(input.origin);
  if (!STONE_ORIGINS.includes(origin)) c.fail('origin', 'Origin must be natural, lab_grown or simulant: say which.');
  const count = Number(text(input.stone_count));
  if (!Number.isInteger(count) || count < 1) c.fail('stone_count', 'Stone count must be a whole number, 1 or more.');
  const caratText = text(input.total_carat),
    weightText = text(input.total_weight_g);
  const total_carat = caratText === '' ? null : Number(caratText);
  if (total_carat != null && !(Number.isFinite(total_carat) && total_carat > 0 && total_carat < 10000)) c.fail('total_carat', 'Total carat must be more than 0.');
  const total_weight_g = c.take('total_weight_g', () => grams(weightText, 'Total weight'));
  const lab = text(input.certificate_lab) || null,
    number = text(input.certificate_no) || null;
  if (!!lab !== !!number) c.fail(lab ? 'certificate_no' : 'certificate_lab', 'A certificate needs both its lab and its number.');
  const row = {
    stone,
    origin,
    stone_count: count,
    shape: c.take('shape', () => limited(input.shape, 40, 'Shape')),
    total_carat: total_carat == null ? null : Math.round(total_carat * 1000) / 1000,
    total_weight_g,
    clarity: c.take('clarity', () => limited(input.clarity, 20, 'Clarity')),
    colour_grade: c.take('colour_grade', () => limited(input.colour_grade, 20, 'Colour grade')),
    certificate_lab: c.take('certificate_lab', () => limited(lab, 40, 'Certificate lab')),
    certificate_no: c.take('certificate_no', () => limited(number, 60, 'Certificate number')),
    sort_order: c.take('sort_order', () => displayOrder(input.sort_order))
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
    sort_order: c.take('sort_order', () => V.sort_order(input.sort_order)),
    // 0036: a jewellery piece's weights (a ring's change with its size).
    gross_weight_g: c.take('gross_weight_g', () => V.gross_weight_g(input.gross_weight_g)),
    net_metal_weight_g: c.take('net_metal_weight_g', () => V.net_metal_weight_g(input.net_metal_weight_g))
  };
  if (row.gross_weight_g != null && row.net_metal_weight_g != null && row.net_metal_weight_g > row.gross_weight_g) {
    c.fail('net_metal_weight_g', `Net metal weight ${row.net_metal_weight_g} g cannot be more than the gross weight ${row.gross_weight_g} g.`);
  }
  c.done();
  return row;
}
function assertCataloguePublishable(store, product) {
  requireCatalogueStore(store);
  if (!(product.images || []).some(url => safeVisualUrl(url))) throw new Error('Add a product image before publishing.');
  if (store === 'fashion' && !(product.variants || []).some(row => row.is_active !== false)) throw new Error('Add at least one active size/colour variant with stock before publishing. Zero stock is allowed for sold-out products.');
  if (product.pricing_mode === 'rate_linked') throw new Error(RATE_LINKED_NOT_LIVE);
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
  catalogue_product_stones_check: ['certificate_no', 'A certificate needs both its lab and its number.']
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
const PRODUCT_EDITABLE_FIELDS = ['name', 'slug', 'category_id', 'brand', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'sort_order', 'is_active', 'is_new', 'is_bestseller', 'country_of_origin', 'generic_name', 'manufacturer_id', 'packer_id', 'importer_id', 'material', 'care', 'fit', 'metal', 'purity', 'making_charge_type', 'making_charge_value', 'pricing_mode'];
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

// ---- Gallery files: their order, and matching them to products by name ---------------
// Files chosen together are taken in file-name order whatever order the file
// dialog hands them over in, numbers compared as numbers (x-2 before x-10), so
// "<slug>-1" is always first — and, in an empty gallery, the primary.
function sortByFileName(files) {
  return [...(files || [])].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'en', {
    numeric: true,
    sensitivity: 'base'
  }));
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
function planBulkImages(files, products, {
  append = false
} = {}) {
  const bySlug = new Map((products || []).map(p => [String(p.slug || '').toLowerCase(), p]));
  const groups = new Map(),
    unmatched = [];
  for (const file of files || []) {
    const name = String(file?.name || '');
    const match = BULK_IMAGE_NAME.exec(name);
    if (!match) {
      unmatched.push({
        name,
        reason: /\.(webp|jpe?g|png)$/i.test(name) ? 'The name does not end in -<number>, e.g. -1.webp.' : 'Not a JPEG, PNG or WebP file.'
      });
      continue;
    }
    const slug = match[1].toLowerCase(),
      product = bySlug.get(slug);
    if (!product) {
      unmatched.push({
        name,
        reason: `No product in this store has the slug “${slug}”.`
      });
      continue;
    }
    if (!groups.has(product.id)) groups.set(product.id, {
      product,
      entries: []
    });
    groups.get(product.id).entries.push({
      file,
      number: Number(match[2])
    });
  }
  const uploads = [],
    held = [];
  for (const {
    product,
    entries
  } of groups.values()) {
    entries.sort((a, b) => a.number - b.number || a.file.name.localeCompare(b.file.name));
    const row = {
      product,
      files: entries.map(e => e.file),
      numbers: entries.map(e => e.number),
      existing: (product.media || []).length
    };
    const repeated = [...new Set(row.numbers.filter((n, i) => row.numbers.indexOf(n) !== i))];
    if (repeated.length) {
      held.push({
        ...row,
        reason: `More than one file is numbered ${repeated.join(', ')} (${entries.filter(e => repeated.includes(e.number)).map(e => e.file.name).join(', ')}). Keep one file per number.`
      });
    } else if (row.existing && !append) {
      held.push({
        ...row,
        reason: `Already has ${row.existing} image${row.existing === 1 ? '' : 's'}. Tick “Also add to products that already have images” to add these after them.`
      });
    } else uploads.push(row);
  }
  const byName = (a, b) => String(a.product.name).localeCompare(String(b.product.name));
  return {
    uploads: uploads.sort(byName),
    held: held.sort(byName),
    unmatched: unmatched.sort((a, b) => a.name.localeCompare(b.name, 'en', {
      numeric: true
    })),
    fileCount: uploads.reduce((n, row) => n + row.files.length, 0)
  };
}

// Uses existing admin RLS. No service credentials, schema changes or wellness writes.
const PRODUCT_SELECT = '*, variants:catalogue_variants (*), media:catalogue_product_media (*), stones:catalogue_product_stones (*)';
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
  // The Companies list is read only when the product names a company, to check it is still there.
  const namesCompany = ['manufacturer_id', 'packer_id', 'importer_id'].some(key => String(input[key] ?? '').trim());
  const [categories, parties] = await Promise.all([listStoreCategories(store), namesCompany ? listStoreParties() : null]);
  const autoSlug = !String(input.slug ?? '').trim();
  const row = await validated(() => catalogueProductPayload(input, categories, parties), built => productKeyClashes(store, id, built || {
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
  // Images and variants as stored; the pricing mode as this save sets it (switching to fixed and publishing is one save).
  if (row.is_active) assertCataloguePublishable(store, {
    ...(await getStoreProduct(store, id)),
    pricing_mode: row.pricing_mode
  });
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
// ---- Companies (0036): the manufacturer / packer / importer a listing names ---------
// One list for every store. A company named on a product cannot be deleted (the
// database's foreign keys restrict it); the admin is told which products to change.
async function listStoreParties() {
  return (await result(supabase.from('catalogue_parties').select('*').order('name', {
    ascending: true
  }), 'company')) || [];
}
async function saveStoreParty(id, input, expectedUpdatedAt = null) {
  const parties = await listStoreParties();
  if (id && !parties.some(p => String(p.id) === String(id))) throw new CatalogueStaleWriteError('This company could not be found — it may have been deleted. Nothing was saved.');
  const row = cataloguePartyPayload(input, parties, id);
  if (id) return guardedUpdate('catalogue_parties', {
    id
  }, row, expectedUpdatedAt, 'company');
  return result(supabase.from('catalogue_parties').insert(row).select().single(), 'company');
}
/** Every product (any store) that names this company, and as what. */
async function partyUsage(id) {
  const uses = [];
  for (const [field, role] of [['manufacturer_id', 'manufacturer'], ['packer_id', 'packer'], ['importer_id', 'importer']]) {
    const rows = await result(supabase.from('catalogue_products').select('id, name, store').eq(field, id), 'company');
    for (const row of rows || []) uses.push({
      ...row,
      role
    });
  }
  return uses;
}
async function deleteStoreParty(id, expectedUpdatedAt) {
  const uses = await partyUsage(id);
  if (uses.length) {
    const names = [...new Set(uses.map(u => `“${u.name}”`))];
    throw new Error(`This company is named on ${uses.length} product${uses.length === 1 ? '' : 's'} (${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}). Choose another company on ${uses.length === 1 ? 'it' : 'them'} first.`);
  }
  await guardedDelete('catalogue_parties', {
    id
  }, expectedUpdatedAt, 'company');
}

// ---- Stones (0036): one row per kind of stone in a jewellery piece ------------------
async function saveStoreStone(store, productId, id, input, expectedUpdatedAt = null) {
  requireCatalogueStore(store);
  const product = await getStoreProduct(store, productId);
  if (id && !(product.stones || []).some(s => s.id === id)) throw new CatalogueStaleWriteError('This stone is no longer on the product. Reload to see the current stones.');
  const row = catalogueStonePayload(input);
  if (id) return guardedUpdate('catalogue_product_stones', {
    product_id: productId,
    id
  }, row, expectedUpdatedAt, 'stone');
  return result(supabase.from('catalogue_product_stones').insert({
    ...row,
    product_id: productId
  }).select().single(), 'stone');
}
async function deleteStoreStone(store, productId, id, expectedUpdatedAt) {
  requireCatalogueStore(store);
  const product = await getStoreProduct(store, productId);
  if (!(product.stones || []).some(s => s.id === id)) throw new CatalogueStaleWriteError('This stone is no longer on the product. Reload to see the current stones.');
  await guardedDelete('catalogue_product_stones', {
    product_id: productId,
    id
  }, expectedUpdatedAt, 'stone');
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
 * Storefront art (the Fashion and Lifestyle editors): the same WebP conversion — never a raw
 * upload — into the same admin-only bucket, under storefront/. The build copies it into the
 * deployment when it is published (build/publish-content.mjs).
 */
async function uploadStorefrontImage(file) {
  const webp = await compressToWebp(file);
  let url;
  try {
    url = await uploadImage(webp.file, 'storefront');
  } catch (error) {
    throw catalogueWriteError(error, 'image');
  }
  return {
    url,
    bytes: webp.bytes,
    width: webp.width,
    height: webp.height
  };
}
/**
 * Add several images to a product's gallery, one at a time, in file-name order
 * (sortByFileName), whatever order they were chosen in. A file that fails
 * (unreadable, cannot fit 150 KB, upload refused) is reported and the rest go
 * on. The first image a product ever gets becomes its primary.
 * onProgress(index in that order, { name, status: converting|uploading|added|failed, bytes?, unchanged?, error? })
 */
async function addStoreImages(store, productId, files, onProgress = () => {}) {
  requireCatalogueStore(store);
  const results = [];
  for (const [index, file] of sortByFileName(files).entries()) {
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
        bytes: webp.bytes,
        unchanged: webp.unchanged === true
      });
      results.push({
        name: file?.name,
        ok: true,
        bytes: webp.bytes,
        unchanged: webp.unchanged === true
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
/**
 * Run a bulk gallery upload planned by planBulkImages: each product's files go
 * through addStoreImages (the same conversion, bucket and media rows as the
 * product editor), one product at a time. A product whose gallery changed since
 * the plan was made is skipped, not added to — choosing the files again
 * re-plans against the gallery as it is.
 * onProgress({ status, fileName, productName, product, products, file, files }) — product and file count from 1.
 * Resolves [{ product, added, unchanged, failed: [{ name, error }], skipped? }].
 */
async function addStoreImagesByName(store, plan, onProgress = () => {}) {
  requireCatalogueStore(store);
  const rows = plan?.uploads || [],
    results = [];
  for (const [k, {
    product,
    files,
    existing
  }] of rows.entries()) {
    try {
      const count = ((await getStoreProduct(store, product.id)).media || []).length;
      if (count !== existing) {
        results.push({
          product,
          added: 0,
          unchanged: 0,
          failed: [],
          skipped: `Its gallery changed after the files were chosen (${existing} image${existing === 1 ? '' : 's'} then, ${count} now). Nothing was added — choose the files again.`
        });
        continue;
      }
    } catch (error) {
      results.push({
        product,
        added: 0,
        unchanged: 0,
        failed: [],
        skipped: error.message
      });
      continue;
    }
    const out = await addStoreImages(store, product.id, files, (index, state) => onProgress({
      status: state.status,
      fileName: state.name,
      productName: product.name,
      product: k + 1,
      products: rows.length,
      file: index + 1,
      files: files.length
    }));
    const ok = out.filter(r => r.ok);
    results.push({
      product,
      added: ok.length,
      unchanged: ok.filter(r => r.unchanged).length,
      failed: out.filter(r => !r.ok).map(r => ({
        name: r.name,
        error: r.error
      }))
    });
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
      if (plan.kind === 'products') await saveStoreProduct(store, change.kind === 'create' ? null : change.id, change.input, change.expectedUpdatedAt);else if (plan.kind === 'stones') await saveStoreStone(store, change.productId, change.kind === 'create' ? null : change.stoneId, change.input, change.expectedUpdatedAt);else if (plan.kind === 'companies') await saveStoreParty(change.kind === 'create' ? null : change.id, change.input, change.expectedUpdatedAt);else await saveStoreVariant(store, change.productId, change.kind === 'create' ? null : change.variantId, change.input, change.expectedUpdatedAt);
      done.push(change);
    } catch (error) {
      const reason = error.isStaleWrite ? 'Changed since this file was planned — choose the file again to plan against the current values.' : error.fieldErrors ? Object.values(error.fieldErrors).join(' ') : error.message;
      failed.push({
        line: change.line,
        key: change.slug || change.label || change.name,
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

export { saveStoreParty as $, versionAfterOwnWrite as A, saveStoreProduct as B, CLAIM_KINDS as C, saveStoreCategory as D, applyCatalogueImport as E, FITS as F, GROCERY_NOT_SOLD as G, addStoreImagesByName as H, deleteStoreDemoRows as I, deleteStoreParty as J, deleteStoreVariant as K, saveStoreVariant as L, METALS as M, STONE_ORIGINS as N, deleteStoreStone as O, PRODUCT_FIELD_RULES as P, saveStoreStone as Q, RATE_LINKED_NOT_LIVE as R, STONE_ORIGIN_LABELS as S, sortByFileName as T, addStoreImages as U, VARIANT_FIELD_RULES as V, saveStoreMediaAlt as W, removeStoreMedia as X, saveStoreMedia as Y, setStoreMediaPrimary as Z, uploadStoreImage as _, CATALOGUE_STORES as a, reorderStoreMedia as a0, catalogueProductPayload as b, claimWarnings as c, catalogueVariantPayload as d, catalogueStonePayload as e, cataloguePartyPayload as f, categoryOptions as g, listStoreProducts as h, listStoreParties as i, catalogueProductHref as j, isJewelleryCategory as k, listStoreCategories as l, getStoreProduct as m, declarationWarnings as n, catalogueSlug as o, productClaimWarnings as p, gstNote as q, METAL_LABELS as r, PURITY as s, MAKING_TYPES as t, uploadStorefrontImage as u, MAKING_LABELS as v, catalogueFailureView as w, planBulkImages as x, previewStoreDemoDelete as y, GROCERY_VARIANTS_UNREAD as z };
//# sourceMappingURL=claimWarnings.js.map
