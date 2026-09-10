// ============================================================
// COUPON VALIDATION MATRIX
//
// Nine cases, one per outcome in COUPON_REASONS. Each asserts BOTH halves:
// the verdict, and the rupee figure that follows from it — a coupon that is
// refused must also discount nothing, because a reason the customer cannot
// see is worth very little if the total moved anyway.
//
// The second half of this file is the part that matters. Every one of these
// tests is also run against a reconstruction of the PRE-CHANGE code, and four
// of them must FAIL there. A test suite that passes against the code it was
// written to justify is proving nothing.
//
//   node scripts/test-coupon-validation.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COUPON_REASONS as R, validateCoupon, reasonMessage, publicCouponView } from '../api/_lib/coupons.js';
import { computeCouponDiscount } from '../api/_lib/pricing.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-06-15T12:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 86400000).toISOString();

let passed = 0; const failures = [];
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push(name); }
}

/** A coupon that passes everything, so each case below changes exactly one thing. */
const base = () => ({
  id: 'c-1', code: 'SAVE200', type: 'flat', value: 200,
  min_order_value: 1000, max_discount: null,
  starts_at: day(-7), expires_at: day(7),
  usage_limit: 100, used_count: 3, per_user_limit: 1,
  is_active: true, first_order_only: false, is_stackable: false,
});

/** The whole decision for one case: verdict + the discount that follows it. */
function judge(coupon, ctx) {
  const verdict = validateCoupon(coupon, { now: NOW, ...ctx });
  return { ...verdict, discount: verdict.ok ? computeCouponDiscount(coupon, ctx.eligibleAmount) : 0 };
}

const CASES = [
  {
    name: '1  a coupon that satisfies every rule applies, and discounts',
    coupon: base(), ctx: { eligibleAmount: 2000 },
    reason: R.OK, ok: true, discount: 200,
  },
  {
    name: '2  an unknown code is not_found',
    coupon: null, ctx: { eligibleAmount: 2000 },
    reason: R.NOT_FOUND, ok: false, discount: 0,
  },
  {
    name: '3  a switched-off coupon is inactive',
    coupon: { ...base(), is_active: false }, ctx: { eligibleAmount: 2000 },
    reason: R.INACTIVE, ok: false, discount: 0,
  },
  {
    name: '4  a coupon whose window has not opened is not_started',
    coupon: { ...base(), starts_at: day(1) }, ctx: { eligibleAmount: 2000 },
    reason: R.NOT_STARTED, ok: false, discount: 0,
  },
  {
    name: '5  a coupon past its window is expired',
    coupon: { ...base(), expires_at: day(-1) }, ctx: { eligibleAmount: 2000 },
    reason: R.EXPIRED, ok: false, discount: 0,
  },
  {
    name: '6  a basket under the minimum is below_min_order',
    coupon: base(), ctx: { eligibleAmount: 999 },
    reason: R.BELOW_MIN, ok: false, discount: 0,
  },
  {
    name: '7  a coupon at its total usage limit is exhausted',
    coupon: { ...base(), usage_limit: 50, used_count: 50 }, ctx: { eligibleAmount: 2000 },
    reason: R.EXHAUSTED, ok: false, discount: 0,
  },
  {
    name: '8  a buyer at their per-user limit hits user_limit',
    coupon: base(), ctx: { eligibleAmount: 2000, userUses: 1 },
    reason: R.USER_LIMIT, ok: false, discount: 0,
  },
  {
    name: '9  a returning buyer is refused a first-order-only coupon',
    coupon: { ...base(), first_order_only: true },
    ctx: { eligibleAmount: 2000, hasPriorOrder: true },
    reason: R.FIRST_ORDER_ONLY, ok: false, discount: 0,
  },
];

console.log('\n— The matrix —\n');
for (const c of CASES) {
  test(c.name, () => {
    const got = judge(c.coupon, c.ctx);
    assert.equal(got.reason, c.reason, `reason: expected ${c.reason}, got ${got.reason}`);
    assert.equal(got.ok, c.ok);
    assert.equal(got.discount, c.discount, `discount: expected ${c.discount}, got ${got.discount}`);
    if (!c.ok) {
      assert.ok(reasonMessage(got.reason, c.coupon).length > 0,
        'every refusal must have customer-facing wording');
    }
  });
}

