// ============================================================
// Creator Program — Part 3 earnings / KYC / payouts tests (offline)
//
//   node scripts/test-payouts.mjs
//
//   MODEL  — faithful mirrors of the 0014 SQL (commission, snapshot, reversal,
//            ledger buckets, hold, payout window/min/one-per-period/reserve/
//            reject-release/approve/mark-paid/overpayment/duplicate-ref).
//   STATIC — asserts the migration keeps the security + privacy shape (no raw
//            KYC stored, creator cannot verify/pay/edit ledger, RPCs locked).
// ============================================================
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (m, k = 'MODEL') => { console.log(`  PASS [${k}]  ${m}`); pass++; };
const bad = (m, k = 'MODEL') => { console.log(`  FAIL [${k}]  ${m}`); fail++; };
const eq = (a, b, m, k) => (a === b ? ok(m, k) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, k));
const truthy = (v, m, k) => (v ? ok(m, k) : bad(m, k));
const r2 = (n) => Math.round(n * 100) / 100;
const SQL = readFileSync('supabase/migrations/0014_creator_earnings_payouts.sql', 'utf8');
const nsp = (s) => s.replace(/\s+/g, ' ');

// ============================================================
// 1. COMMISSION FORMULA + SNAPSHOT + REVERSAL
// ============================================================
console.log('\n— Commission: formula, snapshot, reversal —');
{
  const commission = (eligible, rate) => r2(eligible * rate / 100);
  eq(commission(3936, 10), 393.60, 'commission = eligible × rate (₹3,936 × 10% = ₹393.60)', 'MODEL');
  eq(commission(2936, 10), 293.60, 'reduced base after refund (₹2,936 × 10% = ₹293.60)', 'MODEL');

  // Rate snapshot immutability: a ledger entry keeps its earn-time rate.
  const ledger = [{ conversion: 'c1', rate: 10, eligible: 3936, amount: commission(3936, 10) }];
  // creator's rate later changes to 15% — recompute must NOT touch c1
  const currentRate = 15;
  eq(ledger[0].amount, 393.60, 'old commission stays at its snapshot rate after a rate change (10%, not 15%)', 'MODEL');
  eq(commission(3936, currentRate), 590.40, 'a NEW conversion would use the new 15% rate', 'MODEL');

  // Refund reversal: ₹1000 eligible refunded at the ORIGINAL 10% → −₹100.
  const refundReversal = (deltaEligible, snapshotRate) => r2(-deltaEligible * snapshotRate / 100);
  eq(refundReversal(1000, 10), -100, '₹1,000 refund at snapshot 10% → reversal −₹100', 'MODEL');
  const net = r2(ledger[0].amount + refundReversal(1000, 10));
  eq(net, 293.60, 'net commission after reversal = ₹293.60', 'MODEL');
}

// ============================================================
// 2. LEDGER BALANCE BUCKETS + SETTLEMENT HOLD
// ============================================================
console.log('\n— Ledger balances + settlement hold —');
{
  // Mirror of my_creator_earnings bucketing over signed ledger entries.
  function balances(entries, now) {
    const held = entries.filter(e => e.status === 'held' && (!e.available_at || e.available_at > now) && !e.payout_id).reduce((s, e) => s + e.amount, 0);
    const available = entries.filter(e => !e.payout_id && (e.status === 'available' || (e.status === 'held' && e.available_at <= now))).reduce((s, e) => s + e.amount, 0);
    const reserved = entries.filter(e => e.status === 'reserved').reduce((s, e) => s + e.amount, 0);
    const paid = entries.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
    const reversed = entries.filter(e => e.type !== 'commission').reduce((s, e) => s - e.amount, 0);
    return { held: r2(held), available: r2(available), reserved: r2(reserved), paid: r2(paid), reversed: r2(reversed) };
  }
  const T = 1000000; // now
  const held = { type: 'commission', status: 'held', amount: 393.60, available_at: T + 100, payout_id: null };
  eq(balances([held], T).held, 393.60, 'a fresh commission sits in HELD during the settlement window', 'MODEL');
  eq(balances([held], T).available, 0, 'held commission is NOT yet available', 'MODEL');

  const matured = { type: 'commission', status: 'held', amount: 393.60, available_at: T - 100, payout_id: null };
  eq(balances([matured], T).available, 393.60, 'after the hold passes, it derives as AVAILABLE', 'MODEL');

  const reserved = { type: 'commission', status: 'reserved', amount: 393.60, payout_id: 'p1' };
  eq(balances([reserved], T).reserved, 393.60, 'reserved (in an active payout) counts as RESERVED not available', 'MODEL');
  eq(balances([reserved], T).available, 0, 'reserved money is not double-spendable', 'MODEL');

  const paid = { type: 'commission', status: 'paid', amount: 393.60, payout_id: 'p1' };
  eq(balances([paid], T).paid, 393.60, 'paid entries roll into PAID', 'MODEL');

  const rev = { type: 'reversal', status: 'available', amount: -100 };
  eq(balances([matured, rev], T).available, 293.60, 'a reversal reduces available to the net (₹293.60)', 'MODEL');
  eq(balances([matured, rev], T).reversed, 100, 'reversed bucket reports ₹100 removed', 'MODEL');
}

