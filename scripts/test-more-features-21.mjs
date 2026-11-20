// Round 21 (owner, 2026-11-20): the admin's Today panel, asking delivered customers for
// a review, and "Rate your purchase" for Fashion and Home & Living orders.
//   node scripts/test-more-features-21.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const R = { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, Icon: () => null, supabase: null };

test('today: orders to ship are paid, or cash on delivery not cancelled, and not yet out; delivered in 60 days', () => {
  const d = loadModule('src/admin/pages/Dashboard.jsx', { ...R, adminListProducts: async () => [], adminListCategories: async () => [], adminImportBiosashCatalog: async () => ({}), adminSeedDefaultCategories: async () => {} });
  const now = Date.parse('2026-11-20T12:00:00Z');
  const t = d.orderTodo([
    { payment_status: 'paid', fulfillment_status: null },
    { payment_status: 'paid', fulfillment_status: 'processing' },
    { payment_status: 'pending', payment_method: 'cod', fulfillment_status: 'unfulfilled', status: 'pending' },
    { payment_status: 'pending', payment_method: 'cod', status: 'cancelled' },
    { payment_status: 'pending', payment_method: 'razorpay' },
    { payment_status: 'paid', fulfillment_status: 'shipped' },
    { payment_status: 'paid', fulfillment_status: 'delivered', delivered_at: '2026-11-01T00:00:00Z' },
    { payment_status: 'paid', fulfillment_status: 'delivered', delivered_at: '2026-08-01T00:00:00Z' },
  ], now);
  assert.deepEqual(t, { toShip: 3, delivered60: 1 });
});
test('asking for a review: polite, no incentive, the orders page, an Indian mobile only', () => {
  const o = loadModule('src/admin/pages/Orders.jsx', { ...R, Fragment: 'f', toCsv: () => '', downloadCsv: () => {}, adminListOrders: async () => [], adminUpdateOrderFulfillment: async () => ({}), adminMarkCodCollected: async () => ({}), adminListOrderEvents: async () => [], money: String, FULFILLMENT_STATUSES: [], fulfillmentStatusLabel: String, validateFulfillmentInput: () => ({}) });
  const order = { order_number: 'SL-9', customer: { firstName: 'Asha Rani', phone: '98765 43210' } };
  const text = o.reviewAskText(order);
  assert.match(text, /^Hi Asha, this is SORA LIFESTYLE\. Your order SL-9 was delivered/);
  assert.match(text, /https:\/\/www\.soralifestyle\.in\/account\/orders/);
  assert.ok(!/discount|coupon|free|reward|%/i.test(text), 'no incentive for a review');
  assert.match(o.reviewAskHref(order), /^https:\/\/wa\.me\/919876543210\?text=/);
  assert.equal(o.reviewAskHref({ customer: { phone: '123' } }), '');
  assert.match(read('src/admin/pages/Orders.jsx'), /o\.fulfillment_status === 'delivered' && reviewAskHref\(o\) &&/);
});
test('rate your purchase: wellness by product, Fashion and Home & Living by slug; delivered only', () => {
  const a = read('src/pages/Account.jsx');
  assert.match(a, /export function rateLink\(order, catalogueSlugs = \{\}\) \{\n  if \(!order \|\| order\.fulfillment_status !== 'delivered'\) return '';/);
  assert.match(a, /`\$\{c\.catalogue === 'homeliving' \? '\/homeliving\/p\/' : '\/fashion\/p\/'\}\$\{catalogueSlugs\[c\.product_id\]\}#reviews`/);
  assert.match(a, /rateLink\(o, catSlugs\)/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
