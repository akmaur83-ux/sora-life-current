// ============================================================
// Supplier file → the kit's sheets. Two steps, so a person decides what
// matters before anything is converted:
//
//   proposeMapping  their columns → ours, each marked exact / similar /
//                   decision / unmatched, plus a category table listing every
//                   category value they use. Saved as mapping.json, edited by
//                   hand, kept for the next file from the same supplier.
//   convertSupplier apply the mapping: convert what can be converted, flag
//                   what cannot, and write a report line for every value
//                   changed and every row skipped.
//
// Never guessed (the owner's rule): a price (only a supplier price is read;
// an ambiguous "Price" column is a decision; a per-size price never becomes the
// product's price by itself), a stock figure ("In stock" is not a number), a
// category (only the mapping's table, filled by a person — pre-filled only
// where one category has exactly that name), a colour (never from a hex or a
// photo), a weight's kind (gross or net is a decision when the header does not
// say).
// ============================================================
import { catalogueSlug } from '../../src/lib/storeCatalogueAdmin.js';
import { categoryPaths } from '../../src/lib/storeCatalogueCsv.js';
import { columnsFor, KITS, sheetsFor } from './spec.mjs';
import * as V from './values.mjs';

const norm = (h) => String(h ?? '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[%₹#]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const unitOf = (h) => {
  const s = String(h ?? '').toLowerCase();
  if (/%|percent|pct/.test(s)) return 'percent';
  if (/per\s*g(?:ram|m)?\b|\/\s*g(?:ram|m)?\b|\bpgm?\b/.test(s)) return 'per_gram';
  if (/\b(?:ct|cts|carats?)\b/.test(s)) return 'ct';
  if (/\b(?:g|gm|gms|grams?)\b/.test(s)) return 'g';
  return null;
};

