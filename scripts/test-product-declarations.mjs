// ============================================================
// Product information and consumer care — offline suite.
//
//   node scripts/test-product-declarations.mjs
//
// The product pages show what a listing declares (migration 0036), and every
// store's footer shows the consumer-care contact. Pinned here:
//   * only recorded values become rows — nothing is invented, a missing value
//     is a missing row, a listing that declares nothing shows no section
//   * jewellery reads as a label does: "18K gold (750)", the chosen size's
//     gross and net weight (or that they differ by size), each stone with its
//     origin said; the companies with their addresses
//   * the declarations are read on their own, after the page renders, under
//     public RLS — a draft's are not readable, a failed read hides the
//     section, and the catalogue read the store pages are built from is not
//     touched (a server render is byte-identical: the section is not there)
//   * consumer care: the Contact & help page's name, address, phone, email and
//     hours, each only when set, in every store's footer and beside the
//     declarations; one read of that page per visit
//   * the storefront carries none of the admin's rules: the label tables are
//     copies, pinned equal to the admin's
// NO NETWORK, NO DATABASE (the in-memory catalogue of catalogue-admin-harness.mjs).
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCatalogueDb, catalogueFixtures, loadModule as loadWithHooks, mount, findAll, textOf } from './catalogue-admin-harness.mjs';
import { loadModule as loadForServer } from './fashion-ssr.mjs';
import * as decl from '../src/lib/productDeclarations.js';
import { PURITY, METAL_LABELS, STONE_ORIGIN_LABELS } from '../src/lib/storeCatalogueAdmin.js';
import { companyInfo, hasContactChannel, socialLinks, telHref } from '../src/lib/company.js';

const h = React.createElement;
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
const rows = (d, opts) => decl.declarationRows(d, opts).map((r) => [r.label, r.value]);

const KANAK = { name: 'Kanak Jewels Pvt Ltd', address: '4 Zaveri Bazaar, Mumbai, Maharashtra 400002', country: 'IN' };
const RING = {
  id: 'fp-ring', net_content: '1 N', country_of_origin: 'IN', generic_name: 'Ring', metal: 'gold', purity: 750,
  manufacturer: KANAK, packer: null, importer: null, material: null, care: null, fit: null,
  stones: [
    { stone: 'ruby', origin: 'natural', shape: 'oval', stone_count: 2, total_carat: 0.4, sort_order: 2 },
    { stone: 'diamond', origin: 'lab_grown', shape: 'round', stone_count: 1, total_carat: 0.25, clarity: 'VS1', colour_grade: 'F', certificate_lab: 'IGI', certificate_no: 'LG123', sort_order: 1 },
  ],
  weights: [
    { id: 'v12', gross_weight_g: 3.25, net_metal_weight_g: 3.1, is_active: true },
    { id: 'v14', gross_weight_g: 3.4, net_metal_weight_g: 3.25, is_active: true },
    { id: 'v16', gross_weight_g: null, net_metal_weight_g: null, is_active: true },
  ],
};

console.log('\n— The rows —');

await test('a garment reads as its label: generic name, net quantity, country by name, material, fit, care, the maker with its address', () => {
  const shirt = { generic_name: 'Shirt', net_content: '1 N', country_of_origin: 'BD', material: '100% linen', fit: 'Relaxed', care: 'Machine wash cold; dry in shade',
    manufacturer: { name: 'Weave Works', address: 'Plot 4, EPZ, Dhaka', country: 'BD' }, importer: { name: 'SORA LIFE Retail', address: 'Pune, Maharashtra 411001', country: 'IN' }, weights: [], stones: [] };
  assert.deepEqual(rows(shirt), [
    ['Generic name', 'Shirt'], ['Net quantity', '1 N'], ['Country of origin', 'Bangladesh'], ['Material', '100% linen'], ['Fit', 'Relaxed'],
    ['Care', 'Machine wash cold; dry in shade'], ['Manufactured by', 'Weave Works, Plot 4, EPZ, Dhaka, Bangladesh'], ['Imported by', 'SORA LIFE Retail, Pune, Maharashtra 411001'],
  ]);
  assert.deepEqual(rows(shirt, { netQuantity: false }).map(([l]) => l).includes('Net quantity'), false, 'Home & Living shows it as Size already');
});

await test('nothing is invented: unset values are absent rows, and a listing that declares nothing has none', () => {
  assert.deepEqual(rows(null), []);
  assert.deepEqual(rows({ id: 'x', generic_name: '  ', country_of_origin: 'India', metal: 'other', manufacturer: { name: '' }, stones: [{ stone: '' }], weights: [{ id: 'a', is_active: true }] }), []);
  assert.equal(decl.countryName('IN'), 'India'); assert.equal(decl.countryName('in'), 'India'); assert.equal(decl.countryName('Indiaa'), '');
});

