// WhatsApp / social share cards for product links (api/share.js, owner 2026-11-08).
//   node scripts/test-share-card.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shareFacts, withProductHead, withPageHead, PAGE_CARDS } from '../api/_lib/share.js';
let passed = 0, failed = 0;
const test = (n, fn) => { try { fn(); console.log(`  PASS  ${n}`); passed++; } catch (e) { console.log(`  FAIL  ${n}\n        ${e.message}`); failed++; } };
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('a fashion product: title with price and discount, description, picture, canonical and Product data in the head', () => {
  const f = shareFacts('fashion', { name: 'Red "Kullu" Shawl', description: '<p>Soft & warm</p>', images: ['https://cdn/x.jpg'], mrp: 2000, sale_price: 1500, brand: 'Weavers Villa', stock: 0, catalogue_variants: [{ stock: 0 }, { stock: 4 }] }, 'red-shawl');
  const out = withProductHead(html, f);
  assert.match(out, /<title>Red &quot;Kullu&quot; Shawl — ₹1,500 \(25% off\) \| SORA LIFESTYLE<\/title>/);
  assert.match(out, /<meta property="og:image" content="https:\/\/cdn\/x.jpg" \/>/);
  assert.match(out, /<meta name="description" content="Soft &amp; warm" \/>/);
  assert.match(out, /<link rel="canonical" href="https:\/\/www.soralifestyle.in\/fashion\/p\/red-shawl" \/>/);
  assert.match(out, /"availability":"https:\/\/schema.org\/InStock"/);
  assert.equal((out.match(/<script type="module" src="\/public\/bundle.js"><\/script>/g) || []).length, 1, 'the app still starts');
});
test('a wellness product reads its own columns; a missing row or a free product leaves the page exactly as it is', () => {
  const f = shareFacts('product', { name: 'Lipstick', original_price: 300, sale_price: 270, image_url: 'https://s/p.png', stock: true }, 'lip');
  assert.equal(f.price, 270); assert.equal(f.inStock, true); assert.equal(f.path, '/product/lip');
  assert.equal(withProductHead(html, shareFacts('fashion', null, 'x')), html);
  assert.equal(withProductHead(html, { name: 'Free', price: 0 }), html);
});
test('vercel.json sends the three product paths here before the app', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const i = (s) => v.rewrites.findIndex((r) => r.source === s);
  for (const s of ['/product/:slug', '/fashion/p/:slug', '/homeliving/p/:slug']) assert.ok(i(s) >= 0 && i(s) < i('/((?!api/).*)'), s);
});
test('the site card: the sparrow share picture, the new title; a product page carries one of each tag, its own', () => {
  assert.match(html, /<meta property="og:image" content="https:\/\/www.soralifestyle.in\/assets\/sora-share-card.jpg" \/>/);
  assert.match(html, /<meta property="og:title" content="SORA LIFESTYLE — Fashion, Home &amp; Living, Wellness &amp; Beauty" \/>/);
  const out = withProductHead(html, shareFacts('fashion', { name: 'Jacket', images: ['https://cdn/j.jpg'], mrp: 5000, sale_price: 4000 }, 'jacket'));
  for (const tag of ['og:image', 'og:title', 'og:description', 'og:type']) assert.equal((out.match(new RegExp(`property="${tag}"`, 'g')) || []).length, 1, tag);
  assert.equal((out.match(/name="twitter:card"/g) || []).length, 1);
  assert.match(out, /og:image" content="https:\/\/cdn\/j.jpg"/);
});
test('store pages: their own title and description, the site picture kept; unknown pages untouched', () => {
  const out = withPageHead(html, 'fashion');
  assert.match(out, /<title>Fashion — leather, shawls, ethnic and everyday wear \| SORA LIFESTYLE<\/title>/);
  assert.match(out, /<meta property="og:title" content="Fashion — leather/);
  assert.match(out, /og:image" content="https:\/\/www.soralifestyle.in\/assets\/sora-share-card.jpg"/);
  assert.match(out, /<link rel="canonical" href="https:\/\/www.soralifestyle.in\/fashion" \/>/);
  assert.equal(withPageHead(html, 'constructor'), html);
  assert.equal(withPageHead(html, 'nope'), html);
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const i = (s) => v.rewrites.findIndex((r) => r.source === s);
  for (const k of Object.keys(PAGE_CARDS)) assert.ok(i(`/${k}`) >= 0 && i(`/${k}`) < i('/((?!api/).*)'), k);
  assert.equal(v.rewrites[i('/fashion')].destination, '/api/sitemap?kind=page&slug=fashion');
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
