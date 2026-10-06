// ============================================================
// Store catalogue admin — HSN code and GST rate, and Grocery in the picker.
//
//   node scripts/test-store-catalogue-tax-grocery.mjs
//
// Offline (catalogue-admin-harness.mjs). Pinned:
//   * HSN is 4, 6 or 8 digits and GST 0–100, the database's own CHECKs,
//     enforced before the write and shown beside the field
//   * both are captured on every store's products — and the editor says,
//     where they are entered, that the GST rate is recorded and NOT applied
//     at checkout (pricing.js still sets gst_rate null for catalogue lines)
//   * Grocery is in the picker and the admin menu, so products can be
//     entered — under a banner that says it cannot be sold yet and that its
//     variants are read nowhere; grocery products get no dead "View" link
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  read, createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, openPage,
  fieldByLabel, formOf, change, submit, findAll, textOf,
} from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
const REPO = fileURLToPath(new URL('..', import.meta.url));
const row = (store, table, id) => store.db()[table].find((r) => r.id === id);
const notes = (tree) => findAll(tree, (n) => n.props?.role === 'note').map(textOf);

console.log('\n— HSN code and GST rate —');

await test('HSN must be 4, 6 or 8 digits (spaces and dots dropped); GST 0–100; blank is "not known yet"', async () => {
  const { rules } = await loadCatalogueAdmin({ supabase: createCatalogueDb().supabase });
  const cats = catalogueFixtures().catalogue_categories.filter((c) => c.store === 'homeliving');
  const base = { name: 'Sheet', category_id: 'hc-bedsheets', mrp: 999, stock: 1 };
  const ok = (patch) => rules.catalogueProductPayload({ ...base, ...patch }, cats);
  assert.equal(ok({ hsn_code: '6302' }).hsn_code, '6302');
  assert.equal(ok({ hsn_code: '630231' }).hsn_code, '630231');
  assert.equal(ok({ hsn_code: '6302 10 90' }).hsn_code, '63021090');
  assert.equal(ok({ hsn_code: '6302.10' }).hsn_code, '630210');
  assert.equal(ok({ hsn_code: '' }).hsn_code, null);
  for (const bad of ['630', '63021', '6302109', '630210901', 'HSN6302', '6302-10']) {
    assert.throws(() => ok({ hsn_code: bad }), (e) => e.fieldErrors?.hsn_code === 'HSN code must be 4, 6 or 8 digits.', bad);
  }
  for (const [input, out] of [['0', 0], ['5', 5], ['12', 12], ['18', 18], ['2.5', 2.5], ['100', 100], ['', null], [null, null]]) assert.equal(ok({ gst_rate: input }).gst_rate, out, String(input));
  for (const bad of ['-1', '100.01', '101', 'abc']) {
    assert.throws(() => ok({ gst_rate: bad }), (e) => e.fieldErrors?.gst_rate === 'GST rate must be a number from 0 to 100, or blank.', bad);
  }
  assert.ok(rules.PRODUCT_EDITABLE_FIELDS.includes('hsn_code') && rules.PRODUCT_EDITABLE_FIELDS.includes('gst_rate'), 'both are covered by the stale-write guard');
});

await test('the editor saves HSN and GST to the product row, clears them when emptied, and errors sit beside them', async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
  const form = () => formOf(handle.tree, 'Linen Shirt');
  await handle.act(() => change(fieldByLabel(form(), 'HSN code (optional)').control, '6205 20'));
  await handle.act(() => change(fieldByLabel(form(), 'GST rate % (optional)').control, '5'));
  await handle.act(() => submit(form()));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').hsn_code, '620520');
  assert.equal(row(store, 'catalogue_products', 'fp-linen').gst_rate, 5);
  await handle.act(() => change(fieldByLabel(form(), 'HSN code (optional)').control, '62052'));
  await handle.act(() => change(fieldByLabel(form(), 'GST rate % (optional)').control, '118'));
  await handle.act(() => submit(form()));
  assert.equal(fieldByLabel(form(), 'HSN code (optional)').error, 'HSN code must be 4, 6 or 8 digits.');
  assert.equal(fieldByLabel(form(), 'GST rate % (optional)').error, 'GST rate must be a number from 0 to 100, or blank.');
  assert.equal(row(store, 'catalogue_products', 'fp-linen').hsn_code, '620520', 'nothing written');
  await handle.act(() => change(fieldByLabel(form(), 'HSN code (optional)').control, ''));
  await handle.act(() => change(fieldByLabel(form(), 'GST rate % (optional)').control, ''));
  await handle.act(() => submit(form()));
  assert.equal(row(store, 'catalogue_products', 'fp-linen').hsn_code, null);
  assert.equal(row(store, 'catalogue_products', 'fp-linen').gst_rate, null);
});

await test('an existing HSN/GST loads into the editor', async () => {
  const { handle } = await openPage({ params: { store: 'homeliving', productId: 'hp-percale' } });
  const form = formOf(handle.tree, 'Percale Sheet Set');
  assert.equal(fieldByLabel(form, 'HSN code (optional)').control.props.value, '6302');
  assert.equal(fieldByLabel(form, 'GST rate % (optional)').control.props.value, 12);
});

await test('the editor says plainly that the GST rate is recorded, not applied at checkout — per store', async () => {
  for (const [store, productId, label] of [['fashion', 'fp-linen', 'Fashion'], ['homeliving', 'hp-percale', 'Home & Living']]) {
    const { handle } = await openPage({ params: { store, productId } });
    const note = notes(handle.tree).find((t) => /GST rate/.test(t));
    assert.equal(note, `GST rate is recorded, not yet applied at checkout. Checkout still uses the default GST rate for every ${label} line until the HSN audit is complete.`);
  }
  const grocery = await openPage({ params: { store: 'grocery', productId: 'gp-rice' } });
  assert.equal(notes(grocery.handle.tree).find((t) => /GST rate/.test(t)), 'GST rate is recorded only. Grocery cannot be sold yet, so no rate is charged anywhere.');
});