await test('jewellery: the metal as a grade, the chosen size\'s weights (or that sizes differ), each stone with its origin, in order', () => {
  assert.equal(decl.metalText('gold', 750), '18K gold (750)'); assert.equal(decl.metalText('gold', 916), '22K gold (916)');
  assert.equal(decl.metalText('silver', 925), 'Sterling silver (925)'); assert.equal(decl.metalText('silver', 999), 'Fine silver (999)');
  assert.equal(decl.metalText('platinum', '950'), 'Platinum (950)'); assert.equal(decl.metalText('gold_plated', null), 'Gold plated');
  assert.equal(decl.metalText('gold', 925), 'Gold', 'a grade the metal does not have is not shown as one');
  assert.deepEqual(rows(RING, { variant: { id: 'v14' } }), [
    ['Generic name', 'Ring'], ['Net quantity', '1 N'], ['Country of origin', 'India'], ['Metal', '18K gold (750)'],
    ['Gross weight', '3.4 g'], ['Net metal weight', '3.25 g'],
    ['Stone', 'Diamond, lab-grown · Round · 1 stone · 0.25 ct · Clarity VS1 · Colour F · IGI certificate LG123'],
    ['Stone', 'Ruby, natural · Oval · 2 stones · 0.4 ct'],
    ['Manufactured by', 'Kanak Jewels Pvt Ltd, 4 Zaveri Bazaar, Mumbai, Maharashtra 400002'],
  ]);
  assert.deepEqual(decl.weightRows(RING.weights, null), [{ key: 'weight', label: 'Weight', value: 'Differs by size: choose a size to see it.' }]);
  assert.deepEqual(decl.weightRows(RING.weights, { id: 'v16' }), [], 'a size with none recorded shows none');
  assert.deepEqual(decl.weightRows([{ id: 'a', gross_weight_g: 6.2, net_metal_weight_g: 5.9 }, { id: 'b', gross_weight_g: '6.200', net_metal_weight_g: '5.9', is_active: true }], null).map((r) => r.value), ['6.2 g', '5.9 g'], 'every size the same: shown before a choice');
  assert.equal(decl.stoneText({ stone: 'cubic zirconia', origin: 'simulant', stone_count: 12 }), 'Cubic zirconia, simulant · 12 stones');
});

await test('the label tables are the admin\'s, copied (the storefront does not import the admin\'s rules)', () => {
  assert.deepEqual(decl.PURITY_GRADES, PURITY);
  assert.deepEqual(decl.METAL_NAMES, METAL_LABELS);
  assert.deepEqual(decl.STONE_ORIGIN_NAMES, STONE_ORIGIN_LABELS);
  assert.doesNotMatch(read('src/lib/productDeclarations.js'), /^import /m, 'React-free and import-free');
  for (const rel of ['src/components/ProductInformation.jsx', 'src/lib/productDeclarationsApi.js', 'src/lib/consumerCare.js', 'src/fashion/FashionProductPage.jsx', 'src/homeliving/HomeLivingProductPage.jsx', 'src/components/Footer.jsx']) {
    assert.doesNotMatch(read(rel), /from '[^']*(storeCatalogueAdmin|\/admin\/)/, `${rel} imports nothing of the admin`);
  }
});

console.log('\n— The read —');

