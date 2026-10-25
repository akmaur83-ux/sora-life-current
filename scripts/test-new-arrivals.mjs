// ============================================================
// New Arrivals on the wellness homepage (owner, 2026-10-25): a sliding row of
// the products flagged new, newest first, across wellness, fashion and Home &
// Living — never grocery, never padded — mid-page between the offers and the
// Lifestyle banner, editable from Storefronts → Wellness.
//
// Pinned:
//   * what it shows: flagged, active, buyable products only; newest first
//     across the three stores; a wellness card from the catalogue the site
//     loaded (and only once that is the real one); each card's link, picture
//     and price; nothing flagged, no section;
//   * the reads: flagged active rows only, the two catalogue stores, a few
//     columns, twelve at most, a failed read counting as none;
//   * the carousel, the fashion category strip's rules: advances on its own,
//     pauses on hover and on focus, never moves under prefers-reduced-motion,
//     arrows that stop at the ends, a 40px sideways swipe that swallows the
//     click after it, cards outside the window untabbable and hidden, a track
//     that moves on transform only and a viewport that never scrolls;
//   * Storefronts → Wellness: hide, heading, "View All" label and link (empty:
//     the newest arrival's store), with no new schema beyond the section;
//   * the slot in Home.jsx and the page's look (the heading of "Explore the
//     stores", square edges, the .hx palette).
//
//   node scripts/test-new-arrivals.mjs
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { ROOT, read, has, loadModule, mount, h, findAll, textOf, hooks } from './catalogue-admin-harness.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const products = await import(pathToFileURL(resolve(ROOT, 'src/data/products.js')).href);

/** newArrivals.js with a stand-in client; the catalogue it reads is passed to selectNewArrivals directly. */
function loadData(client = null) {
  if (!has('src/lib/newArrivals.js')) throw new Error('src/lib/newArrivals.js is missing');
  return loadModule('src/lib/newArrivals.js', {
    supabase: client, productById: {}, catalogSource: 'static', isPurchasable: products.isPurchasable,
  });
}
/** A wellness product as the loaded catalogue holds it. */
const wellnessProduct = (id, slug, name, price, extra = {}) => ({ id, slug, name, price, priceVerified: true, image: `/img/${id}.png`, ...extra });
const BY_ID = {
  b171: wellnessProduct('b171', 'after-shave-lotion-for-men', 'After Shave Lotion For Men', 216),
  b183: wellnessProduct('b183', 'beard-cream', 'Beard Cream', 295),
  b999: wellnessProduct('b999', 'unpriced-oil', 'Unpriced Oil', 0, { priceVerified: false }),
};
const row = (id, store, name, slug, mrp, sale, at, images = [`/img/${slug}.webp`]) => ({ id, store, name, slug, mrp, sale_price: sale, images, created_at: at });
const ROWS = {
  wellness: [
    { id: 'p1', biosash_id: 'b171', created_at: '2026-10-21T09:00:00+00:00' },
    { id: 'p2', biosash_id: 'b183', created_at: '2026-10-19T09:00:00+00:00' },
    { id: 'p3', biosash_id: 'b999', created_at: '2026-10-26T09:00:00+00:00' },
  ],
  catalogue: [
    row('h1', 'homeliving', 'Coir Doormat', 'coir-doormat', 899, 649, '2026-10-25T08:30:00+00:00'),
    row('f1', 'fashion', 'Hoop Earrings', 'hoop-earrings', 1299, null, '2026-10-20T12:00:00+00:00'),
    row('g1', 'grocery', 'Basmati Rice', 'basmati-rice', 120, 99, '2026-10-26T10:00:00+00:00'),
    row('h2', 'homeliving', 'Unpriced Mat', 'unpriced-mat', 0, null, '2026-10-26T11:00:00+00:00'),
    row('h3', 'homeliving', 'Jute Mat', 'jute-mat', 499, 599, '2026-10-24T08:00:00+00:00', []),
  ],
};

console.log('\n— What the row shows —');

