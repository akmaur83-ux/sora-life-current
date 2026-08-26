// ============================================================
// Input safety / XSS / injection — unit tests (offline)
//
// Proves the server treats all user-controlled cart/lookup input as inert
// DATA: prices are never read from the client, quantities are bounded, and
// script/HTML payloads survive only as plain strings (React escapes them on
// render; the server never interpolates them into HTML or SQL).
//
//   node scripts/test-input-safety.mjs
// ============================================================
import { validateCartPayload, MAX_QTY_PER_LINE } from '../api/_lib/pricing.js';
import { normalizeOrderNumber, normalizeEmail, customerEmailMatches } from '../api/_lib/orderLookup.js';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const eq = (a, b, m) => (a === b ? ok(m) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`));

console.log('\n— Cart payload: client can never dictate price —');

// 1. Any client-supplied price/mrp/discount is stripped
{
  const r = validateCartPayload([{ id: 'b82', qty: 1, price: 1, mrp: 1, sale_price: 1, discount: 99, unit_price: 0 }]);
  eq(r.ok, true, 'valid line accepted');
  const item = r.items[0];
  const keys = Object.keys(item).sort().join(',');
  eq(keys, 'id,qty,variant,variantId', 'only id/qty/variant/variantId are kept — no price fields survive');
  eq('price' in item || 'mrp' in item || 'discount' in item, false, 'no price/mrp/discount leaks through');
}

// 2. Quantity bounds
{
  eq(validateCartPayload([{ id: 'x', qty: -1 }]).ok, false, 'qty = -1 rejected');
  eq(validateCartPayload([{ id: 'x', qty: 0 }]).ok, false, 'qty = 0 rejected');
  eq(validateCartPayload([{ id: 'x', qty: 999999 }]).ok, false, 'qty = 999999 rejected');
  eq(validateCartPayload([{ id: 'x', qty: 1.5 }]).ok, false, 'non-integer qty rejected');
  eq(validateCartPayload([{ id: 'x', qty: MAX_QTY_PER_LINE }]).ok, true, 'qty at the max is accepted');
}

// 3. Empty / oversized carts
{
  eq(validateCartPayload([]).ok, false, 'empty cart rejected');
  eq(validateCartPayload(Array.from({ length: 51 }, () => ({ id: 'x', qty: 1 }))).ok, false, 'too many lines rejected');
  eq(validateCartPayload('not-an-array').ok, false, 'non-array payload rejected');
}

console.log('\n— XSS / injection payloads survive only as inert strings —');

// 4. A script payload in id/variant is coerced to a bounded string, never executed
{
  const xss = '<script>alert(document.cookie)</script>';
  const r = validateCartPayload([{ id: xss, qty: 1, variant: xss, variantId: xss }]);
  eq(r.ok, true, 'payload does not crash validation');
  eq(typeof r.items[0].id, 'string', 'id is a plain string (data, not code)');
  eq(typeof r.items[0].variant, 'string', 'variant is a plain string');
  eq(r.items[0].variantId.length <= 64, true, 'variantId is length-capped (<=64)');
  eq(r.items[0].variant.length <= 120, true, 'variant is length-capped (<=120)');
}

// 5. SQL-ish payloads are just strings too (server uses parameterised REST filters)
{
  const sqli = "b82'; drop table orders;--";
  const r = validateCartPayload([{ id: sqli, qty: 1 }]);
  eq(r.ok, true, 'SQL-looking id is accepted as data');
  eq(r.items[0].id, sqli, 'the string is preserved verbatim (never interpreted)');
}

console.log('\n— Order lookup normalisation & ownership —');

// 6. Normalisation
{
  eq(normalizeOrderNumber('  sora-abc-123 '), 'SORA-ABC-123', 'order number trimmed + upper-cased');
  eq(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com', 'email trimmed + lower-cased');
}

// 7. Ownership needs BOTH a stored email AND a matching input
{
  const order = { customer: { email: 'buyer@example.com' } };
  eq(customerEmailMatches(order, 'buyer@example.com'), true, 'matching email grants access');
  eq(customerEmailMatches(order, 'BUYER@EXAMPLE.COM'), true, 'match is case-insensitive');
  eq(customerEmailMatches(order, 'attacker@evil.com'), false, 'wrong email denied');
  eq(customerEmailMatches({ customer: {} }, ''), false, 'order with no email cannot be claimed with a blank input');
  eq(customerEmailMatches({ customer: {} }, 'x@y.com'), false, 'order with no stored email is never matchable');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
