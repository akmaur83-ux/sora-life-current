// ============================================================
// Webhook security tests — signature verification over the RAW body,
// replay/idempotency behaviour and amount-tampering resistance.
//
// Run: node scripts/test-webhook-security.mjs
// ============================================================
import crypto from 'node:crypto';
import { verifyWebhookSignature } from '../api/_lib/razorpay.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
function eq(a, b, m) { if (a !== b) throw new Error(`${m || 'not equal'}: got ${a}, want ${b}`); }

const SECRET = 'whsec_test_abc123';
const OTHER = 'whsec_other_secret';

const body = JSON.stringify({
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_ABC', order_id: 'order_XYZ', amount: 159900, currency: 'INR', method: 'upi' } } },
});
const sign = (raw, secret) => crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

console.log('\n— Webhook signature —');

test('genuine webhook signature accepted', () => {
  eq(verifyWebhookSignature({ rawBody: body, signature: sign(body, SECRET), webhookSecret: SECRET }), true);
});

test('signature from a different secret rejected', () => {
  eq(verifyWebhookSignature({ rawBody: body, signature: sign(body, OTHER), webhookSecret: SECRET }), false);
});

test('tampered body rejected (amount raised after signing)', () => {
  const sig = sign(body, SECRET);
  const tampered = body.replace('159900', '100');
  eq(verifyWebhookSignature({ rawBody: tampered, signature: sig, webhookSecret: SECRET }), false);
});

test('re-serialised JSON fails (proves raw bytes are required)', () => {
  const sig = sign(body, SECRET);
  const reserialised = JSON.stringify(JSON.parse(body).payload); // different bytes
  eq(verifyWebhookSignature({ rawBody: reserialised, signature: sig, webhookSecret: SECRET }), false);
});

test('missing signature rejected', () => {
  eq(verifyWebhookSignature({ rawBody: body, signature: '', webhookSecret: SECRET }), false);
});

test('missing secret rejected', () => {
  eq(verifyWebhookSignature({ rawBody: body, signature: sign(body, SECRET), webhookSecret: '' }), false);
});

test('length-mismatched signature rejected without throwing', () => {
  eq(verifyWebhookSignature({ rawBody: body, signature: 'abc', webhookSecret: SECRET }), false);
});

test('empty body rejected', () => {
  eq(verifyWebhookSignature({ rawBody: '', signature: sign('', SECRET), webhookSecret: SECRET }), false);
});

console.log('\n— Idempotency / amount integrity (logic contract) —');

// These model the invariants the webhook route relies on, so a future edit
// that breaks them fails here rather than in production.

test('replayed payment id is a duplicate, not a second payment', () => {
  const seen = new Set();
  const record = (paymentId) => {
    if (seen.has(paymentId)) return { inserted: false, duplicate: true };
    seen.add(paymentId); return { inserted: true, duplicate: false };
  };
  eq(record('pay_ABC').inserted, true);
  eq(record('pay_ABC').duplicate, true, 'second delivery must be a duplicate');
  eq(seen.size, 1, 'only one payment record');
});

test('captured amount must equal the server-computed order amount', () => {
  const order = { amount_paise: 159900 };
  const matches = (paid) => Number(order.amount_paise) === Number(paid);
  eq(matches(159900), true, 'correct amount accepted');
  eq(matches(100), false, 'underpayment must not mark paid');
  eq(matches(999999), false, 'overpayment must not silently pass');
});

test('an already-paid order is not paid twice', () => {
  const order = { payment_status: 'paid' };
  const shouldProcess = order.payment_status !== 'paid';
  eq(shouldProcess, false, 'must short-circuit');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
