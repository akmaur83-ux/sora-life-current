// ============================================================
// Admin screens that treated a failed read as an empty one (stage-two
// audit, 2026-10-24):
//   5  Settings (business information), Branding and Creator terms showed
//      their blank defaults with Save enabled when the saved value could not
//      be read, so one Save wrote the blanks over the live details;
//   6  the Dashboard swallowed a failed product read as an empty catalogue
//      and offered "Import 149 Biosash products" — no confirmation, and the
//      import overwrote name, slug, category, image, stock flag and form on
//      every product already there.
//
// The pages are compiled from source and mounted with the catalogue admin
// harness's hook runtime, against stand-in reads that can fail. The import
// itself is lifted from src/lib/adminApi.js (it builds the browser Supabase
// client, so it cannot load under node) and run against a products table.
//   node scripts/test-admin-failed-loads.mjs
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { loadModule, mount, read, h, findAll, textOf, buttonByText, submit } from './catalogue-admin-harness.mjs';
import { POLICY_KEYS, SOCIAL_NETWORKS, validateCompanyForSave } from '../src/lib/company.js';
import { BIOSASH_PRODUCTS } from '../src/data/biosash.js';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};

const READ_FAILED = Object.assign(new Error('Failed to fetch'), { code: 'NETWORK' });
/** adminGetSetting/adminSetSetting over one stored value, or a read that fails. */
function settings(stored, { fails = false } = {}) {
  const writes = [];
  return {
    writes,
    adminGetSetting: async () => { if (fails) throw READ_FAILED; return stored; },
    adminSetSetting: async (key, value) => { writes.push([key, value]); },
  };
}
const forms = (tree) => findAll(tree, (n) => n.type === 'form');
const alertText = (tree) => findAll(tree, (n) => n.props?.role === 'alert').map(textOf).join(' ');
/** Press the Save the page offers, if any, then require that nothing reached the database and no Save is offered. */
async function trySave(page, store, label) {
  const button = buttonByText(page.tree, label);
  const form = button && forms(page.tree).find((f) => findAll(f, (n) => n === button).length);
  if (form) await page.act(() => submit(form));
  assert.equal(store.writes.length, 0, `a Save wrote over the live value: ${JSON.stringify(store.writes[0]?.[1])?.slice(0, 160)}`);
  assert.equal(button, undefined, `no "${label}" button`);
}
const inputValues = (tree) => findAll(tree, (n) => n.type === 'input' || n.type === 'textarea').map((n) => n.props.value);

async function openSettings(store) {
  const page = loadModule('src/admin/pages/Settings.jsx', {
    ...store, POLICY_KEYS, SOCIAL_NETWORKS, validateCompanyForSave,
    useAdminAuth: () => ({ session: { user: { email: 'owner@soralife.test' } }, signOut() {} }),
    supabase: { auth: { updateUser: async () => ({ error: null }) } },
  });
  return mount(h(page.default));
}
async function openBranding(store) {
  const page = loadModule('src/admin/pages/Branding.jsx', { ...store, uploadImage: async () => '/img/x.webp' });
  return mount(h(page.default));
}
async function openTerms(store) {
  const page = loadModule('src/admin/pages/CreatorTerms.jsx', { ...store });
  return mount(h(page.default));
}

const LIVE_CONTACT = {
  legalName: 'Sora Life Wellness LLP', email: 'care@soralife.shop', phone: '+91 98765 43210', address: 'Leh, Ladakh',
  hours: 'Mon–Sat 10–6', social: { instagram: 'https://instagram.com/soralife' }, policies: { returns: 'Returns within 7 days.' },
};
const LIVE_BRANDING = { logo_url: '/img/sora-logo.webp', site_name: 'SORA LIFE', tagline: 'Himalayan wellness', primary_color: '#2B4A3A', accent_color: '#E07B39', favicon_url: '/img/favicon.webp' };
const LIVE_TERMS = { body: '## Creator Programme Terms\n\nCommission is paid monthly.', version: 3, updated_at: '2026-09-01T10:00:00Z' };

console.log('\n— 5. A failed read cannot be saved over the live value —');

await test('S1 Settings: a failed read shows why and offers no business form to save; the password form still works', async () => {
  const store = settings(LIVE_CONTACT, { fails: true });
  const page = await openSettings(store);
  await trySave(page, store, 'Save business information');
  assert.equal(forms(page.tree).length, 1, 'only the password form');
  assert.ok(buttonByText(page.tree, 'Update password'));
  assert.match(alertText(page.tree), /business information could not be loaded \(Failed to fetch\)/);
});

