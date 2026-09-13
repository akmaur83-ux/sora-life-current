// ============================================================
// SSR SCREENSHOTS — creator portal (dashboard, earnings, analytics, tier) + homepage board
//
//   node scripts/ssr-portal-shots.mjs
//
// The real components, rendered with react-dom/server against FIXTURE data
// (CreatorPortal's `initial` prop seeds every piece of state, so no session,
// no network, no loaders). The built stylesheets are inlined and each page is
// photographed at 390 and 1440 from a file:// URL in headless Chrome with
// every http(s) request blocked. Nothing here talks to a server.
//
// Motion note: the reveal classes are added only by a browser effect, so the
// capture shows every block settled; the progress bar and count-ups have
// finished by the time the frame is taken.
// ============================================================
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';
import * as rewardRules from '../src/lib/creatorRewards.js';
import * as kycRules from '../src/lib/kycDocuments.js';
import { money2 } from '../src/lib/format.js';
import { buildTrackingUrl } from '../src/lib/creatorLinkUtils.js';
import * as seriesRules from '../src/lib/creatorSeries.js';
import * as activityRules from '../src/lib/creatorActivity.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = resolve(ROOT, 'reports/creator-portal');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

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
  return new Function(...Object.keys(scope), `${code}
; return ${name};`)(...Object.values(scope));
}
const h = React.createElement;
const Link = ({ to, children, ...props }) => h('a', { ...props, href: to }, children);
const noop = async () => ({ ok: true });

// ---- real leaf components, loaded with their real deps -------------------
const Icon = component('src/components/Icon.jsx', 'Icon', {});
const SparrowMark = component('src/components/Logo.jsx', 'SparrowMark', { Link, branding: { siteName: 'SORA LIFE', tagline: 'Wellness marketplace' } });
const CopyButton = component('src/components/CopyButton.jsx', 'CopyButton', { Icon });
const UI = {};
for (const n of ['Section', 'Empty', 'Pill', 'Step', 'Band', 'Cell', 'Balance', 'IdBar', 'CountUp', 'Metric', 'Sparkline']) UI[n] = component('src/components/creator/CreatorUI.jsx', n, { Icon, sparkGeometry: seriesRules.sparkGeometry });
const LeaderboardList = component('src/components/LeaderboardList.jsx', 'LeaderboardList', { ...tiers });
const tierDeps = { Link, Icon, LeaderboardList, money2, CountUp: UI.CountUp, ...tiers, ...rewardRules };
const CreatorTier = component('src/components/creator/CreatorTier.jsx', 'CreatorTier', tierDeps);
const TierStanding = component('src/components/creator/CreatorTier.jsx', 'TierStanding', tierDeps);
const WithdrawalsNotice = component('src/components/creator/CreatorTier.jsx', 'WithdrawalsNotice', tierDeps);
const RankBadge = component('src/components/creator/CreatorTier.jsx', 'RankBadge', tierDeps);
const CreatorDashboard = component('src/components/creator/CreatorDashboard.jsx', 'CreatorDashboard', { Link, Icon, CountUp: UI.CountUp, Sparkline: UI.Sparkline, money2, ...tiers, ...seriesRules, ...activityRules });
const RewardChooser = component('src/components/creator/CreatorTier.jsx', 'RewardChooser', tierDeps);
const RewardHistory = component('src/components/creator/CreatorTier.jsx', 'RewardHistory', tierDeps);
const CreatorTierPage = component('src/components/creator/CreatorTierPage.jsx', 'CreatorTierPage', { Link, Icon, LeaderboardList, CountUp: UI.CountUp, RewardChooser, RewardHistory, money2, ...tiers, ...rewardRules, ...seriesRules });
const CreatorEarnings = component('src/components/creator/CreatorEarnings.jsx', 'CreatorEarnings', { Icon, money2, Balance: UI.Balance, Cell: UI.Cell, CountUp: UI.CountUp, cumulative: seriesRules.cumulative });
const CreatorHowItWorks = component('src/components/creator/CreatorHowItWorks.jsx', 'CreatorHowItWorks', { Icon, money2 });
const CreatorPayouts = component('src/components/creator/CreatorPayouts.jsx', 'CreatorPayouts', { Icon, money2, WithdrawalsNotice, ...kycRules });
const CreatorTermsPanel = component('src/components/creator/CreatorTermsPanel.jsx', 'CreatorTermsPanel', {});
const TermsUpdatedLine = component('src/components/creator/CreatorTermsPanel.jsx', 'TermsUpdatedLine', {});
const RankMedallion = component('src/components/creator/CreatorTierPage.jsx', 'RankMedallion', { Link, Icon, LeaderboardList, CountUp: UI.CountUp, RewardChooser, RewardHistory, money2, ...tiers, ...rewardRules, ...seriesRules });
const CreatorProfilePage = component('src/components/creator/CreatorProfilePage.jsx', 'CreatorProfilePage', { Link, Icon, CopyButton, CreatorTermsPanel, TermsUpdatedLine, RankMedallion, rankSlot: tiers.rankSlot });
const initialsOf = component('src/components/creator/CreatorProfilePage.jsx', 'initialsOf', { Link, Icon, CopyButton, CreatorTermsPanel, TermsUpdatedLine, RankMedallion, rankSlot: tiers.rankSlot });

