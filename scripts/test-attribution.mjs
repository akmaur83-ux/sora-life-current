// ============================================================
// Creator Program — Part 2 attribution engine tests (offline)
//
//   node scripts/test-attribution.mjs
//
//   * REAL   — exercises the shipped computeConversionBase() so the eligible-
//              sales formula is proven against actual code.
//   * MODEL  — faithful mirrors of the 0013 SQL (last-click resolve, self-
//              referral, idempotency, refund, status transitions).
//   * STATIC — asserts the migration + order hooks keep the security shape:
//              RPCs are service-role only, creators get no row-level sales,
//              and the client never sends amounts or a creator id.
// ============================================================
import { readFileSync } from 'node:fs';
import { computeConversionBase } from '../api/_lib/attribution.js';

let pass = 0, fail = 0;
const ok = (m, k = 'MODEL') => { console.log(`  PASS [${k}]  ${m}`); pass++; };
const bad = (m, k = 'MODEL') => { console.log(`  FAIL [${k}]  ${m}`); fail++; };
const eq = (a, b, m, k) => (a === b ? ok(m, k) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, k));
const close = (a, b, m, k) => (Math.abs(a - b) < 0.02 ? ok(m, k) : bad(`${m} (got ${a}, want ${b})`, k));
const truthy = (v, m, k) => (v ? ok(m, k) : bad(m, k));

const SQL = readFileSync('supabase/migrations/0013_creator_attribution_engine.sql', 'utf8');
const CREATE = readFileSync('api/razorpay/create-order.js', 'utf8');
const VERIFY = readFileSync('api/razorpay/verify.js', 'utf8');
const HOOK = readFileSync('api/razorpay/webhook.js', 'utf8');
const PAY = readFileSync('src/lib/payments.js', 'utf8');
const n = (s) => s.replace(/\s+/g, ' ');

// ============================================================
// 1. ELIGIBLE-SALES FORMULA — real code
// ============================================================
console.log('\n— Eligible-sales base (computeConversionBase) —');
{
  // The documented spec example: Sea Buckthorn Juice 750 ml × 2 = ₹3,936.
  const example = computeConversionBase(
    [{ name: 'Sea Buckthorn Juice', variant: '750 ml', variant_id: 'v1', biosash_id: 'b82', qty: 2, unit_price: 1968, line_total: 3936 }],
    { itemTotal: 3936, couponDiscount: 0, shipping: 0 },
  );
  eq(example.totals.eligible_sales, 3936, 'spec example: 750ml ×2 → eligible ₹3,936', 'REAL');
  eq(example.totals.gross_item_sales, 3936, 'gross item sales = Σ line_total', 'REAL');
  eq(example.items[0].eligible_amount, 3936, 'per-line eligible captured', 'REAL');
  eq(example.items[0].variant_id, 'v1', 'variant id snapshotted', 'REAL');
  eq(example.items[0].product_id, 'b82', 'product id snapshotted', 'REAL');

  // Shipping is EXCLUDED from eligible.
  const withShip = computeConversionBase(
    [{ qty: 1, unit_price: 640, line_total: 640, name: 'X' }],
    { itemTotal: 640, couponDiscount: 0, shipping: 79 },
  );
  eq(withShip.totals.eligible_sales, 640, 'shipping is excluded from eligible', 'REAL');
  eq(withShip.totals.shipping, 79, 'shipping recorded separately', 'REAL');

  // Tax is EXCLUDED (taxable_value already net of GST).
  const withTax = computeConversionBase(
    [{ qty: 1, unit_price: 1000, line_total: 1000, taxable_value: 847.46, tax_amount: 152.54, name: 'Y' }],
    { itemTotal: 1000, couponDiscount: 0, shipping: 0 },
  );
  close(withTax.totals.eligible_sales, 847.46, 'GST-inclusive: eligible is the net-of-tax value', 'REAL');
  close(withTax.totals.tax, 152.54, 'tax captured separately', 'REAL');
  eq(withTax.totals.gross_item_sales, 1000, 'gross stays tax-inclusive selling price', 'REAL');

  // Coupon reduces eligible proportionally across lines (no tax case).
  const withCoupon = computeConversionBase(
    [{ qty: 1, unit_price: 600, line_total: 600, name: 'A' }, { qty: 1, unit_price: 400, line_total: 400, name: 'B' }],
    { itemTotal: 1000, couponDiscount: 100, shipping: 0 },
  );
  eq(withCoupon.totals.eligible_sales, 900, 'coupon reduces eligible by the discount (₹1000 − ₹100)', 'REAL');
  eq(withCoupon.items[0].eligible_amount, 540, 'line A coupon share applied (600 − 60)', 'REAL');
  eq(withCoupon.items[1].eligible_amount, 360, 'line B coupon share applied (400 − 40)', 'REAL');
  eq(withCoupon.totals.discounts, 100, 'discounts recorded', 'REAL');

  // Never negative, never NaN on odd input.
  const empty = computeConversionBase([], {});
  eq(empty.totals.eligible_sales, 0, 'empty order → 0 eligible, no crash', 'REAL');
}

