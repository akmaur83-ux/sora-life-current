// ============================================================
// COUPON ADMIN RULES
//
//   node scripts/test-coupon-admin.mjs
//
// Two things are being proved here.
//
// 1. Each validation rule fires for its own reason. The vacuity risk in a
//    validation matrix is a draft that is invalid for TWO reasons: the test
//    passes, but not because the rule under test works. So every invalid case
//    also asserts that repairing ONLY that field leaves zero errors. If a case
//    were failing for an unrelated reason, the repaired draft would still be
//    invalid and the test would fail.
//
// 2. couponPreview() (browser) and publicCouponView() (server) agree. They are
//    deliberate duplicates — src/ must not import api/_lib — so drift is made
//    a test failure rather than something a customer discovers.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  normalizeCode, validateCouponDraft, couponWarnings, couponStatus,
  couponRow, couponPreview,
} from '../src/lib/couponRules.js';
import { publicCouponView } from '../api/_lib/coupons.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let passed = 0; const failures = [];
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push(name); }
}

/** A draft that passes everything, so each case below breaks exactly one thing. */
const good = () => ({
  code: 'WELCOME200', type: 'flat', value: 200,
  max_discount: '', min_order_value: 1500,
  starts_at: '2026-06-01T00:00', expires_at: '2026-07-01T00:00',
  usage_limit: 500, per_user_limit: 1,
  title: '', description: '', first_order_only: false, is_stackable: false,
  is_active: false,
});

console.log('\n— The baseline is genuinely valid —\n');
test('a well-formed draft produces no errors', () => {
  assert.deepEqual(validateCouponDraft(good()), []);
});

// ====================================================================
console.log('\n— Each rule fires, and fires alone —\n');
// ====================================================================
//
// `break` makes the draft invalid; `repair` fixes ONLY the field under test.
// The repaired draft must be completely valid, which is what proves the case
// is isolating this rule rather than tripping over another one.

const RULES = [
  {
    name: 'a missing code is refused',
    match: /needs a code/,
    break: (d) => { d.code = ''; },
    repair: (d) => { d.code = 'WELCOME200'; },
  },
  {
    name: 'a code with punctuation is refused',
    match: /letters, numbers, hyphens/,
    break: (d) => { d.code = 'SAVE!20%'; },
    repair: (d) => { d.code = 'SAVE20'; },
  },
  {
    name: 'a zero discount is refused',
    match: /greater than zero/,
    break: (d) => { d.value = 0; },
    repair: (d) => { d.value = 200; },
  },
  {
    name: 'a negative discount is refused',
    match: /greater than zero/,
    break: (d) => { d.value = -50; },
    repair: (d) => { d.value = 200; },
  },
  {
    name: 'a percentage above 100 is refused',
    match: /cannot exceed 100/,
    break: (d) => { d.type = 'percent'; d.value = 120; d.min_order_value = ''; },
    repair: (d) => { d.value = 20; },
  },
  {
    name: 'a negative minimum order value is refused',
    match: /cannot be negative/,
    break: (d) => { d.min_order_value = -1; d.value = 1; },
    repair: (d) => { d.min_order_value = 1500; d.value = 200; },
  },
  {
    name: 'a flat discount larger than the minimum spend is refused as a likely typo',
    match: /more than the .* minimum spend/,
    break: (d) => { d.value = 5000; d.min_order_value = 500; },
    repair: (d) => { d.value = 200; d.min_order_value = 1500; },
  },
  {
    name: 'an expiry before the start date is refused',
    match: /must come after the start/,
    break: (d) => { d.expires_at = '2026-05-01T00:00'; },
    repair: (d) => { d.expires_at = '2026-07-01T00:00'; },
  },
  {
    name: 'an expiry EQUAL to the start date is refused',
    match: /must come after the start/,
    break: (d) => { d.expires_at = d.starts_at; },
    repair: (d) => { d.expires_at = '2026-07-01T00:00'; },
  },
  {
    name: 'a fractional usage limit is refused',
    match: /total usage limit must be a whole number/,
    break: (d) => { d.usage_limit = 2.5; },
    repair: (d) => { d.usage_limit = 500; },
  },
  {
    name: 'a zero per-customer limit is refused',
    match: /per-customer limit must be a whole number/,
    break: (d) => { d.per_user_limit = 0; },
    repair: (d) => { d.per_user_limit = 1; },
  },
];

for (const rule of RULES) {
  test(rule.name, () => {
    const broken = good();
    rule.break(broken);
    const errors = validateCouponDraft(broken);
    assert.ok(errors.some((e) => rule.match.test(e)),
      `expected an error matching ${rule.match}, got ${JSON.stringify(errors)}`);

    // NON-VACUITY: repair only this field; everything else must already be
    // fine, or this case was never testing what it claims to test.
    const repaired = { ...broken };
    rule.repair(repaired);
    assert.deepEqual(validateCouponDraft(repaired), [],
      'repairing only this field must leave a fully valid draft');
  });
}

