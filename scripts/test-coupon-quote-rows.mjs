// ============================================================
// A coupon on a cart that holds a fashion line. Offline suite.
//
// priceCart fetches both catalogues' rows and returns them; quoteCoupon then
// RE-PRICES the cart with the coupon applied. It used to pass only
// variantRows to that second call, so the fashion branch of computeOrderTotal
// saw an empty fashion product map and refused the whole cart — every coupon
// on a cart holding a fashion item failed with "One or more items are no
// longer available.", while the same cart priced correctly without a coupon.
//
// The existing assertion in test-fashion-cart.mjs did not catch this: it
// matches the SOURCE TEXT of priceCart's call site, and it calls
// computeOrderTotal directly rather than going through quoteCoupon. This
// suite exercises quoteCoupon itself, with Supabase stubbed, so the defect
// cannot come back through either door.
//
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-coupon-quote-rows.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-coupon-quote-rows.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ROOT, read, loadModule, loadSource } from './grocery-ssr.mjs';
import { atCommit } from './baseline-export.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
console.log(`\nsource root: ${ROOT}`);

const load = (rel) => import(pathToFileURL(resolve(ROOT, rel)).href);

// ---- the rows a stubbed Supabase hands back ---------------------------------
const WELLNESS = { id: 11, biosash_id: 'b183', name: 'Wellness Item', original_price: 250, sale_price: 236, discount_percent: 0, is_active: true, stock: true };
const SHIRT = { id: 'p-shirt', name: 'Meadow Linen Shirt', slug: 'meadow-linen-shirt', mrp: 1299, sale_price: 1099, is_active: true };
const SHIRT_VAR = { id: 'v-m-navy', product_id: 'p-shirt', size: 'M', colour: 'Navy', sku: 'SH-M-NV', stock: 5, price_override: null, is_active: true };
// A Home & Living product without options (catalogue_products, store 'homeliving').
const TOWELS = { id: 'h-towels', name: 'Bath Towel Set', slug: 'bath-towel-set', sku: 'SL-HL-TWL-2', mrp: 949, sale_price: 799, stock: 5, is_active: true };
const COUPON = { id: 'c1', code: 'TEN', type: 'percent', value: 10, max_discount: 0, min_order_value: 0, is_active: true, usage_limit: null, per_user_limit: null, starts_at: null, ends_at: null, first_order_only: false };

// One PostgREST-shaped stub. `rest()` in supabaseAdmin builds a path string;
// this answers by table name, exactly as the real project's rows would.
function stubFetch() {
  return async (url) => {
    const path = String(url).split('/rest/v1/')[1] || '';
    const table = path.split('?')[0];
    const rows = table === 'products' ? [WELLNESS]
      : table === 'product_variants' ? []
      : table === 'fashion_products' ? [SHIRT]
      : table === 'fashion_variants' ? [SHIRT_VAR]
      : table === 'catalogue_products' ? [TOWELS]
      : table === 'coupons' ? [COUPON]
      : [];
    return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
  };
}

const cfg = { url: 'https://stub.supabase.co', serviceKey: 'stub-service-key' };
const FASHION_LINE = { catalogue: 'fashion', id: 'p-shirt', qty: 1, variantId: 'v-m-navy' };
const WELLNESS_LINE = { id: 'b183', qty: 2 };

let quoteMod = null, realFetch = globalThis.fetch;
try { quoteMod = await load('api/_lib/couponQuote.js'); } catch (e) { console.error(e); }

await test('priceCart returns both catalogues\' rows for a mixed cart', async () => {
  assert.ok(quoteMod, 'api/_lib/couponQuote.js loads');
  globalThis.fetch = stubFetch();
  try {
    const priced = await quoteMod.priceCart([WELLNESS_LINE, FASHION_LINE], 'std', cfg);
    assert.equal(priced.ok, true, priced.error);
    assert.equal(priced.fashionProductRows.length, 1, 'the fashion product row came back');
    assert.equal(priced.fashionVariantRows.length, 1, 'the fashion variant row came back');
    assert.equal(priced.base.subtotal, 472 + 1099);
  } finally { globalThis.fetch = realFetch; }
});

await test('quoteCoupon re-prices a cart holding a fashion line instead of refusing it — the rows priceCart fetched reach the second call', async () => {
  globalThis.fetch = stubFetch();
  try {
    const priced = await quoteMod.priceCart([WELLNESS_LINE, FASHION_LINE], 'std', cfg);
    assert.equal(priced.ok, true, priced.error);
    const quoted = await quoteMod.quoteCoupon('TEN', priced, 'std', { userId: null, hasPriorPaidOrder: false }, cfg);
    assert.equal(quoted.ok, true, `refused: ${quoted.message || quoted.reason}`);
    // 10% of 1571, whole rupees — the same figure create-order charges.
    assert.equal(quoted.totals.breakdown.couponDiscount, 157);
    assert.equal(quoted.totals.total, 1571 - 157);
    // The fashion line survived the re-price with its own trusted figure.
    const fashionLine = quoted.totals.lines.find((l) => l.catalogue === 'fashion');
    assert.ok(fashionLine, 'the fashion line is still in the priced order');
    assert.equal(fashionLine.unit_price, 1099);
  } finally { globalThis.fetch = realFetch; }
});

