// ============================================================
// One idempotency key, one submission.
//
// The checkout used to hold a single key for the whole visit. After a closed
// Razorpay window the next Pay reused it, and create-order replayed the FIRST
// order: an address corrected in between was dropped (the order shipped to
// the old one), and choosing Cash on delivery reopened Razorpay.
//
// Two halves, both pinned here:
//   * the browser mints a new key whenever the request it sends changes
//     (keyForSubmission in src/lib/payments.js, used by Checkout.jsx);
//   * create-order refuses a key replayed with a different request (409,
//     idempotencyConflict) instead of handing back the old order.
//
// Runs the real handler against the in-memory Supabase/Razorpay double; no
// network.
//   node scripts/test-checkout-replay.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, mockRes } from './lib/payment-test-harness.mjs';

const createOrder = (await import('../api/razorpay/create-order.js')).default;

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// The handlers log refusals by design; keep the output to the results.
console.error = () => {}; console.warn = () => {};

const PRODUCTS = [
  { id: 1, biosash_id: 'b1', name: 'Biosip', original_price: 199, discount_percent: 0, sale_price: 199, is_active: true, stock: true },
  { id: 2, biosash_id: 'b2', name: 'Juice', original_price: 1000, discount_percent: 0, sale_price: 1000, is_active: true, stock: true },
];
const VARIANTS = [{ id: 'v750', product_id: 2, label: '750 ml', mrp: 1400, sale_price: 1300, stock: 9, is_active: true }];
const FASHION = [{ id: 'f-1', name: 'Linen Shirt', slug: 'linen-shirt', mrp: 1999, sale_price: 1499, is_active: true }];
const FASHION_VARIANTS = [{ id: 'fv-m', product_id: 'f-1', size: 'M', colour: 'White', sku: 'LS-M-W', stock: 4, price_override: null, is_active: true }];
const COUPONS = [{ id: 'c1', code: 'SAVE10', type: 'flat', value: 10, min_order_value: 0, used_count: 0, is_active: true }];
const CUSTOMER = {
  email: 'asha@example.com', phone: '9876543210', firstName: 'Asha', lastName: 'K',
  address: '12 MG Road', apartment: '', landmark: '', city: 'Ludhiana', state: 'Punjab', pin: '141001',
};

/** The harness, plus the fashion view reads it does not speak. */
function world(seed = {}) {
  const w = makeWorld({ products: PRODUCTS, variants: VARIANTS, coupons: COUPONS, ...seed });
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const rel = url.pathname.replace('/rest/v1/', '');
    const ids = () => { const m = /in\.\((.*)\)/.exec(url.searchParams.get('id') || ''); return m ? m[1].split(',').map((s) => s.replace(/"/g, '')) : []; };
    const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (rel === 'fashion_products') return json(FASHION.filter((p) => ids().includes(p.id)));
    if (rel === 'fashion_variants') return json(FASHION_VARIANTS.filter((v) => ids().includes(v.id)));
    return inner(input, init);
  };
  return w;
}

let ip = 0;
async function submit(body, key) {
  const res = mockRes();
  await createOrder({ method: 'POST', headers: { 'idempotency-key': key, 'x-forwarded-for': `10.9.0.${(ip++ % 250) + 1}` }, body }, res);
  return res;
}
const request = (over = {}) => ({
  items: [{ id: 'b2', qty: 1, variantId: null, variant: null }],
  delivery: 'std', customer: CUSTOMER, paymentMethod: 'online', couponCode: null, ...over,
});

console.log('\n— create-order: a key replays only the request it was minted for —');

await test('R1 the same request again replays the first order (a retry is still one order)', async () => {
  const w = world();
  const a = await submit(request(), 'key-r1-aaaaaaaa');
  const b = await submit(request(), 'key-r1-aaaaaaaa');
  assert.equal(a.statusCode, 200);
  assert.equal(b.statusCode, 200);
  assert.equal(b.body.duplicate, true);
  assert.equal(b.body.razorpayOrderId, a.body.razorpayOrderId);
  assert.equal(w.orders.length, 1);
  assert.equal(w.calls.razorpayOrders, 1, 'no second gateway order');
});

await test('R2 a corrected address under the old key is refused, and the stored order is untouched', async () => {
  const w = world();
  await submit(request(), 'key-r2-aaaaaaaa');
  const res = await submit(request({ customer: { ...CUSTOMER, address: '14 MG Road', pin: '141002' } }), 'key-r2-aaaaaaaa');
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.idempotencyConflict, true);
  assert.equal(res.body.razorpayOrderId, undefined, 'no payable order handed back');
  assert.equal(w.orders.length, 1);
  assert.equal(w.orders[0].customer.pin, '141001');
  assert.equal(w.calls.razorpayOrders, 1);
});

await test('R3 Cash on delivery under the key of an online attempt is refused — Razorpay is not reopened', async () => {
  const w = world();
  await submit(request(), 'key-r3-aaaaaaaa');
  const res = await submit(request({ paymentMethod: 'cod' }), 'key-r3-aaaaaaaa');
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.idempotencyConflict, true);
  assert.notEqual(res.body.paymentMethod, 'razorpay');
  assert.deepEqual(w.orders.map((o) => o.payment_method), ['razorpay'], 'no COD order written under the old key');
});

