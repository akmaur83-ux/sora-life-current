// ============================================================
// Regression tests for the feature-activation pass.
//
// Covers what was switched on, and — just as importantly — what must stay
// off: no fake success, no invented claim, no dead link, no sign-in button
// for a provider that is not configured.
//
// Pure logic is imported and executed. JSX modules cannot be imported in
// Node, so those are asserted against their source, the same way
// test-storefront-release-blockers.mjs does.
//
// NO NETWORK, NO SECRETS. The newsletter route runs against an in-memory
// fetch double.
//
// Run: node scripts/test-feature-activation.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { hashIndicatesRecovery, validateNewPassword, MIN_PASSWORD_LENGTH } from '../src/lib/authRecovery.js';
import { parseEnabledProviders, SUPPORTED_PROVIDERS, PROVIDER_LABELS } from '../src/lib/oauthProviders.js';
import { normalizeEmail, isAcceptableEmail } from '../api/newsletter/subscribe.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const footer = read('../src/components/Footer.jsx');
const account = read('../src/pages/Account.jsx');
const newsletter = read('../src/components/Newsletter.jsx');
const customerAuth = read('../src/lib/customerAuth.jsx');
const creatorPortal = read('../src/pages/CreatorPortal.jsx');

let passed = 0, failed = 0;
let current = '(startup)';
function reportFatal(kind, err) {
  console.error(`\n  FATAL ${kind} during: ${current}`);
  console.error(`  ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
}
process.on('unhandledRejection', (e) => reportFatal('unhandledRejection', e));
process.on('uncaughtException', (e) => reportFatal('uncaughtException', e));

async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
/**
 * Strip comments before asserting on source.
 *
 * Essential for the "this string must be GONE" checks: these files document
 * what was removed and why, so a comment saying `href="#"` or "Coming soon"
 * would otherwise fail a test that the code actually passes. Handles both
 * // lines and /* *\/ blocks (which is what JSX {\/* *\/} comments are).
 *
 * CRLF is normalised first — `.` does not match \r, so a naive //.*$ strip
 * silently does nothing on a CRLF checkout.
 */
const code = (src) => src
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

/**
 * The same idea for SQL, where comments start with -- rather than //.
 * Migration files document their own VERIFY and ROLLBACK statements in
 * comments, so asserting on the raw text would read those as if they were
 * part of the migration.
 */
const sqlCode = (src) => src
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

// ============================================================
console.log('\n— Password recovery —');
// ============================================================

await test('a recovery landing is detected from the URL fragment', () => {
  assert.equal(hashIndicatesRecovery('#access_token=abc&type=recovery'), true);
  assert.equal(hashIndicatesRecovery('#type=recovery&refresh_token=x'), true);
});

await test('ordinary landings are not treated as recovery', () => {
  assert.equal(hashIndicatesRecovery(''), false);
  assert.equal(hashIndicatesRecovery('#access_token=abc&type=signup'), false);
  assert.equal(hashIndicatesRecovery('#type=magiclink'), false);
  assert.equal(hashIndicatesRecovery(null), false);
  assert.equal(hashIndicatesRecovery(undefined), false);
});

await test('the PASSWORD_RECOVERY event is handled, not just the URL', () => {
  // The URL check alone would miss a recovery that supabase-js reports after
  // the fragment has already been consumed.
  assert.match(code(customerAuth), /event === 'PASSWORD_RECOVERY'/);
  assert.match(code(customerAuth), /setRecovery\(true\)/);
});

await test('signing out ends the recovery state', () => {
  assert.match(code(customerAuth), /event === 'SIGNED_OUT'[\s\S]{0,60}setRecovery\(false\)/);
});

await test('mismatched passwords are rejected', () => {
  assert.equal(validateNewPassword('correct-horse', 'correct-hors'), 'Those passwords do not match.');
});

await test('short passwords are rejected', () => {
  assert.ok(validateNewPassword('short', 'short').includes(String(MIN_PASSWORD_LENGTH)));
  assert.notEqual(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1), 'a'.repeat(MIN_PASSWORD_LENGTH - 1)), '');
});

await test('a valid matching password is accepted', () => {
  assert.equal(validateNewPassword('correct-horse-battery', 'correct-horse-battery'), '');
});

await test('non-string input cannot slip past validation', () => {
  assert.notEqual(validateNewPassword(undefined, undefined), '');
  assert.notEqual(validateNewPassword(null, null), '');
});

await test('the new password is written with supabase.auth.updateUser', () => {
  assert.match(code(customerAuth), /supabase\.auth\.updateUser\(\{ password/);
});

await test('an expired recovery link is refused rather than silently passing', () => {
  assert.match(code(customerAuth), /if \(!current\)[\s\S]{0,140}expired/i);
});

await test('recovery is cleared after a successful update', () => {
  const fn = customerAuth.slice(customerAuth.indexOf('async function updatePassword'));
  assert.match(fn.slice(0, 700), /setRecovery\(false\)/);
});

await test('the recovery screen gates the account UI ahead of the session check', () => {
  const c = code(account);
  const recoveryAt = c.indexOf('if (recovery) return <SetNewPasswordView />');
  const sessionAt = c.indexOf('if (!session) return <AuthView />');
  assert.ok(recoveryAt > -1, 'recovery gate missing');
  assert.ok(sessionAt > -1, 'session gate missing');
  assert.ok(recoveryAt < sessionAt, 'the recovery gate must come first');
});

await test('ordinary sign-up and sign-in are unchanged', () => {
  const c = code(customerAuth);
  assert.match(c, /supabase\.auth\.signInWithPassword/);
  assert.match(c, /supabase\.auth\.signUp/);
  assert.match(c, /needsConfirmation: !data\.session/);
});

await test('the reset form cannot be used to discover which emails have accounts', () => {
  const c = code(account);
  // One message, sent on both the success and the failure path.
  assert.match(c, /If an account exists for that email/);
  const resetBlock = c.slice(c.indexOf('await resetPassword(email)'), c.indexOf('await resetPassword(email)') + 500);
  assert.doesNotMatch(resetBlock, /setError\(err\.message/, 'a provider error here would leak account existence');
});

// ============================================================
console.log('\n— Newsletter —');
// ============================================================

await test('emails are normalised so one address is one row', () => {
  assert.equal(normalizeEmail('  Me@Example.COM '), 'me@example.com');
  assert.equal(normalizeEmail('me@example.com'), 'me@example.com');
  assert.equal(normalizeEmail(null), '');
  assert.equal(normalizeEmail(42), '');
});

await test('invalid addresses are rejected', () => {
  for (const bad of ['', 'nope', 'a@b', 'a@@b.com', 'no spaces@x.com', '@example.com', 'a@.com', 'x@y.']) {
    assert.equal(isAcceptableEmail(normalizeEmail(bad)), false, `should reject: ${bad}`);
  }
});

await test('valid addresses are accepted', () => {
  for (const good of ['a@b.com', 'first.last@sub.example.co.in', 'x+tag@example.org']) {
    assert.equal(isAcceptableEmail(normalizeEmail(good)), true, `should accept: ${good}`);
  }
});

await test('an over-long address is rejected', () => {
  assert.equal(isAcceptableEmail(normalizeEmail(`${'a'.repeat(250)}@example.com`)), false);
});

// ---- The route, against an in-memory Supabase ----
process.env.VITE_SUPABASE_URL = 'https://fake-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-not-a-real-key';
const subscribeHandler = (await import('../api/newsletter/subscribe.js')).default;

function mockRes() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
function installFetch({ insertStatus = 201, insertBody = null } = {}) {
  const seen = { inserts: [], serviceKeyUsed: false };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const json = (s, b) => new Response(JSON.stringify(b ?? null), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.endsWith('/rpc/rate_limit_check')) return json(200, { allowed: true, count: 1, limit: 5, reset: 0 });
    if (url.pathname.endsWith('/newsletter_subscribers')) {
      seen.inserts.push(JSON.parse(init.body));
      if (init.headers?.Authorization?.includes('test-service-role')) seen.serviceKeyUsed = true;
      return json(insertStatus, insertBody);
    }
    throw new Error(`unexpected call: ${url.pathname}`);
  };
  return seen;
}

await test('a valid address is written and only then reported as subscribed', async () => {
  const seen = installFetch();
  const res = mockRes();
  await subscribeHandler({ method: 'POST', headers: {}, body: { email: '  New@Example.com ' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.subscribed, true);
  assert.equal(seen.inserts.length, 1, 'the row must actually be written');
  assert.equal(seen.inserts[0].email, 'new@example.com', 'stored normalised');
  assert.equal(seen.inserts[0].status, 'subscribed');
});

await test('the write uses the service-role key, never the browser key', async () => {
  const seen = installFetch();
  await subscribeHandler({ method: 'POST', headers: {}, body: { email: 'a@b.com' } }, mockRes());
  assert.ok(seen.serviceKeyUsed, 'insert must be authorised with the service-role key');
});

await test('a duplicate signup succeeds without revealing it is a duplicate', async () => {
  const seen = installFetch();
  const first = mockRes(); const second = mockRes();
  await subscribeHandler({ method: 'POST', headers: {}, body: { email: 'dupe@example.com' } }, first);
  await subscribeHandler({ method: 'POST', headers: {}, body: { email: 'dupe@example.com' } }, second);
  assert.deepEqual(first.body, second.body, 'both answers must be identical');
  assert.equal(seen.inserts[0].email, seen.inserts[1].email);
  // merge-duplicates is what stops the unique index turning a re-subscribe
  // into a 409 the customer would see as an error.
  assert.match(code(read('../api/newsletter/subscribe.js')), /resolution=merge-duplicates/);
});

await test('an invalid email is rejected before any write', async () => {
  const seen = installFetch();
  const res = mockRes();
  await subscribeHandler({ method: 'POST', headers: {}, body: { email: 'not-an-email' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(seen.inserts.length, 0, 'nothing may be written');
  assert.notEqual(res.body.subscribed, true);
});

await test('a database failure does NOT report success', async () => {
  installFetch({ insertStatus: 500, insertBody: { message: 'boom' } });
  const res = mockRes();
  await subscribeHandler({ method: 'POST', headers: {}, body: { email: 'a@b.com' } }, res);
  assert.notEqual(res.statusCode, 200);
  assert.notEqual(res.body?.subscribed, true, 'this is the exact bug being fixed');
});

await test('migration 0020 enforces the API contract in the database too', () => {
  const sql = sqlCode(read('../supabase/migrations/0020_newsletter_subscribers.sql'));
  // The API normalises; the DB must not merely trust that.
  assert.match(sql, /check \(email = lower\(btrim\(email\)\)\)/);
  assert.match(sql, /check \(length\(email\) between 3 and 254\)/);
  assert.match(sql, /check \(source is null or length\(source\) <= 64\)/);
  assert.match(sql, /check \(status in \('subscribed', 'unsubscribed'\)\)/);
  // Plain column index, so PostgREST can infer the ON CONFLICT target.
  assert.match(sql, /create unique index if not exists newsletter_subscribers_email_uniq\s*\n?\s*on public\.newsletter_subscribers \(email\)/);
  assert.doesNotMatch(sql, /unique index[^;]*lower\(email\)/, 'an expression index would break merge-duplicates');
});

await test('migration 0020 locks the table away from the browser', () => {
  const sql = sqlCode(read('../supabase/migrations/0020_newsletter_subscribers.sql'));
  assert.match(sql, /alter table public\.newsletter_subscribers enable row level security/);
  // Exactly one policy, SELECT, admin-gated. No anon/authenticated grant.
  const policies = [...sql.matchAll(/create policy "([^"]+)"[\s\S]*?using \(([^)]*\))/g)];
  assert.equal(policies.length, 1, 'exactly one policy expected');
  assert.match(policies[0][0], /for select/);
  assert.match(policies[0][2], /is_sora_admin/);
  assert.doesNotMatch(sql, /to anon|to authenticated|for insert|for update|for delete/);
});

await test('migration 0020 is additive and depends on nothing from 0018/0019', () => {
  const sql = sqlCode(read('../supabase/migrations/0020_newsletter_subscribers.sql'));
  assert.doesNotMatch(sql, /\b(drop table|truncate|delete from|alter column)\b/i);
  assert.doesNotMatch(sql, /idempotency_key|site_settings|free_shipping|\borders\b/i);
  // Re-runnable.
  assert.match(sql, /create table if not exists/);
  assert.match(sql, /create unique index if not exists/);
  assert.match(sql, /drop policy if exists/);
});

await test('the route is rate limited like other unauthenticated writes', () => {
  assert.match(code(read('../api/newsletter/subscribe.js')), /enforceRateLimit\(req, res, \{ name: 'newsletter'/);
});

await test('the invented discount and welcome-code claims are gone', () => {
  assert.doesNotMatch(code(newsletter), /10%|welcome code|first order/i);
});

await test('the form no longer fakes success from local state alone', () => {
  const c = code(newsletter);
  assert.match(c, /\/api\/newsletter\/subscribe/);
  // setDone must be reachable only after the server confirms.
  assert.match(c, /if \(!res\.ok \|\| !data\?\.subscribed\)[\s\S]{0,200}return;[\s\S]{0,80}setDone\(true\)/);
});

// ============================================================
console.log('\n— Social sign-in —');
// ============================================================

await test('no provider is enabled by default', () => {
  assert.deepEqual(parseEnabledProviders(''), []);
  assert.deepEqual(parseEnabledProviders(undefined), []);
  assert.deepEqual(parseEnabledProviders('   '), []);
});

await test('Google and Apple are independent', () => {
  assert.deepEqual(parseEnabledProviders('google'), ['google']);
  assert.deepEqual(parseEnabledProviders('apple'), ['apple']);
  assert.deepEqual(parseEnabledProviders('google,apple'), ['google', 'apple']);
});

await test('unknown or malformed provider names are ignored', () => {
  assert.deepEqual(parseEnabledProviders('facebook'), []);
  assert.deepEqual(parseEnabledProviders('google,facebook,,'), ['google']);
  assert.deepEqual(parseEnabledProviders('GOOGLE , Apple'), ['google', 'apple']);
  assert.deepEqual(parseEnabledProviders('google,google'), ['google'], 'no duplicate buttons');
});

await test('every supported provider has a label', () => {
  for (const p of SUPPORTED_PROVIDERS) assert.ok(PROVIDER_LABELS[p], `missing label for ${p}`);
});

await test('an unconfigured provider cannot start a sign-in flow', () => {
  const oauth = read('../src/lib/oauth.js');
  assert.match(code(oauth), /if \(!enabledOAuthProviders\(\)\.includes\(provider\)\)/);
});

await test('no permanently-disabled "coming soon" social button remains', () => {
  assert.doesNotMatch(code(account), /disabled title="Coming soon"/);
  assert.doesNotMatch(code(account), /Coming soon/i);
  // Buttons are rendered from the allowlist, not hardcoded.
  assert.match(code(account), /socialProviders\.map/);
  assert.match(code(account), /socialProviders\.length > 0/);
});

// ============================================================
console.log('\n— Footer: no dead links, no invented claims —');
// ============================================================

await test('no dead href="#" anywhere in the footer', () => {
  assert.doesNotMatch(code(footer), /href="#"/);
});

await test('the demo-storefront disclaimer is gone', () => {
  assert.doesNotMatch(code(footer), /demo storefront|placeholder products|design preview/i);
});

await test('unsupported product and delivery claims are gone', () => {
  for (const claim of [
    /dermatologist/i, /lab tested/i, /carbon-neutral/i, /cruelty-free/i,
    /15-day returns/i, /clean,? transparent formulas/i, /sustainability/i,
    /clean ingredients/i,
  ]) {
    assert.doesNotMatch(code(footer), claim, `unsupported claim still present: ${claim}`);
  }
});

await test('legacy placeholder links stay gone while real company routes are linked', () => {
  for (const link of [/\bJournal\b/, /\bCookies\b/, /href=["']#/i]) {
    assert.doesNotMatch(code(footer), link, `placeholder link still present: ${link}`);
  }
  for (const path of ['/about', '/contact', '/privacy', '/terms', '/shipping', '/returns']) {
    assert.match(code(footer), new RegExp(`to=["']${path.replace('/', '\\/')}["']`));
  }
});

