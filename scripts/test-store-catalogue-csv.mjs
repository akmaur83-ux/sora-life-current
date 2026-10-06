// ============================================================
// Store catalogue admin — CSV bulk import (products and variants).
//
//   node scripts/test-store-catalogue-csv.mjs
//
// Offline (catalogue-admin-harness.mjs). The wellness import's rules, pinned
// for the catalogue:
//   * plan, then apply — planning writes nothing; a clean export re-imports
//     as zero changes
//   * a blank cell leaves the field alone, never clears it
//   * fill-only by default: a field that has a value is kept and reported;
//     Overwrite is explicit
//   * each cell is read by the editor's own field rule, then the row as it
//     would be written is validated whole; a bad row is skipped with its
//     reason, never half-applied; one product twice in a file is not guessed
//   * apply goes through the editor's save — slug/SKU checks and the
//     stale-write guard included; a row changed since planning fails alone
//   * new products only when asked, and only as drafts
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import {
  createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, openPage,
  buttonByText, findAll, textOf,
} from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
async function setup(store = 'fashion', fixtures = catalogueFixtures()) {
  const db = createCatalogueDb(fixtures);
  const mods = await loadCatalogueAdmin({ supabase: db.supabase });
  const products = await mods.api.listStoreProducts(store);
  const categories = await mods.api.listStoreCategories(store);
  return { db, ...mods, store, products, categories, row: (id) => db.db().catalogue_products.find((p) => p.id === id) };
}
const lines = (...rows) => rows.join('\n');

console.log('\n— Planning —');

await test('a clean export re-imports as nothing to do (products and variants), and planning writes nothing', async () => {
  for (const store of ['fashion', 'homeliving', 'grocery']) {
    const s = await setup(store);
    const products = s.csv.planProductImport(s.csv.productsToCsv(s.products, s.categories), { store, products: s.products, categories: s.categories, overwrite: true });
    assert.equal(products.ok, true);
    assert.deepEqual([products.changes.length, products.kept.length, products.skipped.length], [0, 0, 0], `${store} products`);
    const variants = s.csv.planVariantImport(s.csv.variantsToCsv(s.products), { store, products: s.products, overwrite: true });
    assert.deepEqual([variants.changes.length, variants.kept.length, variants.skipped.length], [0, 0, 0], `${store} variants`);
    assert.equal(s.db.writes().length, 0);
  }
  const s = await setup('fashion');
  const csv = s.csv.productsToCsv(s.products, s.categories);
  assert.ok(csv.startsWith('﻿id,slug,name,brand,category,'), 'a BOM, so a spreadsheet keeps ₹ and ×');
  assert.match(csv, /fp-linen,linen-shirt,Linen Shirt,SORA LIFE,clothing\/shirts,/, 'category as its slug path');
});

await test('a blank cell leaves the field alone; an empty field fills without Overwrite', async () => {
  const s = await setup('homeliving');
  const plan = s.csv.planProductImport(lines('slug,hsn_code,gst_rate,description', 'botanical-bedsheet-set-king,6302 10,12,', 'bath-towel-set-pack-of-2,,,'), { store: 'homeliving', products: s.products, categories: s.categories });
  assert.equal(plan.changes.length, 1);
  const [c] = plan.changes;
  assert.equal(c.kind, 'update'); assert.equal(c.line, 2);
  assert.deepEqual(c.diffs.map((d) => [d.field, d.after]), [['hsn_code', '630210'], ['gst_rate', 12]], 'read by the editor\'s rules; the blank description is not touched');
  assert.equal(c.input.description, 'Botanical Bedsheet Set.', 'the description stays');
});

