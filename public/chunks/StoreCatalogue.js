import { u as useParams, _ as useNavigate, j as jsxRuntimeExports, c as Link, ca as useSearchParams, r as reactExports, q as money, $ as useLocation } from '../bundle.js';
import { a as CATALOGUE_STORES, P as PRODUCT_FIELD_RULES, b as catalogueProductPayload, p as productClaimWarnings, V as VARIANT_FIELD_RULES, d as catalogueVariantPayload, e as catalogueStonePayload, f as cataloguePartyPayload, g as categoryOptions, G as GROCERY_NOT_SOLD, l as listStoreCategories, h as listStoreProducts, i as listStoreParties, j as catalogueProductHref, k as isJewelleryCategory, m as getStoreProduct, n as declarationWarnings, o as catalogueSlug, q as gstNote, F as FITS, M as METALS, r as METAL_LABELS, s as PURITY, t as MAKING_TYPES, v as MAKING_LABELS, R as RATE_LINKED_NOT_LIVE, w as catalogueFailureView, x as planBulkImages, y as previewStoreDemoDelete, z as GROCERY_VARIANTS_UNREAD, S as STONE_ORIGIN_LABELS, A as versionAfterOwnWrite, B as saveStoreProduct, C as CLAIM_KINDS, D as saveStoreCategory, E as applyCatalogueImport, H as addStoreImagesByName, I as deleteStoreDemoRows, J as deleteStoreParty, K as deleteStoreVariant, L as saveStoreVariant, N as STONE_ORIGINS, O as deleteStoreStone, Q as saveStoreStone, T as sortByFileName, U as addStoreImages, W as saveStoreMediaAlt, X as removeStoreMedia, Y as saveStoreMedia, Z as setStoreMediaPrimary, _ as uploadStoreImage, $ as saveStoreParty, a0 as reorderStoreMedia } from './claimWarnings.js';

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
// Four files: products (one row per product), variants (one row per size ×
// colour, matched on the product's slug, the size and the colour), stones (one
// row per kind of stone in a jewellery piece) and companies (the Companies list
// that products name as manufacturer, packer or importer; migration 0036).
// ============================================================