const portalFor = (tab) => component('src/pages/CreatorPortal.jsx', 'CreatorPortal', {
  Link, useNavigate: () => () => {}, useParams: () => ({ tab }),
  Icon, SparrowMark, CopyButton,
  useCustomerAuth: () => ({ session: { user: { id: 'u' } }, loading: false, signOut: () => {} }),
  claimCreatorAccount: noop, getMyCreator: noop, getMyCampaigns: async () => [], getMyLinks: async () => [], buildTrackingUrl,
  getMyCreatorAnalytics: noop, getMyCreatorEarnings: noop, getMyKyc: noop, submitKyc: noop, uploadKycDocument: noop, requestPayout: noop,
  getMyPayouts: async () => [], getMyCreatorStanding: noop, getMyCreatorRewards: noop, claimLevelReward: noop, getCreatorLeaderboard: async () => [], getMyActivitySeries: noop, getMyRecentClicks: async () => [],
  getCreatorTerms: async () => null, termsArePublished: () => false, getMyTermsAcceptance: async () => null, acceptCreatorTerms: noop,
  money2, CreatorEarnings, CreatorHowItWorks, ...UI, CreatorPayouts, CreatorTier, TierStanding, WithdrawalsNotice, RankBadge,
  rankSlot: tiers.rankSlot, ...seriesRules, ...activityRules, CreatorDashboard, CreatorTierPage, CreatorProfilePage, initialsOf, getLevelRewardsCatalog: async () => [],
});

// ---- fixtures ---------------------------------------------------------------
const NAMES = ['Anjali Sharma', 'Riya Mehta', 'Kabir Rao', 'Neha Iyer', 'Devansh Kulkarni', 'Meera Pillai', 'Aarav Sethi', 'Sana Qureshi', 'Ishaan Bhatt', 'Tara Menon',
  'Vihaan Joshi', 'Zoya Khan', 'Rohan Desai', 'Priya Nair', 'Arjun Verma', 'Diya Chawla', 'Yash Malhotra', 'Nisha Reddy', 'Kunal Kapoor', 'Ananya Bose'];
