// ============================================================
// Phase 2 — auth hardening, Google OAuth, creator program refinement,
// and the RPC-only write hardening in migration 0024.
//
// Pure logic is executed; JSX and SQL are asserted against source, with
// comments stripped so prose cannot satisfy a check.
//
// NO NETWORK, NO SECRETS, NO DATABASE.
//
// Run: node scripts/test-auth-creator-phase2.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  hashIndicatesRecovery, validateNewPassword, readOAuthError, hashCarriesAuthTokens,
} from '../src/lib/authRecovery.js';
import { parseEnabledProviders, SUPPORTED_PROVIDERS, PROVIDER_LABELS } from '../src/lib/oauthProviders.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const js = (src) => src.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const sqlOnly = (src) => src.replace(/\r\n/g, '\n').split('\n')
  .map((l) => l.replace(/--.*$/, '')).join('\n');

const auth = read('../src/lib/customerAuth.jsx');
const account = read('../src/pages/Account.jsx');
const oauth = read('../src/lib/oauth.js');
const hiw = read('../src/components/creator/CreatorHowItWorks.jsx');
const portal = read('../src/pages/CreatorPortal.jsx');
const creatorApi = read('../src/lib/creatorApi.js');
const m0024 = read('../supabase/migrations/0024_creator_rpc_only_financial_writes.sql');
const m0023 = read('../supabase/migrations/0023_creator_payout_settlement_safety.sql');

