// ============================================================
// Luxury Beds and Bedsheets on the wellness homepage (owner, 2026-11-02):
// two sliding rows of Home & Living's Beds and Bedsheets categories, in the
// catalogue's own order, under the offers and above the Lifestyle banner,
// each editable from Storefronts → Wellness.
//
// Pinned:
//   * what a rail shows: the category's active, buyable rows only, in the
//     catalogue's order (sort_order, then newest); each card's link, picture
//     and price; an empty category, no section; never padded;
//   * the reads: the active category by (store, slug), then that category's
//     active rows, a few columns, twelve at most; a failed read counting as
//     none, and no read of another store's rows;
//   * the carousel, New Arrivals' rules: advances on its own, pauses on hover
//     and on focus, never moves under prefers-reduced-motion, arrows that stop
//     at the ends, a 40px sideways swipe that swallows the click after it,
//     cards outside the window untabbable and hidden, a track that moves on
//     transform only and a viewport that never scrolls;
//   * Storefronts → Wellness: hide, heading, "View All" label and link (empty:
//     the category's own listing), one section each;
//   * the slots in Home.jsx — beds first, bedsheets directly under them — and
//     the shared .hx-new look, so the rows read as one type;
//   * NewArrivals.jsx is not edited by this feature.
//
//   node scripts/test-home-category-rails.mjs
// ============================================================
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ROOT, read, has, loadModule, mount, h, findAll, hooks } from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** homeCategoryRail.js with a stand-in client and the real price rule. */
function loadData(client = null) {
  if (!has('src/lib/homeCategoryRail.js')) throw new Error('src/lib/homeCategoryRail.js is missing');
  return loadModule('src/lib/homeCategoryRail.js', {
    supabase: client,
    cataloguePrice: (row) => {
      const mrp = Number(row?.mrp) || 0;
      const sale = row?.sale_price == null ? null : Number(row.sale_price) || 0;
      return sale != null && sale > 0 && sale < mrp ? sale : mrp;
    },
  });
}

const row = (id, name, slug, mrp, sale, sort, at, images = [`/img/${slug}.webp`], store = 'homeliving') =>
  ({ id, store, name, slug, mrp, sale_price: sale, images, sort_order: sort, created_at: at });

const BEDS = [
  row('b3', 'Round Bed — Design 03', 'round-bed-03', 48000, 39000, 3, '2026-10-25T10:00:00+00:00'),
  row('b1', 'Round Bed — Design 01', 'round-bed-01', 52000, null, 1, '2026-10-25T09:00:00+00:00'),
  row('b2', 'Round Bed — Design 02', 'round-bed-02', 45000, 46000, 2, '2026-10-25T08:00:00+00:00', []),
  row('b0', 'Unpriced Bed', 'unpriced-bed', 0, null, 0, '2026-10-25T11:00:00+00:00'),
  row('f1', 'Hoop Earrings', 'hoop-earrings', 1299, null, 1, '2026-10-25T12:00:00+00:00', ['/img/hoops.webp'], 'fashion'),
];

console.log('\n— What a rail shows —');

await test('D1 the catalogue\'s own order (sort_order, then newest); each card links to its product page, with its first picture and its price', () => {
  const { selectCategoryRail } = loadData();
  const cards = selectCategoryRail(BEDS, { store: 'homeliving' });
  assert.deepEqual(cards.map((c) => [c.name, c.href, c.price, c.image]), [
    ['Round Bed — Design 01', '/homeliving/p/round-bed-01', 52000, '/img/round-bed-01.webp'],
    ['Round Bed — Design 02', '/homeliving/p/round-bed-02', 45000, null],
    ['Round Bed — Design 03', '/homeliving/p/round-bed-03', 39000, '/img/round-bed-03.webp'],
  ]);
});

await test('D2 another store\'s row never; a row without a payable price never; the sale price only when it is below the MRP', () => {
  const { selectCategoryRail } = loadData();
  const cards = selectCategoryRail(BEDS, { store: 'homeliving' });
  assert.ok(!cards.some((c) => c.store !== 'homeliving'), 'only this store');
  assert.ok(!cards.some((c) => /Unpriced/.test(c.name)), 'nothing unbuyable');
  assert.deepEqual(cards.map((c) => c.price), [52000, 45000, 39000]);
});

await test('D3 an empty category is nothing at all — no filler', () => {
  const { selectCategoryRail } = loadData();
  for (const rows of [[], undefined, null]) assert.deepEqual(selectCategoryRail(rows, { store: 'homeliving' }), []);
});