// ====================================================================
console.log('\n— Blank optional fields are optional —\n');
// ====================================================================

test('no window, no limits and no minimum is valid', () => {
  const d = {
    ...good(), starts_at: '', expires_at: '',
    usage_limit: '', per_user_limit: '', min_order_value: '',
  };
  assert.deepEqual(validateCouponDraft(d), []);
});

test('a start date with no expiry is valid', () => {
  assert.deepEqual(validateCouponDraft({ ...good(), expires_at: '' }), []);
});

test('a flat discount above the minimum is fine when there IS no minimum', () => {
  // The typo guard must not fire on "₹5000 off any order", which is a real
  // thing someone might mean.
  assert.deepEqual(validateCouponDraft({ ...good(), value: 5000, min_order_value: '' }), []);
});

// ====================================================================
console.log('\n— Warnings advise, they do not block —\n');
// ====================================================================

test('an uncapped percentage warns', () => {
  const w = couponWarnings({ ...good(), type: 'percent', value: 25, max_discount: '' });
  assert.ok(w.some((m) => /no maximum discount/.test(m)));
});

test('a capped percentage does not warn about the cap', () => {
  const w = couponWarnings({ ...good(), type: 'percent', value: 25, max_discount: 300 });
  assert.ok(!w.some((m) => /no maximum discount/.test(m)));
});

test('a warning never becomes an error', () => {
  const draft = { ...good(), type: 'percent', value: 25, max_discount: '', min_order_value: '' };
  assert.ok(couponWarnings(draft).length > 0, 'it warns');
  assert.deepEqual(validateCouponDraft(draft), [], 'and it still saves');
});

test('no expiry and no usage limit each warn', () => {
  const w = couponWarnings({ ...good(), expires_at: '', usage_limit: '' });
  assert.ok(w.some((m) => /No expiry/.test(m)));
  assert.ok(w.some((m) => /No total usage limit/.test(m)));
});

test('a redundant per-customer limit on a first-order coupon warns', () => {
  const w = couponWarnings({ ...good(), first_order_only: true, per_user_limit: 3 });
  assert.ok(w.some((m) => /no effect/.test(m)));
});

// ====================================================================
console.log('\n— Status buckets match the customer\'s experience —\n');
// ====================================================================

