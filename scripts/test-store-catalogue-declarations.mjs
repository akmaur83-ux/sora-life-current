// ============================================================
// Store catalogue admin — the 0036 declarations: companies, label fields,
// jewellery (metal, purity, making charges, pricing mode, weights, stones).
//
//   node scripts/test-store-catalogue-declarations.mjs
//
// Offline. The real rules, API, CSV planner and page run against the
// in-memory catalogue in catalogue-admin-harness.mjs, which carries the 0036
// constraints, foreign keys and RLS as PostgREST presents them.
//
// What is pinned:
//   * every 0036 field is read by one rule, in the editor and the importer
//     alike; cross-field problems (purity vs metal, making charges as a pair,
//     net weight over gross) are refused beside their field
//   * a rate-linked product saves as a draft and can never be published —
//     by the editor, the importer or the database — and switching it back to
//     fixed and publishing is one save
//   * a company is typed once and named by many products; it cannot be
//     deleted while a product names it, and the admin is told which
//   * completeness is WARNED, never enforced: a product missing its
//     declarations still saves and publishes
//   * the importer reads companies by name, and imports stones and companies
//   * the editor shows fabric fields for garments and metal, purity, weights
//     and stones for jewellery, and offers only the purities of the metal
// ============================================================
import assert from 'node:assert/strict';
import {
  createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, openPage,
  fieldByLabel, buttonByText, formOf, change, submit, findAll, textOf,
} from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}

// The shared fixtures, plus a Jewellery branch in the fashion store, a ring in
// it (18K gold, one size with its weights) and one company.
function fixtures() {
  const f = catalogueFixtures();
  const cat = (id, name, slug, parent_id = null) => ({ id, store: 'fashion', name, slug, parent_id, tagline: '', image_url: null, sort_order: 5, is_active: true, is_demo: false });
  f.catalogue_categories.push(cat('fc-jewellery', 'Jewellery', 'jewellery'), cat('fc-rings', 'Rings', 'rings', 'fc-jewellery'));
  const linen = f.catalogue_products.find((p) => p.id === 'fp-linen');
  f.catalogue_products.push({ ...linen, id: 'fp-ring', name: 'Solitaire Ring', slug: 'solitaire-ring', sku: 'SL-RING-18K', category_id: 'fc-rings', is_active: false, is_bestseller: false,
    metal: 'gold', purity: 750, pricing_mode: 'fixed', country_of_origin: 'IN', manufacturer_id: 'co-maker' });
  f.catalogue_variants.push({ id: 'fv-ring-12', store: 'fashion', product_id: 'fp-ring', size: '12', colour: 'Yellow gold', colour_hex: null, sku: null, stock: 2, price_override: null, is_active: true, sort_order: 0, is_demo: false, gross_weight_g: 3.2, net_metal_weight_g: 2.9 });
  f.catalogue_parties = [{ id: 'co-maker', name: 'Kanak Jewels Pvt Ltd', address: '4 Zaveri Bazaar, Mumbai, Maharashtra 400002', country: 'IN', phone: '+91 22 0000 0000', email: null, gstin: '27ABCDE1234F1Z5' }];
  f.catalogue_product_stones = [{ id: 'st-dia', product_id: 'fp-ring', stone: 'Diamond', origin: 'lab_grown', shape: 'Round', stone_count: 1, total_carat: 0.5, total_weight_g: null, clarity: 'VS1', colour_grade: 'F', certificate_lab: 'IGI', certificate_no: 'LG123456', sort_order: 0 }];
  return f;
}
async function apiOver(f = fixtures(), opts = {}) {
  const store = createCatalogueDb(f, opts);
  return { store, ...(await loadCatalogueAdmin({ supabase: store.supabase })) };
}
const row = (store, table, id) => store.db()[table].find((r) => r.id === id);
const fieldErrors = (fn) => { try { fn(); } catch (e) { return e.fieldErrors || { error: e.message }; } return {}; };
const rejectsWith = async (promise) => { try { await promise; } catch (e) { return e; } assert.fail('expected a refusal'); };

