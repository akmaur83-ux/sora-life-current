// ============================================================
// The pre-import validator: every problem in a filled kit, at once.
//
// 1. The import's own rules — not a copy of them. The products and variants
//    files are run through the admin importer's planner (planProductImport /
//    planVariantImport, the code the Import tab runs), with "Create new" on,
//    against the store's categories and, when given, the current catalogue
//    export. Every row the import would skip is reported with the import's
//    own reason.
// 2. The rules the import does not enforce but that bite later: a product no
//    one can buy (no active size/colour), a size priced above its MRP, a
//    jewellery category on a fashion row, missing images, an HSN that lost its
//    leading 0, a number Excel turned into 1.23E+11, the declarations a live
//    listing should carry (warned, never enforced — the owner's decision), and
//    the 0036 columns' own rules (metal, purity, weights, stones, companies).
// 3. The claim scan: the admin's claim list (claimWarnings.js) over every piece
//    of customer-facing copy — no speed, sustainability or medical claims.
//
// Severities:
//   error  — the import would skip the row, or the database would refuse it once 0036 is applied, or it breaks a rule (selling above MRP)
//   claim  — copy that must change (speed, sustainability or medical)
//   later  — imports, but causes trouble later (cannot be published, sold out everywhere, a declaration missing)
//   info   — worth knowing (what is not imported yet, what was not checked)
// ============================================================
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { planProductImport, planVariantImport, PRODUCT_CSV_COLUMNS, VARIANT_CSV_COLUMNS, categoryPaths } from '../../src/lib/storeCatalogueCsv.js';
import { planBulkImages } from '../../src/lib/storeCatalogueAdmin.js';
import { claimWarnings, CLAIM_KINDS } from '../../src/lib/claimWarnings.js';
import { COLUMNS, KITS, PURITY, METALS, FITS, STONE_ORIGINS, columnsFor } from './spec.mjs';
import { readCsvBuffer, objects } from './sheets.mjs';
import { materialTotal } from './values.mjs';

const t = (v) => String(v ?? '').trim();
const num = (v) => (t(v) === '' ? null : Number(t(v).replace(/[₹,\s]/g, '')));

// ---------- categories ----------
/** Category rows from a list of paths ("clothing/men/mens-shirts"), each ancestor included. */
export function categoriesFromPaths(paths) {
  const rows = new Map();
  for (const raw of paths) {
    const [pathPart, name] = String(raw).split(/\s*,\s*/);
    const parts = t(pathPart).toLowerCase().split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i += 1) {
      const id = parts.slice(0, i + 1).join('/');
      if (!rows.has(id)) rows.set(id, { id, parent_id: i ? parts.slice(0, i).join('/') : null, slug: parts[i], name: parts[i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), is_active: true, sort_order: 0 });
      if (i === parts.length - 1 && name) rows.get(id).name = t(name);
    }
  }
  return [...rows.values()];
}
export function readCategoriesFile(path) {
  const lines = readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/).map(t).filter(Boolean);
  const body = /^path\b/i.test(lines[0] || '') ? lines.slice(1) : lines;
  return categoriesFromPaths(body);
}
/** The fashion store's ACTIVE categories, read the way the storefront reads them (public, read-only). */
export async function fetchLiveCategories({ url, key }) {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/catalogue_categories?select=id,parent_id,name,slug,is_active,sort_order&store=eq.fashion`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Reading the categories failed (${res.status}).`);
  return res.json();
}
/** The two PUBLIC values from the environment or .env.local — never any other line of that file. */
export function publicSupabaseConfig(root) {
  const pick = (name) => {
    if (process.env[name]) return process.env[name];
    const file = join(root, '.env.local');
    if (!existsSync(file)) return null;
    const m = readFileSync(file, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
  };
  const url = pick('VITE_SUPABASE_URL'), key = pick('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) throw new Error('No VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in the environment or .env.local.');
  return { url, key };
}

// ---------- the current catalogue, from the admin's own exports ----------
export function existingFromExports(productsText, variantsText, categories) {
  const products = [];
  if (productsText) {
    const { rows } = objects(readCsvBuffer(Buffer.from(productsText, 'utf8'), 'existing products'));
    const byPath = new Map([...categoryPaths(categories).entries()].map(([id, path]) => [path, id]));
    for (const r of rows) products.push({ ...r, id: t(r.id), category_id: byPath.get(t(r.category).toLowerCase()) || null, updated_at: null, variants: [] });
  }
  if (variantsText) {
    const { rows } = objects(readCsvBuffer(Buffer.from(variantsText, 'utf8'), 'existing variants'));
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    rows.forEach((r, i) => { const p = bySlug.get(t(r.product_slug)); if (p) p.variants.push({ ...r, id: `existing-${i}`, updated_at: null }); });
  }
  return products;
}

// ---------- helpers ----------
const KNOWN = (sheet, kit) => new Set(columnsFor(sheet, kit).map((c) => c.key));
const ANY_KIT = (sheet) => new Set(COLUMNS.filter((c) => c.sheet === sheet).map((c) => c.key));
function closest(word, options) {
  const d = (a, b) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j += 1) m[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  const norm = word.replace(/[\s-]+/g, '_');
  const best = [...options].map((o) => [o, d(norm, o)]).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] <= Math.max(2, Math.floor(best[0].length / 3)) ? best[0] : null;
}
const IMAGE_EXT = /\.(webp|jpe?g|png)$/i;
function imageSize(buf) {
  try {
    if (buf.toString('ascii', 1, 4) === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
      if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
      if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      for (let i = 2; i < buf.length - 9;) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
        i += 2 + len;
      }
    }
  } catch { /* fall through */ }
  return null;
}

