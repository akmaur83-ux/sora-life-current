// Offline only: execute real admin helpers against a recording Supabase client.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './fashion-ssr.mjs';
import * as rules from '../src/lib/storeCatalogueAdmin.js';
import { safeVisualUrl } from '../src/lib/homepageAppearance.js';
import { productView } from '../src/lib/fashion.js';

let count = 0;
async function test(name, fn) { try { await fn(); count++; console.log(`PASS ${name}`); } catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; } }
const cats = [{ id: 'root', name: 'Clothing', slug: 'clothing', parent_id: null, is_active: true }, { id: 'child', name: 'Shirts', slug: 'shirts', parent_id: 'root', is_active: true }];
const input = { name: 'Linen shirt', category_id: 'child', mrp: 1299, sale_price: 999, stock: 5, is_active: true };
const product = { id: 'p1', store: 'fashion', updated_at: 't1', images: ['/img/shirt.webp'], is_active: true, variants: [{ id: 'v1', is_active: true }], media: [{ id: 'm1', is_primary: true }, { id: 'm2' }] };
function fake(respond) {
  const calls = [];
  const supabase = { from(table) {
    const q = { table, ops: [] }; calls.push(q);
    const chain = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve().then(() => respond(q)).then(resolve, reject);
      return (...args) => { q.ops.push([method, ...args]); return chain; };
    } });
    return chain;
  } };
  return { calls, api: loadModule('src/lib/storeCatalogueAdminApi.js', { supabase, uploadImage: async (_, folder) => `https://images.example/${folder}/new.webp`, compressToWebp: async (file) => ({ file, bytes: 1 }), safeVisualUrl, ...rules }) };
}
const has = (q, method) => q.ops.find((op) => op[0] === method);
// One row back: `.single()`, or `.maybeSingle()` where a missing product must read as "deleted".
const one = (q) => has(q, 'single') || has(q, 'maybeSingle');
const payload = (q) => (has(q, 'insert') || has(q, 'update'))?.[1];
const eq = (q, key, value) => q.ops.some((op) => op[0] === 'eq' && op[1] === key && op[2] === value);
// Slug/SKU availability checks (`.limit(1)`) find nothing taken.
const normal = (q) => ({ data: q.table === 'catalogue_categories' && !payload(q) ? cats : one(q) ? { ...product, ...payload(q) } : has(q, 'limit') ? [] : [product], error: null });