// target → the header forms it answers to (normalised). Extend these for a new supplier's vocabulary.
export const SYNONYMS = {
  name: ['name', 'product name', 'product title', 'title', 'item name', 'item title', 'style name', 'product', 'product name english'],
  slug: ['slug', 'handle', 'url key', 'url slug'],
  brand: ['brand', 'brand name', 'label', 'vendor'],
  category: ['category', 'categories', 'product category', 'sub category', 'subcategory', 'product type', 'type', 'department', 'collection', 'category name', 'item category'],
  description: ['description', 'product description', 'long description', 'details', 'product details', 'body', 'body html', 'about', 'desc', 'description html'],
  mrp: ['mrp', 'm r p', 'max retail price', 'maximum retail price', 'list price', 'original price', 'compare at price', 'compare price', 'rrp', 'retail price', 'mrp inr', 'mrp rs'],
  sale_price: ['selling price', 'sale price', 'offer price', 'special price', 'discounted price', 'our price', 'final price', 'sp', 'deal price'],
  sku: ['style code', 'style no', 'style number', 'product code', 'article no', 'article number', 'model no', 'model number', 'design no', 'design number', 'item code', 'parent sku'],
  variant_sku: ['sku', 'variant sku', 'child sku', 'sku code', 'seller sku', 'sku id', 'variant code'],
  group: ['parent sku', 'style code', 'style no', 'group id', 'parent id', 'item group', 'product group', 'design no', 'design number', 'article no', 'parent code'],
  size: ['size', 'ring size', 'size name', 'size label', 'variant size'],
  sizes: ['sizes', 'available sizes', 'size range', 'size options'],
  colour: ['colour', 'color', 'colour name', 'color name', 'shade', 'metal colour', 'metal color', 'tone', 'variant colour', 'variant color'],
  colour_hex: ['hex', 'colour hex', 'color hex', 'hex code', 'colour code', 'color code'],
  stock: ['stock', 'qty', 'quantity', 'inventory', 'available', 'available qty', 'available quantity', 'stock qty', 'units', 'on hand', 'inventory qty', 'stock quantity', 'inv qty'],
  price_override: ['size price', 'variant price'],
  hsn_code: ['hsn', 'hsn code', 'hsn sac', 'hs code', 'hsn no', 'hsn number'],
  gst_rate: ['gst', 'gst rate', 'tax', 'tax rate', 'igst', 'gst percentage', 'gst slab'],
  net_content: ['net quantity', 'net qty', 'pack size', 'pack of', 'pack contains', 'contents', 'in the box', 'net content'],
  country_of_origin: ['country of origin', 'origin', 'made in', 'coo', 'country', 'origin country', 'manufactured in'],
  generic_name: ['generic name', 'common name', 'item type', 'article type', 'generic'],
  manufacturer: ['manufacturer', 'manufactured by', 'mfg by', 'mfd by', 'manufacturer name', 'manufacturer details', 'maker'],
  packer: ['packer', 'packed by', 'packer name', 'packer details'],
  importer: ['importer', 'imported by', 'importer name', 'importer details'],
  material: ['material', 'fabric', 'composition', 'fabric composition', 'fibre', 'fiber', 'fabric content', 'material composition'],
  care: ['care', 'wash care', 'care instructions', 'washing instructions', 'wash instructions', 'care guide'],
  fit: ['fit', 'fit type', 'fit style'],
  metal: ['metal', 'metal type', 'material', 'base metal', 'metal name', 'metal and purity'],
  purity: ['purity', 'karat', 'kt', 'fineness', 'gold purity', 'metal purity', 'caratage'],
  gross_weight_g: ['gross weight', 'gross wt', 'gr wt', 'gross weight g', 'total weight', 'product weight'],
  net_metal_weight_g: ['net weight', 'net wt', 'metal weight', 'gold weight', 'net metal weight', 'silver weight', 'net metal wt'],
  making_charge_value: ['making charges', 'making charge', 'making', 'mc', 'labour', 'labour charges', 'making charges per gram', 'making per gram'],
  making_charge_type: ['making charge type', 'making type', 'mc type'],
  stone: ['stone', 'stone type', 'gemstone', 'stone name', 'gem'],
  // In Indian jewellery sheets "Diamond type" holds natural / lab-grown / CZ: the stone's origin.
  origin: ['stone origin', 'diamond origin', 'diamond nature', 'stone nature', 'natural or lab grown', 'lab grown', 'diamond type'],
  shape: ['shape', 'stone shape', 'diamond shape', 'cut'],
  stone_count: ['stone count', 'no of stones', 'number of stones', 'diamond count', 'no of diamonds', 'diamond pcs', 'stone pcs', 'stone qty'],
  total_carat: ['total carat', 'diamond weight', 'diamond wt', 'carat weight', 'ctw', 'diamond carat', 'total ct', 'stone carat', 'stone weight ct'],
  total_weight_g: ['stone weight g', 'stone wt g', 'stone weight gms'],
  clarity: ['clarity', 'diamond clarity'],
  colour_grade: ['colour grade', 'color grade', 'diamond colour', 'diamond color'],
  certificate_lab: ['certificate', 'certification', 'lab', 'certified by', 'certificate lab', 'grading lab'],
  certificate_no: ['certificate no', 'certificate number', 'cert no', 'report no', 'report number'],
  image: ['image', 'image url', 'image link', 'images', 'main image', 'photo', 'picture', 'img', 'image src'],
  is_new: ['new', 'new arrival', 'is new'],
};
// Headers that are never a selling price, and say so.
const NOT_A_PRICE = ['cost', 'cost price', 'wholesale price', 'landing cost', 'purchase price', 'dealer price', 'transfer price', 'b2b price', 'buy price'];
const AMBIGUOUS = {
  price: { candidates: ['mrp', 'sale_price'], why: 'Is "{h}" the MRP or the selling price? A price is never guessed.' },
  rate: { candidates: ['mrp', 'sale_price'], why: 'Is "{h}" the MRP or the selling price?' },
  'unit price': { candidates: ['mrp', 'sale_price'], why: 'Is "{h}" the MRP or the selling price?' },
  amount: { candidates: ['mrp', 'sale_price'], why: 'Is "{h}" the MRP or the selling price?' },
  carat: { candidates: ['purity', 'total_carat'], why: '"{h}" could be the gold purity (22 carat) or the stones’ carat weight. Which?' },
  weight: { candidates: ['gross_weight_g', 'net_metal_weight_g'], why: 'Is "{h}" the gross weight or the net metal weight?' },
  wt: { candidates: ['gross_weight_g', 'net_metal_weight_g'], why: 'Is "{h}" the gross weight or the net metal weight?' },
};
const STONE_TARGETS = new Set(['stone', 'origin', 'shape', 'stone_count', 'total_carat', 'total_weight_g', 'clarity', 'colour_grade', 'certificate_lab', 'certificate_no']);
const NEVER_FIXED = new Set(['mrp', 'sale_price', 'price_override', 'stock', 'category']);

