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
import {
  catalogueProductPayload, catalogueVariantPayload, categoryOptions, CATALOGUE_STORES,
  PRODUCT_FIELD_RULES, VARIANT_FIELD_RULES,
} from './storeCatalogueAdmin.js';

export const PRODUCT_CSV_COLUMNS = ['id', 'slug', 'name', 'brand', 'category', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'is_new', 'is_bestseller', 'sort_order'];
export const VARIANT_CSV_COLUMNS = ['product_slug', 'size', 'colour', 'colour_hex', 'sku', 'stock', 'price_override', 'is_active', 'sort_order'];
const PRODUCT_FIELDS = ['slug', 'name', 'brand', 'category_id', 'description', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', 'stock', 'is_new', 'is_bestseller', 'sort_order'];
const VARIANT_FIELDS = ['colour_hex', 'sku', 'stock', 'price_override', 'is_active', 'sort_order'];
const MONEY = new Set(['mrp', 'sale_price', 'price_override']);
const NUMBER = new Set(['mrp', 'sale_price', 'price_override', 'gst_rate', 'stock', 'sort_order']);
const BOOLEAN = new Set(['is_new', 'is_bestseller', 'is_active']);
export const FIELD_LABELS = {
  slug: 'Slug', name: 'Name', brand: 'Brand', category_id: 'Category', description: 'Description', mrp: 'MRP', sale_price: 'Selling price',
  sku: 'SKU', net_content: 'Pack / dimensions', hsn_code: 'HSN code', gst_rate: 'GST rate', stock: 'Stock', is_new: 'New arrival',
  is_bestseller: 'Bestseller', sort_order: 'Display order', colour_hex: 'Colour hex', price_override: 'Price override', is_active: 'Active',
};

// ---------- parse ----------
/**
 * RFC 4180-ish: quoted fields, doubled quotes, newlines inside quotes, a
 * spreadsheet's byte-order mark. The same parser as productContentCsv.js —
 * copied, not imported, so this admin chunk does not pull the wellness
 * importer into a shared chunk and reshuffle the storefront bundle's exports.
 * test-store-catalogue-csv.mjs pins that the two agree.
 */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [], cur = '', quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i += 1; } else quoted = false;
      } else cur += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cur); cur = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

// ---------- export ----------
const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// A byte-order mark, so a spreadsheet opens "40 × 40 cm" and "₹" as written; parseCsv strips it.
const csv = (columns, rows) => `﻿${[columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')}\n`;
/** Each category's path by slug ("clothing/shirts") — the form the export writes and the import reads. */
export function categoryPaths(categories) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path = (c, depth = 0) => (c.parent_id && byId.has(c.parent_id) && depth < 3 ? `${path(byId.get(c.parent_id), depth + 1)}/${c.slug}` : c.slug);
  return new Map(categories.map((c) => [c.id, path(c)]));
}
export function productsToCsv(products, categories) {
  const paths = categoryPaths(categories);
  return csv(PRODUCT_CSV_COLUMNS, products.map((p) => ({ ...p, category: paths.get(p.category_id) || '' })));
}
export function variantsToCsv(products) {
  const rows = [];
  for (const p of products) for (const v of p.variants || []) rows.push({ ...v, product_slug: p.slug });
  return csv(VARIANT_CSV_COLUMNS, rows);
}

// ---------- reading ----------
const blank = (v) => String(v ?? '').trim() === '';
const present = (v) => v !== null && v !== undefined && v !== '';
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
function diffRow(current, values, fields, { overwrite, creating }) {
  const diffs = [], applied = {};
  for (const field of fields) {
    if (!(field in values)) continue;
    const before = current ? current[field] : null;
    if (sameValue(field, before, values[field])) continue;
    if (!creating && present(before) && !overwrite) { diffs.push({ field, before, after: values[field], skipped: true, reason: 'already has a value (fill-only)' }); continue; }
    diffs.push({ field, before, after: values[field] });
    applied[field] = values[field];
  }
  return { diffs, applied };
}
const reasons = (error) => (error?.fieldErrors ? Object.values(error.fieldErrors) : [error?.message || String(error)]).join(' ');
const linesOf = (map, line) => [...map.values()].find((lines) => lines.includes(line)) || [line];