await test('D1 newest first across wellness, fashion and Home & Living; a wellness card from the loaded catalogue; each card links to its product page', () => {
  const { selectNewArrivals } = loadData();
  const cards = selectNewArrivals(ROWS, { byId: BY_ID, realCatalogue: true });
  assert.deepEqual(cards.map((c) => [c.store, c.name, c.href, c.price, c.image]), [
    ['homeliving', 'Coir Doormat', '/homeliving/p/coir-doormat', 649, '/img/coir-doormat.webp'],
    ['homeliving', 'Jute Mat', '/homeliving/p/jute-mat', 499, null],
    ['wellness', 'After Shave Lotion For Men', '/product/after-shave-lotion-for-men', 216, '/img/b171.png'],
    ['fashion', 'Hoop Earrings', '/fashion/p/hoop-earrings', 1299, '/img/hoop-earrings.webp'],
    ['wellness', 'Beard Cream', '/product/beard-cream', 295, '/img/b183.png'],
  ]);
});

await test('D2 grocery never; a product without a payable price never (wellness or catalogue); the price is the sale price only when it is below the MRP', () => {
  const { selectNewArrivals, cataloguePrice } = loadData();
  const cards = selectNewArrivals(ROWS, { byId: BY_ID, realCatalogue: true });
  assert.ok(!cards.some((c) => c.store === 'grocery'));
  assert.ok(!cards.some((c) => /Unpriced/.test(c.name)));
  assert.deepEqual([cataloguePrice({ mrp: 899, sale_price: 649 }), cataloguePrice({ mrp: 499, sale_price: 599 }), cataloguePrice({ mrp: 300, sale_price: 0 }), cataloguePrice({ mrp: 300, sale_price: null })], [649, 499, 300, 300]);
});

await test('D3 wellness cards wait for the real catalogue: never from the bundled stand-in', () => {
  const { selectNewArrivals } = loadData();
  assert.deepEqual(selectNewArrivals(ROWS, { byId: BY_ID, realCatalogue: false }).map((c) => c.store), ['homeliving', 'homeliving', 'fashion']);
});

await test('D4 nothing flagged: nothing at all — no filler from unflagged products', () => {
  const { selectNewArrivals } = loadData();
  assert.deepEqual(selectNewArrivals({ wellness: [], catalogue: [] }, { byId: BY_ID, realCatalogue: true }), []);
  assert.deepEqual(selectNewArrivals(undefined, { byId: BY_ID, realCatalogue: true }), []);
});

await test('D5 twelve at most, the newest twelve', () => {
  const { selectNewArrivals, NEW_ARRIVALS_LIMIT } = loadData();
  const many = Array.from({ length: 20 }, (_, i) => row(`m${i}`, 'homeliving', `Mat ${i}`, `mat-${i}`, 500, 400, `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00+00:00`));
  const cards = selectNewArrivals({ catalogue: many }, {});
  assert.equal(NEW_ARRIVALS_LIMIT, 12);
  assert.deepEqual([cards.length, cards[0].name, cards[11].name], [12, 'Mat 19', 'Mat 8']);
});

await test('D6 the reads: flagged active rows only, fashion and Home & Living, a few columns, newest first, twelve; a failed read counts as none', async () => {
  const log = [];
  const client = {
    from(table) {
      const q = { table, eq: [], in: null, order: null, limit: null, select: null };
      log.push(q);
      const chain = {
        select(c) { q.select = c; return chain; }, eq(c, v) { q.eq.push([c, v]); return chain; }, in(c, v) { q.in = [c, v]; return chain; },
        order(c, o) { q.order = [c, o.ascending]; return chain; }, limit(n) { q.limit = n; return chain; },
        then(res) { return Promise.resolve(table === 'products' ? { data: null, error: { message: 'down' } } : { data: [{ id: 'x' }], error: null }).then(res); },
      };
      return chain;
    },
  };
  const { fetchNewArrivalRows } = loadData(client);
  const rows = await fetchNewArrivalRows();
  assert.deepEqual(rows, { wellness: [], catalogue: [{ id: 'x' }] });
  const [w, c] = log;
  assert.deepEqual([w.table, w.select, w.eq, w.order, w.limit], ['products', 'id, biosash_id, created_at', [['is_active', true], ['is_new', true]], ['created_at', false], 12]);
  assert.deepEqual([c.table, c.select, c.eq, c.in, c.order, c.limit], ['catalogue_products', 'id, store, name, slug, mrp, sale_price, images, created_at', [['is_active', true], ['is_new', true]], ['store', ['fashion', 'homeliving']], ['created_at', false], 12]);
});