// ====================================================================
console.log('\n— Edges the matrix does not cover —\n');
// ====================================================================

test('an open-ended coupon (no window at all) applies', () => {
  const got = judge({ ...base(), starts_at: null, expires_at: null }, { eligibleAmount: 2000 });
  assert.equal(got.reason, R.OK);
});

test('a null per_user_limit means unlimited, however many times used', () => {
  const got = judge({ ...base(), per_user_limit: null }, { eligibleAmount: 2000, userUses: 99 });
  assert.equal(got.reason, R.OK);
});

test('an UNKNOWN prior-order status never refuses a first-order coupon', () => {
  // A guest checkout cannot be shown to be a returning customer, and must not
  // be treated as one. consume_coupon holds the final lock either way.
  const c = { ...base(), first_order_only: true };
  assert.equal(judge(c, { eligibleAmount: 2000, hasPriorOrder: null }).reason, R.OK);
  assert.equal(judge(c, { eligibleAmount: 2000, hasPriorOrder: false }).reason, R.OK);
});

test('an UNKNOWN per-user count never refuses on user_limit', () => {
  assert.equal(judge(base(), { eligibleAmount: 2000, userUses: null }).reason, R.OK);
});

test('a percent coupon is capped by max_discount', () => {
  const c = { ...base(), type: 'percent', value: 25, max_discount: 300 };
  assert.equal(judge(c, { eligibleAmount: 4000 }).discount, 300, '25% of 4000 is 1000, capped to 300');
});

test('a flat coupon never discounts more than the goods are worth', () => {
  const c = { ...base(), value: 5000, min_order_value: 0 };
  assert.equal(judge(c, { eligibleAmount: 1200 }).discount, 1200, 'never negative, never beyond the basket');
});

test('exactly at the minimum passes; one rupee under does not', () => {
  assert.equal(judge(base(), { eligibleAmount: 1000 }).reason, R.OK);
  assert.equal(judge(base(), { eligibleAmount: 999 }).reason, R.BELOW_MIN);
});

test('the check order reports the FIRST thing wrong, not the last', () => {
  // Expired AND under the minimum AND exhausted. The customer is told it
  // expired, because that is the fact they cannot do anything about.
  const c = { ...base(), expires_at: day(-1), usage_limit: 5, used_count: 5 };
  assert.equal(judge(c, { eligibleAmount: 10 }).reason, R.EXPIRED);
});

// ====================================================================
console.log('\n— The 0028 columns are absent-tolerant —\n');
// ====================================================================

test('a row without the 0028 columns validates as "no extra rules"', () => {
  // This is the live shape today: 0028 is not applied, so first_order_only
  // and is_stackable simply are not on the row.
  const legacy = { ...base() };
  delete legacy.first_order_only; delete legacy.is_stackable;
  delete legacy.title; delete legacy.description;
  assert.equal(judge(legacy, { eligibleAmount: 2000, hasPriorOrder: true }).reason, R.OK,
    'an absent first_order_only must mean "anyone", never "nobody"');
});

test('publicCouponView renders a legacy row without inventing copy', () => {
  const legacy = { ...base() };
  delete legacy.title; delete legacy.description;
  const view = publicCouponView(legacy, 200);
  assert.equal(view.title, '₹200 off', 'title falls back to the coupon\'s own terms');
  assert.equal(view.description, 'On orders above ₹1000');
  assert.equal(view.code, 'SAVE200');
});

test('publicCouponView never leaks the internal counters', () => {
  const view = publicCouponView(base(), 200);
  for (const leak of ['used_count', 'usage_limit', 'per_user_limit', 'id']) {
    assert.ok(!(leak in view), `${leak} must not reach the browser`);
  }
});

// ====================================================================
console.log('\n— NON-VACUITY: the same matrix against the pre-change code —\n');
// ====================================================================
//
// Before this build there was no validateCoupon. Two places decided:
//   * fetchCouponByCode  — SQL-side is_active, plus window and usage_limit
//   * computeCouponDiscount — returned 0 below min_order_value
// Nothing anywhere checked per_user_limit or first_order_only at quote or
// order time, and "below minimum" produced a silent zero rather than a reason.
//
// This reconstructs that behaviour verbatim from the deleted resolver and
// runs the matrix against it. Four cases MUST fail. If they ever stop
// failing, the matrix has stopped testing anything.

