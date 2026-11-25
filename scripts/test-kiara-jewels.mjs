// Kiara Jewels (partner, 2026-11-25: "tie up ho chuka hai", then "home page pe poster dalo"):
// three posters on the wellness homepage, under Ansari Fashion's, in the Ansari layout.
//   node scripts/test-kiara-jewels.mjs
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const k = loadModule('src/lib/kiaraJewels.js', {});

test('three posters, each a photograph served from this site with our own label, opening its listing', () => {
  assert.deepEqual(k.KIARA_POSTERS.map((p) => [p.label, p.href]), [['Bangles', '/fashion/c/bangles'], ['Mangalsutra', '/fashion/c/mangalsutra'], ['Necklaces', '/fashion/c/necklaces']]);
  for (const p of k.KIARA_POSTERS) {
    assert.match(p.image, /^\/img\/partners\/kiara-jewels\/[a-z]+\.webp$/);
    const size = statSync(new URL(`..${p.image}`, import.meta.url)).size;
    assert.ok(size < 150_000, `${p.image} is ${size} bytes`);
    assert.ok(p.alt.length > 20, 'a real description');
  }
});
test('the copy claims nothing of Kiara’s offers, warranties or materials', () => {
  const words = JSON.stringify(k.KIARA_POSTERS_SECTION) + JSON.stringify(k.KIARA_POSTERS);
  assert.doesNotMatch(words, /free|warrant|buy 1|get 2|hypoallergenic|waterproof|anti.?tarnish|gold plated|real gold|% off/i);
  assert.equal(k.KIARA_POSTERS_SECTION.link, '/fashion/search?q=kiara%20jewels');
});
test('on the wellness homepage straight under the Ansari Fashion posters, and editable in Storefronts → Wellness', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /<AnsariPosters \/>\n\s*\{\/\*[^\n]*\*\/\}\n\s*<KiaraPosters \/>/);
  assert.match(read('src/lib/storefrontContent.js'), /kiaraPosters: group\(/);
  assert.match(read('src/components/KiaraJewels.jsx'), /useStorefrontSection\('wellness', 'kiaraPosters', KIARA_POSTERS_SECTION\)/);
});
test('the Ansari layout in the jewellery gold, the photographs lazy-loaded at their real size', () => {
  const c = read('src/components/KiaraJewels.jsx');
  assert.match(c, /className="hx hx-ans hx-kj"/);
  assert.match(c, /width="900" height="1200" loading="lazy" decoding="async"/);
  assert.match(read('src/styles/v2-home.css'), /\.hx\.hx-kj \.hx-ans__cta \{ background: #8B6A3E; \}/);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
