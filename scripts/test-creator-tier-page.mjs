// ============================================================
// My Tier — the studio page. Offline suite.
//
// Badges, the pure bar geometry, and the real page rendered with
// react-dom/server for the mockup's account (Rise L1, nothing earned) and a
// Royale L7 account with a reward to choose. NO NETWORK, NO DATABASE.
//
//   node scripts/test-creator-tier-page.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';
import * as rewardRules from '../src/lib/creatorRewards.js';
import * as seriesRules from '../src/lib/creatorSeries.js';
import { money2 } from '../src/lib/format.js';

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
const Icon = () => h('span');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const css = read('src/styles/creator-dashboard.css').replace(/\/\*[\s\S]*?\*\//g, '');

const CountUp = component('src/components/creator/CreatorUI.jsx', 'CountUp', { Icon, sparkGeometry: seriesRules.sparkGeometry });
const LeaderboardList = component('src/components/LeaderboardList.jsx', 'LeaderboardList', { ...tiers });
const tierDeps = { Link, Icon, LeaderboardList, money2, CountUp, ...tiers, ...rewardRules };
const RewardChooser = component('src/components/creator/CreatorTier.jsx', 'RewardChooser', tierDeps);
const RewardHistory = component('src/components/creator/CreatorTier.jsx', 'RewardHistory', tierDeps);
const deps = { Link, Icon, LeaderboardList, CountUp, RewardChooser, RewardHistory, money2, ...tiers, ...rewardRules, ...seriesRules };
const P = {};
for (const n of ['CreatorTierPage', 'WithdrawalsBar', 'RankMedallion', 'CurrentTierCard', 'ProgressionCard', 'TierStats', 'LadderTable', 'MilestoneRewards', 'LeaderboardStrip']) P[n] = component('src/components/creator/CreatorTierPage.jsx', n, deps);

const ladder = tiers.DEFAULT_LADDER.map((l) => ({ ...l }));
const rise = { ok: true, level: 1, rank: 'Rise', rate: 10, threshold: 0, next_level: 2, next_threshold: 10000, next_rate: 11, lifetime_confirmed_sales: 0, pending_sales: 0, pending_commission: 0, confirmed_commission: 0, leaderboard_position: null, leaderboard_total: 0, withdrawals_open: false, beyond_step: 25000, ladder };
const royale = { ...rise, level: 7, rank: 'Royale', rate: 16, threshold: 125000, next_level: 8, next_threshold: 150000, next_rate: 17, lifetime_confirmed_sales: 138420, pending_sales: 9640, pending_commission: 1542.4, confirmed_commission: 19188.6, leaderboard_position: 7, leaderboard_total: 100 };
const board = Array.from({ length: 12 }, (_, i) => ({ rank_position: i + 1, display_name: ['Anjali Sharma', 'Riya Mehta', 'Kabir Rao', 'Neha Iyer', 'Devansh Kulkarni', 'Meera Pillai', 'Aarav Sethi', 'Sana Qureshi', 'Ishaan Bhatt', 'Tara Menon', 'Vihaan Joshi', 'Zoya Khan'][i], rank_name: ['Crown', 'Crown', 'Crown', 'Supreme', 'Prime', 'Royale', 'Royale', 'Royale', 'Elite', 'Elite', 'Elite', 'Premium'][i], level: [16, 15, 13, 11, 9, 8, 7, 7, 6, 6, 5, 4][i] }));
const weekly = seriesRules.rangeSeries({ ok: true, unit: 'week', series: Array.from({ length: 13 }, (_, i) => ({ at: `2026-0${6 + Math.floor(i / 4)}-0${1 + (i % 4) * 2}`, sales: [2100, 4200, 8100, 6400, 10800, 12900, 9100, 15300, 17800, 12100, 19600, 14900, 5900][i] })) }, '90d');
const noSeries = seriesRules.rangeSeries(null, '90d');
const catalog = [
  { id: 'r8a', level: 8, option_index: 1, label: 'Royale product bundle', reward_type: 'product', value: 'Six full-size products' },
  { id: 'r8b', level: 8, option_index: 2, label: 'Cash reward', reward_type: 'cash', value: '₹5,000' },
  { id: 'r8c', level: 8, option_index: 3, label: 'Homepage feature', reward_type: 'other', value: 'One week' },
];
const noop = async () => ({ ok: true });
const page = (props) => renderToStaticMarkup(h(P.CreatorTierPage, { rewards: { ok: true, claims: [], claimable: [] }, catalog: [], leaderboard: [], series: noSeries, onClaim: noop, onChanged: noop, ...props }));

// ============================================================
console.log('\n— Badges —');
// ============================================================

await test('the supplied Rise badge is a transparent WebP under 150 KB; every manifest entry exists; the rest fall back to CSS', () => {
  assert.deepEqual(Object.keys(tiers.RANK_BADGES), ['rise'], 'only Rise has been supplied so far');
  for (const [slot, src] of Object.entries(tiers.RANK_BADGES)) {
    const rel = src.replace(/^\//, '');
    assert.ok(existsSync(at(rel)), `${slot}: ${rel} missing`);
    const st = statSync(at(rel)); assert.ok(st.size < 150 * 1024, `${rel} is ${st.size} bytes`);
    const head = readFileSync(at(rel)).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP', `${rel} is not WebP`);
    assert.match(src, new RegExp(`^/img/rank-${slot}\\.webp$`), 'named for the rank');
  }
  const img = renderToStaticMarkup(h(P.RankMedallion, { rank: 'Rise' }));
  assert.match(img, /<img class="ct-medal ct-medal--img" src="\/img\/rank-rise\.webp" width="112" height="112" alt="Rise rank badge" data-rank="rise"/);
  const svg = renderToStaticMarkup(h(P.RankMedallion, { rank: 'Royale' }));
  assert.match(svg, /<span class="ct-medal ct-medal--css" data-rank="royale"[^>]*role="img" aria-label="Royale rank"><svg/);
  assert.doesNotMatch(svg, /<img/);
});

// ============================================================
console.log('\n— Bar chart geometry —');
// ============================================================

await test('one bar per bucket on a rupee axis; the last bar is "now"; all-zero draws a level row on a ₹1,000 axis', () => {
  const g = seriesRules.barChartGeometry([0, 1200, 3900], { minMax: 1000 });
  assert.equal(g.n, 3); assert.equal(g.yMax, 5000); assert.equal(g.bars[0].h, 0); assert.ok(g.bars[2].h > g.bars[1].h);
  assert.deepEqual(g.ticks.map((t) => t.label), ['₹0', '₹2.5k', '₹5k']);
  const z = seriesRules.barChartGeometry([0, 0, 0, 0], { minMax: 1000 });
  assert.equal(z.empty, true); assert.equal(z.yMax, 1000); assert.ok(z.bars.every((b) => b.h === 0 && b.y === z.baseY));
  assert.equal(seriesRules.compactRupees(150000), '₹1.5L'); assert.equal(seriesRules.compactRupees(25000000), '₹2.5Cr');
  const html = renderToStaticMarkup(h(P.ProgressionCard, { series: weekly }));
  assert.equal((html.match(/class="ct-bars__bar/g) || []).length, 13);
  assert.equal((html.match(/ct-bars__bar is-now"/g) || []).length, 1, 'exactly one gold bar');
  assert.match(html, /Sales attributed to you, by week/);
  const empty = renderToStaticMarkup(h(P.ProgressionCard, { series: noSeries }));
  assert.match(empty, /class="ct-panel ct-prog is-empty"/); assert.match(empty, /aria-label="No sales in this period yet"/);
  assert.equal((empty.match(/ct-bars__bar is-now is-zero"|ct-bars__bar is-zero"|is-now is-zero/g) || []).length >= 1, true);
  assert.match(text(empty), /each bar fills in as orders arrive/);
});

// ============================================================
console.log('\n— The page, rendered —');
// ============================================================

await test('heading, explanatory line, editorial line top right, and the dismissible amber bar', () => {
  const html = page({ standing: rise });
  assert.match(html, /<div class="ct"><div class="ct-head"><div><h1 class="crp__h1 serif">My Tier<\/h1><p class="crp__lede">Your rank is earned on confirmed sales/);
  assert.match(html, /<p class="ct-head__line serif">Every confirmed sale lifts your rank/);
  assert.match(html, /<div class="ct-bar" role="status" data-withdrawals="closed">[\s\S]*?<strong>Withdrawals aren’t open yet\.<\/strong>[\s\S]*?<button type="button" class="ct-bar__x"[^>]*aria-label="Dismiss for this session">/);
  assert.doesNotMatch(page({ standing: rise, noticeDismissed: true }), /class="ct-bar"/, 'dismissed for the session');
  assert.doesNotMatch(page({ standing: { ...rise, withdrawals_open: true } }), /class="ct-bar"/, 'gone once withdrawals open');
  assert.match(read('src/components/creator/CreatorTierPage.jsx'), /sessionStorage/, 'the dismissal is per session, not forever');
});

await test('current tier card: medallion, rank in Fraunces, level chip, commission line, bar, percentage and remaining amount, leaf art', () => {
  const html = page({ standing: rise });
  assert.match(html, /<section class="ct-panel ct-now" aria-labelledby="ct-now-h" data-rank="rise"><h2 class="ct-panel__h" id="ct-now-h">Your current tier<\/h2>/);
  assert.match(html, /<img class="ct-medal ct-medal--img" src="\/img\/rank-rise\.webp"/);
  assert.match(html, /<h3 class="ct-now__rank serif">Rise<\/h3><span class="ct-chip">Level 1<\/span>/);
  assert.match(html, /<p class="ct-now__rate"><strong>10%<\/strong> commission on every new sale<\/p>/);
  assert.match(html, /<span>Progress to Level 2<\/span><b>0%<\/b>/); assert.match(html, /aria-valuenow="0"[^>]*><span class="cd-bar__fill" style="transform:scaleX\(0\)"/);
  assert.match(html, /<strong>₹10,000<\/strong> more in confirmed sales to reach Level 2 · unlocks 11%/);
  assert.match(html, /<span class="ct-now__leaf" aria-hidden="true"><\/span>/);
  assert.match(css, /\.ct-now__leaf \{[^}]*url\('\/img\/creator-sidebar-bg\.webp'\)/);
  const r = page({ standing: royale, series: weekly });
  assert.match(r, /<b>54%<\/b>/); assert.match(r, /<strong>₹11,580<\/strong> more in confirmed sales to reach Level 8 · unlocks 17%/);
  assert.match(r, /class="ct-medal ct-medal--css" data-rank="royale"/);
});

await test('four stat cards with icon tiles, status colour and a supporting line; zeros are quiet', () => {
  const html = page({ standing: rise });
  const cards = html.split('<article class="ct-stat').slice(1);
  assert.equal(cards.length, 4);
  assert.match(text(html), /Lifetime Confirmed Sales ₹ 0 \.00 Counts toward your tier/);
  assert.match(text(html), /Pending Commission ₹ 0 \.00 Confirms 7 days after delivery/);
  assert.match(text(html), /Confirmed Commission ₹ 0 \.00 Earned at the rate of the day/);
  assert.match(text(html), /Awaiting Confirmation ₹ 0 \.00 Sales not yet counted/);
  assert.ok(cards.every((c) => c.startsWith(' is-zero"')), 'all four quiet');
  assert.deepEqual(cards.map((c) => /data-tone="(\w+)"/.exec(c)[1]), ['ok', 'hold', 'ok', 'hold']);
  const r = page({ standing: royale });
  assert.doesNotMatch(r.split('<article class="ct-stat')[1], /^ is-zero/);
  assert.match(r, /data-count="138420"/); assert.match(r, /data-count="1542.4"/);
});

await test('the ladder renders all 14 levels, marks the current one, scrolls, and expands', () => {
  const html = page({ standing: rise });
  assert.equal((html.match(/<tr class="[^"]*" data-rank=/g) || []).length, 14);
  assert.match(html, /<thead><tr><th>Level<\/th><th>Rank<\/th><th class="ta-r">Commission<\/th><th class="ta-r">Required confirmed sales<\/th><\/tr><\/thead>/);
  assert.match(html, /<tr class="is-current" data-rank="rise" aria-current="true"><td><span class="ct-table__lv">L1<\/span><\/td><td><span class="ct-table__rank"><i class="ct-dot" aria-hidden="true"><\/i>Rise<em class="ct-table__you">You<\/em><\/span><\/td><td class="ta-r"><b>10%<\/b><\/td><td class="ta-r">₹0<\/td>/);
  assert.match(html, /L14<\/span><\/td><td><span class="ct-table__rank"><i class="ct-dot" aria-hidden="true"><\/i>Crown<\/span><\/td><td class="ta-r"><b>25%<\/b><\/td><td class="ta-r">₹5,00,000<\/td>/);
  assert.equal((html.match(/ct-table__you/g) || []).length, 1);
  assert.match(html, /<div class="ct-ladder__scroll">/); assert.match(html, /aria-expanded="false">Show all 14 levels</);
  assert.match(text(html), /Beyond Level 14: a new level every ₹25,000, at 25%/);
  assert.match(css, /\.ct-ladder__scroll \{ max-height: 372px; overflow: auto;/); assert.match(css, /\.ct-ladder__scroll\.is-open \{ max-height: none;/);
  assert.match(css, /\.ct-table th \{ position: sticky; top: 0;/);
  const r = page({ standing: royale });
  assert.equal((r.match(/<tr class="is-done"/g) || []).length, 6); assert.match(r, /<tr class="is-current" data-rank="royale" aria-current="true"><td><span class="ct-table__lv">L7</);
});

await test('rewards at milestones: next milestone row with Coming soon, three upcoming cards; catalogue and chooser when they exist', () => {
  const html = page({ standing: rise });
  assert.match(html, /<div class="ct-next" data-rank="rise">[\s\S]*?<strong>Next milestone: Level 2 · Rise<\/strong><span>₹10,000 more in confirmed sales · 11% commission from then on<\/span><\/div><span class="ct-chip is-soon">Coming soon<\/span>/);
  const cards = html.split('<article class="ct-milestone"').slice(1);
  assert.equal(cards.length, 3);
  assert.match(cards[0], /Level 2<\/span><h3 class="ct-milestone__rank serif">Rise<\/h3><p class="ct-milestone__req">₹10,000 confirmed · 11%<\/p><span class="ct-chip is-soon">Coming soon<\/span>/);
  assert.match(cards[2], /Level 4<\/span><h3 class="ct-milestone__rank serif">Premium/);
  assert.doesNotMatch(html, /ctier-rewards/, 'no chooser when nothing is claimable');
  const r = page({ standing: royale, catalog, rewards: { ok: true, claims: [], claimable: [{ level: 7, rank: 'Royale', options: [{ id: 'o1', option_index: 1, label: 'Royale product bundle', reward_type: 'product' }, { id: 'o2', option_index: 2, label: 'Cash reward', reward_type: 'cash' }, { id: 'o3', option_index: 3, label: 'Homepage feature', reward_type: 'other' }] }] } });
  assert.match(r, /class="ct-chip is-live">3 options to choose from</);
  assert.equal((r.match(/class="ctier-option"/g) || []).length, 3, 'the chooser for the reached level');
  const rc = r.split('<article class="ct-milestone"').slice(1);
  assert.match(rc[0], /Level 8[\s\S]*?<ul class="ct-milestone__opts">[\s\S]*?Royale product bundle[\s\S]*?Cash reward[\s\S]*?Homepage feature/);
  assert.match(rc[1], /Level 9[\s\S]*?Coming soon/);
  const top = page({ standing: { ...royale, level: 14, rank: 'Crown', rate: 25, threshold: 500000, next_level: null, next_threshold: null, lifetime_confirmed_sales: 612000 } });
  assert.match(text(top), /You’ve reached the top of the ladder/);
});

await test('leaderboard strip: the top three plus the signed-in creator, a full board on demand, honest when absent', () => {
  const html = page({ standing: royale, leaderboard: board });
  const rows = html.split('<li class="ct-strip__row').slice(1);
  assert.equal(rows.length, 4, 'three plus you');
  assert.match(rows[0], /^" data-rank="crown"><span class="ct-strip__pos">01<\/span><span class="ct-strip__name serif">Anjali Sharma</);
  assert.match(rows[3], /^ is-me" data-rank="royale"><span class="ct-strip__pos">07<\/span><span class="ct-strip__name serif">Aarav Sethi</);
  assert.match(text(html), /You’re #7 of 100/); assert.match(html, /aria-expanded="false">View the full board</);
  const first = page({ standing: { ...royale, leaderboard_position: 2 }, leaderboard: board });
  assert.equal((first.match(/<li class="ct-strip__row/g) || []).length, 3, 'in the top three, no duplicate row');
  assert.match(first, /<li class="ct-strip__row is-me" data-rank="crown"><span class="ct-strip__pos">02</);
  const none = page({ standing: rise, leaderboard: [] });
  assert.match(text(none), /The board opens with the first confirmed sale/); assert.match(text(none), /You join the board with your first confirmed sale/);
  const out = page({ standing: { ...royale, leaderboard_position: 140, leaderboard_total: 200 }, leaderboard: board });
  assert.match(out, /class="ct-strip__row is-me is-out"><span class="ct-strip__pos">#140</);
});

await test('the portal mounts the page on the tier tab with the catalogue and the 90-day series; the mobile collapse is designed', () => {
  const portal = read('src/pages/CreatorPortal.jsx');
  assert.match(portal, /\{tab === 'tier' && \(\s*<CreatorTierPage/);
  assert.match(portal, /catalog=\{catalog\}[\s\S]*?series=\{weekly\}[\s\S]*?onClaim=\{claimLevelReward\}/);
  assert.match(portal, /getLevelRewardsCatalog\(\)\.then/);
  assert.match(read('src/lib/creatorApi.js'), /from\('creator_level_rewards'\)[\s\S]*?\.eq\('is_active', true\)/);
  const m1019 = /@media \(max-width: 1019px\)\s*\{([\s\S]*?)\n\}/g;
  const blocks = [...css.matchAll(m1019)].map((m) => m[1]).join('\n');
  assert.match(blocks, /\.ct-row--top, \.crp\.crp--studio \.ct-row--mid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(blocks, /\.ct-stats \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(blocks, /\.ct-strip \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  const m599 = [...css.matchAll(/@media \(max-width: 599px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(m599, /\.ct-stats \{ grid-template-columns: minmax\(0, 1fr\)/); assert.match(m599, /\.ct-now__body \{ grid-template-columns: minmax\(0, 1fr\)/);
  // Motion: the page's own transitions are transform-only, and the bar's animation is a transform keyframe.
  for (const m of css.matchAll(/\.ct-[^{]*\{[^}]*transition:\s*([^;]+);/g)) assert.match(m[1].trim(), /^transform/, `transition: ${m[1].trim()}`);
  assert.match(css, /@keyframes cd-fill \{ from \{ transform: scaleX\(0\); \} \}/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
