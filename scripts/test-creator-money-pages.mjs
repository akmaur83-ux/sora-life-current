// ============================================================
// My earnings, My tracking links, My campaigns — the studio pages. Offline.
//
// The earnings rules (terms resolve tier → RPC floor → creator row, the
// monthly history bars, the ledger buckets), the link cards (every URL from
// buildTrackingUrl), the campaign cards (override rate only when set), and
// each page rendered with react-dom/server for a busy account and an empty
// one. NO NETWORK, NO DATABASE.
//
//   node scripts/test-creator-money-pages.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';
import * as seriesRules from '../src/lib/creatorSeries.js';
import * as activityRules from '../src/lib/creatorActivity.js';
import * as rewardRules from '../src/lib/creatorRewards.js';
import { money2 } from '../src/lib/format.js';

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
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const css = read('src/styles/creator-dashboard.css').replace(/\/\*[\s\S]*?\*\//g, '');

const UI = {};
for (const n of ['CountUp', 'Sparkline']) UI[n] = component('src/components/creator/CreatorUI.jsx', n, { Icon, sparkGeometry: seriesRules.sparkGeometry });
const dashDeps = { Link, Icon, CountUp: UI.CountUp, Sparkline: UI.Sparkline, money2, ...tiers, ...seriesRules, ...activityRules };
const StatCard = component('src/components/creator/CreatorDashboard.jsx', 'StatCard', dashDeps);
const WithdrawalsBar = component('src/components/creator/CreatorTierPage.jsx', 'WithdrawalsBar', { Link, Icon, CountUp: UI.CountUp, money2, ...tiers, ...rewardRules, ...seriesRules });
const earnDeps = { Link, Icon, StatCard, WithdrawalsBar, CountUp: UI.CountUp, Sparkline: UI.Sparkline, money2, ...seriesRules };
const E = {};
for (const n of ['CreatorEarningsPage', 'earningsTerms', 'historyBars', 'ordinal', 'monthLabel']) E[n] = component('src/components/creator/CreatorEarningsPage.jsx', n, earnDeps);
const L = {};
for (const n of ['CreatorLinksPage', 'destinationLabel', 'LinkCard']) L[n] = component('src/components/creator/CreatorLinksPage.jsx', n, { Link, Icon, CopyButton });
const C = {};
for (const n of ['CreatorCampaignsPage', 'campaignWindow', 'CAMPAIGN_STATUS']) C[n] = component('src/components/creator/CreatorCampaignsPage.jsx', n, { Link, Icon, CopyButton });

// ---- fixtures ----
const creator = { id: 'c1', display_name: 'Aarav Sethi', creator_code: 'AARAV', default_commission_rate: 10, default_attribution_window_days: 30 };
const earnings = {
  ok: true, available: 12640.5, held: 1542.4, reserved: 0, paid: 6548.1, reversed: 0, commission_rate: 10, settlement_hold_days: 7, min_payout: 500, payout_day: 1,
  this_month: { orders: 14, products_sold: 31, attributed_sales: 24180, commission_earned: 3868.8 },
  top_products: [{ name: 'Cold-pressed Amla Juice', variant: '500 ml', qty: 12, sales: 5388, commission: 862.08 }, { name: 'Black Seed Oil', variant: '100 ml', qty: 8, sales: 4792, commission: 766.72 }],
  monthly_history: [{ month: '2026-09', commission: 3868.8 }, { month: '2026-07', commission: 4120.5 }, { month: '2026-08', commission: 6210.75 }],
};
const emptyEarnings = { ok: true, available: 0, held: 0, reserved: 0, paid: 0, reversed: 0, commission_rate: 10, settlement_hold_days: 7, min_payout: 500, payout_day: 1, this_month: {}, top_products: [], monthly_history: [] };
const royale = { ok: true, level: 7, rank: 'Royale', rate: 16, withdrawals_open: false };
const WEEKS = Array.from({ length: 13 }, (_, i) => `2026-0${6 + Math.floor((15 + i * 7) / 31)}-${String(((15 + i * 7) % 31) || 1).padStart(2, '0')}`);
const weekly = seriesRules.rangeSeries({ ok: true, range: '90d', unit: 'week', series: WEEKS.map((at, i) => ({ at, clicks: 0, orders: 0, products: 0, sales: 0, commission: [120, 300, 500, 800, 1100, 700, 1500, 1800, 1300, 2000, 1600, 1100, 400][i] })), previous: null }, '90d');
const noWeekly = seriesRules.rangeSeries(null, '90d');
const links = [
  { id: 'l1', public_code: 'AARAV', campaign_id: null, destination_type: 'home', destination_path: '/', status: 'active', created_at: '2026-03-02T00:00:00Z' },
  { id: 'l2', public_code: 'DIW7K', campaign_id: 'cp1', destination_type: 'collection', destination_path: '/collections/diwali', status: 'active', created_at: '2026-09-28T00:00:00Z' },
  { id: 'l3', public_code: 'OLD99', campaign_id: 'cp2', destination_type: 'product', destination_path: '/p/moringa', status: 'archived', created_at: '2026-06-15T00:00:00Z' },
];
const campaigns = [
  { id: 'cp1', name: 'Diwali edit', campaign_code: 'DIWALI', status: 'active', commission_rate_override: 18, attribution_window_days: 45, start_at: '2026-10-01', end_at: '2026-11-15', description: 'A festive gifting edit.' },
  { id: 'cp2', name: 'Monsoon immunity', campaign_code: 'MONSOON', status: 'ended', commission_rate_override: null, start_at: '2026-06-15', end_at: '2026-08-31' },
  { id: 'cp3', name: 'Spring launch', campaign_code: 'SPRING', status: 'draft', commission_rate_override: null, start_at: null, end_at: null },
];
const buildUrl = (link, c, camp) => `https://www.soralife.shop${link?.destination_path || '/'}?ref=${c?.creator_code}${camp ? `&campaign=${camp.campaign_code}` : ''}${link?.public_code ? `&trk=${link.public_code}` : ''}`;
const renderE = (props) => renderToStaticMarkup(h(E.CreatorEarningsPage, props));
const renderL = (props) => renderToStaticMarkup(h(L.CreatorLinksPage, props));
const renderC = (props) => renderToStaticMarkup(h(C.CreatorCampaignsPage, props));

// ============================================================
console.log('\n— Earnings rules —');
// ============================================================

await test('terms resolve tier rate → RPC floor → creator row, and read "—" when nothing is configured', () => {
  assert.deepEqual(E.earningsTerms(earnings, royale, creator), { rate: 16, hold: 7, minPayout: 500, payoutDay: 1 });
  assert.equal(E.earningsTerms(earnings, null, creator).rate, 10, 'the RPC floor without a standing');
  assert.equal(E.earningsTerms({}, null, creator).rate, 10, 'the creator row as the last fallback');
  assert.deepEqual(E.earningsTerms({}, null, {}), { rate: null, hold: null, minPayout: null, payoutDay: null });
  assert.equal(E.earningsTerms({ payout_day: 40 }, null, {}).payoutDay, null, 'an impossible payout day is not quoted');
  assert.equal(E.ordinal(1), '1st'); assert.equal(E.ordinal(2), '2nd'); assert.equal(E.ordinal(3), '3rd'); assert.equal(E.ordinal(11), '11th'); assert.equal(E.ordinal(22), '22nd'); assert.equal(E.ordinal(null), '—');
  assert.equal(E.monthLabel('2026-09'), 'Sept 2026'); assert.equal(E.monthLabel(null), '—');
});

await test('monthly history sorts oldest first, scales to the largest month, keeps at most twelve', () => {
  const hist = E.historyBars(earnings.monthly_history);
  assert.deepEqual(hist.rows.map((r) => r.month), ['2026-07', '2026-08', '2026-09']);
  assert.equal(hist.max, 6210.75);
  assert.deepEqual(hist.rows.map((r) => Math.round(r.fraction * 100)), [66, 100, 62]);
  assert.equal(hist.rows[2].label, 'Sept 2026');
  assert.equal(E.historyBars([]).empty, true); assert.equal(E.historyBars(null).empty, true);
  const many = E.historyBars(Array.from({ length: 15 }, (_, i) => ({ month: `2025-${String(i + 1).padStart(2, '0')}`, commission: i })));
  assert.equal(many.rows.length, 12); assert.equal(many.rows[0].month, '2025-04');
  assert.equal(E.historyBars([{ month: '2026-01', commission: -200 }]).rows[0].fraction, 1, 'a reversal month still scales by magnitude');
});

// ============================================================
console.log('\n— Earnings page —');
// ============================================================

await test('a busy account: the hero is Available, then the buckets, this month, terms, weeks, products, history', () => {
  const html = renderE({ creator, earnings, standing: royale, weekly });
  assert.match(html, /<section class="ce-hero" aria-labelledby="ce-hero-h">/);
  assert.match(html, /Available to withdraw[\s\S]*?<span class="ck-cur">₹<\/span><span class="ck-int">12,640<\/span><span class="ck-dec">\.50<\/span>/);
  assert.match(html, /Cleared commission\. A payout request withdraws this full amount\./);
  assert.match(html, /<a href="\/creator\/payouts" class="ce-hero__btn">About payouts/, 'withdrawals closed → no request button, an explainer link');
  assert.match(html, /class="ck-spark ck-tone-brand"/, 'the cumulative sparkline from the history');
  assert.match(html, /data-withdrawals="closed"/, 'the withdrawals bar');
  const cards = html.split('<article class="cd-stat').slice(1);
  assert.equal(cards.length, 4);
  assert.match(cards[0], /Held[\s\S]*?ck-int">1,542<[\s\S]*?<span class="cd-stat__hint">In the 7-day settlement hold\.<\/span>/);
  assert.match(cards[0], /ck-spark/, 'held carries the weekly commission sparkline');
  assert.match(cards[1], /data-tone="ok"[\s\S]*?Paid out[\s\S]*?ck-int">6,548<[\s\S]*?cd-stat__hint">All time\./);
  assert.match(cards[2], /^ is-zero" data-tone="info"[\s\S]*?Reversed/, 'a zero reversal is not red');
  assert.match(cards[3], /This month[\s\S]*?ck-int">3,868<[\s\S]*?Commission earned so far\./);
  assert.doesNotMatch(cards.join(''), /cd-stat__trend/, 'money buckets carry hints, never a trend against nothing');
  assert.match(html, /Commission by week[\s\S]*?Recorded to your ledger, by week\./);
  assert.match(html, /ct-bars__bar is-now"/, 'latest week in gold');
  assert.match(html, /This month[\s\S]*?Attributed orders<\/dt><dd>14<\/dd>[\s\S]*?Commission earned<\/dt><dd class="is-ok">₹3,868\.80<\/dd>/);
  assert.match(html, /Your terms[\s\S]*?<a href="\/creator\/tier" class="cd-panel__link">Royale · L7/);
  assert.match(html, /Commission rate<\/dt><dd class="is-ok">16%<\/dd>/, 'the tier rate, not the 10% floor');
  assert.match(html, /Settlement hold<\/dt><dd>7 days after delivery<\/dd>/);
  assert.match(html, /Minimum payout<\/dt><dd>₹500\.00<\/dd>/);
  assert.match(html, /Payout window<\/dt><dd>1st of each month<\/dd>/);
  assert.match(html, /Product performance[\s\S]*?<strong>Cold-pressed Amla Juice<\/strong><span class="cd-table__sub">500 ml<\/span>[\s\S]*?is-earn">₹862\.08<\/td>/);
  assert.match(html, /Monthly history[\s\S]*?<span class="ce-hist__month">Jul 2026<\/span>[\s\S]*?transform:scaleX\(0\.663\)[\s\S]*?₹4,120\.50/);
  assert.match(html, /ce-hist__row">[\s\S]*?Sept 2026[\s\S]*?scaleX\(0\.623\)/);
  assert.doesNotMatch(html, /10%/, 'the floor rate never shows when a tier rate exists');
  assert.doesNotMatch(html, /<input|<textarea|<select/);
});

await test('withdrawals open and a balance → "Request a payout"; a reserve is called out', () => {
  const html = renderE({ creator, earnings: { ...earnings, reserved: 2000 }, standing: { ...royale, withdrawals_open: true }, weekly });
  assert.match(html, /<a href="\/creator\/payouts" class="ce-hero__btn is-primary">Request a payout/);
  assert.doesNotMatch(html, /data-withdrawals="closed"/);
  assert.match(html, /<p class="ce-reserve">[\s\S]*?₹2,000\.00 is reserved against an open payout request/);
  const nothing = renderE({ creator, earnings: emptyEarnings, standing: { ...royale, withdrawals_open: true }, weekly: noWeekly });
  assert.match(nothing, /class="ce-hero__btn">About payouts/, 'open but nothing cleared → nothing to request');
});

await test('an empty account designs every zero, and a missing earnings record still renders', () => {
  const html = renderE({ creator, earnings: emptyEarnings, standing: null, weekly: noWeekly });
  assert.match(html, /<section class="ce-hero is-zero"/);
  assert.match(html, /Nothing has cleared yet\. Commission lands here after delivery and the settlement hold\./);
  assert.doesNotMatch(html, /ce-hero__spark/, 'no history → no sparkline');
  assert.match(html, /ce-month is-zero[\s\S]*?Nothing attributed this month yet/);
  assert.match(html, /ce-weeks is-zero[\s\S]*?No commission recorded yet/);
  assert.match(html, /No qualifying products yet/);
  assert.match(html, /ce-history is-zero[\s\S]*?No history yet/);
  assert.match(html, /Commission rate<\/dt><dd class="is-ok">10%<\/dd>/, 'no standing → the RPC floor');
  assert.doesNotMatch(html, /cd-panel__link/, 'no rank → no tier link');
  const none = renderE({ creator: {}, earnings: null, standing: null, weekly: noWeekly });
  assert.match(none, /Available to withdraw/);
  assert.match(none, /Commission rate<\/dt><dd class="is-ok">—<\/dd>/);
  assert.match(none, /Settlement hold<\/dt><dd>—<\/dd>/);
  assert.match(none, /cd-stat__hint">In the settlement hold\./);
  assert.doesNotMatch(text(none.replace(/<svg[\s\S]*?<\/svg>/g, '')), /₹[1-9]/, 'no rupee figure without a record');
});

// ============================================================
console.log('\n— Links page —');
// ============================================================

await test('the default link leads, campaign links follow, every URL comes from the builder', () => {
  const html = renderL({ creator, links, campaigns, buildUrl });
  assert.match(html, /<article class="cl-card cl-card--default">[\s\S]*?Default creator link[\s\S]*?cp-pill is-ok"><i aria-hidden="true"><\/i>Always on/);
  assert.match(html, /<code>AARAV<\/code>/);
  assert.match(html, /<code class="cl-card__url">https:\/\/www\.soralife\.shop\/\?ref=AARAV<\/code>/);
  assert.match(html, /data-copy="https:\/\/www\.soralife\.shop\/\?ref=AARAV"/);
  assert.match(html, /Campaign links[\s\S]*?3 links, each tracked separately/);
  const cards = html.split('<article class="cl-card').slice(1);
  assert.equal(cards.length, 4);
  assert.match(cards[1], /Creator link[\s\S]*?Homepage[\s\S]*?<code>AARAV<\/code>[\s\S]*?Created<\/dt><dd>2 Mar 2026<\/dd>/);
  assert.match(cards[2], /Diwali edit[\s\S]*?Category · \/collections\/diwali[\s\S]*?campaign=DIWALI&amp;trk=DIW7K/);
  assert.match(cards[3], /^ is-off">[\s\S]*?Monsoon immunity[\s\S]*?Product · \/p\/moringa[\s\S]*?cp-pill is-bad"><i aria-hidden="true"><\/i>archived/);
  assert.match(html, /It stays attributed to you for 30 days\./);
  assert.doesNotMatch(html, /Share<\/button>/, 'no Web Share on the server — Copy stays');
  assert.equal(L.destinationLabel({ destination_type: 'homepage' }), 'Homepage');
  assert.equal(L.destinationLabel({ destination_type: 'product', destination_path: '/p/x' }), 'Product · /p/x');
  assert.equal(L.destinationLabel({ destination_type: 'page', destination_path: '/about' }), 'Page · /about');
});

await test('no campaign links: the default link still leads and the empty card points at campaigns', () => {
  const html = renderL({ creator: { ...creator, creator_code: 'VIKAS', default_attribution_window_days: null }, links: [], campaigns: [], buildUrl });
  assert.match(html, /cl-card--default[\s\S]*?<code>VIKAS<\/code>/);
  assert.match(html, /<div class="cl-empty">[\s\S]*?No campaign links yet[\s\S]*?<a href="\/creator\/campaigns" class="cp-btn">See campaigns/);
  assert.doesNotMatch(html, /cl-grid/);
  assert.match(html, /It stays attributed to you for your attribution window\./, 'no window on the row → no number');
  assert.match(renderL({ creator, links: [], campaigns: [] }), /<code class="cl-card__url"><\/code>/, 'no builder → an empty URL, never an invented one');
});

// ============================================================
console.log('\n— Campaigns page —');
// ============================================================

await test('campaign cards: status, window, override rate only when set, the campaign link when one exists', () => {
  const html = renderC({ creator, campaigns, links, buildUrl });
  assert.match(html, /<span class="ca-period"><span data-icon="sparkle"><\/span> 1 active of 3<\/span>/);
  const cards = html.split('<article class="cc-card').slice(1);
  assert.equal(cards.length, 3);
  assert.match(cards[0], /^" data-status="active">[\s\S]*?Diwali edit[\s\S]*?1 Oct 2026 – 15 Nov 2026[\s\S]*?cp-pill is-ok"><i aria-hidden="true"><\/i>Active/);
  assert.match(cards[0], /<p class="cc-card__desc">A festive gifting edit\.<\/p>/);
  assert.match(cards[0], /<code>DIWALI<\/code>[\s\S]*?Commission<\/dt><dd><b class="is-ok">18%<\/b> for this campaign<\/dd>[\s\S]*?Attribution<\/dt><dd>45 days<\/dd>/);
  assert.match(cards[0], /cl-card__url">https:\/\/www\.soralife\.shop\/collections\/diwali\?ref=AARAV&amp;campaign=DIWALI&amp;trk=DIW7K<\/code>/);
  assert.match(cards[1], /^ is-off" data-status="ended">[\s\S]*?Monsoon immunity[\s\S]*?15 Jun 2026 – 31 Aug 2026[\s\S]*?cp-pill is-neutral"><i aria-hidden="true"><\/i>Ended/);
  assert.match(cards[1], /Commission<\/dt><dd>Your tier rate<\/dd>[\s\S]*?Attribution<\/dt><dd>Your usual window<\/dd>/, 'no override → no invented figure');
  assert.match(cards[2], /Spring launch[\s\S]*?Open-ended[\s\S]*?cp-pill is-hold"><i aria-hidden="true"><\/i>Draft/);
  assert.match(cards[2], /<p class="cc-card__nolink">[\s\S]*?No link for this campaign yet/);
  assert.equal(C.campaignWindow({ start_at: '2026-10-01' }), 'From 1 Oct 2026');
  assert.equal(C.campaignWindow({ end_at: '2026-10-01' }), 'Until 1 Oct 2026');
  assert.equal(C.campaignWindow({}), 'Open-ended');
  assert.deepEqual(Object.keys(C.CAMPAIGN_STATUS), ['active', 'draft', 'paused', 'ended'], 'the statuses the table allows');
});

await test('no campaigns: the editorial empty card with the three points and the default-link button', () => {
  const html = renderC({ creator, campaigns: [], links: [], buildUrl });
  assert.match(html, /<section class="cc-empty" aria-label="No campaigns yet">/);
  assert.match(html, /<p class="cp-eyebrow">Campaign status<\/p>/);
  assert.match(html, /No campaigns running yet/);
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.match(html, /<a href="\/creator\/links" class="cp-btn is-primary">Use my default link/);
  assert.doesNotMatch(html, /ca-period/, 'no count chip without campaigns');
  assert.doesNotMatch(html, /<input|<textarea|<select|<form/);
});

// ============================================================
console.log('\n— The sheet —');
// ============================================================

await test('the three pages live in the studio sheet, scoped, transform/opacity only, stilled under reduced motion', () => {
  const block = css.slice(css.indexOf('.crp.crp--studio .ce {'), css.indexOf('.crp.crp--studio .cp {'));
  assert.ok(block.length > 5000, 'money pages block present');
  for (const cls of ['.ce-hero', '.ce-stats', '.ce-row--mid', '.ce-kv', '.ce-hist__fill', '.cl-card', '.cl-card--default', '.cl-empty', '.cl-tips', '.cc-card', '.cc-empty', '.cc-empty__leaf']) {
    assert.match(block, new RegExp('\\.crp\\.crp--studio ' + cls.replace(/[.]/g, '\\.') + '\\s*[,{]'), `${cls} scoped`);
  }
  for (const m of block.matchAll(/transition:\s*([^;]+);/g)) {
    for (const part of m[1].replace(/\([^)]*\)/g, '').split(',')) assert.match(part.trim(), /^(?:transform|opacity)\b/, `transition on ${part.trim()}`);
  }
  assert.doesNotMatch(block, /@keyframes|animation:/);
  assert.match(block, /\.ce-hist__fill \{[^}]*transform-origin: left center; transition: transform/);
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  const rmBlock = rm.slice(0, rm.indexOf('\n}'));
  assert.match(rmBlock, /\.ce-hist__fill \{ transition: none; \}/);
  assert.match(rmBlock, /\.ce-hero__btn:hover \{ transform: none; \}/);
  assert.doesNotMatch(block, /violet|purple|#6437FF|#4A24CC/i);
  const src = read('src/components/creator/CreatorEarningsPage.jsx');
  assert.match(src, /className={`cd-panel ce-month/); assert.match(src, /className="cd-table ce-table"/); assert.match(src, /className="ct-bars"/);
});

await test('390px is designed: hero stacks, buckets one-up, cards one-up, pill under the title, tips one-up', () => {
  const m1199 = [...css.matchAll(/@media \(max-width: 1199px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  const m1019 = [...css.matchAll(/@media \(max-width: 1019px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  const m599 = [...css.matchAll(/@media \(max-width: 599px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(m1199, /\.ce-stats \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(m1199, /\.ce-row--mid \.ce-weeks \{ grid-column: 1 \/ -1; \}/);
  assert.match(m1019, /\.ce-row--low \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m1019, /\.cl-tips \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m599, /\.ce-hero \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(m599, /\.ce-stats \{ grid-template-columns: minmax\(0, 1fr\); gap: 12px; \}/);
  assert.match(m599, /\.cl-grid, \.crp\.crp--studio \.cc-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m599, /\.cl-card__head \.cp-pill, \.crp\.crp--studio \.cc-card__head \.cp-pill \{ grid-column: 2; justify-self: start; \}/);
  assert.match(m599, /\.cl-empty \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

await test('the superseded earnings component and the legacy visual-QA harness are gone, not left dead', () => {
  assert.equal(existsSync(new URL('../src/components/creator/CreatorEarnings.jsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../scripts/creator-visual-qa.mjs', import.meta.url)), false);
  const portal = read('src/pages/CreatorPortal.jsx');
  for (const gone of ['function LinkCard', 'function ShareButton', 'function Stat(', 'const STATUS_TONE', 'function destinationLabel', 'CreatorEarnings from', 'TierStanding']) {
    assert.ok(!portal.includes(gone), `portal still carries ${gone}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