function declarationFixtures() {
  const f = catalogueFixtures();
  f.catalogue_parties = [{ id: 'co-kanak', ...KANAK, phone: null, email: null, gstin: null }];
  const linen = f.catalogue_products.find((p) => p.id === 'fp-linen');
  Object.assign(linen, { country_of_origin: 'IN', generic_name: 'Shirt', material: '100% linen', care: 'Machine wash cold', fit: 'Relaxed', manufacturer_id: 'co-kanak', net_content: '1 N' });
  f.catalogue_products.push({ ...linen, id: 'fp-ring', slug: 'solitaire-ring', sku: 'SL-RING', is_active: false, metal: 'gold', purity: 750 });
  f.catalogue_product_stones = [{ id: 'st-1', product_id: 'fp-ring', stone: 'diamond', origin: 'lab_grown', stone_count: 1, sort_order: 0 }];
  f.catalogue_variants.push({ id: 'fv-hidden', store: 'fashion', product_id: 'fp-linen', size: 'XL', colour: 'Sage', stock: 1, is_active: false, sort_order: 9, gross_weight_g: 9 });
  return f;
}
await test('one read, its own: the product\'s declarations with its companies, stones and size weights — public, active rows only', async () => {
  const anon = createCatalogueDb(declarationFixtures(), { admin: false });
  const api = loadWithHooks('src/lib/productDeclarationsApi.js', { supabase: anon.supabase });
  const linen = await api.getProductDeclarations('fashion', 'fp-linen');
  assert.equal(linen.manufacturer.name, 'Kanak Jewels Pvt Ltd'); assert.equal(linen.packer, null);
  assert.deepEqual(Object.keys(linen.manufacturer).sort(), ['address', 'country', 'name'], 'only what the page prints — no GSTIN, no phone');
  assert.ok(linen.weights.every((v) => v.is_active), 'a hidden size is not read');
  assert.equal(await api.getProductDeclarations('fashion', 'fp-ring'), null, 'a draft\'s declarations are not readable');
  assert.equal(await api.getProductDeclarations('homeliving', 'fp-linen'), null, 'filtered by store');
  const query = anon.log.at(-1);
  assert.equal(query.table, 'catalogue_products');
  assert.match(api.DECLARATION_SELECT, /manufacturer:catalogue_parties!manufacturer_id \(name, address, country\)/);
  assert.match(api.DECLARATION_SELECT, /importer:catalogue_parties!importer_id/);
  // The catalogue read the store pages are built from is not touched.
  assert.doesNotMatch(read('src/lib/fashionApi.js'), /country_of_origin|catalogue_parties|net_content/);
  assert.doesNotMatch(read('src/data/homelivingHomepage.js'), /country_of_origin|catalogue_parties/);
  const failing = loadWithHooks('src/lib/productDeclarationsApi.js', { supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('column catalogue_products.metal does not exist') }) }) }) }) }) } });
  await assert.rejects(failing.getProductDeclarations('fashion', 'fp-linen'), /does not exist/);
});

console.log('\n— The section —');

const CARE = companyInfo({ legalName: 'SORA LIFE Retail Pvt Ltd', email: 'care@soralife.example', phone: '+91 20 4000 0000', address: '12 MG Road\nPune 411001', hours: 'Mon–Sat, 10am–7pm' });
const section = (getProductDeclarations, care = CARE) => loadWithHooks('src/components/ProductInformation.jsx', { getProductDeclarations, declarationRows: decl.declarationRows, useConsumerCare: () => care, telHref }).default;
await test('the section appears once the read arrives, follows the chosen size, and adds consumer care', async () => {
  const Section = section(async () => RING);
  const page = await mount(h(Section, { store: 'fashion', productId: 'fp-ring', variant: { id: 'v12' }, prefix: 'fs' }));
  const text = page.text();
  assert.match(text, /^Product information/);
  assert.match(text, /Metal18K gold \(750\)/); assert.match(text, /Gross weight3\.25 g/);
  assert.match(text, /Consumer careSORA LIFE Retail Pvt Ltd · \+91 20 4000 0000 · care@soralife\.example/);
  const links = findAll(page.tree, (n) => n.type === 'a').map((a) => a.props.href);
  assert.deepEqual(links, ['tel:+912040000000', 'mailto:care@soralife.example']);
  const sec = findAll(page.tree, (n) => n.type === 'section')[0];
  assert.equal(sec.props.className, 'fs-pdp__section'); assert.equal(findAll(sec, (n) => n.type === 'dl')[0].props.className, 'fs-pdp__details', 'the page\'s own Details styling');
});

await test('no section before the read, when it fails, or when the listing declares nothing — and none in a server render', async () => {
  const never = section(() => new Promise(() => {}));
  assert.equal(textOf((await mount(h(never, { store: 'fashion', productId: 'x' }))).tree), '');
  const failing = section(async () => { throw new Error('offline'); });
  assert.equal(textOf((await mount(h(failing, { store: 'fashion', productId: 'x' }))).tree), '');
  const empty = section(async () => ({ id: 'x', stones: [], weights: [] }));
  assert.equal(textOf((await mount(h(empty, { store: 'fashion', productId: 'x' }))).tree), '', 'consumer care alone is the footer\'s, not a section');
  const noCare = section(async () => RING, companyInfo({}));
  assert.doesNotMatch((await mount(h(noCare, { store: 'fashion', productId: 'x' }))).text(), /Consumer care/);
  const Server = loadForServer('src/components/ProductInformation.jsx', { getProductDeclarations: async () => RING, declarationRows: decl.declarationRows, useConsumerCare: () => CARE, telHref }).default;
  assert.equal(renderToStaticMarkup(h(Server, { store: 'fashion', productId: 'fp-ring' })), '');
});

