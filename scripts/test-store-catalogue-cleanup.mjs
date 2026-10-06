// ============================================================
// Store catalogue admin — variant delete, the published/draft filter, and
// "delete demo rows" per store.
//
//   node scripts/test-store-catalogue-cleanup.mjs
//
// Offline (catalogue-admin-harness.mjs: the 0033–0035 foreign keys as the
// database applies them — products cascade to variants and images, a
// category delete sets its products' category to NULL, a parent category
// cannot go before its children). Pinned:
//   * a variant delete carries the version the admin saw; a published
//     Fashion product keeps one active variant
//   * the list filters on published / drafts and marks demo rows
//   * demo delete removes the demo products (with variants and images) and
//     only those demo categories with nothing real in or under them; every
//     category kept is named with its reason; real rows and other stores are
//     byte-identical afterwards; a review that no longer matches the
//     catalogue deletes nothing
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
async function apiOver(fixtures = catalogueFixtures(), opts = {}) {
  const store = createCatalogueDb(fixtures, opts);
  return { store, ...(await loadCatalogueAdmin({ supabase: store.supabase })) };
}
const snapshot = (store, keep) => Object.fromEntries(Object.entries(store.db()).map(([t, rows]) => [t, structuredClone(rows.filter((r) => keep(t, r)))]));

console.log('\n— Variant delete —');

await test('a variant is deleted with the version the admin saw; a stale or missing version deletes nothing', async () => {
  const { api, store } = await apiOver();
  const product = await api.getStoreProduct('homeliving', 'hp-percale');
  const queen = product.variants.find((v) => v.id === 'hv-queen');
  await api.saveStoreVariant('homeliving', 'hp-percale', 'hv-queen', { ...queen, stock: 9 }, queen.updated_at);   // moved since
  await assert.rejects(api.deleteStoreVariant('homeliving', 'hp-percale', 'hv-queen', queen.updated_at), (e) => e.isStaleWrite && /changed elsewhere/.test(e.message));
  await assert.rejects(api.deleteStoreVariant('homeliving', 'hp-percale', 'hv-queen'), (e) => e.isStaleWrite);
  assert.ok(store.db().catalogue_variants.some((v) => v.id === 'hv-queen'));
  const fresh = (await api.getStoreProduct('homeliving', 'hp-percale')).variants.find((v) => v.id === 'hv-queen');
  await api.deleteStoreVariant('homeliving', 'hp-percale', 'hv-queen', fresh.updated_at);
  assert.ok(!store.db().catalogue_variants.some((v) => v.id === 'hv-queen'));
  await assert.rejects(api.deleteStoreVariant('homeliving', 'hp-percale', 'hv-queen', fresh.updated_at), (e) => e.isStaleWrite && /no longer on the product/.test(e.message));
});

await test('a published Fashion product keeps one active variant; Home & Living may drop to product-level stock', async () => {
  const { api, store } = await apiOver();
  const linen = await api.getStoreProduct('fashion', 'fp-linen');
  await api.deleteStoreVariant('fashion', 'fp-linen', 'fv-l', linen.variants.find((v) => v.id === 'fv-l').updated_at);
  const m = (await api.getStoreProduct('fashion', 'fp-linen')).variants[0];
  await assert.rejects(api.deleteStoreVariant('fashion', 'fp-linen', 'fv-m', m.updated_at), /needs at least one active size\/colour/);
  assert.ok(store.db().catalogue_variants.some((v) => v.id === 'fv-m'));
  const percale = await api.getStoreProduct('homeliving', 'hp-percale');
  for (const v of percale.variants) await api.deleteStoreVariant('homeliving', 'hp-percale', v.id, v.updated_at);
  assert.equal(store.db().catalogue_variants.filter((v) => v.product_id === 'hp-percale').length, 0);
});

await test('a session that is not an admin deletes nothing and is told so', async () => {
  const { api, store } = await apiOver();
  const p = await api.getStoreProduct('homeliving', 'hp-percale');
  store.session.admin = false;
  await assert.rejects(api.deleteStoreVariant('homeliving', 'hp-percale', 'hv-king', p.variants.find((v) => v.id === 'hv-king').updated_at), (e) => e.isRefused);
  assert.equal(store.db().catalogue_variants.length, 4);
});

await test('page: Delete asks first, says what happens to carts and orders, and declining keeps the variant', async () => {
  const { handle, store, win } = await openPage({ params: { store: 'homeliving', productId: 'hp-percale' } });
  const rowOf = (size) => findAll(handle.tree, (n) => n.type === 'tr' && findAll(n, (td) => td.type === 'td' && textOf(td) === size).length)[0];
  win.answer = false;
  await handle.act(() => buttonByText(rowOf('Queen'), 'Delete').props.onClick());
  assert.equal(store.db().catalogue_variants.filter((v) => v.product_id === 'hp-percale').length, 2);
  assert.match(win.asked[0], /^Delete the Queen \/ Ivory variant\? This cannot be undone\./);
  assert.match(win.asked[0], /Carts holding it will show it as no longer sold, and checkout will refuse it\. Past orders keep their own copy\./);
  assert.match(win.asked[0], /untick "Active variant"/);
  win.answer = true;
  await handle.act(() => buttonByText(rowOf('Queen'), 'Delete').props.onClick());
  assert.deepEqual(store.db().catalogue_variants.filter((v) => v.product_id === 'hp-percale').map((v) => v.size), ['King']);
  assert.match(handle.text(), /Variant Queen \/ Ivory deleted\./);
  assert.ok(!rowOf('Queen'));
});