// ============================================================
// 2. LAST-CLICK RESOLUTION + SELF-REFERRAL (mirror of 0013)
// ============================================================
console.log('\n— Last-click attribution + self-referral —');
{
  const DAY = 86400000;
  function engine(creators) {
    const attributions = new Map(); // key visitor|user -> attribution
    return {
      // record_attribution_event last-click upsert
      click({ visitorId, userId, creatorCode, when = Date.now(), windowDays = 30 }) {
        const c = creators[creatorCode];
        if (!c || c.status !== 'active') return { ok: false };
        const row = { creator_id: creatorCode, creator_user_id: c.user_id, last_seen: when, expires: when + windowDays * DAY };
        if (visitorId) attributions.set('v:' + visitorId, { ...row });
        if (userId) attributions.set('u:' + userId, { ...(attributions.get('v:' + visitorId) || row), ...row });
        return { ok: true };
      },
      // resolve_attribution_for_order: prefer user, then visitor; validate
      resolve({ visitorId, userId, now = Date.now() }) {
        let a = (userId && attributions.get('u:' + userId)) || (visitorId && attributions.get('v:' + visitorId)) || null;
        if (!a) return { ok: false, reason: 'no_attribution' };
        if (a.expires < now) return { ok: false, reason: 'expired' };
        const c = creators[a.creator_id];
        if (!c) return { ok: false, reason: 'creator_missing' };
        if (c.status !== 'active') return { ok: false, reason: 'creator_' + c.status };
        return { ok: true, creator_id: a.creator_id, creator_user_id: a.creator_user_id };
      },
    };
  }
  const creators = {
    A: { user_id: 'ua', status: 'active' }, B: { user_id: 'ub', status: 'active' },
    P: { user_id: 'up', status: 'paused' }, S: { user_id: 'us', status: 'suspended' },
  };

  // valid click resolves
  let e = engine(creators);
  e.click({ visitorId: 'v1', creatorCode: 'A' });
  eq(e.resolve({ visitorId: 'v1' }).creator_id, 'A', 'a valid click resolves to its creator', 'MODEL');

  // last-click A -> B (both in window): B wins
  e = engine(creators);
  e.click({ visitorId: 'v1', creatorCode: 'A', when: Date.now() - 2 * DAY });
  e.click({ visitorId: 'v1', creatorCode: 'B', when: Date.now() - 1 * DAY });
  eq(e.resolve({ visitorId: 'v1' }).creator_id, 'B', 'last-click: B supersedes A within the window', 'MODEL');

  // same-creator refresh: still A, expiry extended
  e = engine(creators);
  e.click({ visitorId: 'v1', creatorCode: 'A', when: Date.now() - 20 * DAY, windowDays: 30 });
  e.click({ visitorId: 'v1', creatorCode: 'A', when: Date.now(), windowDays: 30 });
  eq(e.resolve({ visitorId: 'v1' }).ok, true, 'same-creator re-click refreshes the window', 'MODEL');

  // expiry
  e = engine(creators);
  e.click({ visitorId: 'v1', creatorCode: 'A', when: Date.now() - 40 * DAY, windowDays: 30 });
  eq(e.resolve({ visitorId: 'v1' }).reason, 'expired', 'attribution past its window is expired', 'MODEL');

  // user pointer preferred over visitor (post-login click on another device)
  e = engine(creators);
  e.click({ visitorId: 'v1', creatorCode: 'A' });
  e.click({ userId: 'cust', creatorCode: 'B' });
  eq(e.resolve({ visitorId: 'v1', userId: 'cust' }).creator_id, 'B', 'signed-in user pointer wins over the visitor pointer', 'MODEL');

  // inactive/paused/suspended creator does not attribute
  e = engine(creators);
  eq(e.click({ visitorId: 'v1', creatorCode: 'P' }).ok, false, 'paused creator click is not stored', 'MODEL');

  // self-referral: order buyer is the creator's own user
  const selfResolve = (creatorUser, buyerUser) => (creatorUser && buyerUser && creatorUser === buyerUser);
  eq(selfResolve('ua', 'ua'), true, 'self-referral detected when buyer === creator owner', 'MODEL');
  eq(selfResolve('ua', 'other'), false, 'a normal buyer is not self-referral', 'MODEL');
}

