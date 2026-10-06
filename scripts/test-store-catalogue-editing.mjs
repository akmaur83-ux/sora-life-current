// ============================================================
// Store catalogue admin — the stale-write guard and inline errors.
//
//   node scripts/test-store-catalogue-editing.mjs
//
// Offline. The real rules, API and page run against the in-memory catalogue
// in catalogue-admin-harness.mjs (the 0033–0035 constraints, triggers and
// RLS as PostgREST presents them), and the page is driven through its own
// handlers: type, submit, read what it shows.
//
// What is pinned:
//   * an update carries the version the editor loaded and is REFUSED, not
//     applied, when the row moved — product, category and variant alike;
//     zero rows is told apart: deleted / changed elsewhere / refused by RLS
//   * the editor's own gallery write moves the product's version (the
//     images[] cache trigger) without making its next save look stale —
//     unless another admin changed the product in between
//   * every field problem is reported at once, beside its field; a slug or
//     SKU already taken is refused before the write, a variant SKU across
//     EVERY store; a raw Postgres error never reaches the admin
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import {
  createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, openPage,
  fieldByLabel, buttonByText, formOf, change, submit, findAll, textOf,
} from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
async function apiOver(fixtures = catalogueFixtures(), opts = {}) {
  const store = createCatalogueDb(fixtures, opts);
  return { store, ...(await loadCatalogueAdmin({ supabase: store.supabase })) };
}
const row = (store, table, id) => store.db()[table].find((r) => r.id === id);

console.log('\n— The stale-write guard —');

await test('a product saved elsewhere after the editor opened is refused, and the other save survives', async () => {
  const { api, store } = await apiOver();
  const opened = await api.getStoreProduct('fashion', 'fp-linen');            // admin A opens the editor
  const other = await api.getStoreProduct('fashion', 'fp-linen');             // admin B opens it too
  await api.saveStoreProduct('fashion', 'fp-linen', { ...other, description: 'B wrote this.' }, other.updated_at);
  const writesBefore = store.writes().length;
  await assert.rejects(api.saveStoreProduct('fashion', 'fp-linen', { ...opened, description: 'A wrote this.' }, opened.updated_at),
    (e) => e.isStaleWrite && /changed elsewhere/.test(e.message) && /Nothing was saved/.test(e.message));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').description, 'B wrote this.');
  const attempt = store.writes().slice(writesBefore);
  assert.equal(attempt.length, 1, 'one guarded UPDATE, nothing else');
  assert.ok(attempt[0].ops.some(([op, key, value]) => op === 'eq' && key === 'updated_at' && value === opened.updated_at), 'the UPDATE is filtered on the loaded version');
});

await test('an update with no recorded version is refused before anything is written', async () => {
  const { api, store } = await apiOver();
  const p = await api.getStoreProduct('fashion', 'fp-linen');
  await assert.rejects(api.saveStoreProduct('fashion', 'fp-linen', { ...p, name: 'Lost' }), (e) => e.isStaleWrite && /Reload/.test(e.message));
  assert.equal(store.writes().length, 0);
  assert.equal(row(store, 'catalogue_products', 'fp-linen').name, 'Linen Shirt');
});

await test('zero rows is explained: a deleted product, and an RLS-refused session, are not called "changed elsewhere"', async () => {
  const { api, store } = await apiOver();
  const p = await api.getStoreProduct('homeliving', 'hp-percale');
  store.raw.catalogue_products = store.raw.catalogue_products.filter((r) => r.id !== 'hp-percale');   // deleted meanwhile
  await assert.rejects(api.saveStoreProduct('homeliving', 'hp-percale', p, p.updated_at), (e) => e.isStaleWrite && /could not be found/.test(e.message));

  const second = await apiOver();
  const q = await second.api.getStoreProduct('fashion', 'fp-linen');
  second.store.session.admin = false;                                            // the session lost admin membership
  const before = structuredClone(second.store.db().catalogue_products);
  await assert.rejects(second.api.saveStoreProduct('fashion', 'fp-linen', { ...q, name: 'Hijack' }, q.updated_at),
    (e) => e.isRefused && !e.isStaleWrite && /not a catalogue admin/.test(e.message));
  assert.deepEqual(second.store.db().catalogue_products, before, 'nothing changed');
});

