// Unit tests for the payment security logic (no network, no secrets).
// Run: node scripts/test-payment-logic.mjs
import crypto from 'node:crypto';
import { validateCartPayload, computeOrderTotal, trustedUnitPrice } from '../api/_lib/pricing.js';
import { verifyPaymentSignature } from '../api/_lib/razorpay.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); } };

// Trusted product rows, as they come from the DB.
const ROWS = [
  { id: 2, biosash_id: 'b183', name: 'Beard Cream', original_price: 295, discount_percent: 20, sale_price: 236, is_active: true },
  { id: 3, biosash_id: 'b185', name: 'Beard Wash', original_price: 225, discount_percent: 15, sale_price: 191, is_active: true },
  { id: 9, biosash_id: 'b999', name: 'Retired Item', original_price: 100, discount_percent: 0, sale_price: 100, is_active: false },
];

console.log('\n— Amount is computed from the DB, not the client —');
{
  const { ok: v, items } = validateCartPayload([{ id: 'b183', qty: 2 }]);
  const t = computeOrderTotal(items, ROWS, 'std');
  // 236 * 2 = 472; standard shipping is ₹0 at every basket size.
  ok('uses DB sale_price, not any client price', v && t.ok && t.subtotal === 472);
  ok('standard shipping is free (472 + 0)', t.shipping === 0 && t.total === 472);
  ok('paise conversion is correct (472 -> 47200, not 472)', t.amountPaise === 47200);
}
{
  // Client tries to smuggle a price/amount — those fields must be ignored entirely.
  const { items } = validateCartPayload([{ id: 'b183', qty: 1, price: 1, sale_price: 1, amount: 1 }]);
  const t = computeOrderTotal(items, ROWS, 'std');
  ok('client-supplied price/amount fields are ignored', t.total === 236);
}
{
  // Express is ₹79 regardless of basket value — there is no threshold that
  // waives it. A large basket used to ship express for free.
  const { items } = validateCartPayload([{ id: 'b183', qty: 3 }]); // 708
  const t = computeOrderTotal(items, ROWS, 'exp');
  ok('express charged on a large basket (708 + 79)', t.subtotal === 708 && t.shipping === 79 && t.total === 787);
  const { items: i2 } = validateCartPayload([{ id: 'b185', qty: 1 }]); // 191
  const t2 = computeOrderTotal(i2, ROWS, 'exp');
  ok('express charged on a small basket (191 + 79)', t2.shipping === 79 && t2.total === 270);
}

console.log('\n— Tampering is rejected —');
ok('quantity 0 rejected', !validateCartPayload([{ id: 'b183', qty: 0 }]).ok);
ok('negative quantity rejected', !validateCartPayload([{ id: 'b183', qty: -5 }]).ok);
ok('fractional quantity rejected', !validateCartPayload([{ id: 'b183', qty: 1.5 }]).ok);
ok('absurd quantity rejected', !validateCartPayload([{ id: 'b183', qty: 99999 }]).ok);
ok('empty cart rejected', !validateCartPayload([]).ok);
ok('missing id rejected', !validateCartPayload([{ qty: 1 }]).ok);
{
  const { items } = validateCartPayload([{ id: 'does-not-exist', qty: 1 }]);
  ok('unknown product id rejected (cannot silently lower total)', !computeOrderTotal(items, ROWS, 'std').ok);
}
{
  const { items } = validateCartPayload([{ id: 'b999', qty: 1 }]);
  ok('inactive product rejected', !computeOrderTotal(items, ROWS, 'std').ok);
}
{
  const { items } = validateCartPayload([{ id: 'b183', qty: 1 }]);
  const t = computeOrderTotal(items, ROWS, 'free-shipping-please');
  ok('unknown delivery method falls back to std (no fee injection)', t.ok && t.deliveryMethod === 'std');
}
ok('unit price falls back to original+discount when sale_price missing',
  trustedUnitPrice({ original_price: 200, discount_percent: 10, sale_price: null }) === 180);

console.log('\n— Razorpay signature verification —');
{
  const SECRET = 'test_secret_not_a_real_key';
  const orderId = 'order_TEST123';
  const paymentId = 'pay_TEST456';
  const good = crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

  ok('genuine signature accepted',
    verifyPaymentSignature({ orderId, paymentId, signature: good, keySecret: SECRET }) === true);
  ok('forged signature rejected',
    verifyPaymentSignature({ orderId, paymentId, signature: 'f'.repeat(64), keySecret: SECRET }) === false);
  ok('signature from a different secret rejected',
    verifyPaymentSignature({ orderId, paymentId, signature: crypto.createHmac('sha256', 'other').update(`${orderId}|${paymentId}`).digest('hex'), keySecret: SECRET }) === false);
  ok('swapped payment id rejected (replay with another payment)',
    verifyPaymentSignature({ orderId, paymentId: 'pay_OTHER', signature: good, keySecret: SECRET }) === false);
  ok('swapped order id rejected',
    verifyPaymentSignature({ orderId: 'order_OTHER', paymentId, signature: good, keySecret: SECRET }) === false);
  ok('empty signature rejected', !verifyPaymentSignature({ orderId, paymentId, signature: '', keySecret: SECRET }));
  ok('missing secret rejected', !verifyPaymentSignature({ orderId, paymentId, signature: good, keySecret: '' }));
  ok('length-mismatched signature rejected without throwing',
    verifyPaymentSignature({ orderId, paymentId, signature: 'abc', keySecret: SECRET }) === false);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
