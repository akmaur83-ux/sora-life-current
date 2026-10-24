// ============================================================
// Admin reorders and category saves (stage-two audit, 2026-10-24):
//   3  Move up/down on Products and Promotions fired one update per row and
//      never looked at the answers, so a move whose writes failed still
//      showed as saved; and a single product move rewrote all 149 products,
//      stamping each one's updated_at;
//   4  a category was saved by upsert on its slug, so editing a slug made a
//      second category beside the first, and adding a category whose name
//      made an existing slug overwrote that category, blanking its tagline
//      and image.
//
// src/lib/adminApi.js builds the browser Supabase client, so it cannot load
// under node: its functions are lifted from the source and run against a
// stand-in that keeps the rows, orders them as PostgREST would, enforces
// categories' unique slug, and can answer a write with an error. The pages
// are compiled from source, mounted with the catalogue admin harness's hook
// runtime, and wired to those lifted functions.
//   node scripts/test-admin-reorder-categories.mjs
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { loadModule, mount, read, h, findAll, textOf, buttonByText, submit } from './catalogue-admin-harness.mjs';
import { normalizeContentPatch } from '../src/lib/productContent.js';
import { normalizePromo } from '../src/lib/promotions.js';
import { money } from '../src/lib/format.js';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};

/** A stand-in PostgREST client over `tables`. Updates on ids in `failIds` answer with an error. */
function db(tables) {
  const log = [];
  const failIds = new Set();
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function run(q) {
    const rows = tables[q.table];
    const match = (r) => q.filters.every(([c, v]) => r[c] === v);
    if (q.op === 'update') {
      const id = q.filters.find(([c]) => c === 'id')?.[1];
      if (failIds.has(id)) return { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
      const hit = rows.filter(match);
      for (const r of hit) Object.assign(r, q.payload);
      return { data: q.returning ? hit.map((r) => ({ ...r })) : null, error: null };
    }
    if (q.op === 'insert' || q.op === 'upsert') {
      const row = q.payload;
      const clash = rows.find((r) => r.slug === row.slug);
      if (clash && q.op === 'upsert' && q.opts?.onConflict === 'slug') {
        Object.assign(clash, row); // ON CONFLICT (slug) DO UPDATE: every column it was given
        return { data: { ...clash }, error: null };
      }
      if (clash) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "categories_slug_key"' } };
      const created = { id: `cat-new-${rows.length + 1}`, tagline: '', blurb: '', image_url: null, ...row };
      rows.push(created);
      return { data: q.single ? { ...created } : [{ ...created }], error: null };
    }
    const out = rows.filter(match).map((r) => ({ ...r }));
    // Ordered column by column; rows tied on every given column keep their stored order, as a heap scan would.
    out.sort((a, b) => q.orders.reduce((d, [c, asc]) => d || (asc ? 1 : -1) * cmp(a[c], b[c]), 0));
    return { data: q.single ? out[0] ?? null : out, error: null };
  }
  const from = (table) => {
    const q = { table, op: 'select', payload: null, opts: null, filters: [], orders: [], returning: false, single: false };
    log.push(q);
    const chain = {
      select() { if (q.op !== 'select') q.returning = true; return chain; },
      update(p) { q.op = 'update'; q.payload = p; return chain; },
      insert(p) { q.op = 'insert'; q.payload = p; return chain; },
      upsert(p, o) { q.op = 'upsert'; q.payload = p; q.opts = o; return chain; },
      eq(c, v) { q.filters.push([c, v]); return chain; },
      order(c, o) { q.orders.push([c, o?.ascending !== false]); return chain; },
      single() { q.single = true; return chain; },
      maybeSingle() { q.single = true; return chain; },
      then(resolve, reject) { return Promise.resolve(run(q)).then(resolve, reject); },
    };
    return chain;
  };
  return { supabase: { from }, log, failIds, tables, writes: () => log.filter((q) => q.op !== 'select') };
}

const api = read('src/lib/adminApi.js');
const lift = (name) => {
  const m = new RegExp(`(?:export )?(?:async )?function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`).exec(api);
  return m ? m[0].replace(/^export /, '') : '';
};
const NAMES = ['slugify', 'stockFromDbValue', 'dbRowToProduct', 'writePositions', 'adminListProducts', 'adminReorderProducts', 'adminListPromotions', 'adminReorderPromotions', 'adminSaveCategory', 'adminUpsertCategory', 'adminListCategories'];
/** adminApi.js's functions over a stand-in client. `saveCategory` is whichever save the Categories page calls. */
function load(tables) {
  const store = db(tables);
  const fns = new Function('supabase', 'normalizeContentPatch', 'IN_STOCK_QTY', 'isMissingPromotions', 'PROMO_MISSING', `${NAMES.map(lift).join('\n')}
    return {
      adminListProducts, adminReorderProducts, adminListPromotions, adminReorderPromotions, adminListCategories,
      saveCategory: typeof adminSaveCategory === 'function' ? adminSaveCategory : adminUpsertCategory,
    };`)(store.supabase, normalizeContentPatch, 40, () => false, '');
  return { ...store, ...fns };
}
const throwsWith = async (promise, re) => {
  try { await promise; } catch (e) { assert.match(e.message, re); return; }
  assert.fail('expected the save to be refused');
};

const productRows = (n, at = (i) => i) => Array.from({ length: n }, (_, i) => ({
  id: `p${String(i + 1).padStart(3, '0')}`, biosash_id: i + 1, name: `Product ${i + 1}`, slug: `product-${i + 1}`, category: 'wellness',
  sort_order: at(i), is_active: true, stock: true, original_price: 500, discount_percent: 0, updated_at: '2026-10-01T00:00:00Z',
}));
const promoRows = (n) => Array.from({ length: n }, (_, i) => ({
  id: `promo-${i + 1}`, type: 'poster', title: `Offer ${i + 1}`, theme_variant: 'forest', placements: ['home'], is_active: true,
  sort_order: i, created_at: `2026-09-0${i + 1}T00:00:00Z`,
}));
const swap = (list, a, b) => { const next = [...list]; [next[a], next[b]] = [next[b], next[a]]; return next; };
const written = (a) => a.writes().map((q) => [q.filters.find(([c]) => c === 'id')?.[1], q.payload.sort_order]);

console.log('\n— 3. A move writes only what moved, and a move that did not save says so —');

await test('R1 moving one product past its neighbour writes those two products, not all 149', async () => {
  const a = load({ products: productRows(149) });
  const list = await a.adminListProducts();
  await a.adminReorderProducts(swap(list, 4, 5));
  assert.deepEqual(written(a), [['p006', 4], ['p005', 5]], `${a.writes().length} products written`);
  assert.ok(a.writes().every((q) => q.payload.updated_at > '2026-10-01T00:00:00Z'), 'each one written stamps updated_at');
  assert.deepEqual(a.tables.products.slice(0, 7).map((r) => r.sort_order), [0, 1, 2, 3, 5, 4, 6]);
});

await test('R2 products stored at the same position list the same way every time; the first move numbers them, the next writes two', async () => {
  // Every product the editor used to save was stored at position 0.
  const a = load({ products: productRows(6, (i) => (i < 4 ? 0 : i)).reverse() });
  const list = await a.adminListProducts();
  assert.deepEqual(list.map((p) => p.dbId), ['p001', 'p002', 'p003', 'p004', 'p005', 'p006'], 'id breaks the tie');
  await a.adminReorderProducts(swap(list, 0, 1));
  assert.deepEqual(written(a), [['p001', 1], ['p003', 2], ['p004', 3]]);
  const again = await a.adminListProducts();
  assert.deepEqual(again.map((p) => p.dbId), ['p002', 'p001', 'p003', 'p004', 'p005', 'p006']);
  await a.adminReorderProducts(swap(again, 2, 3));
  assert.equal(a.writes().length, 5);
});

await test('R3 a write that fails makes the move fail, saying how many positions did not save', async () => {
  const a = load({ products: productRows(10) });
  a.failIds.add('p006');
  await throwsWith(a.adminReorderProducts(swap(await a.adminListProducts(), 4, 5)), /The new order was not saved: 1 of 2 product positions could not be written \(JWT expired\)/);
});

await test('R4 a write that matches no product (deleted meanwhile, or no longer an admin) is a failure too', async () => {
  const a = load({ products: productRows(10) });
  const list = await a.adminListProducts();
  a.tables.products.splice(5, 1); // p006 deleted in another tab
  await throwsWith(a.adminReorderProducts(swap(list, 4, 5)), /1 of 2 product positions could not be written \(the product was not found, or this session can no longer edit it\)/);
});

await test('R5 promotions: a move writes the two that moved, position only, and a failed write fails the move', async () => {
  const a = load({ promotions: promoRows(5) });
  await a.adminReorderPromotions(swap(await a.adminListPromotions(), 1, 2));
  assert.deepEqual(written(a), [['promo-3', 1], ['promo-2', 2]]);
  assert.ok(a.writes().every((q) => Object.keys(q.payload).join() === 'sort_order'));
  a.failIds.add('promo-5');
  await throwsWith(a.adminReorderPromotions(swap(await a.adminListPromotions(), 3, 4)), /1 of 2 promotion positions could not be written \(JWT expired\)/);
});

/** The Products page over lifted functions. `moveDown(name)` presses that product's ↓. */
async function openProducts(a, deps = {}) {
  const page = loadModule('src/admin/pages/Products.jsx', {
    Link: ({ to, ...rest }) => h('a', { href: to, ...rest }), staticCategories: [], money, window: { confirm: () => true },
    adminListProducts: a.adminListProducts, adminReorderProducts: a.adminReorderProducts,
    adminSetProductActive: async () => {}, adminDeleteProduct: async () => {}, ...deps,
  });
  const handle = await mount(h(page.default));
  const rows = () => findAll(handle.tree, (n) => n.type === 'tr' && findAll(n, (x) => x.type === 'strong').length);
  const names = () => rows().map((r) => textOf(findAll(r, (x) => x.type === 'strong')[0]));
  const button = (name, title) => findAll(rows().find((r) => names()[rows().indexOf(r)] === name), (n) => n.type === 'button' && n.props.title === title)[0];
  const moveDown = (name) => handle.act(() => button(name, 'Move down').props.onClick());
  return { handle, names, button, moveDown };
}
const banner = (tree) => findAll(tree, (n) => /adm-banner err/.test(n.props?.className || '')).map(textOf).join(' ');

await test('P1 the Products screen: two moves write two products each, and nothing reports an error', async () => {
  const a = load({ products: productRows(5) });
  const page = await openProducts(a);
  await page.moveDown('Product 1');
  await page.moveDown('Product 1');
  assert.deepEqual(page.names(), ['Product 2', 'Product 3', 'Product 1', 'Product 4', 'Product 5']);
  assert.deepEqual(written(a), [['p002', 0], ['p001', 1], ['p003', 1], ['p001', 2]]);
  assert.equal(banner(page.handle.tree), '');
});

await test('P2 the Products screen: a move that did not save is reported, and the list shows the order as stored', async () => {
  const a = load({ products: productRows(5) });
  a.failIds.add('p002');
  const page = await openProducts(a);
  await page.moveDown('Product 1');
  assert.match(banner(page.handle.tree), /The new order was not saved: 1 of 2 product positions could not be written \(JWT expired\)\. The list has been reloaded to show the saved order\./);
  // p001 was written to 1; p002 kept 1; the tie lists by id — Product 1 still first, as the shop has it.
  assert.deepEqual(page.names(), ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5']);
});

await test('P3 the Products screen: the arrows are off while a move is saving, so a second move cannot start from an unsaved order', async () => {
  const a = load({ products: productRows(3) });
  let finish;
  const page = await openProducts(a, { adminReorderProducts: (list) => new Promise((resolve) => { finish = () => resolve(a.adminReorderProducts(list)); }) });
  await page.handle.act(() => { page.button('Product 1', 'Move down').props.onClick(); });
  assert.equal(page.button('Product 3', 'Move up').props.disabled, true, 'Move up is off while saving');
  assert.equal(page.button('Product 3', 'Move down').props.disabled, true, 'Move down is off while saving');
  await page.handle.act(() => finish());
  assert.ok(!page.button('Product 3', 'Move up').props.disabled, 'and back on once saved');
});

/** The Promotions page over lifted functions. */
async function openPromotions(a) {
  const page = loadModule('src/admin/pages/Promotions.jsx', {
    normalizePromo, PromoPoster: () => null, PromoOfferCard: () => null, window: { confirm: () => true },
    adminListPromotions: a.adminListPromotions, adminReorderPromotions: a.adminReorderPromotions,
    adminUpsertPromotion: async () => {}, adminDeletePromotion: async () => {}, adminSetPromotionActive: async () => {}, uploadPromoImage: async () => '',
  });
  const handle = await mount(h(page.default));
  const cards = () => findAll(handle.tree, (n) => n.props?.className === 'adm-slide-card');
  const titles = () => cards().map((c) => textOf(findAll(c, (x) => x.type === 'strong')[0]));
  const inCard = (title, pred) => findAll(cards()[titles().indexOf(title)], pred)[0];
  const press = (title, label) => handle.act(() => inCard(title, (n) => n.type === 'button' && (n.props['aria-label'] === label || textOf(n) === label)).props.onClick());
  return { handle, titles, press };
}

await test('M1 the Promotions screen: a move that did not save is reported, and the list shows the order as stored', async () => {
  const a = load({ promotions: promoRows(3) });
  a.failIds.add('promo-1');
  a.failIds.add('promo-2');
  const page = await openPromotions(a);
  await page.press('Offer 1', 'Move down');
  assert.match(banner(page.handle.tree), /2 of 2 promotion positions could not be written \(JWT expired\)\. The list has been reloaded to show the saved order\./);
  assert.deepEqual(page.titles(), ['Offer 1', 'Offer 2', 'Offer 3']);
});

await test('M2 the Promotions screen: after a saved move, Edit opens with the position the promotion now has', async () => {
  const a = load({ promotions: promoRows(3) });
  const page = await openPromotions(a);
  await page.press('Offer 1', 'Move down');
  assert.deepEqual(page.titles(), ['Offer 2', 'Offer 1', 'Offer 3']);
  await page.press('Offer 1', 'Edit');
  const position = findAll(page.handle.tree, (n) => n.type === 'input' && n.props.type === 'number')[0];
  assert.equal(Number(position.props.value), 1, 'Sort order shows 1, so saving the promotion keeps it where it was moved');
});

console.log('\n— 4. A category is saved by its id, and a new one never overwrites another —');

const categoryRows = () => [
  { id: 'c1', slug: 'skin-care', name: 'Skin Care', tagline: 'Radiance, naturally', blurb: 'Serums and creams.', image_url: '/img/skin.webp', tone: 'rose', sort_order: 3, is_active: true },
  { id: 'c2', slug: 'hair-care', name: 'Hair Care', tagline: 'Roots to ends', blurb: 'Shampoos.', image_url: '/img/hair.webp', tone: 'plum', sort_order: 4, is_active: true },
];

await test('K1 editing a category updates that category by its id and keeps its slug, so its products and page stay linked', async () => {
  const a = load({ categories: categoryRows() });
  await a.saveCategory({ ...categoryRows()[0], slug: 'skincare', tagline: 'Glow, naturally' });
  assert.equal(a.tables.categories.length, 2, 'no second category');
  assert.deepEqual([a.tables.categories[0].slug, a.tables.categories[0].tagline], ['skin-care', 'Glow, naturally']);
  const [write] = a.writes();
  assert.equal(write.op, 'update');
  assert.deepEqual(write.filters, [['id', 'c1']]);
  assert.ok(!('slug' in write.payload), 'the slug is not written');
});

await test('K2 adding a category whose slug is taken is refused, and the category holding it keeps its tagline and image', async () => {
  const a = load({ categories: categoryRows() });
  await throwsWith(a.saveCategory({ name: 'Skin Care', slug: '' }), /A category with the slug "skin-care" already exists\. Edit that category instead, or give this one a different slug\./);
  assert.deepEqual(a.tables.categories, categoryRows());
});

await test('K3 a new category with a free slug is added, its slug made from the name', async () => {
  const a = load({ categories: categoryRows() });
  const saved = await a.saveCategory({ name: 'Body Oils', slug: '', tagline: 'Cold-pressed' });
  assert.equal(saved.slug, 'body-oils');
  assert.equal(a.tables.categories.length, 3);
});

await test('K4 saving a category deleted meanwhile says so, instead of quietly bringing it back', async () => {
  const a = load({ categories: categoryRows() });
  const opened = { ...categoryRows()[1] };
  a.tables.categories.splice(1, 1);
  await throwsWith(a.saveCategory({ ...opened, tagline: 'Stronger hair' }), /This category was not saved: it no longer exists/);
  assert.equal(a.tables.categories.length, 1);
});

await test('K5 the Categories screen: the slug is fixed when editing, typed when adding, and a refused add keeps the form open', async () => {
  const a = load({ categories: categoryRows() });
  const page = loadModule('src/admin/pages/Categories.jsx', {
    window: { confirm: () => true }, adminListCategories: a.adminListCategories, adminDeleteCategory: async () => {}, adminSeedDefaultCategories: async () => {},
    adminSaveCategory: a.saveCategory, adminUpsertCategory: a.saveCategory,
  });
  const handle = await mount(h(page.default));
  const slugInput = () => findAll(findAll(handle.tree, (n) => n.props?.className === 'field' && findAll(n, (x) => x.type === 'label' && textOf(x) === 'Slug').length)[0], (n) => n.type === 'input')[0];
  const row = (name) => findAll(handle.tree, (n) => n.type === 'tr' && textOf(n).startsWith(name))[0];
  await handle.act(() => buttonByText(row('Skin Care'), 'Edit').props.onClick());
  assert.equal(slugInput().props.readOnly, true, 'the slug of an existing category is read-only');
  assert.match(textOf(handle.tree), /Fixed once the category exists: its products and its page address use it\./);
  await handle.act(() => buttonByText(handle.tree, 'Cancel').props.onClick());
  await handle.act(() => buttonByText(handle.tree, '+ Add category').props.onClick());
  assert.ok(!slugInput().props.readOnly, 'a new category\'s slug can be typed');
  const name = findAll(handle.tree, (n) => n.type === 'input' && n.props.required)[0];
  await handle.act(() => name.props.onChange({ target: { value: 'Skin Care' } }));
  await handle.act(() => submit(findAll(handle.tree, (n) => n.type === 'form')[0]));
  assert.match(banner(handle.tree), /already exists/);
  assert.ok(findAll(handle.tree, (n) => n.type === 'form').length, 'the form stays open with what was typed');
  assert.equal(a.tables.categories[0].tagline, 'Radiance, naturally');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
