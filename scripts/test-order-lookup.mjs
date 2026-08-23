// Unit tests for the Purchase Passport guest order-lookup logic
// (no network, no secrets). Run: node scripts/test-order-lookup.mjs
import {
  normalizeOrderNumber, normalizeEmail, customerEmailMatches, sanitizeOrderForCustomer,
} from '../api/_lib/orderLookup.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); } };

const ORDER = {
  id: 'a1b2c3d4-uuid-should-never-leak',
  order_number: 'SORA-M1X2Y3Z4123',
  status: 'paid',
  payment_status: 'paid',
  payment_method: 'razorpay',
  razorpay_order_id: 'order_should_never_leak',
  razorpay_payment_id: 'pay_should_never_leak',
  amount_paise: 230800,
  currency: 'INR',
  items: [{ product_id: 2, biosash_id: 'b126', name: 'Black Seed Oil Capsule', unit_price: 1687, qty: 1, line_total: 1687 }],
  customer: {
    email: 'Real.Customer@Example.com',
    phone: '+91 98765 43210',
    firstName: 'Real', lastName: 'Customer',
    address: 'Sector 22', apartment: '', landmark: '', city: 'Chandigarh', state: 'Chandigarh', pin: '160022',
  },
  delivery_method: 'std',
  failure_reason: null,
  paid_at: '2026-08-23T10:15:00.000Z',
  created_at: '2026-08-23T10:10:00.000Z',
  updated_at: '2026-08-23T10:15:00.000Z',
};

console.log('\n— Ownership proof: order number alone is never enough —');
ok('correct email (exact case) matches', customerEmailMatches(ORDER, 'Real.Customer@Example.com'));
ok('correct email, different case, matches', customerEmailMatches(ORDER, 'real.customer@example.com'));
ok('correct email with surrounding whitespace matches', customerEmailMatches(ORDER, '  real.customer@example.com  '));
ok('wrong email is rejected', !customerEmailMatches(ORDER, 'attacker@example.com'));
ok('empty email is rejected', !customerEmailMatches(ORDER, ''));
ok('undefined email is rejected', !customerEmailMatches(ORDER, undefined));
ok('near-miss email (typo) is rejected', !customerEmailMatches(ORDER, 'real.customerr@example.com'));

console.log('\n— An order with no stored email can never be claimed —');
ok('missing customer object never matches', !customerEmailMatches({ ...ORDER, customer: null }, 'anyone@example.com'));
ok('blank stored email never matches, even blank input', !customerEmailMatches({ ...ORDER, customer: { ...ORDER.customer, email: '' } }, ''));

console.log('\n— Order number normalization is consistent (no case-sensitivity gaps) —');
ok('lowercase order number normalizes to stored case', normalizeOrderNumber('sora-m1x2y3z4123') === 'SORA-M1X2Y3Z4123');
ok('whitespace is trimmed', normalizeOrderNumber('  SORA-M1X2Y3Z4123  ') === 'SORA-M1X2Y3Z4123');
ok('email normalization lowercases + trims', normalizeEmail('  Real.Customer@Example.com ') === 'real.customer@example.com');

console.log('\n— The response sent to the browser never leaks internal/service data —');
{
  const safe = sanitizeOrderForCustomer(ORDER);
  const json = JSON.stringify(safe);
  ok('internal row uuid is not present', !('id' in safe) && !json.includes(ORDER.id));
  ok('razorpay_order_id is not present', !('razorpay_order_id' in safe) && !json.includes('order_should_never_leak'));
  ok('razorpay_payment_id is not present', !('razorpay_payment_id' in safe) && !json.includes('pay_should_never_leak'));
  ok('failure_reason is not present', !('failure_reason' in safe));
  ok('order number is present', safe.orderNumber === 'SORA-M1X2Y3Z4123');
  ok('amount is converted from paise to rupees', safe.amount === 2308);
  ok('items array is preserved for display', Array.isArray(safe.items) && safe.items[0].name === 'Black Seed Oil Capsule');
  ok('no batch/expiry/tracking fields are invented', !json.toLowerCase().includes('batch') && !json.toLowerCase().includes('expiry') && !json.toLowerCase().includes('tracking'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
