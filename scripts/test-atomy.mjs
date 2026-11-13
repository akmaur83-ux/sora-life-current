// Atomy (partner, 2026-11-11): their range in the wellness store and on the homepage.
//   node scripts/test-atomy.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectAtomyRange, ATOMY_TILES, ATOMY_LISTING, atomyCard } from '../src/lib/atomy.js';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const p = (id, category, extra = {}) => ({ id, slug: `atomy-${id}`, name: `Atomy ${id}`, brand: 'Atomy', category, price: 900, stock: 10, image: `https://image.atomy.com/IN/goods/${id}/${id}_00.jpg?w=1000&h=1000`, ...extra });

test('the range: Atomy only, in stock, bestsellers first, then the kinds take turns (household last)', () => {
  const list = [
    p('scrub', 'personal-care'), p('toner', 'skin-care'), p('cream', 'skin-care'), p('omega', 'supplements'),
    p('him', 'supplements', { isBestseller: true }), p('gone', 'skin-care', { stock: 0 }), p('free', 'skin-care', { price: 0 }),
    { ...p('bio', 'skin-care'), brand: 'Biosash' }, p('shampoo', 'hair-care'),
  ];
  assert.deepEqual(selectAtomyRange(list).map((c) => c.name), ['Atomy him', 'Atomy toner', 'Atomy omega', 'Atomy shampoo', 'Atomy scrub', 'Atomy cream']);
  const c = selectAtomyRange(list)[0];
  assert.deepEqual([c.href, c.whole, c.image], ['/product/atomy-him', true, 'https://image.atomy.com/IN/goods/him/him_00.jpg?w=600&h=600']);
  assert.equal(selectAtomyRange(list, 2).length, 2);
});
test('pictures: a card-sized copy from their CDN', () => {
  assert.equal(atomyCard('https://image.atomy.com/a.jpg?w=1000&h=1000'), 'https://image.atomy.com/a.jpg?w=600&h=600');
  assert.equal(atomyCard(null), null);
});
test('the tiles open the brand’s part of the wellness search', () => {
  assert.equal(ATOMY_LISTING, '/shop?q=atomy');
  for (const t of ATOMY_TILES) { assert.match(t.href, /^\/shop\?q=(atomy%20[a-z%20]+|hemohim)$/); assert.match(t.image, /^https:\/\/image\.atomy\.com\/IN\/goods\//); }
});
test('wired: on the homepage through the brands row (2026-11-13 redesign), its own page, editable in Storefronts → Wellness', () => {
  const home = read('src/pages/Home.jsx');
  assert.ok(!home.includes('<AtomyRange />') && home.split('<BrandCarousel />').length === 2);
  assert.match(read('src/lib/brands.js'), /id: 'atomy', page: '\/brands\/atomy'/);
  assert.match(read('src/components/Atomy.jsx'), /export function AtomyShowcase/, 'the sections stay, ready to be placed again');
  const c = read('src/lib/storefrontContent.js');
  assert.match(c, /atomy: group\(/); assert.match(c, /atomyShowcase: group\(/);
});

if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log('\nall passed');