/** The targets a kit can use: its columns plus the mapper's own (group, sizes, variant_sku, image). */
function targetsFor(kit) {
  const own = new Set(sheetsFor(kit).flatMap((s) => columnsFor(s, kit).map((c) => c.key)));
  own.delete('id'); own.delete('product_slug'); own.delete('sort_order');
  for (const extra of ['group', 'sizes', 'variant_sku', 'image']) own.add(extra);
  if (kit === 'jewellery') own.delete('material');           // a jewellery "material" is the metal
  return own;
}

/** One header → { to, how, note?, candidates?, group? } */
function matchHeader(header, kit, targets) {
  const h = norm(header);
  if (!h) return { to: null, how: 'unmatched', note: 'An empty header.' };
  // A numbered stone column ("Stone 2 Carat", "Diamond2 Weight") belongs to a second stone row.
  let group = null, bare = h;
  const numbered = /^(.*?\b(?:stone|diamond|gem))\s*(\d)\b\s*(.*)$/.exec(h) || /^(.*?)\s*(\d)$/.exec(h);
  if (numbered && /stone|diamond|gem/.test(h)) { group = Number(numbered[2]); bare = `${numbered[1]} ${numbered[3] || ''}`.replace(/\s+/g, ' ').trim(); }
  if (NOT_A_PRICE.includes(h)) return { to: null, how: 'unmatched', note: `"${header}" is a cost price; it is never used as a selling price. Dropped.` };
  if (/^(?:image|img|photo|picture)s?(?: url| link| src)?(?: \d{1,2})?$/.test(h)) return { to: 'image', how: 'exact' };
  if (AMBIGUOUS[h]) {
    const a = AMBIGUOUS[h];
    const candidates = a.candidates.filter((c) => targets.has(c));
    if (candidates.length === 1) return { to: candidates[0], how: 'similar', note: `Read as ${candidates[0]}.` };
    return { to: null, how: 'decision', candidates, note: a.why.replace('{h}', header) };
  }
  const exact = [], similar = [];
  for (const [target, forms] of Object.entries(SYNONYMS)) {
    if (!targets.has(target)) continue;
    for (const f of forms) {
      if (f === bare || f === h) exact.push([target, f]);
      else if (f.split(' ').length > 1 && f.split(' ').every((w) => bare.split(' ').includes(w))) similar.push([target, f]);
    }
  }
  const pick = (list, how) => {
    const best = Math.max(...list.map(([, f]) => f.length));
    let tops = [...new Set(list.filter(([, f]) => f.length === best).map(([t]) => t))];
    // "Style code" is both a product SKU and a grouping key: read it as the group; if its values never
    // repeat, proposeMapping turns it back into the product SKU (one row per product).
    if (tops.length === 2 && tops.includes('sku') && tops.includes('group')) tops = ['group'];
    if (tops.length === 1) {
      const to = tops[0];
      if (group && !STONE_TARGETS.has(to)) return null;
      const unit = unitOf(header);
      const note = to === 'making_charge_value' && unit ? `Making charges ${unit === 'percent' ? 'in percent' : 'per gram'} (from the header).` : undefined;
      return { to, how, ...(group ? { group } : {}), ...(note ? { note } : {}), ...(to === 'making_charge_value' && unit ? { unit } : {}) };
    }
    return { to: null, how: 'decision', candidates: tops, note: `"${header}" could be ${tops.join(' or ')}. Which?` };
  };
  if (exact.length) return pick(exact, 'exact') || { to: null, how: 'unmatched', note: 'No column of ours.' };
  if (similar.length) return pick(similar, 'similar') || { to: null, how: 'unmatched', note: 'No column of ours.' };
  return { to: null, how: 'unmatched', note: 'No column of ours matches. Set "to" to one of ours, or leave it null to drop the column.' };
}

