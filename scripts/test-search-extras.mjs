// Search by voice, "Did you mean…?", the wellness discount sort and the app manifest
// (owner, 2026-11-10: more features).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { didYouMean } from '../src/lib/searchMatch.js';
import { SHOP_SORTS, normalizedShopSort } from '../src/lib/shopFilters.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed += 1; console.log(`FAIL ${name}\n     ${e.message}`); } };

const items = [
  { name: 'Cotton Kurta Set', brand: 'Weavers Villa', category: 'Kurtas' },
  { name: 'Silk Saree', brand: 'WV', category: 'Sarees' },
  { name: 'Leather Wallet', brand: 'Leather Factory', category: 'Wallets' },
  { name: 'Double Bedsheet', brand: 'Home', category: 'Bedsheets' },
];

test('a misspelt word is corrected to the store’s own word', () => {
  assert.equal(didYouMean(items, 'kurtha'), 'kurta');
  assert.equal(didYouMean(items, 'bedshet'), 'bedsheet');
  assert.equal(didYouMean(items, 'lether wallet'), 'leather wallet');
  assert.equal(didYouMean(items, 'walelt'), 'wallet');   // two letters swapped
});
test('nothing is offered when the search already finds products', () => {
  assert.equal(didYouMean(items, 'kurta'), '');
  assert.equal(didYouMean(items, 'saree'), '');
});
test('nothing is offered for a word nowhere near the catalogue', () => {
  assert.equal(didYouMean(items, 'xyzzy'), '');
  assert.equal(didYouMean(items, 'ab'), '');
  assert.equal(didYouMean([], 'kurtha'), '');
});
test('the correction is checked with the caller’s own rule', () => {
  assert.equal(didYouMean(items, 'kurtha', undefined, () => false), '');
});
test('the wellness shop sorts by biggest discount', () => {
  assert.ok(SHOP_SORTS.some((s) => s.id === 'discount'));
  assert.equal(normalizedShopSort('discount'), 'discount');
  assert.match(read('src/components/ProductBrowser.jsx'), /case 'discount'/);
});
test('voice search sits in all three stores’ search boxes', () => {
  for (const f of ['src/components/Header.jsx', 'src/fashion/FashionLayout.jsx', 'src/homeliving/HomeLivingLayout.jsx']) assert.match(read(f), /<VoiceSearch onResult=/, f);
  assert.match(read('src/components/VoiceSearch.jsx'), /lang = 'en-IN'/);
});
test('the site has an installable app manifest', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  assert.match(read('index.html'), /<link rel="manifest" href="\/manifest.webmanifest" \/>/);
});
test('the offline notice is on every page', () => {
  const s = read('src/components/SiteAssist.jsx');
  assert.match(s, /addEventListener\('offline'/);
  assert.match(s, /if \(hidden\) return <>\{netNote\}\{promo\}<\/>;/);
});

if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log('\nall passed');