await test('categories and variants carry the same guard; a new row needs no version', async () => {
  const { api, store } = await apiOver();
  const cats = await api.listStoreCategories('fashion');
  const shirts = cats.find((c) => c.id === 'fc-shirts');
  await api.saveStoreCategory('fashion', 'fc-shirts', { ...shirts, tagline: 'Mine' }, shirts.updated_at);
  await assert.rejects(api.saveStoreCategory('fashion', 'fc-shirts', { ...shirts, tagline: 'Stale' }, shirts.updated_at), (e) => e.isStaleWrite);
  assert.equal(row(store, 'catalogue_categories', 'fc-shirts').tagline, 'Mine');
  await assert.rejects(api.saveStoreCategory('fashion', 'fc-shirts', { ...shirts, tagline: 'No version' }), (e) => e.isStaleWrite);
  const created = await api.saveStoreCategory('fashion', null, { name: 'Knitwear', parent_id: 'fc-clothing' });
  assert.equal(created.slug, 'knitwear');

  const product = await api.getStoreProduct('fashion', 'fp-linen');
  const m = product.variants.find((v) => v.id === 'fv-m');
  await api.saveStoreVariant('fashion', 'fp-linen', 'fv-m', { ...m, stock: 20 }, m.updated_at);
  await assert.rejects(api.saveStoreVariant('fashion', 'fp-linen', 'fv-m', { ...m, stock: 1 }, m.updated_at), (e) => e.isStaleWrite);
  assert.equal(row(store, 'catalogue_variants', 'fv-m').stock, 20);
  await api.saveStoreVariant('fashion', 'fp-linen', null, { size: 'S', colour: 'Sage', stock: 2 });
});

await test("the editor's own gallery write moves the version; it is adopted only if nothing editable changed", async () => {
  const { api, rules, store } = await apiOver();
  const base = await api.getStoreProduct('fashion', 'fp-linen');
  await api.saveStoreMedia('fashion', 'fp-linen', null, { public_url: '/img/fashion-hero.webp', alt_text: 'Back', sort_order: 1 });
  const fresh = await api.getStoreProduct('fashion', 'fp-linen');
  assert.notEqual(fresh.updated_at, base.updated_at, 'the images[] trigger moved the product version');
  assert.equal(rules.versionAfterOwnWrite(base, fresh), fresh.updated_at, 'only images changed: adopt');
  await api.saveStoreProduct('fashion', 'fp-linen', { ...base, description: 'After my own image.' }, rules.versionAfterOwnWrite(base, fresh));

  const again = await api.getStoreProduct('fashion', 'fp-linen');
  await api.saveStoreProduct('fashion', 'fp-linen', { ...again, name: 'Renamed by B' }, again.updated_at);   // another admin
  await api.saveStoreMedia('fashion', 'fp-linen', null, { public_url: '/img/fashion-hero.webp', sort_order: 2 });  // then my image
  const after = await api.getStoreProduct('fashion', 'fp-linen');
  assert.equal(rules.versionAfterOwnWrite(again, after), again.updated_at, 'a field changed under the editor: keep the old version');
  await assert.rejects(api.saveStoreProduct('fashion', 'fp-linen', { ...again, description: 'Would erase B' }, again.updated_at), (e) => e.isStaleWrite);
  assert.equal(row(store, 'catalogue_products', 'fp-linen').name, 'Renamed by B');
});

console.log('\n— Inline errors —');

