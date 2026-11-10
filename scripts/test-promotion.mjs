// Promotion (owner, 2026-11-10): the product feed for Google Shopping and Meta, the
// /offers page, promo links, the welcome offer card, sharing the offer.
//   node scripts/test-promotion.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
import { feedItems, buildFeed, wellnessPrices, cataloguePrices } from '../api/_lib/feed.js';
import { STATIC_PATHS } from '../api/sitemap.js';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('feed: prices as the storefront shows them', () => {
  assert.deepEqual(wellnessPrices({ original_price: 300, discount_percent: 10 }), { mrp: 300, price: 270 });
  assert.deepEqual(wellnessPrices({ original_price: 300, sale_price: 250 }), { mrp: 300, price: 250 });
  assert.equal(wellnessPrices({ original_price: 0 }), null);
  assert.deepEqual(cataloguePrices({ mrp: 1000, sale_price: 700 }), { mrp: 1000, price: 700 });
  assert.deepEqual(cataloguePrices({ mrp: 1000, sale_price: 1200 }), { mrp: 1000, price: 1000 });
});
test('feed: every store, stock from the variants, demo rows and products without a picture left out', () => {
  const items = feedItems({
    wellness: [{ id: 1, slug: 'tea', name: 'Tea', image_url: '/img/tea.webp', original_price: 200, discount_percent: 0, stock: 3 }, { id: 2, slug: 'x', name: 'X', original_price: 100 }],
    catalogue: [
      { id: 'a', store: 'fashion', slug: 'shawl', name: 'Shawl & Stole', images: ['https://cdn/x.jpg', 'https://cdn/y.jpg'], mrp: 2000, sale_price: 1500, stock: 0, variants: [{ stock: 0, is_active: true }, { stock: 2, is_active: true }] },
      { id: 'b', store: 'homeliving', slug: 'mat', name: 'Mat', images: ['https://cdn/m.jpg'], mrp: 500, stock: 0, variants: [] },
      { id: 'c', store: 'fashion', slug: 'demo', name: 'Demo', images: ['https://cdn/d.jpg'], mrp: 500, is_demo: true },
    ],
  });
  assert.deepEqual(items.map((i) => [i.id, i.inStock]), [['W-1', true], ['F-a', true], ['H-b', false]]);
  const x = buildFeed(items);
  assert.match(x, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0" xmlns:g="http:\/\/base.google.com\/ns\/1.0">/);
  assert.match(x, /<link>https:\/\/www.soralifestyle.in\/product\/tea<\/link>/);
  assert.match(x, /<g:image_link>https:\/\/www.soralifestyle.in\/img\/tea.webp<\/g:image_link>/);
  assert.match(x, /<title>Shawl &amp; Stole<\/title>/);
  assert.match(x, /<g:price>2000.00 INR<\/g:price>\n\s*<g:sale_price>1500.00 INR<\/g:sale_price>/);
  assert.match(x, /<g:additional_image_link>https:\/\/cdn\/y.jpg<\/g:additional_image_link>/);
  assert.match(x, /<g:id>H-b<\/g:id>[\s\S]*<g:availability>out_of_stock<\/g:availability>/);
  assert.equal((x.match(/<g:sale_price>/g) || []).length, 1, 'a sale price only for a real discount');
});
test('feed: served at /feed/products.xml through the sitemap function (twelve functions)', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.ok(v.rewrites.some((r) => r.source === '/feed/products.xml' && r.destination === '/api/sitemap?feed=products'));
  assert.match(read('api/sitemap.js'), /if \(req\.query\?\.feed === 'products'\) return feedHandler\(req, res\);/);
  assert.ok(STATIC_PATHS.includes('/offers'));
});

const promo = loadModule('src/components/PromoCard.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, useLocation: () => ({ pathname: '/', search: '' }), Icon: () => null, useStorefrontSection: (s, p, d) => d, OFFER_COUNTDOWN: {}, parseIndiaTime: () => 0 });
test('promo links: a code-shaped ?promo= is upper-cased; anything else is ignored', () => {
  assert.equal(promo.promoCode('?promo=diwali20'), 'DIWALI20');
  assert.equal(promo.promoCode('?utm_source=ig&promo=SHAWL-10'), 'SHAWL-10');
  assert.equal(promo.promoCode('?promo=<script>'), '');
  assert.equal(promo.promoCode('?promo=ab'), '');
  assert.equal(promo.promoCode(''), '');
});
test('sharing the offer: its words carry the code and the link', () => {
  assert.equal(promo.offerShareText({ title: 'Diwali offer: 20% off with code', code: 'DIWALI20' }, 'L'), 'Diwali offer: 20% off with code DIWALI20 at SORA LIFESTYLE (wellness, fashion and home). Shop the offers: L');
  assert.match(promo.offerShareText(null, 'L'), /: L$/);
});

const offers = loadModule('src/pages/Offers.jsx', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], Link: () => null, useSearchParams: () => [new URLSearchParams(), () => {}], Icon: () => null, money: (n) => `₹${n}`, supabase: null, products: [], OfferBanner: () => null, LoadMore: () => null, useShowMore: () => ({}), useStorefrontSection: (s, p, d) => d, OFFER_COUNTDOWN: {}, parseIndiaTime: () => 0, offerShareText: () => '', usePageMeta: () => {} });
test('offers: only real discounts in stock, biggest first, every store', () => {
  assert.equal(offers.catalogueDeal({ id: 1, store: 'fashion', slug: 's', mrp: 1000, sale_price: 1000, images: ['a'], stock: 5 }), null, 'no discount');
  assert.equal(offers.catalogueDeal({ id: 1, store: 'fashion', slug: 's', mrp: 1000, sale_price: 500, images: ['a'], variants: [{ stock: 0 }] }), null, 'out of stock');
  const f = offers.catalogueDeal({ id: 1, store: 'fashion', slug: 's', name: 'S', mrp: 1000, sale_price: 420, images: ['a'], variants: [{ stock: 1 }] });
  assert.deepEqual([f.pct, f.href], [58, '/fashion/p/s']);
  const w = offers.wellnessDeals([{ id: 9, slug: 'w', name: 'W', price: 80, mrp: 100, stock: 1 }, { id: 8, slug: 'v', price: 100, mrp: 100, stock: 1 }]);
  assert.deepEqual(w.map((d) => d.pct), [20]);
  assert.deepEqual(offers.sortDeals([...w, f]).map((d) => d.store), ['fashion', 'wellness']);
});
test('wired: the route, the footer link, the welcome card setting, the banner share, the card in SiteAssist', () => {
  assert.match(read('src/App.jsx'), /<Route path="\/offers" element=\{<Offers \/>\} \/>/);
  assert.match(read('src/components/Footer.jsx'), /<Link to="\/offers">Offers &amp; deals<\/Link>/);
  assert.match(read('src/lib/storefrontContent.js'), /welcomeOffer: group\(/);
  assert.match(read('src/components/OfferBanner.jsx'), /Share on WhatsApp/);
  assert.match(read('src/components/SiteAssist.jsx'), /<PromoCard foot=\{offset\} \/>/);
});

if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log('\nall passed');
