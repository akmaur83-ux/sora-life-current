// Winter deals band (owner, 2026-11-20: "winter theme ... animation ke sath").
//   node scripts/test-winter-deals.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const w = loadModule('src/lib/winterDeals.js', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, cataloguePrice: (r) => { const m = Number(r.mrp); const s = r.sale_price == null ? null : Number(r.sale_price); return s != null && s > 0 && s < m ? s : m; } });
const row = (slug, cat, mrp, sale, extra = {}) => ({ slug, name: `${slug} - Black`, mrp, sale_price: sale, images: [`https://cdn/${slug}.jpg`], stock: 5, category: { slug: cat }, ...extra });
const rows = [
  row('j1', 'mens-leather-jackets', 10000, 4300), row('j2', 'womens-leather-jackets', 9000, 6000), row('j3', 'mens-leather-jackets', 8000, 8000),
  row('s1', 'womens-shawls', 2000, 840), row('s2', 'stoles', 1000, 700),
  row('c1', 'mens-leather-coats', 20000, 10000), row('c2', 'womens-leather-coats', 22000, 15000),
  row('m1', 'mufflers-caps', 599, 299), row('m2', 'mufflers-caps', 999, 499, { stock: 0, variants: [{ stock: 0, is_active: true }] }),
  row('m3', 'mufflers-caps', 499, 499), row('demo', 'mens-leather-jackets', 10000, 100, { is_demo: true }),
];
test('every number is the catalogue\'s: biggest in-stock discount per tile, rounded down', () => {
  const d = w.winterDeals(rows);
  assert.deepEqual(d.tiles.map((t) => [t.id, t.upTo]), [['jackets', 57], ['shawls', 58], ['coats', 50]]);
  assert.equal(w.offPct({ mrp: 300, sale_price: 199 }), 33);
});
test('out of stock, demo and undiscounted items never count; a tile needs 2 discounted pieces', () => {
  const d = w.winterDeals(rows);
  assert.ok(!d.tiles.some((t) => t.id === 'caps'), 'one discounted cap in stock is not a tile');
  assert.ok(!JSON.stringify(d).includes('demo'));
});
test('the hero: the cheapest discounted everyday piece, with its own prices and link', () => {
  const { hero } = w.winterDeals(rows);
  assert.deepEqual([hero.href, hero.mrp, hero.price, hero.off], ['/fashion/p/m1', 599, 299, 50]);
});
test('too little and the band does not show; outside Nov–Feb it does not show', () => {
  assert.equal(w.winterDeals(rows.filter((r) => !r.category.slug.includes('coats'))), null);
  assert.equal(w.winterDeals(null), null);
  assert.equal(w.isWinterSeason(Date.parse('2026-11-20T12:00:00Z')), true);
  assert.equal(w.isWinterSeason(Date.parse('2027-02-28T12:00:00Z')), true);
  assert.equal(w.isWinterSeason(Date.parse('2027-02-28T19:00:00Z')), false, '1 March in India');
  assert.equal(w.isWinterSeason(Date.parse('2026-07-01T12:00:00Z')), false);
});
test('links open the winter and leather edit sections that exist', () => {
  const edit = read('src/fashion/FashionEdit.jsx');
  assert.match(edit, /id=\{`\$\{id\}-\$\{s\.id\}`\}/);
  const hrefs = w.WINTER_TILES.map((t) => t.href);
  assert.deepEqual(hrefs, ['/fashion/winter', '/fashion/winter#winter-shawls', '/fashion/leather#leather-coats', '/fashion/winter#winter-caps']);
});
test('on the homepage straight under the header; motion stops for reduced-motion; no words in pictures', () => {
  assert.match(read('src/pages/Home.jsx'), /<WinterDeals \/>\n      <HomeHero \/>/);
  const css = read('src/styles/sora-ds.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.sora-winter__snow \{ display: none; \}/);
  const c = read('src/components/WinterDeals.jsx');
  assert.ok(!/Math\.random/.test(c.replace(/\/\/.*$/gm, '')));
  assert.match(c, /aria-label="Winter deals"/);
});
test('round 25: on the Fashion home under the category chips; ornaments, twinkles, near snow and a pom-pom hem', () => {
  assert.match(read('src/fashion/FashionHome.jsx'), /<CategoryChips \/>\n.*\n      <WinterDeals \/>/);
  const c = read('src/components/WinterDeals.jsx');
  for (const k of ['sora-winter__orn', 'sora-winter__twinkle', 'sora-winter__snow--near', 'sora-winter__hem']) assert.ok(c.includes(k), k);
  const css = read('src/styles/sora-ds.css');
  assert.match(css, /@keyframes sw-swing/);
  assert.match(css, /\.fs \.sora-winter__snow i, \.fs \.sora-winter__hem i \{ border-radius: 50% !important; \}/);
  assert.match(css, /\.fs a\.sora-winter__all \{ color: var\(--w-ink\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.sora-winter__deco, \.sora-winter__hem i \{ animation: none !important; \}/);
});
test('round 26: the homepage top turns winter-blue into the band; the light sparrow there', () => {
  const h = read('src/components/Header.jsx');
  assert.match(h, /const winterTop = location\.pathname === '\/' && isWinterSeason\(\);/);
  assert.match(h, /root\.classList\.toggle\('sora-wintertop', winterTop\)/);
  assert.match(h, /<BrandMark light className="logo__img" \/>/);
  const css = read('src/styles/sora-ds.css');
  for (const sel of ['html.sora-wintertop .sora-storebar {', 'html.sora-wintertop .v2-ann {', 'html.sora-wintertop .v2-hdr {', 'html.sora-wintertop .sora-stickycats {']) assert.ok(css.includes(sel), sel);
  assert.ok(!css.includes('sw-gleam'), 'the boxy gleam is gone');
});
test('product pictures on phones start at the top of the gallery (no sticky offset)', () => {
  assert.match(read('src/styles/fashion.css'), /@media \(max-width: 767px\) \{ \.fs \.fs-gallery \{ top: auto; \} \}/);
});
test('back returns to what was on screen: the element is noted on leaving and followed', () => {
  const m = read('src/components/ScrollManager.jsx');
  assert.match(m, /export function noteAnchor\(\)/);
  assert.match(m, /if \(decision\.kind === 'restore' && anchor\) return followAnchor\(decision\.y, anchor\);/);
  assert.match(m, /all\.length >= \(a\.of \|\| 0\)/);
  assert.match(m, /const ANCHOR_KEY = 'sora-scroll-anchors';/);
});
test('round 27: the hero turns through cheapest-first deals, one picture each, every 1.5 s', () => {
  const d = w.winterDeals([...rows, row('m4', 'mufflers-caps', 799, 399), row('m5', 'stoles', 900, 450, { images: ['https://cdn/m1.jpg'] })]);
  assert.deepEqual(d.heroes.map((h) => h.href), ['/fashion/p/m1', '/fashion/p/m4', '/fashion/p/s2', '/fashion/p/s1']);
  assert.equal(d.hero.href, '/fashion/p/m1');
  assert.equal(w.HERO_EVERY_MS, 1500);
  const c = read('src/components/WinterDeals.jsx');
  assert.match(c, /window\.setInterval\(\(\) => \{ if \(!document\.hidden\) setI\(\(v\) => \(v \+ 1\) % n\); \}, HERO_EVERY_MS\)/);
  assert.match(c, /if \(n < 2 \|\| paused \|\| reducedMotion\(\)\) return undefined;/);
});
test('round 28: big readable lettering with a dark rim; a muffler threading over and under it, sliding in and out; wind; three snow layers', () => {
  const c = read('src/components/WinterDeals.jsx');
  for (const k of ['sw-knit', 'sora-winter__halo', 'sora-winter__puff', "mask={over ? 'url(#sw-over)' : undefined}", '<Muffler over={false} />', '<Muffler over />', 'sora-winter__wind', 'sora-winter__snow--far', 'sora-winter__snow--near']) assert.ok(c.includes(k), k);
  assert.ok(c.indexOf('<Muffler over={false} />') < c.indexOf('sora-winter__letters') && c.indexOf('sora-winter__letters') < c.indexOf('<Muffler over />'), 'under, letters, over');
  assert.match(read('index.html'), /&family=Pacifico&display=swap/, 'in the one font request; the file loads only where the heading uses it');
  const css = read('src/styles/sora-ds.css');
  for (const k of ['@keyframes sw-turn', '@keyframes sw-slide', '@keyframes sw-ripple', '@keyframes sw-gust', '@keyframes sw-fall-sway']) assert.ok(css.includes(k), k);
  assert.match(css, /\.sora-winter__halo \{ fill: #0B1D40; stroke: #0B1D40; stroke-width: 11;/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.sora-muffler__slide, \.sora-muffler__ripple \{ transform: none; \} \}/);
});
test('round 27: no COD strip on the homepage; on a product page the delivery line and categories sit under the product', () => {
  assert.match(read('src/components/Header.jsx'), /\{location\.pathname !== '\/' && <AnnouncementBar \/>\}/);
  const pdp = read('src/fashion/FashionProductPage.jsx');
  assert.match(pdp, /<div className="fs-pdp fs-pdp--mk" data-product=\{view\.slug\}>\n(?:.*\n){3}      <Breadcrumb/);
  assert.match(pdp, /<div className="fs-pdp__more">\n        <DeliveryStrip \/>\n        <CategoryChips \/>/);
  assert.match(read('src/fashion/FashionLayout.jsx'), /\{!\/\^\\\/fashion\\\/p\\\/\/\.test\(location\.pathname\) && <DeliveryStrip strip=\{strip\} \/>\}/);
});
test('round 29: less air above the heading; "Up to" on one line', () => {
  assert.match(read('src/components/WinterDeals.jsx'), /<svg viewBox="0 26 400 106"/);
  const css = read('src/styles/sora-ds.css');
  assert.match(css, /\.sora-winter__in \{ padding-top: 10px; \}/);
  assert.match(css, /\.sora-winter__badge > span \{ white-space: nowrap; \}/);
});
test('round 30: the winter header stays sticky; edit banners carry their own categories\' pictures', () => {
  const css = read('src/styles/sora-ds.css');
  assert.ok(!/html\.sora-wintertop \.v2-hdr \{ position: relative;/.test(css), 'never unstuck');
  assert.match(css, /html\.sora-wintertop \.v2-hdr \{ position: sticky; \}/);
  const a = loadModule('src/components/StripArt.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, fetchCategoryCovers: async () => ({}) });
  assert.deepEqual(a.stripPictures({ 'mens-leather-jackets': 'j', 'mufflers-caps': 'm' }, 'winter'), ['j', 'm']);
  assert.deepEqual(a.stripPictures({}, 'leather'), []);
  assert.deepEqual(a.stripPictures(null, 'nope'), []);
  const edit = read('src/fashion/FashionEdit.jsx');
  assert.match(edit, /<StripArt id="winter" \/>/); assert.match(edit, /<StripArt id="leather" \/>/);
  assert.match(read('src/fashion/WeddingEdit.jsx'), /<StripArt id="wedding" \/>/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