await test('both product pages place it after Details, with the chosen size; Home & Living leaves net quantity to its Size row', () => {
  const fashion = read('src/fashion/FashionProductPage.jsx'), home = read('src/homeliving/HomeLivingProductPage.jsx');
  assert.match(fashion, /fs-details-h[\s\S]*<\/section>\s*\)\}\s*<ProductInformation store="fashion" productId=\{view\.id\} variant=\{st\.variant\} prefix="fs" \/>/);
  assert.match(home, /hl-details-h[\s\S]*<\/section>\s*\{\/\* Net quantity is the Size row above\. \*\/\}\s*<ProductInformation store="homeliving" productId=\{view\.id\} variant=\{st\.variant\} prefix="hl" netQuantity=\{false\} \/>/);
});

console.log('\n— Consumer care —');

const footerWith = (info) => {
  const Footer = loadForServer('src/components/Footer.jsx', {
    Link: ({ to, children, ...p }) => h('a', { ...p, href: to }, children), Icon: () => null, Logo: () => h('span', null, 'SORA LIFE'),
    categories: [], branding: { siteName: 'SORA LIFE' }, useConsumerCare: () => info, hasContactChannel, socialLinks, telHref,
  }).default;
  return renderToStaticMarkup(h(Footer));
};
await test('every store\'s footer carries consumer care: name, address, phone, email and hours — each only when set', () => {
  const full = footerWith(CARE);
  assert.match(full, /<section class="ftr__care" id="consumer-care" aria-labelledby="ftr-care-h"><h4 id="ftr-care-h">Consumer care<\/h4>/);
  assert.match(full, /<p class="ftr__care-name">SORA LIFE Retail Pvt Ltd<\/p><address class="ftr__care-address">12 MG Road\nPune 411001<\/address>/);
  assert.match(full, /<a href="tel:\+912040000000">\+91 20 4000 0000<\/a><a href="mailto:care@soralife\.example">care@soralife\.example<\/a>/);
  assert.match(full, /<p class="ftr__care-hours">Mon–Sat, 10am–7pm<\/p>/);
  const emailOnly = footerWith(companyInfo({ email: 'care@soralife.example' }));
  assert.match(emailOnly, /Consumer care/); assert.doesNotMatch(emailOnly, /ftr__care-(name|address|hours)|tel:/);
  assert.doesNotMatch(footerWith(companyInfo({ legalName: 'SORA LIFE Retail Pvt Ltd', hours: 'Mon–Sat' })), /Consumer care/, 'a name with no way to reach it is not a contact');
  assert.doesNotMatch(footerWith(companyInfo({})), /Consumer care|ftr__contact/);
  for (const layout of ['src/components/Layout.jsx', 'src/fashion/FashionLayout.jsx', 'src/homeliving/HomeLivingLayout.jsx', 'src/grocery/GroceryLayout.jsx', 'src/lifestyle/LifestyleLayout.jsx']) {
    assert.match(read(layout), /<Footer \/>/, `${layout} renders the shared footer`);
  }
});

await test('one read of the Contact & help page per visit, shared by the footer and the product page; its values win over the settings', async () => {
  let reads = 0;
  const care = loadWithHooks('src/lib/consumerCare.js', {
    fetchLegalPage: async (id) => { reads += 1; assert.equal(id, 'contact'); return { email: 'help@soralife.example', phone: '+91 20 4000 0000', legalName: 'SORA LIFE Retail Pvt Ltd' }; },
    defaultLegalPage: (id, contact) => ({ ...contact }), contact: { email: 'old@soralife.example' }, branding: { siteName: 'SORA LIFE' }, companyInfo,
  });
  const Show = () => h('p', null, care.useConsumerCare().email);
  const page = await mount(h('div', null, h(Show), h(Show)));
  assert.equal(page.text(), 'help@soralife.example'.repeat(2));
  await mount(h(Show));
  assert.equal(reads, 1);
  const offline = loadWithHooks('src/lib/consumerCare.js', { fetchLegalPage: async () => { throw new Error('offline'); }, defaultLegalPage: (id, contact) => ({ ...contact }), contact: { email: 'care@soralife.example' }, branding: {}, companyInfo });
  const Fallback = () => h('p', null, offline.useConsumerCare().email);
  assert.equal((await mount(h(Fallback))).text(), 'care@soralife.example', 'a failed read keeps the settings');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