await test('only supported stores, valid category and real numeric prices/stock are accepted', () => {
  // Grocery joined the picker (data entry ahead of its storefront; the page says it cannot be sold yet).
  for (const store of ['wellness', 'lifestyle', '__proto__']) assert.throws(() => rules.requireCatalogueStore(store));
  for (const store of ['fashion', 'homeliving', 'grocery']) assert.equal(rules.requireCatalogueStore(store), store);
  const row = rules.catalogueProductPayload({ ...input, discount_percent: 88, images: ['bad'], rating: 5, is_demo: true }, cats);
  assert.equal(row.slug, 'linen-shirt'); assert.equal(row.sale_price, 999);
  for (const key of ['discount_percent', 'images', 'rating', 'is_demo', 'store', 'id']) assert.ok(!(key in row));
  for (const patch of [{ category_id: 'other-store' }, { mrp: 0 }, { mrp: 'NaN' }, { sale_price: 1400 }, { sale_price: 0 }, { stock: -1 }, { stock: 0.5 }]) assert.throws(() => rules.catalogueProductPayload({ ...input, ...patch }, cats));
  assert.equal(rules.catalogueProductPayload({ ...input, sale_price: '' }, cats).sale_price, null);
  assert.throws(() => rules.catalogueProductPayload(input, cats.map((c) => c.id === 'root' ? { ...c, is_active: false } : c)), /Activate/);
});
await test('category hierarchy is store-local, cycle-safe, three levels, with full path labels', () => {
  assert.equal(rules.categoryOptions(cats).find((r) => r.id === 'child').label, 'Clothing / Shirts');
  assert.throws(() => rules.catalogueCategoryPayload({ name: 'Clothing', parent_id: 'child' }, cats, 'root'), /circular/);
  assert.throws(() => rules.catalogueCategoryPayload({ name: 'Shirts', parent_id: 'other-store' }, cats), /this store/);
  const deep = [...cats, { id: 'grandchild', parent_id: 'child', name: 'Linen' }];
  assert.throws(() => rules.catalogueCategoryPayload({ name: 'Deep', parent_id: 'grandchild' }, deep), /three levels/);
  assert.throws(() => rules.catalogueCategoryPayload({ name: 'Bad', image_url: 'javascript:alert(1)' }, cats));
});
await test('Fashion needs size and colour; Home & Living allows a size without a colour', () => {
  const v = { size: 'King', colour: '', stock: 4, price_override: '' };
  assert.throws(() => rules.catalogueVariantPayload(v, 'fashion'));
  assert.equal(rules.catalogueVariantPayload(v, 'homeliving').price_override, null);
  assert.throws(() => rules.catalogueVariantPayload({ ...v, stock: -1 }, 'homeliving'));
  assert.throws(() => rules.catalogueVariantPayload({ ...v, colour_hex: 'red' }, 'homeliving'));
  rules.assertCataloguePublishable('homeliving', { images: ['/img/test.webp'] });
  assert.throws(() => rules.assertCataloguePublishable('fashion', { images: ['/img/test.webp'], variants: [] }), /variant/);
  assert.throws(() => rules.assertCataloguePublishable('fashion', { images: [], variants: [{ is_active: true }] }), /image/);
});
await test('lists include drafts and pagination, with explicit store filtering', async () => {
  const { api, calls } = fake((q) => ({ data: has(q, 'range')[1] === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: i })) : [{ id: 501 }], error: null }));
  assert.equal((await api.listStoreProducts('homeliving')).length, 501);
  for (const q of calls) { assert.equal(q.table, 'catalogue_products'); assert.ok(eq(q, 'store', 'homeliving')); assert.ok(!eq(q, 'is_active', true)); }
});
await test('new products insert as drafts; updates target id AND store, preserving calculated fields', async () => {
  const { api, calls } = fake(normal);
  await api.saveStoreProduct('fashion', null, input);
  const insert = calls.find((q) => has(q, 'insert'));
  assert.equal(payload(insert).store, 'fashion'); assert.equal(payload(insert).is_active, false);
  assert.ok(!('discount_percent' in payload(insert))); assert.ok(!('images' in payload(insert)));
  // An update carries the version the editor loaded (the stale-write guard).
  await api.saveStoreProduct('fashion', 'p1', input, 't1');
  const update = calls.find((q) => has(q, 'update'));
  assert.ok(eq(update, 'store', 'fashion') && eq(update, 'id', 'p1') && eq(update, 'updated_at', 't1'));
  assert.ok(!calls.some((q) => has(q, 'upsert')), 'no slug-conflict overwrite');
});
await test('failed publish leaves the draft unchanged and errors are surfaced', async () => {
  const { api, calls } = fake((q) => ({ data: q.table === 'catalogue_categories' ? cats : { ...product, images: [] }, error: null }));
  await assert.rejects(api.saveStoreProduct('fashion', 'p1', input), /image/);
  assert.ok(!calls.some((q) => has(q, 'update')));
  const denied = fake(() => ({ data: null, error: new Error('Permission denied') }));
  await assert.rejects(denied.api.listStoreCategories('fashion'), /Permission denied/);
});
await test('category writes validate parent and use id/store updates, never another catalogue', async () => {
  const { api, calls } = fake(normal);
  await api.saveStoreCategory('homeliving', null, { name: 'Bedding', is_active: true });
  assert.equal(payload(calls.find((q) => has(q, 'insert'))).store, 'homeliving');
  await api.saveStoreCategory('homeliving', 'child', { name: 'Sheets', parent_id: 'root' }, 't1');
  assert.ok(calls.some((q) => has(q, 'update') && eq(q, 'store', 'homeliving') && eq(q, 'id', 'child')));
  await assert.rejects(api.saveStoreCategory('fashion', 'not-in-store', { name: 'No' }), /this store/);
});
await test('variant edits require membership and are scoped to store, product and variant', async () => {
  const { api, calls } = fake(normal);
  const v = { size: 'M', colour: 'Sage', stock: 3 };
  await api.saveStoreVariant('fashion', 'p1', 'v1', v, 't1');
  const update = calls.find((q) => has(q, 'update'));
  assert.ok(eq(update, 'store', 'fashion') && eq(update, 'product_id', 'p1') && eq(update, 'id', 'v1'));
  await assert.rejects(api.saveStoreVariant('fashion', 'p1', 'wrong', v), /not found/);
  await api.saveStoreVariant('fashion', 'p1', null, v);
  assert.equal(payload(calls.find((q) => has(q, 'insert'))).store, 'fashion');
});
await test('gallery writes use the media table/trigger and only detach images; originals are never deleted', async () => {
  const { api, calls } = fake(normal);
  await api.saveStoreMedia('fashion', 'p1', null, { public_url: '/img/new.webp', is_primary: true });
  const q = calls.find((c) => has(c, 'insert'));
  assert.equal(q.table, 'catalogue_product_media'); assert.equal(payload(q).product_id, 'p1');
  await assert.rejects(api.saveStoreMedia('fashion', 'p1', 'wrong', { public_url: '/img/new.webp' }), /not found/);
  await assert.rejects(api.saveStoreMedia('fashion', 'p1', null, { public_url: 'javascript:bad' }), /image URL/);
  await assert.rejects(api.saveStoreMedia('fashion', 'p1', 'm1', { public_url: '/img/test.webp', is_primary: false }), /primary/);
  await api.removeStoreMedia('fashion', 'p1', 'm2');
  const del = calls.find((c) => has(c, 'delete')); assert.ok(eq(del, 'id', 'm2') && eq(del, 'product_id', 'p1'));
  const last = fake(() => ({ data: { ...product, media: [{ id: 'm1' }] }, error: null }));
  await assert.rejects(last.api.removeStoreMedia('fashion', 'p1', 'm1'), /one image/);
  assert.equal(await api.uploadStoreImage('homeliving', {}), 'https://images.example/catalogue/homeliving/new.webp');
});
await test('draft → gallery → variant → publish round-trip feeds the unchanged Fashion product view', async () => {
  const db = { catalogue_categories: cats.map((row) => ({ ...row, store: 'fashion' })), catalogue_products: [], catalogue_variants: [], catalogue_product_media: [] };
  let serial = 0;
  const { api } = fake((q) => {
    const filter = (row) => q.ops.every(([op, key, value]) => (op === 'eq' ? row[key] === value : op === 'neq' ? row[key] !== value : true));
    let rows = db[q.table].filter(filter);
    if (has(q, 'limit')) rows = rows.slice(0, has(q, 'limit')[1]);
    if (has(q, 'insert')) { const row = { id: `created-${++serial}`, updated_at: `v${++serial}`, ...payload(q) }; db[q.table].push(row); rows = [row]; }
    if (has(q, 'update')) for (const row of rows) Object.assign(row, payload(q), { updated_at: `v${++serial}` });
    // Emulate the existing media trigger, then the normal PostgREST embeds.
    for (const p of db.catalogue_products) {
      p.images = db.catalogue_product_media.filter((m) => m.product_id === p.id).map((m) => m.public_url);
      p.variants = db.catalogue_variants.filter((v) => v.product_id === p.id);
      p.media = db.catalogue_product_media.filter((m) => m.product_id === p.id);
      p.discount_percent = Math.round((p.mrp - (p.sale_price ?? p.mrp)) / p.mrp * 100);
    }
    return { data: structuredClone(one(q) ? rows[0] : rows), error: null };
  });
  const draft = await api.saveStoreProduct('fashion', null, input);
  assert.equal(draft.is_active, false);
  await assert.rejects(api.saveStoreProduct('fashion', draft.id, input, draft.updated_at), /image/);
  await api.saveStoreMedia('fashion', draft.id, null, { public_url: '/img/shirt.webp', is_primary: true });
  await assert.rejects(api.saveStoreProduct('fashion', draft.id, input, draft.updated_at), /variant/);
  await api.saveStoreVariant('fashion', draft.id, null, { size: 'M', colour: 'Sage', stock: 12 });
  await api.saveStoreProduct('fashion', draft.id, input, draft.updated_at);
  const saved = await api.getStoreProduct('fashion', draft.id);
  const view = productView({ ...saved, fashion_variants: saved.variants });
  assert.equal(saved.is_active, true); assert.equal(view.category_id, 'child');
  assert.equal(view.price, 999); assert.equal(view.totalStock, 12); assert.equal(view.image, '/img/shirt.webp');
  assert.deepEqual(view.sizes, ['M']); assert.equal(view.swatches[0].colour, 'Sage');
});
await test('editor routes sit within existing admin guard and are discoverable from both admin menus', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const app = read('src/App.jsx');
  const start = app.indexOf('<Route path="/admin"');
  const end = app.indexOf('<Route path="/passport', start);
  const admin = app.slice(start, end);
  assert.match(admin, /ProtectedAdminRoute/);
  assert.match(admin, /path="store-catalogue\/:store\/:productId\?"/);
  for (const p of ['src/admin/AdminLayout.jsx', 'src/admin/pages/Storefronts.jsx']) {
    const source = read(p); assert.ok(source.includes('/admin/store-catalogue/fashion')); assert.ok(source.includes('/admin/store-catalogue/homeliving'));
  }
  const page = read('src/admin/pages/StoreCatalogue.jsx');
  for (const label of ['+ Add product', '+ Add category', 'Create draft & continue', 'Save variant', 'Save image', 'Published / visible to customers']) assert.ok(page.includes(label), label);
});
console.log(`\n${count} tests passed.`);