console.log('\n— The rules —');

await test('each 0036 field reads one way: codes upper-cased, fit and metal from their lists, percentages that add to 100', async () => {
  const { rules } = await apiOver();
  const cats = fixtures().catalogue_categories.filter((c) => c.store === 'fashion');
  const base = { name: 'Kurta', category_id: 'fc-shirts', mrp: 999 };
  const row = rules.catalogueProductPayload({ ...base, country_of_origin: ' in ', fit: 'slim', material: '60% cotton, 40% polyester', generic_name: 'Kurta' }, cats);
  assert.equal(row.country_of_origin, 'IN'); assert.equal(row.fit, 'Slim'); assert.equal(row.pricing_mode, 'fixed');
  assert.equal(row.metal, null); assert.equal(row.purity, null); assert.equal(row.manufacturer_id, null);
  const errors = fieldErrors(() => rules.catalogueProductPayload({ ...base, country_of_origin: 'India', fit: 'Baggy', material: '60% cotton, 30% polyester' }, cats));
  assert.match(errors.country_of_origin, /2-letter code/);
  assert.match(errors.fit, /Fit must be one of Regular, Slim/);
  assert.match(errors.material, /add up to 90%, not 100%/);
});

await test('purity belongs to its metal; making charges are a pair; a percentage stops at 100', async () => {
  const { rules } = await apiOver();
  const cats = fixtures().catalogue_categories.filter((c) => c.store === 'fashion');
  const base = { name: 'Ring', category_id: 'fc-rings', mrp: 25000 };
  assert.equal(rules.catalogueProductPayload({ ...base, metal: 'Gold', purity: '916' }, cats).purity, 916);
  assert.match(fieldErrors(() => rules.catalogueProductPayload({ ...base, metal: 'gold', purity: 925 }, cats)).purity, /925 is not a gold grade\. Use 375 \(9K\)/);
  assert.match(fieldErrors(() => rules.catalogueProductPayload({ ...base, metal: 'brass', purity: 925 }, cats)).purity, /only for gold, silver and platinum, not brass/);
  assert.match(fieldErrors(() => rules.catalogueProductPayload({ ...base, purity: 925 }, cats)).purity, /choose the metal first/);
  assert.match(fieldErrors(() => rules.catalogueProductPayload({ ...base, metal: 'silver', making_charge_type: 'flat' }, cats)).making_charge_value, /both a type and a value/);
  assert.match(fieldErrors(() => rules.catalogueProductPayload({ ...base, metal: 'silver', making_charge_type: 'percent', making_charge_value: 120 }, cats)).making_charge_value, /cannot be over 100/);
  const priced = rules.catalogueProductPayload({ ...base, metal: 'silver', purity: 925, making_charge_type: 'per_gram', making_charge_value: '450' }, cats);
  assert.equal(priced.making_charge_type, 'per_gram'); assert.equal(priced.making_charge_value, 450);
  // declarationErrors lists the same problems on their own, for the pre-import validator.
  assert.deepEqual(Object.keys(rules.declarationErrors({ metal: 'gold', purity: 925, making_charge_type: 'flat', manufacturer_id: 'nope' }, [])).sort(), ['making_charge_value', 'manufacturer_id', 'purity']);
  assert.deepEqual(rules.declarationErrors({ metal: 'gold', purity: 916 }, []), {});
});