await test('D4 twelve at most, the first twelve of the catalogue\'s order', () => {
  const { selectCategoryRail, CATEGORY_RAIL_LIMIT } = loadData();
  const many = Array.from({ length: 20 }, (_, i) => row(`m${i}`, `Bed ${i}`, `bed-${i}`, 5000, 4000, i, '2026-10-25T00:00:00+00:00'));
  const cards = selectCategoryRail(many, { store: 'homeliving' });
  assert.equal(CATEGORY_RAIL_LIMIT, 12);
  assert.deepEqual([cards.length, cards[0].name, cards[11].name], [12, 'Bed 0', 'Bed 11']);
});

await test('D5 "View All" with no link set goes to the category\'s own listing', () => {
  const { categoryListing } = loadData();
  assert.deepEqual(
    [categoryListing('homeliving', 'beds'), categoryListing('homeliving', 'bedsheets'), categoryListing('fashion', 'jewellery')],
    ['/homeliving/category/beds', '/homeliving/category/bedsheets', '/fashion/jewellery'],
  );
});

await test('D6 the reads: the active category by store and slug, then that category\'s active rows, a few columns, twelve; a failed read counts as none', async () => {
  const log = [];
  const client = {
    from(table) {
      const q = { table, select: null, eq: [], order: [], limit: null };
      log.push(q);
      const chain = {
        select(c) { q.select = c; return chain; }, eq(c, v) { q.eq.push([c, v]); return chain; },
        order(c, o) { q.order.push([c, o.ascending]); return chain; }, limit(n) { q.limit = n; return chain; },
        then(res) { return Promise.resolve(table === 'catalogue_categories' ? { data: [{ id: 'cat-1' }], error: null } : { data: [{ id: 'x' }], error: null }).then(res); },
      };
      return chain;
    },
  };
  const { fetchCategoryRailRows } = loadData(client);
  assert.deepEqual(await fetchCategoryRailRows(client, { store: 'homeliving', slug: 'beds' }), [{ id: 'x' }]);
  const [cat, prod] = log;
  assert.deepEqual([cat.table, cat.select, cat.eq, cat.limit], ['catalogue_categories', 'id', [['store', 'homeliving'], ['slug', 'beds'], ['is_active', true]], 1]);
  assert.deepEqual([prod.table, prod.select, prod.eq, prod.order, prod.limit], [
    'catalogue_products',
    'id, store, name, slug, mrp, sale_price, images, sort_order, created_at',
    [['store', 'homeliving'], ['category_id', 'cat-1'], ['is_active', true]],
    [['sort_order', true], ['created_at', false]],
    12,
  ]);
});

await test('D7 no such category, or a read that fails: no rows, and the products are never read', async () => {
  const seen = [];
  const make = (answer) => ({
    from(table) {
      seen.push(table);
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, then: (res) => Promise.resolve(answer(table)).then(res) };
      return chain;
    },
  });
  const none = make(() => ({ data: [], error: null }));
  assert.deepEqual(await loadData(none).fetchCategoryRailRows(none, { store: 'homeliving', slug: 'nope' }), []);
  assert.deepEqual(seen, ['catalogue_categories']);
  const broken = make((t) => (t === 'catalogue_categories' ? { data: [{ id: 'c' }], error: null } : { data: null, error: { message: 'down' } }));
  assert.deepEqual(await loadData(broken).fetchCategoryRailRows(broken, { store: 'homeliving', slug: 'beds' }), []);
});

console.log('\n— The sections —');

const LINK = ({ to, children, ...rest }) => h('a', { href: to, ...rest }, children);

