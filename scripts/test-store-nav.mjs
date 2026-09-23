// ============================================================
// Store navigation — every shell links to the other storefronts.
// Offline suite.
//
// The wellness header rendered from this tree equals the baseline render
// (d6a0c20, before any switcher) plus exactly the two insertions (the bar
// links and the drawer's "Stores" section); the eight fashion pages equal
// the baseline once the new stores block is removed; each shell shows the
// other stores and never itself; the bar links hide below the desktop
// breakpoints and the drawers carry them; the cart, checkout and payment
// code is untouched. Since Home & Living (test-homeliving.mjs) the group
// is three links with short sibling labels and the wellness bar shows it
// from 1100px.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-store-nav.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-store-nav.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactRouter from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, h, loadModule, loadSource, buildGroceryApp } from './grocery-ssr.mjs';
import { REPO, exportBaseline, atCommit } from './baseline-export.mjs';

// The tip before the store switcher (the catalogue bundle commit).
const BASELINE_SHA = 'd6a0c20';
let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
console.log(`\nsource root: ${ROOT}`);
const baselineDir = exportBaseline(BASELINE_SHA);

// ---- the wellness Header, rendered with its surroundings stubbed ---------------
const { Link, NavLink, useNavigate, useLocation } = ReactRouter;
const CATS = [{ slug: 'immunity', name: 'Immunity', tagline: 'Daily defence' }, { slug: 'skin', name: 'Skin', tagline: 'Glow' }, { slug: 'digestion', name: 'Digestion', tagline: '' }];
/** Render Header.jsx from its module text — the working tree's or the baseline's — through the same stubs. */
function renderHeader(source) {
  const Icon = loadModule('src/components/Icon.jsx', {}).default;
  const mod = loadSource(source, {
    Link, NavLink, useNavigate, useLocation, Icon,
    Logo: ({ compact }) => h('a', { className: `logo${compact ? ' logo--compact' : ''}`, href: '/' }, 'SORA LIFE'),
    ProductImage: () => null, AnnouncementBar: () => h('div', { className: 'v2-ann', 'data-stub': 'announcement' }),
    useStore: () => ({ cartCount: 2, wishCount: 1 }),
    categories: CATS, hasConfiguredCategoryCopy: () => true, isCategoriesHydrated: () => true,
    searchProducts: () => [], money: (n) => `₹${n}`, branding: { siteName: 'SORA LIFE' }, lockScroll: () => {}, unlockScroll: () => {},
  });
  return renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(mod.default)));
}
// ============================================================
console.log('\n— Wellness: the header gains the two stores and nothing else changes —');
// ============================================================

