// ============================================================
// The display typeface — Playfair Display in place of Fraunces. Offline suite.
//
// One Google Fonts request (the same host, the same connection; wght 400..700
// is every weight a rule sets), the two tokens, every sheet's fallback name,
// no Fraunces axis left behind (opsz/SOFT/WONK, font-optical-sizing, the
// resets that only cancelled them), the optical-weight map on the storefront
// sheets that were measured (500→400, 600→500, negative tracking halved,
// uppercase tracking kept), and the surfaces that were NOT to be touched
// beyond the token cascade (creator dashboard and tiers, coupons, cart and
// checkout) byte-identical to the baseline. NO NETWORK, NO BROWSER.
//
//   node scripts/test-typeface.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-typeface.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, read, has } from './grocery-ssr.mjs';
import { atCommit } from './baseline-export.mjs';

// The tree as it stood before this work: the carousel-move release.
const BASELINE_SHA = 'b582caa';
let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
console.log(`\nsource root: ${ROOT}`);

const SHEETS = readdirSync(resolve(ROOT, 'src/styles')).filter((f) => f.endsWith('.css')).sort();
const UNTOUCHED = ['src/styles/creator-dashboard.css', 'src/styles/creator-tier.css', 'src/styles/coupons.css', 'src/styles/v2-cart-checkout.css', 'src/styles/creator.css', 'src/styles/passport.css'];