await test('weights: grams above 0, three decimals, the net metal never over the gross', async () => {
  const { rules } = await apiOver();
  const v = rules.catalogueVariantPayload({ size: '12', colour: 'Gold', stock: 1, gross_weight_g: '3.2504', net_metal_weight_g: '2.9' }, 'fashion');
  assert.equal(v.gross_weight_g, 3.25); assert.equal(v.net_metal_weight_g, 2.9);
  assert.match(fieldErrors(() => rules.catalogueVariantPayload({ size: '12', colour: 'Gold', stock: 1, gross_weight_g: 2, net_metal_weight_g: 3 }, 'fashion')).net_metal_weight_g, /cannot be more than the gross weight/);
  assert.match(fieldErrors(() => rules.catalogueVariantPayload({ size: '12', colour: 'Gold', stock: 1, gross_weight_g: 0 }, 'fashion')).gross_weight_g, /above 0/);
  const plain = rules.catalogueVariantPayload({ size: 'M', colour: 'Sage', stock: 1 }, 'fashion');
  assert.equal(plain.gross_weight_g, null); assert.equal(plain.net_metal_weight_g, null);
});

await test('stones and companies: origin always said, a certificate is a lab and a number, a company once', async () => {
  const { rules } = await apiOver();
  const stone = fieldErrors(() => rules.catalogueStonePayload({ stone: '', origin: 'real', stone_count: 0, certificate_lab: 'IGI' }));
  assert.match(stone.stone, /Name the stone/); assert.match(stone.origin, /natural, lab_grown or simulant/);
  assert.match(stone.stone_count, /whole number, 1 or more/); assert.match(stone.certificate_no, /both its lab and its number/);
  assert.equal(rules.catalogueStonePayload({ stone: 'Ruby', origin: 'natural', stone_count: '3', total_carat: '0.3' }).total_carat, 0.3);
  const parties = fixtures().catalogue_parties;
  const company = fieldErrors(() => rules.cataloguePartyPayload({ name: 'kanak jewels pvt ltd', address: '', country: 'india', email: 'nope', gstin: '27abcde' }, parties));
  assert.match(company.name, /already has this name/); assert.match(company.address, /as it is printed/);
  assert.match(company.country, /2-letter/); assert.match(company.email, /name@domain/); assert.match(company.gstin, /15 characters/);
  assert.deepEqual(rules.cataloguePartyPayload({ name: 'Kanak Jewels Pvt Ltd', address: 'Mumbai', gstin: '27abcde1234f1z5' }, parties, 'co-maker'),
    { name: 'Kanak Jewels Pvt Ltd', address: 'Mumbai', country: 'IN', phone: null, email: null, gstin: '27ABCDE1234F1Z5' });
});

await test('completeness is a warning list — garments, jewellery and imports each ask for their own', async () => {
  const { rules } = await apiOver();
  const labels = (product, opts) => rules.declarationWarnings(product, opts).map((w) => w.label);
  assert.deepEqual(labels({}, { store: 'fashion' }), ['country of origin', 'manufacturer', 'net quantity', 'material', 'care instructions']);
  assert.deepEqual(labels({ country_of_origin: 'CN', manufacturer_id: 'x', net_content: '1 piece', material: '100% cotton', care: 'Hand wash' }, { store: 'fashion' }), ['importer (it is made outside India)']);
  assert.deepEqual(labels({ country_of_origin: 'IN', manufacturer_id: 'x', net_content: '1 piece', metal: 'gold', variants: [{ is_active: true, gross_weight_g: 3 }] }, { store: 'fashion', jewellery: true }),
    ['purity', 'gross and net weight on every size']);
  assert.deepEqual(labels({ country_of_origin: 'IN', manufacturer_id: 'x', net_content: '1 piece', metal: 'brass', variants: [] }, { store: 'fashion', jewellery: true }), []);
  assert.deepEqual(labels({ country_of_origin: 'IN', manufacturer_id: 'x', net_content: 'Set of 2' }, { store: 'homeliving' }), []);
});

console.log('\n— The API over the 0036 tables —');

