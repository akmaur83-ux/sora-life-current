// Joiya Jewellery (partner, 2026-11-25: "https://joiya.in/ yeh bhi kro" — as Kiara Jewels):
// three posters on the wellness homepage, under Kiara Jewels', in the same layout.
//   node scripts/test-joiya-jewellery.mjs
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message.split('\n')[0]}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const j = loadModule('src/lib/joiyaJewellery.js', {});

test('three posters, each a photograph served from this site with our own label, opening its listing', () => {
  assert.deepEqual(j.JOIYA_POSTERS.map((p) => [p.label, p.href]), [['Necklaces', '/fashion/c/necklaces'], ['Mangalsutra', '/fashion/c/mangalsutra'], ['Pendants', '/fashion/c/pendants']]);
  for (const p of j.JOIYA_POSTERS) {
    assert.match(p.image, /^\/img\/partners\/joiya-jewellery\/[a-z]+\.webp$/);
    const size = statSync(new URL(`..${p.image}`, import.meta.url)).size;
    assert.ok(size < 150_000, `${p.image} is ${size} bytes`);
    assert.ok(p.alt.length > 20, 'a real description');
  }
});
test('the copy repeats none of Joiya’s offer language, MRPs or material claims', () => {
  const words = JSON.stringify(j.JOIYA_POSTERS_SECTION) + JSON.stringify(j.JOIYA_POSTERS);
  assert.doesNotMatch(words, /free|warrant|combo|offer|mrp|premium|luxury|royal|gold plated|real gold|% off|₹/i);
  assert.equal(j.JOIYA_POSTERS_SECTION.link, '/fashion/search?q=joiya');
});
test('on the wellness homepage straight under the Kiara Jewels posters, and editable in Storefronts → Wellness', () => {
  assert.match(read('src/pages/Home.jsx'), /<KiaraPosters \/>\n\s*\{\/\*[^\n]*\*\/\}\n\s*<JoiyaPosters \/>/);
  assert.match(read('src/lib/storefrontContent.js'), /joiyaPosters: group\(/);
  assert.match(read('src/components/JoiyaJewellery.jsx'), /useStorefrontSection\('wellness', 'joiyaPosters', JOIYA_POSTERS_SECTION\)/);
});
test('the shared poster layout in Joiya’s wine, the photographs lazy-loaded at their real size', () => {
  const c = read('src/components/JoiyaJewellery.jsx');
  assert.match(c, /className="hx hx-ans hx-jy"/);
  assert.match(c, /width="900" height="1200" loading="lazy" decoding="async"/);
  assert.match(read('src/styles/v2-home.css'), /\.hx\.hx-jy \.hx-ans__cta \{ background: #6B2D3E; \}/);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
