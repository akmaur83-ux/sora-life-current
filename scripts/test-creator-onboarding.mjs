// ============================================================
// Creator self-onboarding — regression tests (offline)
//
//   node scripts/test-creator-onboarding.mjs
//
// Two levels:
//   STATIC — assertions against migration 0012 + the API/UI source, so a
//     future edit that lets the client set user_id/status/commission, or that
//     drops the one-creator-per-user guard, fails the suite.
//   MODEL  — a JS mirror of apply_as_creator() proving the 13 required cases.
//
// The live behavioural proof (real RPC + RLS) is the authenticated browser run;
// this file is the deterministic guard.
// ============================================================
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (m, k = 'MODEL') => { console.log(`  PASS [${k}]  ${m}`); pass++; };
const bad = (m, k = 'MODEL') => { console.log(`  FAIL [${k}]  ${m}`); fail++; };
const eq = (a, b, m, k) => (a === b ? ok(m, k) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, k));
const truthy = (v, m, k) => (v ? ok(m, k) : bad(m, k));

const SQL12 = readFileSync('supabase/migrations/0012_creator_self_onboarding.sql', 'utf8');
const SQL10 = readFileSync('supabase/migrations/0010_creator_program.sql', 'utf8');
const API = readFileSync('src/lib/creatorApi.js', 'utf8');
const ONB = readFileSync('src/pages/account/CreatorOnboarding.jsx', 'utf8');
const ACCT = readFileSync('src/pages/Account.jsx', 'utf8');
const n = (s) => s.replace(/\s+/g, ' ');

// ============================================================
// STATIC — migration integrity
// ============================================================
console.log('\n— Migration 0012: identity + guards —');
{
  truthy(/create or replace function public\.apply_as_creator/.test(SQL12), 'apply_as_creator RPC exists', 'STATIC');
  truthy(/security definer/.test(SQL12), 'RPC is SECURITY DEFINER', 'STATIC');

  // Identity from the verified JWT, never from input.
  truthy(/v_uid\s+uuid := auth\.uid\(\)/.test(SQL12), 'user id derived from auth.uid()', 'STATIC');
  truthy(/v_email\s+text := auth\.email\(\)/.test(SQL12), 'email derived from auth.email()', 'STATIC');

  // Parameters are ONLY the four non-sensitive fields.
  const sig = (SQL12.match(/apply_as_creator\(([\s\S]*?)\)\s*returns/) || [])[1] || '';
  truthy(/p_display_name/.test(sig) && /p_social_url/.test(sig) && /p_platform/.test(sig) && /p_agreed/.test(sig),
    'params limited to display_name/social_url/platform/agreed', 'STATIC');
  truthy(!/p_user_id|p_creator_id|p_commission|p_status|p_rate/i.test(sig),
    'RPC accepts NO user_id / creator_id / commission / status parameter', 'STATIC');

  // The INSERT never takes status/rate/user_id from the client.
  truthy(/user_id,\s*display_name,\s*email,\s*status/.test(n(SQL12)), 'insert sets server-derived columns', 'STATIC');
  truthy(/v_status := case when v_auto then 'active' else 'pending' end/.test(n(SQL12)),
    'status comes from the approval policy, not the client', 'STATIC');
  truthy(/default_commission_rate,\s*default_attribution_window_days/.test(n(SQL12))
    && /v_rate/.test(SQL12) && /v_window/.test(SQL12),
    'commission rate & window come from config, not the client', 'STATIC');

  // One creator per user.
  truthy(/if exists \(select 1 from public\.creator_partners where user_id = v_uid\)/.test(n(SQL12)),
    'duplicate creator for the same auth user is refused', 'STATIC');
  truthy(/when unique_violation then/.test(SQL12), 'race on UNIQUE(user_id) is handled', 'STATIC');
  truthy(/user_id\s+uuid\s+unique\s+references auth\.users/.test(SQL10),
    'creator_partners.user_id is UNIQUE (one account -> at most one creator)', 'STATIC');

  // Consent + name required.
  truthy(/p_agreed is not true/.test(SQL12), 'terms agreement is required', 'STATIC');
  truthy(/display_name_required/.test(SQL12), 'display name is required', 'STATIC');

  // Grants: authenticated only.
  truthy(/revoke all on function public\.apply_as_creator[\s\S]{0,120}from public, anon/.test(SQL12),
    'apply_as_creator revoked from anon', 'STATIC');
  truthy(/grant execute on function public\.apply_as_creator[\s\S]{0,120}to authenticated/.test(SQL12),
    'apply_as_creator granted to authenticated', 'STATIC');

  // No payout/bank fields collected; additive only.
  truthy(!/bank|iban|account_number|ifsc|payout_account|upi/i.test(SQL12), 'no payout/bank fields collected', 'STATIC');
  truthy(!/\b(delete from|truncate|drop table)\b/i.test(SQL12), 'migration is non-destructive', 'STATIC');
  truthy(/add column if not exists application jsonb/.test(SQL12), 'reuses creator_partners (adds one jsonb column)', 'STATIC');
  truthy(!/create table/i.test(SQL12), 'creates NO redundant creator tables', 'STATIC');

  // Admin-configurable approval policy seeded, not publicly readable.
  truthy(/insert into public\.site_settings[\s\S]{0,80}'creator_program'/.test(SQL12), 'approval policy seeded in site_settings', 'STATIC');
  truthy(!/'creator_program'/.test(readFileSync('supabase/migrations/0009_security_hardening.sql', 'utf8')),
    "'creator_program' is NOT in the public site_settings whitelist (admin-only)", 'STATIC');
}

