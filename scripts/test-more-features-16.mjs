// More features (owner, 2026-11-20, round 16): the product question on WhatsApp now says the size and colour,
// shop by fabric & craft, prefilled replies to enquiries.
//   node scripts/test-more-features-16.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const R = { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, Icon: () => null };

test('the product question on WhatsApp carries the size and colour chosen (the existing link, not a second one)', () => {
  const d = read('src/components/pdp/PdpDeliveryDate.jsx');
  assert.match(d, /waLink\(care\?\.phone, window\.location\.pathname, askChoice && base \? `\$\{base\} \(\$\{askChoice\}\)` : productName, page\)/);
  assert.match(read('src/fashion/FashionProductPage.jsx'), /askChoice=\{st\.label \|\| ''\} \/>/);
  for (const f of ['src/fashion/FashionProductPage.jsx', 'src/homeliving/HomeLivingProductPage.jsx', 'src/pages/Product.jsx']) assert.ok(!read(f).includes('PdpAsk'), f);
});
test('fabric & craft: whole words only, three or more, most first', () => {
  const x = loadModule('src/components/ShopExtras.jsx', { ...R, money: String, supabase: null, cataloguePrice: () => 0 });
  const v = (name, description = '') => ({ name, description });
  const views = [v('Black Leather Jacket'), v('Leather Belt'), v('Brown leather wallet'), v('Banarasi Silk Suit'), v('Banarasi cotton suit'), v('Banarasi saree'), v('Silky scarf'), v('Pure silk stole'), v('Suit', 'woven in silk')];
  assert.deepEqual(x.fabricChips(views).map((c) => [c.name, c.count]), [['Leather', 3], ['Banarasi', 3], ['Silk', 3]]);
  assert.equal(x.fabricChips(views)[1].href, '/fashion/search?q=banarasi');
  assert.match(read('src/fashion/FashionHome.jsx'), /<ShopByFabric views=\{views\} \/>/);
});
test('enquiry replies: a polite first line by kind, first name only', () => {
  const e = loadModule('src/admin/pages/Enquiries.jsx', { ...R, supabase: null, ENQUIRY_KINDS: {}, toCsv: () => '', downloadCsv: () => {} });
  assert.match(e.replyText({ kind: 'partner', name: 'Ravi Kumar', business: 'Ravi Crafts' }), /^Hi Ravi, this is SORA LIFESTYLE\. Thank you for your interest in selling Ravi Crafts on SORA\./);
  assert.match(e.replyText({ kind: 'bulk', name: 'A' }), /quantity, budget per gift and the date/);
  assert.match(e.replyText({ kind: 'request', query: 'red jacket' }), /^Hi, this is SORA LIFESTYLE\. You asked us for “red jacket”/);
  assert.ok(!/guarantee|promise|will stock/i.test(['partner', 'bulk', 'request'].map((k) => e.replyText({ kind: k })).join(' ')), 'nothing promised');
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
