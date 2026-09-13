// ============================================================
// My analytics — the studio page. Offline suite.
//
// The pure rules (stats that follow the range, ratios that read "—" over
// zero, the funnel, product share, per-link rows, insights that only say
// what the figures support, the CSV) and the page rendered with
// react-dom/server for a busy account, the mockup account (five clicks,
// nothing sold) and an empty one. NO NETWORK, NO DATABASE.
//
//   node scripts/test-creator-analytics-page.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';
import * as seriesRules from '../src/lib/creatorSeries.js';
import * as activityRules from '../src/lib/creatorActivity.js';
import * as A from '../src/lib/creatorAnalytics.js';
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
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const css = read('src/styles/creator-dashboard.css').replace(/\/\*[\s\S]*?\*\//g, '');
const source = read('src/components/creator/CreatorAnalyticsPage.jsx');

const UI = {};
for (const n of ['CountUp', 'Sparkline']) UI[n] = component('src/components/creator/CreatorUI.jsx', n, { Icon, sparkGeometry: seriesRules.sparkGeometry });
const dashDeps = { Link, Icon, CountUp: UI.CountUp, Sparkline: UI.Sparkline, money2, ...tiers, ...seriesRules, ...activityRules };
const StatCard = component('src/components/creator/CreatorDashboard.jsx', 'StatCard', dashDeps);
const deps = { Link, Icon, StatCard, money2, ...seriesRules, ...A };
const CreatorAnalyticsPage = component('src/components/creator/CreatorAnalyticsPage.jsx', 'CreatorAnalyticsPage', deps);
const render = (props) => renderToStaticMarkup(h(CreatorAnalyticsPage, props));

// ---- fixtures ----
const DAYS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
const busyRaw = {
  ok: true, range: '7d', unit: 'day',
  series: DAYS.map((at, i) => ({ at, clicks: [12, 20, 15, 31, 22, 40, 24][i], orders: [1, 2, 0, 3, 1, 4, 1][i], products: [2, 4, 0, 6, 2, 9, 2][i], sales: [1200, 2400, 0, 3600, 1300, 6200, 1900][i], commission: [192, 384, 0, 576, 208, 992, 304][i] })),
  previous: { clicks: 120, orders: 6, products: 14, sales: 11000, commission: 1760 },
  links: [
    { link_id: null, label: 'Default link', campaign: null, clicks: 1100, orders: 48, sales: 121000, commission: 12100 },
    { link_id: 'l2', label: 'Diwali edit', campaign: 'Diwali edit', clicks: 140, orders: 10, sales: 27060, commission: 2706 },
    { link_id: 'l3', label: 'Idle link', campaign: null, clicks: 0, orders: 0, sales: 0, commission: 0 },
  ],
};
const busy = seriesRules.rangeSeries(busyRaw, '7d');
const busyAnalytics = { ok: true, clicks: 1240, attributed_orders: 58, products_sold: 131, attributed_sales: 148060, eligible_orders: 55,
  top_products: [{ name: 'Amla Juice', qty: 41, sales: 56120 }, { name: 'Black Seed Oil', qty: 29, sales: 38640 }, { name: 'Moringa', qty: 24, sales: 21480 }, { name: 'Gummies', qty: 18, sales: 15840 }, { name: 'Latte', qty: 11, sales: 9360 }, { name: 'Tea', qty: 8, sales: 6620 }] };
const creator = { id: 'c1', display_name: 'Aarav Sethi', creator_code: 'AARAV' };
const links = [{ id: 'l2', public_code: 'DIW7K', campaign_id: 'cp1', destination_path: '/collections/diwali' }];
const campaigns = [{ id: 'cp1', name: 'Diwali edit', campaign_code: 'DIWALI' }];
const buildUrl = (link, c, camp) => `https://www.soralife.shop${link?.destination_path || '/'}?ref=${c?.creator_code}${camp ? `&campaign=${camp.campaign_code}` : ''}${link?.public_code ? `&trk=${link.public_code}` : ''}`;

const vikasRaw = { ok: true, range: '7d', unit: 'day', series: DAYS.map((at, i) => ({ at, clicks: [0, 0, 1, 1, 2, 0, 1][i], orders: 0, products: 0, sales: 0, commission: 0 })),
  previous: { clicks: 0, orders: 0, products: 0, sales: 0, commission: 0 }, links: [{ link_id: null, label: 'Default link', campaign: null, clicks: 5, orders: 0, sales: 0, commission: 0 }] };
const vikas = seriesRules.rangeSeries(vikasRaw, '7d');
const vikasAnalytics = { ok: true, clicks: 5, attributed_orders: 0, products_sold: 0, attributed_sales: 0, eligible_orders: 0, top_products: [] };
const none = seriesRules.rangeSeries(null, '7d');
const noneAnalytics = { ok: true, clicks: 0, attributed_orders: 0, products_sold: 0, attributed_sales: 0, eligible_orders: 0, top_products: [] };

// ============================================================
console.log('\n— The rules —');
// ============================================================

await test('stat cards follow the range when the series is there, and read all time until it is', () => {
  const s = A.analyticsStats(busyAnalytics, busy);
  assert.equal(s.scope, 'range');
  assert.deepEqual([s.clicks, s.orders, s.products, s.sales], [164, 12, 25, 16600]);
  assert.equal(s.conversion, 7.3, 'orders ÷ clicks, one decimal');
  assert.equal(s.aov, 1383.33, 'sales ÷ orders, two decimals');
  assert.equal(s.trends.clicks.label, '+37%'); assert.equal(s.trends.sales.label, '+51%');
  assert.equal(s.trends.conversion.label, '+46%', 'ratio against the previous ratio (5.0% → 7.3%)');
  assert.equal(s.sparks.clicks.length, 7); assert.equal(s.sparks.conversion[2], 0, 'a day with no orders converts 0%');
  assert.equal(s.sparks.aov[5], 1550);
  const all = A.analyticsStats(busyAnalytics, none);
  assert.equal(all.scope, 'all');
  assert.deepEqual([all.clicks, all.orders, all.products, all.sales], [1240, 58, 131, 148060]);
  assert.equal(all.conversion, 4.7); assert.equal(all.aov, 2552.76);
  assert.equal(all.trends.clicks.label, '—', 'no previous period → no trend');
  assert.deepEqual(all.sparks.clicks, [], 'no series → no sparkline, never a flat fake');
});

await test('ratios over zero are null, never 0 or Infinity', () => {
  assert.equal(A.ratio(5, 0), null); assert.equal(A.ratio(0, 0), null); assert.equal(A.ratio(3, 4), 0.75);
  const s = A.analyticsStats(vikasAnalytics, vikas);
  assert.equal(s.conversion, 0, 'five clicks and no orders is a real 0%');
  assert.equal(s.aov, null, 'no orders → no average order value');
  assert.equal(s.trends.aov.label, '—');
  assert.equal(s.trends.clicks.label, 'New', 'clicks from nothing is "New", not +100%');
  const z = A.analyticsStats(noneAnalytics, none);
  assert.equal(z.conversion, null); assert.equal(z.aov, null);
});

await test('period and previous labels come from the buckets', () => {
  assert.equal(A.periodLabel(busy), '7 Sept – 13 Sept 2026');
  assert.equal(A.previousLabel(busy), 'vs previous 7 days');
  assert.equal(A.periodLabel(none), null); assert.equal(A.previousLabel(none), null);
  const weeks = seriesRules.rangeSeries({ ok: true, range: '90d', unit: 'week', series: [{ at: '2026-06-15' }, { at: '2026-09-07' }], previous: {} }, '90d');
  assert.equal(A.periodLabel(weeks), '15 Jun – 13 Sept 2026', 'a week bucket runs to its seventh day');
  assert.equal(A.previousLabel(weeks), 'vs previous 2 weeks');
  const all = seriesRules.rangeSeries({ ok: true, range: 'all', unit: 'month', series: [{ at: '2025-10-01' }, { at: '2026-09-01' }], previous: null }, 'all');
  assert.equal(A.periodLabel(all), 'Oct 2025 – Sept 2026');
  assert.equal(A.previousLabel(all), null, 'all time has no previous period');
});

await test('the funnel is click → attributed → qualified, from the all-time record', () => {
  const f = A.funnelFor(busyAnalytics);
  assert.equal(f.empty, false);
  assert.deepEqual(f.steps.map((s) => [s.label, s.value, s.pct]), [['Link clicks', 1240, 100], ['Attributed orders', 58, 4.7], ['Qualified orders', 55, 4.4]]);
  const z = A.funnelFor(noneAnalytics);
  assert.equal(z.empty, true);
  assert.deepEqual(z.steps.map((s) => s.pct), [null, null, null], 'no clicks → no percentages');
  assert.deepEqual(A.funnelFor(vikasAnalytics).steps.map((s) => s.pct), [100, 0, 0]);
});

await test('product share is the top four by sales plus "Others", percentages of the whole', () => {
  const p = A.productShare(busyAnalytics.top_products);
  assert.equal(p.total, 148060); assert.equal(p.empty, false);
  assert.deepEqual(p.parts.map((x) => x.label), ['Amla Juice', 'Black Seed Oil', 'Moringa', 'Gummies', 'Others (2)']);
  assert.deepEqual(p.parts.map((x) => x.pct), [38, 26, 15, 11, 11]);
  assert.equal(p.parts[4].value, 15980); assert.equal(p.parts[4].qty, 19);
  assert.equal(A.productShare([]).empty, true);
  assert.equal(A.productShare([{ name: 'x', qty: 1, sales: 0 }]).parts.length, 0, 'a product with no sales has no share');
  assert.equal(A.productShare(null).total, 0);
});

await test('top links carry a conversion column and the real tracking URL, sorted by sales then clicks', () => {
  const rows = A.topLinks(busy.links, { links, creator, campaigns, buildUrl });
  assert.deepEqual(rows.map((r) => r.label), ['Default link', 'Diwali edit', 'Idle link']);
  assert.equal(rows[0].url, 'www.soralife.shop/?ref=AARAV');
  assert.equal(rows[1].url, 'www.soralife.shop/collections/diwali?ref=AARAV&campaign=DIWALI&trk=DIW7K');
  assert.equal(rows[0].conversion, 4.4); assert.equal(rows[1].conversion, 7.1); assert.equal(rows[2].conversion, null);
  assert.deepEqual(A.topLinks([], {}), []);
  assert.equal(A.topLinks(busy.links, { limit: 2 }).length, 2);
});

await test('insights only say what the figures support', () => {
  const stats = A.analyticsStats(busyAnalytics, busy);
  const rows = A.topLinks(busy.links, { links, creator, campaigns, buildUrl });
  const ins = A.insightsFor({ series: busy, stats, links: rows, money: money2 });
  assert.deepEqual(ins.map((i) => i.key), ['best', 'trend', 'link']);
  assert.equal(ins[0].title, 'Your best day'); assert.match(ins[0].body, /^12 Sept brought in ₹6,200\.00 of attributed sales\.$/);
  assert.equal(ins[1].title, 'Attributed sales up 51%'); assert.equal(ins[1].tone, 'ok');
  assert.equal(ins[2].title, 'Default link performs best'); assert.match(ins[2].body, /1100 clicks, 48 orders and ₹1,21,000\.00 of sales, all time\./);
  // Five clicks, nothing sold: the busiest day and the link with clicks — no sales claim anywhere.
  const v = A.insightsFor({ series: vikas, stats: A.analyticsStats(vikasAnalytics, vikas), links: A.topLinks(vikas.links, {}), money: money2 });
  assert.deepEqual(v.map((i) => i.key), ['best', 'trend', 'link']);
  assert.equal(v[0].title, 'Your busiest day'); assert.match(v[0].body, /11 Sept had 2 visits through your links\./);
  assert.equal(v[1].title, 'First clicks this period');
  assert.match(v[2].body, /5 clicks so far and no orders yet/);
  for (const i of v) assert.doesNotMatch(i.body, /₹/, 'no rupee figure without a sale');
  // Nothing at all: no insights, the page says so instead.
  assert.deepEqual(A.insightsFor({ series: none, stats: A.analyticsStats(noneAnalytics, none), links: [] }), []);
  // A downward period is reported as such, not hidden.
  const down = seriesRules.rangeSeries({ ...busyRaw, previous: { clicks: 400, orders: 30, products: 60, sales: 40000, commission: 6400 } }, '7d');
  const d = A.insightsFor({ series: down, stats: A.analyticsStats(busyAnalytics, down), links: [], money: money2 });
  assert.equal(d[1].title, 'Attributed sales down 58%'); assert.equal(d[1].tone, 'hold');
});

await test('the CSV is exactly what is on screen', () => {
  const csv = A.analyticsCsv(busy, busy.links);
  const lines = csv.trimEnd().split('\n');
  assert.equal(lines[0], 'period,clicks,orders,products,sales,commission');
  assert.equal(lines[1], '2026-09-07,12,1,2,1200,192');
  assert.equal(lines[7], '2026-09-13,24,1,2,1900,304');
  assert.equal(lines[8], ''); assert.equal(lines[9], 'link,campaign,clicks,orders,sales,commission');
  assert.equal(lines[10], 'Default link,,1100,48,121000,12100');
  assert.match(A.analyticsCsv(busy, [{ label: 'A, "quoted"', clicks: 1 }]), /"A, ""quoted"""/, 'commas and quotes are escaped');
  assert.equal(A.analyticsCsv(none, []), 'period,clicks,orders,products,sales,commission\n' + Array(7).fill('').map((_, i) => `,0,0,0,0,0`).join('\n') + '\n');
});

await test('dual-axis geometry: counts left (never under 4), rupees right (never under ₹1,000), whole ticks on small axes', () => {
  const g = A.dualAxisGeometry({ clicks: busy.clicks, orders: busy.orders, sales: busy.sales }, { width: 560, height: 230 });
  assert.equal(g.leftMax, 50); assert.equal(g.rightMax, 10000); assert.equal(g.n, 7); assert.equal(g.empty, false);
  assert.deepEqual(g.leftTicks.map((t) => t.v), [0, 13, 25, 38, 50]);
  assert.deepEqual(g.rightTicks.map((t) => t.v), [0, 2500, 5000, 7500, 10000]);
  // The ₹6,200 peak sits at 62% of the right axis; the 40-click peak at 80% of the left one.
  assert.equal(g.salesPts[5][1], Math.round((g.padT + g.innerH * (1 - 0.62)) * 10) / 10);
  assert.equal(g.clicksPts[5][1], Math.round((g.padT + g.innerH * (1 - 0.8)) * 10) / 10);
  const small = A.dualAxisGeometry({ clicks: [0, 1, 2], orders: [0, 0, 1], sales: [0, 0, 0] });
  assert.equal(small.leftMax, 4); assert.deepEqual(small.leftTicks.map((t) => t.v), [0, 1, 2, 3, 4]);
  assert.equal(small.rightMax, 1000); assert.equal(small.empty, false);
  const z = A.dualAxisGeometry({ clicks: [0, 0], orders: [0, 0], sales: [0, 0] });
  assert.equal(z.empty, true); assert.equal(z.line, `M${z.padL} ${z.baseY} L${z.width - z.padR} ${z.baseY}`, 'all-zero draws a level baseline');
  const gb = A.groupedBarGeometry(busy.sales, busy.commission, { width: 360, height: 170 });
  assert.equal(gb.n, 7); assert.equal(gb.yMax, 10000); assert.equal(gb.empty, false);
  assert.ok(gb.pairs[5].a.h > gb.pairs[5].b.h, 'sales bar taller than its commission bar');
  assert.equal(gb.pairs[2].a.h, 0, 'a zero day has a zero-height bar (drawn 2px by the component)');
  assert.equal(A.groupedBarGeometry([0], [0]).yMax, 1000);
});

// ============================================================
console.log('\n— The page —');
// ============================================================

await test('a busy account: six cards on the range, the period chip, export, all five panels with real figures', () => {
  const html = render({ creator, analytics: busyAnalytics, series: busy, range: '7d', onRange: () => {}, links, campaigns, buildUrl });
  assert.match(html, /<div class="ca">/);
  const cards = html.split('<article class="cd-stat').slice(1);
  assert.equal(cards.length, 6);
  assert.match(cards[0], /Link clicks[\s\S]*?data-count="164">164<[\s\S]*?cd-stat__trend is-up">[\s\S]*?\+37%<em class="cd-stat__vs">vs previous 7 days<\/em>/);
  assert.match(cards[4], /Conversion rate[\s\S]*?data-count="7.3">7\.3%</);
  assert.match(cards[5], /Avg order value[\s\S]*?<span class="ck-cur">₹<\/span><span class="ck-int">1,383<\/span><span class="ck-dec">\.33<\/span>/);
  assert.match(html, /<span class="ca-period"><span data-icon="clock"><\/span>7 Sept – 13 Sept 2026<\/span>/);
  assert.match(html, /<button type="button" class="ca-export">/);
  assert.match(html, /cd-range__btn is-on">7D</);
  assert.match(html, /class="ca-chart__sales"/, 'the sales line on the right axis');
  assert.match(html, /ca-chart__rtick" x="[\d.]+" y="[\d.]+" text-anchor="start">₹10k</);
  assert.match(html, /<p class="ca-readout" aria-live="polite"><strong>13 Sept<\/strong><span><i class="cd-dot is-ok"><\/i>24 clicks<\/span><span><i class="cd-dot is-hold"><\/i>1 order<\/span>/);
  assert.doesNotMatch(html, /class="cd-tip/, 'the floating tip waits for a pointer');
  assert.match(html, /Sales by product[\s\S]*?<div class="cd-donut__fig">₹1,48,060\.00<\/div>/);
  assert.match(html, /Amla Juice<\/span><b>38%<\/b>/); assert.match(html, /Others \(2\)<\/span><b>11%<\/b>/);
  assert.match(html, /Conversion funnel[\s\S]*?Link clicks<\/span><b class="ca-funnel__val">1240<\/b>[\s\S]*?transform:scaleX\(1\)[\s\S]*?100%/);
  assert.match(html, /Qualified orders<\/span><b class="ca-funnel__val">55<\/b>[\s\S]*?transform:scaleX\(0\.044\)[\s\S]*?4\.4%/);
  assert.match(html, /Top performing links[\s\S]*?<strong>Default link<\/strong><span class="cd-table__sub">www\.soralife\.shop\/\?ref=AARAV<\/span>[\s\S]*?4\.4%<\/td><td class="ta-r is-earn">₹1,21,000\.00<\/td>/);
  assert.match(html, /trk=DIW7K/);
  assert.match(html, /Sales and commission[\s\S]*?class="ca-bars__sales"[\s\S]*?class="ca-bars__comm"/);
  assert.match(html, /Insights[\s\S]*?<strong>Your best day<\/strong><p>12 Sept brought in ₹6,200\.00 of attributed sales\.<\/p>/);
  assert.match(html, /<a href="\/creator\/campaigns" class="ca-banner__btn">View campaigns/);
  assert.match(html, /These figures are attributed sales, not commission\./);
});

await test('the mockup account (five clicks, nothing sold): real zeros, "—" for the undefined, no invented figure', () => {
  const html = render({ creator: { ...creator, display_name: 'Vikas Shamra', creator_code: 'VIKAS' }, analytics: vikasAnalytics, series: vikas, range: '7d', onRange: () => {} });
  const cards = html.split('<article class="cd-stat').slice(1);
  assert.match(cards[0], /data-count="5">5<[\s\S]*?cd-stat__trend is-new">New<em class="cd-stat__vs">vs previous 7 days<\/em>/);
  assert.match(cards[4], /^ is-zero"[\s\S]*?Conversion rate[\s\S]*?data-count="0">0\.0%</);
  assert.match(cards[5], /^ is-zero"[\s\S]*?Avg order value[\s\S]*?<div class="cd-stat__fig is-money">—<\/div>[\s\S]*?cd-stat__trend is-none">—<\/span>/);
  assert.match(html, /cd-donut__fig">₹0\.00<\/div>/);
  assert.match(html, /<p class="ca-share__empty">Each product/);
  assert.match(html, /Attributed orders<\/span><b class="ca-funnel__val">0<\/b>[\s\S]*?scaleX\(0\)[\s\S]*?ca-funnel__pct">0%</);
  assert.match(html, /<strong>Your busiest day<\/strong>/);
  assert.match(html, /ca-bars is-zero/);
  assert.doesNotMatch(html, /\+100%/);
  // Axis ticks (the ₹1,000 minimum axis) are the only rupee amounts above zero.
  assert.doesNotMatch(text(html.replace(/<svg[\s\S]*?<\/svg>/g, '')), /₹[1-9]/, 'no rupee figure above zero outside the axes');
});

await test('an account with no series yet reads all time, without sparklines, and still renders every panel', () => {
  const html = render({ creator, analytics: busyAnalytics, series: none, range: '7d', onRange: () => {} });
  assert.match(html, /<div class="ca is-all-time">/);
  assert.match(html, /data-count="1240">1240</);
  assert.match(html, /cd-stat__trend is-none">—<\/span>/);
  assert.doesNotMatch(html, /ck-spark/, 'no series → no sparkline');
  assert.match(html, /ca-period is-muted"><span data-icon="clock"><\/span>All-time figures · period breakdown appears as activity is recorded</);
  assert.doesNotMatch(html, /ca-export/, 'nothing to export without the series');
  assert.match(html, /cd-chart ca-chart is-empty/);
  assert.match(html, /Link figures appear here once activity is recorded\./);
  assert.match(html, /<p class="ca-insights__empty">Insights appear once activity is recorded/);
  const empty = render({ creator, analytics: noneAnalytics, series: none, range: '7d', onRange: () => {} });
  assert.match(empty, /ca-funnel is-zero/); assert.match(empty, /The funnel fills in from your first visit onward\./);
  assert.doesNotMatch(empty, /<input|<textarea|<select/);
});

await test('no literal business figure, no random data, no dead control in the page', () => {
  assert.doesNotMatch(source, /Math\.random|mockData|sampleData/);
  assert.doesNotMatch(source, /\b(?:5|10|12|15|20|25|30)\s*%/);
  assert.doesNotMatch(source, /onClick=\{\(\) => \{\}\}/);
  assert.match(source, /analyticsCsv\(series, links\)/, 'export writes the real series');
});

// ============================================================
console.log('\n— The sheet —');
// ============================================================

await test('the analytics styles are scoped, reuse the dashboard card language, and only move transform/opacity', () => {
  const block = css.slice(css.indexOf('.crp.crp--studio .ca {'), css.indexOf('.crp.crp--studio .cp {'));
  assert.ok(block.length > 4000, 'analytics block present');
  for (const cls of ['.ca-head', '.ca-tools', '.ca-stats', '.ca-row--charts', '.ca-row--depth', '.ca-funnel__fill', '.ca-readout', '.ca-insight', '.ca-banner', '.ca-note']) {
    assert.match(block, new RegExp('\\.crp\\.crp--studio ' + cls.replace(/[.]/g, '\\.') + '\\s*[,{]'), `${cls} scoped`);
  }
  assert.match(source, /className="cd-panel ca-perf"/); assert.match(source, /className="cd-range"/); assert.match(source, /className="cd-table ca-table"/);
  for (const m of block.matchAll(/transition:\s*([^;]+);/g)) {
    for (const part of m[1].replace(/\([^)]*\)/g, '').split(',')) assert.match(part.trim(), /^(?:transform|opacity)\b/, `transition on ${part.trim()}`);
  }
  assert.doesNotMatch(block, /@keyframes|animation:/);
  assert.match(block, /\.ca-funnel__fill \{[^}]*transform-origin: left center; transition: transform/);
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  const rmBlock = rm.slice(0, rm.indexOf('\n}'));
  assert.match(rmBlock, /\.ca-funnel__fill \{ transition: none; \}/);
  assert.match(rmBlock, /\.ca-export:hover, \.crp\.crp--studio \.ca-banner__btn:hover \{ transform: none; \}/);
  assert.doesNotMatch(block, /violet|purple|#6437FF|#4A24CC/i);
});

await test('390px is designed: cards one-up, rows one-up, the toggle full width, the banner stacked', () => {
  const m1199 = [...css.matchAll(/@media \(max-width: 1199px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  const m1019 = [...css.matchAll(/@media \(max-width: 1019px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  const m599 = [...css.matchAll(/@media \(max-width: 599px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(m1199, /\.ca-row--charts \.ca-perf \{ grid-column: 1 \/ -1; \}/);
  assert.match(m1199, /\.ca-row--depth \.ca-links \{ grid-column: 1 \/ -1; \}/);
  assert.match(m1019, /\.ca-head \{ flex-direction: column; align-items: stretch; \}/);
  assert.match(m1019, /\.ca-stats \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(m599, /\.ca-stats \{ grid-template-columns: minmax\(0, 1fr\); gap: 12px; \}/);
  assert.match(m599, /\.ca-row--charts, \.crp\.crp--studio \.ca-row--depth \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(m599, /\.ca-tools \.cd-range \{ width: 100%; \}/);
  assert.match(m599, /\.ca-banner \{ flex-direction: column;/);
  assert.match(m599, /\.cd-chart:not\(\.is-hover\) \.cd-tip \{ display: none; \}/, 'the dashboard rule already hides the tip until touched');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
