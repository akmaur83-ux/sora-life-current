// ============================================================
// Creator portal — the studio shell and dashboard. Offline suite.
//
// The stylesheet as text (scope, palette, motion budget, reduced motion,
// the mobile collapse), the pure chart/series/activity helpers, the images,
// and the real portal rendered with react-dom/server against fixtures —
// including the account the reference mockup shows (five clicks, nothing
// earned) and a fully empty one.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-creator-dashboard.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';
import * as rewardRules from '../src/lib/creatorRewards.js';
import * as kycRules from '../src/lib/kycDocuments.js';
import * as seriesRules from '../src/lib/creatorSeries.js';
import * as analyticsRules from '../src/lib/creatorAnalytics.js';
import * as activityRules from '../src/lib/creatorActivity.js';
import { money2 } from '../src/lib/format.js';
import { buildTrackingUrl } from '../src/lib/creatorLinkUtils.js';

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const read = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const at = (rel) => new URL('../' + rel, import.meta.url);
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
const Link = ({ to, children, ...props }) => h('a', { ...props, href: to }, children);
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = read('src/styles/creator-dashboard.css');
const css = stripComments(CSS);

// ============================================================
console.log('\n— The dark experiment is gone; the studio is scoped —');
// ============================================================

await test('creator-dark.css and its suite no longer exist, and nothing references them', () => {
  assert.ok(!existsSync(at('src/styles/creator-dark.css')));
  assert.ok(!existsSync(at('scripts/test-creator-dark.mjs')));
  for (const f of ['build/build-css.mjs', 'src/pages/CreatorPortal.jsx', 'scripts/ssr-portal-shots.mjs', 'scripts/audit-portal-colors.mjs']) {
    assert.doesNotMatch(read(f), /creator-dark|crp--dark|crp__ambient|crp__grain|js-reveal/, f);
  }
  const b = read('build/build-css.mjs');
  const deferred = b.slice(b.indexOf('const DEFERRED'), b.indexOf('];', b.indexOf('const DEFERRED')));
  const order = ['creator.css', 'creator-expressive.css', 'creator-tier.css', 'creator-dashboard.css'].map((f) => deferred.indexOf(f));
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), `bundle order ${order}`);
});

await test('every rule in creator-dashboard.css is scoped to .crp.crp--studio', () => {
  const body = css.replace(/@media[^{]+\{([\s\S]*?)\}\s*\}/g, '$1').replace(/@keyframes[^{]+\{[\s\S]*?\}\s*\}/g, '');
  const selectors = [...body.matchAll(/(^|\})\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].replace(/:is\([^)]*\)/g, ':is()').trim()).filter(Boolean);
  assert.ok(selectors.length > 120, `only ${selectors.length} selectors parsed`);
  for (const sel of selectors) for (const part of sel.split(',')) assert.ok(part.trim().startsWith('.crp.crp--studio'), `unscoped: ${part.trim()}`);
  assert.doesNotMatch(css, /\.crob\b|\.v2-|\.hm-|\.ftr\b|:root|(^|[\s,}])body\b/m);
});