console.log('\n— The section —');

const LINK = ({ to, children, ...rest }) => h('a', { href: to, ...rest }, children);
/** The section over given cards, a stand-in window (its --per, its reduced-motion preference) and content. */
async function openSection({ items, content = null, per = 2, reduced = false, autoplayMs = 25 } = {}) {
  if (!has('src/components/NewArrivals.jsx')) throw new Error('src/components/NewArrivals.jsx is missing');
  const listeners = {};
  const win = {
    matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: (k) => (k === '--per' ? String(per) : '') }),
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: () => {},
  };
  const mod = loadModule('src/components/NewArrivals.jsx', {
    Link: LINK, Icon: ({ name }) => h('i', { 'data-icon': name }), DeferredImage: (p) => h('img', p),
    useStorefrontSection: (store, path, defaults) => { assert.deepEqual([store, path], ['wellness', 'newArrivals']); return { ...defaults, ...(content || {}) }; },
    useNewArrivals: () => null, STORE_LISTING: { wellness: '/shop?sort=new', fashion: '/fashion', homeliving: '/homeliving' },
    money: (n) => `₹${n}`, window: win,
    // The harness attaches no refs to elements: the track's ref (the one created empty) gets a stand-in, so the
    // section measures --per from the stand-in window as it would from the stylesheet.
    useRef: (init) => hooks.useRef(init === null ? { stand_in: 'track' } : init),
  });
  const handle = await mount(h(mod.NewArrivals, { items, autoplayMs }));
  const index = () => Number(findAll(handle.tree, (n) => n.type === 'ul')[0]?.props.style['--i']);
  const button = (label) => findAll(handle.tree, (n) => n.type === 'button' && n.props['aria-label'] === label)[0];
  const wrap = () => findAll(handle.tree, (n) => n.props?.className === 'hx-wrap')[0];
  const viewport = () => findAll(handle.tree, (n) => n.props?.['aria-roledescription'] === 'carousel')[0];
  const tick = async (ms) => { await sleep(ms); await handle.settle(); };
  return { mod, handle, index, button, wrap, viewport, tick };
}
const card = (k, store = 'homeliving') => ({ key: `${store}-${k}`, store, name: `Product ${k}`, href: `/${store}/p/product-${k}`, image: `/img/p${k}.webp`, price: 100 + k });
const FIVE = [card(1), card(2, 'wellness'), card(3, 'fashion'), card(4), card(5)];

await test('C1 nothing to show — no cards, or hidden in Storefronts — and there is no section at all', async () => {
  for (const [items, content] of [[[], null], [FIVE, { hidden: true }]]) {
    const { handle } = await openSection({ items, content });
    assert.equal(handle.tree, null);
  }
});

await test('C2 the heading and "View All" on one line, as "Explore the stores"; an empty link goes to the newest card\'s store, a set one wins', async () => {
  const { handle } = await openSection({ items: FIVE });
  const head = findAll(handle.tree, (n) => n.props?.className === 'hx-stores__head')[0];
  assert.ok(head, 'the Explore-the-stores heading row');
  assert.equal(textOf(findAll(head, (n) => n.type === 'h2' && n.props.className === 'hx-stores__h')[0]), 'New Arrivals');
  const more = findAll(head, (n) => n.type === 'a' && n.props.className === 'hx-more')[0];
  assert.deepEqual([textOf(more).trim(), more.props.href, more.props['aria-label']], ['View All', '/homeliving', 'View all new arrivals']);
  const set = await openSection({ items: [card(9, 'fashion'), ...FIVE], content: { title: 'Just In', more: 'See everything', link: '/shop?sort=new' } });
  const head2 = findAll(set.handle.tree, (n) => n.props?.className === 'hx-stores__head')[0];
  const more2 = findAll(head2, (n) => n.type === 'a')[0];
  assert.deepEqual([textOf(findAll(head2, (n) => n.type === 'h2')[0]), textOf(more2).trim(), more2.props.href, more2.props['aria-label']], ['Just In', 'See everything', '/shop?sort=new', undefined]);
  assert.equal(set.mod.viewAllLink('', [card(1, 'fashion')]), '/fashion');
  assert.equal(set.mod.viewAllLink('', [card(1, 'wellness')]), '/shop?sort=new');
});

