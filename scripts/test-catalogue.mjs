// ============================================================
// Shared catalogue (migration 0034) — the data layer. Offline suite.
//
// Every fashion read and admin write goes to catalogue_* filtered or
// stamped with store = 'fashion' (proved by executing the functions against
// a recording Supabase stand-in, not by grepping); the grocery data module
// queries the same tables under store = 'grocery'; one cart cache serves
// both stores and a grocery row landing re-prices the cart; the migration
// and its rollback say what they must; and the fashion pages render
// BYTE-IDENTICALLY to the pre-change tree. The cart, checkout, coupon,
// auth and payment code is byte-identical to the baseline.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-catalogue.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-catalogue.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ROOT, read, has, h, loadModule, loadGroceryData, CATEGORIES, PRODUCTS, noSupabase } from './grocery-ssr.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The tip before the data layer moved (the grocery bundle commit). Pinned so the
// comparisons stay meaningful after this step's commit lands.
const BASELINE_SHA = 'c1a1c2d';
const atBaseline = (rel) => execFileSync('git', ['show', `${BASELINE_SHA}:${rel}`], { cwd: REPO, encoding: 'utf8' }).replace(/\r\n/g, '\n');

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
console.log(`\nsource root: ${ROOT}`);

/**
 * A Supabase stand-in that records every query-builder chain. Awaiting the
 * chain resolves through `respond(query)`, so each API function runs end to
 * end and its exact table, filters, conflict target and row are asserted.
 */
function fakeSupabase(respond = () => ({ data: [], error: null })) {
  const calls = [];
  const from = (table) => {
    const q = { table, ops: [] };
    calls.push(q);
    const chain = new Proxy({}, {
      get(_, m) {
        if (m === 'then') return (res, rej) => Promise.resolve().then(() => respond(q)).then(res, rej);
        return (...args) => { q.ops.push([m, ...args]); return chain; };
      },
    });
    return chain;
  };
  return { client: { from }, calls };
}
const op = (q, name) => q.ops.find((o) => o[0] === name);
const opsNamed = (q, name) => q.ops.filter((o) => o[0] === name);

let rules = null;
try { rules = await import(pathToFileURL(resolve(ROOT, 'src/lib/fashion.js')).href); } catch { rules = null; }
const loadFashionApi = (client) => loadModule('src/lib/fashionApi.js', { supabase: client, FASHION_STORE: rules?.FASHION_STORE, fashionCategoryToRow: rules?.fashionCategoryToRow, fashionProductToRow: rules?.fashionProductToRow, fashionVariantToRow: rules?.fashionVariantToRow });

// ============================================================
console.log('\n— Fashion reads: catalogue_* where store = fashion, the embed under its old name —');
// ============================================================

await test('getFashionCategories / getFashionProducts / getFashionProductsByIds / getFashionProduct hit the catalogue tables, filter store = fashion, and alias the variants embed to fashion_variants', async () => {
  assert.ok(rules && rules.FASHION_STORE === 'fashion', 'fashion.js exports FASHION_STORE');
  const { client, calls } = fakeSupabase(() => ({ data: [{ id: 'x', fashion_variants: [] }], error: null }));
  const api = loadFashionApi(client);
  await api.getFashionCategories();
  await api.getFashionProducts();
  await api.getFashionProductsByIds(['a', 'b', 'a', '']);
  await api.getFashionProduct('meadow-linen-shirt-sage');
  assert.deepEqual(calls.map((q) => q.table), ['catalogue_categories', 'catalogue_products', 'catalogue_products', 'catalogue_products']);
  for (const q of calls) assert.deepEqual(op(q, 'eq').slice(1), ['store', 'fashion'], `${q.table}: the first filter is the store`);
  assert.equal(op(calls[0], 'select')[1], 'id, parent_id, name, slug, tagline, image_url, sort_order, is_active');
  assert.deepEqual(op(calls[0], 'order').slice(1), ['sort_order', { ascending: true }]);
  const sel = op(calls[1], 'select')[1];
  assert.match(sel, /^id, name, slug, brand, description, category_id, mrp, sale_price, discount_percent, images, rating, review_count, is_active, is_new, is_bestseller, sort_order, is_demo, fashion_variants:catalogue_variants \(id, product_id, size, colour, colour_hex, sku, stock, price_override, is_active, sort_order\)$/, 'the 0033 product columns, and the variants embed aliased to fashion_variants');
  assert.deepEqual(opsNamed(calls[1], 'eq').map((o) => o.slice(1)), [['store', 'fashion'], ['is_active', true]]);
  assert.deepEqual(op(calls[2], 'in').slice(1), ['id', ['a', 'b']], 'ids de-duplicated and cleaned');
  assert.equal(op(calls[2], 'select')[1], sel);
  assert.deepEqual(opsNamed(calls[3], 'eq').map((o) => o.slice(1)), [['store', 'fashion'], ['slug', 'meadow-linen-shirt-sage']]);
  assert.ok(op(calls[3], 'maybeSingle'));
  assert.deepEqual(await api.getFashionProductsByIds([]), [], 'no ids, no request');
});

