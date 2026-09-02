// ============================================================
// Creator Program visual QA harness — LOCAL ONLY, NEVER SHIPPED.
//
// The creator routes are behind an authenticated creator session, so they
// cannot be reached in a local browser without real credentials. Rather
// than eyeball hand-written approximations of the markup, this renders the
// ACTUAL components with renderToStaticMarkup and writes a single static
// page, using the same babel-transform-and-eval technique the existing
// scripts/test-homepage-appearance.mjs uses.
//
// What you see in the browser is therefore the real component output with
// the real stylesheets — only the data is representative.
//
// Writes to .creator-qa/ (gitignored). Delete when finished:
//   node scripts/creator-visual-qa.mjs --clean
// ============================================================
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import { money2 } from '../src/lib/format.js';

const OUT_DIR = new URL('../.creator-qa/', import.meta.url);
if (process.argv.includes('--clean')) {
  rmSync(OUT_DIR, { recursive: true, force: true });
  console.log('QA harness removed.');
  process.exit(0);
}

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const h = React.createElement;

/** Transform a JSX module, strip its imports, and hand it injected deps. */
function component(file, names, deps = {}) {
  const { code } = transformSync(read(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(p) { p.remove(); },
      ExportDefaultDeclaration(p) { p.replaceWith(p.node.declaration); },
      ExportNamedDeclaration(p) { if (p.node.declaration) p.replaceWith(p.node.declaration); else p.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  // The newline matters: a module whose last line is a // comment would
  // otherwise swallow the appended return statement and yield undefined.
  const built = new Function(...Object.keys(scope), `${code}\n;return [${names.join(',')}];`)(...Object.values(scope));
  if (!Array.isArray(built)) throw new Error(`could not extract ${names.join(', ')} from ${file}`);
  return built;
}

// ---- Stand-ins that preserve real geometry ------------------------------
// Icon renders a real sized SVG so spacing and alignment are honest.
const Icon = ({ size = 18 }) =>
  h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 },
    h('circle', { cx: 12, cy: 12, r: 8 }));
const Link = ({ to, children, ...rest }) => h('a', { href: to, ...rest }, children);
const CopyButton = ({ label = 'Copy', className = 'btn' }) => h('button', { type: 'button', className }, label);
const ShareButton = () => h('button', { type: 'button', className: 'btn btn-light' }, 'Share');

const [Metric, Section, Empty, Pill, Step] =
  component('../src/components/creator/CreatorUI.jsx', ['Metric', 'Section', 'Empty', 'Pill', 'Step'], { Icon });
const [CreatorHowItWorks] =
  component('../src/components/creator/CreatorHowItWorks.jsx', ['CreatorHowItWorks'], { Icon, money2 });
const [CreatorEarnings] =
  component('../src/components/creator/CreatorEarnings.jsx', ['CreatorEarnings'], { Icon, money2, Metric });
const [CreatorPayouts] =
  component('../src/components/creator/CreatorPayouts.jsx', ['CreatorPayouts'],
    { Icon, money2, Metric, CopyButton, Link });

// ---- Representative data (shape matches the real RPCs) ------------------
const creator = {
  display_name: 'Anjali Sharma', creator_code: 'ANJALI10', email: 'anjali@example.com',
  phone: '+91 98765 43210', status: 'active', default_commission_rate: 12,
  default_attribution_window_days: 30, joined_at: '2026-04-18T00:00:00Z',
};
const earnings = {
  held: 2480, available: 6120, reserved: 0, paid: 14300, reversed: 320,
  commission_rate: 12, settlement_hold_days: 7, min_payout: 500, payout_day: 1,
  this_month: { orders: 9, products_sold: 14, attributed_sales: 41200, commission_earned: 4944 },
  clicks: 318,
  top_products: [
    { name: 'Sea Buckthorn Diabo Juice 750 ml', qty: 8, sales: 12792, commission: 1535 },
    { name: 'Beard Cream', qty: 5, sales: 1180, commission: 142 },
  ],
  monthly_history: [{ month: '2026-07', commission: 3120 }, { month: '2026-08', commission: 4944 }],
};
const analytics = { clicks: 318, attributed_orders: 9, products_sold: 14, attributed_sales: 41200 };
const kycVerified = { identity_status: 'verified', legal_name: 'Anjali Sharma', pan_masked: 'ABCxxxx1F',
  payout_method: 'bank', payout_account_holder: 'Anjali Sharma', payout_account_masked: 'xxxxxx4821',
  ifsc_masked: 'HDFCxxx291', submitted_at: '2026-05-02T00:00:00Z', verified_at: '2026-05-04T00:00:00Z' };
const kycNone = { identity_status: 'not_started' };
const payoutHistory = [
  { id: '1', payout_period: '2026-08', requested_amount: 6120, paid_amount: null, status: 'approved', requested_at: '2026-09-01T00:00:00Z' },
  { id: '2', payout_period: '2026-07', requested_amount: 5200, paid_amount: 5200, status: 'paid', requested_at: '2026-08-01T00:00:00Z', paid_at: '2026-08-03T00:00:00Z', payment_reference: 'UTR8891' },
];
const defaultLink = 'https://sora-life-current.vercel.app/?ref=ANJALI10';
const noop = () => {};

// ---- Dashboard, composed from the same primitives the portal uses -------
const ordinalDay = (n) => { const s = ['th','st','nd','rd']; const k = n % 100; return `${n}${s[(k-20)%10]||s[k]||s[0]}`; };
const Dashboard = () => h(React.Fragment, null,
  h('section', { className: 'ck-share' },
    h('span', { className: 'ck-share__eyebrow' }, h(Icon, { size: 13 }), ' SORA LIFE Creator'),
    h('h1', { className: 'serif ck-share__title' }, 'Your link is live, Anjali.'),
    h('p', { className: 'ck-share__sub' }, `Share this anywhere. Every visit through it is recorded against your account for ${creator.default_attribution_window_days} days, and any order in that window earns you commission.`),
    h('code', { className: 'ck-share__url' }, defaultLink),
    h('div', { className: 'ck-share__actions' },
      h(CopyButton, { label: 'Copy link' }), h(ShareButton),
      h('a', { className: 'btn btn-light', href: '#' }, 'All links')),
    h('span', { className: 'ck-share__code' }, 'Your code ', h('code', null, creator.creator_code),
      h(CopyButton, { label: 'Copy', className: 'btn btn-xs btn-light' }))),

  h(Section, { title: 'Performance', sub: 'Attributed activity from your links. Figures update as orders qualify.', action: h('a', { className: 'ck-section__link', href: '#' }, 'Full analytics') },
    h('div', { className: 'ck-metrics' },
      h(Metric, { label: 'Link clicks', value: String(analytics.clicks), tone: 'info', icon: 'externalLink', hint: 'Every visit that arrived through one of your links.' }),
      h(Metric, { label: 'Attributed orders', value: String(analytics.attributed_orders), tone: 'brand', icon: 'package', hint: 'Orders matched to you inside your attribution window.' }),
      h(Metric, { label: 'Products sold', value: String(analytics.products_sold), tone: 'hold', icon: 'bag', hint: 'Individual units across your attributed orders.' }),
      h(Metric, { label: 'Attributed sales', value: money2(analytics.attributed_sales), tone: 'ok', icon: 'tag', hint: 'Eligible sale value, before commission.' }))),

  h(Section, { title: 'Earnings', sub: 'Commission is calculated on eligible sale value and clears after the hold period.', action: h('a', { className: 'ck-section__link', href: '#' }, 'Earnings detail') },
    h('div', { className: 'ck-metrics ck-metrics--bento' },
      h(Metric, { hero: true, label: 'Available to withdraw', value: money2(earnings.available), tone: 'ok', icon: 'card', hint: 'Cleared commission. This is what a payout request withdraws.' }),
      h(Metric, { label: 'Held', value: money2(earnings.held), tone: 'hold', icon: 'clock', hint: `Clears ${earnings.settlement_hold_days} days after each sale qualifies.` }),
      h(Metric, { label: 'In payout', value: money2(earnings.reserved), tone: 'brand', icon: 'shield', hint: 'Reserved against a payout request that is being processed.' }),
      h(Metric, { label: 'Paid out', value: money2(earnings.paid), tone: 'ok', icon: 'check' }))),

  h(Section, { title: 'What to do next', sub: 'Based on your account right now.' },
    h('ol', { className: 'ck-steps' },
      h(Step, { index: 1, done: true, tone: 'brand', title: 'Get your account activated', body: 'Your creator account is active and your links attribute visits.' }),
      h(Step, { index: 2, done: true, tone: 'brand', title: 'Share your link', body: '318 visits have arrived through your links.' }),
      h(Step, { index: 3, done: true, tone: 'hold', title: 'Earn your first commission', body: 'When an attributed order is paid, commission is created and enters the hold period.' }),
      h(Step, { index: 4, done: false, tone: 'info', title: 'Verify your payout details', body: 'Submit your KYC and payout details once. An admin verifies them before your first withdrawal.' }),
      h(Step, { index: 5, done: false, tone: 'ok', title: 'Request a payout', body: `Requests open on the ${ordinalDay(earnings.payout_day)} of each month, once your available balance reaches ${money2(earnings.min_payout)}.` }))),

  h(Section, { title: 'Your programme', sub: 'The terms your commission is calculated on.' },
    h('div', { className: 'ck-metrics ck-metrics--3' },
      h(Metric, { label: 'Commission rate', value: `${creator.default_commission_rate}%`, tone: 'brand', icon: 'crown', hint: 'Applied to eligible sale value and locked in when a sale qualifies.' }),
      h(Metric, { label: 'Attribution window', value: `${creator.default_attribution_window_days} days`, tone: 'brand', icon: 'clock', hint: 'How long after a visit a purchase still counts as yours.' }),
      h(Metric, { label: 'Account status', value: creator.status, tone: 'ok', icon: 'shield' }))));

const ProfileCard = () => h(React.Fragment, null,
  h('h1', { className: 'serif crp__h1' }, 'My profile'),
  h('p', { className: 'crp__lede' }, 'Your creator identity and the terms your commission runs on.'),
  h('section', { className: 'ck-idcard' },
    h('span', { className: 'ck-idcard__avatar' }, 'AS'),
    h('div', { className: 'ck-idcard__main' },
      h('h2', { className: 'ck-idcard__name' }, creator.display_name),
      h('p', { className: 'ck-idcard__email' }, creator.email),
      h('p', { className: 'ck-idcard__email' }, creator.phone),
      h('div', { className: 'ck-idcard__tags' },
        h(Pill, { tone: 'ok' }, 'active'),
        h('span', { className: 'ck-idcard__code' }, h('code', null, creator.creator_code),
          h(CopyButton, { label: 'Copy', className: 'btn btn-xs btn-light' }))))),
  h(Section, { title: 'Programme terms', sub: 'Set by SORA LIFE — these are not editable here.' },
    h('div', { className: 'ck-metrics ck-metrics--3' },
      h(Metric, { label: 'Commission rate', value: '12%', tone: 'brand', icon: 'crown', hint: 'Applied to eligible sale value and locked in when a sale qualifies.' }),
      h(Metric, { label: 'Attribution window', value: '30 days', tone: 'brand', icon: 'clock', hint: 'How long after a visit a purchase still counts as yours.' }),
      h(Metric, { label: 'Creator since', value: '18 Apr 2026', tone: 'neutral', icon: 'award' }))));

const Empties = () => h(React.Fragment, null,
  h(Empty, { tone: 'brand', icon: 'sparkle', title: 'No campaigns running yet',
    body: 'Campaigns are seasonal pushes SORA LIFE builds for creators — a launch, a festive edit, a category focus. Your programme manager sets them up; you don’t create them yourself.',
    points: ['A campaign link of your own, tracked separately from your default link', 'Its own commission rate when the campaign carries one', 'Performance you can see split out in Analytics'] },
    h('a', { className: 'btn btn-light', href: '#' }, 'Use my default link')),
  h('div', { style: { height: 18 } }),
  h(Empty, { tone: 'info', icon: 'award', title: 'No attributed orders yet',
    body: 'These figures fill in on their own once someone shops through your link. Nothing here is estimated — every number is a real, matched order.',
    points: ['A visit through your link is recorded immediately', 'It stays attributed to you for your full attribution window', 'Once that order is paid, it appears here and commission is created'] },
    h('a', { className: 'btn btn-light', href: '#' }, 'How earning works')));


const Lists = () => h(React.Fragment, null,
  h('h1', { className: 'serif crp__h1' }, 'My campaigns'),
  h('div', { className: 'crp__list' },
    h('article', { className: 'crp__item' },
      h('div', { className: 'crp__item-main' },
        h('h3', null, 'Festive Wellness Edit'),
        h('p', { className: 'crp__meta' }, h('code', null, 'FEST26'), ' · 1 Oct 2026 → open'),
        h('p', { className: 'crp__desc' }, 'Seasonal push across juices and supplements.')),
      h('span', { className: 'crp__pill is-ok' }, 'active')),
    h('article', { className: 'crp__item' },
      h('div', { className: 'crp__item-main' },
        h('h3', null, 'Summer Skin Drop'),
        h('p', { className: 'crp__meta' }, h('code', null, 'SUMMER26'), ' · 1 Apr 2026 → 30 Jun 2026')),
      h('span', { className: 'crp__pill is-bad' }, 'ended'))),
  h('h1', { className: 'serif crp__h1', style: { marginTop: 30 } }, 'My tracking links'),
  h('div', { className: 'crp__list' },
    h('article', { className: 'crp__item' },
      h('div', { className: 'crp__item-main' },
        h('h3', null, 'Default creator link'),
        h('p', { className: 'crp__meta' }, 'Homepage · ', h('code', null, 'ANJALI10')),
        h('code', { className: 'crp__url' }, defaultLink)),
      h('span', { className: 'crp__pill is-ok' }, 'always on'))));

// ---- Page ---------------------------------------------------------------
const panels = [
  ['dashboard', 'Dashboard  /creator', h(Dashboard)],
  ['earnings', 'Earnings  /creator/earnings', h(CreatorEarnings, { creator, earnings })],
  ['payouts-verified', 'Payouts  /creator/payouts  (KYC verified)', h(CreatorPayouts, { creator, earnings, kyc: kycVerified, payouts: payoutHistory, onSubmitKyc: noop, onRequestPayout: noop, onChanged: noop })],
  ['payouts-new', 'Payouts  /creator/payouts  (KYC not started)', h(CreatorPayouts, { creator, earnings: { ...earnings, available: 120 }, kyc: kycNone, payouts: [], onSubmitKyc: noop, onRequestPayout: noop, onChanged: noop })],
  ['how', 'How you earn  /creator/how-it-works', h(CreatorHowItWorks, { creator, earnings })],
  ['profile', 'Profile  /creator/profile', h(ProfileCard)],
  ['empties', 'Empty states  campaigns + analytics', h(Empties)],
  ['lists', 'Campaign + link list items', h(Lists)],
];

const body = panels.map(([id, label, node]) => {
  let html;
  try { html = renderToStaticMarkup(node); }
  catch (e) { html = `<pre style="color:#b3453f">RENDER FAILED: ${e.message}</pre>`; }
  return `<section class="qa-panel" id="qa-${id}">
    <h2 class="qa-label">${label}</h2>
    <div class="crp"><div class="container"><main class="crp__main">${html}</main></div></div>
  </section>`;
}).join('\n');

const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Creator QA</title>
<link rel="stylesheet" href="/src/styles/tokens.css" />
<link rel="stylesheet" href="/src/styles/base.css" />
<link rel="stylesheet" href="/src/styles/layout.css" />
<link rel="stylesheet" href="/src/styles/components.css" />
<link rel="stylesheet" href="/src/styles/pages.css" />
<link rel="stylesheet" href="/src/styles/creator.css" />
<link rel="stylesheet" href="/src/styles/creator-expressive.css" />
<style>
  body { margin: 0; background: #efeae0; }
  .qa-label { position: sticky; top: 0; z-index: 5; margin: 0; padding: 10px 16px;
    background: #1E3A2F; color: #fff; font: 700 12px/1.2 ui-monospace, Menlo, monospace;
    letter-spacing: .1em; text-transform: uppercase; }
  .qa-panel { margin-bottom: 34px; }
  .qa-panel .crp { min-height: 0; padding: 22px 0 30px; }
</style>
</head><body>
${body}
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL('index.html', OUT_DIR), page, 'utf8');

// One file per panel too. A single tall page is awkward to screenshot — the
// browser pane cannot reliably composite a scrolled region 5000px down — so
// each panel also gets its own page that sits at scroll 0.
const shell = (inner) => page.replace(body, inner);
for (const [id, label, node] of panels) {
  let html;
  try { html = renderToStaticMarkup(node); }
  catch (e) { html = `<pre>RENDER FAILED: ${e.message}</pre>`; }
  const one = `<section class="qa-panel" id="qa-${id}">
    <h2 class="qa-label">${label}</h2>
    <div class="crp"><div class="container"><main class="crp__main">${html}</main></div></div>
  </section>`;
  writeFileSync(new URL(`${id}.html`, OUT_DIR), shell(one), 'utf8');
}
console.log(`QA written: index.html + ${panels.length} per-panel pages`);