/**
 * Propose a mapping for a supplier's sheet. `previous` (an earlier mapping.json for
 * this supplier) is kept wherever a person already decided: their edits win.
 */
export function proposeMapping(rows, { kit, supplier, sheet = null, categories = null, previous = null }) {
  if (!KITS[kit]) throw new Error('Choose the fashion or the jewellery kit.');
  const head = (rows[0] || []).map((h) => String(h).trim());
  const targets = targetsFor(kit);
  const columns = {};
  for (const header of head) {
    if (!header) continue;
    // A person's earlier edits win: a header already in the previous mapping keeps its entry.
    columns[header] = previous?.columns?.[header] || matchHeader(header, kit, targets);
  }
  // Two headers claiming one target: the exact one keeps it, the rest become decisions.
  const claimed = new Map();
  for (const [header, m] of Object.entries(columns)) {
    if (!m.to || m.to === 'image') continue;
    const k = `${m.to}#${m.group || 0}`;
    if (!claimed.has(k)) { claimed.set(k, header); continue; }
    const other = claimed.get(k);
    const loser = columns[other].how === 'exact' && m.how !== 'exact' ? header : (m.how === 'exact' && columns[other].how !== 'exact' ? other : header);
    if (loser === other) claimed.set(k, header);
    columns[loser] = { to: null, how: 'decision', candidates: [m.to], note: `"${loser}" and "${loser === header ? other : header}" both look like ${m.to}. Choose one; set the other to null.` };
  }
  // Rows of one product: a group column whose values repeat means one row per size/colour.
  const body = rows.slice(1);
  const groupHeader = Object.keys(columns).find((h) => columns[h].to === 'group');
  const skuHeader = Object.keys(columns).find((h) => columns[h].to === 'sku');
  let layout = previous?.layout || 'row-per-product';
  if (!previous?.layout) {
    const repeats = (header) => { const i = head.indexOf(header); const vals = body.map((r) => String(r[i] ?? '').trim()).filter(Boolean); return new Set(vals).size < vals.length; };
    if (groupHeader && repeats(groupHeader)) layout = 'row-per-variant';
    else if (!groupHeader && skuHeader && repeats(skuHeader)) { columns[skuHeader] = { to: 'group', how: 'similar', note: `Its values repeat, so rows sharing a "${skuHeader}" are read as one product (and it becomes the product SKU).` }; layout = 'row-per-variant'; }
    else if (groupHeader) columns[groupHeader] = { to: 'sku', how: 'similar', note: `Its values do not repeat: read as the product SKU, one row per product.` };
  }
  // The category table: every value they use. Pre-filled only where exactly one of our categories has that name or slug.
  const catHeader = Object.keys(columns).find((h) => columns[h].to === 'category');
  const categoryTable = { ...(previous?.categories || {}) };
  if (catHeader) {
    const i = head.indexOf(catHeader);
    const ours = categories ? [...categoryPaths(categories).entries()].map(([id, path]) => ({ path, name: categories.find((c) => c.id === id)?.name || '' })) : [];
    for (const r of body) {
      const value = String(r[i] ?? '').trim();
      if (!value || value in categoryTable) continue;
      const key = value.toLowerCase();
      const hits = ours.filter((c) => c.path === key || c.path.split('/').pop() === catalogueSlug(value) || c.name.toLowerCase() === key)
        .filter((c) => (KITS[kit].categoryRoot ? c.path.startsWith(`${KITS[kit].categoryRoot}/`) : !c.path.startsWith('jewellery')));
      categoryTable[value] = hits.length === 1 ? hits[0].path : null;
    }
  }
  const mapping = {
    kit, supplier, sheet, layout,
    columns,
    categories: categoryTable,
    fixed: previous?.fixed || {},
    help: {
      columns: 'Set "to" to one of our columns (see FIELD-GUIDE.md), or null to drop the column. Your edits are kept when "map" runs again on a new file from this supplier; only new columns get a fresh proposal.',
      layout: 'row-per-product: one row is one product. row-per-variant: rows sharing the "group" column are the sizes/colours of one product.',
      categories: 'Each of their category values → our category path (e.g. jewellery/rings). null leaves the category blank and the product cannot be imported until you set it. Values pre-filled here matched exactly one of our categories by name: check them.',
      fixed: 'A value for EVERY row, e.g. {"country_of_origin": "IN", "manufacturer": "Example Jewellers LLP"}. Prices, stock and category can never be fixed.',
    },
  };
  return { mapping, decisions: openDecisions(mapping) };
}

