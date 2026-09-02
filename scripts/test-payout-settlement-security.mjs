import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Resolved from this file, not the process CWD, so the suite behaves the same
// however it is launched.
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const SQL = read('../supabase/migrations/0023_creator_payout_settlement_safety.sql');
const ADMIN = read('../src/admin/pages/Payouts.jsx');
const CREATOR_API = read('../src/lib/creatorApi.js');
const compact = (value) => value.replace(/\s+/g, ' ');
let passed = 0;
let failed = 0;
let current = '(startup)';

// A financial suite must never exit non-zero without saying which assertion
// broke, and must never print "0 failed" when something did fail.
function reportFatal(kind, err) {
  console.error(`
  FATAL ${kind} during: ${current}`);
  console.error(`  ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
}
process.on('unhandledRejection', (e) => reportFatal('unhandledRejection', e));
process.on('uncaughtException', (e) => reportFatal('uncaughtException', e));

const test = async (name, fn) => {
  current = name;
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL ${name}
     ${e.message}`);
  }
};

class SettlementModel {
  constructor(available = 0) {
    this.available = available;
    this.request = null;
    this.referenceOwners = new Map();
    this.lock = Promise.resolve();
    this.settlementCount = 0;
  }

  async requestPayout(amount = null) {
    const previous = this.lock;
    let release;
    this.lock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      if (this.request && ['requested', 'under_review', 'approved', 'paid'].includes(this.request.status)) {
        return { ok: false, reason: 'already_requested' };
      }
      if (amount != null && amount !== this.available) return { ok: false, reason: 'full_balance_required' };
      const exact = this.available;
      this.available = 0;
      this.request = { id: 'p1', amount: exact, reserved: exact, status: 'requested', paidAmount: null, reference: null };
      return { ok: true, amount: exact };
    } finally { release(); }
  }

  review(action) {
    const row = this.request;
    if (!row) return { ok: false, reason: 'not_found' };
    const target = { approve: 'approved', review: 'under_review', reject: 'rejected', cancel: 'cancelled' }[action];
    if (row.status === target) return { ok: true, noop: `already_${target}` };
    if (['paid', 'rejected', 'cancelled'].includes(row.status)) return { ok: false, reason: 'terminal' };
    if (target === 'approved' && ['requested', 'under_review'].includes(row.status)) row.status = target;
    else if (target === 'under_review' && row.status === 'requested') row.status = target;
    else if (['rejected', 'cancelled'].includes(target) && ['requested', 'under_review', 'approved'].includes(row.status)) {
      row.status = target;
      this.available += row.reserved;
      row.reserved = 0;
    } else return { ok: false, reason: 'bad_transition' };
    return { ok: true, status: row.status };
  }

  markPaid(amount, reference) {
    const row = this.request;
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.status === 'paid') {
      return row.paidAmount === amount && row.reference === reference
        ? { ok: true, noop: 'already_paid' }
        : { ok: false, reason: 'already_paid_mismatch' };
    }
    if (row.status !== 'approved') return { ok: false, reason: 'not_approved' };
    if (amount !== row.amount) return { ok: false, reason: 'exact_amount_required' };
    if (row.reserved !== amount) return { ok: false, reason: 'reservation_mismatch' };
    if (this.referenceOwners.has(reference)) return { ok: false, reason: 'duplicate_reference' };
    this.referenceOwners.set(reference, row.id);
    row.status = 'paid';
    row.paidAmount = amount;
    row.reference = reference;
    this.settlementCount += 1;
    return { ok: true };
  }
}

await test('partial requests cannot reserve the full ledger accidentally', async () => {
  const model = new SettlementModel(8420);
  assert.deepEqual(await model.requestPayout(2000), { ok: false, reason: 'full_balance_required' });
  assert.equal(model.available, 8420);
  assert.equal(model.request, null);
});