const RANK_FOR_LEVEL = (l) => tiers.DEFAULT_LADDER.find((x) => x.level === Math.min(l, 14))?.rank || 'Crown';
const LEVELS = [16, 15, 13, 11, 9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 1];
const leaderboard = Array.from({ length: 100 }, (_, i) => {
  const level = LEVELS[i] ?? 1;
  return { rank_position: i + 1, display_name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ''), rank_name: RANK_FOR_LEVEL(level), level };
});
const creator = { id: 'c1', display_name: 'Aarav Sethi', creator_code: 'AARAV', status: 'active', default_commission_rate: 10, default_attribution_window_days: 30, joined_at: '2026-03-02T00:00:00Z', email: 'a@example.com' };
const standing = {
  ok: true, level: 7, rank: 'Royale', rate: 16, threshold: 125000, next_level: 8, next_threshold: 150000, next_rate: 17,
  lifetime_confirmed_sales: 138420, pending_sales: 9640, pending_commission: 1542.4, confirmed_commission: 19188.6,
  leaderboard_position: 7, leaderboard_total: 100, withdrawals_open: false, beyond_step: 25000,
  ladder: tiers.DEFAULT_LADDER.map((l) => ({ level: l.level, rank: l.rank, threshold: l.threshold, rate: l.rate })),
};
const rewards = {
  ok: true, level: 7,
  claims: [
    { id: 'k1', level: 3, label: 'SORA LIFE gift box', value: 'Starter set', reward_type: 'product', status: 'fulfilled', claimed_at: '2026-06-14T00:00:00Z' },
    { id: 'k2', level: 5, label: 'Cash reward', value: '₹2,000', reward_type: 'cash', status: 'pending', claimed_at: '2026-08-30T00:00:00Z' },
  ],
  claimable: [{ level: 7, rank: 'Royale', options: [
    { id: 'o1', option_index: 1, label: 'Royale product bundle', reward_type: 'product', value: 'Six full-size products', description: 'Chosen from the current bestsellers list and shipped to you.' },
    { id: 'o2', option_index: 2, label: 'Cash reward', reward_type: 'cash', value: '₹5,000', description: 'Paid with your next payout once withdrawals open.' },
    { id: 'o3', option_index: 3, label: 'Homepage feature', reward_type: 'other', value: 'One week', description: 'Your name and link on the SORA LIFE homepage.' },
  ] }],
};
const earnings = {
  ok: true, available: 12640.5, held: 1542.4, reserved: 0, paid: 6548.1, reversed: 0, commission_rate: 10, settlement_hold_days: 7, min_payout: 500, payout_day: 1,
  this_month: { orders: 14, products_sold: 31, attributed_sales: 24180, commission_earned: 3868.8 }, clicks: 1240,
  top_products: [
    { name: 'Cold-pressed Amla Juice', variant: '500 ml', qty: 12, sales: 5388, commission: 862.08 },
    { name: 'Black Seed Oil', variant: '100 ml', qty: 8, sales: 4792, commission: 766.72 },
    { name: 'Moringa Capsules', variant: '60 caps', qty: 6, sales: 2394, commission: 383.04 },
  ],
  monthly_history: [{ month: '2026-07', commission: 4120.5 }, { month: '2026-08', commission: 6210.75 }, { month: '2026-09', commission: 3868.8 }],
};
const analytics = { ok: true, clicks: 1240, attributed_orders: 58, products_sold: 131, attributed_sales: 138420 + 9640, eligible_orders: 55 };
const WEEKS = ['2026-06-15', '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'];
const series90 = { ok: true, range: '90d', unit: 'week', series: WEEKS.map((at, i) => ({
  at, clicks: [40, 62, 80, 74, 91, 120, 98, 134, 150, 121, 168, 142, 100][i], orders: [1, 2, 4, 3, 5, 6, 4, 7, 8, 6, 9, 7, 3][i],
  products: [3, 5, 9, 7, 11, 14, 9, 16, 18, 13, 20, 15, 6][i], sales: [2100, 4200, 8100, 6400, 10800, 12900, 9100, 15300, 17800, 12100, 19600, 14900, 5900][i],
  commission: [210, 420, 810, 640, 1080, 1290, 910, 1530, 1780, 1210, 1960, 1490, 590][i] })),
  previous: { clicks: 640, orders: 30, products: 70, sales: 61000, commission: 6100 },
  links: [{ link_id: null, label: 'Default link', campaign: null, clicks: 1100, orders: 48, sales: 121000, commission: 12100 }, { link_id: 'l2', label: 'Diwali edit', campaign: 'Diwali edit', clicks: 140, orders: 10, sales: 27060, commission: 2706 }] };
const DAYS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
const series7 = { ok: true, range: '7d', unit: 'day', series: DAYS.map((at, i) => ({ at, clicks: [14, 22, 19, 31, 27, 35, 24][i], orders: [1, 1, 0, 2, 1, 3, 1][i], products: [2, 3, 0, 5, 2, 7, 2][i], sales: [1200, 1900, 0, 3900, 1600, 6200, 1900][i], commission: [192, 304, 0, 624, 256, 992, 304][i] })),
  previous: { clicks: 120, orders: 6, products: 14, sales: 11000, commission: 1760 }, links: series90.links };
// The reference's own account: five clicks this week, nothing else yet.
const ref7 = { ok: true, range: '7d', unit: 'day', series: DAYS.map((at, i) => ({ at, clicks: [0, 0, 1, 1, 2, 0, 1][i], orders: 0, products: 0, sales: 0, commission: 0 })),
  previous: { clicks: 0, orders: 0, products: 0, sales: 0, commission: 0 }, links: [{ link_id: null, label: 'Default link', campaign: null, clicks: 5, orders: 0, sales: 0, commission: 0 }] };
