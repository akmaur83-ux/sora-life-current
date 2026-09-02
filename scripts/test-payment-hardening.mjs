// ============================================================
// Payment / order hardening regression tests.
//
// Covers the defects fixed in the security pass:
//   1. Webhook idempotency  — authorized -> captured must both apply, and a
//      redelivery of the same transition must not re-apply.
//   2. /verify              — a valid callback signature is not proof of
//      capture; Razorpay's own payment state decides.
//   3. Inventory / variants — server owns stock, quantity and variant identity.
//   4. Coupons              — COD consumes its coupon like prepaid does.
//   5. COD                  — required delivery fields, duplicate submits.
//   6. Shipping             — flat per-method fee, no basket-value threshold.
//
// NO NETWORK, NO SECRETS, NO REAL PAYMENTS. Supabase REST and the Razorpay
// API are both replaced by an in-memory fake that speaks just enough
// PostgREST to exercise the real handlers unmodified.
//
// Run: node scripts/test-payment-hardening.mjs
// ============================================================
// The fake Supabase/Razorpay world lives in one module so this suite and
// the concurrency stress suite cannot drift apart. Importing it installs
// the fake environment; no real credentials are involved.
import {
  makeWorld, mockRes, sign, webhookReq, PENDING_ORDER, KEY_SECRET, WEBHOOK_SECRET,
} from './lib/payment-test-harness.mjs';

const { computeOrderTotal, validateCartPayload, normalizeCartLines } = await import('../api/_lib/pricing.js');
const verifyHandler = (await import('../api/razorpay/verify.js')).default;
const webhookHandler = (await import('../api/razorpay/webhook.js')).default;
const createOrderHandler = (await import('../api/razorpay/create-order.js')).default;

let passed = 0, failed = 0;
let currentTest = '(startup)';

// A payment suite must never exit non-zero without saying why. Node kills
// the process on an unhandled rejection, which would otherwise surface as a
// bare exit code with every visible line reading PASS — impossible to
// diagnose after the fact. These handlers attribute it to the test that was
// running and print the stack.
function reportFatal(kind, err) {
  console.error(`\n  FATAL ${kind} during: ${currentTest}`);
  console.error(`  ${err && err.stack ? err.stack : err}`);
  console.error(`\n${passed} passed, ${failed + 1} failed (aborted)\n`);
  process.exit(1);
}
process.on('unhandledRejection', (err) => reportFatal('unhandledRejection', err));
process.on('uncaughtException', (err) => reportFatal('uncaughtException', err));

