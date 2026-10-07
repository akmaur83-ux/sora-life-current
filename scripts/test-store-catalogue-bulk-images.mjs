// ============================================================
// Store catalogue admin — bulk images: many files at once, each to the
// product its name gives (<slug>-<number>), shown as a plan before anything
// is uploaded, then added through the product editor's own gallery path.
//
//   node scripts/test-store-catalogue-bulk-images.mjs
//
// Offline (catalogue-admin-harness.mjs): the real rules, API and page over the
// in-memory catalogue and its storage, which admits admin sessions only.
// Pinned:
//   * the plan: <slug>-<number>.<webp|jpg|png> picks the product (any case),
//     numbers order the files (2 before 10); a file that names no product, has
//     no number or is not an image is reported, never guessed; two files with
//     one number, or a gallery that already has images (unless "also add" is
//     ticked), hold that product back whole
//   * the upload: number 1 is the primary of an empty gallery, the rest in
//     number order; WebPs that already fit go up as they are; only gallery rows
//     and storage objects are written — drafts stay drafts, stock is untouched;
//     a failed file does not stop the batch; a gallery that changed since the
//     plan is skipped, not added to; a non-admin writes nothing
//   * the page: the Bulk images tab shows the plan, asks before uploading and
//     reports the outcome
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import {
  createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, openPage, imageFile, findAll, textOf,
} from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}

// Two Homley-style drafts with empty galleries and no stock, beside the seeded rows
// (percale-sheet-set already has one image).
const fixtures = () => {
  const db = catalogueFixtures();
  const draft = (id, name, slug) => ({ ...db.catalogue_products.find((p) => p.id === 'hp-percale'), id, name, slug, brand: 'Homley', sku: `HMLY-${id}`, stock: 0, images: [], is_active: false });
  db.catalogue_products.push(draft('hp-sunlit', 'Sunlit Blossom Queen Bedsheet Set', 'sunlit-blossom-queen-bedsheet-set'),
    draft('hp-chevron', 'Blue Chevron Single Bedsheet Set', 'blue-chevron-single-bedsheet-set'),
    draft('hp-chevron-q', 'Blue Chevron Queen Bedsheet Set', 'blue-chevron-queen-bedsheet-set'));
  return db;
};
async function apiOver(db = fixtures(), opts = {}) {
  const store = createCatalogueDb(db, opts);
  return { store, ...(await loadCatalogueAdmin({ supabase: store.supabase })) };
}
const productsOf = (store) => store.db().catalogue_products.filter((p) => p.store === 'homeliving')
  .map((p) => ({ ...p, media: store.db().catalogue_product_media.filter((m) => m.product_id === p.id) }));
const mediaOf = (store, id) => store.db().catalogue_product_media.filter((m) => m.product_id === id).sort((a, b) => a.sort_order - b.sort_order);
const fits = (name) => imageFile(name, { width: 1600, height: 1435, type: 'image/webp', webpBytes: 140000 });
const sourceName = async (store, m) => {
  const text = await store.storage.objects.get(`product-images/${m.storage_path}`).file.text();
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).name;
};
// The owner's folder, in no particular order, with the usual strays.
const folder = () => [
  fits('sunlit-blossom-queen-bedsheet-set-2.webp'), fits('sunlit-blossom-queen-bedsheet-set-10.webp'),
  fits('sunlit-blossom-queen-bedsheet-set-1.WEBP'), imageFile('sunlit-blossom-queen-bedsheet-set-3.jpg', { detail: 0.08 }),
  fits('Blue-Chevron-Single-Bedsheet-Set-1.webp'),
  fits('percale-sheet-set-1.webp'),
  fits('blue-chevron-queen-bedsheet-set-1.webp'), imageFile('blue-chevron-queen-bedsheet-set-1.jpg', { detail: 0.08 }),
  fits('linen-shirt-1.webp'), fits('sunlit-blossom-queen-bedsheet-set.webp'), fits('review-sheet.jpg'),
  new File(['notes'], 'README.md', { type: 'text/markdown' }),
];

console.log('\n— The plan —');

await test('<slug>-<number> picks the product in any case; numbers order the files, 2 before 10', async () => {
  const { rules, store } = await apiOver();
  const plan = rules.planBulkImages(folder(), productsOf(store));
  assert.deepEqual(plan.uploads.map((u) => u.product.id), ['hp-chevron', 'hp-sunlit'], 'by product name');
  const sunlit = plan.uploads.find((u) => u.product.id === 'hp-sunlit');
  assert.deepEqual(sunlit.numbers, [1, 2, 3, 10]);
  assert.deepEqual(sunlit.files.map((f) => f.name), ['sunlit-blossom-queen-bedsheet-set-1.WEBP', 'sunlit-blossom-queen-bedsheet-set-2.webp', 'sunlit-blossom-queen-bedsheet-set-3.jpg', 'sunlit-blossom-queen-bedsheet-set-10.webp']);
  assert.equal(sunlit.existing, 0);
  assert.equal(plan.fileCount, 5);
});