/** One rail over given cards, with a stand-in window (its --per, its reduced-motion preference) and content. */
async function openRail({ which = 'LuxuryBeds', items, content = null, per = 2, reduced = false, autoplayMs = 25 } = {}) {
  if (!has('src/components/HomeCategoryRails.jsx')) throw new Error('src/components/HomeCategoryRails.jsx is missing');
  const listeners = {};
  const asked = [];
  const win = {
    matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: (k) => (k === '--per' ? String(per) : '') }),
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: () => {},
  };
  const mod = loadModule('src/components/HomeCategoryRails.jsx', {
    Link: LINK, Icon: ({ name }) => h('i', { 'data-icon': name }), DeferredImage: (p) => h('img', p),
    useStorefrontSection: (store, path, defaults) => { asked.push([store, path]); return { ...defaults, ...(content || {}) }; },
    useCategoryRail: (store, slug) => { asked.push([store, slug]); return null; },
    categoryListing: (store, slug) => `/${store}/category/${slug}`,
    money: (n) => `₹${n}`, window: win,
    useRef: (init) => hooks.useRef(init === null ? { stand_in: 'track' } : init),
  });
  const handle = await mount(h(mod[which], { items, autoplayMs }));
  const index = () => Number(findAll(handle.tree, (n) => n.type === 'ul')[0]?.props.style['--i']);
  const button = (label) => findAll(handle.tree, (n) => n.type === 'button' && n.props['aria-label'] === label)[0];
  const wrap = () => findAll(handle.tree, (n) => n.props?.className === 'hx-wrap')[0];
  const viewport = () => findAll(handle.tree, (n) => n.props?.['aria-roledescription'] === 'carousel')[0];
  const tick = async (ms) => { await sleep(ms); await handle.settle(); };
  return { mod, handle, index, button, wrap, viewport, tick, asked };
}
const card = (k) => ({ key: `homeliving-${k}`, store: 'homeliving', name: `Bed ${k}`, href: `/homeliving/p/bed-${k}`, image: `/img/b${k}.webp`, price: 1000 * k });
const FIVE = [card(1), card(2), card(3), card(4), card(5)];

await test('C1 nothing to show — no cards, or hidden in Storefronts — and there is no section at all', async () => {
  for (const which of ['LuxuryBeds', 'Bedsheets']) {
    for (const [items, content] of [[[], null], [FIVE, { hidden: true }]]) {
      const { handle } = await openRail({ which, items, content });
      assert.equal(handle.tree, null, `${which} renders nothing`);
    }
  }
});

await test('C2 each rail reads its own Storefronts section and its own category', async () => {
  // A render may repeat; what is pinned is which section and which category each rail asks for.
  const unique = (pairs) => [...new Set(pairs.map((p) => p.join('/')))].sort();
  const beds = await openRail({ which: 'LuxuryBeds', items: FIVE });
  assert.deepEqual(unique(beds.asked), ['homeliving/beds', 'wellness/luxuryBeds']);
  const sheets = await openRail({ which: 'Bedsheets', items: FIVE });
  assert.deepEqual(unique(sheets.asked), ['homeliving/bedsheets', 'wellness/bedsheets']);
});

await test('C3 the heading and "View All" on one line, as "Explore the stores"; an empty link goes to the category listing, a set one wins', async () => {
  const { handle, mod } = await openRail({ items: FIVE });
  assert.ok(findAll(handle.tree, (n) => n.props?.className === 'hx-stores__head')[0], 'the Explore-the-stores heading row');
  const heading = findAll(handle.tree, (n) => n.type === 'h2')[0];
  assert.deepEqual([heading.props.className, heading.props.id, heading.props.children], ['hx-stores__h', 'hx-beds-h', 'Luxury Beds']);
  const more = findAll(handle.tree, (n) => n.props?.className === 'hx-more')[0];
  assert.equal(more.props.href, '/homeliving/category/beds');
  assert.equal(mod.railLink('/shop', 'homeliving', 'beds'), '/shop');
  const named = await openRail({ items: FIVE, content: { title: 'Beds we love', more: 'See all', link: '/shop' } });
  const h2 = findAll(named.handle.tree, (n) => n.type === 'h2')[0];
  assert.equal(h2.props.children, 'Beds we love');
  assert.equal(findAll(named.handle.tree, (n) => n.props?.className === 'hx-more')[0].props.href, '/shop');
});

await test('C4 the look is New Arrivals\' own: the .hx palette, the shared row classes, square edges', async () => {
  const { handle } = await openRail({ items: FIVE });
  assert.equal(handle.tree.props.className, 'hx hx-new');
  for (const cls of ['hx-new__tools', 'hx-new__viewport', 'hx-new__track', 'hx-new__item', 'hx-new__card', 'hx-new__art', 'hx-new__name', 'hx-new__price']) {
    assert.ok(findAll(handle.tree, (n) => n.props?.className === cls).length, `${cls} is used`);
  }
});

