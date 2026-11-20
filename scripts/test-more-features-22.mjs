// Round 22 (owner, 2026-11-20): a packing slip to print, a "shipped" WhatsApp message with
// the tracking link, and orders per day in Insights.
//   node scripts/test-more-features-22.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const R = { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, Icon: () => null, supabase: null };
const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const orders = () => loadModule('src/admin/pages/Orders.jsx', { ...R, Fragment: 'f', toCsv: () => '', downloadCsv: () => {}, adminListOrders: async () => [], adminUpdateOrderFulfillment: async () => ({}), adminMarkCodCollected: async () => ({}), adminListOrderEvents: async () => [], money, FULFILLMENT_STATUSES: [], fulfillmentStatusLabel: String, validateFulfillmentInput: () => ({}) });

test('packing slip: ship-to, items and qty, no prices; unpaid COD says what to collect', () => {
  const o = orders();
  const order = { order_number: 'SL-12', created_at: '2026-11-19T10:00:00Z', payment_method: 'cod', payment_status: 'pending', amount_paise: 249900,
    customer: { firstName: 'Asha', lastName: 'Rani', address: '12 MG Road', city: 'Pune', state: 'MH', pin: '411001', phone: '9876543210' },
    items: [{ name: 'Rider jacket', variant: 'M (40)', qty: 1, unit_price: 2000, sku: 'DL-1' }, { name: 'Wallet', qty: 2, unit_price: 249 }] };
  const s = o.packingSlip(order);
  assert.equal(s.orderNumber, 'SL-12');
  assert.match(s.shipTo, /Asha Rani\n12 MG Road\nPune, MH - 411001\nPhone: 9876543210/);
  assert.deepEqual(s.items.map((l) => [l.name, l.variant, l.qty]), [['Rider jacket', 'M (40)', 1], ['Wallet', '', 2]]);
  assert.equal(s.units, 3);
  assert.equal(s.collect, '₹2,499');
  assert.ok(!JSON.stringify(s.items).includes('2000'), 'no prices on the slip');
  assert.equal(o.packingSlip({ ...order, payment_status: 'paid' }).collect, '');
  assert.equal(o.packingSlip({ ...order, payment_method: 'razorpay', payment_status: 'paid' }).collect, '');
  assert.equal(o.packingSlip({}).units, 0);
});
test('packing slip: hidden on screen, alone on paper; a button opens print', () => {
  const css = read('src/admin/admin.css');
  assert.match(css, /\.adm-slip \{ display: none; \}/);
  assert.match(css, /body\.adm-printing-slip \* \{ visibility: hidden !important; \}/);
  const src = read('src/admin/pages/Orders.jsx');
  assert.match(src, /onClick=\{\(\) => printSlip\(o\)\}>\s*Print packing slip/);
  assert.match(src, /\{slipOrder && <PackingSlip order=\{slipOrder\} \/>\}/);
});
test('shipped message: courier, tracking number and link; falls back to the orders page; Indian mobile only', () => {
  const o = orders();
  const order = { order_number: 'SL-12', carrier_name: 'Delhivery', tracking_number: 'AWB123', tracking_url: 'https://track.example/AWB123', customer: { firstName: 'Asha Rani', phone: '+91 98765 43210' } };
  assert.equal(o.shippedText(order), 'Hi Asha, this is SORA LIFESTYLE. Your order SL-12 is on its way with Delhivery. Tracking number: AWB123. Track it here: https://track.example/AWB123');
  assert.match(o.shippedText({ order_number: 'SL-1', tracking_url: 'javascript:alert(1)' }), /Track it here: https:\/\/www\.soralifestyle\.in\/account\/orders$/);
  assert.match(o.shippedHref(order), /^https:\/\/wa\.me\/919876543210\?text=Hi%20Asha/);
  assert.equal(o.shippedHref({ customer: { phone: '12' } }), '');
  assert.match(read('src/admin/pages/Orders.jsx'), /o\.fulfillment_status === 'shipped' && shippedHref\(o\) &&/);
});
test('orders per day: real orders only, India dates, every day present', () => {
  const i = loadModule('src/admin/pages/Insights.jsx', { ...R, money, toCsv: () => '', downloadCsv: () => {} });
  const now = Date.parse('2026-11-20T12:00:00Z');
  const rows = i.ordersPerDay([
    { created_at: '2026-11-20T05:00:00Z', payment_status: 'paid' },
    { created_at: '2026-11-19T20:00:00Z', payment_status: 'paid' }, // 20 Nov 01:30 IST
    { created_at: '2026-11-19T06:00:00Z', payment_method: 'cod', payment_status: 'pending' },
    { created_at: '2026-11-19T07:00:00Z', payment_method: 'cod', fulfillment_status: 'cancelled' },
    { created_at: '2026-11-19T08:00:00Z', payment_method: 'razorpay', payment_status: 'failed' },
    { created_at: '2026-11-01T08:00:00Z', payment_status: 'paid' },
  ], 7, now);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.slice(-2).map((r) => [r.day, r.n]), [['2026-11-19', 1], ['2026-11-20', 2]]);
  assert.equal(rows.reduce((t, r) => t + r.n, 0), 3);
  assert.equal(rows[0].day, '2026-11-14');
});
test('insights: the period start is set before any query uses it', () => {
  const src = read('src/admin/pages/Insights.jsx');
  assert.ok(src.indexOf('const since =') < src.indexOf(".gte('created_at', since)"));
});

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