// The 0036 declarations ride on the products file; a manufacturer, packer or importer
// is written by its company name (the Companies list) and stored as that company's id.
const DECLARATION_COLUMNS = ['country_of_origin', 'generic_name', 'manufacturer', 'packer', 'importer', 'material', 'care', 'fit', 'metal', 'purity', 'making_charge_type', 'making_charge_value', 'pricing_mode'];
const PRODUCT_CSV_COLUMNS = ['id', 'slug', 'name', 'brand', 'category', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'is_new', 'is_bestseller', 'sort_order', ...DECLARATION_COLUMNS];
const VARIANT_CSV_COLUMNS = ['product_slug', 'size', 'colour', 'colour_hex', 'sku', 'stock', 'price_override', 'is_active', 'sort_order', 'gross_weight_g', 'net_metal_weight_g'];
const STONE_CSV_COLUMNS = ['product_slug', 'stone', 'origin', 'shape', 'stone_count', 'total_carat', 'total_weight_g', 'clarity', 'colour_grade', 'certificate_lab', 'certificate_no', 'sort_order'];
const COMPANY_CSV_COLUMNS = ['name', 'address', 'country', 'phone', 'email', 'gstin'];
const PARTY_COLUMNS = {
  manufacturer: 'manufacturer_id',
  packer: 'packer_id',
  importer: 'importer_id'
};
const PRODUCT_FIELDS$1 = ['slug', 'name', 'brand', 'category_id', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'is_new', 'is_bestseller', 'sort_order', 'country_of_origin', 'generic_name', 'manufacturer_id', 'packer_id', 'importer_id', 'material', 'care', 'fit', 'metal', 'purity', 'making_charge_type', 'making_charge_value', 'pricing_mode'];
const VARIANT_FIELDS$1 = ['colour_hex', 'sku', 'stock', 'price_override', 'is_active', 'sort_order', 'gross_weight_g', 'net_metal_weight_g'];
const STONE_FIELDS$1 = ['origin', 'stone_count', 'total_carat', 'total_weight_g', 'clarity', 'colour_grade', 'certificate_lab', 'certificate_no', 'sort_order'];
const COMPANY_FIELDS$1 = ['address', 'country', 'phone', 'email', 'gstin'];
const MONEY = new Set(['mrp', 'sale_price', 'price_override', 'making_charge_value']);
const NUMBER = new Set(['mrp', 'sale_price', 'price_override', 'gst_rate', 'stock', 'sort_order', 'purity', 'making_charge_value', 'gross_weight_g', 'net_metal_weight_g', 'stone_count', 'total_carat', 'total_weight_g']);
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
  net_content: 'Net quantity / pack',
  hsn_code: 'HSN code',
  gst_rate: 'GST rate',
  stock: 'Stock',
  is_new: 'New arrival',
  is_bestseller: 'Bestseller',
  sort_order: 'Display order',
  colour_hex: 'Colour hex',
  price_override: 'Price override',
  is_active: 'Active',
  country_of_origin: 'Country of origin',
  generic_name: 'Generic name',
  manufacturer_id: 'Manufacturer',
  packer_id: 'Packer',
  importer_id: 'Importer',
  material: 'Material',
  care: 'Care',
  fit: 'Fit',
  metal: 'Metal',
  purity: 'Purity',
  making_charge_type: 'Making charge type',
  making_charge_value: 'Making charges',
  pricing_mode: 'Pricing',
  gross_weight_g: 'Gross weight (g)',
  net_metal_weight_g: 'Net metal weight (g)',
  origin: 'Origin',
  stone_count: 'Count',
  total_carat: 'Total carat',
  total_weight_g: 'Total weight (g)',
  clarity: 'Clarity',
  colour_grade: 'Colour grade',
  certificate_lab: 'Certificate lab',
  certificate_no: 'Certificate no.',
  address: 'Address',
  country: 'Country',
  phone: 'Phone',
  email: 'Email',
  gstin: 'GSTIN'
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
const partyName = (parties, id) => id ? (parties || []).find(p => String(p.id) === String(id))?.name || '' : '';
function productsToCsv(products, categories, parties = []) {
  const paths = categoryPaths(categories);
  return csv(PRODUCT_CSV_COLUMNS, products.map(p => ({
    ...p,
    category: paths.get(p.category_id) || '',
    manufacturer: partyName(parties, p.manufacturer_id),
    packer: partyName(parties, p.packer_id),
    importer: partyName(parties, p.importer_id)
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
function stonesToCsv(products) {
  const rows = [];
  for (const p of products) for (const s of p.stones || []) rows.push({
    ...s,
    product_slug: p.slug
  });
  return csv(STONE_CSV_COLUMNS, rows);
}
function companiesToCsv(parties) {
  return csv(COMPANY_CSV_COLUMNS, parties || []);
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
  parties = [],
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
        } else if (PARTY_COLUMNS[column]) {
          // A company by its name in the Companies list (case aside), stored as its id.
          const name = String(raw).trim();
          const party = (parties || []).find(row => String(row.name).trim().toLowerCase() === name.toLowerCase());
          if (!party) throw new Error(`${column[0].toUpperCase()}${column.slice(1)} “${name}” is not in the Companies list — add it on the Companies tab (or import the companies file) first.`);
          values[PARTY_COLUMNS[column]] = party.id;
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
      catalogueProductPayload(input, categories, parties);
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

// ---------- plan: stones (0036) ----------
/**
 * One row per kind of stone in a jewellery piece, matched on the product's slug,
 * the stone and its shape ("diamond", "round"). A stone's own values follow the
 * same blank / fill-only / create rules as every other file.
 */
function planStoneImport(text, {
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
  if (!head.includes('product_slug') || !head.includes('stone')) return {
    ok: false,
    reason: 'The file needs "product_slug" and "stone" columns to match stones on.',
    changes: [],
    kept: [],
    skipped: []
  };
  const ignored = head.filter(h => h && !STONE_CSV_COLUMNS.includes(h));
  const col = name => head.indexOf(name);
  const cell = (cells, name) => col(name) >= 0 ? String(cells[col(name)] ?? '').trim() : '';
  const bySlug = new Map(products.map(p => [p.slug, p]));
  const planned = [],
    skipped = [],
    keyLines = new Map();
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r],
      line = r + 1;
    const productSlug = cell(cells, 'product_slug'),
      stone = cell(cells, 'stone'),
      shape = cell(cells, 'shape');
    const label = `${productSlug} · ${stone}${shape ? ` (${shape})` : ''}`;
    const product = bySlug.get(productSlug);
    if (!product) {
      skipped.push({
        line,
        key: label,
        reason: `No ${CATALOGUE_STORES[store]} product has the slug "${productSlug}".`
      });
      continue;
    }
    if (!stone) {
      skipped.push({
        line,
        key: label,
        reason: 'A row needs the stone.'
      });
      continue;
    }
    const key = `${product.id}|${stone.toLowerCase()}|${shape.toLowerCase()}`;
    keyLines.set(key, [...(keyLines.get(key) || []), line]);
    const current = (product.stones || []).find(s => String(s.stone).trim().toLowerCase() === stone.toLowerCase() && String(s.shape || '').trim().toLowerCase() === shape.toLowerCase()) || null;
    const creating = !current;
    if (creating && !create) {
      skipped.push({
        line,
        key: label,
        reason: 'This product has no such stone. Tick "Create new" to add it.'
      });
      continue;
    }
    const values = {};
    for (const field of STONE_FIELDS$1) if (col(field) >= 0 && !blank(cells[col(field)])) values[field] = cell(cells, field);
    const {
      diffs,
      applied
    } = diffRow(current, values, STONE_FIELDS$1, {
      overwrite,
      creating
    });
    const meta = {
      line,
      productId: product.id,
      product: product.name,
      stoneId: current?.id ?? null,
      label
    };
    if (!creating && !diffs.some(d => !d.skipped)) {
      if (diffs.length) planned.push({
        ...meta,
        kind: 'kept',
        diffs,
        input: null
      });
      continue;
    }
    const input = creating ? {
      stone,
      shape,
      sort_order: (product.stones || []).length,
      ...applied
    } : {
      ...current,
      ...applied
    };
    try {
      catalogueStonePayload(input);
    } catch (error) {
      skipped.push({
        line,
        key: label,
        reason: reasons(error)
      });
      continue;
    }
    planned.push({
      ...meta,
      kind: creating ? 'create' : 'update',
      diffs,
      input,
      expectedUpdatedAt: current?.updated_at ?? null
    });
  }
  return finishPlan('stones', planned, skipped, keyLines, ignored, 'This stone appears more than once in the file');
}

// ---------- plan: companies (0036) ----------
/** The Companies list: one row per company, matched on its name (case aside). */
function planCompanyImport(text, {
  parties = [],
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
  if (!head.includes('name')) return {
    ok: false,
    reason: 'The file needs a "name" column to match companies on.',
    changes: [],
    kept: [],
    skipped: []
  };
  const ignored = head.filter(h => h && !COMPANY_CSV_COLUMNS.includes(h));
  const col = name => head.indexOf(name);
  const planned = [],
    skipped = [],
    keyLines = new Map();
  const after = [...parties];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r],
      line = r + 1;
    const name = String(cells[col('name')] ?? '').trim();
    if (!name) {
      skipped.push({
        line,
        key: '',
        reason: 'A row needs the company’s name.'
      });
      continue;
    }
    keyLines.set(name.toLowerCase(), [...(keyLines.get(name.toLowerCase()) || []), line]);
    const current = parties.find(p => String(p.name).trim().toLowerCase() === name.toLowerCase()) || null;
    const creating = !current;
    if (creating && !create) {
      skipped.push({
        line,
        key: name,
        reason: 'No company has this name. Tick "Create new" to add it.'
      });
      continue;
    }
    const values = {};
    for (const field of COMPANY_FIELDS$1) {
      if (col(field) < 0 || blank(cells[col(field)])) continue;
      const v = String(cells[col(field)]).trim();
      values[field] = ['country', 'gstin'].includes(field) ? v.toUpperCase() : v;
    }
    const {
      diffs,
      applied
    } = diffRow(current, values, COMPANY_FIELDS$1, {
      overwrite,
      creating
    });
    const meta = {
      line,
      id: current?.id ?? null,
      name
    };
    if (!creating && !diffs.some(d => !d.skipped)) {
      if (diffs.length) planned.push({
        ...meta,
        kind: 'kept',
        diffs,
        input: null
      });
      continue;
    }
    const input = creating ? {
      name,
      ...applied
    } : {
      ...current,
      ...applied
    };
    try {
      cataloguePartyPayload(input, after, current?.id ?? null);
    } catch (error) {
      skipped.push({
        line,
        key: name,
        reason: reasons(error)
      });
      continue;
    }
    if (creating) after.push({
      id: `planned-${line}`,
      name
    });
    planned.push({
      ...meta,
      kind: creating ? 'create' : 'update',
      diffs,
      input,
      expectedUpdatedAt: current?.updated_at ?? null
    });
  }
  return finishPlan('companies', planned, skipped, keyLines, ignored, 'This company appears more than once in the file');
}

/** The common end of the stones and companies plans: a key twice in a file is never guessed between. */
function finishPlan(kind, planned, skipped, keyLines, ignored, twiceReason) {
  const twice = new Set([...keyLines.values()].filter(l => l.length > 1).flat());
  const changes = [],
    kept = [];
  for (const c of planned) {
    if (twice.has(c.line)) {
      skipped.push({
        line: c.line,
        key: c.label || c.name,
        reason: `${twiceReason} (lines ${linesOf(keyLines, c.line).join(', ')}).`
      });
      continue;
    }
    (c.kind === 'kept' ? kept : changes).push(c);
  }
  skipped.sort((a, b) => a.line - b.line);
  return {
    ok: true,
    kind,
    ignored,
    changes,
    kept,
    skipped
  };
}

/** "MRP: 1299 → 1199" — how a diff reads in the plan. */
function describeDiff(diff, categories = [], parties = []) {
  const show = (field, v) => {
    if (!present(v)) return '(empty)';
    if (field === 'category_id') return categoryPaths(categories).get(v) || v;
    if (Object.values(PARTY_COLUMNS).includes(field)) return partyName(parties, v) || v;
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
  is_bestseller: false,
  country_of_origin: '',
  generic_name: '',
  manufacturer_id: '',
  packer_id: '',
  importer_id: '',
  material: '',
  care: '',
  fit: '',
  metal: '',
  purity: '',
  making_charge_type: '',
  making_charge_value: '',
  pricing_mode: 'fixed'
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
  sort_order: 0,
  gross_weight_g: '',
  net_metal_weight_g: ''
};
const EMPTY_STONE = {
  stone: '',
  origin: '',
  shape: '',
  stone_count: 1,
  total_carat: '',
  total_weight_g: '',
  clarity: '',
  colour_grade: '',
  certificate_lab: '',
  certificate_no: '',
  sort_order: 0
};
const EMPTY_COMPANY = {
  name: '',
  address: '',
  country: 'IN',
  phone: '',
  email: '',
  gstin: ''
};

// The fields each form renders. A save error for one of these is shown beside
// it; anything else goes in the form's banner (catalogueFailureView).
const DECLARATION_FIELDS = ['country_of_origin', 'generic_name', 'manufacturer_id', 'packer_id', 'importer_id'];
const PRODUCT_FIELDS = (store, jewellery = false) => ['name', 'slug', 'category_id', 'brand', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', ...(store === 'fashion' ? [] : ['stock']), 'sort_order', 'description', ...DECLARATION_FIELDS, ...(store !== 'fashion' ? [] : jewellery ? ['metal', 'purity', 'making_charge_type', 'making_charge_value', 'pricing_mode'] : ['material', 'care', 'fit'])];
const CATEGORY_FIELDS = ['name', 'slug', 'parent_id', 'sort_order', 'tagline', 'image_url'];
const VARIANT_FIELDS = ['size', 'colour', 'colour_hex', 'sku', 'stock', 'price_override', 'sort_order', 'gross_weight_g', 'net_metal_weight_g'];
const STONE_FIELDS = ['stone', 'origin', 'shape', 'stone_count', 'total_carat', 'total_weight_g', 'clarity', 'colour_grade', 'certificate_lab', 'certificate_no', 'sort_order'];
const COMPANY_FIELDS = ['name', 'address', 'country', 'phone', 'email', 'gstin'];
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
/** A choice from a fixed list; '' is "not set" (empty: null leaves that option out). options: [[value, label], …]. */
function Choice({
  label,
  field,
  value,
  set,
  options,
  errors,
  form = 'sc',
  hint,
  disabled = false,
  empty = 'Not set'
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
      disabled: disabled,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": errorId,
      value: value[field] ?? '',
      onChange: e => {
        errors?.clear(field);
        set({
          ...value,
          [field]: e.target.value
        });
      },
      children: [empty !== null && /*#__PURE__*/jsxRuntimeExports.jsx("option", {
        value: "",
        children: empty
      }), options.map(([v, text]) => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
        value: v,
        children: text
      }, v))]
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
    }), " SORA LIFESTYLE cannot back these claims without proof (a certificate, a courier promise, clinical evidence). This is a warning, not a block: edit the copy if it overstates.", /*#__PURE__*/jsxRuntimeExports.jsx(ClaimList, {
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
// What each import reads, and how its rows are matched. Stones are jewellery's,
// so only the fashion store offers them; companies are one list for every store.
const IMPORT_KINDS = {
  products: {
    chip: 'Products',
    noun: 'products',
    heading: 'Product',
    match: ' Category is the path the export shows, e.g. clothing/shirts. Manufacturer, packer and importer are names from the Companies list.'
  },
  variants: {
    chip: 'Sizes & colours (variants)',
    noun: 'variants',
    heading: 'Variant',
    match: ' Rows are matched on product_slug, size and colour.'
  },
  stones: {
    chip: 'Stones (jewellery)',
    noun: 'stones',
    heading: 'Stone',
    match: ' Rows are matched on product_slug, stone and shape.',
    stores: ['fashion']
  },
  companies: {
    chip: 'Companies',
    noun: 'companies',
    heading: 'Company',
    match: ' Rows are matched on the company name. One list serves every store.'
  }
};
function CatalogueImport({
  store,
  products,
  categories,
  parties,
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
    if (kind === 'products') return planProductImport(file.text, {
      store,
      products,
      categories,
      parties,
      overwrite,
      create
    });
    if (kind === 'stones') return planStoneImport(file.text, {
      store,
      products,
      overwrite,
      create
    });
    if (kind === 'companies') return planCompanyImport(file.text, {
      parties,
      overwrite,
      create
    });
    return planVariantImport(file.text, {
      store,
      products,
      overwrite,
      create
    });
  }, [file, kind, store, products, categories, parties, overwrite, create]);
  const {
    noun,
    heading
  } = IMPORT_KINDS[kind];
  const target = kind === 'companies' ? 'the Companies list' : `${CATALOGUE_STORES[store]} ${noun}`;
  const exportCsv = () => kind === 'products' ? productsToCsv(products, categories, parties) : kind === 'stones' ? stonesToCsv(products) : kind === 'companies' ? companiesToCsv(parties) : variantsToCsv(products);
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
    if (!window.confirm(`Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'} to ${target}?\n\n` + `${updates} to update, ${creates} to create${kind === 'products' && creates ? ' (as drafts)' : ''}.\n` + `${overwrite ? 'EXISTING VALUES WILL BE OVERWRITTEN.' : 'Fill-only: existing values are kept.'}`)) return;
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
      children: Object.entries(IMPORT_KINDS).filter(([, k]) => !k.stores || k.stores.includes(store)).map(([id, k]) => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
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
        children: k.chip
      }, id))
    }), kind === 'products' && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Import the companies first: a product row naming a manufacturer, packer or importer that is not in the Companies list is skipped."
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("ol", {
      className: "sc-steps",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("li", {
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          disabled: busy,
          onClick: () => downloadText(`sora-${kind === 'companies' ? 'companies' : `${store}-${noun}`}-${new Date().toISOString().slice(0, 10)}.csv`, exportCsv()),
          children: ["Export current ", noun, " (CSV)"]
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        children: ["Edit it in a spreadsheet. ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: "A blank cell leaves that field alone"
        }), " \u2014 it never clears it.", IMPORT_KINDS[kind].match]
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
                children: heading
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
                  children: kind === 'products' || kind === 'companies' ? c.name : c.label
                }), kind === 'products' && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                  className: "hint",
                  children: [" ", c.slug]
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("ul", {
                  className: "sc-diffs",
                  children: c.diffs.map(d => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
                    className: d.skipped ? 'is-kept' : '',
                    children: [describeDiff(d, categories, parties), d.skipped ? ' — kept (fill-only)' : '']
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
            children: ["Line ", c.line, " (", c.slug || c.label || c.name, "): ", c.diffs.map(d => describeDiff(d, categories, parties)).join('; ')]
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
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Bulk images: many files at once, each to the product its name gives
// (<slug>-<number>), shown as a plan before anything is uploaded. The upload
// runs in this browser as the signed-in admin, through the product editor's own
// gallery path (addStoreImages): the same conversion, bucket and policies.
function BulkImages({
  store,
  products,
  onApplied
}) {
  const [files, setFiles] = reactExports.useState([]),
    [append, setAppend] = reactExports.useState(false);
  const [busy, setBusy] = reactExports.useState(false),
    [progress, setProgress] = reactExports.useState(''),
    [error, setError] = reactExports.useState(''),
    [results, setResults] = reactExports.useState(null);
  const plan = reactExports.useMemo(() => files.length ? planBulkImages(files, products, {
    append
  }) : null, [files, products, append]);
  function choose(list) {
    const chosen = [...(list || [])];
    if (!chosen.length || busy) return;
    setFiles(chosen);
    setResults(null);
    setError('');
  }
  async function upload() {
    if (!plan?.fileCount || busy) return;
    if (!window.confirm(`Upload ${count(plan.fileCount, 'image')} to ${count(plan.uploads.length, `${CATALOGUE_STORES[store]} product`)}?\n\n` + 'Each goes into its product’s gallery in number order; number 1 becomes the primary of an empty gallery. Nothing is published and no stock changes.')) return;
    setBusy(true);
    setError('');
    setResults(null);
    try {
      setResults(await addStoreImagesByName(store, plan, p => setProgress(`product ${p.product} of ${p.products}, image ${p.file} of ${p.files}`)));
      setFiles([]);
      onApplied();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }
  const added = results ? results.reduce((n, r) => n + r.added, 0) : 0,
    asIs = results ? results.reduce((n, r) => n + r.unchanged, 0) : 0;
  const problems = results ? results.filter(r => r.skipped || r.failed.length) : [];
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel sc-import sc-bulk",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Bulk images"
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("ol", {
      className: "sc-steps",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        children: ["Name each file after its product\u2019s slug and a number: ", /*#__PURE__*/jsxRuntimeExports.jsx("code", {
          children: "blue-linen-shirt-1.webp"
        }), ", ", /*#__PURE__*/jsxRuntimeExports.jsx("code", {
          children: "blue-linen-shirt-2.webp"
        }), ". The slug is the Slug field in the product\u2019s editor, and a column of the CSV export."]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("li", {
        children: "Choose or drop all the files at once, for as many products as you like. You will see which product each file goes to before anything is uploaded."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("li", {
        children: "Number 1 becomes the primary image of an empty gallery; the rest follow in number order. A WebP already under 150 KB is used as it is; anything else is converted like any upload."
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
      className: `sc-drop${busy ? ' is-busy' : ''}`,
      onDragOver: e => e.preventDefault(),
      onDrop: e => {
        e.preventDefault();
        choose(e.dataTransfer?.files);
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: busy ? 'Uploading…' : 'Choose images'
      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "hint",
        children: "JPEG, PNG or WebP, named <slug>-<number>."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
        type: "file",
        multiple: true,
        accept: "image/jpeg,image/png,image/webp",
        disabled: busy,
        onChange: e => {
          const list = [...(e.target.files || [])];
          e.target.value = '';
          choose(list);
        }
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "sc-options",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          checked: append,
          disabled: busy,
          onChange: e => setAppend(e.target.checked)
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: "Also add to products that already have images"
          }), ", after their current images. Off: a product that already has images is left alone."]
        })]
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error,
      message: results ? `${count(added, 'image')} added to ${count(results.filter(r => r.added).length, 'product')}${asIs ? ` (${asIs} used as they were)` : ''}.${problems.length ? ` ${count(problems.length, 'product')} with problems — see below.` : ''} Nothing was published.` : ''
    }), !!problems.length && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "Not everything was added"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
        className: "sc-list",
        children: problems.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: r.product.name
          }), ": ", r.skipped || r.failed.map(f => `${f.name}: ${f.error}`).join(' · ')]
        }, r.product.id))
      })]
    }), plan && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "sc-plan",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "sc-plan__summary",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: count(files.length, 'file')
        }), " \u2014 ", count(plan.fileCount, 'image'), " to upload to ", count(plan.uploads.length, 'product'), " \xB7 ", count(plan.held.length, 'product'), " held back \xB7 ", count(plan.unmatched.length, 'file'), " matching no product"]
      }), !!plan.uploads.length && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Product"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Gallery now"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Images to add, in order"
              })]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: plan.uploads.map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                  children: row.product.name
                }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                  className: "hint",
                  children: [row.product.slug, " \xB7 ", row.product.is_active ? 'Published' : 'Draft']
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: row.existing ? `${count(row.existing, 'image')} — these go after them` : 'Empty'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
                  className: "sc-list",
                  children: row.files.map((file, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
                    children: [file.name, !row.existing && i === 0 ? ' — primary' : '']
                  }, file.name))
                })
              })]
            }, row.product.id))
          })]
        })
      }), !!plan.held.length && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-banner err",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
          children: [count(plan.held.length, 'product'), " held back \u2014 nothing will be uploaded to ", plan.held.length === 1 ? 'it' : 'them']
        }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
          className: "sc-list",
          children: plan.held.map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
              children: row.product.name
            }), " (", count(row.files.length, 'file'), "): ", row.reason]
          }, row.product.id))
        })]
      }), !!plan.unmatched.length && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-banner err",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
          children: [count(plan.unmatched.length, 'file'), " matching no product \u2014 not uploaded"]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
          className: "sc-list",
          children: plan.unmatched.map(u => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
            children: [u.name, ": ", u.reason]
          }, u.name))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn",
          disabled: busy || !plan.fileCount,
          onClick: upload,
          children: busy ? `Uploading… ${progress}` : `Upload ${count(plan.fileCount, 'image')} to ${count(plan.uploads.length, 'product')}`
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          disabled: busy,
          onClick: () => setFiles([]),
          children: "Clear"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Drafts stay drafts and stock is not touched: publish each product from its editor. Keep this tab open until the upload finishes."
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