await test('S2 Settings: a read that works shows the live details, and Save writes them back as they are', async () => {
  const store = settings(LIVE_CONTACT);
  const page = await openSettings(store);
  assert.equal(alertText(page.tree), '');
  assert.ok(inputValues(page.tree).includes('Sora Life Wellness LLP'));
  const business = forms(page.tree).find((f) => buttonByText(f, 'Save business information'));
  await page.act(() => submit(business));
  assert.equal(store.writes.length, 1);
  const [key, value] = store.writes[0];
  assert.equal(key, 'contact');
  assert.equal(value.legalName, 'Sora Life Wellness LLP');
  assert.equal(value.email, 'care@soralife.shop');
  assert.equal(value.policies.returns, 'Returns within 7 days.');
});

await test('S3 Settings: no saved row yet is not a failure: the blank form shows and can be saved', async () => {
  const store = settings(null);
  const page = await openSettings(store);
  assert.equal(alertText(page.tree), '');
  const business = forms(page.tree).find((f) => buttonByText(f, 'Save business information'));
  assert.ok(business, 'the business form');
  await page.act(() => submit(business));
  assert.equal(store.writes.length, 1);
});

await test('B1 Branding: a failed read shows why and offers no form, so the default logo, name and colors cannot be saved', async () => {
  const store = settings(LIVE_BRANDING, { fails: true });
  const page = await openBranding(store);
  await trySave(page, store, 'Save branding');
  assert.equal(forms(page.tree).length, 0);
  assert.match(alertText(page.tree), /branding could not be loaded \(Failed to fetch\)/);
});

await test('B2 Branding: a read that works shows the live branding, and Save writes it back as it is', async () => {
  const store = settings(LIVE_BRANDING);
  const page = await openBranding(store);
  assert.ok(inputValues(page.tree).includes('SORA LIFE'));
  await page.act(() => submit(forms(page.tree)[0]));
  assert.deepEqual(store.writes, [['branding', LIVE_BRANDING]]);
});

await test('C1 Creator terms: a failed read shows why, offers no form, and does not claim no terms are published', async () => {
  const store = settings(LIVE_TERMS, { fails: true });
  const page = await openTerms(store);
  await trySave(page, store, 'Save terms');
  assert.doesNotMatch(textOf(page.tree), /No terms published yet/);
  assert.equal(forms(page.tree).length, 0);
  assert.match(alertText(page.tree), /creator terms could not be loaded \(Failed to fetch\)/);
});

await test('C2 Creator terms: a read that works keeps its version on a plain Save, so acceptances stand', async () => {
  const store = settings(LIVE_TERMS);
  const page = await openTerms(store);
  await page.act(() => submit(forms(page.tree)[0]));
  assert.equal(store.writes.length, 1);
  const [key, value] = store.writes[0];
  assert.equal(key, 'creator_terms');
  assert.equal(value.version, 3);
  assert.equal(value.body, LIVE_TERMS.body);
});

console.log('\n— 6. The Biosash import needs a catalogue that is really empty, asks first, and only adds —');

const PRODUCT = (id, extra = {}) => ({ dbId: `p${id}`, id, name: `Product ${id}`, isActive: true, ...extra });
/** The Dashboard over stand-in reads; `lists` is the sequence of product lists each load returns. */
async function openDashboard({ lists = [[]], productsFail = false, categoriesFail = false, answer = true } = {}) {
  const calls = { seed: 0, imports: 0, loads: 0 };
  const win = { asked: [], confirm(message) { win.asked.push(message); return answer; } };
  const page = loadModule('src/admin/pages/Dashboard.jsx', {
    window: win,
    Link: ({ to, ...rest }) => h('a', { href: to, ...rest }),
    adminListProducts: async () => { calls.loads += 1; if (productsFail) throw READ_FAILED; return lists[Math.min(calls.loads, lists.length) - 1]; },
    adminListCategories: async () => { if (categoriesFail) throw READ_FAILED; return [{ slug: 'wellness' }, { slug: 'skin-care' }]; },
    adminSeedDefaultCategories: async () => { calls.seed += 1; },
    adminImportBiosashCatalog: async (onProgress) => { calls.imports += 1; onProgress?.(149, 149); return { added: 149, total: 149 }; },
  });
  const handle = await mount(h(page.default));
  return { handle, calls, win };
}
const stats = (tree) => findAll(tree, (n) => n.props?.className === 'adm__stat').map((n) => textOf(n));
const IMPORT = 'Import 149 Biosash products';

await test('D1 a failed product read says so, shows the counts as unknown, and offers no import', async () => {
  const { handle } = await openDashboard({ productsFail: true });
  assert.equal(buttonByText(handle.tree, IMPORT), undefined, 'no import button');
  assert.doesNotMatch(textOf(handle.tree), /catalog is empty/);
  assert.match(alertText(handle.tree), /catalogue could not be loaded \(Failed to fetch\)/);
  assert.deepEqual(stats(handle.tree), ['—Products', '—Active products', '2Categories']);
});

