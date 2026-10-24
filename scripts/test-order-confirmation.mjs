// ============================================================
// After the order: what is recorded, and what the customer is told.
//
// Three audit findings (2026-10-20):
//   5   a cash-on-delivery order never became paid — no invoice number, not in
//       the admin's paid count, its creator commission never qualified, and a
//       signed-in COD buyer stayed a "first-time" customer forever;
//   7   the Pay button showed the local estimate ("Pay ₹1,000" over a ₹900
//       charge with a coupon);
//   11  the confirmation claimed an email had been sent (none is), an
//       authorised payment sat under "Payment cancelled", a confirmation call
//       that did not answer told the customer the order was not placed — and
//       Try again reopened Razorpay for an order already paid.
//
// The server parts run the real handlers against the payment double; the
// browser parts are pinned in Checkout.jsx and the admin Orders page. No
// network.
//   node scripts/test-order-confirmation.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, mockRes, webhookReq } from './lib/payment-test-harness.mjs';

const markCollected = (await import('../api/admin/mark-cod-collected.js')).default;
const createOrder = (await import('../api/razorpay/create-order.js')).default;
const webhook = (await import('../api/razorpay/webhook.js')).default;

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
console.error = () => {}; console.warn = () => {};

const PRODUCTS = [{ id: 2, biosash_id: 'b2', name: 'Juice', original_price: 1000, discount_percent: 0, sale_price: 1000, is_active: true, stock: true }];
const CUSTOMER = {
  email: 'asha@example.com', phone: '9876543210', firstName: 'Asha', lastName: 'K',
  address: '12 MG Road', apartment: '', landmark: '', city: 'Ludhiana', state: 'Punjab', pin: '141001',
};
const ADMIN = 'Bearer admin-0123456789abcdefghij';
const SHOPPER = 'Bearer shopper-0123456789abcdefghij';

/** The double, plus the signed-in buyer and per-user order reads it does not speak. */
function world(seed = {}) {
  const w = makeWorld({ products: PRODUCTS, ...seed });
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const rel = url.pathname.replace('/rest/v1/', '');
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/auth/v1/user') {
      const m = /^Bearer user-(\w+)$/.exec(init.headers?.Authorization || '');
      if (m) return json({ id: `user-${m[1]}` }); // a signed-in shopper; any other token goes to the double
    }
    if (rel === 'orders' && (init.method || 'GET') === 'GET' && url.searchParams.get('user_id')) {
      const uid = url.searchParams.get('user_id').replace('eq.', '');
      const ps = (url.searchParams.get('payment_status') || '').replace('eq.', '');
      return json(w.orders.filter((o) => o.user_id === uid && (!ps || o.payment_status === ps)).slice(0, 1).map((o) => ({ id: o.id })));
    }
    return inner(input, init);
  };
  return w;
}
const codOrder = (over = {}) => ({
  id: 'ord_cod', order_number: 'SORA-COD1', status: 'pending', payment_status: 'pending', payment_method: 'cod',
  amount_paise: 100000, fulfillment_status: null, invoice_number: null, invoiced_at: null, ...over,
});
let ip = 0;
async function collect(orderNumber, authorization = ADMIN) {
  const res = mockRes();
  await markCollected({ method: 'POST', headers: { authorization, 'x-forwarded-for': `10.7.0.${(ip++ % 250) + 1}` }, body: { orderNumber } }, res);
  return res;
}

console.log('\n— Cash on delivery: the cash is recorded, once, by an admin —');