// Companies (0036): the manufacturers, packers and importers a listing names,
// typed once and chosen from a list. One list for every store; a company still
// named on a product cannot be deleted (deleteStoreParty says which products).
function CompanyEditor({
  initial,
  onSaved,
  onCancel
}) {
  const [form, setForm] = reactExports.useState(initial || EMPTY_COMPANY),
    [busy, setBusy] = reactExports.useState(false);
  const errors = useFormErrors(COMPANY_FIELDS);
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    errors.reset();
    try {
      const row = await saveStoreParty(initial?.id || null, form, initial?.updated_at);
      onSaved(row);
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
      children: initial ? `Edit ${initial.name}` : 'Add company'
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: errors.banner,
      stale: errors.stale
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
      disabled: busy,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "co",
          errors: errors,
          label: "Company name",
          field: "name",
          value: form,
          set: setForm,
          required: true,
          hint: "As printed on the label."
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "co",
          errors: errors,
          label: "Country",
          field: "country",
          value: form,
          set: setForm,
          hint: "2-letter code: IN for India."
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "co",
          errors: errors,
          label: "Phone (optional)",
          field: "phone",
          value: form,
          set: setForm
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "co",
          errors: errors,
          label: "Email (optional)",
          field: "email",
          type: "email",
          value: form,
          set: setForm
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          form: "co",
          errors: errors,
          label: "GSTIN (optional)",
          field: "gstin",
          value: form,
          set: setForm,
          hint: "15 characters, e.g. 27ABCDE1234F1Z5."
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        form: "co",
        errors: errors,
        label: "Address",
        field: "address",
        value: form,
        set: setForm,
        multiline: true,
        hint: "Street, city, state and PIN, as the label prints it. Customers see it on the product page."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          children: busy ? 'Saving…' : 'Save company'
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
function CompaniesPanel({
  store,
  parties,
  products,
  onChanged
}) {
  const [editing, setEditing] = reactExports.useState(null),
    [busy, setBusy] = reactExports.useState(false),
    [message, setMessage] = reactExports.useState(''),
    [error, setError] = reactExports.useState('');
  const named = id => products.filter(p => p.manufacturer_id === id || p.packer_id === id || p.importer_id === id).length;
  async function remove(row) {
    if (!window.confirm(`Delete ${row.name} from the Companies list? This cannot be undone.`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await deleteStoreParty(row.id, row.updated_at);
      setMessage(`${row.name} deleted.`);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "sc-companies",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "The manufacturers, packers and importers your listings name. Each is typed once here and chosen from a list in the product editor. One list serves every store."
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error,
      message: message
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "sc-actions",
      children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-sm",
        disabled: !!editing || busy,
        onClick: () => {
          setEditing('new');
          setMessage('');
        },
        children: "+ Add company"
      })
    }), editing && /*#__PURE__*/jsxRuntimeExports.jsx(CompanyEditor, {
      initial: editing === 'new' ? null : editing,
      onCancel: () => setEditing(null),
      onSaved: row => {
        setEditing(null);
        setMessage(`${row.name} saved.`);
        onChanged();
      }
    }, editing === 'new' ? 'new' : editing.id), !parties.length ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-empty",
      children: "No companies yet. Add the manufacturer of your first listing."
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Company"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Country"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "GSTIN"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Contact"
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("th", {
              children: [CATALOGUE_STORES[store], " products naming it"]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: parties.map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: row.name
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                className: "hint",
                children: [" ", row.address]
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.country
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.gstin || '—'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: [row.phone, row.email].filter(Boolean).join(' · ') || '—'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: named(row.id)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "sc-actions sc-actions--row",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  type: "button",
                  className: "btn btn-outline btn-sm",
                  disabled: !!editing || busy,
                  onClick: () => {
                    setEditing(row);
                    setMessage('');
                    setError('');
                  },
                  children: "Edit"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  type: "button",
                  className: "btn btn-ghost btn-sm sc-danger",
                  disabled: !!editing || busy,
                  onClick: () => remove(row),
                  children: "Delete"
                })]
              })
            })]
          }, row.id))
        })]
      })
    })]
  });
}
function CatalogueList({
  store
}) {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = reactExports.useState([]),
    [products, setProducts] = reactExports.useState([]),
    [parties, setParties] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true),
    [loaded, setLoaded] = reactExports.useState(false),
    [error, setError] = reactExports.useState(''),
    [editing, setEditing] = reactExports.useState(null);
  const [revision, setRevision] = reactExports.useState(0);
  const tab = ['categories', 'companies', 'import', 'images'].includes(params.get('tab')) ? params.get('tab') : 'products';
  const category = params.get('category') || '',
    search = params.get('q') || '';
  reactExports.useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    Promise.all([listStoreCategories(store), listStoreProducts(store), listStoreParties()]).then(([cats, rows, companies]) => {
      if (current) {
        setCategories(cats);
        setProducts(rows);
        setParties(companies);
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
        className: `adm-chip${tab === 'companies' ? ' active' : ''}`,
        onClick: () => update({
          tab: 'companies'
        }),
        children: "Companies"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'import' ? ' active' : ''}`,
        onClick: () => update({
          tab: 'import'
        }),
        children: "Bulk import (CSV)"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'images' ? ' active' : ''}`,
        onClick: () => update({
          tab: 'images'
        }),
        children: "Bulk images"
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
      parties: parties,
      onApplied: () => setRevision(n => n + 1)
    }) : tab === 'companies' ? /*#__PURE__*/jsxRuntimeExports.jsx(CompaniesPanel, {
      store: store,
      parties: parties,
      products: products,
      onChanged: () => setRevision(n => n + 1)
    }) : tab === 'images' ? /*#__PURE__*/jsxRuntimeExports.jsx(BulkImages, {
      store: store,
      products: products,
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
const weightText = row => row.gross_weight_g == null && row.net_metal_weight_g == null ? '—' : `${row.gross_weight_g ?? '?'} g / ${row.net_metal_weight_g ?? '?'} g`;
function VariantsEditor({
  store,
  product,
  onChanged,
  jewellery = false
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
            }), jewellery && /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Gross / net weight"
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
            }), jewellery && /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: weightText(row)
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
          }), jewellery && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
              form: "var",
              errors: errors,
              label: "Gross weight (g)",
              field: "gross_weight_g",
              type: "number",
              min: "0.001",
              step: "0.001",
              value: form,
              set: setForm,
              hint: "The whole piece, stones included. Example: 4.250"
            }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
              form: "var",
              errors: errors,
              label: "Net metal weight (g)",
              field: "net_metal_weight_g",
              type: "number",
              min: "0.001",
              step: "0.001",
              value: form,
              set: setForm,
              hint: "The metal alone: gross weight minus the stones."
            })]
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