// ============================================================
// 3. IDEMPOTENCY + STATUS TRANSITIONS + REFUND (mirror of 0013)
// ============================================================
console.log('\n— Conversion lifecycle: idempotency, status, refund —');
{
  function store() {
    const byOrder = new Map();
    return {
      record(orderId, { eligible, selfRef = false }) {
        if (byOrder.has(orderId)) return { ok: true, duplicate: true };
        byOrder.set(orderId, {
          status: selfRef ? 'self_referral' : 'pending',
          eligible_original: selfRef ? 0 : eligible, eligible: selfRef ? 0 : eligible, refunded: 0, qualified_at: null,
        });
        return { ok: true, duplicate: false };
      },
      setStatus(orderId, status) {
        const c = byOrder.get(orderId); if (!c) return { ok: false };
        if (c.status === 'self_referral') return { ok: true, noop: 'self_referral' };
        if (c.status === status) return { ok: true, noop: 'already' };
        if (['cancelled', 'reversed', 'refunded'].includes(c.status) && status === 'eligible') return { ok: true, noop: 'terminal' };
        c.status = status; if (status === 'eligible') c.qualified_at = Date.now();
        return { ok: true };
      },
      refund(orderId, amount) {
        const c = byOrder.get(orderId); if (!c) return { ok: false };
        c.refunded = Math.min(c.eligible_original, Math.max(0, c.refunded + amount));
        c.eligible = Math.max(0, Math.round((c.eligible_original - c.refunded) * 100) / 100);
        if (c.eligible === 0) c.status = 'refunded';
        return { ok: true, eligible: c.eligible };
      },
      get: (o) => byOrder.get(o),
    };
  }

  // idempotency — one conversion per order
  let s = store();
  eq(s.record('o1', { eligible: 1000 }).duplicate, false, 'first record creates a conversion', 'MODEL');
  eq(s.record('o1', { eligible: 1000 }).duplicate, true, 'a retried create is idempotent (duplicate)', 'MODEL');

  // pending -> eligible on paid
  eq(s.setStatus('o1', 'eligible').ok, true, 'paid transitions pending → eligible', 'MODEL');
  truthy(s.get('o1').qualified_at, 'qualified_at set on eligible', 'MODEL');
  eq(s.setStatus('o1', 'eligible').noop, 'already', 'a retried verify/webhook is a no-op', 'MODEL');

  // failed payment cancels; terminal not reopened
  s = store(); s.record('o2', { eligible: 500 });
  s.setStatus('o2', 'cancelled');
  eq(s.get('o2').status, 'cancelled', 'failed payment → cancelled', 'MODEL');
  eq(s.setStatus('o2', 'eligible').noop, 'terminal', 'a cancelled conversion is not later made eligible', 'MODEL');

  // self-referral is never eligible
  s = store(); s.record('o3', { eligible: 1000, selfRef: true });
  eq(s.get('o3').status, 'self_referral', 'self-referral conversion recorded but not commissionable', 'MODEL');
  eq(s.get('o3').eligible, 0, 'self-referral eligible = 0', 'MODEL');
  eq(s.setStatus('o3', 'eligible').noop, 'self_referral', 'self-referral cannot be flipped to eligible', 'MODEL');

  // refund reduces eligible; full refund → refunded
  s = store(); s.record('o4', { eligible: 5000 }); s.setStatus('o4', 'eligible');
  eq(s.refund('o4', 1000).eligible, 4000, 'partial refund: ₹5000 − ₹1000 = ₹4000 eligible', 'MODEL');
  eq(s.refund('o4', 4000).eligible, 0, 'further refund drives eligible to 0', 'MODEL');
  eq(s.get('o4').status, 'refunded', 'fully-refunded conversion → refunded', 'MODEL');
  eq(s.refund('o4', 999).eligible, 0, 'refund never goes negative / over-refunds', 'MODEL');
}