const NOW = new Date('2026-06-15T12:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 86400000).toISOString();
const row = (over) => ({
  is_active: true, starts_at: day(-7), expires_at: day(7),
  usage_limit: 100, used_count: 5, ...over,
});

test('live', () => assert.equal(couponStatus(row(), NOW), 'live'));
test('inactive beats every other state', () => {
  // A switched-off coupon that is also expired and exhausted reads "off",
  // because that is the fact the admin acts on.
  assert.equal(couponStatus(row({ is_active: false, expires_at: day(-1), used_count: 100 }), NOW), 'inactive');
});
test('scheduled', () => assert.equal(couponStatus(row({ starts_at: day(1) }), NOW), 'scheduled'));
test('expired', () => assert.equal(couponStatus(row({ expires_at: day(-1) }), NOW), 'expired'));
test('exhausted', () => assert.equal(couponStatus(row({ used_count: 100 }), NOW), 'exhausted'));
test('an open-ended coupon is live', () => {
  assert.equal(couponStatus(row({ starts_at: null, expires_at: null, usage_limit: null }), NOW), 'live');
});

// ====================================================================
console.log('\n— The row a save actually writes —\n');
// ====================================================================

test('blank optional numbers become NULL, not 0', () => {
  const r = couponRow({ ...good(), max_discount: '', usage_limit: '', per_user_limit: '' });
  assert.equal(r.max_discount, null);
  assert.equal(r.usage_limit, null);
  assert.equal(r.per_user_limit, null);
});

test('min_order_value is the one that becomes 0, because it is NOT NULL', () => {
  assert.equal(couponRow({ ...good(), min_order_value: '' }).min_order_value, 0);
});

test('blank dates become NULL', () => {
  const r = couponRow({ ...good(), starts_at: '', expires_at: '' });
  assert.equal(r.starts_at, null);
  assert.equal(r.expires_at, null);
});

test('a new coupon is written INACTIVE unless explicitly enabled', () => {
  // The whole reason 0028 flipped the column default.
  assert.equal(couponRow({ ...good() }).is_active, false);
  assert.equal(couponRow({ ...good(), is_active: undefined }).is_active, false);
  assert.equal(couponRow({ ...good(), is_active: 'yes' }).is_active, false, 'only a real true counts');
  assert.equal(couponRow({ ...good(), is_active: true }).is_active, true);
});

test('the 0028 columns are always written', () => {
  const r = couponRow(good());
  for (const k of ['title', 'description', 'first_order_only', 'is_stackable']) {
    assert.ok(k in r, `${k} must be part of every save`);
  }
  assert.equal(r.title, null, 'blank copy is NULL, so the ticket falls back to the terms');
  assert.equal(r.first_order_only, false);
});

test('blank card copy is NULL rather than an empty string', () => {
  const r = couponRow({ ...good(), title: '   ', description: '' });
  assert.equal(r.title, null);
  assert.equal(r.description, null);
});

test('the code is normalised on the way in', () => {
  assert.equal(couponRow({ ...good(), code: '  welcome 200 ' }).code, 'WELCOME200');
  assert.equal(normalizeCode('save-10'), 'SAVE-10');
  assert.equal(normalizeCode(null), '');
});

// ====================================================================
console.log('\n— DRIFT GUARD: preview vs the server\'s own view —\n');
// ====================================================================
//
// couponPreview (src/lib) and publicCouponView (api/_lib) are duplicates by
// design. This runs both over every interesting shape and requires identical
// output on the three fields a customer reads.

const SHAPES = [
  { code: 'A1', type: 'flat', value: 200, min_order_value: 1500 },
  { code: 'A2', type: 'flat', value: 200, min_order_value: 0 },
  { code: 'A3', type: 'percent', value: 15, min_order_value: 999 },
  { code: 'A4', type: 'percent', value: 15, min_order_value: 0, max_discount: 300 },
  { code: 'A5', type: 'flat', value: 200, min_order_value: 1500, title: 'Welcome gift' },
  { code: 'A6', type: 'flat', value: 200, min_order_value: 1500, description: 'New customers only' },
  { code: 'A7', type: 'flat', value: 200, min_order_value: 1500, title: 'X', description: 'Y' },
  { code: 'A8', type: 'percent', value: 7.6, min_order_value: 1499.5 },
  // Blank-but-present copy: both must fall back rather than render whitespace.
  { code: 'A9', type: 'flat', value: 200, min_order_value: 250, title: '  ', description: '  ' },
  // A row from before 0028, with the copy columns simply absent.
  { code: 'B1', type: 'flat', value: 500, min_order_value: 2000 },
];

for (const shape of SHAPES) {
  test(`preview matches the server view for ${shape.code}`, () => {
    const mine = couponPreview(shape);
    const theirs = publicCouponView(shape, 0);
    for (const field of ['code', 'title', 'description', 'minOrderValue']) {
      assert.equal(mine[field], theirs[field],
        `${field}: preview "${mine[field]}" vs server "${theirs[field]}"`);
    }
  });
}

test('the preview names a code even before one is typed', () => {
  // publicCouponView always has a real row behind it, so this case is the
  // preview's alone: an empty form must render a placeholder ticket, not a
  // ticket with a blank stub.
  assert.equal(couponPreview({ type: 'flat', value: '' }).code, 'CODE');
});

// ====================================================================
console.log('\n— Boundaries the editor must not cross —\n');
// ====================================================================

test('the rules module imports neither supabase nor React', () => {
  const src = readFileSync(join(HERE, '../src/lib/couponRules.js'), 'utf8');
  assert.doesNotMatch(src, /from ['"]\.\/supabase/, 'rules must run without a database');
  assert.doesNotMatch(src, /from ['"]react/, 'rules must run without React');
});

test('no src/ file imports server code from api/_lib', () => {
  // The reason couponPreview is a mirror rather than an import. If this ever
  // becomes acceptable, the drift guard above should be replaced by an import.
  for (const f of ['../src/lib/couponRules.js', '../src/lib/couponAdminApi.js',
    '../src/lib/couponApi.js', '../src/lib/cartQuote.js',
    '../src/admin/pages/Coupons.jsx', '../src/components/CartCoupons.jsx']) {
    const src = readFileSync(join(HERE, f), 'utf8');
    assert.doesNotMatch(src, /from ['"][^'"]*api\/_lib/, `${f} must not import server code`);
  }
});

test('the storefront never reads the coupons table directly', () => {
  // Migration 0006: "a customer must not be able to enumerate every coupon."
  // Only the admin module may select from it.
  for (const f of ['../src/lib/couponApi.js', '../src/lib/cartQuote.js',
    '../src/components/CartCoupons.jsx', '../src/components/pdp/PdpCouponSlot.jsx']) {
    const src = readFileSync(join(HERE, f), 'utf8');
    assert.doesNotMatch(src, /from\(['"]coupons['"]\)/, `${f} must go through the API`);
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`failing: ${failures.join(', ')}`); process.exit(1); }