await test('the storefront palette, in a workspace: cream ground, forest sidebar, gold accents; no purple; status colours', () => {
  assert.match(css, /--s-bg: #F6F3EB/); assert.match(css, /--s-forest: #1E3A2F/); assert.match(css, /--s-gold: #C79A45/);
  assert.match(css, /\.crp\.crp--studio \.cs-side \{[^}]*background: var\(--s-forest\)/);
  assert.match(css, /--c-violet: var\(--s-forest\)/, 'the expressive layer\'s violet token is re-pointed');
  assert.doesNotMatch(css, /#6437FF|#4B2AE0|#4A24CC|100,\s*55,\s*255|violet-/i);
  assert.match(css, /--s-green: #2F855A/); assert.match(css, /--s-amber: #B4761F/); assert.match(css, /--s-red: #C0392B/);
  assert.match(css, /\.cd-donut__seg\.is-ok \{ stroke: var\(--s-green\); \}/);
  assert.match(css, /\.cd-donut__seg\.is-hold \{ stroke: var\(--s-amber\); \}/);
  assert.match(css, /\.cd-donut__seg\.is-bad \{ stroke: var\(--s-red\); \}/);
  assert.match(css, /\.cd-stat\[data-tone="ok"\]:not\(\.is-zero\) \.cd-stat__fig \{ color: var\(--s-green\); \}/);
});

await test('motion: transform and opacity only; reduced motion turns it all off', () => {
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
    const v = m[1].trim(); if (/^none/.test(v)) continue;
    for (const part of v.replace(/cubic-bezier\([^)]*\)/g, 'ease').split(',')) assert.match(part.trim(), /^(transform|opacity)\b/, `transition: ${part.trim()}`);
  }
  for (const m of css.matchAll(/transition-property:\s*([^;]+);/g)) assert.equal(m[1].trim(), 'transform, opacity');
  for (const kf of css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}\s*\}/g)) {
    for (const p of [...kf[2].matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1])) assert.ok(['transform', 'opacity'].includes(p), `${kf[1]} animates ${p}`);
  }
  const rm = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(rm, 'reduced-motion block'); assert.match(rm[1], /animation: none/); assert.match(rm[1], /transition: none !important/);
  assert.match(read('src/components/creator/CreatorUI.jsx'), /prefers-reduced-motion: reduce/, 'the count-up honours it too');
  assert.doesNotMatch(read('src/components/creator/CreatorDashboard.jsx'), /from '(recharts|chart\.js|d3|victory|nivo|framer-motion|gsap)/);
});