await test('R4 a changed basket, delivery or coupon under the old key is refused', async () => {
  for (const [label, over] of [
    ['quantity', { items: [{ id: 'b2', qty: 2 }] }],
    ['an added line', { items: [{ id: 'b2', qty: 1 }, { id: 'b1', qty: 1 }] }],
    ['a pack size', { items: [{ id: 'b2', qty: 1, variantId: 'v750' }] }],
    ['a coupon', { couponCode: 'SAVE10' }],
    ['an email', { customer: { ...CUSTOMER, email: 'asha.k@example.com' } }],
  ]) {
    const w = world();
    await submit(request(), 'key-r4-aaaaaaaa');
    const res = await submit(request(over), 'key-r4-aaaaaaaa');
    assert.equal(res.statusCode, 409, `${label}: refused`);
    assert.equal(w.orders.length, 1, `${label}: nothing new written`);
  }
});

await test('R5 a retry matches however the coupon code was typed, and with an unknown delivery read as Standard', async () => {
  const w = world();
  await submit(request({ couponCode: 'SAVE10' }), 'key-r5-aaaaaaaa');
  const res = await submit(request({ couponCode: '  save10 ', delivery: 'express' }), 'key-r5-aaaaaaaa');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.duplicate, true);
  assert.equal(w.orders.length, 1);
});

await test('R6 fashion and pack-size lines replay too (catalogue, product and variant all compared)', async () => {
  const w = world();
  const items = [
    { id: 'f-1', qty: 2, variantId: 'fv-m', variant: 'M · White', catalogue: 'fashion' },
    { id: 'b2', qty: 1, variantId: 'v750', variant: '750 ml' },
  ];
  const a = await submit(request({ items }), 'key-r6-aaaaaaaa');
  assert.equal(a.statusCode, 200, JSON.stringify(a.body));
  const again = await submit(request({ items: [...items].reverse() }), 'key-r6-aaaaaaaa');
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.duplicate, true, 'line order does not matter');
  const other = await submit(request({ items: [{ ...items[0], variantId: 'fv-x' }, items[1]] }), 'key-r6-aaaaaaaa');
  assert.equal(other.statusCode, 409, 'another size is another order');
  assert.equal(w.orders.length, 1);
});