await test('C3 each card: picture, name, price, a link to its product page — and no button', async () => {
  const { handle } = await openSection({ items: FIVE });
  const items = findAll(handle.tree, (n) => n.type === 'li');
  assert.equal(items.length, 5);
  const first = items[0];
  const a = findAll(first, (n) => n.type === 'a')[0];
  assert.equal(a.props.href, '/homeliving/p/product-1');
  assert.equal(findAll(first, (n) => n.type === 'img')[0].props.src, '/img/p1.webp');
  assert.equal(findAll(first, (n) => n.type === 'img')[0].props.alt, '', 'the name is the link text');
  assert.equal(textOf(findAll(first, (n) => n.props?.className === 'hx-new__name')[0]), 'Product 1');
  assert.equal(textOf(findAll(first, (n) => n.props?.className === 'hx-new__price')[0]), '₹101');
  assert.equal(findAll(findAll(handle.tree, (n) => n.type === 'ul')[0], (n) => n.type === 'button').length, 0, 'no Add button in the cards');
  assert.match(findAll(items[1], (n) => n.type === 'span' && /hx-new__art/.test(n.props.className))[0].props.className, /hx-new__art--whole/, 'a wellness packshot sits whole');
});

await test('C4 it advances on its own, pauses on hover and on focus, and resumes', async () => {
  const s = await openSection({ items: FIVE, autoplayMs: 25 });
  assert.equal(s.index(), 0);
  await s.tick(70);
  assert.ok(s.index() >= 1, `advanced (${s.index()})`);
  await s.handle.act(() => s.wrap().props.onMouseEnter());
  const held = s.index();
  await s.tick(120);
  assert.equal(s.index(), held, 'paused on hover');
  await s.handle.act(() => s.wrap().props.onMouseLeave());
  await s.handle.act(() => s.wrap().props.onFocus());
  const held2 = s.index();
  await s.tick(120);
  assert.equal(s.index(), held2, 'paused on focus');
  await s.handle.act(() => s.wrap().props.onBlur());
  await s.tick(70);
  assert.notEqual(s.index(), held2, 'resumed');
});

await test('C5 under prefers-reduced-motion it never moves on its own; the arrows still work', async () => {
  const s = await openSection({ items: FIVE, reduced: true, autoplayMs: 20 });
  await s.tick(150);
  assert.equal(s.index(), 0);
  await s.handle.act(() => s.button('Next products').props.onClick());
  assert.equal(s.index(), 1);
});

await test('C6 arrows step a card and stop at the ends; with nothing to scroll there are no arrows and no autoplay', async () => {
  const s = await openSection({ items: FIVE, per: 2, autoplayMs: 100000 });
  assert.equal(s.button('Previous products').props.disabled, true);
  for (let k = 0; k < 6; k++) await s.handle.act(() => s.button('Next products').props.onClick());
  assert.deepEqual([s.index(), s.button('Next products').props.disabled], [3, true], 'five cards, two in view: the last start is 3');
  const few = await openSection({ items: FIVE.slice(0, 2), per: 2, autoplayMs: 20 });
  assert.equal(few.button('Next products'), undefined);
  await few.tick(100);
  assert.equal(few.index(), 0);
});

await test('C7 a sideways swipe of 40px or more steps a card and swallows the click after it; a short or vertical drag does not', async () => {
  const s = await openSection({ items: FIVE, per: 2, autoplayMs: 100000 });
  const swipe = async (dx, dy) => {
    await s.handle.act(() => s.viewport().props.onPointerDown({ clientX: 300, clientY: 300 }));
    await s.handle.act(() => s.viewport().props.onPointerUp({ clientX: 300 + dx, clientY: 300 + dy }));
  };
  await swipe(-60, 5);
  assert.equal(s.index(), 1);
  let prevented = 0;
  s.viewport().props.onClickCapture({ preventDefault: () => { prevented++; }, stopPropagation() {} });
  assert.equal(prevented, 1, 'the click after a swipe does not open the product');
  s.viewport().props.onClickCapture({ preventDefault: () => { prevented++; }, stopPropagation() {} });
  assert.equal(prevented, 1, 'the next click does');
  await swipe(30, 0);
  await swipe(20, 120);
  assert.equal(s.index(), 1);
  await swipe(80, 0);
  assert.equal(s.index(), 0);
});