// Stones (0036): one row per kind of stone in a jewellery piece. A plain metal
// piece has none. Customers see them under Product information.
const STONE_ORIGIN_OPTIONS = STONE_ORIGINS.map(o => [o, STONE_ORIGIN_LABELS[o]]);
function StonesEditor({
  store,
  product,
  onChanged
}) {
  const [form, setForm] = reactExports.useState(EMPTY_STONE),
    [editing, setEditing] = reactExports.useState(null);
  const [busy, setBusy] = reactExports.useState(false),
    [message, setMessage] = reactExports.useState('');
  const errors = useFormErrors(STONE_FIELDS);
  const stones = [...(product.stones || [])].sort((a, b) => a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)));
  const nameOf = row => `${row.stone}${row.shape ? ` (${row.shape})` : ''}`;
  async function remove(row) {
    if (!window.confirm(`Delete the ${nameOf(row)} row? This cannot be undone.`)) return;
    setBusy(true);
    errors.reset();
    setMessage('');
    try {
      await deleteStoreStone(store, product.id, row.id, row.updated_at);
      if (editing === row.id) {
        setEditing(null);
        setForm(EMPTY_STONE);
      }
      await onChanged();
      setMessage(`${nameOf(row)} deleted.`);
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
    try {
      await saveStoreStone(store, product.id, editing, form, editing ? form.updated_at : null);
      setForm(EMPTY_STONE);
      setEditing(null);
      await onChanged();
      setMessage('Stone saved.');
    } catch (err) {
      errors.capture(err);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Stones"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "One row per kind of stone: \u201Cdiamond, round, 12 stones, 0.24 ct\u201D is one row. Say whether each is natural, lab-grown or a simulant \u2014 customers see it. A plain metal piece has none."
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: errors.banner,
      message: message,
      stale: errors.stale
    }), !!stones.length && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Stone"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Origin"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Count"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Carat / weight"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Certificate"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: stones.map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: nameOf(row)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: STONE_ORIGIN_LABELS[row.origin] || row.origin
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.stone_count
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: [row.total_carat != null && `${row.total_carat} ct`, row.total_weight_g != null && `${row.total_weight_g} g`].filter(Boolean).join(' · ') || '—'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.certificate_lab ? `${row.certificate_lab} ${row.certificate_no}` : '—'
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
          children: editing ? 'Edit stone' : 'Add stone'
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Stone",
            field: "stone",
            value: form,
            set: setForm,
            required: true,
            hint: "Diamond, ruby, cubic zirconia, pearl\u2026"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
            form: "stone",
            errors: errors,
            label: "Origin",
            field: "origin",
            value: form,
            set: setForm,
            options: STONE_ORIGIN_OPTIONS,
            empty: "Choose: natural, lab-grown or simulant"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Shape (optional)",
            field: "shape",
            value: form,
            set: setForm,
            hint: "Round, oval, pear\u2026"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Number of stones",
            field: "stone_count",
            type: "number",
            min: "1",
            step: "1",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Total carat (optional)",
            field: "total_carat",
            type: "number",
            min: "0.001",
            step: "0.001",
            value: form,
            set: setForm,
            hint: "All the stones in this row together."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Total weight g (optional)",
            field: "total_weight_g",
            type: "number",
            min: "0.001",
            step: "0.001",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Clarity (optional)",
            field: "clarity",
            value: form,
            set: setForm,
            hint: "Example: VS2"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Colour grade (optional)",
            field: "colour_grade",
            value: form,
            set: setForm,
            hint: "Example: G"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Certificate lab (optional)",
            field: "certificate_lab",
            value: form,
            set: setForm,
            hint: "IGI, GIA, SGL\u2026 with its number below."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Certificate number (optional)",
            field: "certificate_no",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "stone",
            errors: errors,
            label: "Display order",
            field: "sort_order",
            type: "number",
            step: "1",
            value: form,
            set: setForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm",
            type: "submit",
            children: busy ? 'Saving…' : 'Save stone'
          }), editing && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-outline btn-sm",
            type: "button",
            onClick: () => {
              setEditing(null);
              setForm(EMPTY_STONE);
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
    const files = sortByFileName(fileList); // the order addStoreImages adds them in
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
    // Optional: an empty URL (Enter in the alt-text box) adds nothing and is not an error.
    if (!urlForm.public_url.trim()) return;
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
          children: [UPLOAD_STATUS[row.status], row.bytes && row.status === 'added' ? ` · ${kb(row.bytes)} WebP${row.unchanged ? ', used as it was' : ''}` : '', row.error ? `: ${row.error}` : '']
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
          children: "Optional. For an image already hosted, or a bundled /img/\u2026 path. It is added as it is \u2014 not converted. Uploads, order and primary above save as you make them."
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "img",
            errors: errors,
            label: "Image URL",
            field: "public_url",
            value: urlForm,
            set: setUrlForm
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
            disabled: !urlForm.public_url.trim(),
            children: "Add image from URL"
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
    [product, setProduct] = reactExports.useState(null),
    [parties, setParties] = reactExports.useState([]);
  const [form, setForm] = reactExports.useState({
    ...EMPTY_PRODUCT,
    category_id: params.get('category') || ''
  });
  const [loading, setLoading] = reactExports.useState(true),
    [busy, setBusy] = reactExports.useState(false),
    [message, setMessage] = reactExports.useState(''),
    [loadError, setLoadError] = reactExports.useState(''),
    [refreshError, setRefreshError] = reactExports.useState('');
  // Jewellery (a fashion product under the Jewellery category) carries metal,
  // purity, weights and stones instead of fabric and fit. The form follows the
  // category chosen; the variant and stone panels follow the category saved.
  const jewellery = store === 'fashion' && isJewelleryCategory(categories, form.category_id);
  const savedJewellery = store === 'fashion' && !!product && isJewelleryCategory(categories, product.category_id);
  const errors = useFormErrors(PRODUCT_FIELDS(store, jewellery));
  // The version of the row this form is editing, and that row's editable
  // values. Refs, not state: neither is rendered, and the token must be
  // current inside an in-flight save.
  const base = reactExports.useRef(null);
  reactExports.useEffect(() => {
    let current = true;
    Promise.all([listStoreCategories(store), listStoreParties(), isNew ? Promise.resolve(null) : getStoreProduct(store, productId)]).then(([cats, companies, row]) => {
      if (!current) return;
      setCategories(cats);
      setParties(companies);
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
  const [partiesBusy, setPartiesBusy] = reactExports.useState(false);
  async function reloadParties() {
    setPartiesBusy(true);
    try {
      setParties(await listStoreParties());
    } catch (err) {
      setRefreshError(`The Companies list could not be reloaded: ${err.message}`);
    } finally {
      setPartiesBusy(false);
    }
  }
  const partyOptions = parties.map(p => [p.id, `${p.name}${p.country && p.country !== 'IN' ? ` (${p.country})` : ''}`]);
  // A purity belongs to its metal: changing the metal drops a grade the new metal does not have.
  const setJewellery = next => setForm(next.metal !== form.metal && !PURITY[next.metal]?.[next.purity] ? {
    ...next,
    purity: ''
  } : next);
  const warnings = product ? declarationWarnings(product, {
    store,
    jewellery: savedJewellery
  }) : [];
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
            label: "Net quantity / pack (optional)",
            field: "net_content",
            value: form,
            set: setForm,
            hint: "Example: 1 piece \xB7 Set of 2 \xB7 40 \xD7 40 cm"
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
        }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: "Label declarations"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          children: "What the product\u2019s label carries. Customers see these under Product information on the product page."
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Country of origin",
            field: "country_of_origin",
            value: form,
            set: setForm,
            hint: "2-letter code: IN for India, CN for China, BD for Bangladesh."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Generic name",
            field: "generic_name",
            value: form,
            set: setForm,
            hint: "What it is, in plain words: Kurta, Necklace, Bedsheet."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
            form: "prod",
            errors: errors,
            label: "Manufacturer",
            field: "manufacturer_id",
            value: form,
            set: setForm,
            options: partyOptions,
            empty: "Not set"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
            form: "prod",
            errors: errors,
            label: "Packer (if not the manufacturer)",
            field: "packer_id",
            value: form,
            set: setForm,
            options: partyOptions,
            empty: "Not set"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
            form: "prod",
            errors: errors,
            label: "Importer (made outside India)",
            field: "importer_id",
            value: form,
            set: setForm,
            options: partyOptions,
            empty: "Not set"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: ["Company not in the list? ", /*#__PURE__*/jsxRuntimeExports.jsx("a", {
            className: "inline-link",
            href: `/admin/store-catalogue/${store}?tab=companies`,
            target: "_blank",
            rel: "noreferrer",
            children: "Add it on the Companies tab \u2197"
          }), ", then ", /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-light btn-sm",
            disabled: partiesBusy,
            onClick: reloadParties,
            children: partiesBusy ? 'Reloading…' : 'reload the list'
          })]
        }), store === 'fashion' && !jewellery && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
            children: "Fabric & fit"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
              form: "prod",
              errors: errors,
              label: "Material",
              field: "material",
              value: form,
              set: setForm,
              hint: "With percentages that add up to 100: 60% cotton, 40% polyester."
            }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
              form: "prod",
              errors: errors,
              label: "Fit (optional)",
              field: "fit",
              value: form,
              set: setForm,
              options: FITS.map(f => [f, f])
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            form: "prod",
            errors: errors,
            label: "Care instructions",
            field: "care",
            value: form,
            set: setForm,
            multiline: true
          })]
        }), jewellery && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
            children: "Jewellery"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
              form: "prod",
              errors: errors,
              label: "Metal",
              field: "metal",
              value: form,
              set: setJewellery,
              options: METALS.map(m => [m, METAL_LABELS[m]])
            }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
              form: "prod",
              errors: errors,
              label: "Purity",
              field: "purity",
              value: form,
              set: setForm,
              disabled: !PURITY[form.metal],
              options: Object.entries(PURITY[form.metal] || {}).map(([k, v]) => [k, `${k} — ${v}`]),
              empty: PURITY[form.metal] ? 'Not set' : 'Only gold, silver and platinum',
              hint: "One purity per listing: 18K and 22K are separate listings."
            }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
              form: "prod",
              errors: errors,
              label: "Making charges (optional)",
              field: "making_charge_type",
              value: form,
              set: setForm,
              options: MAKING_TYPES.map(t => [t, MAKING_LABELS[t]]),
              empty: "None stated"
            }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
              form: "prod",
              errors: errors,
              label: form.making_charge_type === 'percent' ? 'Making charges %' : 'Making charges ₹',
              field: "making_charge_value",
              type: "number",
              min: "0",
              max: form.making_charge_type === 'percent' ? 100 : undefined,
              step: "0.01",
              value: form,
              set: setForm,
              hint: "Recorded with the listing; the price above is still what customers pay."
            }), /*#__PURE__*/jsxRuntimeExports.jsx(Choice, {
              form: "prod",
              errors: errors,
              label: "Pricing",
              field: "pricing_mode",
              value: form,
              set: setForm,
              empty: null,
              options: [['fixed', 'Fixed — the price above'], ['rate_linked', 'Linked to the metal rate (draft only)']],
              hint: form.pricing_mode === 'rate_linked' ? RATE_LINKED_NOT_LIVE : 'Customers pay the selling price above.'
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "Gross and net metal weights go on each size, below; stones have their own panel."
          })]
        }), !!warnings.length && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-banner sc-info",
          role: "note",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
            children: [product?.is_active ? 'Live without' : 'Before this goes live, add', ":"]
          }), " ", warnings.map(w => w.label).join(', '), ". A reminder, not a block: saving and publishing still work."]
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
        onChanged: refresh,
        jewellery: savedJewellery
      }), savedJewellery && /*#__PURE__*/jsxRuntimeExports.jsx(StonesEditor, {
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