await test('R7 a COD retry replays its order; a changed COD request does not', async () => {
  const w = world();
  const a = await submit(request({ paymentMethod: 'cod' }), 'key-r7-aaaaaaaa');
  const b = await submit(request({ paymentMethod: 'cod' }), 'key-r7-aaaaaaaa');
  const c = await submit(request({ paymentMethod: 'cod', customer: { ...CUSTOMER, pin: '141002' } }), 'key-r7-aaaaaaaa');
  assert.equal(a.body.paymentMethod, 'cod');
  assert.equal(b.body.duplicate, true);
  assert.equal(c.statusCode, 409);
  assert.equal(w.orders.length, 1);
});

await test('R8 two submits racing under one key with different requests: one order, one refusal', async () => {
  for (const method of ['online', 'cod']) {
    const w = world();
    const [x, y] = await Promise.all([
      submit(request({ paymentMethod: method }), `key-r8-${method}-aa`),
      submit(request({ paymentMethod: method, customer: { ...CUSTOMER, pin: '141002' } }), `key-r8-${method}-aa`),
    ]);
    assert.equal(w.orders.length, 1, `${method}: one order`);
    assert.deepEqual([x.statusCode, y.statusCode].sort(), [200, 409], `${method}: the loser is refused, not replayed`);
  }
});

await test('R9 the corrected address under a NEW key is a new order with the new address', async () => {
  const w = world();
  await submit(request(), 'key-r9-aaaaaaaa');
  const res = await submit(request({ customer: { ...CUSTOMER, pin: '141002' } }), 'key-r9-bbbbbbbb');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.duplicate, undefined);
  assert.deepEqual(w.orders.map((o) => o.customer.pin), ['141001', '141002']);
});

console.log('\n— Checkout: the key follows the submission, not the visit —');

// payments.js cannot load under node (it builds the browser Supabase client), so
// the two functions are lifted from its source and run as written.
const paymentsSrc = read('src/lib/payments.js');
const lift = (name) => {
  const m = new RegExp(`export function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`).exec(paymentsSrc);
  assert.ok(m, `${name} found in payments.js`);
  return m[0].replace(/^export /, '');
};
const { keyForSubmission } = new Function(`${lift('newIdempotencyKey')}\n${lift('keyForSubmission')}\nreturn { keyForSubmission };`)();

await test('K1 keyForSubmission keeps the key for the same submission and mints a new one for any other', () => {
  const a = keyForSubmission(null, '{"x":1}');
  assert.match(a.key, /^[A-Za-z0-9_-]{8,100}$/, 'a key create-order accepts');
  assert.equal(keyForSubmission(a, '{"x":1}'), a, 'same submission, same key');
  const b = keyForSubmission(a, '{"x":2}');
  assert.notEqual(b.key, a.key, 'changed submission, new key');
  assert.equal(b.submission, '{"x":2}');
});

await test('K2 Checkout keys the exact request it sends, and resets the key on every refusal that ends the attempt', () => {
  const checkout = code('src/pages/Checkout.jsx');
  assert.match(checkout, /const request = \{\n\s+items: cart,\n\s+delivery,\n\s+customer: form,\n\s+paymentMethod: pay === 'cod' \? 'cod' : 'online',\n\s+couponCode,\n\s+\};/,
    'one request object: items, delivery, customer, payment method, coupon');
  assert.match(checkout, /submitKey\.current = keyForSubmission\(submitKey\.current, JSON\.stringify\(request\)\);/);
  assert.match(checkout, /createPaymentOrder\(\{\n\s+\.\.\.request,\n\s+idempotencyKey: submitKey\.current\.key,/, 'what is sent is what was keyed');
  const assignments = checkout.match(/submitKey\.current = [^;]+;/g) || [];
  assert.deepEqual(assignments, [
    'submitKey.current = keyForSubmission(submitKey.current, JSON.stringify(request));',
    'submitKey.current = null;',
    'submitKey.current = null;',
  ], 'minted in one place; cleared only after a coupon refusal or a key conflict');
  assert.match(checkout, /err\.data\?\.idempotencyConflict\) \{\n\s+submitKey\.current = null;/);
  assert.doesNotMatch(checkout, /newIdempotencyKey/, 'no second way to mint a key');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