let passed = 0, failed = 0, current = '(startup)';
function fatal(kind, err) {
  console.error(`\n  FATAL ${kind} during: ${current}`);
  console.error(`  ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
}
process.on('unhandledRejection', (e) => fatal('unhandledRejection', e));
process.on('uncaughtException', (e) => fatal('uncaughtException', e));

async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

// ============================================================
console.log('\n— Auth: OAuth callback handling —');
// ============================================================

await test('a failed OAuth round-trip is detected from the query string', () => {
  assert.notEqual(readOAuthError('?error=access_denied', ''), '');
  assert.match(readOAuthError('?error=access_denied', ''), /cancelled/i);
});

await test('a failed OAuth round-trip is detected from the hash', () => {
  assert.notEqual(readOAuthError('', '#error=server_error&error_description=boom'), '');
});

await test('error_code is honoured as well as error', () => {
  assert.notEqual(readOAuthError('?error_code=temporarily_unavailable', ''), '');
});

await test('a clean callback reports no error', () => {
  assert.equal(readOAuthError('', ''), '');
  assert.equal(readOAuthError('?code=abc', '#access_token=x'), '');
  assert.equal(readOAuthError(null, undefined), '');
});

await test('the provider error_description is never echoed into the page', () => {
  // It arrives in a URL and is attacker-influencable; showing it would be
  // reflected content for no benefit.
  const msg = readOAuthError('', '#error=server_error&error_description=<img src=x onerror=alert(1)>');
  assert.doesNotMatch(msg, /<img|onerror|alert/);
});

await test('an unknown provider error still produces a safe message', () => {
  const msg = readOAuthError('?error=some_new_thing', '');
  assert.notEqual(msg, '');
  assert.doesNotMatch(msg, /some_new_thing/);
});

await test('the provider surfaces the OAuth error instead of a blank page', () => {
  const c = js(auth);
  assert.match(c, /readOAuthError\(window\.location\.search, window\.location\.hash\)/);
  assert.match(c, /oauthError,/, 'must be exposed on the context');
  assert.match(js(account), /\{oauthError && !error &&/, 'the sign-in card must render it');
});

await test('a successful sign-in clears any earlier OAuth error', () => {
  assert.match(js(auth), /event === 'SIGNED_IN'\)\s*setOauthError\(''\)/);
});

// ============================================================
console.log('\n— Auth: token hygiene and recovery regression —');
// ============================================================

await test('auth tokens in the fragment are recognised', () => {
  assert.equal(hashCarriesAuthTokens('#access_token=abc&expires_in=3600'), true);
  assert.equal(hashCarriesAuthTokens('#refresh_token=abc'), true);
  assert.equal(hashCarriesAuthTokens('#type=recovery'), false);
  assert.equal(hashCarriesAuthTokens(''), false);
  assert.equal(hashCarriesAuthTokens(null), false);
});

await test('the token fragment is stripped once a session exists', () => {
  const c = js(auth);
  assert.match(c, /hashCarriesAuthTokens\(window\.location\.hash\)/);
  assert.match(c, /window\.history\.replaceState\(null, '', window\.location\.pathname/);
});

await test('stripping never runs during password recovery', () => {
  // The recovery fragment is what gates the set-password screen on refresh.
  assert.match(js(auth), /hashCarriesAuthTokens\(window\.location\.hash\)\s*&&\s*!hashIndicatesRecovery\(window\.location\.hash\)/);
});

await test('password recovery still works exactly as before', () => {
  const c = js(auth);
  assert.equal(hashIndicatesRecovery('#type=recovery'), true);
  assert.equal(hashIndicatesRecovery('#type=signup'), false);
  assert.match(c, /event === 'PASSWORD_RECOVERY'\)\s*setRecovery\(true\)/);
  assert.match(c, /event === 'SIGNED_OUT'\)\s*setRecovery\(false\)/);
  assert.match(c, /supabase\.auth\.updateUser\(\{ password/);
  assert.equal(validateNewPassword('short', 'short') === '', false);
  assert.equal(validateNewPassword('correct-horse-1', 'correct-horse-1'), '');
  assert.equal(validateNewPassword('a-good-password', 'a-different-one'), 'Those passwords do not match.');
});

await test('the reset form still cannot be used to enumerate accounts', () => {
  const c = js(account);
  assert.match(c, /If an account exists for that email/);
  const at = c.indexOf('await resetPassword(email)');
  assert.doesNotMatch(c.slice(at, at + 500), /setError\(err\.message/);
});

await test('sign in, sign up and sign out are unchanged', () => {
  const c = js(auth);
  assert.match(c, /supabase\.auth\.signInWithPassword/);
  assert.match(c, /supabase\.auth\.signUp/);
  assert.match(c, /supabase\.auth\.signOut/);
  assert.match(c, /needsConfirmation: !data\.session/);
});

// ============================================================
console.log('\n— Google OAuth —');
// ============================================================

await test('no provider is enabled unless the build opts in', () => {
  assert.deepEqual(parseEnabledProviders(''), []);
  assert.deepEqual(parseEnabledProviders(undefined), []);
});

await test('Google can be enabled without enabling Apple', () => {
  assert.deepEqual(parseEnabledProviders('google'), ['google']);
  assert.deepEqual(parseEnabledProviders('google,apple'), ['google', 'apple']);
  assert.deepEqual(parseEnabledProviders('apple'), ['apple']);
});

await test('unknown providers are ignored and duplicates collapse', () => {
  assert.deepEqual(parseEnabledProviders('facebook,google,google'), ['google']);
  assert.deepEqual(parseEnabledProviders('GOOGLE'), ['google']);
});

await test('a disabled provider cannot start a flow', () => {
  assert.match(js(oauth), /if \(!enabledOAuthProviders\(\)\.includes\(provider\)\)/);
});

await test('the OAuth redirect returns to this origin, never an external one', () => {
  const c = js(oauth);
  assert.match(c, /\$\{window\.location\.origin\}\/account/);
  assert.doesNotMatch(c, /redirectTo:\s*[a-zA-Z]+\.(searchParams|href)/, 'no caller-supplied redirect');
});

await test('the Google button carries the provider mark and a real label', () => {
  const c = js(account);
  assert.match(c, /function ProviderMark/);
  assert.match(c, /provider === 'google'/);
  assert.match(c, /btn-social/);
  assert.equal(PROVIDER_LABELS.google, 'Continue with Google');
  for (const p of SUPPORTED_PROVIDERS) assert.ok(PROVIDER_LABELS[p], `missing label: ${p}`);
});

await test('the social button has real styling, not a bare default', () => {
  const css = read('../src/styles/pages.css');
  assert.match(css, /\.btn-social \{/);
  assert.match(css, /\.btn-social:focus-visible/, 'keyboard focus must be visible');
  assert.match(css, /\.btn-social:disabled/);
});

// ============================================================
console.log('\n— Creator: how-you-earn explainer —');
// ============================================================

await test('every figure comes from live config, never a hardcoded promise', () => {
  const c = js(hiw);
  for (const key of ['commission_rate', 'settlement_hold_days', 'min_payout', 'payout_day', 'default_attribution_window_days']) {
    assert.match(c, new RegExp(key), `must read ${key}`);
  }
  // No invented rate, hold window, or minimum anywhere in the copy.
  assert.doesNotMatch(c, /\b(?:10|15|20|25|30)%/, 'no hardcoded commission percentage');
  assert.doesNotMatch(c, /₹\s*\d/, 'no hardcoded rupee figure');
});

await test('a missing config value degrades to honest wording', () => {
  const c = js(hiw);
  assert.match(c, /const has = \(n\) => Number\.isFinite\(n\) && n > 0/);
  assert.match(c, /has\(rate\)\s*\?/);
  assert.match(c, /has\(holdDays\)\s*\?/);
});

await test('the explainer describes the real pipeline', () => {
  for (const beat of [/Held/, /Available/, /hold period/i, /KYC/, /attributed/i, /reserved/i]) {
    assert.match(hiw, beat, `missing pipeline step: ${beat}`);
  }
});

await test('it states the true post-0023 payout rule and manual settlement', () => {
  assert.match(hiw, /full cleared balance/i, 'partial payouts are disabled — say so');
  assert.match(hiw, /manual/i);
  assert.doesNotMatch(hiw, /instant payout|automatic transfer|paid instantly/i);
});

await test('it promises nothing the implementation does not do', () => {
  assert.doesNotMatch(hiw, /guaranteed|guarantee|unlimited|lifetime commission|passive income/i);
});

await test('the explainer is reachable from the portal', () => {
  const c = js(portal);
  assert.match(c, /CreatorHowItWorks/);
  assert.match(c, /id: 'how-it-works'/);
  assert.match(c, /tab === 'how-it-works'/);
});

await test('no fake analytics or invented chart data was added', () => {
  const c = js(hiw);
  assert.doesNotMatch(c, /Math\.random|mockData|sampleData|fakeData/);
});

// ============================================================
console.log('\n— Creator security: migration 0024 —');
// ============================================================

await test('0024 closes direct writes on the tables that mint or unlock money', () => {
  const sql = sqlOnly(m0024);
  for (const t of ['creator_kyc_profiles', 'creator_conversions']) {
    assert.match(sql, new RegExp(`revoke insert, update, delete, truncate on table public\\.${t}\\s+from anon, authenticated`),
      `${t} must be closed`);
    assert.match(sql, new RegExp(`grant select on table public\\.${t}\\s+to authenticated`), `${t} must stay readable`);
  }
});

await test('0024 does NOT revoke the tables the admin app writes directly', () => {
  // adminCreateCreator / adminUpdateCreator / campaign + link management all
  // use direct table writes; revoking these would break Admin -> Creators.
  const sql = sqlOnly(m0024);
  for (const t of ['creator_partners', 'creator_campaigns', 'creator_tracking_links']) {
    assert.doesNotMatch(sql, new RegExp(`revoke[^\\n]*\\bpublic\\.${t}\\b`), `${t} must not be revoked`);
  }
  // And the client really does still write them, which is why.
  assert.match(creatorApi, /from\('creator_partners'\)\.update\(/);
  assert.match(creatorApi, /from\('creator_partners'\)\.insert\(/);
});

await test('the client never writes the tables 0024 locks down', () => {
  for (const t of ['creator_kyc_profiles', 'creator_conversions', 'creator_conversion_items', 'creator_conversion_audit']) {
    const calls = [...creatorApi.matchAll(new RegExp(`from\\('${t}'\\)([\\s\\S]{0,80})`, 'g'))].map((m) => m[1]);
    for (const tail of calls) {
      assert.doesNotMatch(tail, /\.(insert|update|upsert|delete)\(/, `${t} is written directly by the client`);
    }
  }
});

await test('0024 is grants-only: no schema or data change', () => {
  const sql = sqlOnly(m0024);
  assert.doesNotMatch(sql, /\b(create table|alter table|drop table|insert into|update |delete from|truncate table)\b/i);
  assert.match(sql, /^\s*(revoke|grant|select)/im);
});

await test('0024 keeps the guarded RPCs callable', () => {
  const sql = sqlOnly(m0024);
  assert.match(sql, /grant execute on function public\.submit_kyc/);
  assert.match(sql, /grant execute on function public\.admin_set_kyc_status/);
});

await test('0023 payout safety is untouched by this phase', () => {
  const sql = sqlOnly(m0023);
  assert.match(sql, /v_paid <> round\(v\.requested_amount, 2\)/, 'exact settlement');
  assert.match(sql, /v_reserved <> v_paid or round\(v\.reserved_amount, 2\) <> v_paid/, 'reservation match');
  assert.match(sql, /if v_avail <= 0 then/, 'zero-balance guard');
  assert.match(sql, /full_balance_required/);
});

// ============================================================
console.log('\n— Creator isolation and admin authority —');
// ============================================================

await test('creator-facing RPCs derive identity from the session', () => {
  assert.doesNotMatch(sqlOnly(m0023), /p_creator_id/, 'a creator id must never be an argument');
  assert.match(sqlOnly(m0023), /v_cid := public\.current_creator_id\(\)/);
});

await test('KYC approval and payout settlement remain admin-only', () => {
  assert.match(sqlOnly(m0023), /if not public\.is_sora_admin\(\) then raise exception 'admin only'/);
  assert.match(creatorApi, /supabase\.rpc\('admin_set_kyc_status'/);
  assert.match(creatorApi, /supabase\.rpc\('admin_review_payout'/);
  assert.match(creatorApi, /supabase\.rpc\('admin_mark_payout_paid'/);
});

await test('the creator client cannot send its own commission rate or KYC status', () => {
  const c = js(creatorApi);
  const submit = c.slice(c.indexOf('export async function submitKyc'), c.indexOf('export async function submitKyc') + 700);
  assert.doesNotMatch(submit, /identity_status/, 'a creator must not choose their own verification state');
  assert.doesNotMatch(submit, /commission_rate/);
  const reqPayout = c.slice(c.indexOf('export async function requestPayout'), c.indexOf('export async function requestPayout') + 400);
  assert.doesNotMatch(reqPayout, /creator_id|user_id/, 'identity comes from the session');
});

await test('no service-role key anywhere in creator browser code', () => {
  assert.doesNotMatch(creatorApi, /SERVICE_ROLE|service_role|serviceKey/);
  assert.doesNotMatch(hiw, /SERVICE_ROLE|service_role|serviceKey/);
});

// ============================================================
console.log('\n— Untouched systems —');
// ============================================================

await test('checkout, Razorpay, orders and fulfillment are not referenced by this phase', () => {
  for (const src of [m0024, hiw]) {
    assert.doesNotMatch(sqlOnly(src), /razorpay|payment_transactions|\bpublic\.orders\b|idempotency_key/i);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