/**
 * Validate a filled kit. Files are given as text (CSV) or null; categories as rows.
 * Returns { problems, counts, summary }.
 */
export function validateKit({
  kit, products = null, variants = null, stones = null, companies = null,
  categories = null, existing = [], imagesDir = null,
}) {
  if (!KITS[kit]) throw new Error('Choose the fashion or the jewellery kit.');
  const problems = [];
  const add = (severity, sheet, line, key, message, column = null) => problems.push({ severity, sheet, line, key: key || '', column, message });
  const sheetsSeen = {};

  const read = (sheet, text) => {
    if (text == null) return null;
    let rows;
    try { rows = readCsvBuffer(Buffer.from(text, 'utf8'), `${sheet} file`); } catch (error) { add('error', sheet, 0, '', error.message); return null; }
    const parsed = objects(rows);
    const head = parsed.head.map((h) => h.toLowerCase());
    const known = KNOWN(sheet, kit), anyKit = ANY_KIT(sheet);
    for (const h of head) {
      if (!h || known.has(h)) continue;
      if (anyKit.has(h)) add('later', sheet, 1, '', `Column "${h}" is not used by the ${KITS[kit].label} kit; it will be ignored.`, h);
      else {
        const guess = closest(h, known);
        add('error', sheet, 1, '', `Column "${h}" is not a column the kit or the import reads${guess ? ` — did you mean "${guess}"?` : '.'} Its values would be dropped.`, h);
      }
    }
    sheetsSeen[sheet] = { head, rows: parsed.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k === '__line' ? k : k.toLowerCase(), v]))) };
    return sheetsSeen[sheet];
  };
  const P = read('products', products);
  const V = read('variants', variants);
  const S = kit === 'jewellery' ? read('stones', stones) : null;
  const C = read('companies', companies);

  // ---------- categories ----------
  let cats = categories;
  if (!cats) {
    add('info', 'products', 0, '', 'Categories were not checked against the store: run with --categories <file> or --live-categories.');
    cats = categoriesFromPaths((P?.rows || []).map((r) => t(r.category)).filter(Boolean));
  }

  // ---------- 1. the import's own rules ----------
  const pendingNote = (sheet, ignored, importable) => {
    const pending = ignored.filter((h) => KNOWN(sheet, kit).has(h) && !importable.includes(h));
    if (pending.length) add('info', sheet, 1, '', `Not imported yet (migration 0036 and the importer update): ${pending.join(', ')}. The import lists them as "ignored"; keep them in the file.`);
  };
  const productLines = new Map();      // slug → line
  let plannedProducts = [];
  if (P) {
    for (const r of P.rows) if (t(r.slug)) productLines.set(t(r.slug), r.__line);
    const plan = planProductImport(products, { store: KITS[kit].store, products: existing, categories: cats, overwrite: false, create: true });
    if (!plan.ok) add('error', 'products', 0, '', plan.reason);
    else {
      pendingNote('products', plan.ignored, PRODUCT_CSV_COLUMNS);
      for (const s of plan.skipped) add('error', 'products', s.line, s.key, s.reason);
      for (const c of plan.kept) for (const d of c.diffs.filter((x) => x.skipped)) add('info', 'products', c.line, c.slug, `${d.field}: the product already has a value; the import keeps it unless "Overwrite" is ticked.`, d.field);
      const created = plan.changes.filter((c) => c.kind === 'create');
      if (created.length) add('info', 'products', 0, '', `${created.length} product${created.length === 1 ? '' : 's'} will be created as draft${created.length === 1 ? '' : 's'}. Publish each in the editor once it has an image and an active size/colour.`);
      plannedProducts = plan.changes;
    }
  }
  const skippedProductSlugs = new Set(problems.filter((p) => p.sheet === 'products' && p.severity === 'error' && p.line > 1).map((p) => p.key));
  // Variants are planned against every product the file names — even one with an error — so a
  // variant's own problems are listed now, not after its product is fixed.
  const existingSlugs = new Set(existing.map((p) => p.slug));
  const productsAfter = [
    ...existing.map((p) => ({ ...p, variants: [...(p.variants || [])] })),
    ...[...productLines.keys()].filter((slug) => !existingSlugs.has(slug)).map((slug) => ({ id: `new:${slug}`, slug, name: slug, variants: [], updated_at: null })),
  ];
  if (V) {
    const plan = planVariantImport(variants, { store: KITS[kit].store, products: productsAfter, overwrite: false, create: true });
    if (!plan.ok) add('error', 'variants', 0, '', plan.reason);
    else {
      pendingNote('variants', plan.ignored, VARIANT_CSV_COLUMNS);
      for (const s of plan.skipped) add('error', 'variants', s.line, s.key, s.reason);
      for (const r of objects(readCsvBuffer(Buffer.from(variants, 'utf8'))).rows) {
        const slug = t(r.product_slug);
        if (skippedProductSlugs.has(slug)) add('info', 'variants', r.__line, slug, `Its product (products line ${productLines.get(slug)}) has an error: this row imports once that is fixed.`);
      }
      for (const c of plan.changes) {
        const p = productsAfter.find((x) => x.id === c.productId);
        if (p && c.kind === 'create') p.variants.push({ ...c.input });
      }
    }
  }

  // ---------- 2. what the import does not check ----------
  const productRows = P?.rows || [];
  const companyNames = C ? new Set(C.rows.map((r) => t(r.name))) : null;
  for (const r of productRows) {
    const line = r.__line, slug = t(r.slug), key = slug || t(r.id);
    const where = (column, severity, message) => add(severity, 'products', line, key, message, column);
    if (/^example-/.test(slug)) where('slug', 'error', 'This is an example row from the template. Delete it before importing.');
    // The import checks these only once every cell of the row reads; say them now, so one pass lists everything.
    const reported = (text) => problems.some((p) => p.sheet === 'products' && p.line === line && p.message.includes(text));
    const creating = !t(r.id) && !existingSlugs.has(slug);
    if (creating) {
      if (!t(r.name) && !reported('Enter a product name')) where('name', 'error', 'Enter a product name.');
      if (!t(r.category) && !reported('Choose a category')) where('category', 'error', 'Choose a category in this store.');
      if (!t(r.mrp) && !reported('MRP')) where('mrp', 'error', 'Enter an MRP of at least ₹0.01.');
    }
    const mrpN = num(r.mrp), saleN = num(r.sale_price);
    if (mrpN > 0 && saleN > 0 && saleN > mrpN && !reported('more than the MRP')) where('sale_price', 'error', `Selling price cannot be more than the MRP (₹${mrpN}).`);
    for (const column of ['sku', 'hsn_code', 'mrp', 'sale_price']) if (/^\d(?:\.\d+)?E\+\d+$/i.test(t(r[column]))) where(column, 'error', `"${t(r[column])}" is a number a spreadsheet shortened. Format the column as Text and type it again.`);
    if (/^\d{3}$|^\d{5}$|^\d{7}$/.test(t(r.hsn_code).replace(/[\s.]/g, ''))) where('hsn_code', 'error', `HSN "${t(r.hsn_code)}" has an odd number of digits — a spreadsheet may have dropped a leading 0. Format the column as Text.`);
    if (!t(r.hsn_code) && !r.id) where('hsn_code', 'later', 'No HSN code: needed on GST invoices.');
    if (!t(r.description)) where('description', 'later', 'No description: the product page has no “About this style”.');
    if (/<[a-z/][^>]*>/i.test(r.description || '')) where('description', 'later', 'The description contains HTML tags; they would show as text. Use plain text.');
    if (t(r.name).length > 120) where('name', 'later', `The name is ${t(r.name).length} characters; keep it under 120 so cards show it whole.`);
    const cat = t(r.category).toLowerCase().replace(/\s*\/\s*/g, '/');
    if (cat) {
      const underJewellery = cat === 'jewellery' || cat.startsWith('jewellery/');
      if (kit === 'jewellery' && !underJewellery) where('category', 'error', `"${t(r.category)}" is not a jewellery category. Jewellery sits under jewellery/ (e.g. jewellery/rings).`);
      if (kit === 'fashion' && underJewellery) where('category', 'later', 'This is a jewellery category: use the jewellery kit, which carries metal, purity and weights.');
    }
    // Declarations: warned, never enforced (owner, 2026-10-12).
    const country = t(r.country_of_origin);
    if (!country) where('country_of_origin', 'later', 'No country of origin: expected before this goes live.');
    else if (!/^[A-Z]{2}$/.test(country)) where('country_of_origin', 'error', `"${country}" is not a 2-letter country code such as IN.`);
    if (t(r.generic_name).length > 120) where('generic_name', 'error', 'The generic name is over 120 characters.');
    for (const role of ['manufacturer', 'packer', 'importer']) {
      const name = t(r[role]);
      if (name && companyNames && !companyNames.has(name)) where(role, 'error', `${role[0].toUpperCase()}${role.slice(1)} "${name}" is not in the companies sheet.`);
    }
    if (!t(r.manufacturer)) where('manufacturer', 'later', 'No manufacturer: expected before this goes live.');
    if (/^[A-Z]{2}$/.test(country) && country !== 'IN' && !t(r.importer)) where('importer', 'later', `Made in ${country}: name the importer before this goes live.`);
    if ((t(r.manufacturer) || t(r.packer) || t(r.importer)) && !companyNames) where('manufacturer', 'info', 'Company names were not checked: pass the companies sheet.');
    if (kit === 'fashion') {
      const material = t(r.material);
      if (!material) where('material', 'later', 'No material composition: expected before this goes live.');
      else {
        const m = materialTotal(material);
        if (!m) where('material', 'later', `"${material}" gives no percentages. Write it as "100% linen" or "60% cotton, 40% polyester".`);
        else if (m.total !== 100) where('material', 'error', `Material percentages add up to ${m.total}%, not 100%.`);
      }
      if (material.length > 300) where('material', 'error', 'Material is over 300 characters.');
      if (!t(r.care)) where('care', 'later', 'No care instructions: expected before this goes live.');
      if (t(r.care).length > 1000) where('care', 'error', 'Care is over 1000 characters.');
      if (t(r.fit) && !FITS.includes(t(r.fit))) where('fit', 'error', `Fit "${t(r.fit)}" must be one of ${FITS.join(', ')}.`);
    }
    if (kit === 'jewellery') {
      const metal = t(r.metal), purity = t(r.purity);
      if (!metal) where('metal', 'later', 'No metal: expected before this goes live.');
      else if (!METALS.includes(metal)) where('metal', 'error', `Metal "${metal}" must be one of ${METALS.join(', ')}.`);
      if (metal && PURITY[metal]) {
        if (!purity) where('purity', 'later', `No purity for ${metal}: expected before this goes live (e.g. ${Object.keys(PURITY[metal])[0]}).`);
        else if (!PURITY[metal][Number(purity)]) where('purity', 'error', `Purity ${purity} is not a ${metal} grade. Use ${Object.entries(PURITY[metal]).map(([k, v]) => `${k} (${v})`).join(', ')}.`);
      } else if (purity && METALS.includes(metal)) where('purity', 'error', `Purity is only for gold, silver and platinum, not ${metal}.`);
      const mt = t(r.making_charge_type), mv = t(r.making_charge_value);
      if (!!mt !== !!mv) where('making_charge_type', 'error', 'Making charges need both a type and a value.');
      if (mt && !['per_gram', 'percent', 'flat'].includes(mt)) where('making_charge_type', 'error', `Making charge type "${mt}" must be per_gram, percent or flat.`);
      if (mv && !(num(mv) >= 0)) where('making_charge_value', 'error', `Making charge "${mv}" is not a number, 0 or more.`);
      if (mt === 'percent' && num(mv) > 100) where('making_charge_value', 'error', 'A making charge percentage cannot be over 100.');
      const mode = t(r.pricing_mode) || 'fixed';
      if (!['fixed', 'rate_linked'].includes(mode)) where('pricing_mode', 'error', `Pricing mode "${mode}" must be fixed or rate_linked.`);
      if (mode === 'rate_linked') where('pricing_mode', 'later', 'Rate-linked: it can be saved as a draft but cannot go live until the metal-rate engine exists.');
    }
    // 3. claims, over every piece of customer-facing copy on the row.
    for (const column of ['name', 'description', 'generic_name', 'material', 'care']) {
      for (const w of claimWarnings(r[column])) where(column, 'claim', `${CLAIM_KINDS[w.kind]} (“${w.term}”): ${w.excerpt}`);
    }
  }

  // Variants: what the import does not check.
  const mrpOf = new Map();
  for (const p of [...existing, ...productRows]) if (t(p.slug)) mrpOf.set(t(p.slug), num(p.mrp));
  for (const r of V?.rows || []) {
    const line = r.__line, key = `${t(r.product_slug)} · ${t(r.size)}${t(r.colour) ? ` / ${t(r.colour)}` : ''}`;
    const where = (column, severity, message) => add(severity, 'variants', line, key, message, column);
    const reported = (text) => problems.some((p) => p.sheet === 'variants' && p.line === line && p.message.includes(text));
    if (t(r.size) && !t(r.colour) && !reported('Enter a colour')) where('colour', 'error', 'Enter a colour. Use “Default” for a single option.');
    if (!t(r.stock) && !reported('Stock') && !existing.some((p) => p.slug === t(r.product_slug) && (p.variants || []).some((v) => t(v.size) === t(r.size) && t(v.colour) === t(r.colour)))) where('stock', 'error', 'Stock must be a whole number, 0 or more.');
    const override = num(r.price_override), mrp = mrpOf.get(t(r.product_slug));
    if (override != null && mrp != null && override > mrp) where('price_override', 'error', `Price override ₹${override} is above the MRP ₹${mrp}: nothing may sell above its MRP.`);
    if (/^\d(?:\.\d+)?E\+\d+$/i.test(t(r.sku))) where('sku', 'error', `"${t(r.sku)}" is a number a spreadsheet shortened. Format the column as Text and type it again.`);
    if (!t(r.colour_hex)) where('colour_hex', 'later', 'No colour hex: the swatch shows a neutral beige.');
    if (kit === 'jewellery') {
      const gross = num(r.gross_weight_g), net = num(r.net_metal_weight_g);
      if (t(r.gross_weight_g) && !(gross > 0)) where('gross_weight_g', 'error', `Gross weight "${t(r.gross_weight_g)}" must be a number of grams above 0.`);
      if (t(r.net_metal_weight_g) && !(net > 0)) where('net_metal_weight_g', 'error', `Net metal weight "${t(r.net_metal_weight_g)}" must be a number of grams above 0.`);
      if (gross > 0 && net > 0 && net > gross) where('net_metal_weight_g', 'error', `Net metal weight ${net} g cannot exceed the gross weight ${gross} g.`);
      if (!t(r.gross_weight_g) || !t(r.net_metal_weight_g)) where('gross_weight_g', 'later', 'Gross and net metal weight are expected before this goes live.');
    }
  }
  // A product nobody can buy.
  const variantRowsBySlug = new Map();
  for (const r of V?.rows || []) variantRowsBySlug.set(t(r.product_slug), [...(variantRowsBySlug.get(t(r.product_slug)) || []), r]);
  for (const r of productRows) {
    const slug = t(r.slug);
    if (!slug || skippedProductSlugs.has(slug)) continue;
    const existingVariants = existing.find((p) => p.slug === slug)?.variants || [];
    const rows = [...existingVariants, ...(variantRowsBySlug.get(slug) || [])];
    const active = rows.filter((v) => !/^(no|false|n|0)$/i.test(t(v.is_active)));
    if (!rows.length) add('later', 'products', r.__line, slug, 'No size/colour rows: a fashion or jewellery product without one cannot be published or bought. Add a variant (“One size” if there is only one).');
    else if (!active.length) add('later', 'products', r.__line, slug, 'Every size/colour is inactive: the product cannot be published.');
    else if (active.every((v) => Number(t(v.stock) || 0) === 0)) add('info', 'products', r.__line, slug, 'Every size is at stock 0: it will show as sold out.');
  }

  // Stones.
  if (S) {
    const slugs = new Set([...productRows.map((r) => t(r.slug)), ...existing.map((p) => p.slug)]);
    for (const r of S.rows) {
      const line = r.__line, key = `${t(r.product_slug)} · ${t(r.stone)}`;
      const where = (column, severity, message) => add(severity, 'stones', line, key, message, column);
      if (!slugs.has(t(r.product_slug))) where('product_slug', 'error', `No product in the sheet has the slug "${t(r.product_slug)}".`);
      if (!t(r.stone)) where('stone', 'error', 'Name the stone.');
      if (!STONE_ORIGINS.includes(t(r.origin))) where('origin', 'error', `Origin "${t(r.origin)}" must be ${STONE_ORIGINS.join(', ')}: say whether the stone is natural, lab-grown or a simulant.`);
      if (!/^\d+$/.test(t(r.stone_count)) || Number(t(r.stone_count)) < 1) where('stone_count', 'error', 'Stone count must be a whole number, 1 or more.');
      for (const [column, label] of [['total_carat', 'Total carat'], ['total_weight_g', 'Total weight']]) if (t(r[column]) && !(num(r[column]) > 0)) where(column, 'error', `${label} "${t(r[column])}" must be a number above 0.`);
      if (!!t(r.certificate_lab) !== !!t(r.certificate_no)) where('certificate_lab', 'error', 'A certificate needs both its lab and its number.');
    }
  }

  // Companies.
  if (C) {
    const seen = new Map();
    for (const r of C.rows) {
      const line = r.__line, name = t(r.name);
      const where = (column, severity, message) => add(severity, 'companies', line, name, message, column);
      if (!name) where('name', 'error', 'A company needs a name.');
      else if (seen.has(name)) where('name', 'error', `"${name}" is also on line ${seen.get(name)}: each company once.`);
      else seen.set(name, line);
      if (!t(r.address)) where('address', 'error', 'A company needs its address as printed on the label.');
      if (t(r.address).length > 400) where('address', 'error', 'The address is over 400 characters.');
      if (t(r.country) && !/^[A-Z]{2}$/.test(t(r.country))) where('country', 'error', `"${t(r.country)}" is not a 2-letter country code.`);
      if (t(r.email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t(r.email))) where('email', 'error', `"${t(r.email)}" is not an email address.`);
      if (t(r.gstin) && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(t(r.gstin))) where('gstin', 'error', `"${t(r.gstin)}" is not a GSTIN (15 characters like 27ABCDE1234F1Z5).`);
    }
  }

  // ---------- images ----------
  if (imagesDir) {
    const files = readdirSync(imagesDir).filter((f) => statSync(join(imagesDir, f)).isFile()).map((name) => ({ name }));
    const slugsToCheck = productRows.map((r) => t(r.slug)).filter(Boolean);
    const productsForImages = slugsToCheck.map((slug) => ({ id: slug, slug, name: slug, media: [] }));
    const plan = planBulkImages(files, productsForImages);
    const withImages = new Set([...plan.uploads, ...plan.held].map((u) => u.product.slug));
    for (const slug of slugsToCheck) if (!withImages.has(slug)) add('later', 'images', productLines.get(slug) || 0, slug, `No image named ${slug}-1.webp (or .jpg/.png): the product cannot be published without one.`);
    for (const h of plan.held) add('error', 'images', 0, h.product.slug, h.reason);
    for (const u of plan.unmatched) if (IMAGE_EXT.test(u.name) || !/^\./.test(u.name)) add(IMAGE_EXT.test(u.name) ? 'later' : 'info', 'images', 0, u.name, u.reason);
    for (const f of files.filter((x) => IMAGE_EXT.test(x.name))) {
      const path = join(imagesDir, f.name), bytes = statSync(path).size;
      if (bytes > 25 * 1024 * 1024) { add('error', 'images', 0, f.name, `${Math.round(bytes / 1024 / 1024)} MB: the uploader takes images under 25 MB.`); continue; }
      const dims = imageSize(readFileSync(path).subarray(0, 65536));
      if (dims && Math.max(...dims) < 800) add('later', 'images', 0, f.name, `${dims[0]} × ${dims[1]} px: under 800 px on its longest side, it will look soft on the product page.`);
      if (dims && extname(f.name).toLowerCase() === '.webp' && bytes <= 150000 && Math.max(...dims) <= 1600) add('info', 'images', 0, f.name, 'Already a WebP under 150 KB and 1600 px: uploaded exactly as it is.');
    }
  }

  const order = { error: 0, claim: 1, later: 2, info: 3 };
  const sheetOrder = { products: 0, variants: 1, stones: 2, companies: 3, images: 4 };
  problems.sort((a, b) => order[a.severity] - order[b.severity] || (sheetOrder[a.sheet] ?? 9) - (sheetOrder[b.sheet] ?? 9) || a.line - b.line);
  const counts = Object.fromEntries(Object.keys(order).map((k) => [k, problems.filter((p) => p.severity === k).length]));
  return { problems, counts, ok: counts.error === 0 && counts.claim === 0 };
}

