// The homepage arranged (owner, 2026-11-27: "site ko thodi arrange kro … symmetrical … hero image pe 3 shop ke
// button … 3 collage"): the collage hero the admin can edit, the store tiles retired in its favour, the brands
// opened by their own band, and nine brands set three by three on a phone.
//   node scripts/test-home-collage.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStorefrontContent, sectionSpec } from '../src/lib/storefrontContent.js';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message.split('\n')[0]}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the admin edits the hero as three slides of three photographs: name, small line, button, link, the phone and desktop photographs, their description and the phone crop', () => {
  const spec = sectionSpec('wellness', 'hero');
  assert.equal(spec.fields.slides.length, 3);
  const panel = spec.fields.slides.fields.panels;
  assert.equal(panel.type, 'list'); assert.equal(panel.length, 3);
  assert.deepEqual(Object.keys(panel.fields), ['hidden', 'title', 'note', 'cta', 'link', 'picture', 'alt', 'focus']);
  assert.deepEqual(panel.fields.focus.options, ['left', 'center', 'right']);
  const ok = validateStorefrontContent('wellness', { hero: { slides: [{ title: ['New', 'season'], panels: [{ title: 'Bangles', link: '/fashion/c/bangles', focus: 'right', picture: { phone: '/img/home-hero/leather-600.webp', desktop: '/img/home-hero/leather.webp' } }] }] } });
  assert.deepEqual(ok.errors, {});
  const bad = validateStorefrontContent('wellness', { hero: { slides: [{ panels: [{ link: 'https://elsewhere.example', focus: 'top', picture: { phone: '/img/a.webp' } }] }] } });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['hero.slides.0.panels.0.focus', 'hero.slides.0.panels.0.link', 'hero.slides.0.panels.0.picture']);
  assert.doesNotMatch(read('src/admin/storefrontSections.js'), /path: 'tiles'/, 'the retired tiles are not offered for editing');
});

test('the page: the collage hero, the trust strip, the store circles — no store tiles; the brands open with their own band', () => {
  const home = read('src/pages/Home.jsx');
  assert.doesNotMatch(home, /<HomeTiles \/>|HomeTiles,/);
  assert.match(home, /<HomeGroup eyebrow="Our brands" title="Straight from the makers" \/>\n      <BrandCarousel \/>/);
  assert.match(home, /<WinterDeals \/>\n      <HomeHero \/>\n      <HomeTrustStrip \/>/, 'the winter band stays on top (owner, 2026-11-20)');
});

test('nine brands, symmetrical: one row of nine on a wide screen, three by three on a tablet and a phone; the jewellery brands have their own pages', () => {
  const css = read('src/styles/sora-ds.css');
  assert.match(css, /\.sora-bc__row \{[^}]*grid-template-columns: repeat\(9, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1100px\) and \(min-width: 601px\) \{ \.sora-bc__row \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 600px\) \{[\s\S]*?\.sora-bc__row \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  const brands = read('src/lib/brands.js');
  for (const [id, name] of [['kiara-jewels', 'Kiara Jewels'], ['joiya-jewellery', 'Joiya Jewellery']]) {
    assert.match(brands, new RegExp(`id: '${id}', page: '/brands/${id}'[^\\n]*catalogueBrand: '${name}'`));
  }
  assert.doesNotMatch(brands.slice(brands.indexOf("id: 'kiara-jewels'")), /premium|luxury|real gold|gold plated|% off|\bfree\b/i, 'facts only');
});

test('motion: only transform and opacity, entrances fill backwards, nothing under reduced motion', () => {
  const css = read('src/styles/sora-ds.css');
  assert.match(css, /@keyframes hx-settle \{ from \{ transform: scale\(1\.08\); \} to \{ transform: none; \} \}/);
  assert.match(css, /@keyframes hx-rise \{ from \{ opacity: 0; transform: translate3d\(0, 14px, 0\); \} to \{ opacity: 1; transform: none; \} \}/);
  assert.match(css, /\.hx-hero__slide\.is-on \.hx-hero__ph \{ animation: hx-settle [^}]* backwards; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[\s\S]*?\.hx-hero__ph, \.hx-hero__txt > \*,[^{]*\{ animation: none !important; \}/);
  assert.match(read('src/styles/v2-home.css'), /prefers-reduced-motion: reduce\) \{\n  \.hx-hero__track, \.hx-hero__img, \.hx-hero__shop, \.hx-hero__shop svg,/);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
