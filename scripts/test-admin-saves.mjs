// ============================================================
// Admin saves that quietly changed live data (stage-two audit, 2026-10-24):
//   7  a wellness pack-size save wrote its stock back from the form, with no
//      check that the row had not moved — since 0039 an order takes stock, so
//      a form opened before a sale put the sold unit back on sale;
//   1  every product save from the editor or the Pricing screen wrote
//      sort_order 0, dropping the product out of its place in the shop;
//   2  the Pricing screen saved the whole product row it loaded when the page
//      opened — name, description, image, stock flag, active state — with no
//      check, so a price change could re-list a delisted product.
// Plus the record of who pressed "Mark cash collected" (migration 0040; the
// route itself is pinned in test-order-confirmation.mjs).
//
// src/lib/adminApi.js builds the browser Supabase client, so it cannot load
// under node: its functions are lifted from the source and run as written
// against a stand-in client that records every query and can answer as if
// the row had moved or gone.
//   node scripts/test-admin-saves.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeContentPatch } from '../src/lib/productContent.js';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const api = read('src/lib/adminApi.js');
const liftFn = (name) => {
  const m = new RegExp(`(?:export )?(?:async )?function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`).exec(api);
  assert.ok(m, `${name} found in adminApi.js`);
  return m[0].replace(/^export /, '');
};
const staleClass = /export class StaleWriteError[\s\S]*?\n\}\n/.exec(api)[0].replace(/^export /, '');
const NAMES = ['stockToDbBoolean', 'stockFromDbValue', 'dbRowToProduct', 'priceColumns', 'productToDbRow', 'updateUnlessMoved',
  'adminUpdateProduct', 'adminUpdateProductPrice', 'variantRow', 'adminUpdateVariant', 'adminSetVariantActive'];