// ---------- plan: products ----------
export function planProductImport(text, { store, products, categories, overwrite = false, create = false }) {
  const rows = parseCsv(text);
  if (!rows.length) return { ok: false, reason: 'The file is empty.', changes: [], kept: [], skipped: [] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  if (!head.includes('slug') && !head.includes('id')) return { ok: false, reason: 'The file needs a "slug" or "id" column to match products on.', changes: [], kept: [], skipped: [] };
  const ignored = head.filter((h) => h && !PRODUCT_CSV_COLUMNS.includes(h));
  const col = (name) => head.indexOf(name);
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const planned = [], skipped = [], keyLines = new Map();
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r], line = r + 1;
    const id = col('id') >= 0 ? String(cells[col('id')] ?? '').trim() : '';
    const slugCell = col('slug') >= 0 ? String(cells[col('slug')] ?? '').trim() : '';
    const current = id ? byId.get(id) : bySlug.get(slugCell);
    if (id && !current) { skipped.push({ line, key: id, reason: 'No product in this store has this id.' }); continue; }
    if (!current && !slugCell) { skipped.push({ line, key: '', reason: 'A row needs a slug (or the id of an existing product).' }); continue; }
    const creating = !current;
    const key = creating ? `slug:${slugCell}` : `id:${current.id}`;
    keyLines.set(key, [...(keyLines.get(key) || []), line]);
    if (creating && !create) { skipped.push({ line, key: slugCell, reason: 'No product in this store has this slug. Tick "Create new products" to add it as a draft.' }); continue; }
    const values = {}, problems = [];
    for (const column of PRODUCT_CSV_COLUMNS) {
      if (column === 'id' || col(column) < 0 || blank(cells[col(column)])) continue;   // blank: no opinion
      const raw = cells[col(column)];
      try {
        if (column === 'category') {
          const categoryId = resolveCategory(raw, categories);
          if (!categoryId) throw new Error(`Category "${String(raw).trim()}" is not a ${CATALOGUE_STORES[store]} category — use the path from the export, e.g. "${[...categoryPaths(categories).values()].find((p) => p.includes('/')) || [...categoryPaths(categories).values()][0] || 'parent/child'}".`);
          values.category_id = categoryId;
        } else values[column] = readCell(column, raw, PRODUCT_FIELD_RULES);
      } catch (error) { problems.push(error.message); }
    }
    if (problems.length) { skipped.push({ line, key: slugCell || current?.slug, reason: problems.join(' ') }); continue; }
    const { diffs, applied } = diffRow(current, values, PRODUCT_FIELDS, { overwrite, creating });
    const label = { line, id: current?.id ?? null, slug: (creating ? slugCell : current.slug), name: applied.name ?? current?.name ?? values.name ?? '' };
    if (!creating && !diffs.some((d) => !d.skipped)) { if (diffs.length) planned.push({ ...label, kind: 'kept', diffs, input: null }); continue; }
    // The row as it would be written: current values plus only what applies.
    const input = creating ? { slug: slugCell, stock: 0, sort_order: 0, ...applied, is_active: false } : { ...current, ...applied };
    try { catalogueProductPayload(input, categories); }
    catch (error) { skipped.push({ line, key: label.slug, reason: reasons(error) }); continue; }
    planned.push({ ...label, kind: creating ? 'create' : 'update', diffs, input, expectedUpdatedAt: current?.updated_at ?? null });
  }
  // One product twice in a file: neither row is guessed between.
  const twice = new Set([...keyLines.values()].filter((l) => l.length > 1).flat());
  // Slugs and SKUs must still be unique in the store once the whole file applies.
  const after = new Map(products.map((p) => [String(p.id), { slug: p.slug, sku: p.sku || null }]));
  for (const c of planned) if (c.input && !twice.has(c.line)) after.set(c.id ? String(c.id) : `new:${c.line}`, { slug: c.input.slug, sku: c.input.sku || null });
  const taken = (field, value, self) => value && [...after.entries()].some(([k, v]) => k !== self && v[field] === value);
  const changes = [], kept = [];
  for (const c of planned) {
    if (twice.has(c.line)) { skipped.push({ line: c.line, key: c.slug, reason: `This product appears more than once in the file (lines ${linesOf(keyLines, c.line).join(', ')}).` }); continue; }
    const self = c.id ? String(c.id) : `new:${c.line}`;
    const clash = c.input && (taken('slug', c.input.slug, self) ? `Another product would have the slug "${c.input.slug}".` : taken('sku', c.input.sku, self) ? `Another product would have the SKU "${c.input.sku}".` : null);
    if (clash) { skipped.push({ line: c.line, key: c.slug, reason: clash }); continue; }
    (c.kind === 'kept' ? kept : changes).push(c);
  }
  for (const line of twice) if (!planned.some((c) => c.line === line) && !skipped.some((s) => s.line === line)) skipped.push({ line, key: '', reason: 'This product appears more than once in the file.' });
  skipped.sort((a, b) => a.line - b.line);
  return { ok: true, kind: 'products', ignored, changes, kept, skipped };
}

