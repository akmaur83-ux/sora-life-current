// ============================================================
// Store catalogue admin — claim warnings (warn, never block).
//
//   node scripts/test-store-catalogue-claims.mjs
//
// Pinned:
//   * the medical vocabulary still contains every term the Biosash ingest
//     screen uses (scripts/ingest-biosash-content.mjs), matched the same way
//     — whole words, any case, an optional plural
//   * speed claims (delivery promises, "instant results") and sustainability
//     claims (eco, organic, recycled, carbon neutral…) are caught; ordinary
//     copy is not
//   * a save with a claim in it SAVES, then says what it found and where; a
//     new draft carries its warnings to the editor it opens; a CSV plan marks
//     the rows and still applies them
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, openPage,
  fieldByLabel, formOf, change, submit, findAll, textOf, buttonByText,
} from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
const mods = async () => loadCatalogueAdmin({ supabase: createCatalogueDb(catalogueFixtures()).supabase });
const terms = (warnings) => warnings.map((w) => [w.kind, w.term]);

console.log('\n— The screen —');

await test('the medical list is the Biosash ingest screen\'s, term for term', async () => {
  const { claims } = await mods();
  const script = readFileSync(fileURLToPath(new URL('./ingest-biosash-content.mjs', import.meta.url)), 'utf8');
  const list = (name) => {
    const body = script.slice(script.indexOf(`const ${name} = [`) + `const ${name} = [`.length);
    return [...body.slice(0, body.indexOf('];')).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  };
  const ingest = [...list('DISEASE_TERMS'), ...list('TREATMENT_TERMS')];
  assert.ok(ingest.length > 80, `read ${ingest.length} terms from the ingest script`);
  const missing = ingest.filter((t) => !claims.MEDICAL_TERMS.includes(t));
  assert.deepEqual(missing, [], 'every ingest term is screened here');
});

await test('medical and treatment claims: whole words, any case, plurals; "manicure" and "secure" are not "cure"', async () => {
  const { claims } = await mods();
  assert.deepEqual(terms(claims.claimWarnings('This balm CURES dry skin and is clinically proven.')), [['medical', 'cures'], ['medical', 'clinically proven']]);
  assert.deepEqual(terms(claims.claimWarnings('Protects against infections; treatment of joint pain.')), [['medical', 'infections'], ['medical', 'treatment of']]);
  assert.deepEqual(claims.claimWarnings('A secure, manicured finish; treatments-free fabric; reheats well.'), []);
});

await test('speed claims — including the live fashion strip\'s "Fast & reliable delivery"', async () => {
  const { claims } = await mods();
  const cases = [
    ['Fast & reliable delivery on every order.', 'fast & reliable delivery'], ['Express shipping across India.', 'express shipping'],
    ['Same-day dispatch in Mumbai.', 'same-day'], ['Next day delivery.', 'next day'], ['Delivered within 2 days.', 'delivered within 2 days'],
    ['Ships today if ordered by noon.', 'ships today'], ['Arrives within 24 hours.', 'within 24 hours'], ['Instant results.', 'instant results'],
    ['Visible results in 7 days.', 'results in 7 days'],
  ];
  for (const [text, term] of cases) assert.deepEqual(terms(claims.claimWarnings(text)), [['speed', term]], text);
  assert.deepEqual(claims.claimWarnings('Quick-dry cotton. Fast colours that do not run.'), [], 'a fabric property is not a delivery promise');
});

await test('sustainability claims; ordinary colour and fabric words are not', async () => {
  const { claims } = await mods();
  assert.deepEqual(terms(claims.claimWarnings('An eco-friendly, ORGANIC cotton set, sustainably made from recycled fibres. Carbon neutral shipping.')),
    [['sustainability', 'eco-friendly'], ['sustainability', 'organic'], ['sustainability', 'sustainably'], ['sustainability', 'recycled'], ['sustainability', 'carbon neutral']]);
  assert.deepEqual(claims.claimWarnings('Soft percale weave in sage green. Natural-feel cotton. Machine wash cold.'), []);
});

await test('each warning names its field and shows the words around it', async () => {
  const { claims } = await mods();
  const w = claims.productClaimWarnings({ name: 'Organic Percale Set', description: 'A crisp weave that our customers say cures restless nights and arrives same day in metro cities.' });
  assert.deepEqual(w.map((x) => [x.field, x.kind, x.term]), [['name', 'sustainability', 'organic'], ['description', 'medical', 'cures'], ['description', 'speed', 'same day']]);
  assert.equal(w[1].excerpt, '…weave that our customers say cures restless nights and arrives…');
  assert.deepEqual(claims.productClaimWarnings({ name: '', description: null }), []);
});

console.log('\n— Warn, never block —');

await test('the editor saves a description with claims, then lists what it found', async () => {
  const { handle, store } = await openPage({ params: { store: 'homeliving', productId: 'hp-percale' } });
  const form = () => formOf(handle.tree, 'Percale Sheet Set');
  await handle.act(() => change(fieldByLabel(form(), 'Description').control, 'Eco-friendly organic percale. Fast delivery. Heals tired backs.'));
  await handle.act(() => submit(form()));
  assert.equal(store.db().catalogue_products.find((p) => p.id === 'hp-percale').description, 'Eco-friendly organic percale. Fast delivery. Heals tired backs.', 'saved — not blocked');
  const notice = findAll(handle.tree, (n) => /sc-claims/.test(n.props?.className || '') && n.props?.role === 'status')[0];
  assert.ok(notice, 'a warning is shown');
  const text = textOf(notice);
  assert.match(text, /^Saved — check this copy before customers read it\./);
  assert.match(text, /This is a warning, not a block/);
  for (const line of ['Sustainability claim in description: “eco-friendly”', 'Sustainability claim in description: “organic”', 'Speed claim in description: “fast delivery”', 'Medical or treatment claim in description: “heals”']) assert.ok(text.includes(line), line);
  // A clean save clears it.
  await handle.act(() => change(fieldByLabel(form(), 'Description').control, 'Crisp cotton percale.'));
  await handle.act(() => submit(form()));
  assert.ok(!findAll(handle.tree, (n) => /sc-claims/.test(n.props?.className || '')).length);
});

await test('a new draft carries its warnings into the editor it opens', async () => {
  const { handle, router, store } = await openPage({ params: { store: 'fashion', productId: 'new' } });
  const form = () => formOf(handle.tree, 'Add product');
  await handle.act(() => change(fieldByLabel(form(), 'Product name').control, 'Organic Linen Kurta'));
  await handle.act(() => fieldByLabel(form(), 'Category / subcategory').control.props.onChange({ target: { value: 'fc-shirts' } }));
  await handle.act(() => change(fieldByLabel(form(), 'MRP ₹').control, '1999'));
  await handle.act(() => submit(form()));
  const created = store.db().catalogue_products.find((p) => p.slug === 'organic-linen-kurta');
  assert.ok(created && created.is_active === false, 'created as a draft');
  const [to, opts] = router.navigations[0];
  assert.equal(to, `/admin/store-catalogue/fashion/${created.id}`);
  assert.deepEqual(opts.state.claimWarnings.map((w) => [w.field, w.term]), [['name', 'organic']]);
  // The editor it opens shows them.
  const opened = await openPage({ params: { store: 'fashion', productId: 'fp-linen' }, deps: { useLocation: () => ({ state: opts.state }) } });
  assert.match(textOf(findAll(opened.handle.tree, (n) => /sc-claims/.test(n.props?.className || ''))[0]), /Sustainability claim in name: “organic”/);
});

await test('a CSV plan marks rows whose copy carries a claim, and still applies them', async () => {
  const { handle, store, win } = await openPage({ params: { store: 'homeliving' }, search: 'tab=import' });
  const input = findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'file')[0];
  const text = 'slug,description\npercale-sheet-set,"Our sustainable percale, delivered within 2 days."\n';
  await handle.act(() => input.props.onChange({ target: { files: [{ name: 'copy.csv', text: async () => text }], value: '' } }));
  await handle.act(() => findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }));
  assert.match(handle.text(), /1 to update · 0 to create · 0 kept by fill-only · 0 skipped · 1 with claim warnings/);
  const row = findAll(handle.tree, (n) => /sc-claims--row/.test(n.props?.className || ''))[0];
  assert.match(textOf(row), /^Check before applying \(a warning, not a block\):/);
  assert.match(textOf(row), /Sustainability claim in description: “sustainable”/);
  assert.match(textOf(row), /Speed claim in description: “delivered within 2 days”/);
  win.answer = true;
  await handle.act(() => buttonByText(handle.tree, 'Apply 1 change').props.onClick());
  assert.equal(store.db().catalogue_products.find((p) => p.id === 'hp-percale').description, 'Our sustainable percale, delivered within 2 days.');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