await test('no read or write in fashionApi.js names the old tables — fashion_products / fashion_variants / fashion_categories appear only as the embed alias', () => {
  const src = stripComments(read('src/lib/fashionApi.js'));
  assert.doesNotMatch(src, /from\((['"`])fashion_/, 'no from(fashion_*)');
  assert.doesNotMatch(src, /'fashion_(categories|products)'/);
  assert.match(src, /fashion_variants:\$\{VARIANT_TABLE\}/, 'the alias');
  assert.match(src, /CATEGORY_TABLE = 'catalogue_categories'/); assert.match(src, /PRODUCT_TABLE = 'catalogue_products'/); assert.match(src, /VARIANT_TABLE = 'catalogue_variants'/);
});

// ============================================================
console.log('\n— Fashion admin writes: catalogue_*, store stamped, (store, slug) conflict —');
// ============================================================

await test('the row mappers stamp store = fashion on every row and ignore a caller-supplied store; omit-when-absent otherwise unchanged', () => {
  assert.deepEqual(rules.fashionProductToRow({ slug: 'x', name: 'X' }), { store: 'fashion', slug: 'x', name: 'X' });
  assert.deepEqual(rules.fashionProductToRow({ slug: 'x', store: 'grocery' }), { store: 'fashion', slug: 'x' }, 'a caller cannot move a fashion write to another store');
  assert.deepEqual(rules.fashionProductToRow({}), { store: 'fashion' });
  assert.deepEqual(rules.fashionProductToRow({ slug: 'x', netContent: '1 kg', hsnCode: '1006', gstRate: 5, sku: 'S1', stock: 4 }), { store: 'fashion', slug: 'x', net_content: '1 kg', hsn_code: '1006', gst_rate: 5, sku: 'S1', stock: 4 }, 'the 0034 product columns are reachable');
  assert.deepEqual(rules.fashionVariantToRow({ productId: 'p', size: 'M', colour: 'Navy', stock: 3, store: 'x' }), { store: 'fashion', product_id: 'p', size: 'M', colour: 'Navy', stock: 3 });
  assert.deepEqual(rules.fashionCategoryToRow({ id: 'c', parentId: null, store: 'grocery' }), { store: 'fashion', id: 'c', parent_id: null });
  assert.equal(Object.keys(rules.fashionProductToRow({ slug: 'x', isActive: false, images: [] })).includes('description'), false, 'nothing invented');
});

await test('adminUpsertFashionProduct / Category / Variant upsert into catalogue_* with store on the row; products conflict on store,slug; the demo delete is fashion-only', async () => {
  const { client, calls } = fakeSupabase((q) => ({ data: q.ops[0][0] === 'delete' ? [{ id: '1' }, { id: '2' }] : { id: 'row' }, error: null }));
  const api = loadFashionApi(client);
  await api.adminUpsertFashionProduct({ slug: 'x', name: 'X', mrp: 10 });
  await api.adminUpsertFashionCategory({ id: 'c', name: 'C', slug: 'c' });
  await api.adminUpsertFashionVariant({ productId: 'p', size: 'M', colour: 'Navy', stock: 1 });
  const demo = await api.adminDeleteFashionDemo();
  assert.deepEqual(calls.map((q) => q.table), ['catalogue_products', 'catalogue_categories', 'catalogue_variants', 'catalogue_products', 'catalogue_categories']);
  assert.deepEqual(op(calls[0], 'upsert').slice(1), [{ store: 'fashion', slug: 'x', name: 'X', mrp: 10 }, { onConflict: 'store,slug' }], 'products conflict on (store, slug)');
  assert.deepEqual(op(calls[1], 'upsert').slice(1), [{ store: 'fashion', id: 'c', name: 'C', slug: 'c' }, { onConflict: 'id' }]);
  assert.deepEqual(op(calls[2], 'upsert').slice(1), [{ store: 'fashion', product_id: 'p', size: 'M', colour: 'Navy', stock: 1 }, { onConflict: 'product_id,size,colour' }]);
  for (const q of calls.slice(0, 3)) { assert.ok(op(q, 'select')); assert.ok(op(q, 'single')); }
  for (const q of calls.slice(3)) { assert.ok(op(q, 'delete')); assert.deepEqual(opsNamed(q, 'eq').map((o) => o.slice(1)), [['store', 'fashion'], ['is_demo', true]], `${q.table}: only fashion demo rows`); }
  assert.deepEqual(demo, { products: 2, categories: 2 });
  const src = stripComments(read('src/lib/fashionApi.js'));
  assert.doesNotMatch(src, /is_active: (true|false)|description: ''|stock: 0/, 'the API never defaults a column');
});

// ============================================================
console.log('\n— The grocery data module: the same tables, store = grocery —');
// ============================================================

await test('getGroceryCategories / getGroceryProducts / getGroceryProductsByIds query catalogue_* where store = grocery; rows keep the schema field names and gain a data-layer price', async () => {
  const { client, calls } = fakeSupabase((q) => ({ data: q.table === 'catalogue_categories' ? CATEGORIES : PRODUCTS, error: null }));
  const data = loadModule('src/data/groceryHomepage.js', { supabase: client });
  const cats = await data.getGroceryCategories();
  const prods = await data.getGroceryProducts();
  const some = await data.getGroceryProductsByIds([PRODUCTS[0].id, PRODUCTS[0].id, '']);
  assert.deepEqual(calls.map((q) => q.table), ['catalogue_categories', 'catalogue_products', 'catalogue_products']);
  assert.deepEqual(op(calls[0], 'eq').slice(1), ['store', 'grocery']);
  assert.match(op(calls[0], 'select')[1], /^id, store, parent_id, name, slug, tagline, image_url, sort_order, is_active$/);
  assert.deepEqual(opsNamed(calls[1], 'eq').map((o) => o.slice(1)), [['store', 'grocery'], ['is_active', true]]);
  assert.match(op(calls[1], 'select')[1], /\bimages\b.*\bnet_content\b.*\bstock\b/, 'the 0034 columns');
  assert.doesNotMatch(op(calls[1], 'select')[1], /\b(pack|image|price)\b/, 'schema names only in the query');
  assert.deepEqual(op(calls[2], 'in').slice(1), ['id', [PRODUCTS[0].id]]);
  assert.equal(cats.length, 10); assert.equal(prods.length, 4); assert.equal(some.length, 4, 'the stand-in answers with every row; the filter is the server\'s');
  const view = data.groceryProductView(PRODUCTS[2]);
  assert.equal(view.price, 142); assert.equal(view.mrp, 165); assert.equal(view.net_content, '1 L'); assert.deepEqual(view.images, ['/img/grocery-product-sunflower-oil.webp']);
  assert.ok(!('pack' in view) && !('image' in view));
  assert.deepEqual(await data.getGroceryProductsByIds([]), []);
});

await test('useGroceryCatalogue: a seeded catalogue renders synchronously (server rendering); the unseeded state is "loading" with nothing invented', () => {
  const seeded = loadGroceryData();
  const Probe = () => { const { status, categories, products } = seeded.useGroceryCatalogue(); return h('p', { 'data-status': status }, `${categories.length}/${products.length}`); };
  assert.equal(renderToStaticMarkup(h(Probe)), '<p data-status="ready">10/4</p>');
  const empty = loadGroceryData({ initial: null });
  const Probe2 = () => { const s = empty.useGroceryCatalogue(); return h('p', { 'data-status': s.status }, `${s.categories.length}/${s.products.length}`); };
  assert.equal(renderToStaticMarkup(h(Probe2)), '<p data-status="loading">0/0</p>');
  assert.deepEqual(Object.keys(seeded.getGroceryCatalogue()).sort(), ['categories', 'error', 'products', 'status']);
});

// ============================================================
console.log('\n— One cart cache for every store —');
// ============================================================

await test('fashionCartLine and groceryCartLine share the catalogue cart cache: a grocery row landing bumps the version the store subscribes to; the two stores never see each other\'s rows', async () => {
  const cache = loadModule('src/lib/catalogueCartCache.js', {});
  const data = loadGroceryData();
  const fashion = loadModule('src/lib/fashionCartLine.js', { ...cache, getFashionProductsByIds: async () => [] });
  const grocery = loadModule('src/lib/groceryCartLine.js', { ...cache, groceryProductView: data.groceryProductView, getGroceryProductsByIds: async (ids) => PRODUCTS.filter((p) => ids.includes(p.id)) });
  const before = fashion.getFashionCartVersion();
  let fired = 0; const unsub = fashion.subscribeFashionCart(() => { fired += 1; });
  await grocery.ensureGroceryProducts([PRODUCTS[0].id]);
  assert.ok(fashion.getFashionCartVersion() > before, 'the version the store reads through the fashion module moved');
  assert.equal(fired, 1);
  unsub();
  assert.ok(grocery.groceryProductFor(PRODUCTS[0].id)); assert.equal(fashion.fashionRowFor(PRODUCTS[0].id), null, 'a grocery id is unknown to the fashion store');
  assert.equal(fashion.isFashionIdResolved(PRODUCTS[0].id), false); assert.equal(grocery.isGroceryIdResolved(PRODUCTS[0].id), true);
  fashion.seedFashionCart([{ id: 'f1', name: 'F', fashion_variants: [] }]);
  assert.equal(grocery.groceryProductFor('f1'), null, 'a fashion id is unknown to the grocery store');
  grocery.resetGroceryCart();
  assert.equal(grocery.groceryProductFor(PRODUCTS[0].id), null); assert.ok(fashion.fashionRowFor('f1'), 'resetting one store leaves the other');
  assert.equal(cache.cacheKey('grocery', 7), 'grocery:7');
});

await test('store.jsx, the cart line rules, the quote and payment plumbing, checkout and the server are byte-identical to the baseline', () => {
  for (const rel of ['src/lib/store.jsx', 'src/lib/cartLine.js', 'src/lib/cartQuote.js', 'src/lib/couponApi.js', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'api/_lib/pricing.js', 'api/_lib/supabaseAdmin.js', 'api/razorpay/create-order.js']) {
    assert.equal(read(rel), atBaseline(rel), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  // The server keeps reading the fashion_* names — now the 0034 views.
  const admin = read('api/_lib/supabaseAdmin.js');
  assert.match(admin, /fashion_products\?select=/); assert.match(admin, /fashion_variants\?select=/);
});

// ============================================================
console.log('\n— Migration 0034 and its rollback —');
// ============================================================

await test('0034: store NOT NULL with a closed CHECK, immutable; slug unique per store; (store, slug) and (store, category_id) indexes; the media table with one primary; the views; the grocery seed with the ids the cart already uses', () => {
  assert.ok(has('supabase/migrations/0034_catalogue_multistore.sql'));
  const sql = read('supabase/migrations/0034_catalogue_multistore.sql');
  for (const t of ['catalogue_categories', 'catalogue_products', 'catalogue_variants']) {
    assert.match(sql, new RegExp(`alter table public\\.${t}\\s+add column if not exists store text not null default 'fashion';`));
    assert.match(sql, new RegExp(`alter table public\\.${t}\\s+alter column store drop default;`));
    assert.match(sql, new RegExp(`add constraint ${t}_store_chk check \\(store in \\('fashion', 'grocery'\\)\\);`));
    assert.match(sql, new RegExp(`create trigger trg_${t}_store before update of store on public\\.${t}`));
  }
  assert.match(sql, /rename to catalogue_categories;[\s\S]*rename to catalogue_products;[\s\S]*rename to catalogue_variants;/);
  assert.match(sql, /create unique index if not exists catalogue_products_store_slug_key\s+on public\.catalogue_products \(store, slug\);/);
  assert.match(sql, /create unique index if not exists catalogue_categories_store_parent_slug_key\s+on public\.catalogue_categories \(store, coalesce\(parent_id, '00000000-0000-0000-0000-000000000000'::uuid\), slug\);/);
  assert.match(sql, /create index if not exists catalogue_products_store_category_idx\s+on public\.catalogue_products \(store, category_id, sort_order\);/);
  assert.match(sql, /drop constraint if exists catalogue_products_slug_key;/, 'the global slug UNIQUE goes');
  for (const c of ['sku', 'hsn_code', 'gst_rate', 'net_content', 'stock']) assert.match(sql, new RegExp(`add column if not exists ${c}\\s`));
  assert.match(sql, /create unique index if not exists catalogue_products_store_sku_key\s+on public\.catalogue_products \(store, sku\) where sku is not null;/);
  assert.match(sql, /create table if not exists public\.catalogue_product_media \([\s\S]*?product_id\s+uuid not null references public\.catalogue_products\(id\) on delete cascade,[\s\S]*?is_primary\s+boolean not null default false/);
  assert.match(sql, /create unique index if not exists catalogue_product_media_one_primary_idx\s+on public\.catalogue_product_media \(product_id\) where is_primary;/);
  assert.match(sql, /create trigger trg_catalogue_product_media_sync\s+after insert or update or delete on public\.catalogue_product_media/);
  assert.match(sql, /cross join lateral unnest\(p\.images\) with ordinality/, 'images[] backfilled into media rows');
  for (const v of ['fashion_categories', 'fashion_products', 'fashion_variants']) assert.match(sql, new RegExp(`create or replace view public\\.${v} with \\(security_invoker = true\\) as[\\s\\S]*?where store = 'fashion';`));
  assert.match(sql, /check \(store <> 'fashion' or length\(trim\(colour\)\) > 0\)/, 'colour required for fashion only');
  for (const t of ['catalogue_categories', 'catalogue_products', 'catalogue_variants']) assert.match(sql, new RegExp(`create policy "${t} public read"`));
  assert.match(sql, /create policy "catalogue_product_media admin write"/);
  for (const p of PRODUCTS) { assert.match(sql.replace(/\s+/g, ' '), new RegExp(`\\('${p.id}', '${p.name}', '${p.slug}'`), `seeds ${p.slug} with the fixture id`); assert.ok(sql.includes(`'${p.sku}'`)); }
  for (const c of CATEGORIES) assert.ok(sql.includes(`'${c.slug}',`), `seeds ${c.slug}`);
  assert.match(sql, /notify pgrst, 'reload schema';/);
});

await test('the rollback restores the 0033 shape: views dropped first, non-fashion rows deleted, columns and media dropped, tables and names renamed back, the global slug UNIQUE and colour check re-created', () => {
  assert.ok(has('supabase/migrations/rollback/0034_catalogue_multistore_down.sql'));
  const sql = read('supabase/migrations/rollback/0034_catalogue_multistore_down.sql');
  const at = (re) => { const m = sql.search(re); assert.ok(m >= 0, `${re}`); return m; };
  const views = at(/drop view if exists public\.fashion_variants;/);
  const del = at(/delete from public\.catalogue_products\s+where store <> 'fashion';/);
  const media = at(/drop table if exists public\.catalogue_product_media;/);
  const cols = at(/drop column if exists store;/);
  const rename = at(/alter table public\.catalogue_products\s+rename to fashion_products;/);
  const slug = at(/add constraint fashion_products_slug_key unique \(slug\);/);
  const colour = at(/add constraint fashion_variants_colour_check check \(length\(trim\(colour\)\) > 0\);/);
  assert.ok(views < del && del < media && media < cols && cols < rename && rename < slug && slug < colour, 'in a safe order');
  for (const c of ['sku', 'hsn_code', 'gst_rate', 'net_content', 'stock']) assert.match(sql, new RegExp(`drop column if exists ${c};`));
  for (const p of ['fashion_categories public read', 'fashion_products admin write', 'fashion_variants admin read']) assert.match(sql, new RegExp(`create policy "${p}"`));
  assert.match(sql, /create or replace function public\.fashion_categories_guard\(\)/);
});

// ============================================================
console.log('\n— The fashion pages render byte-identically —');
// ============================================================

await test(`the eight fashion pages render byte-identically from the working tree and from the pre-change tree (${BASELINE_SHA})`, () => {
  // Export the baseline once into the OS temp dir and lend it this checkout's node_modules.
  const dir = join(tmpdir(), `sora-catalogue-baseline-${BASELINE_SHA}`);
  if (!existsSync(join(dir, 'src'))) {
    mkdirSync(dir, { recursive: true });
    const tar = join(dir, 'tree.tar');
    execFileSync('git', ['archive', '--format=tar', '-o', tar, BASELINE_SHA, 'src', 'scripts', 'img', 'public', 'package.json'], { cwd: REPO });
    execFileSync('tar', ['-xf', 'tree.tar'], { cwd: dir }); // relative: Windows tar reads a drive letter as a host
  }
  if (!existsSync(join(dir, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'junction');
  const dump = resolve(REPO, 'scripts/fashion-ssr-dump.mjs');
  const now = execFileSync(process.execPath, [dump], { cwd: REPO, encoding: 'utf8', env: { ...process.env, FASHION_SRC_ROOT: '' }, maxBuffer: 64 * 1024 * 1024 });
  const then = execFileSync(process.execPath, [dump], { cwd: REPO, encoding: 'utf8', env: { ...process.env, FASHION_SRC_ROOT: dir }, maxBuffer: 64 * 1024 * 1024 });
  const a = JSON.parse(now), b = JSON.parse(then);
  assert.deepEqual(Object.keys(a), Object.keys(b));
  for (const p of Object.keys(a)) assert.ok(a[p].length > 2000, `${p} rendered`);
  assert.equal(now, then, 'identical markup for every page');
  assert.match(a['/fashion/p/meadow-linen-shirt-sage?size=M&colour=Sage'], /fs-pick__note is-out/, 'the per-combination stock state survives');
  // And the FASHION source that renders those pages is untouched: only the data layer moved.
  for (const rel of ['src/fashion/FashionLayout.jsx', 'src/fashion/FashionHome.jsx', 'src/fashion/FashionListing.jsx', 'src/fashion/FashionProductPage.jsx', 'src/fashion/FashionProductCard.jsx', 'src/fashion/FashionCatalogue.jsx', 'src/fashion/FashionVariantPicker.jsx', 'src/styles/fashion.css']) {
    assert.equal(read(rel), atBaseline(rel), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