console.log('\n— The list —');

await test('the list filters on published or drafts, and marks demo rows', async () => {
  const names = (h) => findAll(h.tree, (n) => n.type === 'tbody').flatMap((b) => findAll(b, (n) => n.type === 'strong').map(textOf));
  const all = await openPage({ params: { store: 'fashion' } });
  assert.deepEqual(names(all.handle), ['Linen Shirt', 'Wrap Dress']);
  const published = await openPage({ params: { store: 'fashion' }, search: 'status=published' });
  assert.deepEqual(names(published.handle), ['Linen Shirt']);
  assert.match(published.handle.text(), /1 of 2 products · published only/);
  const drafts = await openPage({ params: { store: 'fashion' }, search: 'status=draft' });
  assert.deepEqual(names(drafts.handle), ['Wrap Dress']);
  const select = findAll(all.handle.tree, (n) => n.type === 'select' && findAll(n, (o) => o.type === 'option' && textOf(o) === 'Drafts only').length)[0];
  await all.handle.act(() => select.props.onChange({ target: { value: 'draft' } }));
  assert.equal(all.router.search.get('status'), 'draft');
  assert.deepEqual(names(all.handle), ['Wrap Dress']);
  const statusCell = findAll(all.handle.tree, (n) => n.type === 'td' && /^Draft/.test(textOf(n)))[0];
  assert.equal(textOf(statusCell), 'DraftDemo');
});

console.log('\n— Demo rows —');

await test('the plan: demo products go; a demo category goes only when nothing real is in or under it, deepest first', async () => {
  const { rules } = await apiOver();
  const f = catalogueFixtures();
  const hl = rules.planDemoDelete(f.catalogue_categories.filter((c) => c.store === 'homeliving'), f.catalogue_products.filter((p) => p.store === 'homeliving'));
  assert.deepEqual(hl.products.map((p) => p.name), ['Botanical Bedsheet Set', 'Bath Towel Set']);
  assert.deepEqual(hl.categories.map((c) => c.name), ['Rugs & Mats', 'Towels']);
  assert.deepEqual(hl.keptCategories, [{ id: 'hc-bedsheets', name: 'Bedsheets', reasons: ['1 real product is filed in it: “Percale Sheet Set”'] }]);
  // A tree: demo root → demo child → demo grandchild; a real product deep down keeps all three.
  const cat = (id, parent_id, is_demo = true) => ({ id, name: id, slug: id, parent_id, is_demo, is_active: true });
  const tree = [cat('root', null), cat('child', 'root'), cat('leaf', 'child'), cat('empty', 'root'), cat('real', null, false), cat('demo-under-real', 'real')];
  const deep = rules.planDemoDelete(tree, [{ id: 'p', name: 'Real', category_id: 'leaf', is_demo: false }]);
  assert.deepEqual(deep.categories.map((c) => [c.name, c.depth]), [['demo-under-real', 2], ['empty', 2]], 'children first');
  assert.deepEqual(deep.keptCategories.map((k) => [k.name, k.reasons[0]]), [
    ['root', '1 real product is filed in it or under it: “Real”'], ['child', '1 real product is filed in it or under it: “Real”'], ['leaf', '1 real product is filed in it: “Real”'],
  ]);
  const realChild = rules.planDemoDelete([cat('top', null), cat('kept-real', 'top', false)], []);
  assert.deepEqual(realChild.keptCategories[0].reasons, ['it holds the real category “kept-real”']);
});