async function test(name, fn) {
  currentTest = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

// ============================================================
console.log('\n— Webhook: event-level idempotency —');
// ============================================================

await test('authorized then captured BOTH apply (the capture is not swallowed)', async () => {
  const w = makeWorld({ orders: [PENDING_ORDER] });
  const entity = { id: 'pay_A', order_id: 'order_RZ1', amount: 47200, currency: 'INR' };

  const r1 = mockRes();
  await webhookHandler(webhookReq('payment.authorized', entity), r1);
  eq(r1.statusCode, 200, 'authorized acknowledged');
  eq(w.orders[0].payment_status, 'pending', 'authorized alone must not mark paid');

  const r2 = mockRes();
  await webhookHandler(webhookReq('payment.captured', entity), r2);
  eq(r2.statusCode, 200);
  eq(w.orders[0].payment_status, 'paid', 'capture after authorize MUST mark the order paid');
  eq(w.orders[0].status, 'paid');
  ok(w.orders[0].invoice_number, 'invoice issued on capture');
});

await test('a redelivered payment.captured does not re-apply side effects', async () => {
  const w = makeWorld({
    orders: [{ ...PENDING_ORDER, coupon_code: 'SAVE10' }],
    coupons: [{ id: 'c1', code: 'SAVE10', is_active: true, usage_limit: 5, used_count: 0 }],
  });
  const entity = { id: 'pay_B', order_id: 'order_RZ1', amount: 47200, currency: 'INR' };

  await webhookHandler(webhookReq('payment.captured', entity), mockRes());
  eq(w.coupons[0].used_count, 1, 'coupon consumed once');
  const paidAt = w.orders[0].paid_at;

  const r2 = mockRes();
  await webhookHandler(webhookReq('payment.captured', entity), r2);
  eq(r2.statusCode, 200);
  eq(w.coupons[0].used_count, 1, 'coupon must NOT be consumed twice');
  eq(w.orders[0].paid_at, paidAt, 'paid_at must not be rewritten');
});

await test('duplicate delivery of the exact same event is safe', async () => {
  const w = makeWorld({ orders: [PENDING_ORDER] });
  const entity = { id: 'pay_C', order_id: 'order_RZ1', amount: 47200, currency: 'INR' };
  const req = webhookReq('payment.authorized', entity);
  await webhookHandler(req, mockRes());
  const r2 = mockRes();
  await webhookHandler(req, r2);
  eq(r2.statusCode, 200);
  eq(w.transactions.length, 1, 'ledger deduplicated by payment id');
});

await test('a transient DB failure returns 5xx and the retry still settles the order', async () => {
  const w = makeWorld({ orders: [PENDING_ORDER] });
  const entity = { id: 'pay_D', order_id: 'order_RZ1', amount: 47200, currency: 'INR' };
  const req = webhookReq('payment.captured', entity);

  w.failNextOrderPatch = true;
  const r1 = mockRes();
  await webhookHandler(req, r1);
  eq(r1.statusCode, 500, 'server fault must be 5xx so Razorpay retries');
  eq(w.orders[0].payment_status, 'pending', 'not paid yet');

  // Razorpay redelivers. The ledger row already exists — that must not stop it.
  const r2 = mockRes();
  await webhookHandler(req, r2);
  eq(r2.statusCode, 200);
  eq(w.orders[0].payment_status, 'paid', 'retry after a transient failure MUST still settle');
});

await test('a late payment.failed cannot knock a paid order back to failed', async () => {
  const w = makeWorld({ orders: [PENDING_ORDER] });
  await webhookHandler(webhookReq('payment.captured', {
    id: 'pay_E1', order_id: 'order_RZ1', amount: 47200, currency: 'INR',
  }), mockRes());
  eq(w.orders[0].payment_status, 'paid');

  const r = mockRes();
  await webhookHandler(webhookReq('payment.failed', {
    id: 'pay_E2', order_id: 'order_RZ1', amount: 47200, currency: 'INR',
    error_description: 'stale earlier attempt',
  }), r);
  eq(r.statusCode, 200);
  eq(w.orders[0].payment_status, 'paid', 'payment state must be monotonic');
});

await test('concurrent duplicate captures settle the order exactly once', async () => {
  const w = makeWorld({
    orders: [{ ...PENDING_ORDER, coupon_code: 'SAVE10' }],
    coupons: [{ id: 'c1', code: 'SAVE10', is_active: true, usage_limit: 5, used_count: 0 }],
  });
  const entity = { id: 'pay_F', order_id: 'order_RZ1', amount: 47200, currency: 'INR' };
  const results = await Promise.all([
    (async () => { const r = mockRes(); await webhookHandler(webhookReq('payment.captured', entity), r); return r; })(),
    (async () => { const r = mockRes(); await webhookHandler(webhookReq('payment.captured', entity), r); return r; })(),
  ]);
  ok(results.every((r) => r.statusCode === 200), 'both acknowledged');
  eq(w.orders[0].payment_status, 'paid');
  eq(w.coupons[0].used_count, 1, 'coupon consumed exactly once under concurrency');
});

await test('an amount mismatch is never marked paid', async () => {
  const w = makeWorld({ orders: [PENDING_ORDER] });
  const r = mockRes();
  await webhookHandler(webhookReq('payment.captured', {
    id: 'pay_G', order_id: 'order_RZ1', amount: 100, currency: 'INR',
  }), r);
  eq(r.body.mismatch, true);
  eq(w.orders[0].payment_status, 'failed');
});

await test('a forged webhook signature is rejected and records nothing', async () => {
  const w = makeWorld({ orders: [PENDING_ORDER] });
  const r = mockRes();
  await webhookHandler({
    method: 'POST',
    headers: { 'x-razorpay-signature': 'f'.repeat(64) },
    body: JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'x', order_id: 'order_RZ1', amount: 47200 } } } }),
  }, r);
  eq(r.statusCode, 400);
  eq(w.transactions.length, 0);
  eq(w.orders[0].payment_status, 'pending');
});