await test('index.html: one Google Fonts request on the same host — Playfair Display wght 400..700 beside Inter — and the loading placeholder in the same face; no Fraunces request', () => {
  const html = read('index.html');
  assert.match(html, /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Playfair\+Display:wght@400\.\.700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" \/>/);
  assert.equal((html.match(/fonts\.googleapis\.com\/css2/g) || []).length, 1, 'one font request');
  assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>/, 'the same preconnect');
  assert.match(html, /font-family:'Playfair Display',Georgia,serif;color:#1E3A2F;/, 'the pre-hydration placeholder');
  assert.doesNotMatch(html, /family=Fraunces|'Fraunces'/);
});

await test('the two tokens name Playfair Display; every sheet that spells out the fallback spells the new face; the four surfaces left to the token cascade still spell the old one only as a dead fallback', () => {
  assert.match(read('src/styles/tokens.css'), /--font-display: 'Playfair Display', 'Georgia', 'Times New Roman', serif;/);
  assert.match(read('src/styles/v2-foundation.css'), /--slv2-disp:'Playfair Display', Georgia, 'Times New Roman', serif;/);
  for (const f of SHEETS) {
    const rel = `src/styles/${f}`;
    if (UNTOUCHED.includes(rel)) continue;
    assert.doesNotMatch(stripComments(read(rel)), /Fraunces/, `${rel} still names Fraunces`);
  }
  for (const rel of ['src/styles/fashion.css', 'src/styles/grocery.css', 'src/styles/homeliving.css', 'src/styles/lifestyle.css', 'src/styles/fashion-banner.css', 'src/styles/leaderboard.css']) {
    assert.match(read(rel), /var\(--font-display, 'Playfair Display', Georgia, serif\)/, `${rel} fallback`);
  }
});

await test('no Fraunces-specific setting survives: no font-variation-settings (opsz/SOFT/WONK or the resets that cancelled them), no font-optical-sizing, in any sheet', () => {
  for (const f of SHEETS) {
    const css = stripComments(read(`src/styles/${f}`));
    assert.doesNotMatch(css, /font-variation-settings/, `${f}: font-variation-settings`);
    assert.doesNotMatch(css, /font-optical-sizing/, `${f}: font-optical-sizing`);
    assert.doesNotMatch(css, /'opsz'|'SOFT'|'WONK'/, `${f}: an axis`);
  }
  assert.match(read('src/styles/v2-foundation.css'), /\.v2-disp \{ font-family:var\(--slv2-disp\); \}/, 'the display helper is just the family now');
});

await test('the optical-weight map on the measured storefront sheets: the .serif base at 400 / -.008em (was 500 / -.015em); wordmarks and the catalogue card name at 500 (were 600); hero headlines at half their old negative tracking; uppercase tracking untouched', () => {
  for (const [rel, ns] of [['src/styles/fashion.css', 'fs'], ['src/styles/grocery.css', 'gs'], ['src/styles/homeliving.css', 'hl'], ['src/styles/lifestyle.css', 'ls']]) {
    assert.match(read(rel), new RegExp(`\\.${ns} \\.serif \\{ font-family: var\\(--font-display, 'Playfair Display', Georgia, serif\\); font-weight: 400; letter-spacing: -\\.008em; color: var\\(--slv2-ink\\); \\}`), `${rel}: the .serif base`);
  }
  const fashion = read('src/styles/fashion.css'), grocery = read('src/styles/grocery.css'), homeliving = read('src/styles/homeliving.css'), lifestyle = read('src/styles/lifestyle.css');
  assert.match(fashion, /\.fs-logo__txt strong \{ font-family: var\(--font-display, 'Playfair Display', Georgia, serif\); font-weight: 500; font-size: 24px; letter-spacing: \.1em;/);
  assert.match(grocery, /\.gs-logo strong \{ font-weight: 500; font-size: 28px; letter-spacing: \.12em;/);
  assert.match(homeliving, /\.hl-logo strong \{ font-weight: 500; font-size: 28px; letter-spacing: \.12em;/);
  assert.match(lifestyle, /\.ls-logo strong \{ font-weight: 500; font-size: 24px; letter-spacing: \.12em;/);
  assert.match(fashion, /\.fs-catcard__body strong \{ font-family: var\(--font-display, 'Playfair Display', Georgia, serif\); font-weight: 500; font-size: 18px;/);
  assert.match(fashion, /\.fs-brandcard__logo \{ font-size: 18px; letter-spacing: \.18em; text-transform: uppercase; text-align: center; font-weight: 500; \}/);
  assert.match(fashion, /\.fs-hero__h \{ margin: 0; font-size: clamp\(38px, 5vw, 64px\); line-height: 1; letter-spacing: -\.01em; \}/);
  assert.match(grocery, /\.gs-hero__h \{ margin: 0; font-size: clamp\(34px, 4\.6vw, 58px\); line-height: 1\.02; letter-spacing: -\.01em; \}/);
  assert.match(homeliving, /\.hl-hero__h \{ margin: 0; font-size: clamp\(42px, 5\.6vw, 76px\); line-height: \.98; letter-spacing: -\.012em; color: var\(--slv2-f800\); \}/);
  assert.match(lifestyle, /\.ls-hero__h \{ margin: 0 0 6px; font-size: var\(--ls-hero-h\); line-height: 1; letter-spacing: -\.015em; color: var\(--slv2-ink\); \}/);
  assert.match(lifestyle, /\.ls-banner__h \{ margin: 0 0 6px; font-size: 24px; line-height: 1\.02; letter-spacing: -\.015em; \}/);
  // Nothing at 600+ on a display-font rule in these sheets any more.
  for (const [rel, css] of [['fashion', fashion], ['grocery', grocery], ['homeliving', homeliving], ['lifestyle', lifestyle]]) {
    for (const m of css.matchAll(/^[^\n{]*\{[^}]*font-display[^}]*\}/gm)) assert.doesNotMatch(m[0], /font-weight: [6-9]00/, `${rel}: ${m[0].slice(0, 60)} is heavier than the map allows`);
  }
});

await test('the surfaces that could not be measured offline — creator dashboard and tiers, coupons, cart and checkout, the creator programme and passport — are byte-identical to the baseline: the token alone changes their face', () => {
  for (const rel of UNTOUCHED) assert.equal(read(rel), atCommit(BASELINE_SHA, rel).replace(/\r\n/g, '\n'), `${rel} changed`);
  // …and the wellness sheets that the token also carries changed only by the axis removal (and, in v2-pdp/v2-shop, a comment).
  for (const rel of ['src/styles/v2-foundation.css', 'src/styles/v2-card.css', 'src/styles/v2-home.css', 'src/styles/v2-pdp.css', 'src/styles/v2-home-marketplace.css', 'src/styles/v2-shop.css']) {
    const norm = (t) => stripComments(t).replace(/\s*font-variation-settings:[^;]+;/g, '').replace(/\s*font-optical-sizing:[^;]+;/g, '').replace(/'Fraunces'/g, "'Playfair Display'").replace(/\s+/g, ' ');
    assert.equal(norm(read(rel)), norm(atCommit(BASELINE_SHA, rel)), `${rel}: only the axes (and the family name) changed`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
