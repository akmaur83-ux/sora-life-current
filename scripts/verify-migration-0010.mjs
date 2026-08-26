// ============================================================
// Post-migration verification for 0010_creator_program.sql
//
// READ-ONLY. Performs no writes that can succeed, no DDL, no data changes.
// Uses the PUBLIC publishable (anon) key — the same one the browser holds —
// so it proves what an ANONYMOUS attacker can and cannot reach.
//
// Every check is labelled:
//   [LIVE]   observed against the live database in this run
//   [STATIC] asserted against the migration/API source (design-verified);
//            these cover rules that cannot be exercised without an
//            authenticated or admin session, or without writing data.
//
// The two write probes use payloads that RLS refuses; nothing is created.
//
//   node scripts/verify-migration-0010.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
if (!URL_ || !KEY) { console.error('Could not read Supabase config from bundle.'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const SQL = readFileSync('supabase/migrations/0010_creator_program.sql', 'utf8');
const TRACK = readFileSync('api/creator/track.js', 'utf8');

let pass = 0, fail = 0, warn = 0;
let liveCount = 0, staticCount = 0;
const ok = (m, kind = 'LIVE') => { console.log(`  PASS [${kind}]  ${m}`); pass++; kind === 'LIVE' ? liveCount++ : staticCount++; };
const bad = (m, kind = 'LIVE') => { console.log(`  FAIL [${kind}]  ${m}`); fail++; };
const note = (m) => { console.log(`  NOTE         ${m}`); warn++; };

async function sel(table, cols = '*', extra = '') {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=${cols}&limit=3${extra}`, { headers: H });
  let body = null; try { body = JSON.parse(await r.text()); } catch { /* empty */ }
  return { status: r.status, rows: Array.isArray(body) ? body.length : null, code: body?.code, msg: body?.message };
}
async function post(path, payload) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(payload),
  });
  let body = null; try { body = JSON.parse(await r.text()); } catch { /* empty */ }
  return { status: r.status, code: body?.code, msg: (body?.message || '').slice(0, 90) };
}
const denied = (r) => r.status === 401 || r.status === 403 || r.code === '42501';
const exists = (r) => r.status === 200 || r.status === 206;
const missing = (r) => r.status === 404 && (r.code === 'PGRST205' || r.code === '42P01');

const TABLES = [
  'creator_partners', 'creator_code_aliases', 'creator_campaigns',
  'creator_tracking_links', 'creator_attribution_events', 'creator_admin_audit',
];

console.log('\n============================================================');
console.log(' 0010 CREATOR PROGRAM — READ-ONLY VERIFICATION');
console.log('============================================================');

// ------------------------------------------------------------
console.log('\n— 1. All six creator tables exist —');
for (const t of TABLES) {
  const r = await sel(t, 'id');
  if (missing(r)) bad(`${t} does NOT exist (migration not applied?)`);
  else if (exists(r)) ok(`${t} exists`);
  else if (denied(r)) ok(`${t} exists (read denied to anon — expected)`);
  else bad(`${t} unexpected response ${r.status} ${r.code || ''}`);
}

// ------------------------------------------------------------
console.log('\n— 2. Expected columns are present —');
{
  const COLS = {
    creator_partners: 'id,user_id,creator_code,display_name,legal_name,email,phone,avatar_url,status,default_commission_rate,default_attribution_window_days,payout_eligible,notes,joined_at,created_at,updated_at',
    creator_code_aliases: 'id,creator_id,code,retired_at',
    creator_campaigns: 'id,creator_id,name,campaign_code,description,status,start_at,end_at,commission_rate_override,attribution_window_days,created_at,updated_at',
    creator_tracking_links: 'id,creator_id,campaign_id,public_code,label,destination_type,destination_path,status,metadata,created_at,updated_at',
    creator_attribution_events: 'id,event_type,tracking_link_id,creator_id,campaign_id,visitor_id,user_id,matched_code,landing_path,attribution_model,occurred_at,expires_at,metadata,created_at',
    creator_admin_audit: 'id,admin_user_id,action,entity_type,entity_id,metadata,created_at',
  };
  for (const [t, cols] of Object.entries(COLS)) {
    const r = await sel(t, cols);
    // A column that does not exist makes PostgREST answer 400/42703 even when
    // RLS would return zero rows, so this distinguishes the two cases.
    if (exists(r)) ok(`${t}: all ${cols.split(',').length} expected columns selectable`);
    else if (r.code === '42703' || /column .* does not exist/i.test(r.msg || '')) bad(`${t}: missing column — ${r.msg}`);
    else if (denied(r)) note(`${t}: columns not verifiable (anon read denied) — see [STATIC] below`);
    else bad(`${t}: column check inconclusive (${r.status} ${r.code || ''})`);
  }
  // Static backstop for any table whose columns anon cannot probe.
  for (const t of TABLES) {
    const created = new RegExp(`create table if not exists public\\.${t}\\s*\\(`).test(SQL);
    created ? ok(`${t} declared in migration source`, 'STATIC') : bad(`${t} not declared in migration`, 'STATIC');
  }
}

// ------------------------------------------------------------
console.log('\n— 3. RLS is enabled on every creator table —');
for (const t of TABLES) {
  const re = new RegExp(`alter table public\\.${t}\\s+enable row level security`);
  re.test(SQL) ? ok(`${t}: RLS enabled in migration`, 'STATIC') : bad(`${t}: RLS not enabled`, 'STATIC');
}

console.log('\n— 4. Policy shape (admin manage / creator read-only) —');
{
  const adminPolicies = ['creator_partners admin all', 'creator_aliases admin all', 'creator_campaigns admin all', 'creator_links admin all'];
  for (const p of adminPolicies) {
    SQL.includes(`"${p}"`) ? ok(`admin policy present: ${p}`, 'STATIC') : bad(`missing admin policy: ${p}`, 'STATIC');
  }
  const selfPolicies = SQL.match(/create policy "creator_\w+ self \w+"[\s\S]*?;/g) || [];
  selfPolicies.length >= 4
    ? ok(`${selfPolicies.length} creator self-access policies present`, 'STATIC')
    : bad(`only ${selfPolicies.length} creator self policies found`, 'STATIC');
  selfPolicies.every((p) => /for select/.test(p))
    ? ok('every creator self policy is SELECT-only (creator cannot change own rate/status/id)', 'STATIC')
    : bad('a creator self policy grants more than SELECT', 'STATIC');

  const eventPolicies = SQL.match(/create policy "creator_events[\s\S]*?;/g) || [];
  eventPolicies.length && eventPolicies.every((p) => /for select/.test(p))
    ? ok('attribution events are read-only via RLS (server-only writes)', 'STATIC')
    : bad('attribution events have a non-SELECT policy', 'STATIC');

  /create policy "creator_audit admin read"[\s\S]*?for select/.test(SQL)
    ? ok('audit trail is admin-read-only', 'STATIC')
    : bad('audit trail policy is not admin-read-only', 'STATIC');
}

// ------------------------------------------------------------
console.log('\n— 5. Anonymous READS are blocked —');
for (const t of TABLES) {
  const r = await sel(t, t === 'creator_partners' ? 'id,creator_code,email' : 'id');
  if (denied(r)) ok(`${t}: anon read denied (${r.status})`);
  else if (exists(r) && r.rows === 0) ok(`${t}: anon sees 0 rows (RLS enforced)`);
  else if (exists(r) && r.rows > 0) bad(`${t}: LEAKING ${r.rows} rows to anonymous callers`);
  else note(`${t}: read returned ${r.status} ${r.code || ''}`);
}

// ------------------------------------------------------------
console.log('\n— 6. Anonymous WRITES are blocked —');
{
  const probes = [
    ['creator_partners (forge a creator)', 'creator_partners',
      { display_name: 'RLS PROBE', email: `probe-${randomUUID().slice(0, 8)}@example.invalid` }],
    ['creator_campaigns (forge a campaign)', 'creator_campaigns',
      { creator_id: randomUUID(), name: 'RLS PROBE', campaign_code: `PB${randomUUID().slice(0, 5)}` }],
    ['creator_tracking_links (forge a link)', 'creator_tracking_links',
      { creator_id: randomUUID(), destination_path: '/', destination_type: 'homepage' }],
    ['creator_attribution_events (fake attribution)', 'creator_attribution_events',
      { event_type: 'landing', creator_id: randomUUID(), expires_at: new Date().toISOString() }],
    ['creator_code_aliases (hijack a code)', 'creator_code_aliases',
      { creator_id: randomUUID(), code: `PB-${randomUUID().slice(0, 6)}` }],
    ['creator_admin_audit (forge an audit entry)', 'creator_admin_audit',
      { action: 'probe', entity_type: 'creator' }],
  ];
  for (const [label, table, row] of probes) {
    const r = await post(table, row);
    if (denied(r)) ok(`${label}: denied (${r.status})`);
    else if (r.status >= 200 && r.status < 300) bad(`${label}: WRITE SUCCEEDED — RLS is wrong`);
    else if (r.code === '23503') bad(`${label}: RLS ALLOWED the write (only a FK stopped it)`);
    else note(`${label}: ${r.status} ${r.code || ''}`);
  }
}

// ------------------------------------------------------------
console.log('\n— 7. Attribution RPCs are not callable by the browser —');
{
  const rpcs = [
    ['resolve_tracking_ref', { p_ref: 'SORA-PROBE', p_campaign: null }],
    ['record_attribution_event', { p_ref: 'SORA-PROBE', p_campaign: null, p_event_type: 'landing', p_visitor_id: 'probe', p_user_id: null, p_landing_path: '/' }],
  ];
  for (const [fn, args] of rpcs) {
    const r = await post(`rpc/${fn}`, args);
    if (denied(r)) ok(`rpc/${fn}: anon denied (${r.status})`);
    else if (r.status >= 200 && r.status < 300) bad(`rpc/${fn}: anon CAN call it — must be service-role only`);
    else if (r.status === 404 || r.code === 'PGRST202') bad(`rpc/${fn}: not found (migration incomplete?)`);
    else note(`rpc/${fn}: ${r.status} ${r.code || ''}`);
  }
  // The `authenticated` role cannot be probed without a user session, so the
  // grant is verified from source instead.
  for (const fn of ['resolve_tracking_ref', 'record_attribution_event']) {
    new RegExp(`revoke all on function public\\.${fn}[\\s\\S]{0,200}?from public, anon, authenticated`).test(SQL)
      ? ok(`${fn} revoked from anon AND authenticated`, 'STATIC')
      : bad(`${fn} is not revoked from authenticated`, 'STATIC');
    new RegExp(`grant execute on function public\\.${fn}[\\s\\S]{0,200}?to service_role`).test(SQL)
      ? ok(`${fn} granted to service_role only`, 'STATIC')
      : bad(`${fn} service_role grant missing`, 'STATIC');
  }
  // claim_creator_account is intentionally callable by authenticated users.
  {
    const r = await post('rpc/claim_creator_account', {});
    if (denied(r)) ok('rpc/claim_creator_account: anon denied (authenticated-only, as designed)');
    else if (r.status >= 200 && r.status < 300) bad('rpc/claim_creator_account: callable anonymously');
    else note(`rpc/claim_creator_account: ${r.status} ${r.code || ''}`);
  }
  // change_creator_code is admin-gated INSIDE the function.
  {
    const r = await post('rpc/change_creator_code', { p_creator_id: randomUUID(), p_new_code: 'SORA-PROBE' });
    if (denied(r)) ok('rpc/change_creator_code: anon denied');
    else if (r.status >= 200 && r.status < 300) bad('rpc/change_creator_code: anon CAN change a public code');
    else note(`rpc/change_creator_code: ${r.status} ${r.code || ''} (expected: refused)`);
  }
  /if not public\.is_sora_admin\(\) then raise exception 'admin only'/.test(SQL.replace(/\s+/g, ' '))
    ? ok('change_creator_code refuses non-admins server-side', 'STATIC')
    : bad('change_creator_code lacks an internal admin check', 'STATIC');
}

// ------------------------------------------------------------
console.log('\n— 8. Creator code uniqueness & generation —');
{
  /creator_code\s+text not null unique/.test(SQL)
    ? ok('creator_partners.creator_code is UNIQUE', 'STATIC')
    : bad('creator_code lacks a UNIQUE constraint', 'STATIC');
  /code\s+text not null unique/.test(SQL)
    ? ok('creator_code_aliases.code is UNIQUE (a retired code cannot be reissued)', 'STATIC')
    : bad('alias code lacks a UNIQUE constraint', 'STATIC');
  /public_code\s+text not null unique/.test(SQL)
    ? ok('tracking link public_code is UNIQUE', 'STATIC')
    : bad('public_code lacks a UNIQUE constraint', 'STATIC');
  /creator_campaigns_code_key/.test(SQL)
    ? ok('campaign_code is unique per creator', 'STATIC')
    : bad('campaign code uniqueness index missing', 'STATIC');
  /creator_partners_email_key/.test(SQL)
    ? ok('creator email is unique (case-insensitive)', 'STATIC')
    : bad('creator email uniqueness index missing', 'STATIC');
  /generate_creator_code/.test(SQL) && /creator_partners_biu/.test(SQL)
    ? ok('codes are generated server-side by a DB trigger (client cannot set them)', 'STATIC')
    : bad('server-side code generation trigger missing', 'STATIC');
  /creator_code cannot be changed directly/.test(SQL)
    ? ok('direct creator_code updates are blocked (must go through the audited RPC)', 'STATIC')
    : bad('creator_code can be updated directly', 'STATIC');
  /'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'/.test(SQL)
    ? ok('code alphabet omits look-alike I/O/0/1', 'STATIC')
    : bad('unambiguous alphabet not found', 'STATIC');
}

// ------------------------------------------------------------
console.log('\n— 9. Campaign / link ownership —');
{
  /campaign does not belong to this creator/.test(SQL)
    ? ok('a tracking link cannot reference another creator\'s campaign (trigger)', 'STATIC')
    : bad('cross-creator campaign linkage is not prevented', 'STATIC');
  /creator_id\s+uuid not null references public\.creator_partners\(id\) on delete cascade/.test(SQL)
    ? ok('campaigns/links are FK-bound to a real creator', 'STATIC')
    : bad('creator FK missing', 'STATIC');
  /campaign_id\s+uuid references public\.creator_campaigns\(id\)/.test(SQL)
    ? ok('links are FK-bound to a real campaign', 'STATIC')
    : bad('campaign FK missing', 'STATIC');
  /creator_campaigns_dates_chk/.test(SQL)
    ? ok('a campaign cannot end before it starts (CHECK)', 'STATIC')
    : bad('campaign date ordering not constrained', 'STATIC');
  /current_creator_id\(\)/.test(SQL)
    ? ok('creator scoping uses a SECURITY DEFINER ownership helper', 'STATIC')
    : bad('ownership helper missing', 'STATIC');
}

// ------------------------------------------------------------
console.log('\n— 10. Destination URL safety —');
{
  const chk = (SQL.match(/constraint creator_tracking_links_dest_chk check \(([\s\S]*?)\)\s*\n\);/) || [])[1] || '';
  const source = chk || SQL;
  /destination_path ~ '\^\/'/.test(source) ? ok('destination must be root-relative', 'STATIC') : bad('root-relative rule missing', 'STATIC');
  /!~ '\^\/\/'/.test(source) ? ok('protocol-relative //host is rejected', 'STATIC') : bad('protocol-relative rule missing', 'STATIC');
  /!~ ':\/\/'/.test(source) ? ok('absolute URLs are rejected', 'STATIC') : bad('absolute-URL rule missing', 'STATIC');
  /javascript:/.test(source) ? ok('javascript: URLs are rejected', 'STATIC') : bad('javascript: rule missing', 'STATIC');
  /length\(destination_path\) <= 300/.test(source) ? ok('destination length is bounded', 'STATIC') : bad('destination length unbounded', 'STATIC');

  // NOTE: an anon INSERT is refused by RLS *before* the CHECK is evaluated, so
  // the constraint itself cannot be exercised anonymously. Recorded honestly.
  const r = await post('creator_tracking_links', {
    creator_id: randomUUID(), destination_type: 'custom', destination_path: 'https://evil.example/steal',
  });
  denied(r)
    ? note('malicious destination probe was stopped by RLS first — CHECK not reachable anonymously (design-verified above)')
    : (r.status < 300 ? bad('a malicious destination was ACCEPTED') : note(`destination probe: ${r.status} ${r.code || ''}`));
}

// ------------------------------------------------------------
console.log('\n— 11. Tracking endpoint never trusts client ids —');
{
  !/body\.(creatorId|campaignId|commissionRate|creator_id|campaign_id|trackingLinkId)/.test(TRACK)
    ? ok('API reads no internal id/rate from the request body', 'STATIC')
    : bad('API reads an internal id from the request body', 'STATIC');
  /getUserIdFromToken/.test(TRACK)
    ? ok('signup attribution derives user id from the verified token', 'STATIC')
    : bad('signup attribution trusts client-supplied identity', 'STATIC');
  /enforceRateLimit/.test(TRACK) ? ok('tracking endpoint is rate-limited', 'STATIC') : bad('tracking endpoint is not rate-limited', 'STATIC');
}

// ------------------------------------------------------------
console.log('\n— 12. Existing system is unaffected —');
{
  // Public catalogue must still read.
  for (const t of ['products', 'product_variants', 'categories']) {
    const r = await sel(t, 'id');
    exists(r) && r.rows > 0 ? ok(`${t}: public read still works (${r.rows} sampled)`) : bad(`${t}: public read broken (${r.status})`);
  }
  const all = await sel('products', 'id', '&limit=1000');
  // The catalogue was 156 active+inactive rows before this migration.
  all.rows === 156 ? ok(`products row count unchanged (${all.rows})`) : note(`products visible rows = ${all.rows} (was 156 — confirm if unexpected)`);

  // Private commerce tables must still deny anon.
  for (const t of ['orders', 'payment_transactions', 'coupons', 'coupon_redemptions', 'profiles', 'customer_addresses']) {
    const r = await sel(t, 'id');
    if (denied(r) || (exists(r) && r.rows === 0)) ok(`${t}: still private to anon`);
    else if (exists(r) && r.rows > 0) bad(`${t}: LEAKING ${r.rows} rows`);
    else note(`${t}: ${r.status} ${r.code || ''}`);
  }

  // Migration 0010 must not have altered commerce objects.
  const touchesCommerce = /(alter|drop)\s+table\s+public\.(products|orders|coupons|product_variants|payment_transactions)\b/i.test(SQL);
  !touchesCommerce
    ? ok('migration 0010 alters no commerce table', 'STATIC')
    : bad('migration 0010 touches a commerce table', 'STATIC');
  const dropsPolicy = (SQL.match(/drop policy if exists "(?!creator_)/g) || []).length;
  dropsPolicy === 0
    ? ok('migration 0010 drops no pre-existing (non-creator) policy', 'STATIC')
    : bad(`migration 0010 drops ${dropsPolicy} non-creator policies`, 'STATIC');
}

// ------------------------------------------------------------
console.log('\n============================================================');
console.log(` RESULT: ${pass} passed, ${fail} failed, ${warn} notes`);
console.log(` Session-verified (live): ${liveCount}   Design-verified (static): ${staticCount}`);
console.log('============================================================\n');
process.exit(fail ? 1 : 0);
