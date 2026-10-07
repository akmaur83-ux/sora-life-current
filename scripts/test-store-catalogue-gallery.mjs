// ============================================================
// Store catalogue admin — the gallery: several uploads at once, each made a
// WebP under 150 KB first; drag (or ← / →) to reorder; one primary; alt text.
//
//   node scripts/test-store-catalogue-gallery.mjs
//
// Offline (catalogue-admin-harness.mjs). Uploads run through the REAL
// adminApi.uploadImage into the fake client's storage; the WebP ladder is the
// real one, driven by a fake codec (Node has no canvas) whose output size
// grows with pixels × quality, so each test picks the rung that fits.
// Pinned:
//   * the ladder: 1600 px down to 800 px, quality 0.82 down to 0.5; never
//     upscales; the first rung that fits wins; nothing over 150 000 bytes is
//     ever uploaded; a browser that cannot encode WebP is told so
//   * gallery rows are written to catalogue_product_media only — images[]
//     is the trigger's cache, never written by the admin
//   * a failed file is reported and the batch goes on
//   * reorder writes sort_order 0…n-1; a stale set of ids writes nothing;
//     primary is one image; alt text carries the stale-write guard
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import {
  createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, openPage, imageFile,
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
const mediaOf = (store, productId) => store.db().catalogue_product_media.filter((m) => m.product_id === productId).sort((a, b) => a.sort_order - b.sort_order);
const productRow = (store, id) => store.db().catalogue_products.find((p) => p.id === id);
// detail values that land on a known rung for a 3000 × 2000 source:
//   0.08 → 1600×1067 @0.82 fits (≈112 KB);  0.15 → 1600×1067 @0.58 (≈149 KB) is the first fit;
//   3 → nothing fits even at 800×533 @0.5 (≈640 KB).
const FITS_FIRST = 0.08, FITS_LATER = 0.15, NEVER_FITS = 3;

console.log('\n— The WebP ladder —');

await test('the ladder: 1600 → 800 px by quality 0.82 → 0.5, never upscaling a small source', async () => {
  const { image } = await apiOver();
  const big = image.webpAttempts(3000, 2000);
  assert.deepEqual(big[0], { width: 1600, height: 1067, quality: 0.82 });
  assert.deepEqual(big.at(-1), { width: 800, height: 533, quality: 0.5 });
  assert.equal(big.length, 25);
  assert.deepEqual([...new Set(big.map((a) => a.width))], [1600, 1400, 1200, 1000, 800]);
  const portrait = image.webpAttempts(1200, 3000);
  assert.deepEqual(portrait[0], { width: 640, height: 1600, quality: 0.82 }, 'the longest side is capped, aspect kept');
  const small = image.webpAttempts(600, 400);
  assert.deepEqual([...new Set(small.map((a) => `${a.width}x${a.height}`))], ['600x400'], 'a small source is never enlarged');
  assert.equal(small.length, 5);
  assert.equal(image.WEBP_MAX_BYTES, 150000);
});

await test('compression takes the first rung that fits and returns a .webp File under 150 000 bytes', async () => {
  const { image } = await apiOver();
  const { fakeDecode, fakeEncode } = await import('./catalogue-admin-harness.mjs');
  const tried = [];
  const encode = async (img, rung) => { tried.push(rung); return fakeEncode(img, rung); };
  const first = await image.compressToWebp(imageFile('Linen Shirt Front.JPG', { detail: FITS_FIRST }), { decode: fakeDecode, encode });
  assert.equal(tried.length, 1);
  assert.equal(first.file.type, 'image/webp'); assert.equal(first.file.name, 'Linen-Shirt-Front.webp');
  assert.ok(first.bytes <= 150000 && first.file.size === first.bytes);
  tried.length = 0;
  const later = await image.compressToWebp(imageFile('detail.png', { detail: FITS_LATER, type: 'image/png' }), { decode: fakeDecode, encode });
  assert.deepEqual({ width: later.width, quality: later.quality }, { width: 1600, quality: 0.58 }, 'quality steps down before size does');
  assert.equal(tried.length, 4);
  assert.ok(tried.slice(0, -1).every((rung) => Math.round(rung.width * rung.height * rung.quality * FITS_LATER) > 150000), 'every rung skipped was over the limit');
});

await test('refusals say why: wrong type, empty, oversized, no WebP encoder, cannot fit at 800 px', async () => {
  const { image } = await apiOver();
  const { fakeDecode, fakeEncode } = await import('./catalogue-admin-harness.mjs');
  const run = (file) => image.compressToWebp(file, { decode: fakeDecode, encode: fakeEncode });
  await assert.rejects(run(imageFile('anim.gif', { type: 'image/gif' })), /a image\/gif file\. Use JPEG, PNG or WebP/);
  await assert.rejects(run(new File([], 'empty.jpg', { type: 'image/jpeg' })), /is empty/);
  await assert.rejects(run({ name: 'huge.jpg', type: 'image/jpeg', size: 30 * 1024 * 1024 }), /Use an image under 25 MB/);
  await assert.rejects(run(imageFile('safari.jpg', { encoderType: 'image/png' })), /cannot create WebP images\. Upload from Chrome, Edge or Firefox/);
  await assert.rejects(run(imageFile('noise.jpg', { detail: NEVER_FITS })), /could not be brought under 150 KB at 800 px or more/);
});

console.log('\n— The gallery API —');

await test('several images at once: each converted, uploaded to product-images under catalogue/<store>/, attached in order; a failure does not stop the batch', async () => {
  const { api, store } = await apiOver();
  const progress = [];
  const files = [imageFile('front.jpg', { detail: FITS_FIRST }), imageFile('noise.jpg', { detail: NEVER_FITS }), imageFile('back.png', { detail: FITS_LATER, type: 'image/png' })];
  const results = await api.addStoreImages('fashion', 'fp-linen', files, (i, s) => progress.push([i, s.status]));
  assert.deepEqual(results.map((r) => r.ok), [true, false, true]);
  assert.match(results[1].error, /could not be brought under 150 KB/);
  assert.deepEqual(progress, [[0, 'converting'], [0, 'uploading'], [0, 'added'], [1, 'converting'], [1, 'failed'], [2, 'converting'], [2, 'uploading'], [2, 'added']]);
  assert.equal(store.storage.uploads.length, 2, 'the image that could not fit was never uploaded');
  for (const up of store.storage.uploads) {
    assert.equal(up.bucket, 'product-images');
    assert.match(up.path, /^catalogue\/fashion\/[0-9a-f-]+\.webp$/);
    assert.equal(up.type, 'image/webp');
    assert.ok(up.size <= 150000, `${up.size} bytes`);
  }
  const media = mediaOf(store, 'fp-linen');
  assert.equal(media.length, 3);
  assert.deepEqual(media.map((m) => m.sort_order), [0, 1, 2], 'appended after the existing image');
  assert.equal(media[1].storage_path, store.storage.uploads[0].path, 'the object path is recorded for a later clean-up');
  assert.equal(media.filter((m) => m.is_primary).length, 1);
  assert.deepEqual(productRow(store, 'fp-linen').images, media.map((m) => m.public_url), 'images[] is the trigger\'s cache, primary first');
  const writes = store.writes().filter((w) => w.table === 'catalogue_products');
  assert.equal(writes.length, 0, 'the admin never writes images[] (or any product column) to add an image');
});

await test("a product's first image becomes its primary", async () => {
  const { api, store } = await apiOver();
  await api.addStoreImages('fashion', 'fp-wrap', [imageFile('a.jpg', { detail: FITS_FIRST }), imageFile('b.jpg', { detail: FITS_FIRST })]);
  const media = mediaOf(store, 'fp-wrap');
  assert.deepEqual(media.map((m) => m.is_primary), [true, false]);
});

await test('reorder writes sort_order 0…n-1; an id set that no longer matches the gallery writes nothing', async () => {
  const { api, store } = await apiOver();
  await api.addStoreImages('fashion', 'fp-linen', [imageFile('b.jpg', { detail: FITS_FIRST }), imageFile('c.jpg', { detail: FITS_FIRST })]);
  const ids = mediaOf(store, 'fp-linen').map((m) => m.id);
  await api.reorderStoreMedia('fashion', 'fp-linen', [ids[2], ids[0], ids[1]]);
  assert.deepEqual(mediaOf(store, 'fp-linen').map((m) => m.id), [ids[2], ids[0], ids[1]]);
  assert.deepEqual(mediaOf(store, 'fp-linen').map((m) => m.sort_order), [0, 1, 2]);
  assert.equal(productRow(store, 'fp-linen').images[0], '/img/fashion-hero.webp', 'the primary still leads the storefront');
  const before = store.writes().length;
  await assert.rejects(api.reorderStoreMedia('fashion', 'fp-linen', [ids[0], ids[1]]), (e) => e.isStaleWrite && /changed while you were reordering/.test(e.message));
  assert.equal(store.writes().length, before);
});

await test('make primary moves the one primary; images[] leads with it', async () => {
  const { api, store } = await apiOver();
  await api.addStoreImages('fashion', 'fp-linen', [imageFile('b.jpg', { detail: FITS_FIRST })]);
  const second = mediaOf(store, 'fp-linen')[1];
  await api.setStoreMediaPrimary('fashion', 'fp-linen', second.id);
  assert.deepEqual(mediaOf(store, 'fp-linen').map((m) => m.is_primary), [false, true]);
  assert.equal(productRow(store, 'fp-linen').images[0], second.public_url);
});

await test('alt text is saved through the stale-write guard', async () => {
  const { api, store } = await apiOver();
  const product = await api.getStoreProduct('fashion', 'fp-linen');
  const m = product.media[0];
  await api.saveStoreMediaAlt('fashion', 'fp-linen', m.id, '  Linen shirt, front, sage  ', m.updated_at);
  assert.equal(mediaOf(store, 'fp-linen')[0].alt_text, 'Linen shirt, front, sage');
  await assert.rejects(api.saveStoreMediaAlt('fashion', 'fp-linen', m.id, 'Stale', m.updated_at), (e) => e.isStaleWrite);
  await assert.rejects(api.saveStoreMediaAlt('fashion', 'fp-linen', m.id, 'x'.repeat(301), mediaOf(store, 'fp-linen')[0].updated_at), (e) => !!e.fieldErrors?.alt_text);
});

await test('category pictures go through the same WebP conversion', async () => {
  const { api, store } = await apiOver();
  const url = await api.uploadStoreImage('homeliving', imageFile('circle.png', { detail: FITS_FIRST, type: 'image/png' }));
  assert.match(url, /\/product-images\/catalogue\/homeliving\/[0-9a-f-]+\.webp$/);
  assert.equal(store.storage.uploads[0].type, 'image/webp');
});

console.log('\n— The page —');

await test('the editor uploads several files, shows each one\'s outcome, and the gallery grows', async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
  const input = findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'file' && n.props.multiple)[0];
  assert.ok(input, 'a multi-file input');
  assert.equal(input.props.accept, 'image/jpeg,image/png,image/webp');
  await handle.act(() => input.props.onChange({ target: { files: [imageFile('front.jpg', { detail: FITS_FIRST }), imageFile('noise.jpg', { detail: NEVER_FITS }), imageFile('back.jpg', { detail: FITS_LATER })], value: 'x' } }));
  const queue = findAll(handle.tree, (n) => n.type === 'li' && /sc-queue__item/.test(n.props.className)).map(textOf);
  assert.equal(queue.length, 3);
  assert.match(queue[0], /^front\.jpgAdded · \d+ KB WebP$/);
  assert.match(queue[1], /^noise\.jpgNot added: “noise\.jpg” could not be brought under 150 KB/);
  assert.match(handle.text(), /2 of 3 images added — 1 not added \(see below\)\./);
  assert.equal(findAll(handle.tree, (n) => n.type === 'li' && /\bsc-image\b/.test(n.props.className)).length, 3);
  assert.equal(mediaOf(store, 'fp-linen').length, 3);
});