// ---------- plan: variants ----------
export function planVariantImport(text, { store, products, overwrite = false, create = false }) {
  const rows = parseCsv(text);
  if (!rows.length) return { ok: false, reason: 'The file is empty.', changes: [], kept: [], skipped: [] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  if (!head.includes('product_slug') || !head.includes('size')) return { ok: false, reason: 'The file needs "product_slug" and "size" columns to match variants on.', changes: [], kept: [], skipped: [] };
  const ignored = head.filter((h) => h && !VARIANT_CSV_COLUMNS.includes(h));
  const col = (name) => head.indexOf(name);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const planned = [], skipped = [], keyLines = new Map();
  const siblingsOf = new Map();                       // product id → its variants as they will be after earlier rows
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r], line = r + 1;
    const productSlug = String(cells[col('product_slug')] ?? '').trim();
    const size = String(cells[col('size')] ?? '').trim();
    const colour = col('colour') >= 0 ? String(cells[col('colour')] ?? '').trim() : '';
    const key = `${productSlug} · ${colour ? `${size} / ${colour}` : size}`;
    const product = bySlug.get(productSlug);
    if (!product) { skipped.push({ line, key, reason: `No ${CATALOGUE_STORES[store]} product has the slug "${productSlug}".` }); continue; }
    if (!size) { skipped.push({ line, key, reason: 'A row needs a size.' }); continue; }
    keyLines.set(`${product.id}|${size}|${colour}`, [...(keyLines.get(`${product.id}|${size}|${colour}`) || []), line]);
    const siblings = siblingsOf.get(product.id) || [...(product.variants || [])];
    const current = siblings.find((v) => !String(v.id).startsWith('planned-') && String(v.size).trim() === size && String(v.colour || '').trim() === colour) || null;
    const creating = !current;
    if (creating && !create) { skipped.push({ line, key, reason: 'This product has no variant with this size and colour. Tick "Create new variants" to add it.' }); continue; }
    const values = {}, problems = [];
    for (const field of VARIANT_FIELDS) {
      if (col(field) < 0 || blank(cells[col(field)])) continue;
      try { values[field] = readCell(field, cells[col(field)], VARIANT_FIELD_RULES); } catch (error) { problems.push(error.message); }
    }
    if (problems.length) { skipped.push({ line, key, reason: problems.join(' ') }); continue; }
    const { diffs, applied } = diffRow(current, values, VARIANT_FIELDS, { overwrite, creating });
    const label = { line, productId: product.id, product: product.name, variantId: current?.id ?? null, label: key };
    if (!creating && !diffs.some((d) => !d.skipped)) { if (diffs.length) planned.push({ ...label, kind: 'kept', diffs, input: null }); continue; }
    const input = creating ? { size, colour, is_active: true, sort_order: siblings.length, ...applied } : { ...current, ...applied };
    try { catalogueVariantPayload({ ...input, id: current?.id }, store, siblings); }
    catch (error) { skipped.push({ line, key, reason: reasons(error) }); continue; }
    if (creating) siblingsOf.set(product.id, [...siblings, { ...input, id: `planned-${line}` }]);
    planned.push({ ...label, kind: creating ? 'create' : 'update', diffs, input, expectedUpdatedAt: current?.updated_at ?? null });
  }
  const twice = new Set([...keyLines.values()].filter((l) => l.length > 1).flat());
  // Variant SKUs are unique across every store; this file and this store are checked here, the rest on save.
  const skus = new Map();
  for (const p of products) for (const v of p.variants || []) if (v.sku) skus.set(v.sku, String(v.id));
  const changes = [], kept = [];
  for (const c of planned) {
    if (twice.has(c.line)) { skipped.push({ line: c.line, key: c.label, reason: `This variant appears more than once in the file (lines ${linesOf(keyLines, c.line).join(', ')}).` }); continue; }
    const sku = c.input?.sku, self = c.variantId ? String(c.variantId) : `new:${c.line}`;
    if (sku && skus.has(sku) && skus.get(sku) !== self) { skipped.push({ line: c.line, key: c.label, reason: `Another variant already has the SKU "${sku}". Variant SKUs are unique across every store.` }); continue; }
    if (sku) skus.set(sku, self);
    (c.kind === 'kept' ? kept : changes).push(c);
  }
  skipped.sort((a, b) => a.line - b.line);
  return { ok: true, kind: 'variants', ignored, changes, kept, skipped };
}

/** "MRP: 1299 → 1199" — how a diff reads in the plan. */
export function describeDiff(diff, categories = []) {
  const show = (field, v) => {
    if (!present(v)) return '(empty)';
    if (field === 'category_id') return categoryPaths(categories).get(v) || v;
    if (BOOLEAN.has(field)) return v ? 'yes' : 'no';
    const s = String(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  };
  return `${FIELD_LABELS[diff.field] || diff.field}: ${show(diff.field, diff.before)} → ${show(diff.field, diff.after)}`;
}