await test('every field problem is reported at once, each against its field', async () => {
  const { rules } = await apiOver();
  const cats = catalogueFixtures().catalogue_categories.filter((c) => c.store === 'fashion');
  let caught;
  try { rules.catalogueProductPayload({ name: '', category_id: '', mrp: '0', sale_price: '5', sku: '-bad', stock: '-1', sort_order: '1.5' }, cats); } catch (e) { caught = e; }
  assert.ok(caught?.fieldErrors, 'a CatalogueInputError');
  assert.deepEqual(Object.keys(caught.fieldErrors).sort(), ['category_id', 'mrp', 'name', 'sku', 'sort_order', 'stock']);
  assert.match(caught.message, /Fix the 6 highlighted fields/);
  try { rules.catalogueProductPayload({ name: 'Shirt', category_id: 'fc-shirts', mrp: '1299', sale_price: '1400' }, cats); } catch (e) { caught = e; }
  assert.deepEqual(caught.fieldErrors, { sale_price: 'Selling price cannot be more than the MRP (₹1299).' });
});

await test('a slug or SKU another product in the store holds is refused before the write; other stores and the row itself are fine', async () => {
  const { api, store } = await apiOver();
  await assert.rejects(api.saveStoreProduct('fashion', null, { name: 'Linen Shirt', category_id: 'fc-shirts', mrp: 999, sku: 'AW-WRAP' }),
    (e) => e.fieldErrors?.slug === 'Another product in this store already uses this slug.' && e.fieldErrors?.sku === 'Another product in this store already uses this SKU.');
  assert.equal(store.writes().length, 0, 'nothing was inserted');
  const homeliving = await api.saveStoreProduct('homeliving', null, { name: 'Linen Shirt', category_id: 'hc-bedsheets', mrp: 999, sku: 'AW-WRAP' });
  assert.equal(homeliving.slug, 'linen-shirt', 'slugs and product SKUs are per store');
  const own = await api.getStoreProduct('fashion', 'fp-linen');
  await api.saveStoreProduct('fashion', 'fp-linen', { ...own, brand: 'Atelier' }, own.updated_at);   // its own slug and SKU are not a clash
});

await test('variant SKUs are unique across EVERY store (the 0033 constraint); size × colour is unique per product', async () => {
  const { api, store } = await apiOver();
  await assert.rejects(api.saveStoreVariant('homeliving', 'hp-percale', null, { size: 'Single', colour: 'Ivory', sku: 'AW-LIN-M-SAGE', stock: 1 }),
    (e) => /already used by another variant \(fashion store\)/.test(e.fieldErrors?.sku) && /unique across every store/.test(e.fieldErrors.sku));
  await assert.rejects(api.saveStoreVariant('homeliving', 'hp-percale', null, { size: 'King', colour: 'Ivory', stock: 1 }),
    (e) => e.fieldErrors?.size === 'This product already has a King / Ivory variant.');
  assert.equal(store.writes().length, 0);
  const product = await api.getStoreProduct('homeliving', 'hp-percale');
  const king = product.variants.find((v) => v.id === 'hv-king');
  await api.saveStoreVariant('homeliving', 'hp-percale', 'hv-king', { ...king, stock: 9 }, king.updated_at);   // its own SKU and size are not a clash
});

await test('a category slug is unique under one parent, not across the tree', async () => {
  const { api } = await apiOver();
  await assert.rejects(api.saveStoreCategory('fashion', null, { name: 'Shirts', parent_id: 'fc-clothing' }),
    (e) => e.fieldErrors?.slug === 'Another category under the same parent already uses this slug.');
  const top = await api.saveStoreCategory('fashion', null, { name: 'Shirts' });
  assert.equal(top.parent_id, null);
});