const threeImages = () => {
  const db = catalogueFixtures();
  db.catalogue_product_media.push(
    { id: 'm-linen-2', product_id: 'fp-linen', storage_path: null, public_url: '/img/fashion-hero.webp?2', alt_text: 'Back', sort_order: 1, is_primary: false },
    { id: 'm-linen-3', product_id: 'fp-linen', storage_path: null, public_url: '/img/fashion-hero.webp?3', alt_text: 'Detail', sort_order: 2, is_primary: false },
  );
  return db;
};
const tilesOf = (handle) => findAll(handle.tree, (n) => n.type === 'li' && String(n.props.className || '').split(' ').includes('sc-image'));

await test('drag one image onto another, or use ← / →, and the order is saved', async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' }, fixtures: threeImages() });
  const order = () => mediaOf(store, 'fp-linen').map((m) => m.id);
  const ev = { preventDefault() {}, stopPropagation() {}, dataTransfer: { setData() {} } };
  assert.deepEqual(order(), ['m-linen', 'm-linen-2', 'm-linen-3']);
  await handle.act(() => { tilesOf(handle)[2].props.onDragStart(ev); tilesOf(handle)[0].props.onDragOver(ev); });
  assert.match(tilesOf(handle)[0].props.className, /is-over/, 'the drop target is marked');
  await handle.act(() => tilesOf(handle)[0].props.onDrop(ev));
  assert.deepEqual(order(), ['m-linen-3', 'm-linen', 'm-linen-2'], 'the third image took the first place');
  assert.match(handle.text(), /Order saved\./);
  await handle.act(() => findAll(handle.tree, (n) => n.type === 'button' && n.props['aria-label'] === 'Move image 1 later')[0].props.onClick());
  assert.deepEqual(order(), ['m-linen', 'm-linen-3', 'm-linen-2']);
  assert.equal(findAll(handle.tree, (n) => n.type === 'button' && n.props['aria-label'] === 'Move image 1 earlier')[0].props.disabled, true);
  assert.equal(findAll(handle.tree, (n) => n.type === 'button' && n.props['aria-label'] === 'Move image 3 later')[0].props.disabled, true);
  // A file dropped on the upload area is an upload, not a reorder.
  assert.equal(typeof findAll(handle.tree, (n) => n.type === 'label' && /sc-drop/.test(n.props.className || ''))[0].props.onDrop, 'function');
});