export function openDecisions(mapping) {
  const list = [];
  for (const [header, m] of Object.entries(mapping.columns)) if (m.how === 'decision' && !m.to) list.push(`Column "${header}": ${m.note}`);
  for (const [value, path] of Object.entries(mapping.categories || {})) if (!path) list.push(`Category "${value}": set our category path.`);
  for (const key of Object.keys(mapping.fixed || {})) if (NEVER_FIXED.has(key)) list.push(`"fixed.${key}" is not allowed: prices, stock and category are never filled from a fixed value.`);
  return list;
}

// ---------- convert ----------
const STONE_ORIGIN = (raw) => {
  const s = String(raw ?? '').trim();
  if (V.isEmpty(s)) return { value: '' };
  const k = s.toLowerCase();
  if (/lab|lgd|cvd|hpht|man[- ]?made|created|grown/.test(k)) return { value: 'lab_grown', note: `"${s}" → lab_grown` };
  if (/\bcz\b|zircon|american diamond|\bad\b|simulant|imitation|glass|crystal|synthetic/.test(k)) return { value: 'simulant', note: `"${s}" → simulant` };
  if (/natural|mined|earth|real|genuine/.test(k)) return { value: 'natural', note: `"${s}" → natural` };
  return { value: '', flag: `"${s}": natural, lab-grown or simulant? Not guessed.` };
};
const CONVERT = {
  name: V.plainText, slug: V.text, brand: V.text, description: V.plainText, sku: V.text, variant_sku: V.text, group: V.text,
  mrp: V.money, sale_price: V.money, price_override: V.money, stock: V.stock, hsn_code: V.hsn, gst_rate: V.gst,
  net_content: V.text, country_of_origin: V.country, generic_name: V.text, manufacturer: V.text, packer: V.text, importer: V.text,
  material: V.plainText, care: V.plainText, fit: V.fit, size: V.size, colour: V.text, colour_hex: V.colourHex, is_new: V.yesNo,
  gross_weight_g: V.grams, net_metal_weight_g: V.grams, making_charge_value: V.making, making_charge_type: V.text,
  metal: V.metal, purity: (raw) => V.purity(raw),
  stone: V.text, origin: STONE_ORIGIN, shape: V.text, stone_count: V.count, total_carat: V.carats, total_weight_g: V.grams,
  clarity: V.text, colour_grade: V.text, certificate_lab: V.text, certificate_no: V.text, image: V.text,
};

/**
 * Convert a supplier sheet with a mapping. Returns the kit's sheets as row objects,
 * an images list, and the report: one entry per value changed or flagged and per row skipped.
 */