await test('C5 a card is a picture, the name and the price, linking to the product page; no Add button', async () => {
  const { handle } = await openRail({ items: FIVE });
  const first = findAll(handle.tree, (n) => n.props?.className === 'hx-new__card')[0];
  assert.equal(first.props.href, '/homeliving/p/bed-1');
  assert.equal(findAll(handle.tree, (n) => n.props?.className === 'hx-new__price')[0].props.children, '₹1000');
  assert.equal(findAll(handle.tree, (n) => n.type === 'img')[0].props.src, '/img/b1.webp');
  assert.ok(!findAll(handle.tree, (n) => /add/i.test(String(n.props?.['aria-label'] || ''))).length, 'no Add button');
});

await test('C6 the track moves on transform only, by whole cards; the viewport never scrolls', async () => {
  const { handle, index, viewport } = await openRail({ items: FIVE, autoplayMs: 100000 });
  assert.equal(index(), 0);
  const el = { scrollLeft: 120 };
  viewport().props.onScroll({ currentTarget: el });
  assert.equal(el.scrollLeft, 0, 'a scrolled viewport is put back');
  assert.ok(!findAll(handle.tree, (n) => n.props?.className === 'hx-new__viewport')[0].props.style, 'no inline scroll position');
});

await test('C7 arrows step one card and stop at the ends', async () => {
  const { handle, index, button } = await openRail({ items: FIVE, per: 2, autoplayMs: 100000 });
  assert.equal(button('Previous luxury beds').props.disabled, true);
  button('Next luxury beds').props.onClick(); await handle.settle();
  assert.equal(index(), 1);
  for (let i = 0; i < 9; i++) { button('Next luxury beds').props.onClick(); await handle.settle(); }
  assert.equal(index(), 3, 'stops with the last card in view');
  assert.equal(button('Next luxury beds').props.disabled, true);
});

await test('C8 it advances on its own, pauses on hover and on focus, and never moves under prefers-reduced-motion', async () => {
  // Waits are generous and polled: the full suite runs eight files at once, and a 70ms
  // window was too tight under that load (it advanced, but after the check).
  const live = await openRail({ items: FIVE, autoplayMs: 25 });
  for (let waited = 0; live.index() === 0 && waited < 2000; waited += 50) await live.tick(50);
  assert.ok(live.index() > 0, 'it advanced');
  live.wrap().props.onMouseEnter(); await live.handle.settle();
  await live.tick(60);                       // any tick already in flight lands first
  const held = live.index();
  await live.tick(200);
  assert.equal(live.index(), held, 'hover holds it');
  live.wrap().props.onMouseLeave(); await live.handle.settle();
  const still = await openRail({ items: FIVE, autoplayMs: 25, reduced: true });
  await still.tick(90);
  assert.equal(still.index(), 0, 'reduced motion keeps it still');
});

await test('C9 a 40px sideways swipe steps one card and swallows the click after it', async () => {
  const { handle, index, viewport } = await openRail({ items: FIVE, autoplayMs: 100000 });
  const v = viewport();
  v.props.onPointerDown({ clientX: 200, clientY: 100 });
  v.props.onPointerUp({ clientX: 150, clientY: 105 });
  await handle.settle();
  assert.equal(index(), 1, 'a 50px swipe steps one');
  let prevented = false;
  viewport().props.onClickCapture({ preventDefault: () => { prevented = true; }, stopPropagation() {} });
  assert.equal(prevented, true, 'the click after a swipe is swallowed');
  const v2 = viewport();
  v2.props.onPointerDown({ clientX: 200, clientY: 100 });
  v2.props.onPointerUp({ clientX: 180, clientY: 100 });
  await handle.settle();
  assert.equal(index(), 1, 'a 20px swipe is not a step');
});

await test('C10 cards outside the window are untabbable and hidden from assistive technology', async () => {
  const { handle } = await openRail({ items: FIVE, per: 2, autoplayMs: 100000 });
  const items = findAll(handle.tree, (n) => n.props?.className === 'hx-new__item');
  assert.deepEqual(items.map((n) => n.props['aria-hidden']), [false, false, true, true, true]);
  const cards = findAll(handle.tree, (n) => n.props?.className === 'hx-new__card');
  assert.deepEqual(cards.map((n) => n.props.tabIndex), [undefined, undefined, -1, -1, -1]);
});

console.log('\n— Where they live —');