await test('a database refusal is translated to its field — never a raw Postgres message', async () => {
  const { rules } = await apiOver();
  const pg = (code, constraint) => ({ code, message: `duplicate key value violates unique constraint "${constraint}"` });
  const cases = [
    [pg('23505', 'catalogue_products_store_slug_key'), 'slug'], [pg('23505', 'catalogue_products_store_sku_key'), 'sku'],
    [pg('23505', 'catalogue_variants_sku_key'), 'sku'], [pg('23505', 'catalogue_variants_product_id_size_colour_key'), 'size'],
    [pg('23505', 'catalogue_categories_store_parent_slug_key'), 'slug'], [pg('23514', 'catalogue_products_hsn_code_chk'), 'hsn_code'],
    [pg('23514', 'catalogue_products_gst_rate_chk'), 'gst_rate'], [pg('23514', 'catalogue_products_sale_price_check'), 'sale_price'],
  ];
  for (const [error, field] of cases) {
    const out = rules.catalogueWriteError(error, 'product');
    assert.ok(out.fieldErrors?.[field], `${error.message} → ${field}`);
    assert.doesNotMatch(Object.values(out.fieldErrors)[0], /constraint|duplicate key/);
  }
  const rls = rules.catalogueWriteError({ code: '42501', message: 'new row violates row-level security policy for table "catalogue_products"' }, 'product');
  assert.ok(rls.isRefused); assert.doesNotMatch(rls.message, /row-level/);
  const other = new Error('Failed to fetch');
  assert.equal(rules.catalogueWriteError(other), other, 'an unknown failure passes through untouched');
  // And end to end: a slug taken between the check and the write still lands on the slug field.
  const store = createCatalogueDb(catalogueFixtures());
  const racing = { from: (t) => { const q = store.supabase.from(t); const limit = q.limit.bind(q); q.limit = (n) => { q.filters.push(() => false); return limit(n); }; return q; }, storage: store.supabase.storage };
  const { api } = await loadCatalogueAdmin({ supabase: racing });
  await assert.rejects(api.saveStoreProduct('fashion', null, { name: 'Linen Shirt', category_id: 'fc-shirts', mrp: 999 }),
    (e) => e.fieldErrors?.slug === 'Another product in this store already uses this slug.');
});

await test('the failure view puts visible fields inline and everything else in the banner', async () => {
  const { rules } = await apiOver();
  const view = rules.catalogueFailureView(new rules.CatalogueInputError({ mrp: 'Enter an MRP.', stock: 'Stock must be a whole number, 0 or more.' }), ['mrp']);
  assert.deepEqual(view.fields, { mrp: 'Enter an MRP.' });
  assert.equal(view.banner, 'Nothing was saved. Fix the highlighted field below. Stock must be a whole number, 0 or more.');
  assert.equal(rules.catalogueFailureView(new rules.CatalogueStaleWriteError('moved')).stale, true);
});

console.log('\n— The page —');

await test('product editor: a save carries the loaded version; a save after another admin\'s is refused with a reload action', async () => {
  const { handle, store, api } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
  const form = () => formOf(handle.tree, 'Linen Shirt');
  await handle.act(() => change(fieldByLabel(form(), 'Brand').control, 'Atelier Weave'));
  await handle.act(() => submit(form()));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').brand, 'Atelier Weave');
  assert.match(handle.text(), /Published\. Refresh the storefront/);
  // A second save in the same session uses the version the first one returned.
  await handle.act(() => change(fieldByLabel(form(), 'Brand').control, 'Atelier'));
  await handle.act(() => submit(form()));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').brand, 'Atelier');
  // Another admin saves; this editor's next save must not overwrite them.
  const theirs = await api.getStoreProduct('fashion', 'fp-linen');
  await api.saveStoreProduct('fashion', 'fp-linen', { ...theirs, description: 'Theirs.' }, theirs.updated_at);
  await handle.act(() => change(fieldByLabel(form(), 'Description').control, 'Mine.'));
  await handle.act(() => submit(form()));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').description, 'Theirs.');
  const banner = findAll(handle.tree, (n) => n.props?.role === 'alert')[0];
  assert.match(textOf(banner), /changed elsewhere after you opened it/);
  assert.ok(buttonByText(banner, 'Reload and discard my edits'), 'the stale banner offers the reload');
});

