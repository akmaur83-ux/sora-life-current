// ============================================================
// Order holds (migration 0039): stock and coupon uses held for an order.
//
// Two audit findings (2026-10-20):
//   6  stock was checked at checkout but never reduced, so the last unit
//      could be sold any number of times;
//   3  a coupon's usage limit counted only PAID orders, so everyone who
//      started checkout before the first payment got the discount.
//
// An order now holds what it needs when it is created: an online order for
// 30 minutes, taken on payment and let go on failure, on a changed checkout
// or when the hold lapses; a COD order takes its units and its coupon use at
// once (the owner's rule), and a cancel puts them back.
//
// This suite runs the real create-order / verify / webhook handlers against
// the payment double, whose 0039 functions mirror the SQL rule for rule. The
// SQL itself is pinned below by its text (who it runs as, who may call it,
// the cancel trigger); its behaviour was run on a real Postgres engine before
// it was handed over. No network.
//   node scripts/test-order-holds.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, mockRes, sign, webhookReq } from './lib/payment-test-harness.mjs';
import {
  HOLD_MINUTES, PAYMENT_WINDOW_SECONDS, SETTLE_MARGIN_SECONDS, stockLines, paymentWindowSeconds, stockRefusalMessage,
} from '../api/_lib/orderHolds.js';

const createOrder = (await import('../api/razorpay/create-order.js')).default;
const verify = (await import('../api/razorpay/verify.js')).default;
const webhook = (await import('../api/razorpay/webhook.js')).default;

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
console.error = () => {}; console.warn = () => {};

// ---- fixtures -------------------------------------------------------
const PRODUCTS = [
  { id: 1, biosash_id: 'b1', name: 'Biosip', original_price: 199, discount_percent: 0, sale_price: 199, is_active: true, stock: true },
  { id: 2, biosash_id: 'b2', name: 'Juice', original_price: 1000, discount_percent: 0, sale_price: 1000, is_active: true, stock: true },
];
const VARIANTS = () => [{ id: 'v750', product_id: 2, label: '750 ml', mrp: 1000, sale_price: 1000, stock: 1, is_active: true }];
const FASHION = [{ id: 'f-1', name: 'Linen Shirt', slug: 'linen-shirt', mrp: 1999, sale_price: 1499, is_active: true }];
const HL_PRODUCTS = () => [
  { id: 'h-lamp', store: 'homeliving', name: 'Lamp', slug: 'lamp', sku: 'L1', mrp: 900, sale_price: null, stock: 2, is_active: true },
  { id: 'h-rug', store: 'homeliving', name: 'Rug', slug: 'rug', sku: 'R1', mrp: 3000, sale_price: null, stock: 0, is_active: true },
];
const CATALOGUE_VARIANTS = () => [
  { id: 'fv-m', product_id: 'f-1', store: 'fashion', size: 'M', colour: 'White', sku: 'LS-M', stock: 3, price_override: null, is_active: true },
  { id: 'hv-rug-s', product_id: 'h-rug', store: 'homeliving', size: 'Small', colour: null, sku: 'R1-S', stock: 1, price_override: null, is_active: true },
];
const coupons = (over = {}) => [{ id: 'c1', code: 'ONCE', type: 'flat', value: 100, min_order_value: 0, usage_limit: 1, used_count: 0, is_active: true, ...over }];
const CUSTOMER = {
  email: 'asha@example.com', phone: '9876543210', firstName: 'Asha', lastName: 'K',
  address: '12 MG Road', apartment: '', landmark: '', city: 'Ludhiana', state: 'Punjab', pin: '141001',
};