// ============================================================
console.log('\n— /verify: capture is proved against Razorpay, not the callback —');
// ============================================================

await test('valid HMAC + CAPTURED payment marks the order paid', async () => {
  const w = makeWorld({
    orders: [PENDING_ORDER],
    payments: { pay_V1: { id: 'pay_V1', order_id: 'order_RZ1', status: 'captured', amount: 47200 } },
  });
  const r = mockRes();
  await verifyHandler({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V1', razorpay_signature: sign('order_RZ1', 'pay_V1') },
  }, r);
  eq(r.statusCode, 200);
  eq(r.body.verified, true);
  eq(w.orders[0].payment_status, 'paid');
  eq(w.calls.paymentLookups, 1, 'Razorpay was actually consulted');
});

await test('valid HMAC + AUTHORIZED-not-captured payment must NOT mark paid', async () => {
  const w = makeWorld({
    orders: [PENDING_ORDER],
    payments: { pay_V2: { id: 'pay_V2', order_id: 'order_RZ1', status: 'authorized', amount: 47200 } },
  });
  const r = mockRes();
  await verifyHandler({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V2', razorpay_signature: sign('order_RZ1', 'pay_V2') },
  }, r);
  eq(r.body.verified, false, 'a held authorization is not a payment');
  eq(r.body.pending, true);
  eq(w.orders[0].payment_status, 'pending', 'order must stay pending, not paid');
});

await test('invalid HMAC is rejected and never consults Razorpay', async () => {
  const w = makeWorld({
    orders: [PENDING_ORDER],
    payments: { pay_V3: { id: 'pay_V3', order_id: 'order_RZ1', status: 'captured', amount: 47200 } },
  });
  const r = mockRes();
  await verifyHandler({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V3', razorpay_signature: 'f'.repeat(64) },
  }, r);
  eq(r.statusCode, 400);
  eq(r.body.verified, false);
  eq(w.orders[0].payment_status, 'failed');
  eq(w.calls.paymentLookups, 0, 'signature gate runs first');
});

await test('an invalid verify AFTER the order is paid cannot mark it failed', async () => {
  const w = makeWorld({
    orders: [{ ...PENDING_ORDER, status: 'paid', payment_status: 'paid' }],
  });
  const r = mockRes();
  await verifyHandler({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_X', razorpay_signature: 'f'.repeat(64) },
  }, r);
  eq(w.orders[0].payment_status, 'paid', 'paid must never regress');
});

await test('an invalid verify racing a valid one cannot undo the payment', async () => {
  const w = makeWorld({
    orders: [PENDING_ORDER],
    payments: { pay_V4: { id: 'pay_V4', order_id: 'order_RZ1', status: 'captured', amount: 47200 } },
  });
  // The forged request reads a PENDING order, then the genuine one completes
  // before the forged request gets to write. Its write must find nothing.
  w.beforeOrderPatch = async () => {
    const good = mockRes();
    await verifyHandler({
      method: 'POST', headers: {},
      body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V4', razorpay_signature: sign('order_RZ1', 'pay_V4') },
    }, good);
    eq(good.body.verified, true, 'genuine verify wins');
  };
  const bad = mockRes();
  await verifyHandler({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_BAD', razorpay_signature: 'f'.repeat(64) },
  }, bad);
  eq(w.orders[0].payment_status, 'paid', 'the losing forged write must not apply');
});