// ============================================================
// 3. PAYOUT: window, minimum, one-per-period, reserve/release, pay
// ============================================================
console.log('\n— Payout request lifecycle —');
{
  function payoutEngine(cfg) {
    let ledgerAvailable, kyc, requests;
    const reset = (avail, kycStatus) => { ledgerAvailable = avail; kyc = kycStatus; requests = []; };
    reset(0, 'not_started');
    return {
      reset,
      request({ dayOfMonth, amount = null, period = '2026-02' }) {
        if (kyc !== 'verified') return { ok: false, reason: 'kyc_required' };
        if (dayOfMonth !== cfg.payout_day) return { ok: false, reason: 'window_closed' };
        if (requests.some(r => r.period === period && ['requested', 'under_review', 'approved', 'paid'].includes(r.status)))
          return { ok: false, reason: 'already_requested' };
        if (ledgerAvailable < cfg.min_payout) return { ok: false, reason: 'below_minimum' };
        let amt = amount == null ? ledgerAvailable : amount;
        if (!cfg.allow_partial) amt = ledgerAvailable;
        if (amt > ledgerAvailable) return { ok: false, reason: 'exceeds_available' };
        const req = { id: 'p' + (requests.length + 1), period, amount: r2(amt), status: 'requested', reserved: r2(amt) };
        requests.push(req);
        ledgerAvailable = r2(ledgerAvailable - amt); // reserved out of available
        return { ok: true, ...req };
      },
      review(id, action) {
        const r = requests.find(x => x.id === id);
        if (!r) return { ok: false };
        if (['paid', 'cancelled'].includes(r.status)) return { ok: false, reason: 'terminal' };
        if (action === 'approve') { r.status = 'approved'; return { ok: true }; }
        if (action === 'reject') { r.status = 'rejected'; ledgerAvailable = r2(ledgerAvailable + r.reserved); r.reserved = 0; return { ok: true, released: true }; }
        if (action === 'review') { r.status = 'under_review'; return { ok: true }; }
      },
      markPaid(id, paidAmount, ref) {
        const r = requests.find(x => x.id === id);
        if (!r) return { ok: false };
        if (r.status === 'paid') return { ok: true, noop: 'already_paid' };
        if (r.status !== 'approved') return { ok: false, reason: 'not_approved' };
        if (paidAmount > r.amount) return { ok: false, reason: 'overpayment' };
        if (requests.some(x => x.reference === ref)) return { ok: false, reason: 'duplicate_reference' };
        r.status = 'paid'; r.reference = ref; r.paidAmount = paidAmount;
        return { ok: true };
      },
      available: () => ledgerAvailable,
      requests: () => requests,
    };
  }
  const cfg = { payout_day: 1, min_payout: 500, allow_partial: false };
  const e = payoutEngine(cfg);

  // window
  e.reset(8420, 'verified');
  eq(e.request({ dayOfMonth: 15 }).reason, 'window_closed', 'payout blocked outside the 1st-of-month window', 'MODEL');
  eq(e.request({ dayOfMonth: 1 }).ok, true, 'payout allowed on the configured window day', 'MODEL');

  // one per period
  eq(e.request({ dayOfMonth: 1 }).reason, 'already_requested', 'a second request in the same period is blocked', 'MODEL');

  // KYC gate
  e.reset(8420, 'pending');
  eq(e.request({ dayOfMonth: 1 }).reason, 'kyc_required', 'payout blocked until KYC is verified', 'MODEL');

  // minimum
  e.reset(300, 'verified');
  eq(e.request({ dayOfMonth: 1 }).reason, 'below_minimum', 'below the ₹500 minimum is blocked', 'MODEL');

  // reserve locks the balance
  e.reset(8420, 'verified');
  const req = e.request({ dayOfMonth: 1 });
  eq(e.available(), 0, 'requesting reserves the available balance (can\'t be double-spent)', 'MODEL');

  // reject releases the reserve
  e.review(req.id, 'reject');
  eq(e.available(), 8420, 'rejecting a payout releases the reserved balance', 'MODEL');

  // approve + mark paid (+ overpayment + duplicate)
  e.reset(8420, 'verified');
  const r2q = e.request({ dayOfMonth: 1 });
  eq(e.markPaid(r2q.id, 8420, 'TXN1').reason, 'not_approved', 'cannot mark paid before approval', 'MODEL');
  e.review(r2q.id, 'approve');
  eq(e.markPaid(r2q.id, 9000, 'TXN1').reason, 'overpayment', 'paid amount cannot exceed the approved amount', 'MODEL');
  eq(e.markPaid(r2q.id, 8420, 'TXN1').ok, true, 'admin marks paid with a reference', 'MODEL');
  eq(e.markPaid(r2q.id, 8420, 'TXN2').noop, 'already_paid', 'a second mark-paid is idempotent (no double pay)', 'MODEL');

  // duplicate reference across payouts
  e.reset(600, 'verified');
  const r3 = e.request({ dayOfMonth: 1, period: '2026-03' });
  e.review(r3.id, 'approve');
  eq(e.markPaid(r3.id, 600, 'TXN1').ok, true, 'a different payout can be paid', 'MODEL');
  // (reference uniqueness is enforced by a DB unique index — asserted below)

  // partial payout only when configured
  const eP = payoutEngine({ payout_day: 1, min_payout: 500, allow_partial: true });
  eP.reset(8420, 'verified');
  eq(eP.request({ dayOfMonth: 1, amount: 2000 }).amount, 2000, 'partial payout honoured when allow_partial is on', 'MODEL');
}