await test('a missing-declarations product still saves and publishes: completeness is never enforced', async () => {
  const { api, store } = await apiOver();
  const p = await api.getStoreProduct('fashion', 'fp-linen');
  assert.equal(p.country_of_origin ?? null, null);
  const saved = await api.saveStoreProduct('fashion', 'fp-linen', { ...p, is_active: true, description: 'Still fine.' }, p.updated_at);
  assert.equal(saved.is_active, true);
  assert.equal(row(store, 'catalogue_products', 'fp-linen').description, 'Still fine.');
});

await test('a rate-linked product saves as a draft, is refused when published — and switching to fixed publishes in one save', async () => {
  const { api, store } = await apiOver();
  let p = await api.getStoreProduct('fashion', 'fp-ring');
  p = await api.saveStoreProduct('fashion', 'fp-ring', { ...p, pricing_mode: 'rate_linked' }, p.updated_at);
  assert.equal(row(store, 'catalogue_products', 'fp-ring').pricing_mode, 'rate_linked');
  const refused = await rejectsWith(api.saveStoreProduct('fashion', 'fp-ring', { ...p, is_active: true }, p.updated_at));
  assert.match(refused.fieldErrors?.pricing_mode || '', /cannot go live yet/);
  assert.equal(row(store, 'catalogue_products', 'fp-ring').is_active, false);
  const live = await api.saveStoreProduct('fashion', 'fp-ring', { ...p, pricing_mode: 'fixed', is_active: true }, p.updated_at);
  assert.equal(live.is_active, true); assert.equal(live.pricing_mode, 'fixed');
});

await test('the database is the backstop: its 0036 refusals reach the admin as field errors, never raw', async () => {
  const { api, rules, store } = await apiOver();
  // A write that skipped the rules (an old client) is refused by the constraint, translated.
  const { error } = await store.supabase.from('catalogue_products').update({ pricing_mode: 'rate_linked', is_active: true }).eq('id', 'fp-linen').select();
  assert.match(error.message, /catalogue_products_rate_linked_live_chk/);
  assert.match(rules.catalogueWriteError(error, 'product').fieldErrors.pricing_mode, /cannot go live yet/);
  const weights = await store.supabase.from('catalogue_variants').update({ gross_weight_g: 2, net_metal_weight_g: 3 }).eq('id', 'fv-ring-12').select();
  assert.match(rules.catalogueWriteError(weights.error, 'variant').fieldErrors.net_metal_weight_g, /net metal weight cannot be more/);
  const party = await store.supabase.from('catalogue_products').update({ manufacturer_id: 'gone' }).eq('id', 'fp-linen').select();
  assert.equal(party.error.code, '23503');
  assert.match(rules.catalogueWriteError(party.error, 'product').fieldErrors.manufacturer_id, /no longer in the Companies list/);
  const p = await api.getStoreProduct('fashion', 'fp-linen');
  const named = await rejectsWith(api.saveStoreProduct('fashion', 'fp-linen', { ...p, manufacturer_id: 'gone' }, p.updated_at));
  assert.match(named.fieldErrors.manufacturer_id, /choose a company from the Companies list/);
});

await test('companies: add, edit under the version guard, and no delete while a product names one', async () => {
  const { api, store } = await apiOver();
  const added = await api.saveStoreParty(null, { name: 'Weave Works', address: 'Panipat, Haryana 132103', email: 'care@weave.example' });
  assert.equal(added.country, 'IN');
  await assert.rejects(api.saveStoreParty(null, { name: 'WEAVE WORKS', address: 'Elsewhere' }), (e) => /already has this name/.test(e.fieldErrors?.name || ''));
  const edited = await api.saveStoreParty(added.id, { ...added, phone: '+91 180 000 0000' }, added.updated_at);
  assert.equal(edited.phone, '+91 180 000 0000');
  await assert.rejects(api.saveStoreParty(added.id, { ...added, phone: 'stale' }, added.updated_at), (e) => e.isStaleWrite);
  const blocked = await rejectsWith(api.deleteStoreParty('co-maker', row(store, 'catalogue_parties', 'co-maker').updated_at));
  assert.match(blocked.message, /named on 1 product \(“Solitaire Ring”\)\. Choose another company on it first\./);
  assert.ok(row(store, 'catalogue_parties', 'co-maker'), 'still there');
  await api.deleteStoreParty(added.id, edited.updated_at);
  assert.equal(row(store, 'catalogue_parties', added.id), undefined);
  // Read by anyone: the product page prints the manufacturer.
  const anon = createCatalogueDb(fixtures(), { admin: false });
  assert.equal((await anon.supabase.from('catalogue_parties').select('*')).data.length, 1);
});

