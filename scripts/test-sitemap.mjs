// The sitemap (api/sitemap.js): public pages plus live product pages on soralifestyle.in.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSitemap, STATIC_PATHS } from '../api/sitemap.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`  PASS  ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`); } };

test('M1 empty catalogue still lists every public page on the new domain', () => {
  const xml = buildSitemap();
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  for (const p of STATIC_PATHS) assert.ok(xml.includes(`<loc>https://www.soralifestyle.in${p}</loc>`), p);
  assert.ok(!xml.includes('soralife.shop'));
});
test('M2 product URLs per store, lastmod as a date; grocery, unknown stores and bad slugs left out; no duplicates', () => {
  const xml = buildSitemap({
    wellness: [{ slug: 'sea-buckthorn-juice', updated_at: '2026-11-01T10:00:00Z' }, { slug: 'sea-buckthorn-juice' }, { slug: '../x' }, {}],
    catalogue: [{ store: 'fashion', slug: 'kurta-1' }, { store: 'homeliving', slug: 'bed-a', updated_at: 'nope' }, { store: 'grocery', slug: 'rice' }, { store: 'x', slug: 'y' }],
  });
  assert.ok(xml.includes('<loc>https://www.soralifestyle.in/product/sea-buckthorn-juice</loc><lastmod>2026-11-01</lastmod>'));
  assert.equal(xml.split('/product/sea-buckthorn-juice<').length - 1, 1);
  assert.ok(xml.includes('<loc>https://www.soralifestyle.in/fashion/p/kurta-1</loc></url>'));
  assert.ok(xml.includes('<loc>https://www.soralifestyle.in/homeliving/p/bed-a</loc></url>'));
  assert.ok(!xml.includes('rice') && !xml.includes('/y<') && !xml.includes('..'));
});
test('M3 vercel.json serves /sitemap.xml from the API before the SPA fallback; robots.txt points at it', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  const i = v.rewrites.findIndex((r) => r.source === '/sitemap.xml' && r.destination === '/api/sitemap');
  const spa = v.rewrites.findIndex((r) => r.destination === '/index.html');
  assert.ok(i >= 0 && i < spa);
  assert.match(readFileSync(new URL('../robots.txt', import.meta.url), 'utf8'), /^Sitemap: https:\/\/www\.soralifestyle\.in\/sitemap\.xml$/m);
});
test('M4 the route reads with the public key only', () => {
  const src = readFileSync(new URL('../api/sitemap.js', import.meta.url), 'utf8');
  assert.ok(!/SERVICE_ROLE|supabaseAdmin/.test(src.replace(/^\/\/.*$/gm, '')));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