// ============================================================
// 4. SECURITY / SHAPE (static against migration + hooks)
// ============================================================
console.log('\n— Security & integration shape —');
{
  // Tables + idempotency constraint
  for (const t of ['creator_attributions', 'creator_conversions', 'creator_conversion_items', 'creator_conversion_audit']) {
    truthy(new RegExp(`create table if not exists public\\.${t}`).test(SQL), `${t} table defined`, 'STATIC');
  }
  truthy(/constraint creator_conversions_order_uk unique \(order_id\)/.test(SQL), 'one conversion per order (UNIQUE order_id)', 'STATIC');

  // Server-only RPCs (never callable by the browser)
  for (const fn of ['resolve_attribution_for_order', 'record_conversion', 'set_conversion_status']) {
    truthy(new RegExp(`revoke all on function public\\.${fn}[\\s\\S]{0,160}from public, anon, authenticated`).test(SQL), `${fn} revoked from anon/authenticated`, 'STATIC');
    truthy(new RegExp(`grant execute on function public\\.${fn}[\\s\\S]{0,160}to service_role`).test(SQL), `${fn} granted to service_role only`, 'STATIC');
  }

  // Creators get NO row-level access to conversions/items (PII/order data);
  // only admin read + the aggregate RPC.
  truthy(!/create policy "[^"]*" on public\.creator_conversions[\s\S]*?current_creator_id/.test(SQL),
    'creator_conversions has NO creator self-read policy (creators use aggregates only)', 'STATIC');
  truthy(/creator_conversions admin read/.test(SQL) && /creator_conv_items admin read/.test(SQL), 'admin read policies exist for conversions + items', 'STATIC');
  truthy(/my_creator_analytics/.test(SQL) && /grant execute on function public\.my_creator_analytics\(\) to authenticated/.test(SQL),
    'creators get a safe aggregate analytics RPC', 'STATIC');
  truthy(!/my_creator_analytics[\s\S]*?customer|email|phone|address/i.test(SQL.match(/my_creator_analytics[\s\S]*?\$\$/)?.[0] || ''),
    'creator analytics exposes no customer PII', 'STATIC');

  // Self-referral + refund logic present
  truthy(/self_referral/.test(SQL) && /creator_user_id.*= p_user_id|creator_user_id'\)::uuid = p_user_id/.test(n(SQL)), 'self-referral exclusion in record_conversion', 'STATIC');
  truthy(/admin_refund_conversion/.test(SQL) && /is_sora_admin\(\) then raise exception 'admin only'/.test(n(SQL)), 'refund adjustment is admin-gated', 'STATIC');
  truthy(/creator_conversion_audit/.test(SQL), 'immutable audit trail table exists', 'STATIC');

  // Order integration: create-order records a conversion with SERVER totals,
  // verify/webhook qualify it; the browser never supplies amounts or ids.
  truthy(/recordConversion/.test(CREATE) && /computeConversionBase\(totals\.lines/.test(CREATE), 'create-order records conversion from server totals', 'STATIC');
  truthy(/non-fatal|never break|never block/i.test(CREATE), 'attribution is non-fatal in create-order', 'STATIC');
  truthy(/setConversionStatus\(order\.id, 'eligible'/.test(VERIFY), 'verify qualifies the conversion on paid', 'STATIC');
  truthy(/setConversionStatus\(order\.id, 'eligible'/.test(HOOK) && /setConversionStatus\(order\.id, 'cancelled'/.test(HOOK), 'webhook qualifies on capture, cancels on failure', 'STATIC');
  truthy(/visitorId: getVisitorId\(\)/.test(PAY), 'client sends only the opaque visitor id', 'STATIC');
  truthy(!/creator_id|campaign_id|commission|eligible|line_total|amount/i.test(PAY.match(/createPaymentOrder[\s\S]*?\n}/)?.[0] || ''),
    'client sends NO creator id / amount / commission at checkout', 'STATIC');

  // No Part 3 leakage — check for actual OBJECT definitions, not comment words.
  truthy(!/create table if not exists public\.(creator_commissions|creator_payouts|creator_withdrawals|creator_settlements)/i.test(SQL),
    'no commission/payout/withdrawal TABLES in Part 2', 'STATIC');
  truthy(!/\b(commission_amount|payout_amount|withdrawal_amount)\b/i.test(SQL),
    'no commission/payout amount COLUMNS in Part 2', 'STATIC');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