await test('product editor: inline errors sit beside their fields with aria wiring, and typing clears one', async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
  const form = () => formOf(handle.tree, 'Linen Shirt');
  await handle.act(() => change(fieldByLabel(form(), 'Slug').control, 'wrap-dress'));
  await handle.act(() => change(fieldByLabel(form(), 'MRP ₹').control, ''));
  await handle.act(() => change(fieldByLabel(form(), 'Product SKU (optional)').control, 'bad sku!'));
  const before = structuredClone(row(store, 'catalogue_products', 'fp-linen'));
  await handle.act(() => submit(form()));
  assert.deepEqual(row(store, 'catalogue_products', 'fp-linen'), before, 'nothing written');
  const mrp = fieldByLabel(form(), 'MRP ₹'), sku = fieldByLabel(form(), 'Product SKU (optional)');
  assert.equal(mrp.error, 'Enter an MRP of at least ₹0.01.');
  assert.match(sku.error, /^SKU must be 1–64/);
  assert.equal(mrp.control.props['aria-invalid'], true);
  const errorSpan = findAll(mrp.wrap, (n) => n.props?.id === mrp.control.props['aria-describedby'])[0];
  assert.equal(textOf(errorSpan), mrp.error, 'aria-describedby names the error');
  assert.match(textOf(findAll(handle.tree, (n) => n.props?.role === 'alert')[0]), /^Nothing was saved\. Fix the highlighted fields below\./);
  // Fix the two format errors; the slug clash is then caught before the write.
  await handle.act(() => change(fieldByLabel(form(), 'MRP ₹').control, '1299'));
  assert.equal(fieldByLabel(form(), 'MRP ₹').error, null, 'typing clears that field');
  assert.ok(fieldByLabel(form(), 'Product SKU (optional)').error, 'and only that field');
  await handle.act(() => change(fieldByLabel(form(), 'Product SKU (optional)').control, 'AW-LIN-SHIRT'));
  await handle.act(() => submit(form()));
  assert.equal(fieldByLabel(form(), 'Slug').error, 'Another product in this store already uses this slug.');
  assert.doesNotMatch(handle.text(), /duplicate key|constraint|PGRST|23505/);
});

await test('variant and category forms show their errors inline too', async () => {
  const { handle } = await openPage({ params: { store: 'homeliving', productId: 'hp-percale' } });
  const form = () => formOf(handle.tree, 'Add variant');
  await handle.act(() => change(fieldByLabel(form(), 'Size / option').control, 'Single'));
  await handle.act(() => change(fieldByLabel(form(), 'Variant SKU (optional)').control, 'AW-LIN-L-SAGE'));
  await handle.act(() => change(fieldByLabel(form(), 'Stock quantity').control, '-2'));
  await handle.act(() => submit(form()));
  assert.equal(fieldByLabel(form(), 'Stock quantity').error, 'Stock must be a whole number, 0 or more.');
  await handle.act(() => change(fieldByLabel(form(), 'Stock quantity').control, '2'));
  await handle.act(() => submit(form()));
  assert.match(fieldByLabel(form(), 'Variant SKU (optional)').error, /already used by another variant \(fashion store\)/);

  const list = await openPage({ params: { store: 'fashion' }, search: 'tab=categories' });
  await list.handle.act(() => buttonByText(list.handle.tree, '+ Add category').props.onClick());
  const cat = () => formOf(list.handle.tree, 'Add category');
  await list.handle.act(() => change(fieldByLabel(cat(), 'Category name').control, 'Shirts'));
  await list.handle.act(() => change(fieldByLabel(cat(), 'Parent category (up to 3 levels)').control, 'fc-clothing'));
  await list.handle.act(() => submit(cat()));
  assert.equal(fieldByLabel(cat(), 'Slug').error, 'Another category under the same parent already uses this slug.');
});

await test("page: the editor's own image save does not make its next product save look stale", async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
  const gallery = () => formOf(handle.tree, 'Add image');
  await handle.act(() => change(fieldByLabel(gallery(), 'Image URL').control, '/img/fashion-hero.webp'));
  await handle.act(() => submit(gallery()));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').images.length, 2);
  const form = () => formOf(handle.tree, 'Linen Shirt');
  await handle.act(() => change(fieldByLabel(form(), 'Brand').control, 'After image'));
  await handle.act(() => submit(form()));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').brand, 'After image');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