await test('the rest is reported with a reason, never guessed: no product, no number, not an image; one number twice and a gallery with images hold that product back', async () => {
  const { rules, store } = await apiOver();
  const plan = rules.planBulkImages(folder(), productsOf(store));
  assert.deepEqual(plan.unmatched.map((u) => [u.name, u.reason]), [
    ['linen-shirt-1.webp', 'No product in this store has the slug “linen-shirt”.'],
    ['README.md', 'Not a JPEG, PNG or WebP file.'],
    ['review-sheet.jpg', 'The name does not end in -<number>, e.g. -1.webp.'],
    ['sunlit-blossom-queen-bedsheet-set.webp', 'The name does not end in -<number>, e.g. -1.webp.'],
  ]);
  const held = Object.fromEntries(plan.held.map((h) => [h.product.id, h.reason]));
  assert.deepEqual(Object.keys(held).sort(), ['hp-chevron-q', 'hp-percale']);
  assert.match(held['hp-chevron-q'], /More than one file is numbered 1 \(blue-chevron-queen-bedsheet-set-1\.jpg, blue-chevron-queen-bedsheet-set-1\.webp\)\. Keep one file per number\./);
  assert.match(held['hp-percale'], /^Already has 1 image\. Tick “Also add to products that already have images”/);
  const appended = rules.planBulkImages(folder(), productsOf(store), { append: true });
  assert.deepEqual(appended.uploads.map((u) => [u.product.id, u.existing]), [['hp-chevron', 0], ['hp-percale', 1], ['hp-sunlit', 0]], '"also add" puts it back, after its image');
  assert.deepEqual(appended.held.map((h) => h.product.id), ['hp-chevron-q'], 'a repeated number is never uploaded');
});

console.log('\n— The upload —');

await test('number 1 becomes the primary, the rest follow in number order; WebPs that fit go up as they are; drafts stay drafts, stock untouched', async () => {
  const { rules, api, store } = await apiOver();
  const plan = rules.planBulkImages(folder(), productsOf(store));
  const before = JSON.stringify(store.db().catalogue_products.map(({ images, updated_at, ...p }) => p));
  const progress = [];
  const results = await api.addStoreImagesByName('homeliving', plan, (p) => progress.push(p));
  assert.deepEqual(results.map((r) => [r.product.id, r.added, r.unchanged, r.failed.length, r.skipped]), [['hp-chevron', 1, 1, 0, undefined], ['hp-sunlit', 4, 3, 0, undefined]]);
  const sunlit = mediaOf(store, 'hp-sunlit');
  assert.deepEqual(await Promise.all(sunlit.map((m) => sourceName(store, m).catch(() => '(converted)'))), ['sunlit-blossom-queen-bedsheet-set-1.WEBP', 'sunlit-blossom-queen-bedsheet-set-2.webp', '(converted)', 'sunlit-blossom-queen-bedsheet-set-10.webp']);
  assert.deepEqual(sunlit.map((m) => m.is_primary), [true, false, false, false]);
  assert.ok(sunlit.every((m) => m.alt_text === 'Sunlit Blossom Queen Bedsheet Set'));
  assert.equal(mediaOf(store, 'hp-chevron')[0].is_primary, true);
  assert.equal(store.storage.uploads.length, 5, 'held and unmatched files are never uploaded');
  assert.deepEqual(mediaOf(store, 'hp-percale').length, 1);
  assert.deepEqual(mediaOf(store, 'hp-chevron-q').length, 0);
  // Only gallery rows were written; the products themselves are as they were (images[] is the trigger's cache).
  assert.deepEqual(store.writes().map((w) => `${w.action} ${w.table}`).filter((w) => !/^insert catalogue_product_media$/.test(w)), []);
  assert.equal(JSON.stringify(store.db().catalogue_products.map(({ images, updated_at, ...p }) => p)), before);
  assert.ok(store.db().catalogue_products.filter((p) => ['hp-sunlit', 'hp-chevron'].includes(p.id)).every((p) => p.is_active === false && p.stock === 0));
  assert.deepEqual(progress.at(-1), { status: 'added', fileName: 'sunlit-blossom-queen-bedsheet-set-10.webp', productName: 'Sunlit Blossom Queen Bedsheet Set', product: 2, products: 2, file: 4, files: 4 });
});

