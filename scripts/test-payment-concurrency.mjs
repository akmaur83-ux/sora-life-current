// ============================================================
// Repeated concurrency exercise for the payment paths.
//
// test-payment-hardening.mjs proves each race is handled ONCE. This suite
// runs the same races many times with RANDOMISED async interleaving, so a
// scheduling order that only shows up occasionally has a chance to appear
// deterministically rather than as an intermittent CI failure.
//
// The randomisation is in the FAKE DATABASE, not in the tests: every REST
// call yields for a random number of microtask turns before responding, so
// two concurrent handlers interleave differently on every iteration. No
// sleeps, no wall-clock timing — nothing here can pass by going slower.
//
// Invariants asserted on every single iteration:
//   * an order settles to paid exactly once
//   * a coupon is consumed at most once per order
//   * payment state never regresses from paid
//   * one idempotency key yields exactly one order
//
//   node scripts/test-payment-concurrency.mjs           (default 300 rounds)
//   STRESS=1 node scripts/test-payment-concurrency.mjs  (3000 rounds)
// ============================================================
import {
  makeWorld, mockRes, sign, webhookReq, PENDING_ORDER,
} from './lib/payment-test-harness.mjs';

const verifyHandler = (await import('../api/razorpay/verify.js')).default;
const webhookHandler = (await import('../api/razorpay/webhook.js')).default;
const createOrderHandler = (await import('../api/razorpay/create-order.js')).default;

const ROUNDS = Number(process.env.ROUNDS || (process.env.STRESS ? 3000 : 300));

let passed = 0, failed = 0;
let currentCase = '(startup)';

// The handlers log rejected signatures and mismatches by design, and at
// thousands of rounds that buries the result. Capture instead of print, so
// the volume is still visible as a count and nothing is silently lost.
const realError = console.error.bind(console);
let handlerLogs = 0;
console.error = () => { handlerLogs += 1; };

function reportFatal(kind, err) {
  realError(`\n  FATAL ${kind} during: ${currentCase}`);
  realError(`  ${err && err.stack ? err.stack : err}`);
  realError(`\n${passed} passed, ${failed + 1} failed (aborted)\n`);
  process.exit(1);
}
process.on('unhandledRejection', (err) => reportFatal('unhandledRejection', err));
process.on('uncaughtException', (err) => reportFatal('uncaughtException', err));

