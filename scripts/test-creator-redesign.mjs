// ============================================================
// Creator Program redesign — visual/UX regression suite.
//
// A visual pass is exactly where fake data and dead buttons creep in, so
// this suite is mostly about what must NOT be there: invented numbers,
// hardcoded business values, stale claims, and controls that do nothing.
//
// NO NETWORK, NO SECRETS, NO DATABASE.
//
// Run: node scripts/test-creator-redesign.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const js = (src) => src.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const portal = read('../src/pages/CreatorPortal.jsx');
const onboarding = read('../src/pages/account/CreatorOnboarding.jsx');
const ui = read('../src/components/creator/CreatorUI.jsx');
const earnings = read('../src/components/creator/CreatorEarnings.jsx');
const payouts = read('../src/components/creator/CreatorPayouts.jsx');
const hiw = read('../src/components/creator/CreatorHowItWorks.jsx');
const css = read('../src/styles/creator-expressive.css');
const indexHtml = read('../index.html');

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

const ALL_CREATOR_SOURCES = { portal, onboarding, ui, earnings, payouts, hiw };

// ============================================================
console.log('\n— Stale copy is gone —');
// ============================================================

await test('nothing claims earnings or payouts are unavailable', () => {
  // Both were live before this pass; the copy simply had not caught up.
  for (const [name, src] of Object.entries(ALL_CREATOR_SOURCES)) {
    for (const claim of [
      /aren.t part of this release/i,
      /aren.t available yet/i,
      /not part of this release/i,
      /arrive in a later release/i,
      /earnings and payouts will be available/i,
      /coming soon/i,
    ]) {
      assert.doesNotMatch(js(src), claim, `${name} still carries: ${claim}`);
    }
  }
});

await test('the account entry points at the live earnings and payout surfaces', () => {
  const c = js(onboarding);
  assert.match(c, /Earnings and payouts are live/);
  assert.match(c, /to="\/creator\/earnings"/);
  assert.match(c, /to="\/creator\/payouts"/);
});

// ============================================================
console.log('\n— No fabricated data —');
// ============================================================

await test('no invented metrics anywhere in the creator UI', () => {
  for (const [name, src] of Object.entries(ALL_CREATOR_SOURCES)) {
    const c = js(src);
    assert.doesNotMatch(c, /Math\.random|mockData|sampleData|fakeData|dummyData|placeholderStats/,
      `${name} generates data`);
  }
});

await test('no hardcoded commission rate, hold window, or payout minimum', () => {
  // Every business figure must come from live config. A literal here would
  // silently disagree with the database the moment an admin changes it.
  for (const [name, src] of Object.entries({ portal, hiw, earnings })) {
    const c = js(src);
    assert.doesNotMatch(c, /\b(?:5|10|12|15|20|25|30)\s*%/, `${name} hardcodes a percentage`);
    assert.doesNotMatch(c, /₹\s*\d/, `${name} hardcodes a rupee figure`);
  }
});

await test('dashboard figures read from real loaded state only', () => {
  const c = js(portal);
  for (const src of ['analytics?.clicks', 'analytics?.attributed_orders', 'analytics?.products_sold',
                     'earnings?.available', 'earnings?.held', 'earnings?.reserved', 'earnings?.paid',
                     'kyc?.identity_status']) {
    assert.ok(c.includes(src), `dashboard must read ${src}`);
  }
});

await test('copy helpers fall back to claim-free wording when config is missing', () => {
  const c = js(portal);
  assert.match(c, /const payoutHint =/);
  assert.match(c, /once your available balance reaches the minimum/,
    'must degrade instead of inventing a minimum');
  assert.match(c, /Clears once each sale passes the settlement hold/,
    'must degrade instead of inventing a hold period');
});

await test('no unsupported earning promises', () => {
  for (const [name, src] of Object.entries(ALL_CREATOR_SOURCES)) {
    assert.doesNotMatch(js(src), /guaranteed|passive income|earn up to|unlimited earnings|instant payout/i,
      `${name} over-promises`);
  }
});

// ============================================================
console.log('\n— Shared primitives —');
// ============================================================

