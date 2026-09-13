// ============================================================
// Creator portal — dark premium redesign. Offline suite.
//
// The stylesheet as text (scope, motion budget, reduced motion, no purple),
// the bundle order, and the real portal rendered with react-dom/server
// against fixtures (mark, rank, count-ups, reveal, glass hooks).
// NO NETWORK, NO DATABASE, NO BROWSER. (scripts/audit-portal-colors.mjs is
// the computed-style companion; it needs Chrome and a file:// page.)
//
//   node scripts/test-creator-dark.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';
import * as rewardRules from '../src/lib/creatorRewards.js';
import * as kycRules from '../src/lib/kycDocuments.js';
import { money2 } from '../src/lib/format.js';
import { buildTrackingUrl } from '../src/lib/creatorLinkUtils.js';
import * as seriesRules from '../src/lib/creatorSeries.js';

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
const Link = ({ to, children, ...props }) => h('a', { ...props, href: to }, children);
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const DARK = read('src/styles/creator-dark.css');
const dark = stripComments(DARK);

// ============================================================
console.log('\n— Stylesheet: scope, palette, motion —');
// ============================================================

await test('every rule in creator-dark.css is scoped to .crp.crp--dark (keyframes and media blocks aside)', () => {
  // Flatten @media blocks, then check each selector list.
  const body = dark.replace(/@media[^{]+\{([\s\S]*?)\}\s*\}/g, '$1').replace(/@keyframes[^{]+\{[\s\S]*?\}\s*\}/g, '');
  const selectors = [...body.matchAll(/(^|\})\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].replace(/:is\([^)]*\)/g, ':is()').trim()).filter(Boolean);
  assert.ok(selectors.length > 80, `only ${selectors.length} selectors parsed`);
  for (const sel of selectors) {
    for (const part of sel.split(',')) assert.ok(part.trim().startsWith('.crp.crp--dark'), `unscoped selector: ${part.trim()}`);
  }
});