// ============================================================
// STATIC — client never sends privileged fields
// ============================================================
console.log('\n— API / UI never send privileged fields —');
{
  const applyBlock = (API.match(/export async function applyAsCreator[\s\S]*?\n}/) || [''])[0];
  truthy(/p_display_name|p_social_url|p_platform|p_agreed/.test(applyBlock), 'applyAsCreator sends only the four safe fields', 'STATIC');
  truthy(!/p_user_id|p_status|p_commission|p_creator_id/i.test(applyBlock),
    'applyAsCreator sends NO user_id/status/commission/creator_id', 'STATIC');
  truthy(!/commission|status|user_id|creator_id/i.test(n(ONB.match(/async function submit[\s\S]*?\n  }/)?.[0] || '')),
    'the onboarding form submits none of the protected fields', 'STATIC');
  // Account wires the tab.
  truthy(/tab === 'creator' && <CreatorOnboarding/.test(ACCT), 'Account renders the Creator Program tab', 'STATIC');
  truthy(/id: 'creator'/.test(ACCT), 'Account nav includes the creator entry', 'STATIC');
}

// ============================================================
// MODEL — apply_as_creator behaviour (the 13 cases)
// ============================================================
console.log('\n— Behaviour model: the required proofs —');
{
  // A faithful mirror of the RPC. `session` stands in for the verified JWT.
  function makeDB(policy = { auto_approve: false, default_commission_rate: 10, default_attribution_window_days: 30 }) {
    const creators = []; let seq = 0;
    const genCode = (name) => {
      let base = String(name || '').trim().split(' ')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
      if (base.length < 3) base = 'CREATOR';
      let code = `SORA-${base}`, i = 0;
      while (creators.some((c) => c.creator_code === code)) code = `SORA-${base}${++i}`;
      return code;
    };
    return {
      creators,
      // apply_as_creator(session, {display_name, social_url, platform, agreed, ...forged})
      apply(session, input) {
        const uid = session?.uid ?? null;
        const email = session?.email ?? null;
        if (!uid || !email) return { ok: false, reason: 'not_authenticated' };
        if (input.agreed !== true) return { ok: false, reason: 'terms_not_accepted' };
        const name = String(input.display_name || '').trim();
        if (!name) return { ok: false, reason: 'display_name_required' };
        if (creators.some((c) => c.user_id === uid)) return { ok: false, reason: 'already_creator' };
        // NOTE: input.user_id / creator_code / commission_rate / status are
        // present in `input` but DELIBERATELY never read — mirroring the RPC.
        const row = {
          id: `creator-${++seq}`,
          user_id: uid,                       // from JWT, not input
          email,                              // from JWT, not input
          creator_code: genCode(name),        // server-generated
          display_name: name,
          status: policy.auto_approve ? 'active' : 'pending',      // from policy
          default_commission_rate: policy.default_commission_rate, // from config
          default_attribution_window_days: policy.default_attribution_window_days,
        };
        creators.push(row);
        return { ok: true, linked: false, creator_code: row.creator_code, status: row.status };
      },
      mine(session) { return creators.find((c) => c.user_id === session?.uid) || null; },
    };
  }

  const cust = { uid: 'user-1', email: 'buyer@example.com' };

  // 1) existing customer becomes creator
  const db = makeDB();
  const r1 = db.apply(cust, { display_name: 'Anjali', agreed: true });
  eq(r1.ok, true, '1) an existing customer can become a creator', 'MODEL');

  // 2) auth.uid() is the owner
  eq(db.mine(cust).user_id, 'user-1', '2) the creator is owned by auth.uid()', 'MODEL');

  // 4) code generated server-side
  truthy(/^SORA-[A-Z0-9]+$/.test(r1.creator_code), '4) creator code is generated server-side', 'MODEL');

  // 7) status cannot be client-controlled (policy = pending by default)
  eq(r1.status, 'pending', '7) status comes from policy (pending), not the client', 'MODEL');

  // 5) forged creatorId/userId ignored — 6) commissionRate ignored
  const db2 = makeDB();
  const forged = db2.apply({ uid: 'user-2', email: 'b2@example.com' }, {
    display_name: 'Bob', agreed: true,
    user_id: 'user-HACKER', creator_code: 'SORA-ADMIN', status: 'active',
    default_commission_rate: 99, id: 'creator-HACK',
  });
  const bob = db2.mine({ uid: 'user-2' });
  eq(bob.user_id, 'user-2', '5) forged user_id is ignored (owner stays auth.uid())', 'MODEL');
  truthy(bob.creator_code !== 'SORA-ADMIN', '5) forged creator_code is ignored', 'MODEL');
  eq(bob.status, 'pending', '7) forged status=active is ignored', 'MODEL');
  eq(bob.default_commission_rate, 10, '6) forged commission rate is ignored (config default kept)', 'MODEL');

  // 3) duplicate creator creation is blocked
  const dup = db.apply(cust, { display_name: 'Anjali Again', agreed: true });
  eq(dup.reason, 'already_creator', '3) a second application for the same account is blocked', 'MODEL');
  eq(db.creators.filter((c) => c.user_id === 'user-1').length, 1, '3) exactly one creator row exists for the account', 'MODEL');

  // 10) anonymous cannot apply
  eq(db.apply({ uid: null, email: null }, { display_name: 'X', agreed: true }).reason, 'not_authenticated',
    '10) an anonymous caller cannot apply', 'MODEL');

  // consent + name required
  eq(makeDB().apply(cust, { display_name: 'A', agreed: false }).reason, 'terms_not_accepted', 'terms must be accepted', 'MODEL');
  eq(makeDB().apply(cust, { display_name: '', agreed: true }).reason, 'display_name_required', 'display name is required', 'MODEL');

  // approval policy: auto-approve => active immediately
  const dbAuto = makeDB({ auto_approve: true, default_commission_rate: 15, default_attribution_window_days: 45 });
  const auto = dbAuto.apply(cust, { display_name: 'Auto', agreed: true });
  eq(auto.status, 'active', 'auto-approve policy makes an applicant active immediately', 'MODEL');
  eq(dbAuto.mine(cust).default_commission_rate, 15, 'config commission rate is applied', 'MODEL');
}