await test('make primary, alt text on blur, and remove (with confirmation) from the tiles', async () => {
  const { handle, store, win } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' }, fixtures: threeImages() });
  await handle.act(() => buttonByText(tilesOf(handle)[1], 'Make primary').props.onClick());
  assert.equal(store.db().catalogue_product_media.find((m) => m.id === 'm-linen-2').is_primary, true);
  assert.match(handle.text(), /Primary image changed\./);
  const alt = fieldByLabel(handle.tree, 'Alt text, image 2').control;
  await handle.act(() => change(alt, 'Linen shirt, back view'));
  await handle.act(() => fieldByLabel(handle.tree, 'Alt text, image 2').control.props.onBlur());
  assert.equal(store.db().catalogue_product_media.find((m) => m.id === 'm-linen-2').alt_text, 'Linen shirt, back view');
  win.answer = false;
  await handle.act(() => buttonByText(tilesOf(handle)[0], 'Remove').props.onClick());
  assert.equal(mediaOf(store, 'fp-linen').length, 3, 'declining the confirmation keeps the image');
  win.answer = true;
  await handle.act(() => buttonByText(tilesOf(handle)[0], 'Remove').props.onClick());
  assert.equal(mediaOf(store, 'fp-linen').length, 2);
  assert.match(win.asked[0], /The original file will be kept/);
});

