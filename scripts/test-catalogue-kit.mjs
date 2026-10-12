// ============================================================
// The catalogue loading kit (scripts/catalogue-kit/) — offline suite.
//
// Pins that the templates and FIELD-GUIDE.md are the spec's, that the guide
// quotes the importer's real messages, that the example rows are clean but
// for the example-slug guard, that the validator reports every row the admin
// import would skip (with the import's own reason) plus the problems the import
// does not check — all in one pass — and that the supplier mapper converts what
// it can and never fills a price, a stock figure or a category. Also the .xlsx
// reader against the same sheet as CSV, and the live category read sending
// only the public key. NO NETWORK (a local server stands in), NO DATABASE.
//
//   node scripts/test-catalogue-kit.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { deflateRawSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PRODUCT_CSV_COLUMNS, VARIANT_CSV_COLUMNS, planProductImport } from '../src/lib/storeCatalogueCsv.js';
import { PRODUCT_FIELD_RULES, VARIANT_FIELD_RULES, catalogueVariantPayload, catalogueProductPayload } from '../src/lib/storeCatalogueAdmin.js';
import { COLUMNS, EXAMPLES, MSG, KITS, columnsFor } from './catalogue-kit/spec.mjs';
import { templates, fieldGuide } from './catalogue-kit/build.mjs';
import { validateKit, categoriesFromPaths, fetchLiveCategories, publicSupabaseConfig } from './catalogue-kit/validate.mjs';
import { proposeMapping, convertSupplier } from './catalogue-kit/map.mjs';
import { readSheetFile, readCsvBuffer, toCsv } from './catalogue-kit/sheets.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KIT = join(ROOT, 'scripts', 'catalogue-kit');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed += 1; }
}
const CATEGORIES = categoriesFromPaths(['bags-accessories,Bags & Accessories', 'clothing/men/mens-shirts,Shirts', 'clothing/women,Women', 'jewellery/necklaces,Necklaces', 'jewellery/rings,Rings', 'jewellery/earrings,Earrings']);
// A Windows checkout (core.autocrlf) holds the kit's files with CRLF; the importer and the kit read either.
const lf = (s) => s.replace(/\r\n/g, '\n');
const template = (name) => lf(readFileSync(join(KIT, 'templates', name), 'utf8'));
const throwsWith = (fn) => { try { fn(); } catch (e) { return e.fieldErrors ? Object.values(e.fieldErrors).join(' ') : e.message; } return null; };
const tmp = mkdtempSync(join(process.env.TEMP || tmpdir(), 'catalogue-kit-'));

console.log('\n— The spec, the templates and the guide —');