await test('stones: added, edited and deleted on their product, and gone with it', async () => {
  const { api, store } = await apiOver();
  const ruby = await api.saveStoreStone('fashion', 'fp-ring', null, { stone: 'Ruby', origin: 'natural', stone_count: 2, total_carat: '0.2' });
  assert.equal(ruby.product_id, 'fp-ring');
  const fresh = await api.getStoreProduct('fashion', 'fp-ring');
  assert.deepEqual(fresh.stones.map((s) => s.stone).sort(), ['Diamond', 'Ruby']);
  const edited = await api.saveStoreStone('fashion', 'fp-ring', ruby.id, { ...ruby, stone_count: 3 }, ruby.updated_at);
  assert.equal(edited.stone_count, 3);
  await assert.rejects(api.saveStoreStone('fashion', 'fp-ring', ruby.id, { ...ruby, origin: '' }, edited.updated_at), (e) => /natural, lab_grown or simulant/.test(e.fieldErrors?.origin || ''));
  await api.deleteStoreStone('fashion', 'fp-ring', ruby.id, edited.updated_at);
  assert.equal(row(store, 'catalogue_product_stones', ruby.id), undefined);
  await store.supabase.from('catalogue_products').delete().eq('id', 'fp-ring').select('id');
  assert.equal(store.db().catalogue_product_stones.length, 0, 'on delete cascade');
});

console.log('\n— The importer —');

await test('products name companies by name; an unknown company skips the row and says where to add it', async () => {
  const { api, csv } = await apiOver();
  const [products, categories, parties] = await Promise.all([api.listStoreProducts('fashion'), api.listStoreCategories('fashion'), api.listStoreParties()]);
  const exported = csv.productsToCsv(products, categories, parties);
  assert.match(exported.split('\n')[0], /country_of_origin,generic_name,manufacturer,packer,importer,material,care,fit,metal,purity,making_charge_type,making_charge_value,pricing_mode/);
  assert.ok(exported.includes('Kanak Jewels Pvt Ltd'), 'the export writes the company name, not its id');
  const file = 'slug,manufacturer,country_of_origin,material\nlinen-shirt,kanak jewels pvt ltd,in,100% linen\nwrap-dress,Nobody & Co,IN,\n';
  const plan = csv.planProductImport(file, { store: 'fashion', products, categories, parties });
  assert.deepEqual(plan.ignored, []);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].input.manufacturer_id, 'co-maker'); assert.equal(plan.changes[0].input.country_of_origin, 'IN');
  assert.ok(plan.changes[0].diffs.map((d) => csv.describeDiff(d, categories, parties)).includes('Manufacturer: (empty) → Kanak Jewels Pvt Ltd'));
  assert.match(plan.skipped[0].reason, /Manufacturer “Nobody & Co” is not in the Companies list — add it on the Companies tab/);
  const bad = csv.planProductImport('slug,metal,purity\nsolitaire-ring,gold,925\n', { store: 'fashion', products, categories, parties, overwrite: true });
  assert.match(bad.skipped[0].reason, /925 is not a gold grade/);
});