await test('social links render only from validated configured accounts', () => {
  const c = code(footer);
  assert.match(c, /socials\.length > 0/);
  assert.match(c, /href=\{social\.url\}/);
  assert.match(c, /socials\.map/);
  assert.doesNotMatch(c, /href=["']https:\/\/(instagram|facebook|x|twitter)\./i);
});

await test('remaining footer links all point at real in-app routes', () => {
  const targets = [...code(footer).matchAll(/to=[`"]([^`"{]+)[`"]/g)].map((m) => m[1]);
  const known = [
    '/shop', '/account', '/account/orders', '/wishlist', '/account/creator',
    '/about', '/contact', '/privacy', '/terms', '/shipping', '/returns', '/admin/login',
  ];
  for (const t of targets) {
    const ok = known.includes(t) || t.startsWith('/category/');
    assert.ok(ok, `unknown footer route: ${t}`);
  }
  assert.ok(targets.length >= 5, 'the footer should still carry its real navigation');
});

await test('the contact row only renders from sanitized configured details', () => {
  const c = code(footer);
  assert.match(c, /const info = companyInfo\(\)/);
  assert.match(c, /\{\(info\.email \|\| info\.phone\) && \(/);
  assert.match(c, /mailto:\$\{info\.email\}/);
  assert.match(c, /telHref\(info\.phone\)/);
});

await test('the footer trust row states only operational facts', () => {
  assert.match(code(footer), /Secure checkout/);
  assert.match(code(footer), /Free standard shipping/);
  assert.match(code(footer), /Order tracking/);
});

// ============================================================
console.log('\n— Creator earnings / payouts surfaced —');
// ============================================================

await test('the stale "future release" notice is gone', () => {
  assert.doesNotMatch(code(creatorPortal), /future release/i);
  assert.doesNotMatch(code(creatorPortal), /will be available in a/i);
});

await test('the portal points creators at the real earnings and payout surfaces', () => {
  assert.match(code(creatorPortal), /to="\/creator\/earnings"/);
  assert.match(code(creatorPortal), /to="\/creator\/payouts"/);
});

await test('the attributed-sales-vs-commission distinction is kept', () => {
  // Removing the stale sentence must not remove the honest one alongside it.
  assert.match(code(creatorPortal), /attributed\s+sales, not commission/i);
});

await test('earnings and payouts still come from the server, never the client', () => {
  const api = read('../src/lib/creatorApi.js');
  assert.match(code(api), /supabase\.rpc\('my_creator_earnings'\)/);
  assert.match(code(api), /supabase\.rpc\('request_payout'/);
  assert.doesNotMatch(code(creatorPortal), /commission\s*=\s*[\d.]/, 'no client-computed money');
});

await test('payouts remain admin-approved with no automatic transfer', () => {
  const api = read('../src/lib/creatorApi.js');
  assert.match(code(api), /admin_review_payout/);
  assert.match(code(api), /admin_mark_payout_paid/);
  // No payment-provider payout call anywhere in the client.
  assert.doesNotMatch(code(api), /razorpayx|fund_account|payout_link|transfers/i);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