await test('Add by URL is optional: left empty it shows no error and adds nothing; a bad URL is still refused', async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
  const form = () => formOf(handle.tree, 'Add by URL');
  const button = () => findAll(form(), (n) => n.type === 'button' && n.props.type === 'submit')[0];
  const url = () => fieldByLabel(form(), 'Image URL');
  // The gallery saves as it goes; this button only adds a hosted image, so it must not read like a gallery save.
  assert.equal(textOf(button()), 'Add image from URL');
  assert.equal(button().props.disabled, true, 'nothing to add until a URL is typed');
  assert.equal(url().control.props.required, false, 'the gallery works without this field');
  const before = mediaOf(store, 'fp-linen').length;
  await handle.act(() => change(fieldByLabel(form(), 'Image description / alt text').control, 'Front'));
  await handle.act(() => submit(form()));   // Enter in the alt-text box submits the form
  await handle.act(() => change(url().control, '   '));
  await handle.act(() => submit(form()));
  assert.doesNotMatch(handle.text(), /Enter a public HTTPS image URL/);
  assert.equal(url().error, null, 'no error beside the URL field');
  assert.equal(mediaOf(store, 'fp-linen').length, before, 'an empty form adds nothing');
  await handle.act(() => change(url().control, 'javascript:alert(1)'));
  assert.equal(button().props.disabled, false);
  await handle.act(() => submit(form()));
  assert.equal(url().error, 'Enter a public HTTPS image URL or a local image path.', 'a typed URL that is not allowed is still refused, beside the field');
  assert.equal(mediaOf(store, 'fp-linen').length, before);
  await handle.act(() => change(url().control, '/img/fashion-hero.webp'));
  await handle.act(() => submit(form()));
  assert.equal(mediaOf(store, 'fp-linen').length, before + 1);
  assert.equal(url().control.props.value, '', 'the form is cleared after an add');
});

await test('the WebP converter is admin-only: nothing but the catalogue admin API imports it', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join, relative } = await import('node:path');
  const { ROOT } = await import('./catalogue-admin-harness.mjs');
  const files = [];
  (function walk(dir) { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(name)) files.push(p); } })(join(ROOT, 'src'));
  const importers = files.filter((f) => /from ['"][^'"]*storeCatalogueImage\.js['"]/.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  assert.deepEqual(importers, ['src/lib/storeCatalogueAdminApi.js']);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
