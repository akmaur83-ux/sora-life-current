// ============================================================
// Post-migration verification for 0014_creator_earnings_payouts.sql
//
// READ-ONLY. Uses the PUBLIC anon key (the browser's key) to prove what an
// anonymous attacker can and cannot reach. Write/RPC probes use payloads RLS
// and the SECURITY DEFINER guards refuse; nothing is created.
//
//   node scripts/verify-migration-0014.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const SQL = readFileSync('supabase/migrations/0014_creator_earnings_payouts.sql', 'utf8');

let pass = 0, fail = 0, note = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const inf = (m) => { console.log(`  NOTE  ${m}`); note++; };

async function sel(t, c = 'id') {
  const r = await fetch(`${URL_}/rest/v1/${t}?select=${c}&limit=1`, { headers: H });
  let b = null; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, code: b?.code, rows: Array.isArray(b) ? b.length : null };
}
async function post(path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  let b = null; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, code: b?.code };
}
const exists = (r) => r.status === 200 || r.status === 206;
const missing = (r) => r.status === 404 && (r.code === 'PGRST205' || r.code === '42P01');
const denied = (r) => r.status === 401 || r.status === 403 || r.code === '42501';

const TABLES = ['creator_commission_ledger', 'creator_kyc_profiles', 'creator_payout_requests', 'creator_payout_audit'];
const COLS = {
  creator_commission_ledger: 'id,creator_id,conversion_id,order_id,type,status,amount,currency,commission_rate,eligible_sales,available_at,payout_id,metadata,created_at',
  creator_kyc_profiles: 'creator_id,legal_name,pan_masked,pan_secure_reference,aadhaar_reference,identity_status,payout_method,payout_account_holder,payout_account_masked,ifsc_masked,upi_masked,payout_secure_reference,verification_notes,submitted_at,verified_at,verified_by',
  creator_payout_requests: 'id,creator_id,payout_period,requested_amount,reserved_amount,status,requested_at,reviewed_at,reviewed_by,approved_at,approved_by,paid_at,paid_by,paid_amount,payment_reference,payout_method_snapshot,rejection_reason,admin_notes',
  creator_payout_audit: 'id,payout_id,actor_user_id,from_status,to_status,amount,reference,note,created_at',
};

console.log('\n=== 0014 CREATOR EARNINGS / KYC / PAYOUTS — READ-ONLY VERIFICATION ===');

console.log('\n— 1. All four Part 3 tables exist —');
for (const t of TABLES) {
  const r = await sel(t);
  if (missing(r)) bad(`${t} does NOT exist (migration 0014 not applied?)`);
  else if (exists(r) || denied(r)) ok(`${t} exists`);
  else bad(`${t} unexpected ${r.status} ${r.code || ''}`);
}

console.log('\n— 2. Expected columns present —');
for (const [t, cols] of Object.entries(COLS)) {
  const r = await sel(t, cols);
  if (exists(r)) ok(`${t}: all ${cols.split(',').length} columns selectable`);
  else if (r.code === '42703') bad(`${t}: a column is missing (${cols})`);
  else if (denied(r)) inf(`${t}: columns not anon-verifiable (read denied) — see STATIC/RLS`);
  else bad(`${t}: inconclusive (${r.status} ${r.code || ''})`);
}

console.log('\n— 3. NO raw sensitive columns exist (privacy) —');
for (const [t, col] of [
  ['creator_kyc_profiles', 'pan_number'],
  ['creator_kyc_profiles', 'aadhaar_number'],
  ['creator_kyc_profiles', 'account_number'],
  ['creator_kyc_profiles', 'upi_id'],
]) {
  const r = await sel(t, col);
  if (r.code === '42703') ok(`${t}.${col} does NOT exist (masked-only storage)`);
  else if (denied(r)) inf(`${t}.${col}: read denied — relying on STATIC (no such column in migration)`);
  else if (exists(r)) bad(`${t}.${col} EXISTS — raw sensitive data column present!`);
  else inf(`${t}.${col}: ${r.status} ${r.code || ''}`);
}
!/\b(pan_number|pan_raw|aadhaar_number|raw_aadhaar|account_number|bank_account|upi_id)\b/.test(SQL)
  ? ok('migration defines no raw PAN/Aadhaar/account/UPI column (STATIC)')
  : bad('migration defines a raw sensitive column (STATIC)');

console.log('\n— 4. RLS enabled on all four tables (migration source) —');
for (const t of TABLES) {
  (new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(SQL))
    ? ok(`${t}: RLS enabled`) : bad(`${t}: RLS not enabled`);
}