await test('CreatorUI exports the shared primitives the portal composes from', () => {
  for (const c of ['Section', 'Empty', 'Pill', 'Step', 'Band', 'Cell', 'Balance', 'IdBar']) {
    assert.match(ui, new RegExp(`export function ${c}\\(`), `missing ${c}`);
  }
});

await test('tone is a closed set, and anything unknown falls back to neutral', () => {
  const c = js(ui);
  assert.match(c, /export const TONES = \['ok', 'hold', 'info', 'brand', 'bad', 'neutral'\]/);
  assert.match(c, /TONES\.includes\(tone\) \? tone : 'neutral'/);
});

await test('the old one-off Bucket component was removed, not left dead', () => {
  assert.doesNotMatch(js(earnings), /function Bucket\(/);
  assert.doesNotMatch(js(earnings), /<Bucket/);
});

await test('the portal actually uses the shared primitives', () => {
  const c = js(portal);
  assert.match(c, /import \{ Section, Empty, Pill, Step, Band, Cell, Balance, IdBar \} from/);
  for (const el of ['<Section', '<Empty', '<Step', '<Band', '<Cell', '<Balance', '<IdBar']) {
    assert.ok(c.includes(el), `portal should use ${el}`);
  }
});

// ============================================================
console.log('\n— Design system —');
// ============================================================

await test('the expressive layer is scoped and cannot leak to the storefront', () => {
  // Tokens are declared only under .crp/.crob, never on :root.
  assert.match(css, /^\.crp, \.crob \{/m);
  assert.doesNotMatch(css, /^:root/m, 'no global token declarations');
  assert.doesNotMatch(css, /^(body|html)\s*\{/m, 'must not restyle the document');
});

await test('all five meanings have a tone class', () => {
  for (const t of ['ok', 'hold', 'info', 'brand', 'bad', 'neutral']) {
    assert.match(css, new RegExp(`\\.ck-tone-${t}\\s`), `missing .ck-tone-${t}`);
  }
});

await test('the stylesheet is loaded after creator.css so it layers', () => {
  const base = indexHtml.indexOf('styles/creator.css');
  const layer = indexHtml.indexOf('styles/creator-expressive.css');
  assert.ok(base > -1 && layer > -1, 'both stylesheets must be linked');
  assert.ok(layer > base, 'the expressive layer must load second');
});

await test('cards, empty states and share surfaces all exist', () => {
  for (const cls of ['.ck-band', '.ck-empty', '.ck-share', '.ck-steps', '.ck-pill', '.ck-idcard']) {
    assert.match(css, new RegExp(cls.replace('.', '\\.') + '\\s*[,{]'), `missing ${cls}`);
  }
});

await test('mobile header removes only the crowded username and keeps a real logout target', () => {
  const mobile = css.match(/@media \(max-width: 719px\) \{[\s\S]*?\n\}/);
  assert.ok(mobile, 'mobile Creator breakpoint missing');
  assert.match(mobile[0], /\.crp \.crp__who \{ display: none; \}/);
  assert.match(mobile[0], /\.crp \.crp__top-right \.btn \{ padding-inline: 13px; \}/);
  assert.match(portal, />Log out<\/button>/);
  assert.match(css, /\.crp \.crp__top-right \.btn \{ min-height: 44px; \}/);
});

await test('mobile navigation cue is separate from the scroll rail and never a gradient or button', () => {
  assert.match(portal, /className="crp__nav-wrap"/);
  assert.match(portal, /className="crp__nav-cue" aria-hidden="true">›<\/span>/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 26px/);
  assert.match(css, /flex: 0 0 auto/);
  assert.match(css, /padding-inline-end: 26px; scroll-padding-inline-end: 26px/);
  assert.match(portal, /navRef\?\.current|navRef\.current/);
  assert.match(portal, /itemRight - nav\.clientWidth \+ inset/);
  const cue = css.match(/\.crp \.crp__nav-cue \{[\s\S]*?\n  \}/);
  assert.ok(cue, 'mobile continuation cue styling missing');
  assert.doesNotMatch(cue[0], /gradient|position:\s*(absolute|fixed)|border-radius/);
  assert.match(cue[0], /pointer-events: none/);
});

await test('campaign and analytics empty states carry factual editorial labels and ruled rows', () => {
  assert.match(ui, /ck-empty__eyebrow/);
  assert.match(portal, /eyebrow="Campaign status"/);
  assert.match(portal, /eyebrow="Analytics status"/);
  assert.match(css, /\.ck-empty__eyebrow \{/);
  assert.match(css, /border-top: 2px solid var\(--c-rule-2\)/);
  assert.match(css, /\.ck-empty__points li \{[\s\S]*?border-top: 1px solid var\(--c-rule\)/);
});

await test('earnings terms use one ruled financial composition instead of another card grid', () => {
  assert.match(css, /\.crp \.crp__earn-grid \{[\s\S]*?border-top: 1px solid var\(--c-ink\)/);
  assert.match(css, /\.crp \.crp__earn-grid > \.crp__panel \{[\s\S]*?border: 0; border-radius: 0; background: transparent/);
  assert.match(earnings, /<Balance[\s\S]*label="Held"[\s\S]*label="Paid out"[\s\S]*label="Reversed"/);
});

await test('motion is disabled for reduced-motion users', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

await test('mobile uses compact two-column bands without orphaned three-cell rows', () => {
  const base = css.match(/\.ck-band \{[^}]*\}/);
  assert.ok(base, '.ck-band base rule missing');
  assert.match(base[0], /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    'mobile bands must start as two equal columns');
  assert.match(css, /\.ck-band--3 \.ck-band__cell:last-child:nth-child\(odd\)[^{]*\{[^}]*grid-column:\s*1 \/ -1/,
    'the final cell in a three-cell mobile band must span the full row');
  assert.match(css, /@media \(min-width: 720px\)/);
  assert.match(css, /@media \(min-width: 1020px\)/);
  // Long URLs and codes must wrap rather than force a sideways scroll.
  assert.match(css, /overflow-wrap: anywhere/);
});

// ============================================================
console.log('\n— No dead controls —');
// ============================================================

await test('every empty-state action goes somewhere real', () => {
  const c = js(portal);
  const routes = [...c.matchAll(/<Link to="([^"]+)"/g)].map((m) => m[1]);
  // '/account' is the sign-in / back-to-account route the portal uses when
  // there is no session or no creator record.
  const known = ['/creator', '/creator/links', '/creator/campaigns', '/creator/analytics',
                 '/creator/earnings', '/creator/payouts', '/creator/how-it-works', '/creator/profile',
                 '/account', '/shop', '/'];
  for (const r of routes) {
    assert.ok(known.includes(r) || r.startsWith('/creator/'), `unknown creator route: ${r}`);
  }
});

await test('no href="#" or no-op click handlers were introduced', () => {
  for (const [name, src] of Object.entries(ALL_CREATOR_SOURCES)) {
    assert.doesNotMatch(js(src), /href="#"/, `${name} has a dead link`);
    assert.doesNotMatch(js(src), /onClick=\{\(\) => \{\}\}/, `${name} has a dead button`);
  }
});

await test('creators are not offered controls the backend refuses', () => {
  // creator_partners is admin-write only, so an editable rate or status
  // field on the profile would be a control that always fails.
  const profile = js(portal).slice(js(portal).indexOf("tab === 'profile'"));
  assert.doesNotMatch(profile.slice(0, 2500), /<input|<textarea|<select/,
    'profile must stay read-only');
});

// ============================================================
console.log('\n— Financial and auth behaviour untouched —');
// ============================================================

await test('payout settlement wiring is unchanged', () => {
  const c = js(payouts);
  assert.match(c, /onRequestPayout|requestPayout/);
  // The redesign must not have introduced a client-side amount.
  assert.doesNotMatch(c, /paid_amount\s*[:=]\s*\d/, 'no client-chosen settlement amount');
});

await test('no creator source references payment, order or auth internals', () => {
  for (const [name, src] of Object.entries(ALL_CREATOR_SOURCES)) {
    assert.doesNotMatch(js(src), /razorpay|payment_transactions|signInWithOAuth|updateUser\(/i,
      `${name} touches an unrelated system`);
  }
});

await test('no service-role key anywhere in creator UI', () => {
  for (const [name, src] of Object.entries(ALL_CREATOR_SOURCES)) {
    assert.doesNotMatch(src, /SERVICE_ROLE|service_role|serviceKey/, `${name} references the service role`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