await test('P1 Home.jsx (owner, 2026-11-07; Weavers Villa between them since 2026-11-08): bedsheets under the Biosash range and the Weavers Villa sections; beds near the foot, after "Why Sora Life", just above the newsletter', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /import \{ LuxuryBeds, Bedsheets \} from '\.\.\/components\/HomeCategoryRails\.jsx';/);
  const at = (s) => home.indexOf(s);
  const between = home.slice(at('<BiosashRange />') + '<BiosashRange />'.length, at('<Bedsheets />'));
  assert.ok(at('<BiosashRange />') > 0 && at('<Bedsheets />') > at('<BiosashRange />') && between.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').match(/<[A-Z]\w*/g)?.join(',') === '<WeaversVillaRange,<WeaversVillaShowcase,<LeatherFactoryRange,<LeatherFactoryShowcase,<AtomyRange,<AtomyShowcase,<TajLeatherPosters,<TajLeatherRange', 'only the partner sections between Biosash and bedsheets (Atomy and Taj Leather since 2026-11-11)');
  assert.ok(at('<Bedsheets />') < at('<LifestyleBanner />'), 'above the Lifestyle banner');
  assert.ok(at('<WhySoraLife />') < at('<LuxuryBeds />'), 'beds below "Why Sora Life"');
  assert.ok(at('<LuxuryBeds />') < at('<Newsletter />'), 'beds above the newsletter');
  for (const c of ['<LuxuryBeds />', '<Bedsheets />']) assert.equal(home.split(c).length - 1, 1, `${c} mounted once`);
});

await test('P2 both sections are in Storefronts → Wellness, with the schema their fields need', () => {
  const pages = read('src/admin/storefrontSections.js');
  assert.match(pages, /\{ path: 'luxuryBeds', defaults: LUXURY_BEDS_SECTION \}/);
  assert.match(pages, /\{ path: 'bedsheets', defaults: BEDSHEETS_SECTION \}/);
  const schema = read('src/lib/storefrontContent.js');
  for (const key of ['luxuryBeds', 'bedsheets']) {
    const block = schema.slice(schema.indexOf(`${key}: group(`), schema.indexOf(`${key}: group(`) + 260);
    for (const field of ['hidden:', 'title:', 'more:', 'link:']) assert.ok(block.includes(field), `${key} has ${field}`);
  }
});

await test('P3 New Arrivals is left exactly as it was: this feature does not edit it', () => {
  const arrivals = read('src/components/NewArrivals.jsx');
  assert.ok(!/HomeCategoryRails|LuxuryBeds|Bedsheets|homeCategoryRail/.test(arrivals), 'NewArrivals.jsx is untouched by this feature');
});

console.log('\n— The Biosash range (owner, 2026-11-07: in the place the beds held) —');

const { selectBiosashRange, BIOSASH_SECTION, BIOSASH_RANGE_LIMIT } = await import(`${pathToFileURL(resolve(ROOT, 'src/lib/biosashRange.js')).href}`);
const wp = (id, name, extra = {}) => ({ id, slug: `p-${id}`, name, brand: 'Biosash', stock: 10, priceVerified: true, price: 300 + id, image: `/img/${id}.png`, ...extra });

await test('S1 Biosash products only — by brand, or by a biosash.com source page — in stock, priced, in the catalogue\'s order; drawn whole on white', () => {
  const cards = selectBiosashRange([
    wp(1, 'Sea Buckthorn Juice'),
    wp(2, 'Hair Mask', { brand: 'Mom Trust' }),
    wp(3, 'Seabuck Capsules', { brand: '', permalink: 'https://www.biosash.com/product/caps' }),
    wp(4, 'Out of stock', { stock: 0 }),
    wp(5, 'Unpriced', { priceVerified: false }),
    wp(6, 'No page', { slug: '' }),
    wp(7, 'Lower-case brand', { brand: 'biosash' }),
  ]);
  assert.deepEqual(cards.map((c) => [c.name, c.href, c.price, c.whole]), [
    ['Sea Buckthorn Juice', '/product/p-1', 301, true],
    ['Seabuck Capsules', '/product/p-3', 303, true],
    ['Lower-case brand', '/product/p-7', 307, true],
  ]);
});

await test('S2 twelve at most; nothing in, nothing out', () => {
  assert.equal(BIOSASH_RANGE_LIMIT, 12);
  assert.equal(selectBiosashRange(Array.from({ length: 30 }, (_, i) => wp(i + 1, `P${i}`))).length, 12);
  for (const list of [[], null, undefined]) assert.deepEqual(selectBiosashRange(list), []);
});