const series = series90;
const emptyEarnings = { ok: true, available: 0, held: 0, reserved: 0, paid: 0, reversed: 0, commission_rate: 10, settlement_hold_days: 7, min_payout: 500, payout_day: 1, this_month: {}, clicks: 0, top_products: [], monthly_history: [] };
const emptyAnalytics = { ok: true, clicks: 0, attributed_orders: 0, products_sold: 0, attributed_sales: 0, eligible_orders: 0, top_products: [] };
const emptyStanding = { ...standing, level: 1, rank: 'Rise', rate: 10, threshold: 0, next_level: 2, next_threshold: 10000, next_rate: 11, lifetime_confirmed_sales: 0, pending_sales: 0, pending_commission: 0, confirmed_commission: 0, leaderboard_position: null, leaderboard_total: 0 };
const NOW = '2026-09-13T10:30:00+05:30';
const recentClicks = ['2026-09-13T08:20:00+05:30', '2026-09-13T07:05:00+05:30', '2026-09-12T19:40:00+05:30'];
const initial = {
  creator, campaigns: [{ id: 'cp1', name: 'Diwali edit', campaign_code: 'DIWALI', status: 'active', commission_rate_override: null, start_at: '2026-10-01', end_at: '2026-11-15' }],
  links: [{ id: 'l1', public_code: 'AARAV', label: 'Default', destination_type: 'home', destination_path: '/', status: 'active', created_at: '2026-03-02T00:00:00Z' }],
  analytics, earnings, kyc: { identity_status: 'verified', verified_at: '2026-04-02T00:00:00Z', submitted_at: '2026-03-30T00:00:00Z' }, payouts: [], standing, rewards, leaderboard, terms: null,
  seriesByRange: { '7d': series7, '90d': series90 }, range: '7d', recentClicks, now: NOW, hour: 10,
  catalog: [
    { id: 'r8a', level: 8, option_index: 1, label: 'Royale product bundle', reward_type: 'product', value: 'Six full-size products' },
    { id: 'r8b', level: 8, option_index: 2, label: 'Cash reward', reward_type: 'cash', value: '₹5,000' },
    { id: 'r8c', level: 8, option_index: 3, label: 'Homepage feature', reward_type: 'other', value: 'One week' },
    { id: 'r9a', level: 9, option_index: 1, label: 'Prime hamper', reward_type: 'product', value: 'Curated box' },
  ],
};
// The reference mockup's account: Vikas, Rise L1, five clicks, nothing earned.
const refInitial = {
  creator: { ...creator, display_name: 'Vikas Shamra', creator_code: 'VIKAS', joined_at: '2026-09-12T09:00:00+05:30', created_at: '2026-09-12T08:30:00+05:30' }, campaigns: [], links: [],
  analytics: { ok: true, clicks: 5, attributed_orders: 0, products_sold: 0, attributed_sales: 0, top_products: [] }, earnings: emptyEarnings,
  kyc: { identity_status: 'not_started' }, payouts: [], standing: emptyStanding, rewards: { ok: true, level: 1, claims: [], claimable: [] }, leaderboard, terms: null,
  seriesByRange: { '7d': ref7, '90d': null }, range: '7d', recentClicks: ['2026-09-13T08:20:00+05:30', '2026-09-13T07:05:00+05:30', '2026-09-13T06:10:00+05:30', '2026-09-12T19:40:00+05:30', '2026-09-11T12:00:00+05:30'], now: NOW, hour: 9,
};
const emptyInitial = {
  creator: { ...creator, display_name: 'Priya Nair', creator_code: 'PRIYA', joined_at: '2026-09-10T00:00:00Z' }, campaigns: [], links: [], analytics: emptyAnalytics, earnings: emptyEarnings,
  kyc: { identity_status: 'not_started' }, payouts: [], standing: emptyStanding, rewards: { ok: true, level: 1, claims: [], claimable: [] }, leaderboard, terms: null,
  seriesByRange: {}, range: '7d', recentClicks: [], now: NOW, hour: 14,
};

