// WhatsApp / social share cards for product links (api/share.js, owner 2026-11-08).
//   node scripts/test-share-card.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shareFacts, withProductHead } from '../api/_lib/share.js';
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
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