/** The double, plus the catalogue reads it does not speak (served from its own stock, so holds are visible). */
function world(seed = {}) {
  const w = makeWorld({ products: PRODUCTS, variants: VARIANTS(), catalogueProducts: HL_PRODUCTS(), catalogueVariants: CATALOGUE_VARIANTS(), ...seed });
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const rel = url.pathname.replace('/rest/v1/', '');
    const list = (param) => { const m = /in\.\((.*)\)/.exec(url.searchParams.get(param) || ''); return m ? m[1].split(',').map((s) => s.replace(/"/g, '')) : []; };
    const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (rel === 'fashion_products') return json(FASHION.filter((p) => list('id').includes(p.id)));
    if (rel === 'fashion_variants') return json(w.catalogueVariants.filter((v) => v.store === 'fashion' && list('id').includes(v.id)));
    if (rel === 'catalogue_products') return json(w.catalogueProducts.filter((p) => list('id').includes(p.id)));
    if (rel === 'catalogue_variants') return json(w.catalogueVariants.filter((v) => v.store === 'homeliving' && list('product_id').includes(v.product_id)));
    if (url.pathname === '/auth/v1/user') {
      const m = /^Bearer user-(\w+)$/.exec(init.headers?.Authorization || '');
      if (m) return new Response(JSON.stringify({ id: `user-${m[1]}` }), { status: 200 });
    }
    if (rel === 'orders' && (init.method || 'GET') === 'GET' && url.searchParams.get('user_id')) return json([]);
    if (rel === 'coupon_redemptions') {
      const cid = (url.searchParams.get('coupon_id') || '').replace('eq.', '');
      const uid = (url.searchParams.get('user_id') || '').replace('eq.', '');
      return json(w.redemptions.filter((r) => r.coupon_id === cid && r.user_id === uid).map(() => ({ id: 'r' })));
    }
    return inner(input, init);
  };
  return w;
}

let ip = 0, keyN = 0;
const newKey = () => `key-holds-${String(++keyN).padStart(4, '0')}`;
async function submit(body, { key = newKey(), user } = {}) {
  const res = mockRes();
  const headers = { 'idempotency-key': key, 'x-forwarded-for': `10.8.0.${(ip++ % 250) + 1}` };
  if (user) headers.authorization = `Bearer user-${user}`;
  await createOrder({ method: 'POST', headers, body }, res);
  return res;
}
const request = (over = {}) => ({ items: [{ id: 'b2', qty: 1, variantId: 'v750' }], delivery: 'std', customer: CUSTOMER, paymentMethod: 'online', couponCode: null, ...over });
const orderOf = (w, res) => w.orders.find((o) => o.order_number === res.body.orderNumber);
async function capture(w, order) {
  const res = mockRes();
  await webhook(webhookReq('payment.captured', { id: `pay_${order.order_number}`, order_id: order.razorpay_order_id, amount: order.amount_paise, currency: 'INR' }), res);
  return res;
}
async function failPayment(w, order) {
  const res = mockRes();
  await webhook(webhookReq('payment.failed', { id: `payf_${order.order_number}`, order_id: order.razorpay_order_id, amount: order.amount_paise, error_description: 'declined' }), res);
  return res;
}
const lapse = (w, order) => { for (const h of w.holds) if (h.order_id === order.id) h.expires_at = new Date(Date.now() - 60_000).toISOString(); };
const stock = (w, id) => (w.variants.find((v) => v.id === id) || w.catalogueVariants.find((v) => v.id === id) || w.catalogueProducts.find((p) => p.id === id)).stock;

console.log('\n— Stock: an order holds its units; payment takes them —');

await test('S1 two online checkouts for the last unit: the second is told it has sold out, and gets no payable order', async () => {
  const w = world();
  const a = await submit(request());
  const b = await submit(request({ customer: { ...CUSTOMER, email: 'ravi@example.com' } }));
  assert.equal(a.statusCode, 200);
  assert.equal(b.statusCode, 409);
  assert.equal(b.body.stockRefused, true);
  assert.match(b.body.error, /"Juice \(750 ml\)" has just sold out/);
  assert.equal(w.orders.length, 1, 'the refused order row is removed');
  assert.equal(w.calls.razorpayOrders, 1, 'no Razorpay order for the refused one');
  assert.equal(stock(w, 'v750'), 1, 'a hold does not touch the stock count');
});

await test('S2 the payment takes the unit; settling twice (verify + webhook) takes it once', async () => {
  const w = world({ variants: [{ ...VARIANTS()[0], stock: 3 }] });
  const a = await submit(request({ items: [{ id: 'b2', qty: 2, variantId: 'v750' }] }));
  const order = orderOf(w, a);
  await capture(w, order);
  await capture(w, order);
  assert.equal(order.payment_status, 'paid');
  assert.equal(stock(w, 'v750'), 1);
});

await test('S3 a failed payment lets the unit go at once', async () => {
  const w = world();
  const a = await submit(request());
  await failPayment(w, orderOf(w, a));
  const b = await submit(request({ customer: { ...CUSTOMER, email: 'ravi@example.com' } }));
  assert.equal(b.statusCode, 200);
});

await test('S4 a lapsed hold stops counting; the late payer is still honoured and the shortfall is written down', async () => {
  const w = world();
  const a = await submit(request());
  const first = orderOf(w, a);
  lapse(w, first);
  const b = await submit(request({ customer: { ...CUSTOMER, email: 'ravi@example.com' } }));
  assert.equal(b.statusCode, 200, 'the lapsed hold no longer blocks anyone');
  await capture(w, orderOf(w, b));
  assert.equal(stock(w, 'v750'), 0);
  await capture(w, first);
  assert.equal(first.payment_status, 'paid', 'money taken: the order stands');
  assert.equal(stock(w, 'v750'), 0, 'never below zero');
  assert.deepEqual(first.hold_warnings, [{ kind: 'stock', label: 'Juice (750 ml)', qty: 1, short: 1 }]);
});

await test('S5 COD takes its units when placed; the next order sees the lower count', async () => {
  const w = world({ variants: [{ ...VARIANTS()[0], stock: 2 }] });
  const a = await submit(request({ paymentMethod: 'cod' }));
  assert.equal(a.statusCode, 200);
  assert.equal(stock(w, 'v750'), 1, 'taken at placement, not at cash collection');
  const b = await submit(request({ paymentMethod: 'cod', items: [{ id: 'b2', qty: 2, variantId: 'v750' }], customer: { ...CUSTOMER, email: 'ravi@example.com' } }));
  assert.equal(b.statusCode, 400);
  assert.match(b.body.error, /Only 1 of "Juice 750 ml" is left/);
});

await test('S6 every counted stock column is held: fashion and Home & Living options, a Home & Living product without options', async () => {
  const w = world();
  const a = await submit(request({ paymentMethod: 'cod', items: [
    { id: 'f-1', qty: 2, variantId: 'fv-m', catalogue: 'fashion' },
    { id: 'h-lamp', qty: 1, catalogue: 'homeliving' },
    { id: 'h-rug', qty: 1, variantId: 'hv-rug-s', catalogue: 'homeliving' },
  ] }));
  assert.equal(a.statusCode, 200, JSON.stringify(a.body));
  assert.deepEqual([stock(w, 'fv-m'), stock(w, 'h-lamp'), stock(w, 'hv-rug-s')], [1, 1, 0]);
});

await test('S7 a wellness product without a pack size holds nothing (its stock is an in-stock flag, not a count)', async () => {
  const w = world();
  const a = await submit(request({ paymentMethod: 'cod', items: [{ id: 'b1', qty: 3 }] }));
  assert.equal(a.statusCode, 200);
  assert.equal(w.holds.length, 0);
  assert.equal(w.products[0].stock, true, 'the flag is untouched');
});

console.log('\n— Coupons: a use is held from checkout, not counted after payment —');

await test('C1 a single-use coupon goes to the first checkout; the next two are told it is fully claimed and pay full price or not at all', async () => {
  const w = world({ coupons: coupons(), variants: [{ ...VARIANTS()[0], stock: 9 }] });
  const a = await submit(request({ couponCode: 'ONCE' }));
  const b = await submit(request({ couponCode: 'ONCE', customer: { ...CUSTOMER, email: 'ravi@example.com' } }));
  const c = await submit(request({ couponCode: 'ONCE', customer: { ...CUSTOMER, email: 'meera@example.com' } }));
  assert.equal(a.statusCode, 200);
  for (const r of [b, c]) {
    assert.equal(r.statusCode, 409);
    assert.equal(r.body.couponRejected, true);
    assert.equal(r.body.reason, 'exhausted');
    assert.equal(r.body.error, 'That code has been fully claimed.');
  }
  assert.equal(w.orders.length, 1);
  await capture(w, orderOf(w, a));
  assert.equal(w.coupons[0].used_count, 1);
  assert.equal(w.redemptions.length, 1);
});

await test('C2 two COD orders at the same moment: one gets the last use, the other is refused', async () => {
  const w = world({ coupons: coupons(), variants: [{ ...VARIANTS()[0], stock: 9 }] });
  const [x, y] = await Promise.all([
    submit(request({ couponCode: 'ONCE', paymentMethod: 'cod' })),
    submit(request({ couponCode: 'ONCE', paymentMethod: 'cod', customer: { ...CUSTOMER, email: 'ravi@example.com' } })),
  ]);
  assert.deepEqual([x.statusCode, y.statusCode].sort(), [200, 409]);
  assert.equal(w.orders.filter((o) => o.coupon_discount === 100).length, 1);
  assert.equal(w.coupons[0].used_count, 1);
});

await test('C3 a failed payment, or a lapsed hold, frees the use for the next customer', async () => {
  const w = world({ coupons: coupons(), variants: [{ ...VARIANTS()[0], stock: 9 }] });
  const a = await submit(request({ couponCode: 'ONCE' }));
  await failPayment(w, orderOf(w, a));
  const b = await submit(request({ couponCode: 'ONCE', customer: { ...CUSTOMER, email: 'ravi@example.com' } }));
  assert.equal(b.statusCode, 200, 'free again after the failure');
  lapse(w, orderOf(w, b));
  const c = await submit(request({ couponCode: 'ONCE', customer: { ...CUSTOMER, email: 'meera@example.com' } }));
  assert.equal(c.statusCode, 200, 'free again after the lapse');
});

await test('C4 a corrected checkout lets its own earlier hold go, so a one-per-customer code is not refused to its own customer', async () => {
  const seed = { coupons: coupons({ usage_limit: null, per_user_limit: 1 }), variants: [{ ...VARIANTS()[0], stock: 9 }] };
  const first = 'key-holds-c4-aaaa';
  {
    const w = world(seed);
    await submit(request({ couponCode: 'ONCE' }), { key: first, user: 'U1' });
    const r = await submit(request({ couponCode: 'ONCE', customer: { ...CUSTOMER, pin: '141002' } }), { user: 'U1' });
    assert.equal(r.statusCode, 409, 'without naming the old key, the old hold refuses its own customer');
    assert.equal(r.body.reason, 'user_limit');
  }
  {
    const w = world(seed);
    await submit(request({ couponCode: 'ONCE' }), { key: first, user: 'U1' });
    const r = await submit(request({ couponCode: 'ONCE', customer: { ...CUSTOMER, pin: '141002' }, supersedesKey: first }), { user: 'U1' });
    assert.equal(r.statusCode, 200, 'naming it lets it go');
    assert.equal(w.holds.filter((h) => h.kind === 'coupon' && h.status === 'held').length, 1, 'only the new order holds it');
    assert.equal(w.calls.release, 1);
  }
});

await test('C5 a COD order cannot be "superseded" into giving its units back', async () => {
  const w = world({ variants: [{ ...VARIANTS()[0], stock: 2 }] });
  const cod = 'key-holds-c5-aaaa';
  await submit(request({ paymentMethod: 'cod' }), { key: cod });
  await submit(request({ paymentMethod: 'cod', customer: { ...CUSTOMER, pin: '141002' }, supersedesKey: cod }));
  assert.equal(stock(w, 'v750'), 0, 'both COD orders keep their unit');
  assert.equal(w.calls.release, 0);
});

console.log('\n— The payment window closes before the hold runs out —');

await test('W1 a fresh online order opens a 15-minute window; COD has none', async () => {
  const w = world({ variants: [{ ...VARIANTS()[0], stock: 9 }] });
  const a = await submit(request());
  assert.equal(a.body.checkoutTimeout, PAYMENT_WINDOW_SECONDS);
  const order = orderOf(w, a);
  const left = Date.parse(order.reserved_until) - Date.now();
  assert.ok(Math.abs(left - HOLD_MINUTES * 60_000) < 5_000, 'held for 30 minutes');
  const cod = await submit(request({ paymentMethod: 'cod' }));
  assert.equal(cod.body.checkoutTimeout, undefined);
});

await test('W2 a replay gets only the window its hold still covers, and none once too little is left', async () => {
  const w = world({ variants: [{ ...VARIANTS()[0], stock: 9 }] });
  const key = 'key-holds-w2-aaaa';
  const a = await submit(request(), { key });
  const order = orderOf(w, a);
  order.reserved_until = new Date(Date.now() + 16 * 60_000).toISOString();
  const r1 = await submit(request(), { key });
  assert.equal(r1.statusCode, 200);
  assert.ok(Math.abs(r1.body.checkoutTimeout - (16 * 60 - SETTLE_MARGIN_SECONDS)) <= 2, `6 minutes left to pay, got ${r1.body.checkoutTimeout}`);
  order.reserved_until = new Date(Date.now() + 11 * 60_000).toISOString();
  const r2 = await submit(request(), { key });
  assert.equal(r2.statusCode, 409);
  assert.equal(r2.body.reservationExpired, true);
  assert.equal(r2.body.razorpayOrderId, undefined, 'nothing payable handed back');
});

await test('W3 an order whose reservation call failed is held when the same submit is retried', async () => {
  const w = world({ variants: [{ ...VARIANTS()[0], stock: 2 }] });
  const inner = globalThis.fetch;
  let failOnce = true;
  globalThis.fetch = async (input, init) => {
    if (failOnce && String(input).includes('rpc/reserve_order_holds')) { failOnce = false; throw new Error('connection reset'); }
    return inner(input, init);
  };
  const key = 'key-holds-w3-aaaa';
  const first = await submit(request({ paymentMethod: 'cod' }), { key });
  assert.equal(first.statusCode, 503);
  assert.equal(w.orders.length, 1, 'the row stays: the reservation answer is unknown');
  const retry = await submit(request({ paymentMethod: 'cod' }), { key });
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.duplicate, true);
  assert.equal(stock(w, 'v750'), 1, 'held (taken, for COD) on the retry');
});

console.log('\n— Before 0039 is applied: checkout works exactly as it did —');

await test('M1 COD and online orders go through with no holds; the coupon is counted by consume_coupon as before', async () => {
  const w = world({ noHolds: true, coupons: coupons({ usage_limit: 5 }), variants: [{ ...VARIANTS()[0], stock: 9 }] });
  const cod = await submit(request({ paymentMethod: 'cod', couponCode: 'ONCE' }));
  assert.equal(cod.statusCode, 200);
  assert.equal(w.calls.consumeCoupon, 1, 'COD: consume_coupon at placement');
  const online = await submit(request({ couponCode: 'ONCE', customer: { ...CUSTOMER, email: 'ravi@example.com' } }));
  assert.equal(online.statusCode, 200);
  assert.equal(online.body.checkoutTimeout, PAYMENT_WINDOW_SECONDS);
  await capture(w, orderOf(w, online));
  assert.equal(w.calls.consumeCoupon, 2, 'online: consume_coupon on payment');
  assert.equal(w.coupons[0].used_count, 2);
  assert.equal(stock(w, 'v750'), 9, 'no stock moves without 0039');
});

console.log('\n— verify takes and releases like the webhook —');

await test('V1 verify: a captured payment takes the holds; a failed one lets them go', async () => {
  const w = world({ variants: [{ ...VARIANTS()[0], stock: 1 }] });
  const a = await submit(request());
  const order = orderOf(w, a);
  w.payments.pay_ok = { id: 'pay_ok', order_id: order.razorpay_order_id, amount: order.amount_paise, status: 'captured' };
  const res = mockRes();
  await verify({ method: 'POST', headers: {}, body: { razorpay_order_id: order.razorpay_order_id, razorpay_payment_id: 'pay_ok', razorpay_signature: sign(order.razorpay_order_id, 'pay_ok') } }, res);
  assert.equal(res.body.verified, true);
  assert.equal(stock(w, 'v750'), 0);

  const w2 = world({ variants: [{ ...VARIANTS()[0], stock: 1 }] });
  const b = await submit(request());
  const order2 = orderOf(w2, b);
  w2.payments.pay_no = { id: 'pay_no', order_id: order2.razorpay_order_id, amount: order2.amount_paise, status: 'failed' };
  await verify({ method: 'POST', headers: {}, body: { razorpay_order_id: order2.razorpay_order_id, razorpay_payment_id: 'pay_no', razorpay_signature: sign(order2.razorpay_order_id, 'pay_no') } }, mockRes());
  assert.equal(w2.holds.filter((h) => h.status === 'held').length, 0, 'released');
});

console.log('\n— The pieces —');

await test('stockLines: which stock column each kind of line draws on', () => {
  assert.deepEqual(stockLines([
    { name: 'Juice', variant: '750 ml', product_id: 2, variant_id: 'v750', qty: 2 },
    { name: 'Biosip', product_id: 1, variant_id: null, qty: 1 },
    { catalogue: 'fashion', name: 'Shirt', variant: 'M · White', product_id: 'f-1', variant_id: 'fv-m', qty: 1 },
    { catalogue: 'homeliving', name: 'Lamp', product_id: 'h-lamp', variant_id: null, qty: 1 },
    { catalogue: 'homeliving', name: 'Rug', variant: 'Small', product_id: 'h-rug', variant_id: 'hv-rug-s', qty: 1 },
  ]), [
    { target: 'product_variants', id: 'v750', qty: 2, label: 'Juice (750 ml)', line: 0 },
    { target: 'catalogue_variants', id: 'fv-m', qty: 1, label: 'Shirt (M · White)', line: 2 },
    { target: 'catalogue_products', id: 'h-lamp', qty: 1, label: 'Lamp', line: 3 },
    { target: 'catalogue_variants', id: 'hv-rug-s', qty: 1, label: 'Rug (Small)', line: 4 },
  ]);
});

await test('paymentWindowSeconds: 15 minutes fresh, what the hold covers on a replay, none when under 2 minutes would be left', () => {
  const now = Date.parse('2026-10-23T10:00:00Z');
  const at = (min) => new Date(now + min * 60_000).toISOString();
  assert.equal(paymentWindowSeconds(at(30), now), 900);
  assert.equal(paymentWindowSeconds(at(16), now), 360);
  assert.equal(paymentWindowSeconds(at(12), now), 120);
  assert.equal(paymentWindowSeconds(at(11.9), now), 0);
  assert.equal(paymentWindowSeconds(null, now), 900);
  assert.equal(stockRefusalMessage({ label: 'Lamp' }, 2), 'Only 2 of "Lamp" are left. Please update your cart and try again.');
});

await test('the browser retires a key after a stock or lapsed-hold refusal, names the key it replaces, and gives Razorpay its time limit', () => {
  const paymentsSrc = read('src/lib/payments.js');
  const lift = (name) => new RegExp(`export function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`).exec(paymentsSrc)[0].replace(/^export /, '');
  const { keyForSubmission, retireKey } = new Function(`${lift('newIdempotencyKey')}\n${lift('keyForSubmission')}\n${lift('retireKey')}\nreturn { keyForSubmission, retireKey };`)();
  const a = keyForSubmission(null, 'same');
  const retired = retireKey(a);
  assert.equal(retired.key, a.key);
  const b = keyForSubmission(retired, 'same');
  assert.notEqual(b.key, a.key, 'the same submission after a refusal is a new order');
  assert.equal(retireKey(null), null);

  const checkout = code('src/pages/Checkout.jsx');
  assert.match(checkout, /const supersedesKey = previous && previous\.key !== submitKey\.current\.key \? previous\.key : null;/);
  assert.match(checkout, /\.\.\.\(created\.checkoutTimeout > 0 \? \{ timeout: created\.checkoutTimeout \} : \{\}\),/);
  assert.match(checkout, /if \(err\.data\?\.stockRefused \|\| err\.data\?\.reservationExpired\) \{\n\s+submitKey\.current = retireKey\(submitKey\.current\);\n\s+setPayError\(err\.message\);/);
  assert.match(code('src/lib/payments.js'), /\.\.\.\(supersedesKey \? \{ supersedesKey \} : \{\}\),/, 'sent only when there is one');
});

await test('the admin sees a paid order that could not be fully honoured', () => {
  const orders = code('src/admin/pages/Orders.jsx');
  assert.match(orders, /holdWarnings\(o\)\.length > 0 && <span className="badge badge-sale"[^>]*>Check stock<\/span>/);
  assert.match(orders, /Paid, but not everything could be honoured\.<\/strong> Restock or refund before shipping\./);
});

await test('migration 0039: every function runs as its caller, only the server may call them, and a cancel puts things back', () => {
  const sql = read('supabase/migrations/0039_order_holds.sql');
  const fns = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
  assert.deepEqual(fns.sort(), ['order_hold_adjust_stock', 'order_hold_count_coupon', 'order_hold_coupon_room', 'order_hold_lines',
    'order_hold_lock_stock', 'order_holds_on_fulfilment', 'release_order_holds', 'reserve_order_holds', 'restore_order_holds', 'settle_order_holds']);
  const statements = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(statements, /security definer/i, 'no function runs as its owner');
  assert.equal((statements.match(/\bsecurity invoker\b/g) || []).length, 10, 'each of the ten says so');
  for (const fn of fns) assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`), `${fn} revoked`);
  assert.doesNotMatch(sql, /grant execute[^;]*to (anon|authenticated|public)/i);
  assert.match(sql, /create trigger order_holds_fulfilment\n\s+after update of fulfillment_status on public\.orders/);
  assert.match(sql, /if new\.fulfillment_status = 'cancelled' then\n\s+perform public\.restore_order_holds\(new\.id\);/);
  assert.match(sql, /alter table public\.order_holds enable row level security;/);
  assert.match(read('supabase/migrations/rollback/0039_order_holds_down.sql'), /drop table if exists public\.order_holds;/);
  assert.doesNotMatch(read('supabase/migrations/0022_order_fulfillment.sql'), /order_holds/, '0022 untouched');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
