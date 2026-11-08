// ============================================================
// Weavers Villa on the wellness homepage (owner, 2026-11-08). Pinned:
//   * the range: fashion rows by brand, priced and pictured, sub-categories
//     taking turns, twelve at most, card-sized pictures, never padded;
//   * the read: one query, active fashion rows of the brand; a failed read is none;
//   * the films: every tile's video and poster frame is a file on this site, so the
//     page's media-src stays 'self'; each tile opens a real listing;
//   * the showcase: muted, inline, preload none, hidden from assistive technology;
//     a hidden section renders nothing;
//   * Home.jsx: range then showcase, straight under the Biosash range.
//
//   node scripts/test-weavers-villa.mjs
// ============================================================
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, read, loadModule, mount, h, findAll } from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};

const cataloguePrice = (row) => {
  const mrp = Number(row?.mrp) || 0;
  const sale = row?.sale_price == null ? null : Number(row.sale_price) || 0;
  return sale != null && sale > 0 && sale < mrp ? sale : mrp;
};
const lib = (client = null) => loadModule('src/lib/weaversVilla.js', { supabase: client, cataloguePrice });
const img = (n) => [`https://www.weaversvilla.com/cdn/shop/files/${n}.jpg?v=1&width=2000`];
const row = (id, cat, extra = {}) => ({ id, store: 'fashion', name: `Shawl ${id}`, slug: `shawl-${id}`, mrp: 1999, sale_price: 999, images: img(id), category_id: cat, sort_order: id, ...extra });

await test('R1 sub-categories take turns, each in the catalogue order; card links, sale price, a 700px picture', () => {
  const { selectWeaversRange } = lib();
  const cards = selectWeaversRange([row(1, 'a'), row(2, 'a'), row(3, 'a'), row(4, 'b'), row(5, 'c'), row(6, 'b')]);
  assert.deepEqual(cards.map((c) => c.name), ['Shawl 1', 'Shawl 4', 'Shawl 5', 'Shawl 2', 'Shawl 6', 'Shawl 3']);
  assert.equal(cards[0].href, '/fashion/p/shawl-1');
  assert.equal(cards[0].price, 999);
  assert.equal(cards[0].image, 'https://www.weaversvilla.com/cdn/shop/files/1.jpg?v=1&width=700');
});

await test('R2 no slug, no price, no picture, another store: left out; twelve at most; nothing, nothing', () => {
  const { selectWeaversRange, WEAVERS_RANGE_LIMIT } = lib();
  const cards = selectWeaversRange([row(1, 'a', { slug: '' }), row(2, 'a', { mrp: 0, sale_price: null }), row(3, 'a', { images: [] }), row(4, 'a', { store: 'homeliving' }), row(5, 'a')]);
  assert.deepEqual(cards.map((c) => c.name), ['Shawl 5']);
  assert.equal(WEAVERS_RANGE_LIMIT, 12);
  assert.equal(selectWeaversRange(Array.from({ length: 40 }, (_, i) => row(i, i % 3))).length, 12);
  for (const list of [[], null, undefined]) assert.deepEqual(selectWeaversRange(list), []);
});

await test('R3 the read: active fashion rows of the brand in the catalogue order; a failed read counts as none', async () => {
  const calls = [];
  const q = (result) => {
    const chain = { select: (c) => (calls.push(['select', c]), chain), eq: (k, v) => (calls.push(['eq', k, v]), chain), order: (k) => (calls.push(['order', k]), chain), limit: (n) => (calls.push(['limit', n]), Promise.resolve(result)) };
    return { from: (t) => (calls.push(['from', t]), chain) };
  };
  const { fetchWeaversRows } = lib();
  const rows = await fetchWeaversRows(q({ data: [row(1, 'a')], error: null }));
  assert.equal(rows.length, 1);
  assert.deepEqual(calls.filter((c) => c[0] === 'eq'), [['eq', 'store', 'fashion'], ['eq', 'brand', 'Weavers Villa'], ['eq', 'is_active', true]]);
  assert.deepEqual(calls.find((c) => c[0] === 'from'), ['from', 'catalogue_products']);
  assert.deepEqual(await fetchWeaversRows(q({ data: null, error: { message: 'x' } })), []);
});

await test('F1 every film and poster frame is a file on this site; each tile opens a store listing', () => {
  const { WEAVERS_FILMS } = lib();
  assert.ok(WEAVERS_FILMS.length >= 6);
  for (const f of WEAVERS_FILMS) {
    for (const p of [f.video, f.poster]) {
      assert.match(p, /^\/video\/weavers-villa\/[0-9a-f]{8}\.(mp4|webp)$/);
      const file = resolve(ROOT, p.slice(1));
      assert.ok(existsSync(file), `${p} exists`);
      assert.ok(statSync(file).size < 3_000_000, `${p} under 3MB`);
    }
    assert.match(f.href, /^\/(fashion\/c|homeliving\/category)\/[a-z-]+$/);
    assert.ok(f.label);
  }
  const csp = read('vercel.json').match(/media-src[^;]*/)[0];
  assert.match(csp, /'self'/);
});

await test('S1 the showcase: muted, inline, nothing loaded up front, hidden from assistive technology; hidden renders nothing', async () => {
  const React = await import('react');
  const { WEAVERS_FILMS, WEAVERS_SHOWCASE } = lib();
  const deps = (section) => ({
    useEffect: () => {}, useRef: () => ({ current: null }),
    Link: ({ to, children, ...p }) => h('a', { href: to, ...p }, children), Icon: () => null, SlidingRail: () => null,
    useStorefrontSection: () => section, WEAVERS_SECTION: {}, WEAVERS_SHOWCASE, WEAVERS_FILMS, WEAVERS_LISTING: '/fashion/c/shawls-stoles', useWeaversRange: () => [],
  });
  const mod = loadModule('src/components/WeaversVilla.jsx', deps(WEAVERS_SHOWCASE));
  const handle = await mount(h(mod.WeaversVillaShowcase, {}));
  const videos = findAll(handle.tree ?? handle, (n) => n?.type === 'video');
  assert.equal(videos.length, WEAVERS_FILMS.length);
  for (const v of videos) {
    assert.equal(v.props.muted, true); assert.equal(v.props.playsInline, true); assert.equal(v.props.preload, 'none');
    assert.equal(v.props['aria-hidden'], 'true'); assert.equal(v.props.autoPlay, undefined);
  }
  const hiddenMod = loadModule('src/components/WeaversVilla.jsx', deps({ ...WEAVERS_SHOWCASE, hidden: true }));
  const none = await mount(h(hiddenMod.WeaversVillaShowcase, {}));
  assert.equal(findAll(none.tree ?? none, (n) => n?.type === 'video').length, 0);
  void React;
});

await test('H1 Home.jsx: the range then the showcase, straight under the Biosash range, each once', () => {
  const home = read('src/pages/Home.jsx');
  const at = (s) => home.indexOf(s);
  assert.ok(at('<BiosashRange />') > 0 && at('<BiosashRange />') < at('<WeaversVillaRange />') && at('<WeaversVillaRange />') < at('<WeaversVillaShowcase />') && at('<WeaversVillaShowcase />') < at('<Bedsheets />'));
  for (const c of ['<WeaversVillaRange />', '<WeaversVillaShowcase />']) assert.equal(home.split(c).length - 1, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