await test('purple is gone: no violet literal in the dark layer, and every literal the earlier layers used is overridden', () => {
  assert.doesNotMatch(dark, /#6437FF|#4B2AE0|#4A24CC|100,\s*55,\s*255|violet-|#8B5CF6|#7C3AED/i);
  assert.match(dark, /--c-violet:\s*var\(--d-gold\)/, 'the token itself is re-pointed at gold');
  // The three places creator-expressive hard-codes violet instead of using the token.
  const expressive = stripComments(read('src/styles/creator-expressive.css'));
  const literalLines = expressive.split('\n').filter((l) => /#6437FF|#4B2AE0|#4A24CC|100,\s*55,\s*255/.test(l));
  assert.ok(literalLines.length >= 3, 'expected the known violet literals in creator-expressive');
  assert.match(dark, /\.crp\.crp--dark \.ck-share \{[\s\S]*?background:[\s\S]*?\}/, 'share band background overridden');
  assert.match(dark, /\.crp\.crp--dark \.crp__navitem\.active \{[^}]*background/, 'active nav background overridden');
  assert.match(dark, /\.crp\.crp--dark \.ck-pill\.ck-tone-brand\s*\{[^}]*color:[^}]*background/, 'brand pill overridden');
  assert.match(dark, /\.crp\.crp--dark \.ck-band__cell\[data-tone="brand"\]::before \{ background: var\(--d-gold\); \}/);
});

await test('brand green and gold carry the accents; rank colours sit beside the brand tokens', () => {
  assert.match(dark, /--d-gold: #C79A45/); assert.match(dark, /--d-gold-2: #E4C482/);
  assert.match(dark, /--d-green: #3B6E56/); assert.match(dark, /--d-green-2: #85B49F/);
  assert.match(dark, /--d-bg: #16231C/, 'mid-dark forest ground');
  // Three depths, each its own value.
  const l1v = /--d-l1: (linear-gradient\([^;]+)/.exec(dark)[1]; const l2v = /--d-l2: (linear-gradient\([^;]+)/.exec(dark)[1];
  assert.notEqual(l1v, l2v); assert.match(dark, /--d-hl: inset 0 1px 0 rgba\(255, 255, 255, 0\.07\)/, 'inner highlight');
  assert.match(dark, /--d-lift: 0 14px 34px rgba\(0, 0, 0, 0\.28\)/, 'raised cards lift off the panel layer');
  assert.match(dark, /\.crp\.crp--dark \.crp__grain \{[^}]*feTurbulence/, 'grain on the ground');
  // Status colour carries meaning.
  assert.match(dark, /\.ck-band__cell\[data-tone="ok"\] \.ck-band__fig\s+\{ color: var\(--d-emerald\); \}/);
  assert.match(dark, /\.ck-band__cell\[data-tone="hold"\] \.ck-band__fig \{ color: var\(--d-amber\); \}/);
  assert.match(dark, /\.ck-band__cell\[data-tone="bad"\] \.ck-band__fig\s+\{ color: var\(--d-red\); \}/);
  assert.match(dark, /\.ck-balance:not\(\.is-zero\) \.ck-balance__fig \{ color: var\(--d-emerald\); \}/);
  assert.match(dark, /\.is-zero \.ck-band__fig, [^{]*\.ck-balance\.is-zero \.ck-balance__fig \{ color: var\(--d-ink-3\); \}/, 'a zero is quiet whatever its meaning');
  for (const r of ['rise', 'premium', 'elite', 'royale', 'prime', 'supreme', 'crown']) {
    assert.match(dark, new RegExp(`--rank-${r}: #[0-9A-F]{6}`, 'i'), r);
    assert.match(dark, new RegExp(`\\.crp\\.crp--dark\\[data-rank="${r}"\\]\\s*\\{ --rank: var\\(--rank-${r}\\);\\s*--rank-glow: rgba`), `${r} page wash`);
  }
  // Intensifies from Rise to Crown: the glow alpha rises monotonically.
  const alphas = ['rise', 'premium', 'elite', 'royale', 'prime', 'supreme', 'crown'].map((r) => Number(new RegExp(`\\.crp\\.crp--dark\\[data-rank="${r}"\\][^}]*--rank-glow: rgba\\([^)]*,\\s*([\\d.]+)\\)`).exec(dark)[1]));
  assert.ok(alphas[6] > alphas[0] && alphas[6] >= alphas[5] && alphas[5] >= alphas[3], `glow alphas ${alphas.join(', ')}`);
  assert.match(dark, /--rank-rise: #85B49F/, 'Rise is forest-300'); assert.match(dark, /--rank-crown: #F0C169/, 'Crown is honey-400');
});

await test('the motion budget is transform and opacity — every transition and keyframe', () => {
  for (const m of dark.matchAll(/transition:\s*([^;]+);/g)) {
    const v = m[1].trim(); if (v === 'none' || v === 'none !important') continue;
    for (const part of v.replace(/cubic-bezier\([^)]*\)/g, 'ease').split(',')) assert.match(part.trim(), /^(transform|opacity)\b/, `transition: ${part.trim()}`);
  }
  for (const m of dark.matchAll(/transition-property:\s*([^;]+);/g)) assert.equal(m[1].trim(), 'transform, opacity');
  for (const kf of dark.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}\s*\}/g)) {
    const props = [...kf[2].matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]);
    assert.ok(props.length > 0, `${kf[1]} has no properties`);
    for (const p of props) assert.ok(['transform', 'opacity'].includes(p), `${kf[1]} animates ${p}`);
  }
  assert.match(dark, /@keyframes crp-ambient/); assert.match(dark, /@keyframes ck-shimmer/); assert.match(dark, /@keyframes ctier-fill/);
  // The reveal hides with opacity + translateY only.
  assert.match(dark, /\.crp\.crp--dark\.js-reveal :is\([^)]*\):not\(\.is-in\) \{\s*opacity: 0; transform: translateY\(18px\);\s*\}/);
  // Nothing animates a layout property.
  assert.doesNotMatch(dark, /transition:[^;]*(width|height|margin|padding|top|left|right|bottom|font-size)\b/);
});

await test('prefers-reduced-motion switches every animation and transition off', () => {
  const m = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(dark);
  assert.ok(m, 'reduced-motion block missing');
  assert.match(m[1], /\.crp__ambient[^{]*\{ animation: none; \}/);
  assert.match(m[1], /\.ck-rank\.is-current::after \{ display: none; \}/);
  assert.match(m[1], /transition: none !important/);
  // And the portal's own JS honours it: no reveal, no count-up.
  assert.match(read('src/pages/CreatorPortal.jsx'), /prefers-reduced-motion: reduce[\s\S]*?return undefined;[\s\S]*?IntersectionObserver\(/);
  assert.match(read('src/components/creator/CreatorUI.jsx'), /prefers-reduced-motion: reduce/);
});

await test('frosted glass is on the structural panels only, and only in the portal', () => {
  const l1 = /\/\* L1[^*]*\*\/\n([^{]*)\{([^}]*)\}/.exec(DARK); const l2 = /\/\* L2[^*]*\*\/\n([^{]*)\{([^}]*)\}/.exec(DARK);
  assert.ok(l1 && l2, 'L1 / L2 rules missing');
  assert.match(l1[2], /backdrop-filter: blur\(16px\)/); assert.match(l2[2], /backdrop-filter: blur\(20px\)/);
  assert.match(l1[2], /background: var\(--d-l1\); border: 1px solid var\(--d-l1-line\); box-shadow: var\(--d-hl\)/);
  assert.match(l2[2], /background: var\(--d-l2\); border: 1px solid var\(--d-l2-line\); box-shadow: var\(--d-hl-2\), var\(--d-lift\)/);
  const glassSelectors = [...l1[1].split(','), ...l2[1].split(',')].map((s) => s.trim());
  for (const structural of ['.crp__panel', '.ck-band', '.ck-balance', '.ck-share', '.ctier', '.ctier-rewards', '.ctier-board']) {
    assert.ok(glassSelectors.some((s) => s.endsWith(' ' + structural)), `${structural} is glass`);
  }
  for (const raised of ['.ck-balance', '.ck-share', '.ctier', '.crp__payout-bal']) assert.ok(l2[1].includes(raised), `${raised} is raised (L2)`);
  for (const row of ['.ck-step', '.crp__item', '.crp__table', '.ck-section', '.lb__row', '.ctier-ladder__row', '.ctier-option']) {
    assert.ok(!glassSelectors.some((s) => s.endsWith(' ' + row)), `${row} must not be a glass card (no card soup)`);
  }
  assert.doesNotMatch(read('src/styles/leaderboard.css'), /backdrop-filter/, 'the storefront board stays flat');
  assert.match(dark, /\.crp\.crp--dark \.crp__top \{[^}]*backdrop-filter: blur\(18px\)/, 'sticky glass header');
});

await test('Fraunces for headings, Inter for figures; the ambient wash and the rank glow exist', () => {
  assert.match(dark, /\.crp\.crp--dark \.serif, \.crp\.crp--dark h1, \.crp\.crp--dark h2, \.crp\.crp--dark h3,[\s\S]*?font-family: var\(--font-display, 'Fraunces', Georgia, serif\)/);
  assert.match(dark, /\.crp\.crp--dark \.ck-section__title \{\s*font-family: var\(--font-display/);
  assert.match(dark, /\.crp\.crp--dark \.crp__panel-h, \.crp\.crp--dark \.ck-band__label,[\s\S]*?font-family: 'Inter'/);
  assert.match(dark, /\.crp\.crp--dark \.crp__ambient \{[^}]*position: fixed[^}]*radial-gradient\([^)]*var\(--rank-glow\)/);
  assert.match(dark, /\.crp\.crp--dark \.ck-rank__glow \{[^}]*radial-gradient\(closest-side, var\(--rank\)/);
  assert.match(dark, /\.crp\.crp--dark \.ctier__glow \{[^}]*var\(--rank-glow\)/);
  assert.match(dark, /\.crp\.crp--dark \.ck-rank\.is-current::after \{[^}]*animation: ck-shimmer/);
  assert.match(dark, /\.crp\.crp--dark \.ctier__fill \{[^}]*animation: ctier-fill/);
});

await test('the dark layer is bundled last, after creator, expressive and tier; the storefront bundle never includes it', () => {
  const b = read('build/build-css.mjs');
  const deferred = b.slice(b.indexOf('const DEFERRED'), b.indexOf('];', b.indexOf('const DEFERRED')));
  const order = ['creator.css', 'creator-expressive.css', 'creator-tier.css', 'creator-dark.css'].map((f) => deferred.indexOf(f));
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), `order ${order}`);
  const storefront = b.slice(b.indexOf('const STOREFRONT'), b.indexOf('const DEFERRED'));
  assert.ok(!storefront.includes('creator-dark.css') && !storefront.includes('creator-tier.css'));
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
const T = {};
for (const n of ['CreatorTier', 'TierStanding', 'WithdrawalsNotice', 'RankBadge']) T[n] = component('src/components/creator/CreatorTier.jsx', n, tierDeps);
const CreatorEarnings = component('src/components/creator/CreatorEarnings.jsx', 'CreatorEarnings', { Icon, money2, Balance: UI.Balance, Cell: UI.Cell, CountUp: UI.CountUp, cumulative: seriesRules.cumulative });
const CreatorHowItWorks = component('src/components/creator/CreatorHowItWorks.jsx', 'CreatorHowItWorks', { Icon, money2 });
const CreatorPayouts = component('src/components/creator/CreatorPayouts.jsx', 'CreatorPayouts', { Icon, money2, WithdrawalsNotice: T.WithdrawalsNotice, ...kycRules });
const CreatorTermsPanel = component('src/components/creator/CreatorTermsPanel.jsx', 'CreatorTermsPanel', {});
const TermsUpdatedLine = component('src/components/creator/CreatorTermsPanel.jsx', 'TermsUpdatedLine', {});
const portalFor = (tab) => component('src/pages/CreatorPortal.jsx', 'CreatorPortal', {
  Link, useNavigate: () => () => {}, useParams: () => ({ tab }), Icon, SparrowMark, CopyButton,
  useCustomerAuth: () => ({ session: { user: { id: 'u' } }, loading: false, signOut: () => {} }),
  claimCreatorAccount: noop, getMyCreator: noop, getMyCampaigns: async () => [], getMyLinks: async () => [], buildTrackingUrl,
  getMyCreatorAnalytics: noop, getMyCreatorEarnings: noop, getMyKyc: noop, submitKyc: noop, uploadKycDocument: noop, requestPayout: noop,
  getMyPayouts: async () => [], getMyCreatorStanding: noop, getMyCreatorRewards: noop, claimLevelReward: noop, getCreatorLeaderboard: async () => [], getMyActivitySeries: noop,
  getCreatorTerms: async () => null, termsArePublished: () => false, getMyTermsAcceptance: async () => null, acceptCreatorTerms: noop,
  money2, CreatorEarnings, CreatorHowItWorks, ...UI, CreatorPayouts, ...T, rankSlot: tiers.rankSlot, CreatorTermsPanel, TermsUpdatedLine, ...seriesRules,
});
const creator = { id: 'c1', display_name: 'Aarav Sethi', creator_code: 'AARAV', status: 'active', default_commission_rate: 10, default_attribution_window_days: 30, joined_at: '2026-03-02T00:00:00Z', email: 'a@x.com' };
const standing = { ok: true, level: 7, rank: 'Royale', rate: 16, threshold: 125000, next_level: 8, next_threshold: 150000, next_rate: 17, lifetime_confirmed_sales: 138420, pending_sales: 9640, pending_commission: 1542.4, confirmed_commission: 19188.6, leaderboard_position: 7, leaderboard_total: 100, withdrawals_open: false, beyond_step: 25000, ladder: tiers.DEFAULT_LADDER.map((l) => ({ ...l })) };
const earnings = { ok: true, available: 12640.5, held: 1542.4, reserved: 0, paid: 6548.1, reversed: 0, commission_rate: 10, settlement_hold_days: 7, min_payout: 500, payout_day: 1, this_month: {}, clicks: 1240, top_products: [], monthly_history: [] };
const initial = { creator, campaigns: [], links: [], analytics: { ok: true, clicks: 1240, attributed_orders: 58, products_sold: 131, attributed_sales: 148060 }, earnings, kyc: { identity_status: 'verified' }, payouts: [], standing, rewards: { ok: true, level: 7, claims: [], claimable: [] }, leaderboard: [], terms: null };
const render = (tab, seed = initial) => renderToStaticMarkup(h(portalFor(tab), { initial: seed }));

await test('the root is the dark room and carries the rank; the header carries the hummingbird and the wordmark', () => {
  const html = render('dashboard');
  assert.match(html, /<div class="crp crp--dark" data-rank="royale">/);
  assert.match(html, /<span class="crp__ambient" aria-hidden="true"><\/span>/);
  assert.match(html, /class="crp__brand-mark"><svg width="34" height="25.5" viewBox="0 0 44 32"/, 'the SparrowMark, light variant, in the header');
  assert.match(html, /<strong>SORA LIFE<\/strong><em>Creator Program<\/em>/);
  assert.doesNotMatch(html, />SL</, 'the old two-letter block is gone');
  assert.match(html, /crp__top-right"><span class="ck-rank is-sm" data-rank="royale">/, 'rank badge beside the name');
});

await test('rank badge: current rank shimmers, glow element present, colour slot from the rank name', () => {
  const badge = renderToStaticMarkup(h(T.RankBadge, { rank: 'Crown', level: 14, current: true }));
  assert.match(badge, /class="ck-rank is-md is-current" data-rank="crown"/);
  assert.match(badge, /<span class="ck-rank__glow" aria-hidden="true"><\/span><span class="ck-rank__label">Crown<\/span><span class="ck-rank__lv">L14<\/span>/);
  assert.doesNotMatch(renderToStaticMarkup(h(T.RankBadge, { rank: 'Rise', level: 1 })), /is-current/);
  assert.equal(renderToStaticMarkup(h(T.RankBadge, { rank: null })), '');
  const dash = render('dashboard');
  assert.match(dash, /<span class="ck-idbar__k">Rank<\/span><span class="ck-idbar__v"><span class="ck-rank is-md is-current" data-rank="royale">/, 'the identity bar shows the current rank with shimmer');
  assert.equal((dash.match(/is-current/g) || []).length, 1, 'only the creator\'s own present rank shimmers');
});

await test('figures count up: rendered with the final value, tagged for the client, never a zero on the server', () => {
  const dash = render('dashboard');
  assert.match(dash, /<span class="ck-count" data-count="12640.5"><span class="ck-cur">₹<\/span><span class="ck-int">12,640<\/span><span class="ck-dec">\.50<\/span><\/span>/, 'money is split: sign, rupees, paise');
  assert.match(dash, /<span class="ck-count" data-count="1240">1240<\/span>/, 'a count is not split');
  assert.match(dash, /data-count="148060"><span class="ck-cur">₹<\/span><span class="ck-int">1,48,060<\/span>/);
  const earn = render('earnings');
  assert.match(earn, /data-count="6548.1"><span class="ck-cur">₹<\/span><span class="ck-int">6,548<\/span><span class="ck-dec">\.10</);
  const tier = render('tier');
  assert.match(tier, /data-count="138420"><span class="ck-cur">₹<\/span><span class="ck-int">1,38,420</);
  assert.match(tier, /data-count="19188.6"><span class="ck-cur">₹<\/span><span class="ck-int">19,188</);
});

await test('reveal: nothing is hidden in server output; the class the CSS keys on is only ever added by the browser effect', () => {
  for (const tab of ['dashboard', 'earnings', 'tier']) {
    const html = render(tab);
    assert.doesNotMatch(html, /js-reveal/); assert.doesNotMatch(html, /is-in"/); assert.doesNotMatch(html, /--rv-i/);
  }
  const src = read('src/pages/CreatorPortal.jsx');
  assert.match(src, /root\.classList\.add\('js-reveal'\)/);
  assert.match(src, /const REVEAL_SELECTOR = '\.ck-idbar, \.ck-share, \.ck-section, \.ck-balance, \.ctier, \.ctier-rewards, \.ctier-history, \.ctier-board, \.ctier-ladder, \.ctier-notice, \.crp__panel, \.crp__payout, \.crp-hiw'/);
  // The CSS keys on exactly the same list.
  const list = /REVEAL_SELECTOR = '([^']+)'/.exec(src)[1];
  assert.ok(dark.includes(`:is(${list}):not(.is-in)`), 'CSS and observer disagree on what reveals');
});

await test('the progress bar is a transform with a keyframe; the standing card carries its glow', () => {
  const tier = render('tier');
  assert.match(tier, /<section class="ctier sl-dark" data-rank="royale" aria-label="Your tier"><span class="ctier__glow" aria-hidden="true"><\/span>/);
  assert.match(tier, /class="ctier__fill" style="transform:scaleX\(0\.5368\)"/, '(138420 − 125000) / (150000 − 125000)');
  assert.match(tier, /Level 8 · unlocks <strong>17%<\/strong>/);
});

await test('the earnings page quotes the tier rate and the delivery-based hold, not the floor', () => {
  const earn = render('earnings');
  assert.match(text(earn), /Commission rate 16% · Royale L7/);
  assert.match(text(earn), /Settlement hold 7 days after an order is delivered/);
  assert.match(text(earn), /commission is calculated at 16% of the eligible sale value — your current tier rate/);
  assert.match(text(earn), /Held until 7 days after the order is delivered/);
  assert.doesNotMatch(text(earn), /Your rate is set by SORA LIFE/);
});

await test('the dashboard hero (share band) is green and gold: no gradient literal survives in its dark rule', () => {
  const rule = /\.crp\.crp--dark \.ck-share \{([\s\S]*?)\n\}/.exec(dark)[1];
  assert.match(rule, /rgba\(59, 110, 86/); assert.match(rule, /rgba\(199, 154, 69/);
  assert.doesNotMatch(rule, /#6437FF|#4B2AE0/);
  const dash = render('dashboard');
  assert.match(dash, /<section class="ck-share">/);
});

await test('nothing here reaches the storefront or the account page: creator-dark only styles .crp.crp--dark, and .crob is untouched', () => {
  assert.doesNotMatch(dark, /\.crob\b/);
  assert.doesNotMatch(dark, /\.v2-|\.hm-|\.ftr\b|\.page-main|:root|(^|[\s,}])body\b/m);
  const onboarding = read('src/pages/account/CreatorOnboarding.jsx');
  assert.doesNotMatch(onboarding, /crp--dark/);
});

// ============================================================
console.log('\n— It reads as money: charts, hierarchy, the empty state —');
// ============================================================

const WEEKS = ['2026-06-29', '2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14'];
const series = { ok: true, weeks: 12, series: WEEKS.map((week, i) => ({ week, clicks: 10 + i, orders: i % 3, products: i, sales: i * 100, commission: i * 10 })) };

await test('every performance and earnings figure carries a sparkline — with data and at zero', () => {
  const dash = render('dashboard', { ...initial, series });
  assert.equal((dash.match(/class="ck-spark ck-tone-(info|ok)"/g) || []).length, 4, 'four performance sparklines with data');
  assert.match(dash, /<div class="ck-balance"><div class="ck-balance__main"><div class="ck-balance__figwrap">[\s\S]*?<div class="ck-balance__spark"><svg class="ck-spark ck-tone-ok/, 'the balance carries its 12-month line');
  assert.match(dash, /Commission, last 12 months/);
  const empty = { ...initial, series: null,
    analytics: { ok: true, clicks: 0, attributed_orders: 0, products_sold: 0, attributed_sales: 0, top_products: [] },
    earnings: { ...earnings, available: 0, held: 0, reserved: 0, paid: 0, monthly_history: [] } };
  const zero = render('dashboard', empty);
  assert.equal((zero.match(/class="ck-spark ck-tone-(info|ok) is-empty is-flat"/g) || []).length, 5, 'five level baselines: four performance, one balance');
  assert.match(zero, /aria-label="No activity yet"/);
  assert.equal((zero.match(/class="ck-band__cell is-zero"/g) || []).length, 7, 'every zero cell is marked quiet');
  assert.match(zero, /class="ck-balance is-zero"/);
  assert.match(text(zero), /Nothing has cleared yet\. Commission lands here after delivery and the settlement hold/);
  assert.doesNotMatch(zero, /ck-tone-(hold|bad) is-empty/, 'held and paid cells carry no chart (no series for them)');
});

await test('the sparkline is one path and one area, hand-built; a flat series is a dashed baseline', async () => {
  const { sparkGeometry } = seriesRules;
  const g = sparkGeometry([0, 2, 1, 4], { width: 96, height: 28 });
  assert.match(g.line, /^M2 26 L32\.7 14 L63\.3 20 L94 2$/); assert.equal(g.flat, false); assert.equal(g.empty, false);
  assert.match(g.area, /Z$/);
  const z = sparkGeometry([0, 0, 0], { width: 96, height: 28 });
  assert.equal(z.flat, true); assert.equal(z.empty, true); assert.match(z.line, /^M2 26 L48 26 L94 26$/, 'zeros sit on the baseline, not the middle');
  const html = renderToStaticMarkup(h(UI.Sparkline, { points: [0, 0, 0], tone: 'ok' }));
  assert.match(html, /<svg class="ck-spark ck-tone-ok is-empty is-flat"[^>]*role="img" aria-label="No activity yet"/);
  assert.equal((html.match(/<path/g) || []).length, 2); assert.match(html, /<circle class="ck-spark__dot"/);
  assert.equal(renderToStaticMarkup(h(UI.Sparkline, { points: [] })), '');
  assert.match(dark, /\.ck-spark\.is-empty \.ck-spark__line \{ stroke-dasharray: 2 3;/);
  assert.doesNotMatch(read('src/components/creator/CreatorUI.jsx'), /from '(recharts|chart\.js|d3|victory|nivo)/);
});

await test('weekly and monthly series are fixed length, zero-filled, oldest first; the RPC is optional', () => {
  const { weeklySeries, monthlySeries, cumulative } = seriesRules;
  const w = weeklySeries(series);
  assert.equal(w.clicks.length, 12); assert.equal(w.clicks[11], 21); assert.equal(w.available, true);
  const none = weeklySeries({ ok: false });
  assert.deepEqual(none.clicks, Array(12).fill(0)); assert.equal(none.available, false);
  const short = weeklySeries({ ok: true, series: [{ week: 'x', clicks: 5 }] });
  assert.deepEqual(short.clicks, [...Array(11).fill(0), 5], 'a short series is right-aligned to now');
  const m = monthlySeries([{ month: '2026-08', commission: 100 }, { month: '2026-09', commission: 50 }], 12, new Date(2026, 8, 13));
  assert.equal(m.keys.length, 12); assert.equal(m.keys[11], '2026-09'); assert.deepEqual(m.values.slice(-2), [100, 50]);
  assert.deepEqual(cumulative([1, 2, 3]), [1, 3, 6]);
  assert.match(read('src/lib/creatorApi.js'), /rpc\('my_creator_activity_series', \{ p_weeks: weeks \}\)/);
  const sql = read('supabase/migrations/0032_creator_activity_series.sql');
  assert.match(sql, /v_cid := public\.current_creator_id\(\)/); assert.match(sql, /revoke all on function public\.my_creator_activity_series\(integer\) from public, anon/);
  assert.doesNotMatch(sql, /insert into|update |delete from/, 'read-only');
});

await test('the empty state is designed: an amber waiting dot, a real title, and the next step marked', () => {
  const empty = renderToStaticMarkup(h(UI.Empty, { tone: 'info', eyebrow: 'Analytics status', title: 'No attributed orders yet', body: 'Soon.', points: ['a', 'b'] }));
  assert.match(empty, /class="ck-empty ck-tone-info" data-state="waiting"/);
  assert.match(empty, /<span class="ck-empty__eyebrow"><span class="ck-empty__dot" aria-hidden="true"><\/span>Analytics status<\/span>/);
  assert.match(dark, /\.ck-empty__dot \{[^}]*animation: ck-pulse/);
  const kf = /@keyframes ck-pulse \{([^}]*\}[^}]*)\}/.exec(dark)[1];
  assert.doesNotMatch(kf, /width|height|background|color/);
  const zero = render('dashboard', { ...initial, series: null, analytics: { ok: true, clicks: 0, attributed_orders: 0, products_sold: 0, attributed_sales: 0 }, earnings: { ...earnings, available: 0, held: 0, paid: 0 } });
  assert.match(zero, /class="ck-step  is-next ck-tone-neutral"/, "the dashboard points at the next step");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