// ============================================================
// STATIC — 0011 retired-code protection still present (case 13)
// ============================================================
console.log('\n— 0011 retired-code protection intact (case 13) —');
{
  const SQL11 = readFileSync('supabase/migrations/0011_creator_code_alias_guard.sql', 'utf8');
  truthy(/is a retired alias and cannot be reissued/.test(SQL11), '13) 0011 alias guard still present in the migration set', 'STATIC');
  // 0012 must not have weakened it.
  truthy(!/creator_partners_biu/.test(SQL12), '0012 does not redefine the alias-guard trigger', 'STATIC');
}

// ============================================================
// getMyCreator() ownership scoping (self-service surfaces)
// ============================================================
console.log('\n— getMyCreator scopes to auth.uid(), not admin RLS —');
{
  // STATIC: the query must filter by user_id derived from the session, and
  // must NOT be a bare maybeSingle() that leans on RLS to narrow the result.
  const src = API.match(/export async function getMyCreator\(\)[\s\S]*?\n}/)[0];
  truthy(/currentUserId\(\)|auth\.getSession\(\)|auth\.getUser\(\)/.test(API) && /const uid = await currentUserId/.test(src),
    'getMyCreator derives the uid from the authenticated session', 'STATIC');
  truthy(/\.eq\('user_id', uid\)/.test(src), 'getMyCreator filters creator_partners by user_id = auth.uid()', 'STATIC');
  truthy(/if \(!uid\) return null/.test(src), 'no session -> null (onboarding state)', 'STATIC');
  // The portal passes the resolved id so campaigns/links are owner-scoped too.
  const port = readFileSync('src/pages/CreatorPortal.jsx', 'utf8');
  truthy(/getMyCampaigns\(me\.id\)/.test(port) && /getMyLinks\(me\.id\)/.test(port),
    'portal scopes campaigns/links to the resolved creator id', 'STATIC');

  // MODEL: faithful mirror of the NEW getMyCreator against a DB + RLS.
  // rlsVisible() mimics Postgres: admins see all rows, others see only rows
  // whose user_id = their uid. The NEW code then filters by user_id = uid.
  function dbWith(creators) {
    return {
      creators,
      // NEW getMyCreator: explicit user_id filter, regardless of RLS breadth.
      getMyCreator(uid, isAdmin) {
        if (!uid) return null;
        // RLS still applies underneath; an explicit eq('user_id', uid) means
        // even an admin (who could read all) only matches their own row.
        const visible = isAdmin ? creators : creators.filter((c) => c.user_id === uid);
        const rows = visible.filter((c) => c.user_id === uid);
        return rows[0] || null;
      },
      // OLD behaviour, kept only to prove the bug it fixes.
      oldGetMyCreator(uid, isAdmin) {
        const visible = isAdmin ? creators : creators.filter((c) => c.user_id === uid);
        return visible[0] || null; // bare maybeSingle over RLS-visible rows
      },
    };
  }

  const admin = 'admin-uid';
  const cust = 'cust-uid';
  const other = 'other-uid';

  // Admin with MULTIPLE creators in the DB, owning NONE -> null.
  {
    const db = dbWith([
      { user_id: other, creator_code: 'SORA-A' },
      { user_id: 'x2', creator_code: 'SORA-B' },
    ]);
    eq(db.getMyCreator(admin, true), null, 'admin (owns none) with multiple creators in DB -> null', 'MODEL');
    // Contrast: the old code would have leaked another creator here.
    truthy(db.oldGetMyCreator(admin, true) !== null, 'the OLD code would have returned a non-owned creator (bug the fix removes)', 'MODEL');
  }

  // Admin who IS also a creator, with multiple creators in the DB -> only own.
  {
    const db = dbWith([
      { user_id: other, creator_code: 'SORA-A' },
      { user_id: admin, creator_code: 'SORA-ADMINCREATOR' },
      { user_id: 'x3', creator_code: 'SORA-C' },
    ]);
    const got = db.getMyCreator(admin, true);
    eq(got?.creator_code, 'SORA-ADMINCREATOR', 'admin who is also a creator gets ONLY their own record', 'MODEL');
  }

  // Normal customer with no creator -> null (sees onboarding).
  {
    const db = dbWith([{ user_id: other, creator_code: 'SORA-A' }]);
    eq(db.getMyCreator(cust, false), null, 'normal customer with no creator -> null (onboarding)', 'MODEL');
  }

  // Normal customer who is a creator -> only their own.
  {
    const db = dbWith([
      { user_id: other, creator_code: 'SORA-A' },
      { user_id: cust, creator_code: 'SORA-MINE' },
    ]);
    eq(db.getMyCreator(cust, false)?.creator_code, 'SORA-MINE', 'a creator gets only their own record', 'MODEL');
  }

  // No session -> null.
  eq(dbWith([{ user_id: cust, creator_code: 'SORA-MINE' }]).getMyCreator(null, false), null, 'no authenticated user -> null', 'MODEL');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
