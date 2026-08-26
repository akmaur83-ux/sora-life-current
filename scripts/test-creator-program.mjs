// ============================================================
// SORA LIFE Creator Program — Part 1 tests (offline)
//
// Two kinds of check:
//   1. Behavioural models of the SQL in migration 0010 (code generation,
//      status gating, attribution resolution, campaign windows) — the same
//      branch order as the database functions.
//   2. Static assertions against the real migration + API source, so a future
//      edit that weakens RLS, opens a redirect, or starts trusting a
//      client-supplied id fails the suite.
//
//   node scripts/test-creator-program.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import {
  normalizeDestination, isSafeDestination, buildTrackingUrl,
  CREATOR_STATUSES, CAMPAIGN_STATUSES,
} from '../src/lib/creatorLinkUtils.js';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const eq = (a, b, m) => (a === b ? ok(m) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`));
const truthy = (v, m) => (v ? ok(m) : bad(m));

const SQL = readFileSync('supabase/migrations/0010_creator_program.sql', 'utf8');
const TRACK = readFileSync('api/creator/track.js', 'utf8');

// ============================================================
// 1. CREATOR CODE GENERATION  (models generate_creator_code)
// ============================================================
console.log('\n— Creator codes —');
{
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const token = (n) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  const taken = new Set();
  function generate(displayName) {
    let base = String(displayName || '').trim().split(' ')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
    if (base.length < 3) base = 'CREATOR';
    let candidate = `SORA-${base}`;
    let tries = 0;
    while (taken.has(candidate)) {
      tries += 1;
      candidate = `SORA-${base}${token(tries < 4 ? 2 : 4)}`;
      if (tries > 40) { candidate = `SORA-${token(8)}`; break; }
    }
    taken.add(candidate);
    return candidate;
  }

  eq(generate('Anjali Sharma'), 'SORA-ANJALI', 'code is human-readable from the display name');
  const second = generate('Anjali Verma');
  truthy(second !== 'SORA-ANJALI', 'a colliding name gets a distinct code');
  truthy(/^SORA-ANJALI[A-Z0-9]{2}$/.test(second), 'collision suffix comes from the safe alphabet');

  // Uniqueness under load
  const many = new Set(Array.from({ length: 300 }, () => generate('Anjali Sharma')));
  eq(many.size, 300, '300 same-name creators all receive unique codes');

  // Not sequential / not derived from a row counter
  const a = generate('Zed Test'); const b = generate('Zed Test');
  truthy(a !== b && !/\d{3,}$/.test(b), 'codes are not sequential database ids');

  eq(generate('X'), 'SORA-CREATOR', 'too-short names fall back to a safe base');

  // The unambiguous alphabet excludes look-alike characters
  truthy(!/[IO01]/.test(ALPHABET), 'alphabet omits I, O, 0 and 1 (readable aloud)');
}

// ============================================================
// 2. STATUS RULES
// ============================================================
console.log('\n— Statuses —');
{
  eq(CREATOR_STATUSES.join(','), 'pending,active,paused,suspended,archived', 'creator statuses are the five required states');
  eq(CAMPAIGN_STATUSES.join(','), 'draft,active,paused,ended', 'campaign statuses are the four required states');

  // Only an ACTIVE creator may attract attribution (models resolve_tracking_ref)
  const mayAttribute = (s) => s === 'active';
  for (const s of CREATOR_STATUSES) {
    eq(mayAttribute(s), s === 'active', `creator status "${s}" ${s === 'active' ? 'can' : 'cannot'} attribute`);
  }
  // Archiving must not delete history
  truthy(/'archived'/.test(SQL) && !/delete\s+from\s+public\.creator_partners/i.test(SQL),
    'archiving is a status, not a delete — no destructive creator delete in the migration');
}

// ============================================================
// 3. DESTINATION SAFETY  (models the CHECK constraint)
// ============================================================
console.log('\n— Tracking-link destinations —');
{
  eq(normalizeDestination('https://evil.com/steal', 'custom'), '/', 'absolute external URL is rejected');
  eq(normalizeDestination('//evil.com', 'custom'), '/', 'protocol-relative URL is rejected');
  eq(normalizeDestination('javascript:alert(1)', 'custom'), '/', 'javascript: URL is rejected');
  eq(normalizeDestination('data:text/html,<script>', 'custom'), '/', 'data: URL is rejected');
  eq(normalizeDestination('/product/sea-buckthorn-juice', 'product'), '/product/sea-buckthorn-juice', 'internal path is kept');
  eq(normalizeDestination('product/x', 'product'), '/product/x', 'a relative path is rooted');
  eq(normalizeDestination('/anything', 'homepage'), '/', 'homepage type always targets /');
  eq(normalizeDestination('', 'custom'), '/', 'empty destination falls back to /');

  truthy(isSafeDestination('/category/wellness'), 'internal path passes the safety test');
  truthy(!isSafeDestination('https://evil.com'), 'external URL fails the safety test');
  truthy(!isSafeDestination('//evil.com'), 'protocol-relative fails the safety test');
  truthy(!isSafeDestination('/x?u=javascript:alert(1)'), 'embedded javascript: fails the safety test');

  // The DB repeats the rule, so a bypassed client cannot store a bad path.
  truthy(/creator_tracking_links_dest_chk/.test(SQL), 'database CHECK constraint guards destinations too');
  for (const frag of ["destination_path ~ '\\^/'", "!~ '\\^//'", "!~ '://'", "javascript:"]) {
    truthy(new RegExp(frag.replace(/\\\^/g, '\\^')).test(SQL) || SQL.includes(frag.replace(/\\/g, '')),
      `CHECK covers ${frag.replace(/\\/g, '')}`);
  }
}

// ============================================================
// 4. TRACKING URL FORMAT
// ============================================================
console.log('\n— Tracking URL —');
{
  const origin = 'https://sora-life-current.vercel.app';
  const creator = { creator_code: 'SORA-ANJALI' };
  const link = { public_code: 'TRK-8F4K2Q', destination_path: '/' };
  const campaign = { campaign_code: 'INSTAGRAM-BIO' };

  const home = buildTrackingUrl(link, creator, null, origin);
  truthy(home.startsWith(`${origin}/?`), 'homepage link points at the site root');
  truthy(home.includes('ref=SORA-ANJALI'), 'URL carries the human-readable creator code');
  truthy(home.includes('trk=TRK-8F4K2Q'), 'URL carries the unique per-link code');

  const withCampaign = buildTrackingUrl(link, creator, campaign, origin);
  truthy(withCampaign.includes('campaign=INSTAGRAM-BIO'), 'campaign links carry the campaign code');

  const product = buildTrackingUrl(
    { public_code: 'TRK-AAA111', destination_path: '/product/biosash-sea-buckthorn-juice' },
    creator, null, origin,
  );
  eq(product, `${origin}/product/biosash-sea-buckthorn-juice?ref=SORA-ANJALI&trk=TRK-AAA111`,
    'product link matches the documented format');

  // Every link has its own identifier, so campaign analytics is possible later
  const a = buildTrackingUrl({ public_code: 'TRK-A', destination_path: '/' }, creator, null, origin);
  const b = buildTrackingUrl({ public_code: 'TRK-B', destination_path: '/' }, creator, null, origin);
  truthy(a !== b, 'two links for one creator remain distinguishable');
}

// ============================================================
// 5. ATTRIBUTION RESOLUTION  (models resolve_tracking_ref)
// ============================================================
console.log('\n— Attribution resolution —');
{
  const now = Date.now();
  const day = 86400000;
  const creators = {
    c1: { id: 'c1', creator_code: 'SORA-ANJALI', status: 'active', default_attribution_window_days: 30 },
    c2: { id: 'c2', creator_code: 'SORA-PAUSED', status: 'paused', default_attribution_window_days: 30 },
    c3: { id: 'c3', creator_code: 'SORA-SUSPENDED', status: 'suspended', default_attribution_window_days: 30 },
  };
  const aliases = { 'SORA-OLDNAME': 'c1' };
  const campaigns = {
    live: { id: 'cmp1', creator_id: 'c1', campaign_code: 'YT-SEABUCKTHORN', status: 'active', start_at: now - day, end_at: now + day, attribution_window_days: 45 },
    ended: { id: 'cmp2', creator_id: 'c1', campaign_code: 'DIWALI-2026', status: 'ended', start_at: now - 10 * day, end_at: now - day },
    future: { id: 'cmp3', creator_id: 'c1', campaign_code: 'FUTURE', status: 'active', start_at: now + day, end_at: null },
    draft: { id: 'cmp4', creator_id: 'c1', campaign_code: 'DRAFT', status: 'draft', start_at: null, end_at: null },
  };
  const links = {
    'TRK-GOOD': { id: 'l1', creator_id: 'c1', campaign_id: 'cmp1', status: 'active' },
    'TRK-OFF': { id: 'l2', creator_id: 'c1', campaign_id: null, status: 'paused' },
  };

  function resolve(ref, campaignCode) {
    const r = String(ref || '').toUpperCase();
    if (!r) return { ok: false, reason: 'missing_ref' };
    let creator = null, campaign = null, link = null;

    if (links[r]) {
      link = links[r];
      if (link.status !== 'active') return { ok: false, reason: 'link_inactive' };
      creator = Object.values(creators).find((c) => c.id === link.creator_id);
      campaign = Object.values(campaigns).find((c) => c.id === link.campaign_id) || null;
    } else {
      creator = Object.values(creators).find((c) => c.creator_code === r)
        || (aliases[r] ? creators[aliases[r]] : null);
      if (!creator) return { ok: false, reason: 'unknown_ref' };
      if (campaignCode) {
        campaign = Object.values(campaigns).find((c) => c.creator_id === creator.id && c.campaign_code === String(campaignCode).toUpperCase());
        if (!campaign) return { ok: false, reason: 'unknown_campaign' };
      }
    }

    if (creator.status !== 'active') return { ok: false, reason: `creator_${creator.status}` };
    if (campaign) {
      if (campaign.status !== 'active') return { ok: false, reason: `campaign_${campaign.status}` };
      if (campaign.start_at && campaign.start_at > now) return { ok: false, reason: 'campaign_not_started' };
      if (campaign.end_at && campaign.end_at < now) return { ok: false, reason: 'campaign_expired' };
    }
    return {
      ok: true,
      creator_id: creator.id,
      campaign_id: campaign?.id ?? null,
      tracking_link_id: link?.id ?? null,
      window: campaign?.attribution_window_days ?? creator.default_attribution_window_days,
    };
  }

  eq(resolve('SORA-ANJALI').ok, true, 'valid creator ref resolves');
  eq(resolve('sora-anjali').ok, true, 'ref matching is case-insensitive');
  eq(resolve('').reason, 'missing_ref', 'empty ref is refused');
  eq(resolve('SORA-NOBODY').reason, 'unknown_ref', 'unknown ref is refused');
  eq(resolve('SORA-PAUSED').reason, 'creator_paused', 'paused creator does not attribute');
  eq(resolve('SORA-SUSPENDED').reason, 'creator_suspended', 'suspended creator does not attribute');
  eq(resolve('SORA-OLDNAME').ok, true, 'a retired code alias still resolves (historical links keep working)');
  eq(resolve('SORA-OLDNAME').creator_id, 'c1', 'alias resolves to the right creator');

  eq(resolve('SORA-ANJALI', 'YT-SEABUCKTHORN').ok, true, 'live campaign resolves');
  eq(resolve('SORA-ANJALI', 'DIWALI-2026').reason, 'campaign_ended', 'ended campaign does not attribute');
  eq(resolve('SORA-ANJALI', 'FUTURE').reason, 'campaign_not_started', 'not-yet-started campaign does not attribute');
  eq(resolve('SORA-ANJALI', 'DRAFT').reason, 'campaign_draft', 'draft campaign does not attribute');
  eq(resolve('SORA-ANJALI', 'NOPE').reason, 'unknown_campaign', 'unknown campaign is refused');

  eq(resolve('TRK-GOOD').ok, true, 'tracking-link code resolves');
  eq(resolve('TRK-GOOD').tracking_link_id, 'l1', 'link code resolves to the exact link');
  eq(resolve('TRK-GOOD').campaign_id, 'cmp1', 'link code carries its campaign');
  eq(resolve('TRK-OFF').reason, 'link_inactive', 'deactivated link does not attribute');

  // Attribution window: campaign override wins over the creator default
  eq(resolve('SORA-ANJALI').window, 30, 'creator default window applies with no campaign');
  eq(resolve('TRK-GOOD').window, 45, 'campaign override wins over the creator default');

  // Expiry is computed from the window
  const expiry = now + resolve('TRK-GOOD').window * day;
  truthy(expiry > now + 44 * day && expiry < now + 46 * day, 'expiry is derived from the resolved window');
}

// ============================================================
// 6. SECURITY — static assertions against the real source
// ============================================================
console.log('\n— Security (migration + API source) —');
{
  // RLS enabled on every creator table
  for (const t of ['creator_partners', 'creator_code_aliases', 'creator_campaigns',
    'creator_tracking_links', 'creator_attribution_events', 'creator_admin_audit']) {
    truthy(new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(SQL),
      `RLS enabled on ${t}`);
  }

  // Admin policies exist
  truthy(/creator_partners admin all/.test(SQL), 'admin has a management policy on creators');
  truthy(/creator_campaigns admin all/.test(SQL), 'admin has a management policy on campaigns');
  truthy(/creator_links admin all/.test(SQL), 'admin has a management policy on tracking links');

  // Creators are READ-ONLY: no update/insert/delete policy anywhere for them.
  const selfPolicies = SQL.match(/create policy "creator_\w+ self \w+"[\s\S]*?;/g) || [];
  truthy(selfPolicies.length > 0, 'creator self-access policies exist');
  truthy(selfPolicies.every((p) => /for select/.test(p)),
    'every creator self policy is SELECT-only — a creator cannot change their own commission rate or status');

  // Attribution events: no insert policy at all -> service-role only.
  const eventPolicies = SQL.match(/create policy "creator_events[\s\S]*?;/g) || [];
  truthy(eventPolicies.every((p) => /for select/.test(p)),
    'attribution events are read-only via RLS (only the server can write them)');

  // The resolution/recording functions must not be callable by the browser.
  truthy(/revoke all on function public\.resolve_tracking_ref[\s\S]{0,120}from public, anon, authenticated/.test(SQL),
    'resolve_tracking_ref is revoked from anon/authenticated');
  truthy(/revoke all on function public\.record_attribution_event[\s\S]{0,160}from public, anon, authenticated/.test(SQL),
    'record_attribution_event is revoked from anon/authenticated');
  truthy(/grant execute on function public\.record_attribution_event[\s\S]{0,160}to service_role/.test(SQL),
    'record_attribution_event is service-role only');

  // change_creator_code is admin-gated INSIDE the function
  truthy(/is_sora_admin\(\) then raise exception 'admin only'/.test(SQL.replace(/\s+/g, ' ')),
    'change_creator_code refuses non-admins server-side');
  truthy(/creator_code cannot be changed directly/.test(SQL),
    'direct creator_code updates are blocked by a trigger');
  truthy(/insert into public\.creator_code_aliases/.test(SQL),
    'the previous code is preserved as an alias on change');

  // claim_creator_account uses the verified JWT, not client input
  truthy(/auth\.email\(\)/.test(SQL) && /claim_creator_account/.test(SQL),
    'account claiming matches on the verified JWT email, never a client-supplied one');
  truthy(/user_id is null/.test(SQL), 'only an unclaimed creator record can be linked');

  // A link must belong to a campaign of the same creator
  truthy(/campaign does not belong to this creator/.test(SQL),
    'a tracking link cannot point at another creator\'s campaign');

  // Uniqueness / anti-abuse
  truthy(/creator_code\s+text not null unique/.test(SQL), 'creator_code is UNIQUE');
  truthy(/public_code\s+text not null unique/.test(SQL), 'tracking link public_code is UNIQUE');
  truthy(/creator_campaigns_code_key/.test(SQL), 'campaign code is unique per creator');

  // Audit trail
  truthy(/creator_admin_audit/.test(SQL) && /creator_audit_trigger/.test(SQL), 'an admin audit trail exists');
  for (const trig of ['creator_partners_audit', 'creator_campaigns_audit', 'creator_tracking_links_audit']) {
    truthy(new RegExp(trig).test(SQL), `audit trigger installed: ${trig}`);
  }

  // ---- API route ----
  truthy(/enforceRateLimit/.test(TRACK), 'the tracking endpoint is rate-limited');
  truthy(/getUserIdFromToken/.test(TRACK), 'signup attribution derives the user id from the verified token');
  truthy(!/body\.(creatorId|campaignId|commissionRate|creator_id|campaign_id)/.test(TRACK),
    'the endpoint never reads creatorId/campaignId/commissionRate from the request body');
  truthy(/record_attribution_event/.test(TRACK), 'the endpoint records events through the server-only RPC');
  truthy(/Allow', 'POST'/.test(TRACK) && /405/.test(TRACK), 'method enforcement returns 405');
  truthy(!/attribution_id[\s\S]{0,40}creator_id/.test(TRACK.replace(/\/\/.*$/gm, '')),
    'no internal creator id is returned to the browser');
}

// ============================================================
// 7. NOT-IN-SCOPE GUARD — Part 1 must not invent commission data
// ============================================================
console.log('\n— Phase discipline —');
{
  truthy(!/create table if not exists public\.creator_commissions/.test(SQL), 'no commission table in Part 1');
  truthy(!/create table if not exists public\.creator_payouts/.test(SQL), 'no payout table in Part 1');
  truthy(!/create table if not exists public\.creator_withdrawals/.test(SQL), 'no withdrawal table in Part 1');
  // But the schema is ready for them
  truthy(/commission_rate_override/.test(SQL), 'campaign commission override column is ready for Part 2');
  truthy(/attribution_model/.test(SQL), 'attribution model column is ready for first/last-click in Part 2');
  truthy(/expires_at/.test(SQL), 'attribution expiry is stored for Part 2 window evaluation');
  truthy(/'last_click'/.test(SQL), 'last-click is the recorded default model');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