await test('D2 a catalogue that loaded with products offers no import, and its counts are real', async () => {
  const { handle } = await openDashboard({ lists: [[PRODUCT(1), PRODUCT(2, { isActive: false })]], categoriesFail: true });
  assert.equal(buttonByText(handle.tree, IMPORT), undefined);
  assert.deepEqual(stats(handle.tree), ['2Products', '1Active products', '—Categories']);
});

await test('D3 on a catalogue that loaded empty, the import asks first, and No changes nothing', async () => {
  const { handle, calls, win } = await openDashboard({ answer: false });
  const button = buttonByText(handle.tree, IMPORT);
  assert.ok(button, 'the import is offered');
  await handle.act(() => button.props.onClick());
  assert.equal(win.asked.length, 1);
  assert.match(win.asked[0], /no prices set/);
  assert.match(win.asked[0], /Nothing already in the catalogue is changed/);
  assert.deepEqual([calls.seed, calls.imports], [0, 0]);
});

await test('D4 Yes runs it, and the result stays on screen after the list reloads', async () => {
  const { handle, calls } = await openDashboard({ lists: [[], [PRODUCT(1)]] });
  await handle.act(() => buttonByText(handle.tree, IMPORT).props.onClick());
  assert.deepEqual([calls.seed, calls.imports], [1, 1]);
  assert.equal(buttonByText(handle.tree, IMPORT), undefined, 'the list reloaded and is no longer empty');
  assert.match(textOf(handle.tree), /Added 149 of the 149 bundled Biosash products\. Default categories seeded where missing\./);
});

/** adminImportBiosashCatalog, lifted, over a products table keyed by biosash_id. */
function liftImport(existing) {
  const api = read('src/lib/adminApi.js');
  const m = /export async function adminImportBiosashCatalog\([^)]*\) \{\n[\s\S]*?\n\}\n/.exec(api);
  assert.ok(m, 'adminImportBiosashCatalog found in adminApi.js');
  const table = new Map(existing.map((r) => [r.biosash_id, { ...r }]));
  const calls = [];
  const supabase = {
    from(name) {
      assert.equal(name, 'products');
      let rows = [], opts = {}, returned = null;
      const run = () => {
        const inserted = [];
        for (const r of rows) {
          if (table.has(r.biosash_id)) { if (!opts.ignoreDuplicates) Object.assign(table.get(r.biosash_id), r); continue; }
          table.set(r.biosash_id, { ...r }); inserted.push(r);
        }
        return { data: returned ? inserted.map((r) => ({ biosash_id: r.biosash_id })) : null, error: null };
      };
      const chain = {
        upsert(r, o = {}) { rows = r; opts = o; calls.push({ rows: r, opts: o }); return chain; },
        select(cols) { returned = cols; return chain; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return chain;
    },
  };
  const fn = new Function('supabase', 'BIOSASH_PRODUCTS', `${m[0].replace(/^export /, '')}\nreturn adminImportBiosashCatalog;`)(supabase, BIOSASH_PRODUCTS);
  return { fn, table, calls };
}

await test('I1 the import leaves a product already in the table exactly as it is, and adds only the missing ones', async () => {
  const [first, second] = BIOSASH_PRODUCTS;
  const live = { biosash_id: first.id, name: 'Renamed in admin', slug: 'renamed-in-admin', category: 'supplements', image_url: '/img/our-own.webp', stock: false, form: 'Capsule' };
  const { fn, table, calls } = liftImport([live, { biosash_id: second.id, name: second.name }]);
  const result = await fn();
  assert.deepEqual(table.get(first.id), live, 'the live product is untouched');
  assert.deepEqual(result, { added: BIOSASH_PRODUCTS.length - 2, total: BIOSASH_PRODUCTS.length });
  assert.equal(table.size, BIOSASH_PRODUCTS.length);
  assert.ok(calls.length > 0 && calls.every((c) => c.opts.onConflict === 'biosash_id' && c.opts.ignoreDuplicates === true));
});

await test('I2 a product it adds still carries no active flag, description, price, position or merchandising flag', async () => {
  const { fn, calls } = liftImport([]);
  await fn();
  for (const key of ['is_active', 'description', 'original_price', 'discount_percent', 'sale_price', 'sort_order', 'is_new', 'is_bestseller', 'is_featured']) {
    assert.ok(calls.every((c) => c.rows.every((r) => !(key in r))), `${key} absent`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