export function convertSupplier(rows, mapping) {
  const kit = mapping.kit;
  if (!KITS[kit]) throw new Error('mapping.json: "kit" must be fashion or jewellery.');
  const head = (rows[0] || []).map((h) => String(h).trim());
  const report = [];
  const note = (line, product, column, action, before, after, reason) => report.push({ line, product: product || '', column: column || '', action, before: before ?? '', after: after ?? '', reason });
  for (const key of Object.keys(mapping.fixed || {})) if (NEVER_FIXED.has(key)) throw new Error(`mapping.json: "fixed.${key}" is not allowed. Prices, stock and category are never filled from a fixed value.`);
  const mapped = Object.entries(mapping.columns || {}).filter(([, m]) => m.to);
  for (const [header] of mapped) if (!head.includes(header)) throw new Error(`mapping.json names a column "${header}" this file does not have. Run "map" again for this file.`);
  for (const [header, m] of Object.entries(mapping.columns || {})) if (!m.to) note(0, '', header, 'dropped', '', '', m.how === 'decision' ? `Not converted until decided: ${m.note}` : (m.note || 'Not mapped.'));

  // 1. each row → a flat record of converted values
  const records = [];
  rows.slice(1).forEach((cells, i) => {
    const line = cells.rowNumber ?? i + 2;
    const rec = { line, values: {}, stones: {}, images: [] };
    for (const [header, m] of mapped) {
      const raw = cells[head.indexOf(header)];
      const conv = (CONVERT[m.to] || V.text)(raw);
      const label = String(raw ?? '').trim();
      if (conv.flag) rec.flags = [...(rec.flags || []), [m.to, label, conv.flag]];
      else if (conv.note) rec.notes = [...(rec.notes || []), [m.to, label, conv.value, conv.note]];
      if (m.to === 'image') { if (conv.value) rec.images.push(conv.value); continue; }
      if (STONE_TARGETS.has(m.to)) {
        const g = m.group || 1;
        rec.stones[g] = { ...(rec.stones[g] || {}), [m.to]: conv.value };
        rec.stoneRaw = { ...(rec.stoneRaw || {}), [g]: { ...(rec.stoneRaw?.[g] || {}), [m.to]: label } };
        continue;
      }
      if (m.to === 'making_charge_value' && conv.value) {
        const unit = conv.unit || m.unit;
        if (unit) rec.values.making_charge_type = unit;
        else if (!mapped.some(([, x]) => x.to === 'making_charge_type')) rec.flags = [...(rec.flags || []), ['making_charge_type', label, `Making charge "${label}": per gram, percent or flat? Not guessed.`]];
      }
      if (m.to === 'metal' && conv.value) rec.fromMetal = { purity: conv.purity, colour: conv.colour };
      if (m.to === 'sizes') { rec.sizes = V.sizeList(raw); continue; }
      rec.values[m.to] = conv.value;
    }
    if (Object.values(rec.values).every((v) => !v) && !rec.sizes?.length) return;     // a blank row
    // "18K Rose Gold" in the metal cell fills purity and colour where the row's own cells for them are empty.
    for (const extra of ['purity', 'colour']) {
      const derived = rec.fromMetal?.[extra];
      if (derived && !rec.values[extra]) { rec.values[extra] = derived; rec.notes = [...(rec.notes || []), [extra, '', derived, `${extra} read from the metal cell: ${derived}`]]; }
    }
    records.push(rec);
  });

  // 2. rows → products (+ their variants)
  const groups = new Map();
  for (const rec of records) {
    const key = mapping.layout === 'row-per-variant' ? (rec.values.group || rec.values.name || `line-${rec.line}`) : `line-${rec.line}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rec);
  }
  const products = [], variants = [], stones = [], images = [], slugs = new Map();
  const PRODUCT_KEYS = columnsFor('products', kit).map((c) => c.key).filter((k) => !['id', 'stock'].includes(k));
  const AGREE = ['name', 'brand', 'description', 'category', 'hsn_code', 'gst_rate', 'country_of_origin', 'manufacturer', 'material', 'metal', 'purity'];
  for (const recs of groups.values()) {
    const first = recs[0], v = first.values;
    const name = v.name || '';
    if (!name) {
      for (const r of recs) note(r.line, '', 'name', 'skipped', '', '', 'No product name on this row: skipped.');
      continue;
    }
    const slug = v.slug || catalogueSlug(name);
    if (!v.slug) note(first.line, slug, 'slug', 'converted', name, slug, 'Slug made from the name.');
    if (slugs.has(slug)) note(first.line, slug, 'slug', 'flagged', '', slug, `Another product (line ${slugs.get(slug)}) has the same slug. Give one of them a different slug.`);
    slugs.set(slug, first.line);
    for (const r of recs) {
      for (const [column, before, after, why] of r.notes || []) note(r.line, slug, column, 'converted', before, after, why);
      for (const [column, before, why] of r.flags || []) note(r.line, slug, column, 'flagged', before, '', why);
    }
    // The product row.
    const p = { slug };
    for (const k of PRODUCT_KEYS) if (k !== 'slug' && k !== 'category' && v[k] !== undefined) p[k] = v[k];
    if (mapping.layout === 'row-per-variant' && v.group && !v.sku && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(v.group)) { p.sku = v.group; }
    for (const [k, value] of Object.entries(mapping.fixed || {})) if (PRODUCT_KEYS.includes(k)) {
      if (p[k] && p[k] !== value) note(first.line, slug, k, 'flagged', p[k], value, `The file says "${p[k]}" but the mapping fixes "${value}": the file's value is kept.`);
      else p[k] = value;
    }
    // Category: only through the table.
    if (v.category) {
      const path = mapping.categories?.[v.category];
      if (path) { p.category = path; if (path !== v.category) note(first.line, slug, 'category', 'converted', v.category, path, 'From the mapping’s category table.'); }
      else note(first.line, slug, 'category', 'flagged', v.category, '', `Category "${v.category}" has no path in the mapping’s category table: left blank (the product cannot be imported until it is set).`);
    } else note(first.line, slug, 'category', 'flagged', '', '', 'No category in the file: left blank. Categories are never guessed.');
    // Rows of one product must agree on what belongs to the product.
    for (const k of AGREE) {
      const vals = [...new Set(recs.map((r) => r.values[k]).filter(Boolean))];
      if (vals.length > 1) note(first.line, slug, k, 'flagged', vals.join(' | '), p[k] ?? '', `The rows of this product disagree on ${k}; the first row's value is used. Check it.`);
    }
    // Prices: one MRP per product; per-size selling prices become per-size overrides, never the product's price.
    const mrps = [...new Set(recs.map((r) => r.values.mrp).filter(Boolean))];
    if (mrps.length > 1) { p.mrp = ''; note(first.line, slug, 'mrp', 'flagged', mrps.join(' | '), '', 'The sizes have different MRPs; a product has one MRP. Decide it (or split the sizes into separate products). Left blank.'); }
    const sales = [...new Set(recs.map((r) => r.values.sale_price).filter(Boolean))];
    let perSize = false;
    if (sales.length > 1) {
      perSize = true; p.sale_price = '';
      note(first.line, slug, 'sale_price', 'flagged', sales.join(' | '), '', 'Sizes are priced differently: each size gets its own price (price_override) and the product’s selling price is left blank — set it if you want a single listing price.');
    }
    if (!p.mrp && mrps.length <= 1 && !recs.some((r) => (r.flags || []).some(([column]) => column === 'mrp'))) note(first.line, slug, 'mrp', 'flagged', '', '', 'No MRP in the file: a product cannot be created without one. Never filled in for you.');
    products.push(p);
    // Variants.
    const variantRows = [];
    for (const r of recs) {
      const sizes = r.sizes?.length ? r.sizes : [r.values.size || ''];
      if (r.sizes?.length > 1 && r.values.stock) note(r.line, slug, 'stock', 'flagged', r.values.stock, '', `One stock figure for ${r.sizes.length} sizes cannot be split: stock left blank for each. Stock is never guessed.`);
      for (const size of sizes) {
        const vr = { product_slug: slug, size: size || 'One size', colour: r.values.colour || '', colour_hex: r.values.colour_hex || '', sku: r.values.variant_sku || '', stock: r.sizes?.length > 1 ? '' : (r.values.stock || ''), price_override: r.values.price_override || (perSize ? r.values.sale_price || '' : ''), is_active: 'yes' };
        if (!size) note(r.line, slug, 'size', 'converted', '', 'One size', 'No size given: one variant, “One size”.');
        if (!vr.colour) note(r.line, slug, 'colour', 'flagged', '', '', 'No colour given: fashion and jewellery variants need one. Not guessed — fill it in.');
        const stockFlagged = (r.flags || []).some(([column]) => column === 'stock');
        if (!vr.stock && !stockFlagged && !(r.sizes?.length > 1 && r.values.stock)) note(r.line, slug, 'stock', 'flagged', '', '', 'No stock figure: a new size/colour cannot be imported without one.');
        if (kit === 'jewellery') { vr.gross_weight_g = r.values.gross_weight_g || ''; vr.net_metal_weight_g = r.values.net_metal_weight_g || ''; }
        variantRows.push(vr);
      }
    }
    const seen = new Set();
    for (const vr of variantRows) {
      const k = `${vr.size}|${vr.colour}`;
      if (seen.has(k)) { note(first.line, slug, 'size', 'flagged', `${vr.size} / ${vr.colour}`, '', 'The same size and colour appears twice for this product: only the first is kept.'); continue; }
      seen.add(k);
      variants.push({ ...vr, sort_order: String(variants.filter((x) => x.product_slug === slug).length) });
    }
    // Stones (one row per stone group), from the product's first row.
    for (const [g, st] of Object.entries(first.stones)) {
      if (!Object.values(st).some(Boolean)) continue;
      const row = { product_slug: slug, ...st, sort_order: String(g) };
      // The stone's name, when the file gives only "Diamond …" columns: from what the supplier wrote, never assumed.
      if (!row.stone) {
        const raw = String(first.stoneRaw?.[g]?.origin ?? '');
        const diamondHeaders = Object.entries(mapping.columns).some(([h, m]) => STONE_TARGETS.has(m.to) && (m.group || 1) === Number(g) && /diamond/i.test(h));
        if (/\bcz\b|zircon|american diamond|\bad\b/i.test(raw)) { row.stone = 'cubic zirconia'; note(first.line, slug, 'stone', 'converted', raw, row.stone, `"${raw}" names the stone: cubic zirconia.`); }
        else if (diamondHeaders && ['natural', 'lab_grown'].includes(row.origin)) { row.stone = 'diamond'; note(first.line, slug, 'stone', 'converted', '', 'diamond', 'The file’s stone columns are its “Diamond …” columns.'); }
        else note(first.line, slug, 'stone', 'flagged', '', '', 'The stone is not named in the file: fill it in.');
      }
      stones.push(row);
      if (!row.origin) note(first.line, slug, 'origin', 'flagged', '', '', 'Stone origin (natural, lab-grown or simulant) is not in the file: fill it in.');
    }
    // Images → a list to name <slug>-<n>.<ext>.
    const urls = [...new Set(recs.flatMap((r) => r.images))];
    urls.forEach((url, i) => images.push({ product_slug: slug, number: String(i + 1), url, file_name: `${slug}-${i + 1}${(/\.(webp|jpe?g|png)(?:\?|$)/i.exec(url)?.[0] || '.jpg').replace(/\?$/, '').toLowerCase()}` }));
  }
  return { products, variants, stones, images, report, decisions: openDecisions(mapping) };
}