await test('stones and companies import through the same plan-then-apply, matched on their keys', async () => {
  const { api, csv, store } = await apiOver();
  const products = await api.listStoreProducts('fashion'), parties = await api.listStoreParties();
  assert.match(csv.stonesToCsv(products), /solitaire-ring,Diamond,lab_grown,Round,1,0.5/);
  const stones = csv.planStoneImport('product_slug,stone,shape,origin,stone_count,total_carat\nsolitaire-ring,Diamond,Round,,,0.6\nsolitaire-ring,Sapphire,Oval,natural,2,0.4\nno-such,Ruby,,natural,1,\n',
    { store: 'fashion', products, overwrite: true, create: true });
  assert.deepEqual(stones.changes.map((c) => [c.kind, c.label]), [['update', 'solitaire-ring · Diamond (Round)'], ['create', 'solitaire-ring · Sapphire (Oval)']]);
  assert.match(stones.skipped[0].reason, /No Fashion product has the slug "no-such"/);
  const applied = await api.applyCatalogueImport('fashion', stones);
  assert.equal(applied.failed.length, 0);
  assert.deepEqual(store.db().catalogue_product_stones.map((s) => [s.stone, s.total_carat]).sort(), [['Diamond', 0.6], ['Sapphire', 0.4]]);
  const companies = csv.planCompanyImport('name,address,country,gstin\nKanak Jewels Pvt Ltd,,,\nWeave Works,"Panipat, Haryana 132103",in,\n', { parties, create: true });
  assert.deepEqual(companies.changes.map((c) => [c.kind, c.name]), [['create', 'Weave Works']]);
  assert.equal(companies.changes[0].input.country, 'IN');
  await api.applyCatalogueImport('fashion', companies);
  assert.ok(store.db().catalogue_parties.some((p) => p.name === 'Weave Works'));
});

console.log('\n— The editor —');

const label = (handle, text) => fieldByLabel(handle.tree, text);
await test('a garment shows Fabric & fit; a jewellery piece shows metal, purity of that metal, weights and stones', async () => {
  const garment = await openPage({ params: { store: 'fashion', productId: 'fp-linen' }, fixtures: fixtures() });
  for (const l of ['Country of origin', 'Generic name', 'Manufacturer', 'Material', 'Care instructions', 'Fit (optional)']) assert.ok(label(garment.handle, l), l);
  for (const l of ['Metal', 'Purity', 'Gross weight (g)']) assert.equal(label(garment.handle, l), null, l);
  assert.ok(!garment.handle.text().includes('Stones'));

  const ring = await openPage({ params: { store: 'fashion', productId: 'fp-ring' }, fixtures: fixtures() });
  assert.equal(label(ring.handle, 'Material'), null);
  const purity = () => label(ring.handle, 'Purity').control;
  const options = () => findAll(purity(), (n) => n.type === 'option').map((o) => o.props.value);
  assert.deepEqual(options(), ['', '375', '585', '750', '833', '916', '958', '995', '999']);
  assert.equal(String(purity().props.value), '750');
  assert.equal(label(ring.handle, 'Manufacturer').control.props.value, 'co-maker');
  assert.ok(label(ring.handle, 'Gross weight (g)') && label(ring.handle, 'Net metal weight (g)'));
  assert.ok(ring.handle.text().includes('3.2 g / 2.9 g'), 'the size table shows its weights');
  assert.ok(formOf(ring.handle.tree, 'Add stone'), 'the stones panel');
  assert.ok(ring.handle.text().includes('Diamond (Round)') && ring.handle.text().includes('IGI LG123456'));
  // A metal without that grade drops it; brass has no purity at all.
  await ring.handle.act(() => change(label(ring.handle, 'Metal').control, 'silver'));
  assert.equal(String(purity().props.value), '');
  assert.deepEqual(options(), ['', '800', '835', '900', '925', '970', '990', '999']);
  await ring.handle.act(() => change(label(ring.handle, 'Metal').control, 'brass'));
  assert.equal(purity().props.disabled, true);
});

