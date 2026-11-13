// Ansari Fashion (partner, 2026-11-13): Banarasi suits and sarees in Fashion › Women,
// their posters and range on the wellness homepage and the Fashion home.
//   node scripts/test-ansari-fashion.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lib = loadModule('src/lib/ansariFashion.js', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], supabase: null, selectWeaversRange: (rows) => rows });

test('posters: three of their category photographs, served from this site, with our own labels and links', () => {
  assert.deepEqual(lib.ANSARI_POSTERS.map((p) => p.href), ['/fashion/c/suits-dress-materials', '/fashion/search?q=banarasi%20silk', '/fashion/c/sarees']);
  for (const p of lib.ANSARI_POSTERS) {
    assert.match(p.image, /^\/img\/partners\/ansari-fashion\/[a-z-]+\.webp$/);
    assert.ok(existsSync(new URL(`..${p.image}`, import.meta.url)), p.image);
    assert.ok(p.label && p.alt.length > 10);
  }
});
test('cards ask their CDN for a card-sized picture', () => {
  assert.equal(lib.ansariCard('https://x.cloudfront.net/NushopCatalogue/tr:f-webp,w-1200,fo-auto/a/cat_img/b.jpg'), 'https://x.cloudfront.net/NushopCatalogue/tr:f-webp,w-700,fo-auto/a/cat_img/b.jpg');
});
test('the range reads only their in-stock fashion rows', async () => {
  const calls = [];
  const q = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : (...a) => { calls.push([k, ...a].join(':')); return k === 'limit' ? Promise.resolve({ data: [], error: null }) : q; }) });
  await lib.fetchAnsariRows({ from: (t) => { calls.push(`from:${t}`); return q; } });
  for (const c of ['from:catalogue_products', 'eq:store:fashion', 'eq:brand:Ansari Fashion', 'eq:is_active:true', 'gt:stock:0']) assert.ok(calls.includes(c), c);
});
test('wired: after Taj Leather on both homes; editable in Storefronts → Wellness', () => {
  const fs = read('src/fashion/FashionHome.jsx');
  assert.ok(fs.indexOf('<AnsariPosters />') > fs.indexOf('<TajLeatherPosters />'));
  assert.ok(fs.indexOf('<AnsariRange />') > fs.indexOf('<TajLeatherRange />'));
  const home = read('src/pages/Home.jsx');
  assert.ok(home.indexOf('<AnsariPosters />') > home.indexOf('<TajLeatherRange />'));
  const c = read('src/lib/storefrontContent.js');
  assert.match(c, /ansariPosters: group\(/); assert.match(c, /ansari: group\(/);
});

if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log('\nall passed');