await test('A1 an admin marks a COD order collected: paid, invoiced and dated in one write; its commission qualifies', async () => {
  const w = world({ orders: [codOrder()] });
  const res = await collect('sora-cod1');
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const o = w.orders[0];
  assert.equal(o.payment_status, 'paid');
  assert.equal(o.status, 'paid');
  assert.match(o.invoice_number, /^SL\/\d{4}\//, 'an invoice number is issued');
  assert.ok(o.invoiced_at && o.paid_at, 'dated');
  assert.equal(o.payment_method, 'cod', 'still cash on delivery');
  assert.deepEqual(res.body.order, { id: o.id, order_number: 'SORA-COD1', status: 'paid', payment_status: 'paid', paid_at: o.paid_at, invoice_number: o.invoice_number, invoiced_at: o.invoiced_at, collected_by: 'owner@soralife.test' });
  assert.deepEqual(w.conversionStatuses, [{ p_order_id: 'ord_cod', p_status: 'eligible', p_reason: 'cod_collected' }]);
});

await test('A2 a second click — or two at once — issues one invoice number, and reports it already paid', async () => {
  const w = world({ orders: [codOrder()] });
  const [a, b] = await Promise.all([collect('SORA-COD1'), collect('SORA-COD1')]);
  assert.deepEqual([a.statusCode, b.statusCode], [200, 200]);
  assert.equal([a, b].filter((r) => r.body.alreadyPaid).length, 1, 'one of them found it already paid');
  const number = w.orders[0].invoice_number;
  const again = await collect('SORA-COD1');
  assert.equal(again.body.alreadyPaid, true);
  assert.equal(w.orders[0].invoice_number, number, 'never re-issued');
  assert.equal(w.conversionStatuses.length, 1);
});

await test('A3 only an admin: no token is 401, a shopper\'s token is 403, and the order is untouched', async () => {
  const w = world({ orders: [codOrder()] });
  assert.equal((await collect('SORA-COD1', '')).statusCode, 401);
  assert.equal((await collect('SORA-COD1', SHOPPER)).statusCode, 403);
  assert.equal(w.orders[0].payment_status, 'pending');
  assert.equal(w.orders[0].invoice_number, null);
});

await test('A4 only an uncancelled cash-on-delivery order: an online order and a cancelled one are refused; an unknown number is 404', async () => {
  const w = world({ orders: [
    codOrder({ id: 'o_rzp', order_number: 'SORA-RZP1', payment_method: 'razorpay' }),
    codOrder({ id: 'o_can', order_number: 'SORA-CAN1', fulfillment_status: 'cancelled' }),
  ] });
  const online = await collect('SORA-RZP1');
  assert.equal(online.statusCode, 409);
  assert.match(online.body.error, /Only a cash-on-delivery order/);
  const cancelled = await collect('SORA-CAN1');
  assert.equal(cancelled.statusCode, 409);
  assert.match(cancelled.body.error, /cancelled/);
  assert.equal((await collect('SORA-NOPE')).statusCode, 404);
  assert.ok(w.orders.every((o) => o.payment_status === 'pending'));
});

await test('A5 once collected, a signed-in COD buyer is no longer a first-time customer (a first-order code is refused to them)', async () => {
  const w = world({ coupons: [{ id: 'c2', code: 'FIRST', type: 'flat', value: 50, min_order_value: 0, first_order_only: true, used_count: 0, is_active: true }] });
  const place = async (key) => {
    const res = mockRes();
    await createOrder({ method: 'POST', headers: { 'idempotency-key': key, authorization: 'Bearer user-U1', 'x-forwarded-for': `10.7.1.${ip++ % 250}` },
      body: { items: [{ id: 'b2', qty: 1 }], delivery: 'std', customer: CUSTOMER, paymentMethod: 'cod', couponCode: 'FIRST' } }, res);
    return res;
  };
  const first = await place('key-confirm-a5-aaaa');
  assert.equal(first.statusCode, 200);
  assert.equal((await collect(first.body.orderNumber)).statusCode, 200);
  const second = await place('key-confirm-a5-bbbb');
  assert.equal(second.statusCode, 409, 'the collected order counts as a paid one');
  assert.equal(second.body.reason, 'first_order_only');
});

await test('A7 it records WHICH admin pressed it — their user id and email, once, with the order', async () => {
  const w = world({ orders: [codOrder()] });
  const res = await collect('SORA-COD1');
  assert.equal(res.body.order.collected_by, 'owner@soralife.test');
  assert.deepEqual(w.orderEvents, [{ order_id: 'ord_cod', action: 'cod_collected', admin_user_id: 'admin-user-1', admin_email: 'owner@soralife.test' }]);
  await collect('SORA-COD1');
  assert.equal(w.orderEvents.length, 1, 'a second click records nothing');
  const refused = world({ orders: [codOrder({ fulfillment_status: 'cancelled' })] });
  await collect('SORA-COD1');
  assert.equal(refused.orderEvents.length, 0, 'a refused order records nothing');
});

await test('A8 before migration 0040 is run, the button still marks the order paid (without the record)', async () => {
  const w = world({ orders: [codOrder()], noAuditRpc: true });
  const res = await collect('SORA-COD1');
  assert.equal(res.statusCode, 200);
  assert.equal(w.orders[0].payment_status, 'paid');
  assert.match(w.orders[0].invoice_number, /^SL\//);
  assert.equal(w.orderEvents.length, 0);
  assert.equal(res.body.order.collected_by, null);
});

console.log('\n— A paid order is never handed back as payable —');

await test('P1 resubmitting a checkout whose order is already paid answers "already paid", with nothing payable', async () => {
  const w = world();
  const key = 'key-confirm-p1-aaaa';
  const body = { items: [{ id: 'b2', qty: 1 }], delivery: 'std', customer: CUSTOMER, paymentMethod: 'online', couponCode: null };
  const submit = async () => { const res = mockRes(); await createOrder({ method: 'POST', headers: { 'idempotency-key': key, 'x-forwarded-for': '10.7.2.1' }, body }, res); return res; };
  await submit();
  const order = w.orders[0];
  const cap = mockRes();
  await webhook(webhookReq('payment.captured', { id: 'pay_p1', order_id: order.razorpay_order_id, amount: order.amount_paise, currency: 'INR' }), cap);
  assert.equal(order.payment_status, 'paid');
  const again = await submit();
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.alreadyPaid, true);
  assert.equal(again.body.orderNumber, order.order_number);
  assert.equal(again.body.amount, 1000);
  assert.equal(again.body.razorpayOrderId, undefined, 'no gateway order to pay again');
  assert.equal(again.body.keyId, undefined);
  assert.equal(w.calls.razorpayOrders, 1);
});

console.log('\n— Checkout tells the truth —');

const checkout = code('src/pages/Checkout.jsx');

await test('C1 the Pay button shows the server\'s figure — the order\'s, else the live quote\'s — and no figure before the server answers', () => {
  assert.match(checkout, /const charged = serverBreakdown\?\.grandTotal\n\s+\?\? \(quote\.breakdown && !quote\.stale \? quote\.breakdown\.grandTotal : null\);/);
  assert.match(checkout, /Place order\{charged != null && ` · \$\{money\(charged\)\}`\}/);
  assert.match(checkout, /Pay\{charged != null && ` \$\{money\(charged\)\}`\}/);
  assert.doesNotMatch(checkout, /money\(total\)/, 'the local estimate is never on the button');
  assert.doesNotMatch(checkout, /const total = /);
});

await test('C2 the confirmation claims no email, gives the order number to keep, and tracks through the Passport, which guests can open', () => {
  assert.doesNotMatch(checkout, /confirmation has been sent/i);
  assert.doesNotMatch(read('src/pages/Checkout.jsx'), /sent to your email/i);
  assert.match(checkout, /Your order number is <strong>#\{orderNo\}<\/strong>\. Keep it to track your order\./);
  assert.match(checkout, /<Link to=\{`\/passport\/\$\{orderNo\}`\}[^>]*>Track my order<\/Link>/);
  assert.doesNotMatch(checkout, /to="\/account\/orders"/);
  assert.match(checkout, /pay === 'cod' \? 'To pay on delivery' : confirming \? 'Amount' : 'Total paid'/, 'a COD order has not been paid yet');
  assert.doesNotMatch(checkout, /pay\.toUpperCase\(\)/, 'no "ONLINE"');
});

await test('C3 an authorised payment, or a confirmation call that does not answer, is a placed order being confirmed — never "not placed"', () => {
  assert.match(checkout, /\} else if \(result\?\.pending\) \{\n\s+completeOrder\(result\.orderNumber \|\| created\.orderNumber, created\.amount, \{ confirming: true \}\);/);
  assert.match(checkout, /if \(err\.status >= 400 && err\.status < 500 && err\.status !== 429\) \{\n\s+inFlight\.current = false; setProcessing\(false\);\n\s+setPayError\(/, 'only an examined refusal says nothing was placed');
  assert.match(checkout, /\n\s+completeOrder\(created\.orderNumber, created\.amount, \{ confirming: true \}\);\n\s+\}\n\s+\},/, 'anything else completes as confirming');
  assert.match(checkout, /\{confirming \? 'Payment received' : 'Order confirmed'\}/);
  assert.match(checkout, /please do not pay again/);
  const notices = checkout.match(/setPayNotice\('[^']+'\)/g) || []; // the ones that say something (not the clears)
  assert.deepEqual(notices, ["setPayNotice('Payment cancelled. Your cart and details have been kept.')"], 'the "Payment cancelled" notice is now only for a closed window');
});

await test('C4 a replay that comes back "already paid" completes the order instead of opening a payment window', () => {
  assert.match(checkout, /if \(created\.alreadyPaid \|\| created\.paymentMethod === 'cod'\) \{\n\s+completeOrder\(created\.orderNumber, created\.amount\);\n\s+return;/);
});

console.log('\n— The admin records the cash —');

await test('A6 the Orders page offers "Mark cash collected" only on an unpaid, uncancelled COD order, through the admin route', () => {
  const orders = code('src/admin/pages/Orders.jsx');
  assert.match(orders, /if \(order\.payment_method !== 'cod' \|\| order\.payment_status === 'paid' \|\| order\.fulfillment_status === 'cancelled'\) return null;/);
  assert.match(orders, /onUpdated\(await adminMarkCodCollected\(order\.order_number\)\);/);
  assert.match(orders, /window\.confirm\(/, 'asked to confirm first');
  assert.match(orders, /<CashCollected order=\{o\} onUpdated=\{updateOrder\} \/>/);
  const api = code('src/lib/adminApi.js');
  assert.match(api, /fetchImpl\('\/api\/admin\/mark-cod-collected', \{\n\s+method: 'POST',\n\s+headers: \{ 'Content-Type': 'application\/json', Authorization: `Bearer \$\{token\}` \},\n\s+body: JSON\.stringify\(\{ orderNumber \}\),/);
  const route = code('api/admin/mark-cod-collected.js');
  assert.match(route, /const admin = await callerIdentity\(authorization, cfg\);\n\s+if \(!admin \|\| !\(await callerIsAdmin\(authorization, cfg\)\)\) return fail\(res, 403/, 'who it is and that they are an admin, before any service-role read');
  assert.match(route, /let paid = await markCodCollected\(order\.id, admin, generateInvoiceNumber\(\), cfg\);/, 'paid and recorded in one call');
  assert.ok(route.indexOf('callerIsAdmin(authorization') < route.indexOf('findOrderByNumber(orderNumber'), 'checked before the order is even read');
  assert.match(route, /\}, cfg, \{ unlessPaid: true \}\);/, 'one conditional write');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