await test('a file that fails is reported and the batch goes on; a gallery that changed since the plan is skipped, not added to', async () => {
  const { rules, api, store } = await apiOver();
  const files = [fits('sunlit-blossom-queen-bedsheet-set-1.webp'), imageFile('sunlit-blossom-queen-bedsheet-set-2.jpg', { detail: 3 }), fits('sunlit-blossom-queen-bedsheet-set-3.webp'),
    fits('blue-chevron-single-bedsheet-set-1.webp'), fits('blue-chevron-queen-bedsheet-set-1.webp')];
  const plan = rules.planBulkImages(files, productsOf(store));
  // Someone adds an image to the single in another tab after the files were chosen.
  store.raw.catalogue_product_media.push({ id: 'm-other', product_id: 'hp-chevron', storage_path: null, public_url: '/img/x.webp', alt_text: '', sort_order: 0, is_primary: true });
  const results = Object.fromEntries((await api.addStoreImagesByName('homeliving', plan)).map((r) => [r.product.id, r]));
  assert.equal(results['hp-sunlit'].added, 2);
  assert.deepEqual(results['hp-sunlit'].failed.map((f) => f.name), ['sunlit-blossom-queen-bedsheet-set-2.jpg']);
  assert.match(results['hp-sunlit'].failed[0].error, /could not be brought under 150 KB/);
  assert.match(results['hp-chevron'].skipped, /^Its gallery changed after the files were chosen \(0 images then, 1 now\)\. Nothing was added/);
  assert.equal(mediaOf(store, 'hp-chevron').length, 1, 'nothing added to it');
  assert.equal(results['hp-chevron-q'].added, 1, 'the next product still goes');
});

await test('a non-admin writes nothing: drafts are not even visible to it, and a published product refuses the image', async () => {
  const { rules, api, store } = await apiOver(fixtures(), { admin: false });
  // The plan as an admin would have made it (a non-admin cannot list drafts at all).
  const admin = await apiOver();
  const plan = rules.planBulkImages([fits('sunlit-blossom-queen-bedsheet-set-1.webp'), fits('percale-sheet-set-2.webp')], productsOf(admin.store), { append: true });
  const results = Object.fromEntries((await api.addStoreImagesByName('homeliving', plan)).map((r) => [r.product.id, r]));
  assert.match(results['hp-sunlit'].skipped, /could not be found in this store/);
  assert.equal(results['hp-percale'].added, 0);
  assert.match(results['hp-percale'].failed[0].error, /not a catalogue admin/);
  assert.equal(store.storage.objects.size, 0);
  assert.equal(store.writes().filter((w) => w.table === 'catalogue_product_media').length, 0, 'no gallery write is even attempted');
  assert.equal(store.db().catalogue_product_media.filter((m) => ['hp-sunlit', 'hp-percale'].includes(m.product_id)).length, 1, 'only percale’s existing image');
});

console.log('\n— The page —');

await test('the Bulk images tab shows the plan, asks before uploading, and reports what was added', async () => {
  const { handle, store, win } = await openPage({ params: { store: 'homeliving' }, search: '?tab=images', fixtures: fixtures() });
  assert.ok(findAll(handle.tree, (n) => n.type === 'button' && textOf(n) === 'Bulk images' && /active/.test(n.props.className)).length, 'the tab');
  const input = findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'file' && n.props.multiple)[0];
  await handle.act(() => input.props.onChange({ target: { files: folder(), value: 'x' } }));
  const text = handle.text();
  assert.match(text, /12 files — 5 images to upload to 2 products · 2 products held back · 4 files matching no product/);
  const rows = findAll(handle.tree, (n) => n.type === 'tr').map(textOf).filter((t) => /Bedsheet Set/.test(t));
  assert.match(rows[1], /^Sunlit Blossom Queen Bedsheet Set sunlit-blossom-queen-bedsheet-set · DraftEmptysunlit-blossom-queen-bedsheet-set-1\.WEBP — primary/);
  assert.match(text, /2 products held back — nothing will be uploaded to them/);
  assert.match(text, /linen-shirt-1\.webp: No product in this store has the slug “linen-shirt”\./);
  const button = () => findAll(handle.tree, (n) => n.type === 'button' && /^Upload /.test(textOf(n)))[0];
  assert.equal(textOf(button()), 'Upload 5 images to 2 products');
  win.answer = false;
  await handle.act(() => button().props.onClick());
  assert.equal(store.storage.uploads.length, 0, 'declining the confirmation uploads nothing');
  win.answer = true;
  await handle.act(() => button().props.onClick());
  assert.match(win.asked.at(-1), /^Upload 5 images to 2 Home & Living products\?/);
  assert.match(win.asked.at(-1), /Nothing is published and no stock changes\./);
  assert.match(handle.text(), /5 images added to 2 products \(4 used as they were\)\. Nothing was published\./);
  assert.equal(mediaOf(store, 'hp-sunlit').length, 4);
  assert.ok(!findAll(handle.tree, (n) => n.type === 'button' && /^Upload /.test(textOf(n))).length, 'the plan is cleared after the upload');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
