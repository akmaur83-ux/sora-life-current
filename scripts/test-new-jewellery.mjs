// New in Jewellery (owner, 2026-11-25: Kiara Jewels and Joiya Jewellery tie-ups, then
// "apne hisab se kro sab visually acha dikhna chahiye or homepage pe bhi"): one bento
// section on the wellness homepage in place of two more poster rows.
//   node scripts/test-new-jewellery.mjs
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message.split('\n')[0]}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const n = loadModule('src/lib/newJewellery.js', {});

test('five photographs, the first large; every tile names its category and its brand and opens a listing', () => {
  assert.deepEqual(n.NEW_JEWELLERY_TILES.map((t) => [t.label, t.brand, t.href]), [
    ['Bangles', 'Kiara Jewels', '/fashion/c/bangles'],
    ['Mangalsutra', 'Kiara Jewels', '/fashion/c/mangalsutra'],
    ['Pendants', 'Joiya Jewellery', '/fashion/c/pendants'],
    ['Necklaces', 'Kiara Jewels', '/fashion/c/necklaces'],
    ['Chains & more', 'Joiya Jewellery', '/fashion/search?q=joiya'],
  ]);
  for (const t of n.NEW_JEWELLERY_TILES) {
    assert.match(t.image, /^\/img\/partners\/(kiara-jewels|joiya-jewellery)\/[a-z]+\.webp$/);
    const size = statSync(new URL(`..${t.image}`, import.meta.url)).size;
    assert.ok(size < 150_000, `${t.image} is ${size} bytes`);
    assert.ok(t.alt.length > 20, 'a real description');
  }
  const c = read('src/components/NewJewellery.jsx');
  assert.match(c, /i === 0 \? 'hx-nj__cell hx-nj__cell--lead' : 'hx-nj__cell'/);
  assert.match(c, /width="900" height="1200" loading="lazy" decoding="async"/);
});
test('the words repeat none of the brands’ offer language, MRPs or material claims', () => {
  const words = JSON.stringify(n.NEW_JEWELLERY_SECTION) + JSON.stringify(n.NEW_JEWELLERY_TILES);
  assert.doesNotMatch(words, /free|warrant|combo|offer|mrp|premium|luxury|royal|buy 1|get 2|gold plated|real gold|% off|₹/i);
  assert.equal(n.KIARA.href, '/fashion/search?q=kiara%20jewels');
  assert.equal(n.JOIYA.href, '/fashion/search?q=joiya');
  assert.equal(n.NEW_JEWELLERY_SECTION.link, '/fashion/jewellery');
});
test('on the wellness homepage under the Ansari Fashion posters, the two poster rows retired, editable in Storefronts → Wellness', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /<AnsariPosters \/>\n\s*\{\/\*[^\n]*\*\/\}\n\s*<NewJewellery \/>/);
  assert.doesNotMatch(home, /KiaraPosters|JoiyaPosters/);
  for (const gone of ['src/components/KiaraJewels.jsx', 'src/components/JoiyaJewellery.jsx', 'src/lib/kiaraJewels.js', 'src/lib/joiyaJewellery.js']) assert.ok(!existsSync(new URL(`../${gone}`, import.meta.url)), gone);
  const reg = read('src/lib/storefrontContent.js');
  assert.match(reg, /newJewellery: group\(/);
  assert.doesNotMatch(reg, /kiaraPosters|joiyaPosters/);
  assert.match(read('src/components/NewJewellery.jsx'), /useStorefrontSection\('wellness', 'newJewellery', NEW_JEWELLERY_SECTION\)/);
});
test('the look: a champagne band, a bento on desktop, one-then-two-by-two on a phone; only transform moves, and not for reduced motion', () => {
  const css = read('src/styles/v2-home.css');
  assert.match(css, /\.hx\.hx-nj \{[^}]*background: linear-gradient\(180deg, #FBF6EE 0%, #F4EADB 100%\)/);
  assert.match(css, /\.hx-nj__grid \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.hx-nj__cell--lead \{ grid-column: span 2; grid-row: span 2; \}/);
  assert.match(css, /@media \(max-width: 899px\) \{[\s\S]*?\.hx-nj__grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.hx-nj__tile img, \.hx-nj__cta svg, \.hx-nj__name svg \{ transition: none; \}/);
  assert.doesNotMatch(css, /\.hx-kj|\.hx-jy/);
});
test('the jewellery page’s mangalsutra banner shows a mangalsutra (it showed a stack of rings)', () => {
  const c = read('src/fashion/jewelleryContent.js');
  assert.match(c, /cta: 'Shop mangalsutra', slug: 'mangalsutra',[\s\S]*?art\('jewellery-edit-mangalsutra', 'A black-bead hand mangalsutra/);
  for (const f of ['jewellery-edit-mangalsutra', 'jewellery-edit-mangalsutra-700']) assert.ok(statSync(new URL(`../img/fashion-editorial/${f}.webp`, import.meta.url)).size < 150_000, f);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