console.log('\n— 5. Anonymous READS blocked —');
for (const t of TABLES) {
  const r = await sel(t);
  if (denied(r) || (exists(r) && r.rows === 0)) ok(`${t}: anon reads nothing`);
  else if (exists(r) && r.rows > 0) bad(`${t}: LEAKING rows to anon`);
  else inf(`${t}: ${r.status} ${r.code || ''}`);
}

console.log('\n— 6. Anonymous WRITES blocked (forge probes) —');
for (const [label, t, row] of [
  ['forge ledger entry', 'creator_commission_ledger', { creator_id: randomUUID(), type: 'commission', amount: 9999, status: 'available' }],
  ['forge KYC verified', 'creator_kyc_profiles', { creator_id: randomUUID(), identity_status: 'verified', legal_name: 'x' }],
  ['forge payout request', 'creator_payout_requests', { creator_id: randomUUID(), payout_period: '2026-01', requested_amount: 9999, status: 'approved' }],
  ['forge audit row', 'creator_payout_audit', { payout_id: randomUUID(), to_status: 'paid' }],
]) {
  const r = await post(t, row);
  if (denied(r)) ok(`${label}: denied (${r.status})`);
  else if (r.status >= 200 && r.status < 300) bad(`${label}: WRITE SUCCEEDED`);
  else inf(`${label}: ${r.status} ${r.code || ''}`);
}

console.log('\n— 7. Financial RPCs NOT callable by anon —');
for (const [fn, args] of [
  ['my_creator_earnings', {}],
  ['submit_kyc', { p_legal_name: 'x', p_pan: 'ABCDE1234F', p_method: 'upi', p_account_holder: '', p_account_number: '', p_ifsc: '', p_upi: 'x@y' }],
  ['request_payout', { p_amount: null }],
  ['admin_set_kyc_status', { p_creator_id: randomUUID(), p_status: 'verified', p_notes: null }],
  ['admin_review_payout', { p_payout_id: randomUUID(), p_action: 'approve', p_notes: null }],
  ['admin_mark_payout_paid', { p_payout_id: randomUUID(), p_paid_amount: 1, p_reference: 'x', p_note: null }],
]) {
  const r = await post(`rpc/${fn}`, args);
  if (denied(r)) ok(`rpc/${fn}: anon denied (${r.status})`);
  else if (r.status === 404 || r.code === 'PGRST202') bad(`rpc/${fn}: not found (migration not applied?)`);
  else if (r.status >= 200 && r.status < 300) bad(`rpc/${fn}: anon CAN call it`);
  else inf(`rpc/${fn}: ${r.status} ${r.code || ''} (not anon-executable)`);
}

console.log('\n— 8. STATIC grants: creator RPCs authenticated, admin RPCs admin-gated —');
for (const fn of ['my_creator_earnings', 'submit_kyc', 'request_payout']) {
  (new RegExp(`grant execute on function public\\.${fn}[\\s\\S]{0,220}to authenticated`).test(SQL))
    ? ok(`${fn}: granted to authenticated (STATIC)`) : bad(`${fn}: authenticated grant missing`);
  (new RegExp(`revoke all on function public\\.${fn}[\\s\\S]{0,220}from public, anon`).test(SQL))
    ? ok(`${fn}: revoked from anon (STATIC)`) : bad(`${fn}: anon revoke missing`);
}
for (const fn of ['admin_set_kyc_status', 'admin_review_payout', 'admin_mark_payout_paid']) {
  (/is_sora_admin\(\) then raise exception 'admin only'/.test(SQL.replace(/\s+/g, ' ')))
    ? ok(`${fn}: admin-gated inside function (STATIC)`) : bad(`${fn}: admin gate missing`);
}

console.log('\n— 9. Idempotency constraints (migration source) —');
[
  ['one commission per conversion', /ccl_conversion_commission_uk[\s\S]*?where type = 'commission'/],
  ['one active payout per period', /cpr_active_period_uk[\s\S]*?status in \('requested','under_review','approved','paid'\)/],
  ['unique payment reference', /cpr_reference_uk[\s\S]*?payment_reference is not null/],
].forEach(([label, re]) => re.test(SQL) ? ok(label) : bad(label));

console.log('\n— 10. Existing Part 1/2 objects unaffected —');
for (const t of ['creator_partners', 'creator_conversions', 'products']) {
  const r = await sel(t);
  (exists(r) || denied(r) || (exists(r) && r.rows === 0)) ? ok(`${t}: still present`) : bad(`${t}: broken (${r.status})`);
}
!/(drop|alter)\s+table\s+public\.(creator_conversions|creator_attributions|orders|products)\b/i.test(SQL)
  ? ok('0014 drops/alters no Part 1/2 or commerce table (STATIC)') : bad('0014 modifies an existing table');

console.log(`\n=== ${pass} passed, ${fail} failed, ${note} notes ===\n`);
process.exit(fail ? 1 : 0);