await test('the mobile collapse is designed: one column, top strip nav, footer art gone, search hidden, tooltip on touch only', () => {
  const m1019 = [...css.matchAll(/@media \(max-width: 1019px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(m1019, /\.crp\.crp--studio \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m1019, /\.cs-nav \{ flex-direction: row;[^}]*overflow-x: auto/);
  assert.match(m1019, /\.cs-side__foot \{ display: none; \}/);
  assert.match(m1019, /\.cs-search \{ display: none; \}/);
  assert.match(m1019, /\.cd-row--hero \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m1019, /\.cd-row--split \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  const m599 = [...css.matchAll(/@media \(max-width: 599px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(m599, /\.cd-row--stats \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(m599, /\.cd-chart:not\(\.is-hover\) \.cd-tip \{ display: none; \}/);
  assert.match(read('src/pages/CreatorPortal.jsx'), /querySelector\('\.cs-nav__item\.is-on'\)/, 'the active item is scrolled into view');
});

await test('both backgrounds are WebP under 150 KB, named for their use, and referenced from the stylesheet', () => {
  for (const [f, max] of [['img/creator-quote-bg.webp', 150 * 1024], ['img/creator-sidebar-bg.webp', 150 * 1024]]) {
    const st = statSync(at(f)); assert.ok(st.size < max, `${f} is ${st.size} bytes`);
    const head = readFileSync(at(f)).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP', `${f} is not WebP`);
  }
  assert.match(css, /\.cd-quote \{[^}]*url\('\/img\/creator-quote-bg\.webp'\)/);
  assert.match(css, /\.cs-side__foot \{[^}]*url\('\/img\/creator-sidebar-bg\.webp'\)/);
  assert.match(read('vercel.json'), /"source": "\/\(img\|assets\)\/\(\.\*\)"/, '/img is a served, cached path');
});

// ============================================================
console.log('\n— Pure helpers: series, trend, chart geometry, donut, activity —');
// ============================================================

await test('rangeSeries: fixed length per range, previous totals, links; absent RPC → zeros', () => {
  const { rangeSeries, RANGES } = seriesRules;
  const none = rangeSeries(null, '7d');
  assert.equal(none.clicks.length, 7); assert.equal(none.available, false); assert.equal(none.previous, null); assert.deepEqual(none.links, []);
  assert.equal(rangeSeries(null, '30d').clicks.length, 30); assert.equal(rangeSeries(null, '90d').clicks.length, 13); assert.equal(rangeSeries(null, 'bogus').range, '7d');
  const raw = { ok: true, unit: 'day', series: [{ at: '2026-09-12', clicks: 2, orders: 1, sales: 900 }, { at: '2026-09-13', clicks: 3 }], previous: { clicks: 4 }, links: [{ link_id: null, label: 'Default link', clicks: 5 }] };
  const s = rangeSeries(raw, '7d');
  assert.deepEqual(s.clicks, [2, 3]); assert.deepEqual(s.totals, { clicks: 5, orders: 1, products: 0, sales: 900, commission: 0 });
  assert.equal(s.previous.clicks, 4); assert.equal(s.previous.sales, 0); assert.equal(s.links[0].label, 'Default link'); assert.equal(s.available, true);
  assert.deepEqual(RANGES.map((r) => r.label), ['7D', '30D', '90D', '1Y', 'All Time']);
});

await test('trend: "—" with no previous period, "New" from zero, signed percentages otherwise — never +100% from nothing', () => {
  const { trend } = seriesRules;
  assert.deepEqual(trend(5, null), { pct: null, dir: 'none', label: '—' });
  assert.deepEqual(trend(5, 0), { pct: null, dir: 'new', label: 'New' });
  assert.deepEqual(trend(0, 0), { pct: 0, dir: 'flat', label: '—' });
  assert.deepEqual(trend(6, 4), { pct: 50, dir: 'up', label: '+50%' });
  assert.deepEqual(trend(2, 4), { pct: -50, dir: 'down', label: '-50%' });
  assert.deepEqual(trend(4, 4), { pct: 0, dir: 'flat', label: '0%' });
});

await test('area chart geometry: nice axis, baseline at zero, all-zero is a level line on a 0–4 axis', () => {
  const { areaChartGeometry } = seriesRules;
  const g = areaChartGeometry({ clicks: [0, 3, 7], orders: [0, 1, 2] }, { width: 720, height: 240, padB: 30 });
  assert.equal(g.yMax, 10); assert.deepEqual(g.ticks.map((t) => t.v), [0, 3, 5, 8, 10]); assert.equal(g.empty, false);
  assert.deepEqual(areaChartGeometry({ clicks: [0, 2], orders: [] }).ticks.map((t) => t.v), [0, 1, 2, 3, 4], 'small data still gets a 0–4 axis with whole ticks');
  assert.deepEqual(areaChartGeometry({ clicks: [0, 5], orders: [] }).ticks.map((t) => t.v), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(areaChartGeometry({ clicks: [0, 8], orders: [] }).ticks.map((t) => t.v), [0, 3, 5, 8, 10], 'above 5 the axis snaps to 10');
  assert.equal(g.clicksPts[0][1], g.baseY, 'zero sits on the baseline');
  assert.ok(g.clicksPts[2][1] < g.clicksPts[1][1], 'higher value is higher up');
  const z = areaChartGeometry({ clicks: [0, 0, 0, 0, 0, 0, 0], orders: [0, 0, 0, 0, 0, 0, 0] });
  assert.equal(z.empty, true); assert.equal(z.yMax, 4); assert.ok(z.clicksPts.every(([, y]) => y === z.baseY));
  assert.equal(areaChartGeometry({ clicks: [], orders: [] }).n, 0);
});

await test('donut geometry: segments sum to the circumference; all-zero is one muted ring', () => {
  const { donutGeometry } = seriesRules;
  const d = donutGeometry([{ key: 'a', value: 75 }, { key: 'b', value: 25 }], { size: 150, stroke: 16 });
  assert.equal(d.empty, false); assert.equal(d.total, 100);
  const dashLen = d.segments.map((s) => Number(s.dash.split(' ')[0])).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(dashLen - d.c) < 0.3, `${dashLen} vs ${d.c}`);
  assert.equal(d.segments[1].offset, -Number(d.segments[0].dash.split(' ')[0]));
  const z = donutGeometry([{ key: 'a', value: 0 }]); assert.equal(z.empty, true); assert.equal(z.segments[0].frac, 0);
});

await test('the activity feed is assembled from real events only, newest first, with relative times', () => {
  const { buildActivity, relativeTime, greetingFor } = activityRules;
  const now = new Date('2026-09-13T10:30:00+05:30');
  const items = buildActivity({
    creator: { status: 'active', joined_at: '2026-09-12T09:00:00+05:30', created_at: '2026-09-12T08:30:00+05:30' },
    clicks: ['2026-09-13T08:20:00+05:30', '2026-09-13T07:05:00+05:30', '2026-09-11T12:00:00+05:30'],
    payouts: [], rewards: { claims: [] }, kyc: { identity_status: 'not_started' }, now,
  });
  assert.deepEqual(items.map((i) => i.id), ['clicks', 'active', 'welcome']);
  assert.equal(items[0].body, '2 clicks on your links in the last day'); assert.equal(items[0].when, '2 hours ago');
  assert.equal(items[1].title, 'Account activated'); assert.equal(items[1].when, '1 day ago');
  assert.deepEqual(buildActivity({ creator: {}, now }), [], 'no invented rows for an empty account');
  assert.equal(relativeTime('2026-09-13T10:29:30+05:30', now), 'just now');
  assert.equal(greetingFor(9), 'Good morning'); assert.equal(greetingFor(14), 'Good afternoon'); assert.equal(greetingFor(19), 'Good evening'); assert.equal(greetingFor(2), 'Good night');
});

// ============================================================
console.log('\n— The portal, rendered —');
// ============================================================

const noop = async () => ({ ok: true });
const Icon = component('src/components/Icon.jsx', 'Icon', {});
const SparrowMark = component('src/components/Logo.jsx', 'SparrowMark', { Link, branding: { siteName: 'SORA LIFE', tagline: 'x' } });
const CopyButton = component('src/components/CopyButton.jsx', 'CopyButton', { Icon });
const UI = {};
for (const n of ['Section', 'Empty', 'Pill', 'Step', 'Band', 'Cell', 'Balance', 'IdBar', 'CountUp', 'Metric', 'Sparkline']) UI[n] = component('src/components/creator/CreatorUI.jsx', n, { Icon, sparkGeometry: seriesRules.sparkGeometry });
const LeaderboardList = component('src/components/LeaderboardList.jsx', 'LeaderboardList', { ...tiers });
const tierDeps = { Link, Icon, LeaderboardList, money2, CountUp: UI.CountUp, ...tiers, ...rewardRules };
const WithdrawalsNotice = component('src/components/creator/CreatorTier.jsx', 'WithdrawalsNotice', tierDeps);
const CreatorDashboard = component('src/components/creator/CreatorDashboard.jsx', 'CreatorDashboard', { Link, Icon, CountUp: UI.CountUp, Sparkline: UI.Sparkline, money2, ...tiers, ...seriesRules, ...activityRules });
const StatCard = component('src/components/creator/CreatorDashboard.jsx', 'StatCard', { Link, Icon, CountUp: UI.CountUp, Sparkline: UI.Sparkline, money2, ...tiers, ...seriesRules, ...activityRules });
const CreatorAnalyticsPage = component('src/components/creator/CreatorAnalyticsPage.jsx', 'CreatorAnalyticsPage', { Link, Icon, StatCard, money2, ...seriesRules, ...analyticsRules });
const RewardChooser = component('src/components/creator/CreatorTier.jsx', 'RewardChooser', tierDeps);
const RewardHistory = component('src/components/creator/CreatorTier.jsx', 'RewardHistory', tierDeps);
const CreatorTierPage = component('src/components/creator/CreatorTierPage.jsx', 'CreatorTierPage', { Link, Icon, LeaderboardList, CountUp: UI.CountUp, RewardChooser, RewardHistory, money2, ...tiers, ...rewardRules, ...seriesRules });
const WithdrawalsBar = component('src/components/creator/CreatorTierPage.jsx', 'WithdrawalsBar', { Link, Icon, LeaderboardList, CountUp: UI.CountUp, RewardChooser, RewardHistory, money2, ...tiers, ...rewardRules, ...seriesRules });
const CreatorEarningsPage = component('src/components/creator/CreatorEarningsPage.jsx', 'CreatorEarningsPage', { Link, Icon, StatCard, WithdrawalsBar, CountUp: UI.CountUp, Sparkline: UI.Sparkline, money2, ...seriesRules });
const CreatorLinksPage = component('src/components/creator/CreatorLinksPage.jsx', 'CreatorLinksPage', { Link, Icon, CopyButton });
const CreatorCampaignsPage = component('src/components/creator/CreatorCampaignsPage.jsx', 'CreatorCampaignsPage', { Link, Icon, CopyButton });
const CreatorHowItWorks = component('src/components/creator/CreatorHowItWorks.jsx', 'CreatorHowItWorks', { Icon, money2 });
const CreatorPayouts = component('src/components/creator/CreatorPayouts.jsx', 'CreatorPayouts', { Icon, money2, WithdrawalsNotice, ...kycRules });
const CreatorTermsPanel = component('src/components/creator/CreatorTermsPanel.jsx', 'CreatorTermsPanel', {});
const TermsUpdatedLine = component('src/components/creator/CreatorTermsPanel.jsx', 'TermsUpdatedLine', {});
const RankMedallion = component('src/components/creator/CreatorTierPage.jsx', 'RankMedallion', { Link, Icon, LeaderboardList, CountUp: UI.CountUp, RewardChooser, RewardHistory, money2, ...tiers, ...rewardRules, ...seriesRules });
const profileDeps = { Link, Icon, CopyButton, CreatorTermsPanel, TermsUpdatedLine, RankMedallion, rankSlot: tiers.rankSlot };
const CreatorProfilePage = component('src/components/creator/CreatorProfilePage.jsx', 'CreatorProfilePage', profileDeps);
const initialsOf = component('src/components/creator/CreatorProfilePage.jsx', 'initialsOf', profileDeps);
const portalFor = (tab) => component('src/pages/CreatorPortal.jsx', 'CreatorPortal', {
  Link, useNavigate: () => () => {}, useParams: () => ({ tab }), Icon, SparrowMark, CopyButton,
  useCustomerAuth: () => ({ session: { user: { id: 'u' } }, loading: false, signOut: () => {} }),
  claimCreatorAccount: noop, getMyCreator: noop, getMyCampaigns: async () => [], getMyLinks: async () => [], buildTrackingUrl,
  getMyCreatorAnalytics: noop, getMyCreatorEarnings: noop, getMyKyc: noop, submitKyc: noop, uploadKycDocument: noop, requestPayout: noop,
  getMyPayouts: async () => [], getMyCreatorStanding: noop, getMyCreatorRewards: noop, claimLevelReward: noop, getCreatorLeaderboard: async () => [], getMyActivitySeries: noop, getMyRecentClicks: async () => [],
  getCreatorTerms: async () => null, termsArePublished: () => false, getMyTermsAcceptance: async () => null, acceptCreatorTerms: noop,
  money2, CreatorEarningsPage, CreatorLinksPage, CreatorCampaignsPage, CreatorHowItWorks, ...UI, CreatorPayouts, rankSlot: tiers.rankSlot, ...seriesRules, ...activityRules, CreatorDashboard, CreatorTierPage, CreatorProfilePage, initialsOf, CreatorAnalyticsPage, getLevelRewardsCatalog: async () => [],
});

const NOW = '2026-09-13T10:30:00+05:30';
const DAYS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
const creator = { id: 'c1', display_name: 'Vikas Shamra', creator_code: 'VIKAS', status: 'active', default_commission_rate: 10, default_attribution_window_days: 30, joined_at: '2026-09-12T09:00:00+05:30', created_at: '2026-09-12T08:30:00+05:30', email: 'v@x.com' };
const standing = { ok: true, level: 1, rank: 'Rise', rate: 10, threshold: 0, next_level: 2, next_threshold: 10000, next_rate: 11, lifetime_confirmed_sales: 0, pending_sales: 0, pending_commission: 0, confirmed_commission: 0, leaderboard_position: null, leaderboard_total: 0, withdrawals_open: false, beyond_step: 25000, ladder: tiers.DEFAULT_LADDER.map((l) => ({ ...l })) };
const earnings = { ok: true, available: 0, held: 0, reserved: 0, paid: 0, reversed: 0, commission_rate: 10, settlement_hold_days: 7, min_payout: 500, payout_day: 1, this_month: {}, clicks: 5, top_products: [], monthly_history: [] };
const ref7 = { ok: true, range: '7d', unit: 'day', series: DAYS.map((at, i) => ({ at, clicks: [0, 0, 1, 1, 2, 0, 1][i], orders: 0, products: 0, sales: 0, commission: 0 })), previous: { clicks: 0, orders: 0, products: 0, sales: 0, commission: 0 }, links: [{ link_id: null, label: 'Default link', clicks: 5, orders: 0, sales: 0, commission: 0 }] };
const reference = {
  creator, campaigns: [], links: [], analytics: { ok: true, clicks: 5, attributed_orders: 0, products_sold: 0, attributed_sales: 0, top_products: [] }, earnings,
  kyc: { identity_status: 'not_started' }, payouts: [], standing, rewards: { ok: true, level: 1, claims: [], claimable: [] }, leaderboard: [], terms: null,
  seriesByRange: { '7d': ref7 }, range: '7d', recentClicks: ['2026-09-13T08:20:00+05:30', '2026-09-13T07:05:00+05:30', '2026-09-13T06:10:00+05:30', '2026-09-12T19:40:00+05:30', '2026-09-11T12:00:00+05:30'], now: NOW, hour: 9,
};
const empty = { ...reference, creator: { ...creator, display_name: 'Priya Nair' }, analytics: { ok: true, clicks: 0, attributed_orders: 0, products_sold: 0, attributed_sales: 0 }, seriesByRange: {}, recentClicks: [], hour: 14 };
const render = (tab, seed) => renderToStaticMarkup(h(portalFor(tab), { initial: seed }));

await test('shell: forest sidebar with the hummingbird, icon+label nav with a Soon badge on Payouts, avatar + rank chip, search', () => {
  const html = render('dashboard', reference);
  assert.match(html, /<div class="crp crp--studio" data-rank="rise"><aside class="cs-side">/);
  assert.match(html, /class="cs-brand__mark"><svg width="34" height="25.5" viewBox="0 0 44 32"/, 'the mark');
  assert.match(html, /<strong>SORA LIFE<\/strong><em>Creator Program<\/em>/);
  assert.equal((html.match(/class="cs-nav__item/g) || []).length, 9);
  assert.match(html, /class="cs-nav__item is-on" aria-current="page"[^>]*><svg[^>]*>[\s\S]*?<span>Dashboard<\/span>/);
  assert.match(html, /<span>Payouts<\/span><em class="cs-nav__soon">Soon<\/em>/);
  assert.match(html, /class="cs-user__avatar" aria-hidden="true">VS</); assert.match(html, /<strong>Vikas Shamra<\/strong><em>Rise · Level 1<\/em>/);
  assert.match(html, /<form class="cs-search" role="search">/); assert.match(html, /placeholder="Search campaigns, links, resources…"/);
  assert.match(text(html), /Wellness for a Brighter Tomorrow/); assert.match(text(html), /You’re creating real impact/);
  assert.doesNotMatch(html, /crp__ambient|crp__grain|crp--dark|js-reveal/);
  const open = render('dashboard', { ...reference, standing: { ...standing, withdrawals_open: true } });
  assert.doesNotMatch(open, /cs-nav__soon/, 'the badge goes when withdrawals open');
});

await test('greeting and quote: Fraunces name, time-of-day greeting, the quote panel and the mantra', () => {
  const html = render('dashboard', reference);
  assert.match(html, /<p class="cd-hello__hi">Good morning,<\/p><h1 class="cd-hello__name serif">Vikas Shamra <span class="cd-hello__spark"/);
  assert.match(text(html), /Create\. Inspire\. Earn\. Build a Healthier India\./);
  assert.match(html, /<figure class="cd-quote" role="img" aria-label="Small creators make a big difference\. — SORA LIFE">/);
  assert.match(html, /class="cd-mantra__words"><span>Create<\/span><span>Inspire<\/span><span>Earn<\/span>/);
  assert.match(render('dashboard', empty), /<p class="cd-hello__hi">Good afternoon,<\/p>/);
});

await test('four stat cards: icon tile, figure, trend and sparkline — the reference account shows 5 / New and three quiet zeros', () => {
  const html = render('dashboard', reference);
  const cards = html.split('<article class="cd-stat').slice(1);
  assert.equal(cards.length, 4);
  assert.match(cards[0], /Total Link Clicks[\s\S]*?data-count="5">5<\/span>[\s\S]*?class="cd-stat__trend is-new">New</);
  assert.match(cards[0], /<svg class="ck-spark ck-tone-ok"/, 'a real sparkline for the one figure with data');
  for (const [i, label] of [[1, 'Total Orders'], [2, 'Products Sold'], [3, 'Attributed Sales']]) {
    assert.ok(cards[i].startsWith(' is-zero"'), `${label} is quiet`);
    assert.match(cards[i], /class="cd-stat__trend is-flat">—</);
    assert.match(cards[i], /<svg class="ck-spark ck-tone-neutral is-empty is-flat"/, `${label} still draws its baseline`);
  }
  assert.match(cards[3], /<span class="cd-stat__glyph">₹<\/span>/); assert.match(cards[3], /class="cd-stat__fig is-money"><span class="ck-count" data-count="0"><span class="ck-cur">₹<\/span><span class="ck-int">0<\/span><span class="ck-dec">\.00<\/span>/);
  assert.match(html, /<section class="cd-share" aria-label="Share your link">[\s\S]*?<strong>Share Your Link<\/strong><span>Start earning today<\/span>[\s\S]*?href="\/creator\/links"/);
});

await test('performance overview: 7D selected, four metric cards, area chart with axis and a tooltip on the last point', () => {
  const html = render('dashboard', reference);
  assert.match(html, /role="tab" aria-selected="true" class="cd-range__btn is-on">7D</);
  assert.equal((html.match(/role="tab"/g) || []).length, 5);
  assert.match(text(html), /Link Clicks 5 New/); assert.match(text(html), /Orders 0 — 0%/); assert.match(text(html), /Sales \(₹\) ₹ 0 \.00 — 0%/); assert.match(text(html), /Commission \(₹\) ₹ 0 \.00 — 0%/);
  assert.match(html, /<svg class="cd-chart__svg" viewBox="0 0 720 240" role="img" aria-label="Link clicks and orders over the selected period">/);
  assert.match(html, /class="cd-chart__ytick"[^>]*>4</, 'a 0–4 axis for a near-empty week');
  assert.match(html, /class="cd-chart__area"/); assert.match(html, /class="cd-chart__line"/); assert.match(html, /class="cd-chart__orders"/);
  assert.equal((html.match(/class="cd-chart__pt/g) || []).length, 7);
  assert.match(html, /class="cd-chart__xtick"[^>]*>7 Sept?</); assert.match(html, /class="cd-chart__xtick"[^>]*>13 Sept?</);
  assert.match(html, /<div class="cd-tip is-right" style="left:98\.3%"[\s\S]*?<strong>13 Sept?<\/strong>[\s\S]*?Link Clicks <b>1<\/b>[\s\S]*?Orders <b>0<\/b>[\s\S]*?Sales <b>₹0\.00<\/b>/);
  const zero = render('dashboard', empty);
  assert.match(zero, /class="cd-chart is-empty"/); assert.match(zero, /aria-label="No activity in this period yet"/);
  assert.match(text(zero), /the chart fills in as visits arrive through your links/);
});

await test('earnings breakdown: donut with centre total, four status-coloured legend rows; empty is a muted ring', () => {
  const html = render('dashboard', reference);
  assert.match(html, /<section class="cd-panel cd-earn is-zero"/);
  assert.match(html, /<circle class="cd-donut__track"/); assert.doesNotMatch(html, /cd-donut__seg/, 'no segments at zero');
  assert.match(html, /class="cd-donut__fig"><span class="ck-count" data-count="0">/); assert.match(text(html), /Total Earnings/);
  assert.match(html, /is-ok"[^>]*><\/i>Available<\/span><b>₹0\.00<\/b>[\s\S]*?is-hold"[^>]*><\/i>On Hold[\s\S]*?is-bad"[^>]*><\/i>Reversed[\s\S]*?is-neutral"[^>]*><\/i>Paid Out/);
  assert.match(html, /class="cd-panel__foot-btn" href="\/creator\/earnings">View Earnings Details/);
  const rich = render('dashboard', { ...reference, earnings: { ...earnings, available: 12640.5, held: 1542.4, paid: 6548.1 } });
  assert.equal((rich.match(/class="cd-donut__seg is-(ok|hold|neutral)"/g) || []).length, 3);
  assert.doesNotMatch(rich, /cd-donut__seg is-bad/, 'a zero segment is not drawn');
  assert.match(rich, /data-count="20731"/);
});

await test('recent activity comes from what happened; tier progress reads ₹0 of ₹10,000 / 0% with the locked next level', () => {
  const html = render('dashboard', reference);
  assert.match(html, /<strong>New link clicks<\/strong><span>4 clicks on your links in the last day<\/span><\/div><time class="cd-feed__when" [dD]ate[tT]ime="[^"]+">2 hours ago<\/time>/);
  assert.match(text(html), /Account activated Your creator account is now active 1 day ago/);
  assert.match(text(html), /Welcome to SORA LIFE Start sharing and earn 1 day ago/);
  assert.match(html, /<section class="cd-panel cd-tier" aria-labelledby="cd-tier-h" data-rank="rise">/);
  assert.match(html, /class="cd-medal" data-rank="rise"/);
  assert.match(html, /<h3 class="cd-tier__rank serif">Rise — Level 1<\/h3><p class="cd-tier__rate">Commission Rate 10%<\/p>/);
  assert.match(html, /<span>₹0 of ₹10,000<\/span><b>0%<\/b>/); assert.match(html, /aria-valuenow="0"[^>]*><span class="cd-bar__fill" style="transform:scaleX\(0\)"/);
  assert.match(html, /<strong>Next Level: Rise — Level 2<\/strong><span>Reach ₹10,000 in confirmed sales<\/span><span>11% commission on future sales<\/span>/);
  assert.match(html, /<td><strong>Default link<\/strong><\/td><td class="ta-r">5<\/td><td class="ta-r">0<\/td><td class="ta-r">₹0\.00<\/td><td class="ta-r is-earn">₹0\.00<\/td>/);
  assert.match(html, /<h2 class="cd-promo__h serif" id="cd-promo-h">Turn Your Influence <br\/>Into Impact<\/h2>/);
  assert.match(html, /class="cd-promo__btn" href="\/creator\/campaigns">Explore Campaigns/);
  const zero = render('dashboard', empty);
  assert.doesNotMatch(zero, /New link clicks/, 'no click row without clicks');
  assert.match(text(zero), /Account activated[\s\S]*Welcome to SORA LIFE/, "the account's own dates still make a feed");
  assert.match(text(zero), /Campaign figures appear here once activity is recorded/);
  const nobody = render('dashboard', { ...empty, creator: { ...empty.creator, status: 'pending', joined_at: null, created_at: null } });
  assert.match(nobody, /<p class="cd-feed__empty">/);
});

await test('the other tabs still render on the studio shell, and the storefront never gets the studio tokens', () => {
  for (const tab of ['earnings', 'analytics', 'tier', 'payouts', 'campaigns', 'links', 'profile', 'how-it-works']) {
    const html = render(tab, reference);
    assert.match(html, /<div class="crp crp--studio"/, tab); assert.match(html, /class="cs-side"/, tab);
  }
  assert.match(render('earnings', reference), /data-withdrawals="closed"/);
  assert.doesNotMatch(read('src/styles/leaderboard.css'), /--s-bg|crp--studio/);
  const b = read('build/build-css.mjs');
  assert.ok(!b.slice(b.indexOf('const STOREFRONT'), b.indexOf('const DEFERRED')).includes('creator-dashboard'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