// ---- render -----------------------------------------------------------------
const HomeLeaderboard = component('src/components/HomeLeaderboard.jsx', 'HomeLeaderboard', { Link, LeaderboardList, getCreatorLeaderboard: async () => [] });
// The two backgrounds live at /img/ on the site; a file:// capture with the
// network blocked cannot fetch them, so they are inlined here as data URIs.
const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const inlineImages = (css) => css.replace(/url\('\/img\/([^']+\.webp)'\)/g, (_, f) => `url('${dataUri(f)}')`);
const inlineMarkup = (html) => html.replace(/src="\/img\/([^"]+\.webp)"/g, (_, f) => `src="${dataUri(f)}"`);
const appCss = inlineImages(read('public/app.css'));
const deferredCss = inlineImages(read('public/app-deferred.css'));
const page = (title, body, extraCss = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${appCss}</style><style>${extraCss}</style><style>body{margin:0;background:#F6F3EB}</style></head><body>${inlineMarkup(body)}</body></html>`;

mkdirSync(OUT, { recursive: true });
const pages = {
  'portal-dashboard': page('SSR — portal dashboard', renderToStaticMarkup(h(portalFor('dashboard'), { initial })), deferredCss),
  'portal-dashboard-reference': page('SSR — portal dashboard (the mockup account)', renderToStaticMarkup(h(portalFor('dashboard'), { initial: refInitial })), deferredCss),
  'portal-earnings': page('SSR — portal earnings', renderToStaticMarkup(h(portalFor('earnings'), { initial })), deferredCss),
  'portal-analytics': page('SSR — portal analytics', renderToStaticMarkup(h(portalFor('analytics'), { initial })), deferredCss),
  'portal-tier': page('SSR — portal tier', renderToStaticMarkup(h(portalFor('tier'), { initial })), deferredCss),
  'portal-tier-reference': page('SSR — portal tier (the mockup account)', renderToStaticMarkup(h(portalFor('tier'), { initial: refInitial })), deferredCss),
  'portal-profile': page('SSR — portal profile', renderToStaticMarkup(h(portalFor('profile'), { initial })), deferredCss),
  'portal-profile-reference': page('SSR — portal profile (the mockup account)', renderToStaticMarkup(h(portalFor('profile'), { initial: refInitial })), deferredCss),
  'portal-dashboard-empty': page('SSR — portal dashboard, empty', renderToStaticMarkup(h(portalFor('dashboard'), { initial: emptyInitial })), deferredCss),
  'portal-earnings-empty': page('SSR — portal earnings, empty', renderToStaticMarkup(h(portalFor('earnings'), { initial: emptyInitial })), deferredCss),
  'home-leaderboard': page('SSR — creator leaderboard',
    `<main class="page-main"><div class="v2-home" style="background:#FBF8F1">
       <section class="v2-sec" style="padding:32px 0"><div class="v2-wrap"><p class="v2-eyebrow">…preceding section (stub)</p><h2 class="v2-h2">Why shop SORA LIFE</h2></div></section>
       ${renderToStaticMarkup(h(HomeLeaderboard, { rows: leaderboard }))}
     </div></main>
     <footer class="ftr"><div class="container" style="padding-block:40px"><strong style="color:#FBF8F1">SORA LIFE</strong> <span>· footer (stub)</span></div></footer>`),
};
for (const [name, html] of Object.entries(pages)) writeFileSync(join(OUT, `${name}.html`), html);
console.log('wrote', Object.keys(pages).join(', '), 'under', OUT);

// ---- screenshot ---------------------------------------------------------------
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }); }
  send(method, params = {}, sessionId) { const id = ++this.id;
    return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
}

async function shoot(file, width, height, outName) {
  const profile = mkdtempSync(join(tmpdir(), 'ssr-'));
  const port = 9940 + Math.floor(Math.random() * 30);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run',
    '--disable-extensions', '--mute-audio', '--hide-scrollbars', '--allow-file-access-from-files'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300); try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  const cdp = new CDP(ws);
  let blocked = 0;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    for (const d of ['Page', 'Runtime', 'Network']) await cdp.send(`${d}.enable`, {}, sessionId);
    await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] }, sessionId);
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Network.loadingFailed' && /BLOCKED/.test(m.params?.blockedReason || '')) blocked++; });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 }, sessionId);
    await cdp.send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
    await sleep(2200);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'Math.min(document.documentElement.scrollHeight, 14000)', returnByValue: true }, sessionId);
    const docHeight = result.value;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: docHeight, scale: 1 } }, sessionId);
    writeFileSync(join(OUT, outName), Buffer.from(shot.data, 'base64'));
    console.log(`  ${outName}  ${width}×${docHeight}  (blocked requests: ${blocked})`);
  } finally { ws.close(); chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
}

for (const name of Object.keys(pages)) {
  await shoot(join(OUT, `${name}.html`), 390, 844, `${name}-390.png`);
  await shoot(join(OUT, `${name}.html`), 1440, 900, `${name}-1440.png`);
}
console.log('done');