await test('repeated valid verify is idempotent and does not double-consume', async () => {
  const w = makeWorld({
    orders: [{ ...PENDING_ORDER, coupon_code: 'SAVE10' }],
    coupons: [{ id: 'c1', code: 'SAVE10', is_active: true, usage_limit: 5, used_count: 0 }],
    payments: { pay_V5: { id: 'pay_V5', order_id: 'order_RZ1', status: 'captured', amount: 47200 } },
  });
  const req = () => ({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V5', razorpay_signature: sign('order_RZ1', 'pay_V5') },
  });
  const r1 = mockRes(); await verifyHandler(req(), r1);
  const r2 = mockRes(); await verifyHandler(req(), r2);
  eq(r1.body.verified, true);
  eq(r2.body.verified, true, 'second call reports the same success');
  eq(r2.body.alreadyProcessed, true);
  eq(w.coupons[0].used_count, 1, 'coupon consumed exactly once');
});

await test('a Razorpay lookup failure leaves the order untouched (unknown != paid)', async () => {
  const w = makeWorld({
    orders: [PENDING_ORDER],
    payments: { pay_V6: { __networkError: true } },
  });
  const r = mockRes();
  await verifyHandler({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V6', razorpay_signature: sign('order_RZ1', 'pay_V6') },
  }, r);
  eq(r.statusCode, 503);
  eq(w.orders[0].payment_status, 'pending', 'neither paid nor failed');
});

await test('a captured payment for a DIFFERENT order is rejected', async () => {
  const w = makeWorld({
    orders: [PENDING_ORDER],
    payments: { pay_V7: { id: 'pay_V7', order_id: 'order_SOMETHING_ELSE', status: 'captured', amount: 47200 } },
  });
  const r = mockRes();
  await verifyHandler({
    method: 'POST', headers: {},
    body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V7', razorpay_signature: sign('order_RZ1', 'pay_V7') },
  }, r);
  eq(r.statusCode, 400);
  eq(w.orders[0].payment_status, 'pending');
});