await test('the templates and FIELD-GUIDE.md are exactly what spec.mjs builds (kit.mjs build --check)', () => {
  for (const f of templates()) assert.equal(lf(readFileSync(join(KIT, f.path), 'utf8')), f.text, `${f.path} is out of date — run kit.mjs build`);
  assert.equal(lf(readFileSync(join(KIT, 'FIELD-GUIDE.md'), 'utf8')), fieldGuide(), 'FIELD-GUIDE.md is out of date — run kit.mjs build');
  const run = spawnSync(process.execPath, [join(KIT, 'kit.mjs'), 'build', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

await test('"importable" is the importer\'s own column list, both ways: every column it reads is in the kit, and every kit column marked importable is one it reads', () => {
  const kitProducts = new Set(COLUMNS.filter((c) => c.sheet === 'products' && c.importable).map((c) => c.key));
  const kitVariants = new Set(COLUMNS.filter((c) => c.sheet === 'variants' && c.importable).map((c) => c.key));
  assert.deepEqual([...kitProducts].sort(), [...PRODUCT_CSV_COLUMNS].sort());
  assert.deepEqual([...kitVariants].sort(), [...VARIANT_CSV_COLUMNS].sort());
  for (const kit of Object.keys(KITS)) for (const c of columnsFor('products', kit)) assert.ok(c.purpose && c.format && c.blank, `${kit}.${c.key} has a purpose, a format and a blank rule`);
});

await test('the guide quotes the importer\'s real messages (each triggered through the importer\'s own rules)', () => {
  const triggered = {
    slugRule: throwsWith(() => PRODUCT_FIELD_RULES.slug('Bad Slug')), skuRule: throwsWith(() => PRODUCT_FIELD_RULES.sku('SKU 1')),
    name: throwsWith(() => PRODUCT_FIELD_RULES.name('')), mrp: throwsWith(() => PRODUCT_FIELD_RULES.mrp('0')),
    sale: throwsWith(() => PRODUCT_FIELD_RULES.sale_price('0')), hsn: throwsWith(() => PRODUCT_FIELD_RULES.hsn_code('901')),
    gst: throwsWith(() => PRODUCT_FIELD_RULES.gst_rate('101')), stock: throwsWith(() => PRODUCT_FIELD_RULES.stock('-1')),
    order: throwsWith(() => PRODUCT_FIELD_RULES.sort_order('1.5')), hex: throwsWith(() => VARIANT_FIELD_RULES.colour_hex('red')),
    override: throwsWith(() => VARIANT_FIELD_RULES.price_override('0')),
    variantColour: throwsWith(() => catalogueVariantPayload({ size: 'M', colour: '', stock: 1 }, 'fashion', [])),
    categoryMissing: throwsWith(() => catalogueProductPayload({ name: 'X', mrp: 10, stock: 0, sort_order: 0 }, [])),
  };
  for (const [key, message] of Object.entries(triggered)) assert.ok(message && message.includes(MSG[key]), `MSG.${key} — the importer says "${message}"`);
  const saleOver = throwsWith(() => catalogueProductPayload({ name: 'X', category_id: CATEGORIES[0].id, mrp: 100, sale_price: 200, stock: 0, sort_order: 0 }, CATEGORIES));
  assert.match(saleOver, /^Selling price cannot be more than the MRP \(₹100\)\.$/);
  assert.ok(MSG.saleOverMrp.startsWith('Selling price cannot be more than the MRP'));
  const guide = fieldGuide();
  for (const message of Object.values(MSG)) assert.ok(guide.includes(message.replace(/\|/g, '\\|')), `the guide shows: ${message}`);
});

console.log('\n— The example rows —');

await test('three example products per kit: one "One size" product, one with sizes × colours priced per size, one out of stock (every size at 0) — each kit\'s examples clean but for the example-slug guard', () => {
  for (const kit of Object.keys(KITS)) {
    const ex = EXAMPLES[kit];
    assert.equal(ex.products.length, 3);
    const [single, many, out] = ex.products.map((p) => ex.variants.filter((v) => v.product_slug === p.slug));
    assert.equal(single.length, 1); assert.equal(single[0].size, 'One size');
    assert.ok(new Set(many.map((v) => v.size)).size > 1 && new Set(many.map((v) => v.colour)).size > 1, `${kit}: several sizes and colours`);
    assert.ok(many.some((v) => v.price_override) && many.some((v) => !v.price_override), `${kit}: priced per size`);
    assert.ok(out.every((v) => v.stock === '0'), `${kit}: out of stock`);
    const result = validateKit({
      kit, products: template(`${kit}-products.csv`), variants: template(`${kit}-variants.csv`),
      stones: kit === 'jewellery' ? template('jewellery-stones.csv') : null, companies: template('companies.csv'), categories: CATEGORIES,
    });
    const errors = result.problems.filter((p) => p.severity === 'error');
    assert.deepEqual(errors.map((e) => e.message), Array(3).fill('This is an example row from the template. Delete it before importing.'), `${kit}: ${JSON.stringify(errors)}`);
    assert.equal(result.counts.claim, 0); assert.equal(result.counts.later, 0, `${kit}: ${JSON.stringify(result.problems.filter((p) => p.severity === 'later'))}`);
    assert.ok(result.problems.some((p) => /Every size is at stock 0/.test(p.message)), `${kit}: the out-of-stock example is noticed`);
    // Without the example prefix, the import would create all three as drafts.
    const renamed = template(`${kit}-products.csv`).replace(/example-/g, 'real-');
    const plan = planProductImport(renamed, { store: 'fashion', products: [], categories: CATEGORIES, create: true });
    assert.equal(plan.changes.filter((c) => c.kind === 'create').length, 3, `${kit}: ${JSON.stringify(plan.skipped)}`);
    assert.ok(plan.changes.every((c) => c.input.is_active === false), 'created as drafts');
  }
});

console.log('\n— The validator —');

const BAD_PRODUCTS = `slug,name,category,description,mrp,sale_price,sku,hsn_code,gst_rate,country_of_origin,manufacturer,material,care,fit,sale price
Linen Shirt,Linen Shirt,clothing/men/mens-shirts,Fast delivery and eco-friendly linen that cures stress,2499,2999,SKU 1,901,5%,India,Nobody Ltd,60% linen,,Baggy,1999
silk-scarf,Silk Scarf,accessories/scarves,<p>A scarf</p>,1299,,1.23E+11,6214,,CN,,100% silk,Dry clean,,
silk-scarf,Silk Scarf again,clothing/women,,999,,,,,,,,,,
no-variants,No Variants Tee,clothing/women,A tee.,999,,,6109,,IN,Example Textiles Pvt Ltd,100% cotton,Wash cold,Regular,
`;
const BAD_VARIANTS = `product_slug,size,colour,colour_hex,sku,stock,price_override,is_active
silk-scarf,One size,,red,,5,1499,yes
ghost-product,M,Blue,#0000FF,,3,,yes
silk-scarf,One size,Red,#AA0000,DUP-1,in stock,,yes
`;
const bad = () => validateKit({ kit: 'fashion', products: BAD_PRODUCTS, variants: BAD_VARIANTS, companies: template('companies.csv'), categories: CATEGORIES });
const has = (result, sheet, line, re, severity = 'error') => result.problems.some((p) => p.sheet === sheet && p.line === line && p.severity === severity && re.test(p.message));

await test('every row the admin import would skip is reported with the import\'s own reason', () => {
  const result = bad();
  const plan = planProductImport(BAD_PRODUCTS, { store: 'fashion', products: [], categories: CATEGORIES, create: true });
  assert.ok(plan.skipped.length >= 3);
  for (const s of plan.skipped) assert.ok(has(result, 'products', s.line, new RegExp(s.reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))), `line ${s.line}: ${s.reason}`);
  assert.equal(result.ok, false);
});

await test('one pass lists everything: a row\'s cell errors AND its selling price above the MRP; a variant\'s own problems even while its product has one', () => {
  const result = bad();
  assert.ok(has(result, 'products', 2, /^Selling price cannot be more than the MRP \(₹2499\)\.$/), 'sale > MRP on a row whose slug, SKU, HSN and GST also fail');
  assert.ok(has(result, 'products', 2, /Use lowercase letters/));
  assert.ok(has(result, 'variants', 2, /Colour hex must look like #123ABC/));
  assert.ok(has(result, 'variants', 2, /Enter a colour/), 'the missing colour, hidden behind the hex error in the import');
  assert.ok(has(result, 'variants', 4, /Stock must be a whole number/));
  assert.ok(has(result, 'variants', 3, /No Fashion product has the slug "ghost-product"/));
});

await test('what the import does not check: a size above its MRP, a spreadsheet-shortened SKU, an HSN that lost a 0, a typo\'d column, an unknown company, material not adding to 100, a fit off the list, HTML in copy, a product nobody can buy', () => {
  const result = bad();
  assert.ok(has(result, 'variants', 2, /Price override ₹1499 is above the MRP ₹999/));
  assert.ok(has(result, 'products', 3, /"1\.23E\+11" is a number a spreadsheet shortened/));
  assert.ok(has(result, 'products', 2, /dropped a leading 0/));
  assert.ok(has(result, 'products', 1, /Column "sale price" .* did you mean "sale_price"\?/));
  assert.ok(has(result, 'products', 2, /Manufacturer "Nobody Ltd" is not in the companies sheet/));
  assert.ok(has(result, 'products', 2, /add up to 60%, not 100%/));
  assert.ok(has(result, 'products', 2, /Fit "Baggy" must be one of/));
  assert.ok(has(result, 'products', 3, /contains HTML tags/, 'later'));
  assert.ok(has(result, 'products', 5, /without one cannot be published or bought/, 'later'));
  assert.ok(has(result, 'products', 3, /Made in CN: name the importer/, 'later'));
  assert.ok(!result.problems.some((p) => /Made in India/.test(p.message)), 'an invalid country is an error, not a missing importer');
});

await test('the claim scan: speed, sustainability and medical claims in the copy, each with its excerpt', () => {
  const claims = bad().problems.filter((p) => p.severity === 'claim').map((p) => p.message);
  assert.ok(claims.some((m) => /^Speed claim \(“fast delivery”\)/.test(m)));
  assert.ok(claims.some((m) => /^Sustainability claim \(“eco-friendly”\)/.test(m)));
  assert.ok(claims.some((m) => /^Medical or treatment claim \(“cures”\)/.test(m)));
});

await test('jewellery rules: purity must be a grade of the metal, none on plated metal, net ≤ gross, making charges as a pair, rate-linked cannot go live, a stone needs its origin, a jewellery listing under jewellery/', () => {
  const products = `slug,name,category,mrp,metal,purity,making_charge_type,making_charge_value,pricing_mode,country_of_origin,manufacturer,hsn_code,description
ring-a,Ring A,jewellery/rings,1000,gold,925,,,fixed,IN,Example Jewellers LLP,7113,A ring.
ring-b,Ring B,jewellery/rings,1000,gold_plated,750,percent,,rate_linked,IN,Example Jewellers LLP,7113,A ring.
ring-c,Ring C,clothing/women,1000,silver,925,flat,400,fixed,IN,Example Jewellers LLP,7113,A ring.
`;
  const variants = `product_slug,size,colour,colour_hex,stock,gross_weight_g,net_metal_weight_g
ring-a,12,Yellow gold,#D4AF37,1,3.0,3.5
ring-b,12,Yellow gold,#D4AF37,1,,
ring-c,One size,Silver,#C0C0C0,1,2,1.5
`;
  const stones = `product_slug,stone,origin,stone_count,certificate_lab,certificate_no
ring-a,diamond,mined,0,IGI,
`;
  const r = validateKit({ kit: 'jewellery', products, variants, stones, companies: template('companies.csv'), categories: CATEGORIES });
  assert.ok(has(r, 'products', 2, /Purity 925 is not a gold grade/));
  assert.ok(has(r, 'products', 3, /Purity is only for gold, silver and platinum, not gold_plated/));
  assert.ok(has(r, 'products', 3, /Making charges need both a type and a value/));
  assert.ok(has(r, 'products', 3, /Rate-linked: .*cannot go live/, 'later'));
  assert.ok(has(r, 'products', 4, /is not a jewellery category/));
  assert.ok(has(r, 'variants', 2, /Net metal weight 3\.5 g cannot exceed the gross weight 3 g/));
  assert.ok(has(r, 'variants', 3, /Gross and net metal weight are expected/, 'later'));
  assert.ok(has(r, 'stones', 2, /Origin "mined" must be natural, lab_grown, simulant/));
  assert.ok(has(r, 'stones', 2, /Stone count must be a whole number, 1 or more/));
  assert.ok(has(r, 'stones', 2, /needs both its lab and its number/));
});

await test('images: <slug>-<n>.<webp|jpg|png> matched to the products file — a product with no -1 image, two files with one number, a name that matches nothing, a photo under 800 px', () => {
  const dir = join(tmp, 'images');
  mkdirSync(dir, { recursive: true });
  const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  writeFileSync(join(dir, 'real-tote-1.png'), png(1600, 1600));
  writeFileSync(join(dir, 'real-shirt-1.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x02, 0x58]));
  writeFileSync(join(dir, 'real-shirt-1.png'), png(600, 600));
  writeFileSync(join(dir, 'someone-else-1.png'), png(900, 900));
  const products = 'slug,name,category,mrp\nreal-tote,Tote,bags-accessories,999\nreal-shirt,Shirt,clothing/women,999\nreal-cardigan,Cardigan,clothing/women,999\n';
  const r = validateKit({ kit: 'fashion', products, categories: CATEGORIES, imagesDir: dir });
  assert.ok(r.problems.some((p) => p.sheet === 'images' && p.key === 'real-cardigan' && /No image named real-cardigan-1\.webp/.test(p.message)));
  assert.ok(r.problems.some((p) => p.sheet === 'images' && p.severity === 'error' && /More than one file is numbered 1/.test(p.message)));
  assert.ok(r.problems.some((p) => p.sheet === 'images' && /No product in this store has the slug “someone-else”/.test(p.message)));
  assert.ok(r.problems.some((p) => p.sheet === 'images' && /600 × 600 px: under 800 px/.test(p.message)));
});

await test('--live-categories reads the store\'s categories the storefront way: public key only, read-only, fashion store', async () => {
  let seen = null;
  const server = createServer((req, res) => {
    seen = { url: req.url, method: req.method, apikey: req.headers.apikey, auth: req.headers.authorization };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([{ id: 'c1', parent_id: null, name: 'Jewellery', slug: 'jewellery', is_active: true, sort_order: 0 }, { id: 'c2', parent_id: 'c1', name: 'Rings', slug: 'rings', is_active: true, sort_order: 1 }]));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const envDir = join(tmp, 'env');
  mkdirSync(envDir, { recursive: true });
  writeFileSync(join(envDir, '.env.local'), `VITE_SUPABASE_URL=http://127.0.0.1:${server.address().port}\nVITE_SUPABASE_PUBLISHABLE_KEY="public-key"\nSUPABASE_SERVICE_ROLE_KEY=never-read\nRAZORPAY_KEY_SECRET=never-read\n`);
  const saved = { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY };
  delete process.env.VITE_SUPABASE_URL; delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const config = publicSupabaseConfig(envDir);
    assert.deepEqual(Object.keys(config).sort(), ['key', 'url']);
    assert.ok(!JSON.stringify(config).includes('never-read'));
    const categories = await fetchLiveCategories(config);
    assert.equal(seen.method, 'GET'); assert.match(seen.url, /^\/rest\/v1\/catalogue_categories\?select=id,parent_id,name,slug,is_active,sort_order&store=eq\.fashion$/);
    assert.equal(seen.apikey, 'public-key'); assert.equal(seen.auth, 'Bearer public-key');
    const r = validateKit({ kit: 'jewellery', products: 'slug,name,category,mrp\nband,Band,jewellery/rings,999\n', categories });
    assert.ok(!r.problems.some((p) => /is not a Fashion category/.test(p.message)), 'jewellery/rings resolves against the live list');
  } finally {
    server.close();
    if (saved.url !== undefined) process.env.VITE_SUPABASE_URL = saved.url;
    if (saved.key !== undefined) process.env.VITE_SUPABASE_PUBLISHABLE_KEY = saved.key;
  }
});

console.log('\n— The supplier mapper —');

const SUPPLIER = `Style Code,SKU,Product Name,Category,Metal,Purity,Ring Size,Gross Wt (g),Net Wt (g),Diamond Wt (ct),No. of Diamonds,Diamond Type,Price,MRP (₹),Qty,Making Charges (%),HSN,Country,Image 1,Image 2,Cost Price,Notes
AR-101,AR-101-12,Classic Band Ring,Rings,Yellow Gold,22KT,12,3.25 g,3.25,,,,"₹27,499.00","28,999",2,12,7113,India,https://cdn.example.com/ar101-a.jpg,https://cdn.example.com/ar101-b.jpg,"21,000",
AR-101,AR-101-14,Classic Band Ring,Rings,Yellow Gold,22KT,14,3.40 g,3.40,,,,"₹27,999.00","28,999",In stock,12,7113,India,,,"21,500",check weights
AR-101,AR-101-16,Classic Band Ring,Rings,Yellow Gold,22KT,16,3.55 g,3.55,,,,"₹28,499.00","28,999",3 pcs,12,7113,India,,,"22,000",
AP-205,AP-205-OS,Solitaire Pendant,Pendants,18K Rose Gold,,Free Size,2150 mg,2.1,0.25 ct,1,Lab Grown,"38,999","42,999",3,10,711319,India,https://cdn.example.com/ap205.webp?v=2,,"30,000",
AE-300,AE-300-OS,<b>Drop Earrings</b>,Earings,925 Sterling Silver,,,6.2,5.9,,2,CZ,"3,499/-",,Out of stock,,7113,India,,,"2,100",
,,,,,,,,,,,,,,,,,,,,,
AX-999,AX-999-1,,Rings,Gold,22K,10,3,3,,,,"25,000","26,000",1,12,7113,India,,,,no name on this row
`;
const supplierRows = () => readCsvBuffer(Buffer.from(SUPPLIER, 'utf8'));

await test('map: their columns → ours (exact where the header says so), an ambiguous "Price" held for a decision, a cost price dropped, numbered images and stone columns read, one row per size grouped by style code', () => {
  const { mapping, decisions } = proposeMapping(supplierRows(), { kit: 'jewellery', supplier: 'test', categories: CATEGORIES });
  const to = (h) => mapping.columns[h].to;
  assert.equal(mapping.layout, 'row-per-variant');
  assert.deepEqual(['Style Code', 'SKU', 'Product Name', 'MRP (₹)', 'Qty', 'Gross Wt (g)', 'Net Wt (g)', 'Diamond Wt (ct)', 'No. of Diamonds', 'Diamond Type', 'Making Charges (%)', 'Image 1', 'Image 2'].map(to),
    ['group', 'variant_sku', 'name', 'mrp', 'stock', 'gross_weight_g', 'net_metal_weight_g', 'total_carat', 'stone_count', 'origin', 'making_charge_value', 'image', 'image']);
  assert.equal(to('Price'), null); assert.equal(mapping.columns.Price.how, 'decision');
  assert.equal(to('Cost Price'), null); assert.match(mapping.columns['Cost Price'].note, /never used as a selling price/);
  assert.equal(mapping.columns['Making Charges (%)'].unit, 'percent');
  assert.ok(decisions.some((d) => /Column "Price"/.test(d)));
});

await test('map: the category table lists every value they use — pre-filled only where exactly one of our categories has that name ("Rings"), never for "Pendants" or the misspelt "Earings"', () => {
  const { mapping, decisions } = proposeMapping(supplierRows(), { kit: 'jewellery', supplier: 'test', categories: CATEGORIES });
  assert.deepEqual(mapping.categories, { Rings: 'jewellery/rings', Pendants: null, Earings: null });
  assert.ok(decisions.includes('Category "Pendants": set our category path.') && decisions.includes('Category "Earings": set our category path.'));
});

const decided = () => {
  const { mapping } = proposeMapping(supplierRows(), { kit: 'jewellery', supplier: 'test', categories: CATEGORIES });
  mapping.columns.Price = { to: 'sale_price', how: 'confirmed' };
  mapping.categories.Pendants = 'jewellery/necklaces'; mapping.categories.Earings = 'jewellery/earrings';
  mapping.fixed = { manufacturer: 'Example Jewellers LLP' };
  return mapping;
};

await test('convert never fills a price, a stock figure or a category: per-size prices stay per size and the product\'s own selling price is left for a person; "In stock" stays blank; no MRP stays blank; a cost price appears nowhere', () => {
  const r = convertSupplier(supplierRows(), decided());
  const ring = r.products.find((p) => p.slug === 'classic-band-ring');
  assert.equal(ring.mrp, '28999'); assert.equal(ring.sale_price, ''); assert.equal(ring.sku, 'AR-101');
  assert.deepEqual(r.variants.filter((v) => v.product_slug === 'classic-band-ring').map((v) => [v.size, v.price_override, v.stock]), [['12', '27499', '2'], ['14', '27999', ''], ['16', '28499', '3']]);
  assert.ok(r.report.some((x) => x.column === 'stock' && x.action === 'flagged' && /"In stock" is not a number of units/.test(x.reason)));
  const ear = r.products.find((p) => p.slug === 'drop-earrings');
  assert.equal(ear.mrp, ''); assert.ok(r.report.some((x) => x.product === 'drop-earrings' && x.column === 'mrp' && x.action === 'flagged'));
  assert.equal(ear.category, 'jewellery/earrings');
  const all = JSON.stringify([r.products, r.variants, r.stones]);
  for (const cost of ['21000', '21500', '22000', '30000', '2100']) assert.ok(!all.includes(`"${cost}"`), `the cost price ${cost} is used nowhere`);
  const noTable = decided(); noTable.categories.Pendants = null;
  const r2 = convertSupplier(supplierRows(), noTable);
  assert.equal(r2.products.find((p) => p.slug === 'solitaire-pendant').category, undefined);
  assert.ok(r2.report.some((x) => x.product === 'solitaire-pendant' && x.column === 'category' && /left blank/.test(x.reason)));
  assert.throws(() => convertSupplier(supplierRows(), { ...decided(), fixed: { stock: '5' } }), /never filled from a fixed value/);
  assert.throws(() => convertSupplier(supplierRows(), { ...decided(), fixed: { mrp: '999' } }), /never filled from a fixed value/);
});

await test('convert: what it converts, it reports — "₹27,499.00" → 27499, "3 pcs" → 3, "Out of stock" → 0, "2150 mg" → 2.15 g, "22KT" → 916, "18K Rose Gold" → gold, 750, Rose gold, "Free Size" → One size, "CZ" → cubic zirconia (simulant), HTML out of a name; the nameless row skipped', () => {
  const r = convertSupplier(supplierRows(), decided());
  const pendant = r.products.find((p) => p.slug === 'solitaire-pendant');
  assert.deepEqual([pendant.metal, pendant.purity, pendant.sale_price, pendant.mrp, pendant.making_charge_type, pendant.making_charge_value, pendant.country_of_origin, pendant.manufacturer], ['gold', '750', '38999', '42999', 'percent', '10', 'IN', 'Example Jewellers LLP']);
  assert.deepEqual(r.variants.find((v) => v.product_slug === 'solitaire-pendant'), { product_slug: 'solitaire-pendant', size: 'One size', colour: 'Rose gold', colour_hex: '', sku: 'AP-205-OS', stock: '3', price_override: '', is_active: 'yes', gross_weight_g: '2.15', net_metal_weight_g: '2.1', sort_order: '0' });
  assert.deepEqual(r.stones.map((s) => [s.product_slug, s.stone, s.origin, s.stone_count, s.total_carat]), [['solitaire-pendant', 'diamond', 'lab_grown', '1', '0.25'], ['drop-earrings', 'cubic zirconia', 'simulant', '2', '']]);
  assert.equal(r.products.find((p) => p.slug === 'drop-earrings').name, 'Drop Earrings');
  assert.equal(r.variants.find((v) => v.product_slug === 'drop-earrings').stock, '0');
  assert.ok(r.report.some((x) => x.action === 'skipped' && /No product name/.test(x.reason)));
  for (const [column, re] of [['sale_price', /"₹27,499\.00" → 27499/], ['stock', /"3 pcs" → 3/], ['gross_weight_g', /"2150 mg" → 2\.15 g/], ['purity', /"22KT" → 916/], ['size', /"Free Size" → One size/]]) {
    assert.ok(r.report.some((x) => x.column === column && x.action === 'converted' && re.test(x.reason)), `${column} ${re}`);
  }
  assert.deepEqual(r.images.map((i) => i.file_name), ['classic-band-ring-1.jpg', 'classic-band-ring-2.jpg', 'solitaire-pendant-1.webp']);
});

await test('a supplier\'s mapping is kept: proposing again for their next file keeps every edit, and only a new column gets a fresh proposal', () => {
  const previous = decided();
  previous.columns.Notes = { to: null, how: 'confirmed', note: 'owner: drop' };
  const nextFile = readCsvBuffer(Buffer.from(SUPPLIER.replace('Cost Price,Notes', 'Cost Price,Notes,Care').replace(/\n/g, ',\n').replace(/,\n$/, '\n'), 'utf8'));
  const { mapping } = proposeMapping(nextFile, { kit: 'jewellery', supplier: 'test', categories: CATEGORIES, previous });
  assert.deepEqual(mapping.columns.Price, { to: 'sale_price', how: 'confirmed' });
  assert.equal(mapping.categories.Pendants, 'jewellery/necklaces');
  assert.deepEqual(mapping.fixed, { manufacturer: 'Example Jewellers LLP' });
  assert.ok(mapping.columns.Care, 'the new column is proposed');
});

await test('.xlsx: the same sheet read from a workbook (shared strings, inline strings, numbers, a deflated part, a blank row) gives the same cells as the CSV, and keeps Excel\'s row numbers', () => {
  const rows = supplierRows();
  const shared = [...new Set(rows.flat().filter((v) => v !== '' && !/^\d+(\.\d+)?$/.test(v)))];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const col = (i) => String.fromCharCode(65 + (i % 26)).padStart(i >= 26 ? 2 : 1, 'A');
  let r = 0;
  const sheetRows = rows.map((cells) => {
    r += 1; if (r === 7) r += 1;                                        // a blank spreadsheet row between the data
    return `<row r="${r}">${cells.map((v, i) => (v === '' ? '' : /^\d+(\.\d+)?$/.test(v) ? `<c r="${col(i)}${r}"><v>${v}</v></c>`
      : i === 2 ? `<c r="${col(i)}${r}" t="inlineStr"><is><t>${esc(v)}</t></is></c>` : `<c r="${col(i)}${r}" t="s"><v>${shared.indexOf(v)}</v></c>`)).join('')}</row>`;
  }).join('');
  const parts = {
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Stock" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst>${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  const locals = [], central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const raw = Buffer.from(text, 'utf8'), deflate = name.endsWith('sheet1.xml'), body = deflate ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name), crc = crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const head = Buffer.alloc(46); head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(deflate ? 8 : 0, 10);
    head.writeUInt32LE(crc, 16); head.writeUInt32LE(body.length, 20); head.writeUInt32LE(raw.length, 24); head.writeUInt16LE(nameBuf.length, 28); head.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body); central.push(head, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(parts).length, 8); end.writeUInt16LE(Object.keys(parts).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const file = join(tmp, 'stock.xlsx');
  writeFileSync(file, Buffer.concat([...locals, cd, end]));
  const fromXlsx = readSheetFile(file);
  assert.deepEqual(fromXlsx.map((row) => [...row].map(String).concat(Array(Math.max(0, rows[0].length - row.length)).fill('')).slice(0, rows[0].length)), rows.map((row) => row.slice(0, rows[0].length)));
  assert.deepEqual(fromXlsx.map((row) => row.rowNumber), [1, 2, 3, 4, 5, 6, 8], 'Excel\'s own row numbers, the blank row skipped');
  assert.throws(() => readSheetFile(file, { sheet: 'Nope' }), /No sheet named "Nope"\. The workbook has: Stock\./);
});

await test('a CSV not saved as UTF-8 is refused with the fix, not imported as "�"', () => {
  assert.throws(() => readCsvBuffer(Buffer.from('name\nCaf\xe9 Tote\n', 'latin1'), 'supplier.csv'), /not UTF-8 .* CSV UTF-8/);
});

await test('the CLI: validate exits 1 on the templates (their example rows) and 0 on a clean kit; map and convert write only into catalogue-work.local/', () => {
  const dir = join(tmp, 'cli');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'cats.csv'), 'path,name\nbags-accessories,Bags & Accessories\nclothing/men/mens-shirts,Shirts\nclothing/women,Women\n');
  const run = (...a) => spawnSync(process.execPath, [join(KIT, 'kit.mjs'), ...a], { cwd: ROOT, encoding: 'utf8' });
  const onTemplates = run('validate', '--kit', 'fashion', '--products', join(KIT, 'templates/fashion-products.csv'), '--variants', join(KIT, 'templates/fashion-variants.csv'), '--categories', join(dir, 'cats.csv'));
  assert.equal(onTemplates.status, 1); assert.match(onTemplates.stdout, /This is an example row from the template/);
  writeFileSync(join(dir, 'p.csv'), template('fashion-products.csv').replace(/example-/g, 'real-'));
  writeFileSync(join(dir, 'v.csv'), template('fashion-variants.csv').replace(/example-/g, 'real-'));
  const clean = run('validate', '--kit', 'fashion', '--products', join(dir, 'p.csv'), '--variants', join(dir, 'v.csv'), '--companies', join(KIT, 'templates/companies.csv'), '--categories', join(dir, 'cats.csv'));
  assert.equal(clean.status, 0, clean.stdout); assert.match(clean.stdout, /Ready to import\./);
  assert.equal(run('validate', '--kit', 'fashion', '--products', join(dir, 'p.xlsx')).status, 1);
  writeFileSync(join(dir, 'supplier.csv'), SUPPLIER);
  const supplier = `kit-suite-${process.pid}`;
  try {
    assert.equal(run('map', '--kit', 'jewellery', '--supplier', supplier, '--in', join(dir, 'supplier.csv')).status, 0);
    const mappingPath = join(ROOT, 'catalogue-work.local', supplier, 'mapping.json');
    const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
    mapping.columns.Price = { to: 'sale_price', how: 'confirmed' };
    writeFileSync(mappingPath, JSON.stringify(mapping));
    const convert = run('convert', '--supplier', supplier, '--in', join(dir, 'supplier.csv'));
    assert.equal(convert.status, 0, convert.stderr);
    for (const f of ['products.csv', 'variants.csv', 'stones.csv', 'images.csv', 'report.md', 'report.csv']) assert.ok(readFileSync(join(ROOT, 'catalogue-work.local', supplier, 'out', f), 'utf8').length > 0, f);
    const ignored = spawnSync('git', ['check-ignore', '-q', join('catalogue-work.local', supplier, 'out', 'products.csv')], { cwd: ROOT });
    assert.equal(ignored.status, 0, 'git ignores catalogue-work.local/');
    assert.match(readFileSync(resolve(ROOT, '.vercelignore'), 'utf8'), /^\*\.local$/m, 'Vercel ignores *.local');
    assert.notEqual(run('map', '--kit', 'jewellery', '--supplier', '../escape', '--in', join(dir, 'supplier.csv')).status, 0, 'a supplier name cannot leave catalogue-work.local/');
  } finally { rmSync(join(ROOT, 'catalogue-work.local', supplier), { recursive: true, force: true }); }
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