/** BiosashRange over given cards, the real SlidingRail under it. */
async function openBiosash({ items, content = null } = {}) {
  const asked = [];
  const rails = loadModule('src/components/HomeCategoryRails.jsx', {
    Link: LINK, Icon: ({ name }) => h('i', { 'data-icon': name }), DeferredImage: (p) => h('img', p),
    useStorefrontSection: () => ({}), useCategoryRail: () => null, categoryListing: () => '/',
    money: (n) => `₹${n}`,
    window: { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), getComputedStyle: () => ({ getPropertyValue: () => '2' }), addEventListener() {}, removeEventListener() {} },
    useRef: (init) => hooks.useRef(init === null ? { stand_in: 'track' } : init),
  });
  const mod = loadModule('src/components/BiosashRange.jsx', {
    SlidingRail: rails.SlidingRail, BIOSASH_SECTION, selectBiosashRange, products: [],
    useStorefrontSection: (store, path, defaults) => { asked.push([store, path]); return { ...defaults, ...(content || {}) }; },
  });
  const handle = await mount(h(mod.BiosashRange, { items, autoplayMs: 100000 }));
  return { handle, asked };
}
const BIO = [1, 2, 3, 4].map((i) => ({ key: `wellness-${i}`, name: `Biosash ${i}`, href: `/product/p-${i}`, price: 100 * i, image: `/img/${i}.png`, whole: true }));

await test('S3 it reads its own Storefronts section; hidden, or nothing to show, and there is no section', async () => {
  const { asked } = await openBiosash({ items: BIO });
  assert.deepEqual([...new Set(asked.map((a) => a.join('/')))], ['wellness/biosash']);
  assert.equal((await openBiosash({ items: [] })).handle.tree, null);
  assert.equal((await openBiosash({ items: BIO, content: { hidden: true } })).handle.tree, null);
});

await test('S4 the New Arrivals row: its classes, the heading "The Biosash Range", View All to the shop (a set link wins), packshots drawn whole', async () => {
  const { handle } = await openBiosash({ items: BIO });
  assert.equal(handle.tree.props.className, 'hx hx-new');
  const heading = findAll(handle.tree, (n) => n.type === 'h2')[0];
  assert.deepEqual([heading.props.id, heading.props.children], ['hx-biosash-h', 'The Biosash Range']);
  assert.equal(findAll(handle.tree, (n) => n.props?.className === 'hx-more')[0].props.href, '/shop');
  assert.equal(findAll(handle.tree, (n) => n.props?.className === 'hx-new__art hx-new__art--whole').length, 4);
  assert.equal(findAll(handle.tree, (n) => n.props?.className === 'hx-new__card')[0].props.href, '/product/p-1');
  const set = await openBiosash({ items: BIO, content: { link: '/category/wellness' } });
  assert.equal(findAll(set.handle.tree, (n) => n.props?.className === 'hx-more')[0].props.href, '/category/wellness');
});

await test('S5 Home.jsx: the Biosash range sits where the beds were — straight after New Arrivals, above the Lifestyle banner, once', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /import \{ BiosashRange \} from '\.\.\/components\/BiosashRange\.jsx';/);
  const at = (s) => home.indexOf(s);
  assert.ok(at('<NewArrivals />') < at('<BiosashRange />') && at('<BiosashRange />') < at('<Bedsheets />') && at('<Bedsheets />') < at('<LifestyleBanner />'));
  assert.equal(home.split('<BiosashRange />').length - 1, 1);
});

await test('S6 Storefronts → Wellness lists it after New Arrivals with bedsheets under it, the beds last, as on the page; the schema has its fields', () => {
  const pages = read('src/admin/storefrontSections.js');
  const order = [...pages.matchAll(/\{ path: '([A-Za-z]+)', defaults: [A-Z_]+ \}/g)].map((m) => m[1]);
  const wellness = order.slice(0, order.indexOf('luxuryBeds') + 1);
  assert.deepEqual(wellness.slice(wellness.indexOf('newArrivals')), ['newArrivals', 'biosash', 'bedsheets', 'lifestyleBanner', 'jewelleryBanner', 'storeCarousel', 'luxuryBeds']);
  const schema = read('src/lib/storefrontContent.js');
  const block = schema.slice(schema.indexOf('biosash: group('), schema.indexOf('biosash: group(') + 260);
  for (const field of ['hidden:', 'title:', 'more:', 'link:']) assert.ok(block.includes(field), `biosash has ${field}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