await test('concurrent payout requests serialize and cannot overspend', async () => {
  const model = new SettlementModel(8420);
  const results = await Promise.all([model.requestPayout(), model.requestPayout()]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.reason === 'already_requested').length, 1);
  assert.equal(model.available, 0);
  assert.equal(model.request.reserved, 8420);
});

await test('rejected and cancelled requests release, never consume, earnings', async () => {
  for (const action of ['reject', 'cancel']) {
    const model = new SettlementModel(8420);
    await model.requestPayout();
    assert.equal(model.review(action).ok, true);
    assert.equal(model.available, 8420);
    assert.equal(model.request.reserved, 0);
    assert.match(model.review(action).noop, /^already_/);
    assert.equal(model.review('approve').reason, 'terminal');
  }
});

await test('underpayment and overpayment cannot settle a payout', async () => {
  const model = new SettlementModel(8420);
  await model.requestPayout();
  model.review('approve');
  assert.equal(model.markPaid(2000, 'TXN-UNDER').reason, 'exact_amount_required');
  assert.equal(model.markPaid(9000, 'TXN-OVER').reason, 'exact_amount_required');
  assert.equal(model.request.status, 'approved');
  assert.equal(model.request.reserved, 8420);
  assert.equal(model.settlementCount, 0);
});

await test('exact settlement is idempotent only for the same amount and reference', async () => {
  const model = new SettlementModel(8420);
  await model.requestPayout();
  model.review('approve');
  assert.equal(model.markPaid(8420, 'TXN-1').ok, true);
  assert.equal(model.markPaid(8420, 'TXN-1').noop, 'already_paid');
  assert.equal(model.markPaid(8420, 'TXN-2').reason, 'already_paid_mismatch');
  assert.equal(model.markPaid(8000, 'TXN-1').reason, 'already_paid_mismatch');
  assert.equal(model.settlementCount, 1);
});

await test('a reservation mismatch blocks settlement instead of consuming extra ledger', async () => {
  const model = new SettlementModel(8420);
  await model.requestPayout();
  model.review('approve');
  model.request.reserved = 9000;
  assert.equal(model.markPaid(8420, 'TXN-1').reason, 'reservation_mismatch');
  assert.equal(model.request.status, 'approved');
  assert.equal(model.settlementCount, 0);
});

await test('SQL enforces serialization, exact backing, and exact settlement', () => {
  const sql = compact(SQL);
  assert.match(sql, /creator_partners where id = v_cid for update/);
  assert.match(sql, /full_balance_required/);
  assert.match(sql, /v_reserved <> v_amount/);
  assert.match(sql, /v_paid <> round\(v\.requested_amount, 2\)/);
  assert.match(sql, /v_reserved <> v_paid or round\(v\.reserved_amount, 2\) <> v_paid/);
  assert.match(sql, /where payout_id = p_payout_id and status = 'reserved' for update/);
});

await test('SQL makes terminal release and retry behavior explicit', () => {
  const sql = compact(SQL);
  assert.match(sql, /p\.status in \('rejected', 'cancelled'\).*?l\.status = 'reserved'/);
  assert.match(sql, /if v_to in \('rejected', 'cancelled'\).*?status = 'available', payout_id = null/);
  assert.match(sql, /if v\.paid_amount = v_paid and v\.payment_reference = trim\(p_reference\)/);
  assert.match(sql, /if v\.status = v_to then.*?already_/);
  assert.match(sql, /already_paid_mismatch/);
  assert.match(sql, /when unique_violation then.*?duplicate_reference/);
});

await test('authenticated clients cannot bypass payout RPC invariants with table writes', () => {
  const sql = compact(SQL);
  for (const table of ['creator_commission_ledger', 'creator_payout_requests', 'creator_payout_audit']) {
    assert.match(sql, new RegExp(`revoke insert, update, delete, truncate on table public\\.${table} from anon, authenticated`));
    assert.match(sql, new RegExp(`grant select on table public\\.${table} to authenticated`));
  }
  assert.match(sql, /admin_mark_payout_paid[\s\S]*?is_sora_admin\(\)/);
});