await test('the editor warns what a listing still lacks, and saves anyway', async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-linen' }, fixtures: fixtures() });
  assert.match(handle.text(), /Live without:.*country of origin, manufacturer, net quantity, material, care instructions\. A reminder, not a block/);
  await handle.act(() => change(label(handle, 'Country of origin').control, 'pt'));
  await handle.act(() => change(label(handle, 'Manufacturer').control, 'co-maker'));
  await handle.act(() => change(label(handle, 'Material').control, '100% linen'));
  await handle.act(() => submit(formOf(handle.tree, 'Linen Shirt')));
  const saved = row(store, 'catalogue_products', 'fp-linen');
  assert.equal(saved.country_of_origin, 'PT'); assert.equal(saved.manufacturer_id, 'co-maker'); assert.equal(saved.material, '100% linen');
  assert.match(handle.text(), /Live without:.*importer \(it is made outside India\), net quantity, care instructions/);
});

await test('a rate-linked draft says why it cannot go live, beside the field', async () => {
  const { handle, store } = await openPage({ params: { store: 'fashion', productId: 'fp-ring' }, fixtures: fixtures() });
  await handle.act(() => change(label(handle, 'Pricing').control, 'rate_linked'));
  assert.match(textOf(label(handle, 'Pricing').wrap), /cannot go live yet/);
  const publish = findAll(handle.tree, (n) => n.type === 'label' && textOf(n) === 'Published / visible to customers')[0];
  await handle.act(() => findAll(publish, (n) => n.type === 'input')[0].props.onChange({ target: { checked: true } }));
  await handle.act(() => submit(formOf(handle.tree, 'Solitaire Ring')));
  assert.match(label(handle, 'Pricing').error || '', /cannot go live yet/);
  assert.equal(row(store, 'catalogue_products', 'fp-ring').is_active, false);
});

await test('the Companies tab adds a company and refuses to delete one a product names', async () => {
  const { handle, store, win } = await openPage({ params: { store: 'fashion' }, search: 'tab=companies', fixtures: fixtures() });
  assert.ok(handle.text().includes('Kanak Jewels Pvt Ltd'));
  await handle.act(() => buttonByText(handle.tree, '+ Add company').props.onClick());
  const form = () => formOf(handle.tree, 'Add company');
  await handle.act(() => change(fieldByLabel(form(), 'Company name').control, 'Weave Works'));
  await handle.act(() => submit(form()));
  assert.match(fieldByLabel(form(), 'Address').error, /as it is printed/);
  await handle.act(() => change(fieldByLabel(form(), 'Address').control, 'Panipat, Haryana 132103'));
  await handle.act(() => submit(form()));
  assert.ok(store.db().catalogue_parties.some((p) => p.name === 'Weave Works'));
  assert.match(handle.text(), /Weave Works saved\./);
  const kanak = findAll(handle.tree, (n) => n.type === 'tr' && textOf(n).startsWith('Kanak Jewels'))[0];
  await handle.act(() => buttonByText(kanak, 'Delete').props.onClick());
  assert.match(win.asked.at(-1), /Delete Kanak Jewels Pvt Ltd/);
  assert.match(handle.text(), /named on 1 product/);
  assert.ok(store.db().catalogue_parties.some((p) => p.id === 'co-maker'));
});

await test('the importer offers stones in the fashion store only, and companies everywhere', async () => {
  const chips = async (s) => {
    const { handle } = await openPage({ params: { store: s }, search: 'tab=import', fixtures: fixtures() });
    return findAll(handle.tree, (n) => n.type === 'button' && /adm-chip/.test(n.props.className || '') && n.props['aria-pressed'] !== undefined).map((n) => textOf(n));
  };
  assert.deepEqual(await chips('fashion'), ['Products', 'Sizes & colours (variants)', 'Stones (jewellery)', 'Companies']);
  assert.deepEqual(await chips('homeliving'), ['Products', 'Sizes & colours (variants)', 'Companies']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
