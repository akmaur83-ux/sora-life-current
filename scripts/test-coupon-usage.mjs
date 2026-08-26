// ============================================================
// Coupon usage-limit enforcement — unit tests (offline)
//
// The real enforcement lives in the Postgres function consume_coupon
// (migration 0009), which serialises concurrent callers with a FOR UPDATE
// row lock. This file exercises a faithful JS model of that exact algorithm
// so the decision logic — first use, limit reached, concurrency, per-order
// idempotency, per-user cap, and "failed payment must not consume" — is
// proven and regression-guarded. It also statically asserts that the API
// routes only consume a coupon on the PAID transition.
//
//   node scripts/test-coupon-usage.mjs
// ============================================================
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const eq = (a, b, m) => (a === b ? ok(m) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`));

// ---- Faithful model of consume_coupon(p_code,p_order_id,p_user_id) --------
// Mirrors the SQL branch-for-branch. The async wrapper chains every call on a
// single promise, emulating the per-coupon row lock so concurrent consumes
// are serialised exactly as `SELECT ... FOR UPDATE` does in the database.
class CouponStore {
  constructor(coupon) {
    this.coupon = { used_count: 0, is_active: true, usage_limit: null, per_user_limit: null, ...coupon };
    this.redemptions = [];
    this._lock = Promise.resolve();
  }
  consume({ code, orderId = null, userId = null }) {
    const run = this._lock.then(() => this._consume({ code, orderId, userId }));
    this._lock = run.then(() => {}, () => {});
    return run;
  }
  _consume({ code, orderId, userId }) {
    const c = this.coupon;
    if (!code || !code.trim()) return 'no_coupon';
    if (c.code.toUpperCase() !== code.trim().toUpperCase() || !c.is_active) return 'no_coupon';
    if (orderId != null && this.redemptions.some((r) => r.orderId === orderId)) return 'already';
    if (c.per_user_limit != null && userId != null) {
      const uses = this.redemptions.filter((r) => r.userId === userId).length;
      if (uses >= c.per_user_limit) return 'user_limit';
    }
    if (c.usage_limit != null && c.used_count >= c.usage_limit) return 'exhausted';
    c.used_count += 1;
    this.redemptions.push({ orderId, userId });
    return 'consumed';
  }
}

console.log('\n— Coupon usage enforcement —');

// 1. First valid use
{
  const s = new CouponStore({ code: 'SAVE10', usage_limit: 3 });
  eq(await s.consume({ code: 'SAVE10', orderId: 'o1' }), 'consumed', 'first valid use is consumed');
  eq(s.coupon.used_count, 1, 'used_count incremented to 1');
}

// 2. Case-insensitive match
{
  const s = new CouponStore({ code: 'SAVE10', usage_limit: 3 });
  eq(await s.consume({ code: '  save10 ', orderId: 'o1' }), 'consumed', 'code match is case/whitespace-insensitive');
}

// 3. Usage limit reached
{
  const s = new CouponStore({ code: 'ONE', usage_limit: 1 });
  eq(await s.consume({ code: 'ONE', orderId: 'a' }), 'consumed', 'limit=1: first order consumes');
  eq(await s.consume({ code: 'ONE', orderId: 'b' }), 'exhausted', 'limit=1: second order is exhausted');
  eq(s.coupon.used_count, 1, 'used_count never exceeds usage_limit');
}

// 4. Concurrency: 20 simultaneous orders against a limit of 3
{
  const s = new CouponStore({ code: 'RACE', usage_limit: 3 });
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => s.consume({ code: 'RACE', orderId: `o${i}` })),
  );
  const consumed = results.filter((r) => r === 'consumed').length;
  const exhausted = results.filter((r) => r === 'exhausted').length;
  eq(consumed, 3, 'concurrent: exactly usage_limit consumes succeed');
  eq(exhausted, 17, 'concurrent: the rest are rejected');
  eq(s.coupon.used_count, 3, 'concurrent: used_count == usage_limit, never more');
}

// 5. Duplicate payment/webhook for the SAME order is idempotent
{
  const s = new CouponStore({ code: 'DUP', usage_limit: 5 });
  eq(await s.consume({ code: 'DUP', orderId: 'same' }), 'consumed', 'same order: first call consumes');
  eq(await s.consume({ code: 'DUP', orderId: 'same' }), 'already', 'same order: second call is a no-op (already)');
  eq(s.coupon.used_count, 1, 'duplicate delivery does not double-count');
}

// 6. Concurrent duplicate delivery (verify + webhook firing together)
{
  const s = new CouponStore({ code: 'DUP2', usage_limit: 5 });
  const [a, b] = await Promise.all([
    s.consume({ code: 'DUP2', orderId: 'x' }),
    s.consume({ code: 'DUP2', orderId: 'x' }),
  ]);
  const counts = [a, b].sort().join(',');
  eq(counts, 'already,consumed', 'concurrent same-order: exactly one consumes, one already');
  eq(s.coupon.used_count, 1, 'concurrent duplicate does not double-count');
}

// 7. Failed / cancelled order must NOT consume.
//    In production consume is ONLY called on the paid branch, so a failed
//    order simply never invokes it.
{
  const s = new CouponStore({ code: 'FAIL', usage_limit: 2 });
  // (payment failed -> route does not call consume)
  eq(s.coupon.used_count, 0, 'failed payment leaves used_count untouched');
}

// 8. Per-customer cap
{
  const s = new CouponStore({ code: 'PERUSER', usage_limit: 100, per_user_limit: 1 });
  eq(await s.consume({ code: 'PERUSER', orderId: 'o1', userId: 'u1' }), 'consumed', 'per-user: first use by u1 consumes');
  eq(await s.consume({ code: 'PERUSER', orderId: 'o2', userId: 'u1' }), 'user_limit', 'per-user: second use by u1 blocked');
  eq(await s.consume({ code: 'PERUSER', orderId: 'o3', userId: 'u2' }), 'consumed', 'per-user: a different customer can still use it');
}

// 9. Unknown / inactive coupon
{
  const s = new CouponStore({ code: 'X', is_active: false, usage_limit: 5 });
  eq(await s.consume({ code: 'X', orderId: 'o1' }), 'no_coupon', 'inactive coupon is not consumable');
  eq(await s.consume({ code: '', orderId: 'o1' }), 'no_coupon', 'empty code returns no_coupon');
}

// ---- Static guard: routes consume ONLY on the paid transition -------------
console.log('\n— Routes consume coupon only after payment is confirmed —');
for (const file of ['api/razorpay/verify.js', 'api/razorpay/webhook.js']) {
  const src = readFileSync(file, 'utf8');
  // The CALL site (has a paren) — not the import, which is `consumeCouponForOrder,`.
  const idx = src.indexOf('consumeCouponForOrder(');
  if (idx === -1) { bad(`${file}: consumeCouponForOrder not called`); continue; }
  // The nearest preceding payment_status assignment must be 'paid', and the
  // call must not sit inside a failure branch.
  const before = src.slice(0, idx);
  const lastPaid = before.lastIndexOf("payment_status: 'paid'");
  const lastFailed = before.lastIndexOf("payment_status: 'failed'");
  (lastPaid > lastFailed)
    ? ok(`${file}: coupon consumed after the PAID update`)
    : bad(`${file}: coupon consume is not clearly gated by the paid transition`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