await test('the note is true: checkout still sets gst_rate null on fashion and Home & Living lines', () => {
  const pricing = read('api/_lib/pricing.js');
  const fashion = pricing.slice(pricing.indexOf("catalogue: 'fashion',"), pricing.indexOf("catalogue: 'fashion',") + 900);
  assert.match(fashion, /gst_rate: null,/);
  const hl = pricing.indexOf("if (item.catalogue === 'homeliving')");
  assert.ok(hl > 0);
  assert.match(pricing.slice(hl, hl + 6000), /gst_rate: null,/);
  // And this work did not touch it.
  const changed = execFileSync('git', ['diff', '--name-only', '7c05e7d', '--', 'api/', 'src/lib/store.jsx', 'src/lib/payments.js', 'src/pages/Checkout.jsx', 'src/pages/Cart.jsx'], { cwd: REPO, encoding: 'utf8' }).trim();
  assert.equal(changed, '', 'no pricing, cart, checkout or payment file changed');
});

console.log('\n— Grocery —');

await test('Grocery is a catalogue store: in the picker, in the admin menu, and its rows read and write under store = grocery', async () => {
  const store = createCatalogueDb(catalogueFixtures());
  const { rules, api } = await loadCatalogueAdmin({ supabase: store.supabase });
  assert.deepEqual(Object.keys(rules.CATALOGUE_STORES), ['fashion', 'homeliving', 'grocery']);
  assert.equal(rules.requireCatalogueStore('grocery'), 'grocery');
  const products = await api.listStoreProducts('grocery');
  assert.deepEqual(products.map((p) => p.id), ['gp-rice']);
  const created = await api.saveStoreProduct('grocery', null, { name: 'Toor Dal', category_id: 'gc-atta', mrp: 160, sale_price: 149, net_content: '1 kg', stock: 30, hsn_code: '0713', gst_rate: 0 });
  assert.equal(row(store, 'catalogue_products', created.id).store, 'grocery');
  assert.equal(row(store, 'catalogue_products', created.id).hsn_code, '0713');
  assert.equal(row(store, 'catalogue_products', created.id).gst_rate, 0);
  // A grocery size needs no colour.
  await api.saveStoreVariant('grocery', created.id, null, { size: '5 kg', stock: 3 });
  assert.equal(rules.catalogueProductHref('grocery', 'toor-dal'), null, 'grocery has no product page yet');
  assert.match(read('src/admin/AdminLayout.jsx'), /\{ to: '\/admin\/store-catalogue\/grocery', label: 'Grocery Products' \}/);
  const { handle } = await openPage({ params: { store: 'fashion' } });
  const picker = findAll(handle.tree, (n) => n.type === 'select' && findAll(n, (o) => o.type === 'option' && textOf(o) === 'Grocery').length)[0];
  assert.ok(picker, 'the store picker offers Grocery');
});

await test('every grocery page says it cannot be sold yet and that variants are read nowhere', async () => {
  const list = await openPage({ params: { store: 'grocery' } });
  const banner = notes(list.handle.tree).find((t) => /Not for sale yet/.test(t));
  assert.ok(banner, 'the list carries the banner');
  assert.match(banner, /Grocery cannot be sold yet\. Checkout does not price grocery items/);
  assert.match(banner, /Sizes and variants entered here are not read anywhere yet\./);
  assert.ok(!findAll(list.handle.tree, (n) => n.type === 'a' && textOf(n) === 'View').length, 'no "View" link to a page that does not exist');
  assert.ok(!findAll(list.handle.tree, (n) => n.type === 'a' && /Lifestyle/.test(textOf(n))).length, 'grocery is not part of Lifestyle');

  const editor = await openPage({ params: { store: 'grocery', productId: 'gp-rice' } });
  const all = notes(editor.handle.tree);
  assert.ok(all.some((t) => /Not for sale yet/.test(t)), 'the editor carries the banner too');
  assert.ok(all.includes('Not read anywhere yet: the grocery storefront shows the product only, and ignores these rows.'), 'and the variants section says it');
  assert.ok(fieldByLabel(editor.handle.tree, 'Stock quantity (without variants)'), 'grocery products are stocked at product level');
  assert.ok(fieldByLabel(editor.handle.tree, 'Colour (optional)'), 'a grocery size needs no colour');
  assert.ok(!findAll(editor.handle.tree, (n) => n.type === 'a' && /View product/.test(textOf(n))).length);

  for (const store of ['fashion', 'homeliving']) {
    const other = await openPage({ params: { store } });
    assert.ok(!notes(other.handle.tree).some((t) => /Not for sale yet/.test(t)), `${store} carries no grocery banner`);
  }
});

await test("the notes use the admin's own banner class — not .info, which the storefront's info pages size to 60vh", async () => {
  const { handle } = await openPage({ params: { store: 'grocery', productId: 'gp-rice' } });
  const classes = findAll(handle.tree, (n) => typeof n.props?.className === 'string').map((n) => n.props.className.split(/\s+/));
  assert.ok(!classes.some((c) => c.includes('info')), 'no element of the catalogue page carries the bare class "info"');
  assert.ok(classes.some((c) => c.includes('sc-info')));
  assert.match(read('src/admin/admin.css'), /\.adm-banner\.sc-info \{/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