await test('Admin UI records the exact approved amount and exposes no partial settlement prompt', () => {
  assert.match(ADMIN, /const amt = Number\(row\.requested_amount\)/);
  assert.doesNotMatch(ADMIN, /Amount actually paid\?/);
  assert.match(ADMIN, /exact_amount_required/);
  assert.match(ADMIN, /reservation_mismatch/);
});

await test('a zero or refund-negative balance is refused cleanly, not by a constraint error', () => {
  const sql = compact(SQL);
  // min_payout is admin-editable via site_settings and may legitimately be 0.
  // Without an independent guard, v_avail = 0 fell through to an insert of
  // requested_amount = 0, which violates the cpr check and aborted the RPC
  // with a raw Postgres error instead of a handled reason.
  assert.match(sql, /if v_avail <= 0 then/);
  assert.match(sql, /'reason', 'no_balance'/);
  const guardAt = sql.indexOf('if v_avail <= 0 then');
  const minAt = sql.indexOf("'reason', 'below_minimum'");
  assert.ok(guardAt > -1 && minAt > -1 && guardAt < minAt, 'the zero guard must precede the minimum check');
  assert.ok(guardAt < sql.indexOf('insert into public.creator_payout_requests'), 'and must precede the insert');
});

await test('every payout RPC is admin- or creator-scoped, never open', () => {
  const sql = compact(SQL);
  for (const fn of ['admin_review_payout', 'admin_mark_payout_paid']) {
    const body = sql.slice(sql.indexOf(`create or replace function public.${fn}`));
    assert.match(body.slice(0, 500), /if not public\.is_sora_admin\(\) then raise exception 'admin only'/,
      `${fn} must reject non-admins`);
  }
  // The creator RPC derives identity from the session, never from a parameter.
  const req = sql.slice(sql.indexOf('create or replace function public.request_payout'));
  assert.match(req.slice(0, 500), /v_cid := public\.current_creator_id\(\)/);
  assert.match(req.slice(0, 600), /if v_cid is null then return .*not_a_creator/);
  assert.doesNotMatch(req.slice(0, 5000), /p_creator_id/, 'a creator id must never be an argument');
});

await test('creator A cannot reach creator B financial rows', () => {
  const sql = compact(SQL);
  // Every creator-path statement is bound to the session-derived creator id.
  assert.match(sql, /where creator_id = v_cid and payout_id is null and status = 'available'/);
  assert.match(sql, /from public\.creator_payout_requests where creator_id = v_cid/);
  for (const table of ['creator_commission_ledger', 'creator_payout_requests', 'creator_payout_audit']) {
    assert.match(sql, new RegExp(`revoke insert, update, delete, truncate on table public\\.${table} from anon, authenticated`));
  }
});

await test('the server always re-derives the settlement amount', () => {
  assert.match(CREATOR_API, /supabase\.rpc\('request_payout'/);
  assert.match(compact(SQL), /v_amount := v_avail;/);
});

await test('customer Razorpay payments and orders are untouched by this migration', () => {
  const sql = compact(SQL);
  for (const forbidden of [/\borders\b/, /payment_transactions/, /razorpay/i, /idempotency_key/]) {
    assert.doesNotMatch(sql, forbidden, `0023 must not reference ${String(forbidden)}`);
  }
  // Everything this migration names must be a creator-finance object or one
  // of the identity helpers — never anything on the customer payment path.
  const ALLOWED = /^(creator_[a-z_]+|request_payout|admin_review_payout|admin_mark_payout_paid|is_sora_admin|current_creator_id|site_settings)$/;
  const objects = [...sql.matchAll(/public\.([a-z_]+)/g)].map((m) => m[1]);
  for (const o of new Set(objects)) {
    assert.match(o, ALLOWED, `unexpected object touched: ${o}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