const TITLES = { error: 'Fix before importing', claim: 'Claims to remove from the copy', later: 'Imports, but will bite later', info: 'Worth knowing' };
export function formatReport({ problems, counts }, { kit, markdown = false } = {}) {
  const out = [];
  const h = (s) => (markdown ? `## ${s}` : `\n${s.toUpperCase()}`);
  out.push(markdown ? `# ${KITS[kit].label} kit — validation` : `${KITS[kit].label} kit — validation`);
  out.push(`${counts.error} to fix · ${counts.claim} claim${counts.claim === 1 ? '' : 's'} · ${counts.later} for later · ${counts.info} notes`);
  for (const severity of ['error', 'claim', 'later', 'info']) {
    const list = problems.filter((p) => p.severity === severity);
    if (!list.length) continue;
    out.push(h(TITLES[severity]));
    for (const p of list) {
      const where = [p.sheet, p.line > 0 ? `line ${p.line}` : null, p.key ? `“${p.key}”` : null, p.column ? `[${p.column}]` : null].filter(Boolean).join(' · ');
      out.push(`${markdown ? '- ' : '  '}${where}: ${p.message}`);
    }
  }
  if (!problems.some((p) => p.severity === 'error' || p.severity === 'claim')) out.push(markdown ? '\n**Ready to import.**' : '\nReady to import.');
  return `${out.join('\n')}\n`;
}