await test('no response from /verify leaks a secret or a stack trace', async () => {
  const w = makeWorld({ orders: [PENDING_ORDER], payments: { pay_V8: { __networkError: true } } });
  const bodies = [];
  for (const sig of ['f'.repeat(64), sign('order_RZ1', 'pay_V8')]) {
    const r = mockRes();
    await verifyHandler({
      method: 'POST', headers: {},
      body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_V8', razorpay_signature: sig },
    }, r);
    bodies.push(JSON.stringify(r.body));
  }
  const blob = bodies.join(' ');
  for (const secret of [KEY_SECRET, WEBHOOK_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    ok(!blob.includes(secret), 'a secret leaked into a response body');
  }
  ok(!/\bat \w+ \(/.test(blob), 'a stack trace leaked into a response body');
});

// ============================================================
console.log('\n— Inventory, variants and quantity —');
// ============================================================

const P = {
  id: 101, biosash_id: 'b115', name: 'Diabo Juice',
  original_price: 999, sale_price: 749, discount_percent: 25, is_active: true, stock: true,
};
const P_OUT = { ...P, id: 102, biosash_id: 'b116', name: 'Sold Out Item', stock: false };
const V = [
  { id: 'v250', product_id: 101, label: '250 ml', sku: 'A', mrp: 999, sale_price: 749, stock: 6, is_active: true },
  { id: 'vOut', product_id: 101, label: '1 L', sku: 'B', mrp: 2499, sale_price: 2199, stock: 0, is_active: true },
  { id: 'vOff', product_id: 101, label: '500 ml', sku: 'C', mrp: 1499, sale_price: 1199, stock: 5, is_active: false },
  { id: 'vAlien', product_id: 999, label: '250 ml', sku: 'D', mrp: 100, sale_price: 50, stock: 5, is_active: true },
];
const NO_TAX = { rate: 0, mode: 'inclusive', sellerState: null };
const price = (items, rows = [P, P_OUT]) =>
  computeOrderTotal(items, rows, 'std', { variantRows: V, taxConfig: NO_TAX });

await test('quantity within variant stock is accepted', () => {
  const r = price([{ id: 'b115', qty: 6, variantId: 'v250' }]);
  ok(r.ok, r.error);
  eq(r.lines[0].qty, 6);
});

await test('quantity ABOVE variant stock is rejected', () => {
  const r = price([{ id: 'b115', qty: 7, variantId: 'v250' }]);
  ok(!r.ok, 'must reject 7 when only 6 are in stock');
  ok(/only 6/i.test(r.error), `unexpected message: ${r.error}`);
});

await test('a sold-out variant is rejected', () => {
  ok(!price([{ id: 'b115', qty: 1, variantId: 'vOut' }]).ok);
});

await test('a sold-out BASE product is rejected', () => {
  const r = price([{ id: 'b116', qty: 1 }]);
  ok(!r.ok, 'base product stock was previously not checked at all');
  ok(/out of stock/i.test(r.error), r.error);
});

await test('an inactive (stale) variant is rejected', () => {
  ok(!price([{ id: 'b115', qty: 1, variantId: 'vOff' }]).ok);
});

await test('an unknown variant id is rejected', () => {
  ok(!price([{ id: 'b115', qty: 1, variantId: 'v-does-not-exist' }]).ok);
});

await test("another product's variant is rejected", () => {
  ok(!price([{ id: 'b115', qty: 1, variantId: 'vAlien' }]).ok);
});

await test('duplicate cart lines are aggregated into one line', () => {
  const r = price([
    { id: 'b115', qty: 2, variantId: 'v250' },
    { id: 'b115', qty: 3, variantId: 'v250' },
  ]);
  ok(r.ok, r.error);
  eq(r.lines.length, 1, 'must collapse to a single line');
  eq(r.lines[0].qty, 5);
  eq(r.total, 749 * 5);
});

await test('duplicate cart lines that TOGETHER exceed stock are rejected', () => {
  const r = price([
    { id: 'b115', qty: 4, variantId: 'v250' },
    { id: 'b115', qty: 5, variantId: 'v250' },
  ]);
  ok(!r.ok, '4 + 5 = 9 against 6 in stock must fail — each line used to pass alone');
});

await test('splitting a line cannot walk past the per-line quantity cap', () => {
  const r = validateCartPayload([
    { id: 'b115', qty: 20 }, { id: 'b115', qty: 20 },
  ]);
  ok(!r.ok, 'merged quantity of 40 must fail the cap of 20');
});

await test('the same product with DIFFERENT variants stays two lines', () => {
  const r = normalizeCartLines([
    { id: 'b115', qty: 1, variantId: 'v250', variant: null },
    { id: 'b115', qty: 1, variantId: 'vOther', variant: null },
  ]);
  ok(r.ok);
  eq(r.items.length, 2);
});

await test('a client variant LABEL without a variant id is not persisted', () => {
  const r = price([{ id: 'b115', qty: 1, variant: '5 Litre Drum' }]);
  ok(r.ok, r.error);
  eq(r.lines[0].variant, null, 'untrusted label must not survive onto the order line');
  eq(r.lines[0].unit_price, 749, 'and it must not change the price');
});

await test('client-supplied prices are ignored entirely', () => {
  const { items } = validateCartPayload([{ id: 'b115', qty: 1, price: 1, sale_price: 1, amount: 1 }]);
  eq(price(items).total, 749);
});

// ============================================================
console.log('\n— Shipping is a flat per-method fee —');
// ============================================================

for (const [subtotal, unit] of [[100, 100], [699, 699], [700, 700], [5000, 5000]]) {
  await test(`₹${subtotal} basket -> std 0 / exp 79 / sched 49`, () => {
    const row = { ...P, sale_price: unit, original_price: unit, discount_percent: 0 };
    const at = (m) => computeOrderTotal([{ id: 'b115', qty: 1 }], [row], m, { taxConfig: NO_TAX });
    eq(at('std').shipping, 0, 'standard');
    eq(at('exp').shipping, 79, 'express must not be waived');
    eq(at('sched').shipping, 49, 'scheduled must not be waived');
    eq(at('exp').total, subtotal + 79, 'express total');
    eq(at('sched').total, subtotal + 49, 'scheduled total');
  });
}

// ============================================================
console.log('\n— COD order hardening —');
// ============================================================

const COD_WORLD = () => makeWorld({
  products: [P],
  variants: V,
  coupons: [{ id: 'c1', code: 'SAVE10', is_active: true, type: 'flat', value: 10, usage_limit: 1, used_count: 0, min_order_value: 0 }],
});
const codBody = (over = {}) => ({
  items: [{ id: 'b115', qty: 1 }],
  delivery: 'std',
  paymentMethod: 'cod',
  customer: {
    firstName: 'Asha', lastName: 'K', email: 'a@example.com', phone: '9876543210',
    address: '12 Rose Lane', city: 'Amritsar', state: 'Punjab', pin: '143001',
  },
  ...over,
});

await test('a COD order with complete details is created', async () => {
  const w = COD_WORLD();
  const r = mockRes();
  await createOrderHandler({ method: 'POST', headers: {}, body: codBody() }, r);
  eq(r.statusCode, 200);
  eq(r.body.paymentMethod, 'cod');
  eq(w.orders.length, 1);
});

for (const [field, label] of [['address', 'street address'], ['phone', 'phone'], ['city', 'city'], ['pin', 'PIN code'], ['state', 'state'], ['firstName', 'first name']]) {
  await test(`COD with an empty ${label} is rejected`, async () => {
    const w = COD_WORLD();
    const r = mockRes();
    const c = { ...codBody().customer, [field]: '' };
    await createOrderHandler({ method: 'POST', headers: {}, body: codBody({ customer: c }) }, r);
    eq(r.statusCode, 400, `empty ${field} must be rejected`);
    eq(w.orders.length, 0, 'no undeliverable order may be written');
  });
}

await test('COD with a malformed PIN code is rejected', async () => {
  const w = COD_WORLD();
  const r = mockRes();
  await createOrderHandler({ method: 'POST', headers: {}, body: codBody({ customer: { ...codBody().customer, pin: '12' } }) }, r);
  eq(r.statusCode, 400);
  eq(w.orders.length, 0);
});

await test('COD with an empty cart is rejected', async () => {
  const w = COD_WORLD();
  const r = mockRes();
  await createOrderHandler({ method: 'POST', headers: {}, body: codBody({ items: [] }) }, r);
  eq(r.statusCode, 400);
  eq(w.orders.length, 0);
});

await test('a resubmitted COD order with the same key reuses the original order', async () => {
  const w = COD_WORLD();
  const req = () => ({ method: 'POST', headers: { 'idempotency-key': 'submit-abc-123' }, body: codBody() });
  const r1 = mockRes(); await createOrderHandler(req(), r1);
  const r2 = mockRes(); await createOrderHandler(req(), r2);
  eq(w.orders.length, 1, 'a duplicate submit must not create a second order');
  eq(r2.body.orderNumber, r1.body.orderNumber, 'and must return the original');
  eq(r2.body.duplicate, true);
});

await test('two concurrent COD submits with one key still yield one order', async () => {
  const w = COD_WORLD();
  const req = () => ({ method: 'POST', headers: { 'idempotency-key': 'submit-race-1' }, body: codBody() });
  const [r1, r2] = await Promise.all([
    (async () => { const r = mockRes(); await createOrderHandler(req(), r); return r; })(),
    (async () => { const r = mockRes(); await createOrderHandler(req(), r); return r; })(),
  ]);
  eq(w.orders.length, 1, 'the unique index must decide the winner');
  eq(r1.body.orderNumber, r2.body.orderNumber);
});

await test('a DIFFERENT key still creates a legitimately separate order', async () => {
  const w = COD_WORLD();
  const r1 = mockRes();
  await createOrderHandler({ method: 'POST', headers: { 'idempotency-key': 'submit-one' }, body: codBody() }, r1);
  const r2 = mockRes();
  await createOrderHandler({ method: 'POST', headers: { 'idempotency-key': 'submit-two' }, body: codBody() }, r2);
  eq(w.orders.length, 2, 'a genuine reorder must not be swallowed');
  ok(r1.body.orderNumber !== r2.body.orderNumber);
});

await test('COD pricing is recomputed server-side, not taken from the client', async () => {
  const w = COD_WORLD();
  const r = mockRes();
  await createOrderHandler({
    method: 'POST', headers: {},
    body: codBody({ items: [{ id: 'b115', qty: 1, price: 1 }], amount: 1, total: 1 }),
  }, r);
  eq(w.orders[0].amount_paise, 74900, 'server price, not the client’s ₹1');
});

await test('COD stock is revalidated server-side', async () => {
  const w = COD_WORLD();
  const r = mockRes();
  await createOrderHandler({ method: 'POST', headers: {}, body: codBody({ items: [{ id: 'b115', qty: 7, variantId: 'v250' }] }) }, r);
  eq(r.statusCode, 400, 'over-stock COD must be rejected');
  eq(w.orders.length, 0);
});

// ============================================================
console.log('\n— Coupons —');
// ============================================================

await test('a COD order CONSUMES its coupon (it previously never did)', async () => {
  const w = COD_WORLD();
  const r = mockRes();
  await createOrderHandler({ method: 'POST', headers: {}, body: codBody({ couponCode: 'SAVE10' }) }, r);
  eq(r.statusCode, 200);
  eq(w.coupons[0].used_count, 1, 'a single-use coupon must be burnt by a COD order');
  eq(w.redemptions.length, 1);
});

await test('a single-use coupon cannot be reused on a second COD order', async () => {
  const w = COD_WORLD();
  const r1 = mockRes();
  await createOrderHandler({ method: 'POST', headers: {}, body: codBody({ couponCode: 'SAVE10' }) }, r1);
  eq(r1.body.breakdown.couponDiscount, 10, 'first order gets the discount');

  const r2 = mockRes();
  await createOrderHandler({ method: 'POST', headers: {}, body: codBody({ couponCode: 'SAVE10' }) }, r2);
  eq(w.coupons[0].used_count, 1, 'usage_limit of 1 must hold');
  eq(r2.body.breakdown.couponDiscount, 0, 'the exhausted coupon grants nothing');
});

await test('a per-user cap is enforced at consumption time', async () => {
  const w = makeWorld({
    orders: [
      { ...PENDING_ORDER, id: 'ord_1', coupon_code: 'ONCE', user_id: 'user-1' },
      { ...PENDING_ORDER, id: 'ord_2', order_number: 'SORA-TEST2', razorpay_order_id: 'order_RZ2', coupon_code: 'ONCE', user_id: 'user-1' },
    ],
    coupons: [{ id: 'c9', code: 'ONCE', is_active: true, usage_limit: 100, used_count: 0, per_user_limit: 1 }],
    payments: {
      pay_U1: { id: 'pay_U1', order_id: 'order_RZ1', status: 'captured', amount: 47200 },
      pay_U2: { id: 'pay_U2', order_id: 'order_RZ2', status: 'captured', amount: 47200 },
    },
  });
  for (const [rz, pid] of [['order_RZ1', 'pay_U1'], ['order_RZ2', 'pay_U2']]) {
    const r = mockRes();
    await verifyHandler({
      method: 'POST', headers: {},
      body: { razorpay_order_id: rz, razorpay_payment_id: pid, razorpay_signature: sign(rz, pid) },
    }, r);
    eq(r.body.verified, true, 'both payments are genuine and must be honoured');
  }
  eq(w.coupons[0].used_count, 1, 'the per-user cap of 1 must hold across two paid orders');
  ok(w.orders.every((o) => o.payment_status === 'paid'), 'a coupon cap must never fail a real payment');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
// process.exitCode, NOT process.exit(). process.exit() terminates the
// process synchronously, before Node gets to report a promise that is
// still unhandled - so a rejection from any handler could be swallowed and
// this suite would report success anyway. Setting the code and letting the
// event loop drain gives the handlers above their chance to fire.
process.exitCode = failed === 0 ? 0 : 1;