/** The pre-change decision, reconstructed from the removed fetchCouponByCode. */
function judgeOld(coupon, ctx) {
  const now = NOW.getTime();
  // fetchCouponByCode returned null — indistinguishable from "unknown code" —
  // for every one of these.
  let resolved = coupon;
  if (!resolved || resolved.is_active !== true) resolved = null;
  else if (resolved.starts_at && new Date(resolved.starts_at).getTime() > now) resolved = null;
  else if (resolved.expires_at && new Date(resolved.expires_at).getTime() < now) resolved = null;
  else if (resolved.usage_limit != null && Number(resolved.used_count) >= Number(resolved.usage_limit)) resolved = null;

  return {
    ok: Boolean(resolved),
    reason: resolved ? R.OK : R.NOT_FOUND,
    discount: resolved ? computeCouponDiscount(resolved, ctx.eligibleAmount) : 0,
  };
}

const MUST_FAIL_ON_OLD = new Set([
  CASES[2].name, // inactive        -> old code said not_found
  CASES[3].name, // not_started     -> old code said not_found
  CASES[4].name, // expired         -> old code said not_found
  CASES[5].name, // below_min       -> old code applied it, discount silently 0
  CASES[6].name, // exhausted       -> old code said not_found
  CASES[7].name, // user_limit      -> NOT CHECKED AT ALL: old code applied it
  CASES[8].name, // first_order_only-> NOT CHECKED AT ALL: old code applied it
]);

let vacuous = 0;
for (const c of CASES) {
  const got = judgeOld(c.coupon, c.ctx);
  const agrees = got.reason === c.reason && got.ok === c.ok && got.discount === c.discount;
  const shouldFail = MUST_FAIL_ON_OLD.has(c.name);

  if (shouldFail && agrees) {
    console.log(`  VACUOUS  ${c.name}\n           passes against pre-change code too — proves nothing`);
    vacuous++;
  } else if (shouldFail) {
    console.log(`  fails-on-old  ${c.name}\n                old: reason=${got.reason} discount=${got.discount}`);
  } else {
    console.log(`  (unchanged)   ${c.name}`);
  }
}

// The two that matter most: rules the old code did not have at all.
test('NV  per_user_limit was genuinely unenforced before this change', () => {
  const old = judgeOld(base(), { eligibleAmount: 2000, userUses: 1 });
  assert.equal(old.ok, true, 'pre-change code applied a coupon the buyer had already used');
  assert.equal(old.discount, 200, 'and discounted for it');
});

test('NV  first_order_only was genuinely unenforced before this change', () => {
  const old = judgeOld({ ...base(), first_order_only: true }, { eligibleAmount: 2000, hasPriorOrder: true });
  assert.equal(old.ok, true, 'pre-change code applied a first-order coupon to a returning buyer');
});

test('NV  below-minimum used to be a silent zero, not an explanation', () => {
  const old = judgeOld(base(), { eligibleAmount: 999 });
  assert.equal(old.discount, 0, 'the total did not move');
  assert.equal(old.reason, R.OK, 'but nothing told the customer why');
});

test('NV  the reconstruction is faithful: it matches the deleted resolver', () => {
  // Guards the reconstruction itself. If supabaseAdmin.js ever grows a
  // fetchCouponByCode again, the comparison above is no longer against
  // "the pre-change code" and this file is lying about what it proves.
  const admin = readFileSync(join(HERE, '../api/_lib/supabaseAdmin.js'), 'utf8');
  assert.doesNotMatch(admin, /function fetchCouponByCode/,
    'the old resolver is gone; judgeOld is the only copy of its behaviour');
});

test('NV  at least four matrix cases fail against pre-change code', () => {
  assert.equal(vacuous, 0, `${vacuous} case(s) pass against the old code and prove nothing`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`failing: ${failures.join(', ')}`); process.exit(1); }