await test('C8 cards outside the window are hidden from assistive technology and untabbable; the viewport puts back any scroll', async () => {
  const s = await openSection({ items: FIVE, per: 2, autoplayMs: 100000 });
  await s.handle.act(() => s.button('Next products').props.onClick());
  const items = findAll(s.handle.tree, (n) => n.type === 'li');
  assert.deepEqual(items.map((li) => li.props['aria-hidden']), [true, false, false, true, true]);
  assert.deepEqual(items.map((li) => findAll(li, (n) => n.type === 'a')[0].props.tabIndex), [-1, undefined, undefined, -1, -1]);
  const el = { scrollLeft: 240 };
  s.viewport().props.onScroll({ currentTarget: el });
  assert.equal(el.scrollLeft, 0);
});

console.log('\n— Where it lives —');

await test('S1 Storefronts → Wellness edits it: hide, heading, "View All" label and link, through the existing records (no new schema)', async () => {
  const content = await import(pathToFileURL(resolve(ROOT, 'src/lib/storefrontContent.js')).href);
  const spec = content.sectionSpec('wellness', 'newArrivals');
  assert.ok(spec, 'the section is in the wellness schema');
  assert.deepEqual(Object.keys(spec.fields), ['hidden', 'title', 'more', 'link']);
  assert.deepEqual(Object.keys(content.STOREFRONT_SCHEMAS.wellness.fields).slice(4, 7), ['promo', 'newArrivals', 'lifestyleBanner'], 'after the festive promo, as on the page');
  const defaults = { hidden: false, title: 'New Arrivals', more: 'View All', link: '' };
  assert.deepEqual(content.readSection(spec, { title: 'Just In', link: '' }, defaults), { hidden: false, title: 'Just In', more: 'View All', link: '' });
  assert.deepEqual(content.readSection(spec, { hidden: true }, defaults).hidden, true);
  assert.deepEqual(content.validateStorefrontContent('wellness', { newArrivals: { title: 'Just In', more: 'All of it', link: '/homeliving' } }).errors, {});
  const admin = read('src/admin/storefrontSections.js');
  assert.match(admin, /\{ path: 'promo', defaults: FESTIVE_SECTION \},\n\s*\{ path: 'newArrivals', defaults: NEW_ARRIVALS_SECTION \},\n\s*\{ path: 'lifestyleBanner'/);
  assert.equal(read('supabase/migrations/0037_storefront_content.sql').includes('newArrivals'), false, 'the 0037 records hold it as they are');
});

await test('S2 Home.jsx: mid-page, after the offers and before the Lifestyle banner', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /import \{ NewArrivals \} from '\.\.\/components\/NewArrivals\.jsx';/);
  const at = (s) => home.indexOf(s);
  assert.ok(at('<FestivePromo />') < at('<HomeOffers') && at('<HomeOffers') < at('<NewArrivals />') && at('<NewArrivals />') < at('<LifestyleBanner />'));
});

await test('S3 the page\'s look: the .hx palette and tint, square edges, a transform-only track, a viewport that cannot scroll, still under reduced motion', () => {
  const css = read('src/styles/v2-home.css');
  const block = css.slice(css.indexOf('/* ---- New Arrivals (NewArrivals.jsx)'));
  assert.ok(block.length > 100, 'the New Arrivals block');
  const jsx = read('src/components/NewArrivals.jsx');
  assert.match(jsx, /<section className="hx hx-new"/, 'inside the .hx palette (warm tint, orange accent)');
  assert.doesNotMatch(block.replace(/border-radius: 0/g, ''), /border-radius/, 'square edges');
  assert.match(block, /\.hx-new__track \{[^}]*transform: translateX\(calc\(var\(--i, 0\) \* -1 \*[^}]*transition: transform \.5s ease;/);
  assert.match(block, /\.hx-new__viewport \{ overflow: hidden; overflow: clip; touch-action: pan-y; \}/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\n\s*\.hx-new__track, \.hx-new__image, \.hx-new__arrows button \{ transition: none; \}/);
  assert.match(block, /@media \(max-width: 700px\) \{[^}]*\}\s*\n\s*\.hx-new__tools[\s\S]*?\.hx-new__track \{ --per: 2;/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