await test('fill-only: a field with a value is kept and reported; Overwrite changes it', async () => {
  const s = await setup('fashion');
  const csv = lines('slug,mrp,stock,brand', 'linen-shirt,"₹1,199",25,');
  const fill = s.csv.planProductImport(csv, { store: 'fashion', products: s.products, categories: s.categories });
  assert.equal(fill.changes.length, 0);
  assert.equal(fill.kept.length, 1);
  assert.deepEqual(fill.kept[0].diffs.map((d) => [d.field, d.before, d.after, d.skipped]), [['mrp', 1299, 1199, true], ['stock', 10, 25, true]]);
  const over = s.csv.planProductImport(csv, { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.deepEqual(over.changes[0].diffs.map((d) => [d.field, d.after]), [['mrp', 1199], ['stock', 25]], '"₹1,199" reads as 1199');
  assert.equal(s.csv.describeDiff(over.changes[0].diffs[0]), 'MRP: 1299 → 1199');
});

await test('only what will be written is validated: a kept MRP cannot fail the row, an applied one can', async () => {
  const s = await setup('fashion');
  const csv = lines('slug,mrp', 'linen-shirt,899');                 // sale price is 999
  const fill = s.csv.planProductImport(csv, { store: 'fashion', products: s.products, categories: s.categories });
  assert.equal(fill.skipped.length, 0, 'fill-only keeps the MRP, so the row is fine');
  const over = s.csv.planProductImport(csv, { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.deepEqual(over.skipped, [{ line: 2, key: 'linen-shirt', reason: 'Selling price cannot be more than the MRP (₹899).' }]);
  const bad = s.csv.planProductImport(lines('slug,hsn_code,is_new,stock', 'linen-shirt,63021,maybe,-1'), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.equal(bad.changes.length, 0);
  assert.equal(bad.skipped[0].reason, 'HSN code must be 4, 6 or 8 digits. Stock must be a whole number, 0 or more. New arrival: use yes or no.');
});

await test('categories by path (slug or name); an unknown one is explained', async () => {
  const s = await setup('fashion');
  for (const path of ['clothing/dresses', 'Clothing / Dresses', ' CLOTHING/DRESSES ']) {
    const plan = s.csv.planProductImport(lines('slug,category', `linen-shirt,${path}`), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
    assert.equal(plan.changes[0].input.category_id, 'fc-dresses', path);
    assert.equal(s.csv.describeDiff(plan.changes[0].diffs[0], s.categories), 'Category: clothing/shirts → clothing/dresses');
  }
  const unknown = s.csv.planProductImport(lines('slug,category', 'linen-shirt,shirts'), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.match(unknown.skipped[0].reason, /^Category "shirts" is not a Fashion category — use the path from the export, e\.g\. "clothing\/shirts"\.$/);
});

await test('new products only when asked, only as drafts, and only when complete', async () => {
  const s = await setup('fashion');
  const csv = lines('slug,name,category,mrp,sale_price,stock', 'oxford-shirt,Oxford Shirt,clothing/shirts,1499,1299,8', 'no-price,No Price,clothing/shirts,,,');
  const off = s.csv.planProductImport(csv, { store: 'fashion', products: s.products, categories: s.categories });
  assert.equal(off.changes.length, 0);
  assert.match(off.skipped[0].reason, /Tick "Create new products" to add it as a draft\./);
  const on = s.csv.planProductImport(csv, { store: 'fashion', products: s.products, categories: s.categories, create: true });
  assert.equal(on.changes.length, 1);
  assert.equal(on.changes[0].kind, 'create'); assert.equal(on.changes[0].input.is_active, false);
  assert.deepEqual(on.skipped.map((x) => [x.line, x.reason]), [[3, 'Enter an MRP of at least ₹0.01.']]);
});

await test('one product twice in a file is not guessed between; slug and SKU clashes are refused', async () => {
  const s = await setup('fashion');
  const twice = s.csv.planProductImport(lines('slug,brand', 'linen-shirt,A', 'linen-shirt,B'), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.equal(twice.changes.length, 0);
  assert.deepEqual(twice.skipped.map((x) => x.reason), ['This product appears more than once in the file (lines 2, 3).', 'This product appears more than once in the file (lines 2, 3).']);
  const slugClash = s.csv.planProductImport(lines('id,slug', 'fp-linen,wrap-dress'), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.deepEqual(slugClash.skipped.map((x) => x.reason), ['Another product would have the slug "wrap-dress".']);
  const skuClash = s.csv.planProductImport(lines('slug,sku', 'wrap-dress,AW-LIN-SHIRT'), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.deepEqual(skuClash.skipped.map((x) => x.reason), ['Another product would have the SKU "AW-LIN-SHIRT".']);
  // Swapping two SKUs in one file is fine: the check is on the catalogue as it will be once the file applies.
  const swap = s.csv.planProductImport(lines('slug,sku', 'linen-shirt,AW-WRAP', 'wrap-dress,AW-LIN-SHIRT'), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.equal(swap.skipped.length, 0); assert.equal(swap.changes.length, 2);
});

await test('the file is checked before anything: a key column, and columns it will not import are named', async () => {
  const s = await setup('fashion');
  assert.equal(s.csv.planProductImport(lines('name,mrp', 'X,1'), { store: 'fashion', products: s.products, categories: s.categories }).reason, 'The file needs a "slug" or "id" column to match products on.');
  assert.equal(s.csv.planProductImport('', { store: 'fashion', products: s.products, categories: s.categories }).reason, 'The file is empty.');
  const plan = s.csv.planProductImport(lines('slug,images,is_active,discount_percent', 'linen-shirt,x,no,5'), { store: 'fashion', products: s.products, categories: s.categories, overwrite: true });
  assert.deepEqual(plan.ignored, ['images', 'is_active', 'discount_percent'], 'publishing, images and derived fields are not import columns');
  assert.equal(plan.changes.length, 0);
});

console.log('\n— Applying —');

await test('apply writes each row through the editor\'s save; a row changed since planning fails alone, the others land', async () => {
  const s = await setup('homeliving');
  const plan = s.csv.planProductImport(lines('slug,hsn_code,gst_rate', 'botanical-bedsheet-set-king,6302,12', 'bath-towel-set-pack-of-2,6302,12'), { store: 'homeliving', products: s.products, categories: s.categories });
  assert.equal(plan.changes.length, 2);
  // Another admin edits the towel set after the plan was made.
  const towel = await s.api.getStoreProduct('homeliving', 'hp-towel');
  await s.api.saveStoreProduct('homeliving', 'hp-towel', { ...towel, description: 'Edited meanwhile.' }, towel.updated_at);
  const progress = [];
  const { done, failed } = await s.api.applyCatalogueImport('homeliving', plan, (n, total) => progress.push(`${n}/${total}`));
  assert.deepEqual(done.map((c) => c.slug), ['botanical-bedsheet-set-king']);
  assert.deepEqual(failed, [{ line: 3, key: 'bath-towel-set-pack-of-2', reason: 'Changed since this file was planned — choose the file again to plan against the current values.' }]);
  assert.deepEqual(progress, ['1/2', '2/2']);
  assert.equal(s.row('hp-botanical').hsn_code, '6302');
  assert.equal(s.row('hp-towel').hsn_code, null, 'the stale row was not written');
  assert.equal(s.row('hp-towel').description, 'Edited meanwhile.', 'and the other admin\'s edit survives');
});

await test('a created product lands as a draft in its category', async () => {
  const s = await setup('fashion');
  const plan = s.csv.planProductImport(lines('slug,name,brand,category,mrp,sale_price,hsn_code,gst_rate', 'oxford-shirt,Oxford Shirt,Atelier,clothing/shirts,1499,1299,6205,5'), { store: 'fashion', products: s.products, categories: s.categories, create: true });
  const { done, failed } = await s.api.applyCatalogueImport('fashion', plan);
  assert.equal(failed.length, 0); assert.equal(done.length, 1);
  const created = s.db.db().catalogue_products.find((p) => p.slug === 'oxford-shirt');
  assert.deepEqual([created.store, created.is_active, created.category_id, created.mrp, created.sale_price, created.hsn_code, created.gst_rate], ['fashion', false, 'fc-shirts', 1499, 1299, '6205', 5]);
});

console.log('\n— Variants —');

await test('variants match on product slug + size + colour; stock updates need Overwrite; new sizes when asked', async () => {
  const s = await setup('fashion');
  const csv = lines('product_slug,size,colour,stock,sku', 'linen-shirt,M,Sage,30,', 'linen-shirt,XL,Sage,7,AW-LIN-XL-SAGE', 'linen-shirt,S,,2,', 'no-such-shirt,M,Sage,1,');
  const fill = s.csv.planVariantImport(csv, { store: 'fashion', products: s.products });
  assert.equal(fill.changes.length, 0);
  assert.deepEqual(fill.kept.map((c) => c.label), ['linen-shirt · M / Sage']);
  const plan = s.csv.planVariantImport(csv, { store: 'fashion', products: s.products, overwrite: true, create: true });
  assert.deepEqual(plan.changes.map((c) => [c.kind, c.label]), [['update', 'linen-shirt · M / Sage'], ['create', 'linen-shirt · XL / Sage']]);
  assert.deepEqual(plan.skipped.map((x) => [x.line, x.reason]), [[4, 'Enter a colour. Use “Default” for a single option.'], [5, 'No Fashion product has the slug "no-such-shirt".']]);
  const { failed } = await s.api.applyCatalogueImport('fashion', plan);
  assert.equal(failed.length, 0);
  const variants = s.db.db().catalogue_variants.filter((v) => v.product_id === 'fp-linen');
  assert.equal(variants.find((v) => v.id === 'fv-m').stock, 30);
  assert.equal(variants.find((v) => v.size === 'XL').sku, 'AW-LIN-XL-SAGE');
});

await test('a variant SKU already used — in this store at planning, in any store at apply — is refused', async () => {
  const s = await setup('homeliving');
  const local = s.csv.planVariantImport(lines('product_slug,size,colour,sku', 'percale-sheet-set,King,Ivory,HL-PERC-Q-IV'), { store: 'homeliving', products: s.products, overwrite: true });
  assert.match(local.skipped[0].reason, /Another variant already has the SKU "HL-PERC-Q-IV"\. Variant SKUs are unique across every store\./);
  const other = s.csv.planVariantImport(lines('product_slug,size,colour,stock,sku', 'percale-sheet-set,Single,Ivory,2,AW-LIN-M-SAGE'), { store: 'homeliving', products: s.products, create: true });
  assert.equal(other.changes.length, 1, 'the plan cannot see other stores');
  const { failed } = await s.api.applyCatalogueImport('homeliving', other);
  assert.match(failed[0].reason, /already used by another variant \(fashion store\)/);
});

console.log('\n— The page —');

const csvFile = (name, text) => ({ name, text: async () => text });
await test('choose a file, read the plan, flip fill-only, apply after confirming — and the result stays on screen', async () => {
  const { handle, store: db, win } = await openPage({ params: { store: 'homeliving' }, search: 'tab=import' });
  const input = findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'file')[0];
  await handle.act(() => input.props.onChange({ target: { files: [csvFile('hl.csv', lines('slug,hsn_code,mrp', 'botanical-bedsheet-set-king,6302,1799', 'unknown-slug,6302,'))], value: 'x' } }));
  assert.match(handle.text(), /hl\.csv — 1 to update · 0 to create · 0 kept by fill-only · 1 skipped/);
  assert.match(handle.text(), /HSN code: \(empty\) → 6302/);
  assert.match(handle.text(), /MRP: 1899 → 1799 — kept \(fill-only\)/);
  assert.match(handle.text(), /Line 3 \(unknown-slug\): No product in this store has this slug\./);
  const overwrite = findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'checkbox')[0];
  await handle.act(() => overwrite.props.onChange({ target: { checked: true } }));
  assert.doesNotMatch(handle.text(), /kept \(fill-only\)/);
  win.answer = false;
  await handle.act(() => buttonByText(handle.tree, 'Apply 1 change').props.onClick());
  assert.equal(db.writes().length, 0, 'declining the confirmation writes nothing');
  assert.match(win.asked[0], /EXISTING VALUES WILL BE OVERWRITTEN\./);
  win.answer = true;
  await handle.act(() => buttonByText(handle.tree, 'Apply 1 change').props.onClick());
  const row = db.db().catalogue_products.find((p) => p.id === 'hp-botanical');
  assert.deepEqual([row.hsn_code, row.mrp], ['6302', 1799]);
  assert.match(textOf(findAll(handle.tree, (n) => n.props?.role === 'status')[0]), /^1 products updated, 0 created\.$/);
  assert.ok(!findAll(handle.tree, (n) => n.type === 'button' && /^Apply/.test(textOf(n))).length, 'the applied plan is cleared');
});

await test('the variants file is its own tab of the importer', async () => {
  const { handle, store: db } = await openPage({ params: { store: 'fashion' }, search: 'tab=import' });
  await handle.act(() => buttonByText(handle.tree, 'Sizes & colours (variants)').props.onClick());
  assert.match(handle.text(), /Rows are matched on product_slug, size and colour\./);
  assert.ok(buttonByText(handle.tree, 'Export current variants (CSV)'));
  const input = findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'file')[0];
  await handle.act(() => input.props.onChange({ target: { files: [csvFile('v.csv', lines('product_slug,size,colour,colour_hex', 'linen-shirt,L,Sage,#B0B890'))], value: '' } }));
  assert.match(handle.text(), /1 row where every change was kept by fill-onlyLine 2 \(linen-shirt · L \/ Sage\): Colour hex: #A9B48C → #B0B890/);
  assert.equal(db.writes().length, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