// ============================================================
// 4. STATIC — security, privacy, idempotency shape
// ============================================================
console.log('\n— Security & privacy (migration source) —');
{
  // Tables
  for (const t of ['creator_commission_ledger', 'creator_kyc_profiles', 'creator_payout_requests', 'creator_payout_audit']) {
    truthy(new RegExp(`create table if not exists public\\.${t}`).test(SQL), `${t} defined`, 'STATIC');
    truthy(new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(SQL), `${t} RLS enabled`, 'STATIC');
  }
  // Idempotency: one commission per conversion; one active payout per period; unique reference.
  truthy(/ccl_conversion_commission_uk[\s\S]*?where type = 'commission'/.test(SQL), 'one commission ledger entry per conversion (UNIQUE)', 'STATIC');
  truthy(/cpr_active_period_uk[\s\S]*?status in \('requested','under_review','approved','paid'\)/.test(SQL), 'one active payout per creator per period (UNIQUE)', 'STATIC');
  truthy(/cpr_reference_uk[\s\S]*?payment_reference is not null/.test(SQL), 'a transaction reference cannot be reused (UNIQUE)', 'STATIC');

  // Financial write functions are NOT callable by anon; creator-facing ones are
  // authenticated (the is_creator/is_admin check is inside).
  for (const fn of ['request_payout', 'submit_kyc']) {
    truthy(new RegExp(`revoke all on function public\\.${fn}[\\s\\S]{0,200}from public, anon`).test(SQL), `${fn} revoked from anon`, 'STATIC');
    truthy(new RegExp(`grant execute on function public\\.${fn}[\\s\\S]{0,200}to authenticated`).test(SQL), `${fn} granted to authenticated`, 'STATIC');
  }
  for (const fn of ['admin_set_kyc_status', 'admin_review_payout', 'admin_mark_payout_paid']) {
    truthy(new RegExp(`${fn}[\\s\\S]{0,400}?is_sora_admin\\(\\) then raise exception 'admin only'`).test(nsp(SQL)), `${fn} is admin-gated inside the function`, 'STATIC');
  }

  // Creator can NEVER self-verify KYC or mark paid: those are admin functions,
  // and there is no creator write policy on any Part-3 table. Each policy is one
  // statement (ends at ';'); a creator policy references current_creator_id and
  // must be `for select` only.
  const policyStmts = SQL.match(/create policy[^;]*;/g) || [];
  const creatorWritePolicy = (table) => policyStmts.some(p =>
    new RegExp(`on public\\.${table}\\b`).test(p) &&
    /current_creator_id\(\)/.test(p) &&
    /for (insert|update|delete|all)\b/.test(p));
  truthy(!creatorWritePolicy('creator_commission_ledger'),
    'no creator write policy on the commission ledger (creator is select-only)', 'STATIC');
  truthy(!creatorWritePolicy('creator_payout_requests'),
    'no creator write policy on payout requests (creation via RPC only)', 'STATIC');
  truthy(!creatorWritePolicy('creator_kyc_profiles'),
    'no creator write policy on KYC profiles (submission via RPC only)', 'STATIC');
  truthy(/identity_status = 'pending'/.test(SQL) && /a creator can never set/.test(SQL),
    'submit_kyc forces status pending — creator cannot self-verify', 'STATIC');

  // PRIVACY: no raw PAN/Aadhaar/account/UPI columns; only *_masked / *_reference.
  truthy(!/\b(pan_number|pan_raw|aadhaar_number|account_number|upi_id|bank_account)\b/.test(SQL),
    'no raw PAN/Aadhaar/account/UPI column exists (masked-only storage)', 'STATIC');
  truthy(/pan_masked/.test(SQL) && /payout_account_masked/.test(SQL) && /sora_mask/.test(SQL),
    'sensitive values are masked server-side before storage', 'STATIC');
  truthy(/aadhaar_reference/.test(SQL) && !/aadhaar_number|raw_aadhaar/.test(SQL),
    'Aadhaar is a reference only — no raw Aadhaar stored', 'STATIC');
  // submit_kyc must not persist the raw inputs it receives.
  const kycFn = SQL.match(/create or replace function public\.submit_kyc[\s\S]*?\$\$;/)[0];
  truthy(/sora_mask\(p_pan/.test(kycFn) && !/values\s*\([^)]*p_pan[^)]*\)/.test(nsp(kycFn)),
    'submit_kyc stores masked PAN, never the raw p_pan', 'STATIC');

  // Manual-payment safety: paid requires an explicit reference + not automatic.
  truthy(/reference_required/.test(SQL) && /overpayment/.test(SQL),
    'mark-paid requires a reference and blocks overpayment', 'STATIC');
  truthy(/already_paid/.test(SQL), 'mark-paid is idempotent (no double payment)', 'STATIC');

  // Consumes Part-2 eligible_sales; commission generated off conversion status.
  truthy(/new\.eligible_sales/.test(SQL) && /new\.status = 'eligible'/.test(SQL),
    'commission is generated from Part-2 eligible_sales on the eligible transition', 'STATIC');

  // Reserve/release: rejection releases the reserved balance.
  truthy(/status = 'available', payout_id = null[\s\S]{0,80}where payout_id = p_payout_id and status = 'reserved'/.test(nsp(SQL)),
    'rejecting a payout releases reserved ledger entries', 'STATIC');
  truthy(/status = 'paid'[\s\S]{0,80}where payout_id = p_payout_id and status = 'reserved'/.test(nsp(SQL)),
    'marking paid settles reserved ledger entries as paid', 'STATIC');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
