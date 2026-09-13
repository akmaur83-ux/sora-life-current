// ============================================================
// My Profile — the studio page. Offline suite.
//
// The page rendered with react-dom/server for the mockup's account (Vikas,
// Rise L1, pending KYC) and a verified Royale account, plus the pure
// standing matrix and the sheet's rules. Every figure on the page must
// trace to a live record: the rate from the tier standing, the window and
// dates from the creator row, the payouts card from withdrawals_open.
// NO NETWORK, NO DATABASE.
//
//   node scripts/test-creator-profile-page.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const read = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function component(rel, name, deps = {}) {
  const { code } = transformSync(read(rel), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExportNamedDeclaration(path) { path.node.declaration ? path.replaceWith(path.node.declaration) : path.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${code}\n; return ${name};`)(...Object.values(scope));
}
const h = React.createElement;
const Link = ({ to, children, ...props }) => h('a', { href: to, ...props }, children);
const Icon = ({ name }) => h('span', { 'data-icon': name });
const CopyButton = ({ value, className, label }) => h('button', { type: 'button', className, 'data-copy': value }, label);
const CreatorTermsPanel = ({ terms }) => h('div', { className: 'ck-terms', 'data-version': terms?.version });
const TermsUpdatedLine = ({ terms }) => h('p', { className: 'ck-terms__updated' }, `v${terms?.version}`);
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const css = read('src/styles/creator-dashboard.css').replace(/\/\*[\s\S]*?\*\//g, '');
const source = read('src/components/creator/CreatorProfilePage.jsx');

const RankMedallion = component('src/components/creator/CreatorTierPage.jsx', 'RankMedallion', { Link, Icon, ...tiers });
const deps = { Link, Icon, CopyButton, CreatorTermsPanel, TermsUpdatedLine, RankMedallion, rankSlot: tiers.rankSlot };
const CreatorProfilePage = component('src/components/creator/CreatorProfilePage.jsx', 'CreatorProfilePage', deps);
const standingFor = component('src/components/creator/CreatorProfilePage.jsx', 'standingFor', deps);
const initialsOf = component('src/components/creator/CreatorProfilePage.jsx', 'initialsOf', deps);

const vikas = {
  id: 'c1', display_name: 'Vikas Shamra', email: 'vikas@example.com', creator_code: 'VIKAS', status: 'active',
  default_commission_rate: 10, default_attribution_window_days: 30, joined_at: '2026-09-12T09:00:00+05:30', created_at: '2026-09-12T08:30:00+05:30',
};
const rise = { ok: true, level: 1, rank: 'Rise', rate: 10, withdrawals_open: false };
const royale = { ok: true, level: 7, rank: 'Royale', rate: 16, withdrawals_open: true };
const render = (props) => renderToStaticMarkup(h(CreatorProfilePage, props));

// ============================================================
console.log('\n— Live data only —');
// ============================================================

await test('the commission rate is the tier standing\'s, not the creator row\'s default', () => {
  // Royale pays 16% on the ladder while the row still says 10: the page must
  // quote the tier system, because that is what the ledger pays.
  const html = render({ creator: vikas, standing: royale, kyc: { identity_status: 'verified' } });
  assert.match(html, /<div class="cp-term__fig serif">16%<\/div>/);
  assert.match(text(html), /You earn 16% commission on eligible sales\. Royale · Level 7\./);
  assert.doesNotMatch(html, /10%/);
  // Without a standing (the RPC has not answered) the row's default is the fallback.
  assert.match(render({ creator: vikas, standing: null }), /<div class="cp-term__fig serif">10%<\/div>/);
  // No figure at all → a dash and a sentence that makes no claim.
  const blank = render({ creator: { ...vikas, default_commission_rate: null }, standing: null });
  assert.match(blank, /<div class="cp-term__fig serif">—<\/div>/);
  assert.match(text(blank), /Your commission rate is set by your tier\./);
  assert.doesNotMatch(source, /\b(?:5|10|12|15|20|25|30)\s*%/, 'no percentage literal in the page');
});

await test('window, join date, email and code come from the creator record', () => {
  const html = render({ creator: vikas, standing: rise });
  assert.match(html, /<div class="cp-term__fig serif">30 days<\/div>/);
  assert.match(text(html), /attributed to you for 30 days after someone clicks your link/);
  assert.match(html, /<div class="cp-term__fig serif">12 Sept 2026<\/div>/, 'joined_at is the join date');
  assert.match(text(html), /part of SORA LIFE since 12 Sept 2026/);
  assert.match(html, /<p class="cp-id__email">vikas@example\.com<\/p>/);
  assert.match(html, /<code class="cp-id__code">VIKAS<\/code>/);
  assert.match(html, /data-copy="VIKAS"/, 'the copy button copies the code as stored');
  assert.match(html, /<h2 class="cp-id__name serif">Vikas Shamra<\/h2>/);
  assert.match(html, /<span class="cp-id__avatar" aria-hidden="true">VS<\/span>/);
  // joined_at missing → created_at; both missing → no claim.
  assert.match(render({ creator: { ...vikas, joined_at: null }, standing: rise }), /cp-term__fig serif">12 Sept 2026</);
  const nodate = render({ creator: { ...vikas, joined_at: null, created_at: null }, standing: rise });
  assert.match(nodate, /cp-term__fig serif">—</);
  assert.match(text(nodate), /Your join date will appear once your account is activated\./);
});

await test('status pill and rank badge read the record and the standing', () => {
  const html = render({ creator: vikas, standing: rise });
  assert.match(html, /<span class="cp-pill is-ok"><i aria-hidden="true"><\/i>Active<\/span>/);
  assert.match(html, /<div class="cp" data-rank="rise">/);
  assert.match(html, /<span class="cp-id__badge">/, 'the medallion overlaps the avatar');
  assert.match(render({ creator: { ...vikas, status: 'pending' }, standing: rise }), /cp-pill is-hold"><i aria-hidden="true"><\/i>Pending</);
  assert.match(render({ creator: { ...vikas, status: 'suspended' }, standing: rise }), /cp-pill is-bad"><i aria-hidden="true"><\/i>Suspended</);
  const none = render({ creator: vikas, standing: null });
  assert.doesNotMatch(none, /cp-id__badge/, 'no rank → no badge, not a placeholder');
  assert.match(none, /data-rank="neutral"/);
  assert.equal(initialsOf('Vikas Shamra'), 'VS'); assert.equal(initialsOf('priya'), 'P'); assert.equal(initialsOf(''), '?');
});

await test('account standing is the status + KYC matrix, in words', () => {
  assert.deepEqual(standingFor({ status: 'active' }, { identity_status: 'verified' }).title, 'Profile verified');
  assert.equal(standingFor({ status: 'active' }, { identity_status: 'not_started' }).title, 'Account active');
  assert.equal(standingFor({ status: 'active' }, null).tone, 'ok');
  assert.equal(standingFor({ status: 'pending' }, null).title, 'Awaiting activation');
  assert.equal(standingFor({ status: 'paused' }, null).tone, 'hold');
  assert.equal(standingFor({ status: 'suspended' }, null).tone, 'bad');
  assert.equal(standingFor({ status: 'archived' }, null).tone, 'neutral');
  assert.equal(standingFor(null, null).title, 'Awaiting activation', 'no record reads as pending, never verified');
  const html = render({ creator: vikas, standing: rise, kyc: { identity_status: 'verified' } });
  assert.match(html, /<div class="cp-standing__half" data-tone="ok">/);
  assert.match(html, /<h3 class="cp-standing__h serif">Profile verified<\/h3>/);
  assert.match(text(html), /Your account is active and in good standing/);
});

await test('the payouts card reflects withdrawals_open, and only that', () => {
  const closed = render({ creator: vikas, standing: rise, kyc: { identity_status: 'verified' } });
  assert.match(closed, /data-withdrawals="closed"/);
  assert.match(closed, /<h3 class="cp-standing__h serif">Payouts currently closed<\/h3>/);
  assert.match(text(closed), /Payouts will be available after tax registration completes\. Your commission keeps accruing\./);
  assert.match(closed, /<a href="\/creator\/payouts" class="cp-btn is-ghost">Learn more/);
  const open = render({ creator: vikas, standing: royale, kyc: { identity_status: 'verified' } });
  assert.match(open, /data-withdrawals="open"/);
  assert.match(open, /<h3 class="cp-standing__h serif">Payouts open<\/h3>/);
  assert.match(open, /<a href="\/creator\/payouts" class="cp-btn is-ghost">Go to payouts/);
  // A verified KYC does not open payouts on its own.
  assert.match(render({ creator: vikas, standing: { ...royale, withdrawals_open: false }, kyc: { identity_status: 'verified' } }), /data-withdrawals="closed"/);
  assert.match(render({ creator: vikas, standing: null }), /data-withdrawals="closed"/, 'no standing → closed, never assumed open');
});

// ============================================================
console.log('\n— Nothing to edit, terms only when published —');
// ============================================================

await test('the page is read-only and says who sets the terms', () => {
  const html = render({ creator: vikas, standing: rise });
  assert.doesNotMatch(html, /<input|<textarea|<select/);
  assert.match(text(html), /Set by SORA LIFE — not editable here\./);
  assert.match(text(html), /Need help\? Your commission rate and status are managed by SORA LIFE\./);
  assert.match(html, /<a href="\/contact" class="cp-btn is-ghost">/);
  assert.doesNotMatch(source, /Math\.random|mockData|sampleData/);
});

await test('the terms block appears only once an admin has published something', () => {
  const terms = { version: 3, body: 'x' };
  assert.doesNotMatch(render({ creator: vikas, standing: rise, terms, termsPublished: false }), /cp-tc/);
  assert.doesNotMatch(render({ creator: vikas, standing: rise, terms: null, termsPublished: true }), /cp-tc/);
  const accepted = render({ creator: vikas, standing: rise, terms, termsPublished: true, termsAccepted: true });
  assert.match(accepted, /<section class="cp-panel cp-tc"/);
  assert.match(accepted, /data-version="3"/);
  assert.match(accepted, /You accepted version 3\./);
  assert.doesNotMatch(accepted, /I accept version/);
  const stale = render({ creator: vikas, standing: rise, terms, termsPublished: true, termsAccepted: false, onAcceptTerms: () => {} });
  assert.match(stale, /<button type="button" class="btn btn-sm">I accept version 3<\/button>/);
  const busy = render({ creator: vikas, standing: rise, terms, termsPublished: true, termsAccepted: false, acceptingTerms: true });
  assert.match(busy, /<button type="button" class="btn btn-sm" disabled="">Recording…<\/button>/);
});

// ============================================================
console.log('\n— The sheet —');
// ============================================================

await test('the profile styles live in the studio sheet, scoped, on the studio tokens', () => {
  const block = css.slice(css.indexOf('.crp.crp--studio .cp {'), css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(block.length > 3000, 'profile block present before the reduced-motion rules');
  for (const cls of ['.cp-id', '.cp-id__avatar', '.cp-id__badge', '.cp-terms', '.cp-term', '.cp-standing', '.cp-standing__half', '.cp-help', '.cp-leaf--tr', '.cp-script', '.cp-caps']) {
    assert.match(block, new RegExp('\\.crp\\.crp--studio ' + cls.replace(/[.]/g, '\\.') + '\\s*[,{]'), `${cls} must be scoped to the studio`);
  }
  assert.match(block, /\.cp-terms \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, 'three term cards across');
  assert.match(block, /\.cp-standing \{[^}]*grid-template-columns: minmax\(0, 1\.2fr\) minmax\(0, 1fr\)/, 'standing and payouts split one card');
  assert.match(block, /\.cp-id__avatar \{[^}]*background: var\(--s-forest\)/);
  assert.match(block, /\.cp-rule \{[^}]*background: var\(--s-gold\)/);
  assert.doesNotMatch(block, /violet|purple|#6437FF|#4A24CC/i, 'no violet');
});

await test('only transform and opacity ever animate; reduced motion stills the hover lift', () => {
  const block = css.slice(css.indexOf('.crp.crp--studio .cp {'), css.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const m of block.matchAll(/transition:\s*([^;]+);/g)) {
    for (const part of m[1].split(',')) {
      assert.match(part.trim(), /^(?:transform|opacity)\b/, `transition on ${part.trim()}`);
    }
  }
  assert.doesNotMatch(block, /@keyframes|animation:/, 'the profile page has no keyframes of its own');
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  const stilled = rm.slice(0, rm.indexOf('\n}')).match(/^[^\n]*\{ transform: none; \}/m)?.[0] || '';
  for (const sel of ['.crp.crp--studio .cp-copy:hover', '.crp.crp--studio .cp-btn:hover']) assert.ok(stilled.includes(sel), `${sel} stilled under reduced motion`);
});

await test('390px is designed, not squeezed: header stacks, caps line goes, cards go one-up, aside goes', () => {
  const m1019 = [...css.matchAll(/@media \(max-width: 1019px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  const m599 = [...css.matchAll(/@media \(max-width: 599px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(m1019, /\.cp-head \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m1019, /\.cp-caps \{ display: none; \}/);
  assert.match(m1019, /\.cp-terms \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m1019, /\.cp-standing \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m1019, /\.cp-id__aside \{ grid-column: 1 \/ -1;/);
  assert.match(m599, /\.cp-id \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(m599, /\.cp-id__aside \{ display: none; \}/);
  assert.match(m599, /\.cp-help \{ grid-template-columns: auto minmax\(0, 1fr\); \}/);
  assert.match(m599, /\.cp-standing__half \.cp-btn \{ grid-column: 2; justify-self: start; \}/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
