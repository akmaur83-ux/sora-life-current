// More features (owner, 2026-11-20, round 12): the Winter and Leather edits and their
// ways in, and the new-enquiries count in the admin.
//   node scripts/test-more-features-12.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const price = (r) => Number(r.sale_price) || Number(r.mrp);
const w = loadModule('src/lib/weddingEdit.js', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], supabase: null, cataloguePrice: price });
const f = loadModule('src/lib/fashionEdits.js', { useEffect: () => {}, useMemo: (fn) => fn(), useState: (v) => [v, () => {}], supabase: null, weddingSections: w.weddingSections });
const row = (id, slug, extra = {}) => ({ id, slug: `p${id}`, name: `P${id}`, images: ['i.jpg'], mrp: 1000, sale_price: 800, stock: 5, category: { slug }, ...extra });

test('the edits: in-stock pieces of their own categories, taking turns; empty sections left out', () => {
  const rows = [row(1, 'mens-leather-jackets'), row(2, 'mens-leather-coats'), row(3, 'mens-leather-jackets'), row(4, 'womens-shawls'), row(5, 'mufflers-caps', { stock: 0 }), row(6, 'stoles', { variants: [{ stock: 0, is_active: true }] }), row(7, 'belts')];
  const s = f.editSections(rows, f.FASHION_EDITS.winter);
  assert.deepEqual(s.map((x) => [x.id, x.items.map((c) => c.key).join()]), [['him', 'fashion-1,fashion-2,fashion-3'], ['shawls', 'fashion-4']]);
  assert.equal(s[0].href, '/fashion/c/mens-leather-jackets');
  const l = f.editSections(rows, f.FASHION_EDITS.leather);
  assert.deepEqual(l.map((x) => x.id), ['jackets', 'coats', 'belts']);
  assert.equal(f.FASHION_EDITS.leather.care, true);
});
test('the wedding edit is unchanged by the sharing', () => {
  const s = w.weddingSections([row(1, 'sarees'), row(2, 'mens-leather-jackets')]);
  assert.deepEqual(s.map((x) => x.id), ['outfits', 'him']);
});
test('ways in: routes, the Fashion home, the mega menu, the footer, the sitemap', () => {
  const app = read('src/App.jsx');
  assert.match(app, /<Route path="winter" element=\{<FashionEdit id="winter" \/>\} \/>/);
  assert.match(app, /<Route path="leather" element=\{<FashionEdit id="leather" \/>\} \/>/);
  assert.match(read('src/fashion/FashionHome.jsx'), /<WeddingStrip \/>\n.*\n      <EditStrips \/>/);
  assert.match(read('src/components/MegaMenu.jsx'), /\['\/fashion\/winter', 'The Winter edit'\], \['\/fashion\/leather', 'Everything leather'\]/);
  for (const p of ['/fashion/winter', '/fashion/leather']) { assert.ok(read('api/sitemap.js').includes(`'${p}'`), p); assert.ok(read('src/components/Footer.jsx').includes(`to="${p}"`), p); }
});
test('admin: the new-enquiries count reads a count only, new ones only', () => {
  const a = read('src/admin/AdminLayout.jsx');
  assert.match(a, /\.from\('enquiries'\)\.select\('id', \{ count: 'exact', head: true \}\)\.eq\('status', 'new'\)/);
  assert.match(a, /n\.to === '\/admin\/enquiries' && newEnquiries > 0/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