await test('a fashion-only cart takes a coupon too — the case that failed outright', async () => {
  globalThis.fetch = stubFetch();
  try {
    const priced = await quoteMod.priceCart([FASHION_LINE], 'std', cfg);
    assert.equal(priced.ok, true, priced.error);
    const quoted = await quoteMod.quoteCoupon('TEN', priced, 'std', { userId: null, hasPriorPaidOrder: false }, cfg);
    assert.equal(quoted.ok, true, `refused: ${quoted.message || quoted.reason}`);
    assert.equal(quoted.totals.breakdown.couponDiscount, 110); // 10% of 1099
    assert.equal(quoted.totals.total, 1099 - 110);
  } finally { globalThis.fetch = realFetch; }
});

await test('the source itself: every computeOrderTotal call in the quote path is handed the rows fetchCartRows returned', () => {
  const src = read('api/_lib/couponQuote.js');
  const calls = [...src.matchAll(/computeOrderTotal\([\s\S]*?\n\s*\}\);/g)].map((m) => m[0]);
  assert.equal(calls.length, 2, 'priceCart and quoteCoupon');
  for (const call of calls) {
    assert.match(call, /fashionProductRows/, 'a computeOrderTotal call without the fashion product rows refuses every fashion line');
    assert.match(call, /fashionVariantRows/, 'and without the variant rows it cannot price one');
  }
});

// The Cart page's offers panel asks /api/coupons/eligible about the same basket.
// It used to send each line as [id, qty, variantId] and drop the catalogue, so
// a fashion or Home & Living line arrived as a wellness id and the whole list
// came back empty. The component is called with its hooks injected, so the
// request it builds is the request it really sends.
await test('the offers panel sends the catalogue with each line: a cart holding a fashion or Home & Living item is priced for its offers, and a wellness request is unchanged', async () => {
  const requestOf = (source) => {
    const calls = [];
    const mod = loadSource(source, {
      Icon: () => null, money: (n) => `₹${n}`, normalizeCouponCode: (c) => c,
      fetchEligibleCoupons: async ({ items }) => { calls.push(items); return { applicable: [], unlockable: [] }; },
      useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
      useEffect: (fn) => { fn(); },
    });
    return (lines) => { calls.length = 0; mod.default({ items: lines, code: '', quote: { status: 'idle' }, onApply() {}, onRemove() {} }); return calls[0]; };
  };
  const before = requestOf(atCommit('8ca5caa', 'src/components/CartCoupons.jsx'));
  const after = requestOf(read('src/components/CartCoupons.jsx'));
  const api = loadModule('src/lib/couponApi.js', { supabase: {}, getVisitorId: () => 'v' });
  const wellness = [{ key: 'b183', id: 'b183', qty: 2, variantId: null }, { key: 'b777::v750', id: 'b777', qty: 1, variantId: 'v750' }];
  assert.equal(JSON.stringify(api.cartToPayload(after(wellness))), JSON.stringify(api.cartToPayload(before(wellness))), 'a wellness request is byte-for-byte what it was');
  const mixed = [{ key: 'b183', id: 'b183', qty: 2, variantId: null }, { key: 'f', catalogue: 'fashion', id: 'p-shirt', qty: 1, variantId: 'v-m-navy' }, { key: 'h', catalogue: 'homeliving', id: 'h-towels', qty: 1, variantId: null }, { key: 'g', catalogue: 'grocery', id: 'g-rice', qty: 1, variantId: null }];
  assert.deepEqual(api.cartToPayload(before(mixed)).map((l) => l.catalogue ?? null), [null, null, null, null], 'the marker used to be dropped');
  assert.deepEqual(api.cartToPayload(after(mixed)).map((l) => l.catalogue ?? null), [null, 'fashion', 'homeliving', null], 'fashion and Home & Living carry it; grocery still carries nothing');
  globalThis.fetch = stubFetch();
  try {
    const basket = mixed.slice(0, 3); // a grocery line never reaches the server: the cart blocks it first
    const was = await quoteMod.priceCart(api.cartToPayload(before(basket)), 'std', cfg);
    assert.equal(was.ok, false, 'without the marker the basket was refused — the empty offers list');
    const now = await quoteMod.priceCart(api.cartToPayload(after(basket)), 'std', cfg);
    assert.equal(now.ok, true, now.error);
    assert.equal(now.base.subtotal, 472 + 1099 + 799, 'every line priced for the offers it qualifies for');
  } finally { globalThis.fetch = realFetch; }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