export function reportMarkdown({ supplier, kit, file, mapping, result, validation }) {
  const r = result.report;
  const by = (a) => r.filter((x) => x.action === a);
  const lines = [
    `# ${supplier} → ${KITS[kit].label} kit`,
    `Source: ${file}`,
    '',
    `${result.products.length} product(s), ${result.variants.length} size/colour row(s)${kit === 'jewellery' ? `, ${result.stones.length} stone row(s)` : ''}, ${result.images.length} image URL(s).`,
    `${by('converted').length} value(s) converted · ${by('flagged').length} flagged · ${by('skipped').length} row(s) skipped · ${by('dropped').length} column(s) not used.`,
    '',
    '## Their columns → ours',
    '| Their column | Ours | How |',
    '|---|---|---|',
    ...Object.entries(mapping.columns).map(([h, m]) => `| ${h} | ${m.to ? `${m.to}${m.group ? ` (stone ${m.group})` : ''}` : '—'} | ${m.how}${m.note ? `: ${m.note}` : ''} |`),
    '',
    '## Open decisions',
    ...(result.decisions.length ? result.decisions.map((d) => `- ${d}`) : ['- None.']),
    '',
    '## Skipped rows',
    ...(by('skipped').length ? by('skipped').map((x) => `- line ${x.line}: ${x.reason}`) : ['- None.']),
    '',
    '## Flagged — needs a person',
    ...(by('flagged').length ? by('flagged').map((x) => `- line ${x.line} · ${x.product} · ${x.column}${x.before ? ` · "${x.before}"` : ''}: ${x.reason}`) : ['- None.']),
    '',
    '## Converted',
    ...(by('converted').length ? by('converted').map((x) => `- line ${x.line} · ${x.product} · ${x.column}: ${x.reason}`) : ['- None.']),
    '',
  ];
  if (validation) lines.push('---', '', validation);
  return `${lines.join('\n')}\n`;
}