/** adminApi.js's functions, wired to a stand-in client. `moved`/`gone` answer the guarded UPDATE with no rows. */
function load({ moved = false, gone = false } = {}) {
  const log = [];
  const from = (table) => {
    const q = { table, op: 'select', payload: null, filters: [] };
    log.push(q);
    const chain = {
      update(p) { q.op = 'update'; q.payload = p; return chain; },
      select() { return chain; },
      eq(c, v) { q.filters.push(`${c}=${v}`); return chain; },
      maybeSingle() { q.one = true; return chain; },
      then(resolve, reject) {
        const data = q.op === 'update'
          ? (moved || gone ? [] : [{ id: 'row-1', updated_at: q.payload.updated_at, ...q.payload }])
          : (q.one ? (gone ? null : { id: 'row-1' }) : []);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return chain;
  };
  const fns = new Function('supabase', 'normalizeContentPatch', 'IN_STOCK_QTY',
    `${staleClass}\n${NAMES.map(liftFn).join('\n')}\nreturn { StaleWriteError, ${NAMES.join(', ')} };`)({ from }, normalizeContentPatch, 40);
  return { log, ...fns };
}
const refused = async (promise, re) => {
  try { await promise; } catch (e) { assert.equal(e.isStaleWrite, true, `a stale-write refusal, got: ${e.message}`); if (re) assert.match(e.message, re); return; }
  assert.fail('expected the save to be refused');
};

console.log('\n— 7. A pack-size save cannot put back stock an order took —');

await test('V1 the save is refused without the version the editor opened, before anything is written', async () => {
  const a = load();
  await refused(a.adminUpdateVariant('v750', 2, { label: '750 ml', mrp: 1400, stock: 10 }, null), /did not record which version/);
  assert.equal(a.log.length, 0);
});

await test('V2 with that version it writes only if the row still carries it, and stamps a new one', async () => {
  const a = load();
  await a.adminUpdateVariant('v750', 2, { label: '750 ml', mrp: 1400, sale_price: 1250, stock: 10 }, '2026-10-24T10:00:00Z');
  const q = a.log[0];
  assert.equal(q.table, 'product_variants');
  assert.deepEqual(q.filters, ['id=v750', 'updated_at=2026-10-24T10:00:00Z']);
  assert.equal(q.payload.stock, 10);
  assert.ok(q.payload.updated_at && q.payload.updated_at !== '2026-10-24T10:00:00Z', 'a fresh updated_at');
});

await test('V3 a row that moved (an order took stock) is refused and says so; a deleted row says that instead', async () => {
  await refused(load({ moved: true }).adminUpdateVariant('v750', 2, { stock: 10 }, '2026-10-24T10:00:00Z'), /An order may have taken stock from it/);
  await refused(load({ gone: true }).adminUpdateVariant('v750', 2, { stock: 10 }, '2026-10-24T10:00:00Z'), /no longer exists/);
});

await test('V4 switching a pack size on or off moves its updated_at, so an open editor is refused too', async () => {
  const a = load();
  await a.adminSetVariantActive('v750', false);
  assert.equal(a.log[0].payload.is_active, false);
  assert.ok(a.log[0].payload.updated_at);
});

await test('V5 the Variants screen sends the version it opened, and closes a refused editor instead of leaving the old stock one click away', () => {
  const page = code('src/admin/pages/Variants.jsx');
  assert.match(page, /setEditingVersion\(v\.updated_at \|\| null\);/);
  assert.match(page, /await adminUpdateVariant\(editingId, productId, form, editingVersion\);/);
  assert.match(page, /if \(e2\.isStaleWrite\) \{ setEditingId\(null\); await reload\(\); \}\n\s+setErr\(e2\.message \|\| String\(e2\)\);/, 'closed, reloaded, and the message set after the reload clears the banner');
});

console.log('\n— 1. Saving a product keeps its place in the shop —');

await test('P1 a save that carries no sortOrder writes no sort_order; one that carries it writes it unchanged', () => {
  const a = load();
  assert.equal('sort_order' in a.productToDbRow({ name: 'Juice', originalPrice: 1000 }), false);
  assert.equal(a.productToDbRow({ name: 'Juice', originalPrice: 1000, sortOrder: 7 }).sort_order, 7);
  assert.equal(a.productToDbRow({ name: 'Juice', originalPrice: 1000, sortOrder: 0 }).sort_order, 0);
});

await test('P2 the product editor\'s own payload leaves the position alone', () => {
  const form = code('src/admin/pages/ProductForm.jsx');
  const payload = /const payload = \{([\s\S]*?)\n\s+\};/.exec(form)[1];
  assert.doesNotMatch(payload, /sortOrder/, 'the editor sends no position');
  const a = load();
  const row = a.productToDbRow({ name: 'Juice', slug: 'juice', description: 'd', category: 'wellness', image: '/img/x.png', gallery: [],
    originalPrice: 1000, discountPercent: 10, form: '750 ml', inStock: true, permalink: null, isNew: false, isBestseller: true,
    isFeatured: false, rating: 4, reviewCount: 2, isActive: true, brand: 'B', netContent: null, keyClaims: [], benefits: [],
    ingredients: [], howToUse: '', specifications: [] });
  assert.equal('sort_order' in row, false);
});

console.log('\n— 2. A price change writes the price and nothing else —');

await test('Q1 the price write sets MRP, discount, sale price and updated_at — and only if the product has not moved', async () => {
  const a = load();
  await a.adminUpdateProductPrice(42, { originalPrice: '1200', discountPercent: 15 }, '2026-10-24T10:00:00Z');
  const q = a.log[0];
  assert.equal(q.table, 'products');
  assert.deepEqual(Object.keys(q.payload).sort(), ['discount_percent', 'original_price', 'sale_price', 'updated_at']);
  assert.deepEqual([q.payload.original_price, q.payload.discount_percent, q.payload.sale_price], [1200, 15, 1020]);
  assert.deepEqual(q.filters, ['id=42', 'updated_at=2026-10-24T10:00:00Z']);
});

await test('Q2 refused without a version, refused below ₹1, and refused when the product moved', async () => {
  await refused(load().adminUpdateProductPrice(42, { originalPrice: 1200, discountPercent: 0 }, null));
  await assert.rejects(load().adminUpdateProductPrice(42, { originalPrice: 0, discountPercent: 0 }, 'v'), /at least ₹1/);
  await refused(load({ moved: true }).adminUpdateProductPrice(42, { originalPrice: 1200, discountPercent: 0 }, 'v'), /^This product was modified elsewhere after you opened it\. Reload the page/);
});

await test('Q3 the Pricing screen uses that write, with the version it loaded, and reloads on a refusal keeping unsaved edits', () => {
  const page = code('src/admin/pages/Pricing.jsx');
  assert.match(page, /import \{ adminListProducts, adminUpdateProductPrice \} from '\.\.\/\.\.\/lib\/adminApi\.js';/);
  assert.doesNotMatch(page, /adminUpdateProduct\(/, 'never the whole-row write');
  assert.match(page, /await adminUpdateProductPrice\(p\.dbId, \{ originalPrice: v\.originalPrice, discountPercent: v\.discountPercent \}, p\.updatedAt\);/);
  assert.match(page, /if \(ex\.isStaleWrite\) \{ try \{ setProducts\(await adminListProducts\(\)\); \}/);
});

await test('Q4 the product editor\'s guarded save behaves exactly as before (same refusal wording)', async () => {
  await refused(load({ moved: true }).adminUpdateProduct(42, { name: 'Juice', originalPrice: 1000 }, 'v'),
    /^This product was modified elsewhere after you opened it\. Reload the page to see the current values, then reapply your changes\.$/);
  await refused(load({ gone: true }).adminUpdateProduct(42, { name: 'Juice', originalPrice: 1000 }, 'v'),
    /^This product no longer exists\. It may have been deleted while you were editing\.$/);
  const a = load();
  await a.adminUpdateProduct(42, { name: 'Juice', originalPrice: 1000 });
  assert.deepEqual(a.log[0].filters, ['id=42'], 'a caller with no version keeps last-write-wins');
});

console.log('\n— Who pressed "Mark cash collected" —');

await test('M1 migration 0040: an admin-read-only record, written only with the paid transition, by the server', () => {
  const sql = read('supabase/migrations/0040_order_admin_events.sql');
  const statements = sql.replace(/--[^\n]*/g, '');
  assert.match(statements, /create table if not exists public\.order_admin_events \(/);
  assert.match(statements, /alter table public\.order_admin_events enable row level security;/);
  assert.match(statements, /revoke insert, update, delete, truncate on public\.order_admin_events from anon, authenticated;/);
  assert.doesNotMatch(statements, /security definer/i);
  assert.match(statements, /security invoker/);
  assert.match(statements, /revoke all on function public\.mark_cod_collected\(uuid, uuid, text, text\) from public, anon, authenticated;\ngrant execute on function public\.mark_cod_collected\(uuid, uuid, text, text\) to service_role;/);
  assert.match(statements, /returning \* into v;\n\n\s+if not found then\n\s+return null;\n\s+end if;\n\n\s+insert into public\.order_admin_events/, 'the event is written only when the order became paid');
  assert.match(read('supabase/migrations/rollback/0040_order_admin_events_down.sql'), /drop table if exists public\.order_admin_events;/);
});

await test('M2 the Orders page shows who collected the cash, from the record', () => {
  const page = code('src/admin/pages/Orders.jsx');
  assert.match(page, /<dt>Cash collected by<\/dt><dd>\{e\.admin_email \|\| 'an admin \(no email on record\)'\} · \{dt\(e\.created_at\)\}<\/dd>/);
  assert.match(page, /if \(opening\) loadEvents\(order\.id\);/);
  assert.match(page, /if \(patch\.payment_status === 'paid'\) loadEvents\(patch\.id\);/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