let nowHeader = '', thenHeader = '';
await test('the wellness header renders as the baseline render plus exactly the bar links (Fashion, Grocery) and the drawer "Stores" section', () => {
  nowHeader = renderHeader(read('src/components/Header.jsx'));
  thenHeader = renderHeader(atCommit(BASELINE_SHA, 'src/components/Header.jsx'));
  assert.ok(nowHeader.length > 3000 && thenHeader.length > 3000, 'both renders are the real header');
  const bar = '<nav class="v2-hdr__stores" aria-label="Other stores"><a class="v2-hdr__store" href="/fashion">Fashion <svg';
  const drawer = '<div class="drawer__sec">Stores</div><a class="drawer__cat" href="/fashion">Fashion store<svg';
  assert.ok(nowHeader.includes(bar), 'the bar links are in the right group');
  assert.ok(nowHeader.includes(drawer), 'the drawer has a Stores section');
  assert.ok(nowHeader.includes('<a class="v2-hdr__store" href="/grocery">Grocery <svg'));
  assert.ok(nowHeader.includes('<a class="v2-hdr__store" href="/homeliving">Home &amp; Living <svg'));
  assert.ok(nowHeader.includes('<a class="drawer__cat" href="/grocery">Grocery store<svg'));
  assert.ok(nowHeader.includes('<a class="drawer__cat" href="/homeliving">Home &amp; Living store<svg'));
  // The lifestyle storefront (test-lifestyle.mjs) added the fourth link to every switcher.
  assert.ok(nowHeader.includes('<a class="v2-hdr__store" href="/lifestyle">Lifestyle <svg'));
  assert.ok(nowHeader.includes('<a class="drawer__cat" href="/lifestyle">Lifestyle store<svg'));
  assert.doesNotMatch(nowHeader, /v2-hdr__store" href="\/"/, 'wellness never links to itself');
  // Strip exactly the two insertions and the render must equal the baseline byte for byte.
  const stripped = nowHeader
    .replace(/<nav class="v2-hdr__stores" aria-label="Other stores">[\s\S]*?<\/nav>/, '')
    .replace(/<div class="drawer__sec">Stores<\/div>(<a class="drawer__cat" href="\/(fashion|grocery|homeliving|lifestyle)">[\s\S]*?<\/a>){4}/, '');
  assert.equal(stripped, thenHeader, 'nothing else in the wellness header changed');
  // Placement: in the right group, after the mobile search button, before the account icon; in the drawer between Categories and Company.
  const right = nowHeader.slice(nowHeader.indexOf('<div class="v2-hdr__right">'), nowHeader.indexOf('<nav class="v2-hdr__nav"'));
  assert.ok(right.indexOf('aria-label="Search"') < right.indexOf('v2-hdr__stores') && right.indexOf('v2-hdr__stores') < right.indexOf('aria-label="Account"'));
  const nav = nowHeader.slice(nowHeader.indexOf('<nav class="drawer__nav">'), nowHeader.indexOf('<div class="drawer__foot">'));
  assert.ok(nav.indexOf('Categories</div>') < nav.indexOf('Stores</div>') && nav.indexOf('Stores</div>') < nav.indexOf('Company</div>'));
});

await test('v2-header.css: the bar links are hidden below 1100px and shown from 1100px in the fashion link\'s style; no existing rule changed', () => {
  const css = read('src/styles/v2-header.css');
  assert.match(css, /\.v2-hdr__stores \{ display:none; \}\n@media \(min-width: 1100px\) \{\n  \.v2-hdr__stores \{ display:inline-flex; align-items:center; gap:14px; padding-right:16px; border-right:1px solid var\(--slv2-line\); \}\n  \.v2-hdr__store \{ display:inline-flex; align-items:center; gap:3px; font-family:var\(--slv2-sans\); font-size:12\.5px; font-weight:600; color:var\(--slv2-ink-3\); text-decoration:none; white-space:nowrap; \}\n  \.v2-hdr__store:hover \{ color:var\(--slv2-f700\); \}/);
  const before = atCommit(BASELINE_SHA, 'src/styles/v2-header.css');
  const block = css.slice(css.indexOf('/* ---- the other storefronts'), css.indexOf('/* Nav placeholder'));
  assert.equal(css.replace(block, ''), before, 'one appended block; every existing rule byte-identical');
  assert.equal(read('src/styles/layout.css'), atCommit(BASELINE_SHA, 'src/styles/layout.css'), 'the drawer styles are reused, not changed');
});

// ============================================================
console.log('\n— Fashion: Wellness stays, Grocery joins; the pages are otherwise identical —');
// ============================================================

await test('the eight fashion pages equal the baseline render once the stores block is removed; the header shows Wellness and Grocery, never Fashion; the drawer carries both', () => {
  const dump = resolve(REPO, 'scripts/fashion-ssr-dump.mjs');
  const now = JSON.parse(execFileSync(process.execPath, [dump], { cwd: REPO, encoding: 'utf8', env: { ...process.env, FASHION_SRC_ROOT: ROOT }, maxBuffer: 64 * 1024 * 1024 }));
  const then = JSON.parse(execFileSync(process.execPath, [dump], { cwd: REPO, encoding: 'utf8', env: { ...process.env, FASHION_SRC_ROOT: baselineDir }, maxBuffer: 64 * 1024 * 1024 }));
  assert.deepEqual(Object.keys(now), Object.keys(then));
  for (const p of Object.keys(now)) {
    const html = now[p];
    assert.match(html, /<nav class="fs-hdr__stores" aria-label="Other stores"><a class="fs-hdr__back" href="\/"><svg[^>]*>[\s\S]*?<\/svg> Wellness store<\/a><a class="fs-hdr__back" href="\/grocery">Grocery <svg[\s\S]*?<\/svg><\/a><a class="fs-hdr__back" href="\/homeliving">Home &amp; Living <svg[\s\S]*?<\/svg><\/a><a class="fs-hdr__back" href="\/lifestyle">Lifestyle <svg/, `${p}: the other stores, wellness first`);
    assert.doesNotMatch(html, /fs-hdr__back" href="\/fashion"/, `${p}: fashion never links to itself`);
    const stripped = html.replace(/<nav class="fs-hdr__stores" aria-label="Other stores">[\s\S]*?<\/nav>/, '<a class="fs-hdr__back" href="/"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg> Wellness store</a>');
    // e58317c moved the campaign hero to the top of /fashion (test-fashion.mjs pins the new order).
    // The block itself is unchanged, so compare it separately and the page without it — this stays a
    // switcher comparison rather than a layout one.
    const HERO_BLOCK = /<section class="fs-hero[^"]*"[\s\S]*?<\/section>/;
    const hero = (html) => HERO_BLOCK.exec(html)?.[0] || '';
    assert.equal(hero(stripped), hero(then[p]), `${p}: the campaign hero block is byte-identical`);
    // The PDP's delivery list lost Express and Scheduled when they were withdrawn
    // (test-fashion-cart.mjs pins what it says now), so it is normalised out here.
    const SHIP_LIST = /<ul class="fs-pdp__ship">[\s\S]*?<\/ul>/;
    const sans = (html) => html.replace(HERO_BLOCK, '').replace(SHIP_LIST, 'SHIP');
    assert.equal(sans(stripped), sans(then[p]), `${p}: otherwise byte-identical`);
  }
  const layout = read('src/fashion/FashionLayout.jsx');
  assert.match(layout, /<Link to="\/grocery" className="fs-drawer__back" onClick=\{onClose\}><Icon name="chevronRight" size=\{16\} \/> Grocery store<\/Link>\n\s+<Link to="\/homeliving" className="fs-drawer__back" onClick=\{onClose\}><Icon name="chevronRight" size=\{16\} \/> Home &amp; Living store<\/Link>\n\s+<Link to="\/lifestyle" className="fs-drawer__back" onClick=\{onClose\}><Icon name="chevronRight" size=\{16\} \/> Lifestyle store<\/Link>\n\s+<Link to="\/" className="fs-drawer__back" onClick=\{onClose\}><Icon name="chevronLeft" size=\{16\} \/> Back to the wellness store<\/Link>/, 'the drawer lists the other stores beside the way back');
  const css = read('src/styles/fashion.css');
  assert.match(css, /\.fs-hdr__stores \{ display: inline-flex; align-items: center; gap: 14px; \}/);
  assert.match(css.slice(css.indexOf('@media (max-width: 1019px)')), /\.fs-hdr__stores \{ display: none; \}/, 'hidden on phone and tablet, as the Wellness link was');
});

// ============================================================
console.log('\n— Grocery: Wellness and Fashion in the header; the drawer already had both —');
// ============================================================

await test('the grocery header links to Wellness and Fashion (never Grocery), hidden below 1020px; the drawer lists both', async () => {
  const app = await buildGroceryApp({ cartCount: 1 });
  const html = app.render('/grocery');
  assert.match(html, /<nav class="gs-hdr__acts" aria-label="Wishlist and cart"><span class="gs-hdr__stores" role="navigation" aria-label="Other stores"><a class="gs-hdr__store" href="\/"><svg[\s\S]*?<\/svg> Wellness store<\/a><a class="gs-hdr__store" href="\/fashion">Fashion <svg[\s\S]*?<\/svg><\/a><a class="gs-hdr__store" href="\/homeliving">Home &amp; Living <svg[\s\S]*?<\/svg><\/a><a class="gs-hdr__store" href="\/lifestyle">Lifestyle <svg[\s\S]*?<\/svg><\/a><\/span><button type="button" class="gs-hdr__act" aria-label="Wishlist"/);
  assert.doesNotMatch(html, /gs-hdr__store" href="\/grocery"/, 'grocery never links to itself');
  const layout = read('src/grocery/GroceryLayout.jsx');
  assert.match(layout, /<Link to="\/fashion" className="gs-drawer__back" onClick=\{onClose\}>[\s\S]*?Fashion store<\/Link>\n\s+<Link to="\/homeliving" className="gs-drawer__back" onClick=\{onClose\}>[\s\S]*?Home &amp; Living store<\/Link>\n\s+<Link to="\/lifestyle" className="gs-drawer__back" onClick=\{onClose\}>[\s\S]*?Lifestyle store<\/Link>\n\s+<Link to="\/" className="gs-drawer__back" onClick=\{onClose\}>[\s\S]*?Back to the wellness store<\/Link>/);
  const css = read('src/styles/grocery.css');
  assert.match(css, /\.gs-hdr__store \{ display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var\(--slv2-ink-3\); text-decoration: none; white-space: nowrap; \}/, 'the fashion link\'s style');
  const tablet = css.slice(css.indexOf('@media (max-width: 1019px)'), css.indexOf('@media (max-width: 599px)'));
  assert.match(tablet, /\.gs-hdr__stores \{ display: none; \}/);
});

// ============================================================
console.log('\n— Every shell, every store —');
// ============================================================

await test('each shell links to exactly the other stores by path, and the five paths are the five storefront roots', () => {
  const stores = { '/': 'Wellness store', '/fashion': 'Fashion store', '/grocery': 'Grocery store', '/homeliving': 'Home & Living store', '/lifestyle': 'Lifestyle store' };
  const wellness = nowHeader.match(/<a class="v2-hdr__store" href="([^"]+)"/g).map((m) => m.match(/href="([^"]+)"/)[1]);
  assert.deepEqual(wellness, ['/fashion', '/grocery', '/homeliving', '/lifestyle']);
  const fashion = read('src/fashion/FashionLayout.jsx').match(/className="fs-hdr__back"/g).length;
  assert.equal(fashion, 4);
  const grocery = read('src/grocery/GroceryLayout.jsx').match(/className="gs-hdr__store"/g).length;
  assert.equal(grocery, 4);
  const homeliving = read('src/homeliving/HomeLivingLayout.jsx').match(/className="hl-hdr__store"/g).length;
  assert.equal(homeliving, 4);
  // The lifestyle shell draws its links from one OTHER_STORES list: the four other roots, wellness first, never itself.
  const lifestyle = [...read('src/lifestyle/LifestyleLayout.jsx').matchAll(/\{ href: '([^']+)', label: '[^']+ store'/g)].map((m) => m[1]);
  assert.deepEqual(lifestyle, ['/', '/fashion', '/homeliving', '/grocery']);
  for (const [path, label] of Object.entries(stores)) {
    const app = read('src/App.jsx');
    assert.ok(path === '/' ? /<Route index element=\{<Home \/>\} \/>/.test(app) : app.includes(`<Route path="${path}"`), `${label} is routed at ${path}`);
  }
});

await test('cart, checkout, coupons, auth, payments and the data layer are byte-identical to the baseline; no migration, no bundle', () => {
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Express and Scheduled were withdrawn, which edited the delivery list in
  // Checkout.jsx and the fee map in pricing.js — and nothing else in either
  // file. test-company-surfaces.mjs pins the fee map exactly and the three
  // payment suites pin the behaviour; here, normalise those two declarations
  // (and comments) on both sides so this still proves the REST is identical.
  const sansDelivery = (t) => stripComments(t)
    .replace(/export const DELIVERY_FEES = \{[^}]*\};/, 'DELIVERY_FEES')
    .replace(/const DELIVERY = \[[\s\S]*?\n\];/, 'DELIVERY')
    .split('\n').filter((l) => l.trim()).join('\n');
  for (const rel of ['src/lib/store.jsx', 'src/lib/cartLine.js', 'src/lib/couponApi.js', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'src/pages/Cart.jsx', 'api/razorpay/create-order.js', 'src/lib/fashionApi.js', 'src/data/groceryHomepage.js']) {
    assert.equal(read(rel), atCommit(BASELINE_SHA, rel), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  for (const rel of ['src/pages/Checkout.jsx', 'api/_lib/pricing.js']) {
    assert.equal(sansDelivery(read(rel)), sansDelivery(atCommit(BASELINE_SHA, rel)), `${rel}: nothing beyond the delivery withdrawal changed since ${BASELINE_SHA}`);
  }
  const changed = execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(!changed.some((f) => /^supabase\/(?!migrations\/(0035_|rollback\/0035_))/.test(f)), 'no migration beyond 0035 (the Home & Living store)');
  assert.ok(!changed.some((f) => /^package(-lock)?\.json$/.test(f)), 'no dependency change');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