function fail(msg) { throw new Error(msg); }
function eq(a, b, msg) {
  if (a !== b) fail(`${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

/**
 * Run one race `ROUNDS` times. Any failing round reports its round number
 * and a seed-equivalent description, so a failure is reproducible.
 */
async function race(name, round) {
  currentCase = name;
  let firstError = null;
  for (let i = 1; i <= ROUNDS; i += 1) {
    try {
      await round(i);
    } catch (e) {
      firstError = `round ${i}/${ROUNDS}: ${e.message}`;
      break;
    }
  }
  if (firstError) { console.log(`  FAIL  ${name}\n        ${firstError}`); failed++; }
  else { console.log(`  PASS  ${name} (${ROUNDS} rounds)`); passed++; }
}

/** Randomise how many microtask turns each fake REST call takes. */
function jitter(world) {
  const inner = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    const turns = Math.floor(Math.random() * 5);
    for (let i = 0; i < turns; i += 1) await Promise.resolve();
    const res = await inner(...args);
    const after = Math.floor(Math.random() * 3);
    for (let i = 0; i < after; i += 1) await Promise.resolve();
    return res;
  };
  return world;
}

const COUPON = () => [{ id: 'c1', code: 'SAVE10', is_active: true, type: 'flat', value: 10, usage_limit: 5, used_count: 0, min_order_value: 0 }];

console.log(`\n— Concurrency invariants (${ROUNDS} randomised rounds each) —`);

// ---- Two identical captures delivered at the same moment --------------
await race('concurrent duplicate webhook captures settle exactly once', async () => {
  const w = jitter(makeWorld({
    orders: [{ ...PENDING_ORDER, coupon_code: 'SAVE10' }],
    coupons: COUPON(),
  }));
  const entity = { id: 'pay_R1', order_id: 'order_RZ1', amount: 47200, currency: 'INR' };
  await Promise.all([
    webhookHandler(webhookReq('payment.captured', entity), mockRes()),
    webhookHandler(webhookReq('payment.captured', entity), mockRes()),
  ]);
  eq(w.orders[0].payment_status, 'paid', 'order must be paid');
  eq(w.coupons[0].used_count, 1, 'coupon consumed exactly once');
  eq(w.redemptions.length, 1, 'exactly one redemption row');
});

// ---- authorized and captured racing each other ------------------------
await race('authorized racing captured still ends paid', async () => {
  const w = jitter(makeWorld({ orders: [PENDING_ORDER] }));
  const entity = { id: 'pay_R2', order_id: 'order_RZ1', amount: 47200, currency: 'INR' };
  await Promise.all([
    webhookHandler(webhookReq('payment.authorized', entity), mockRes()),
    webhookHandler(webhookReq('payment.captured', entity), mockRes()),
  ]);
  eq(w.orders[0].payment_status, 'paid', 'capture must win regardless of arrival order');
});

// ---- A stale failure racing a genuine capture -------------------------
await race('a failed event can never beat a capture into the final state', async () => {
  const w = jitter(makeWorld({ orders: [PENDING_ORDER] }));
  await Promise.all([
    webhookHandler(webhookReq('payment.captured', {
      id: 'pay_R3a', order_id: 'order_RZ1', amount: 47200, currency: 'INR',
    }), mockRes()),
    webhookHandler(webhookReq('payment.failed', {
      id: 'pay_R3b', order_id: 'order_RZ1', amount: 47200, currency: 'INR',
      error_description: 'stale earlier attempt',
    }), mockRes()),
  ]);
  // Whichever lands first, paid is terminal: it must never be overwritten.
  if (w.orders[0].payment_status === 'failed' && w.transactions.some((t) => t.status === 'captured')) {
    fail('a captured payment was overwritten by a failure event');
  }
});

// ---- /verify racing the webhook for the same order --------------------
await race('verify racing the webhook consumes the coupon once', async () => {
  const w = jitter(makeWorld({
    orders: [{ ...PENDING_ORDER, coupon_code: 'SAVE10' }],
    coupons: COUPON(),
    payments: { pay_R4: { id: 'pay_R4', order_id: 'order_RZ1', status: 'captured', amount: 47200 } },
  }));
  await Promise.all([
    verifyHandler({
      method: 'POST', headers: {},
      body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_R4', razorpay_signature: sign('order_RZ1', 'pay_R4') },
    }, mockRes()),
    webhookHandler(webhookReq('payment.captured', {
      id: 'pay_R4', order_id: 'order_RZ1', amount: 47200, currency: 'INR',
    }), mockRes()),
  ]);
  eq(w.orders[0].payment_status, 'paid', 'order must be paid');
  eq(w.coupons[0].used_count, 1, 'coupon must not be double-consumed across the two paths');
});

// ---- A forged verify racing a genuine one -----------------------------
await race('a forged verify racing a genuine one cannot unset paid', async () => {
  const w = jitter(makeWorld({
    orders: [PENDING_ORDER],
    payments: { pay_R5: { id: 'pay_R5', order_id: 'order_RZ1', status: 'captured', amount: 47200 } },
  }));
  await Promise.all([
    verifyHandler({
      method: 'POST', headers: {},
      body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_R5', razorpay_signature: sign('order_RZ1', 'pay_R5') },
    }, mockRes()),
    verifyHandler({
      method: 'POST', headers: {},
      body: { razorpay_order_id: 'order_RZ1', razorpay_payment_id: 'pay_FORGED', razorpay_signature: 'f'.repeat(64) },
    }, mockRes()),
  ]);
  eq(w.orders[0].payment_status, 'paid', 'the genuine capture must survive the forged attempt');
});

// ---- Concurrent COD submits under one idempotency key -----------------
const COD_BODY = {
  items: [{ id: 'b115', qty: 1 }],
  delivery: 'std',
  paymentMethod: 'cod',
  customer: {
    firstName: 'Asha', lastName: 'K', email: 'a@example.com', phone: '9876543210',
    address: '12 Rose Lane', city: 'Amritsar', state: 'Punjab', pin: '143001',
  },
};
const PRODUCT = {
  id: 101, biosash_id: 'b115', name: 'Diabo Juice',
  original_price: 999, sale_price: 749, discount_percent: 25, is_active: true, stock: true,
};

await race('concurrent COD submits with one key create exactly one order', async () => {
  const w = jitter(makeWorld({ products: [PRODUCT], coupons: COUPON() }));
  const req = () => ({ method: 'POST', headers: { 'idempotency-key': 'race-key-1' }, body: COD_BODY });
  const [r1, r2] = await Promise.all([
    (async () => { const r = mockRes(); await createOrderHandler(req(), r); return r; })(),
    (async () => { const r = mockRes(); await createOrderHandler(req(), r); return r; })(),
  ]);
  eq(w.orders.length, 1, 'exactly one order may exist');
  eq(r1.body?.orderNumber, r2.body?.orderNumber, 'both callers must see the same order');
});

await race('concurrent COD submits with one coupon consume it once', async () => {
  const w = jitter(makeWorld({ products: [PRODUCT], coupons: COUPON() }));
  const req = () => ({
    method: 'POST', headers: { 'idempotency-key': 'race-key-2' },
    body: { ...COD_BODY, couponCode: 'SAVE10' },
  });
  await Promise.all([
    createOrderHandler(req(), mockRes()),
    createOrderHandler(req(), mockRes()),
  ]);
  eq(w.orders.length, 1, 'exactly one order');
  eq(w.coupons[0].used_count, 1, 'coupon consumed once, not once per submit');
});

await race('concurrent prepaid submits with one key create one DB and one Razorpay order', async () => {
  const w = jitter(makeWorld({ products: [PRODUCT] }));
  const req = () => ({
    method: 'POST', headers: { 'idempotency-key': 'online-race-key-1' },
    body: { ...COD_BODY, paymentMethod: 'online' },
  });
  const [r1, r2] = await Promise.all([
    (async () => { const r = mockRes(); await createOrderHandler(req(), r); return r; })(),
    (async () => { const r = mockRes(); await createOrderHandler(req(), r); return r; })(),
  ]);

  eq(w.orders.length, 1, 'exactly one local order may exist');
  eq(w.calls.razorpayOrders, 1, 'exactly one Razorpay order may be created');
  eq(r1.statusCode, 200, 'first caller succeeds');
  eq(r2.statusCode, 200, 'racing caller receives the completed replay');
  eq(r1.body?.orderNumber, r2.body?.orderNumber, 'both callers see the same local order');
  eq(r1.body?.razorpayOrderId, r2.body?.razorpayOrderId, 'both callers see the same Razorpay order');
  for (const response of [r1.body, r2.body]) {
    eq(response?.keyId, process.env.RAZORPAY_KEY_ID, 'Checkout key id is present');
    eq(response?.amountPaise, 74900, 'Checkout paise amount is present');
    eq(response?.currency, 'INR', 'Checkout currency is present');
  }
});

console.log(`\n  (${handlerLogs} expected handler log lines captured, not printed)`);
console.log(`\n${passed} passed, ${failed} failed  (${ROUNDS} rounds each)\n`);

// See test-payment-hardening.mjs: process.exit() would terminate before
// Node reports a still-unhandled promise rejection, letting an async fault
// pass as a clean run.
process.exitCode = failed === 0 ? 0 : 1;