await test('delete: exactly the planned rows go; every real row and every other store is byte-identical', async () => {
  const { api, store } = await apiOver();
  const isHL = (t, r) => r.store === 'homeliving' || (t === 'catalogue_product_media' && r.product_id.startsWith('hp-'));
  const untouched = (t, r) => !isHL(t, r) || r.is_demo === false || (t === 'catalogue_product_media' && r.product_id === 'hp-percale');
  const before = snapshot(store, untouched);
  const reviewed = await api.previewStoreDemoDelete('homeliving');
  const summary = await api.deleteStoreDemoRows('homeliving', reviewed);
  assert.deepEqual([summary.products, summary.variants, summary.images, summary.categories], [2, 0, 2, 2]);
  assert.deepEqual(summary.kept.map((k) => k.name), ['Bedsheets']);
  assert.deepEqual(snapshot(store, untouched), before, 'real rows (Percale, its variants and image, Bedsheets) and the other stores are untouched');
  assert.deepEqual(store.db().catalogue_products.filter((p) => p.store === 'homeliving').map((p) => p.id), ['hp-percale']);
  assert.equal(store.db().catalogue_products.find((p) => p.id === 'hp-percale').category_id, 'hc-bedsheets', 'no real product lost its category');
  assert.deepEqual(store.db().catalogue_categories.filter((c) => c.store === 'homeliving').map((c) => c.id), ['hc-bedsheets']);
  assert.ok(!store.db().catalogue_product_media.some((m) => ['hp-botanical', 'hp-towel'].includes(m.product_id)), 'their images went with them');
  // Every delete was scoped to the store and to demo rows.
  for (const w of store.writes().filter((x) => x.action === 'delete')) {
    assert.ok(w.ops.some(([op, k, v]) => op === 'eq' && k === 'store' && v === 'homeliving'));
    assert.ok(w.ops.some(([op, k, v]) => op === 'eq' && k === 'is_demo' && v === true));
  }
});

await test('grocery (all demo) empties; fashion keeps its real tree and loses only the demo dress', async () => {
  const { api, store } = await apiOver();
  await api.deleteStoreDemoRows('grocery', await api.previewStoreDemoDelete('grocery'));
  assert.equal(store.db().catalogue_products.filter((p) => p.store === 'grocery').length, 0);
  assert.equal(store.db().catalogue_categories.filter((c) => c.store === 'grocery').length, 0);
  const summary = await api.deleteStoreDemoRows('fashion', await api.previewStoreDemoDelete('fashion'));
  assert.deepEqual([summary.products, summary.categories], [1, 0]);
  assert.deepEqual(store.db().catalogue_products.filter((p) => p.store === 'fashion').map((p) => p.id), ['fp-linen']);
  assert.equal(store.db().catalogue_categories.filter((c) => c.store === 'fashion').length, 3);
});

await test('a review that no longer matches the catalogue deletes nothing — e.g. a real product filed in a demo category since', async () => {
  const { api, store } = await apiOver();
  const reviewed = await api.previewStoreDemoDelete('homeliving');            // Rugs & Mats is to go
  const percale = await api.getStoreProduct('homeliving', 'hp-percale');
  await api.saveStoreProduct('homeliving', 'hp-percale', { ...percale, category_id: 'hc-rugs' }, percale.updated_at);
  const before = structuredClone(store.db());
  await assert.rejects(api.deleteStoreDemoRows('homeliving', reviewed), (e) => e.isStaleWrite && /changed since you reviewed them\. Nothing was deleted/.test(e.message));
  assert.deepEqual(store.db(), before);
  await assert.rejects(api.deleteStoreDemoRows('homeliving', null), (e) => e.isStaleWrite);
});

await test('a session that is not an admin deletes nothing', async () => {
  const { api, store } = await apiOver();
  const reviewed = await api.previewStoreDemoDelete('homeliving');
  store.session.admin = false;
  const before = structuredClone(store.db());
  await assert.rejects(api.deleteStoreDemoRows('homeliving', reviewed));
  assert.deepEqual(store.db(), before);
});

await test('page: review lists what goes and what stays and why; delete asks first and reports', async () => {
  const { handle, store, win } = await openPage({ params: { store: 'homeliving' } });
  await handle.act(() => buttonByText(handle.tree, 'Remove demo rows…').props.onClick());
  const panel = () => findAll(handle.tree, (n) => n.props?.['aria-label'] === 'Demo rows')[0];
  const text = textOf(panel());
  assert.match(text, /2 demo products/); assert.match(text, /Botanical Bedsheet Set \(1 image\)/); assert.match(text, /2 demo categories/);
  assert.match(text, /KeptA category is never deleted while something real sits in it/);
  assert.match(text, /Bedsheets — kept: 1 real product is filed in it: “Percale Sheet Set”\./);
  win.answer = false;
  await handle.act(() => buttonByText(panel(), 'Delete these demo rows').props.onClick());
  assert.equal(store.db().catalogue_products.length, 6, 'declining deletes nothing');
  assert.equal(win.asked[0], 'Delete 2 demo products and 2 demo categories from Home & Living? This cannot be undone.');
  win.answer = true;
  await handle.act(() => buttonByText(panel(), 'Delete these demo rows').props.onClick());
  assert.match(textOf(panel()), /Deleted 2 demo products \(with 0 variants and 2 images\) and 2 demo categories\./);
  assert.ok(!findAll(handle.tree, (n) => n.type === 'tbody').some((b) => /Bath Towel Set/.test(textOf(b))), 'the list reloaded without them');
  const again = await openPage({ params: { store: 'fashion' } });
  await again.handle.act(() => buttonByText(again.handle.tree, 'Remove demo rows…').props.onClick());
  assert.match(textOf(findAll(again.handle.tree, (n) => n.props?.['aria-label'] === 'Demo rows')[0]), /1 demo productWrap Dress/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
