// ============================================================
// Bulk spotlight packshot import.
//
// What these checks defend:
//
//   EXACTNESS   a file is assigned to a product only when its name IS that
//               product's slug. No fuzzy matching, no nearest match.
//   AMBIGUITY   a contested file or product is reported, never resolved. The
//               Immunosash case — one source packshot recorded against both
//               the 30-capsule pack and the 250 ml juice — must stay skipped.
//   PRESERVE    assigning images must not disturb headlines, sublines,
//               backgrounds, ordering, category settings, homepage.discovery,
//               or any other homepage key.
//   SECURITY    the existing authenticated admin upload path is reused; no
//               service-role key, no hotlinking.
//   RESILIENCE  one failed upload cannot abort the batch.
//
// Offline: real modules, real JSX rendered in memory. No network, no Supabase.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import {
  IMPORT_STATUS, slugFromFilename, parseMappingCsv, planImport,
  applyUploads, mergeIntoHomepage, buildSummaryText, countByStatus,
} from '../src/lib/spotlightImport.js';
import { normalizeCategoryExperience, sanitizeCategoryConfig, categoryExperiencePayload } from '../src/lib/categoryExperience.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = (p) => read(p).replace(/\r\n/g, '\n');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const h = React.createElement;

function component(file, name, deps = {}) {
  const { code: js } = transformSync(read(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(p) { p.remove(); },
      ExportDefaultDeclaration(p) { p.replaceWith(p.node.declaration); },
      ExportNamedDeclaration(p) { if (p.node.declaration) p.replaceWith(p.node.declaration); else p.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${js}\n;return ${name};`)(...Object.values(scope));
}

// ---- fixtures -------------------------------------------------------
const mk = (over = {}) => ({
  id: over.slug, slug: 'p', name: 'Product', price: 100, mrp: 120,
  priceVerified: true, isActive: true, stock: 40, category: 'hair-care',
  image: '/img/p.png', form: '100ml', rating: 0, reviewCount: 0, ...over,
});
const SHAMPOO = mk({ slug: 'aloe-vera-protein-shampoo', name: 'Aloe Vera Protein Shampoo' });
const COND = mk({ slug: 'aloe-vera-protein-conditioner', name: 'Aloe Vera Protein Conditioner' });
const SERUM = mk({ slug: 'hair-serum', name: 'Hair Serum' });
const SOLDOUT = mk({ slug: 'sold-out-oil', name: 'Sold Out Oil', stock: 0 });
const CROSS = mk({ slug: 'dual-category-balm', name: 'Dual Balm', category: 'hair-care', categories: ['hair-care', 'skin-care'] });
const CATALOGUE = [SHAMPOO, COND, SERUM, SOLDOUT, CROSS];
const f = (name) => ({ name, size: 1000, type: 'image/png' });

// ====================================================================
console.log('\n— Matching is exact —');
// ====================================================================

test('E1 the slug comes from the filename, extension stripped, nothing else', () => {
  assert.equal(slugFromFilename('hair-serum.png'), 'hair-serum');
  assert.equal(slugFromFilename('Hair-Serum.PNG'), 'hair-serum');
  assert.equal(slugFromFilename('/a/b/hair-serum.webp'), 'hair-serum');
  assert.equal(slugFromFilename('hair-serum.jpeg'), 'hair-serum');
  // A duplicate-download suffix is NOT quietly repaired into a match.
  assert.equal(slugFromFilename('hair-serum (1).png'), 'hair-serum (1)');
  assert.equal(slugFromFilename('hair_serum.png'), 'hair_serum');
  assert.equal(slugFromFilename(''), '');
  assert.equal(slugFromFilename(null), '');
});

test('E2 an exact slug matches; anything else is unmatched, never guessed', () => {
  const { plan } = planImport({
    files: [f('hair-serum.png'), f('hair-serum-100ml.png'), f('HairSerum.png'), f('random.png')],
    products: CATALOGUE,
  });
  assert.equal(plan[0].status, IMPORT_STATUS.MATCHED);
  assert.equal(plan[0].product.slug, 'hair-serum');
  for (const i of [1, 2, 3]) {
    assert.equal(plan[i].status, IMPORT_STATUS.UNMATCHED,
      `${plan[i].filename} is near-miss and must NOT be matched to hair-serum`);
  }
  // The module must contain no similarity scoring at all.
  const lib = code('../src/lib/spotlightImport.js');
  assert.doesNotMatch(lib, /levenshtein|similarity|fuzzy|startsWith\(slug|includes\(slug/i,
    'no fuzzy matching may exist');
});

test('E3 an ineligible product is skipped with a reason, not uploaded', () => {
  const { plan } = planImport({ files: [f('sold-out-oil.png')], products: CATALOGUE });
  assert.equal(plan[0].status, IMPORT_STATUS.SKIPPED);
  assert.match(plan[0].reason, /active, priced and in stock/);
});

// ====================================================================
console.log('\n— Ambiguity is reported, never resolved —');
// ====================================================================

test('A1 two files claiming one product leave BOTH out', () => {
  const { plan } = planImport({
    files: [f('hair-serum.png'), f('hair-serum.webp')],
    products: CATALOGUE,
  });
  assert.equal(plan[0].status, IMPORT_STATUS.AMBIGUOUS);
  assert.equal(plan[1].status, IMPORT_STATUS.AMBIGUOUS);
  assert.match(plan[0].reason, /More than one selected file/);
});

test('A2 THE IMMUNOSASH CASE — one source packshot, two products, both skipped', () => {
  // Exactly the real collision: Immunosash.png is recorded against both the
  // 30-capsule pack and the 250 ml juice. Neither may be assigned.
  const capsules = mk({ slug: 'immunosash-capsules-30-capsules', name: 'Immunosash Capsules (30 Capsules)', form: '30Capsules' });
  const juice = mk({ slug: 'seabuckthorn-immunosash-juice', name: 'Sea Buckthorn Immunosash Juice', form: '250 ml' });
  const csv = [
    'sora_product_slug,product_name,pack_size,local_file,source_url',
    'immunosash-capsules-30-capsules,"Immunosash Capsules (30 Capsules)",30Capsules,immunosash-capsules-30-capsules.png,https://biosash.com/media/uploads/products/Immunosash.png',
    'seabuckthorn-immunosash-juice,"Sea Buckthorn Immunosash Juice",250 ml,seabuckthorn-immunosash-juice.png,https://biosash.com/media/uploads/products/Immunosash.png',
  ].join('\n');

  const { plan } = planImport({
    files: [f('immunosash-capsules-30-capsules.png'), f('seabuckthorn-immunosash-juice.png'), f('hair-serum.png')],
    products: [...CATALOGUE, capsules, juice],
    csvRows: parseMappingCsv(csv),
  });

  assert.equal(plan[0].status, IMPORT_STATUS.AMBIGUOUS, 'the capsules must not be assigned');
  assert.equal(plan[1].status, IMPORT_STATUS.AMBIGUOUS, 'the juice must not be assigned');
  assert.match(plan[0].reason, /more than one product/i);
  // And the collision must not poison an unrelated, well-formed file.
  assert.equal(plan[2].status, IMPORT_STATUS.MATCHED);
});

test('A3 a mapping that disagrees with the filename blocks the file', () => {
  const csv = [
    'sora_product_slug,product_name,pack_size,local_file,source_url',
    'hair-serum,"Hair Serum",100ml,hair-serum.png,https://biosash.com/x/Biosash-HAIR-SERUM.png',
  ].join('\n');
  const { plan } = planImport({
    files: [f('hair-serum.webp')],           // mapping says .png
    products: CATALOGUE,
    csvRows: parseMappingCsv(csv),
  });
  assert.equal(plan[0].status, IMPORT_STATUS.AMBIGUOUS);
  assert.match(plan[0].reason, /expects "hair-serum\.png"/);
});

test('A4 the mapping CSV parses, quoted commas and all', () => {
  const rows = parseMappingCsv([
    'sora_product_slug,product_name,pack_size,local_file,source_url',
    'aloe-vera-protein-shampoo,"Shampoo, Aloe & Neem",100ml,aloe-vera-protein-shampoo.png,https://biosash.com/a.png',
  ].join('\n'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].slug, 'aloe-vera-protein-shampoo');
  assert.equal(rows[0].file, 'aloe-vera-protein-shampoo.png');
  assert.equal(parseMappingCsv('').length, 0);
  assert.equal(parseMappingCsv('nonsense').length, 0);
});

// ====================================================================
console.log('\n— Assignment preserves everything already configured —');
// ====================================================================

const existingCfg = normalizeCategoryExperience({
  categories: {
    'hair-care': {
      enabled: true, autoRotate: false, intervalMs: 6000,
      theme: { background: '#ABCDEF', gradient: '' },
      items: [
        { id: 'a', productSlug: 'hair-serum', headline: 'Our pick', subline: 'Cold pressed', background: '#112233', gradient: '', enabled: true, spotlightImage: '' },
        { id: 'b', productSlug: 'aloe-vera-protein-shampoo', headline: '', subline: '', background: '', gradient: '', enabled: false, spotlightImage: '/img/old.png' },
      ],
    },
  },
});

test('P1 an existing item keeps its copy, colour, enabled flag and position', () => {
  const { categories } = applyUploads(existingCfg, [
    {
      slug: 'hair-serum', url: 'https://cdn.test/new-serum.png', categories: ['hair-care'],
      autoTheme: { background: '#F8E3D6', gradient: 'linear-gradient(168deg, #F9EBE1 0%, #F6D4C2 100%)' },
    },
  ]);
  const item = categories['hair-care'].items.find((i) => i.productSlug === 'hair-serum');
  assert.equal(item.spotlightImage, 'https://cdn.test/new-serum.png', 'only the image changes');
  assert.equal(item.headline, 'Our pick');
  assert.equal(item.subline, 'Cold pressed');
  assert.equal(item.background, '#112233');
  assert.equal(item.autoTheme.background, '#F8E3D6', 'automatic theme is stored separately');
  assert.equal(item.id, 'a', 'the stable id survives');
  assert.equal(categories['hair-care'].items[0].productSlug, 'hair-serum', 'order is unchanged');
  // A disabled item stays disabled — the import does not re-enable anything.
  const other = categories['hair-care'].items.find((i) => i.productSlug === 'aloe-vera-protein-shampoo');
  assert.equal(other.enabled, false);
});

test('P1b re-import refreshes only generated presentation fields', () => {
  const configured = normalizeCategoryExperience({
    categories: { 'hair-care': { enabled: false, items: [{
      id: 'stable', productSlug: 'hair-serum', headline: 'Owner copy', subline: 'Owner subline',
      background: '#112233', gradient: '', visualScale: 1.17, verticalOffset: -9,
      autoTheme: { background: '#EEEEEE', gradient: '' }, enabled: false,
    }] } },
  });
  const { categories } = applyUploads(configured, [{
    slug: 'hair-serum', url: 'https://cdn.test/normalized.png', categories: ['hair-care'],
    autoTheme: { background: '#E4EFE2', gradient: 'linear-gradient(168deg, #EFF5EC 0%, #D7E7D3 100%)' },
  }]);
  const item = categories['hair-care'].items[0];
  assert.equal(item.id, 'stable');
  assert.equal(item.headline, 'Owner copy');
  assert.equal(item.subline, 'Owner subline');
  assert.equal(item.background, '#112233', 'manual theme survives');
  assert.equal(item.visualScale, 1.17);
  assert.equal(item.verticalOffset, -9);
  assert.equal(item.enabled, false);
  assert.equal(item.autoTheme.background, '#E4EFE2', 'automatic suggestion may safely refresh');
  assert.equal(categories['hair-care'].enabled, false, 'category remains off');
});

test('P2 category settings and theme are untouched', () => {
  const { categories } = applyUploads(existingCfg, [
    { slug: 'hair-serum', url: 'https://cdn.test/x.png', categories: ['hair-care'] },
  ]);
  const c = categories['hair-care'];
  assert.equal(c.autoRotate, false);
  assert.equal(c.intervalMs, 6000);
  assert.equal(c.theme.background, '#ABCDEF');
  assert.equal(c.enabled, true);
});

test('P3 a product with no item yet gets one appended, carrying no invented copy', () => {
  const { categories, report } = applyUploads(existingCfg, [
    {
      slug: 'aloe-vera-protein-conditioner', url: 'https://cdn.test/cond.png', categories: ['hair-care'],
      autoTheme: { background: '#E4EFE2', gradient: 'linear-gradient(168deg, #EFF5EC 0%, #D7E7D3 100%)' },
    },
  ]);
  const items = categories['hair-care'].items;
  assert.equal(items.length, 3, 'appended, not replacing');
  const added = items[2];
  assert.equal(added.productSlug, 'aloe-vera-protein-conditioner');
  assert.equal(added.spotlightImage, 'https://cdn.test/cond.png');
  assert.equal(added.headline, '', 'no headline is invented');
  assert.equal(added.subline, '');
  assert.equal(added.background, '', 'the category theme still supplies the background');
  assert.equal(added.autoTheme.background, '#E4EFE2', 'its generated theme is stored per item');
  assert.ok(added.id, 'it gets a stable id');
  assert.deepEqual(report[0].created, ['aloe-vera-protein-conditioner']);
});

test('P4 the same product is never given two items in one category', () => {
  const { categories } = applyUploads(existingCfg, [
    { slug: 'hair-serum', url: 'https://cdn.test/1.png', categories: ['hair-care'] },
    { slug: 'hair-serum', url: 'https://cdn.test/2.png', categories: ['hair-care'] },
  ]);
  const hits = categories['hair-care'].items.filter((i) => i.productSlug === 'hair-serum');
  assert.equal(hits.length, 1, 'one item per product');
  assert.equal(hits[0].spotlightImage, 'https://cdn.test/2.png', 'the later upload wins');
});

test('P5 a product in two categories is assigned in both', () => {
  const { categories } = applyUploads({ categories: {} }, [
    { slug: 'dual-category-balm', url: 'https://cdn.test/balm.png', categories: ['hair-care', 'skin-care'] },
  ]);
  for (const cat of ['hair-care', 'skin-care']) {
    const it = categories[cat].items.find((i) => i.productSlug === 'dual-category-balm');
    assert.equal(it.spotlightImage, 'https://cdn.test/balm.png', `${cat} received it`);
  }
  // ONE image, TWO assignments. That is correct, not a duplicate: the counts
  // are reported separately for exactly this reason.
  const total = Object.values(categories).reduce((n, c) => n + c.items.length, 0);
  assert.equal(total, 2, 'one source image legitimately creates two assignments');
});

test('P6 assignment is NOT capped — item 13 and beyond are assigned', () => {
  // There used to be a 12-item ceiling here, which left 34 Wellness products
  // uploaded but unused. The stage mounts three seats whatever the pool depth,
  // so the ceiling bought nothing.
  const twelve = normalizeCategoryExperience({
    categories: {
      'hair-care': {
        items: Array.from({ length: 12 }, (_, i) => ({ id: `i${i}`, productSlug: `filler-${i}` })),
      },
    },
  });
  const { categories, report } = applyUploads(twelve, [
    { slug: 'hair-serum', url: 'https://cdn.test/13.png', categories: ['hair-care'] },
    { slug: 'aloe-vera-protein-shampoo', url: 'https://cdn.test/14.png', categories: ['hair-care'] },
  ]);
  assert.equal(categories['hair-care'].items.length, 14, 'both go past the old limit');
  assert.equal(categories['hair-care'].items[12].productSlug, 'hair-serum');
  assert.equal(categories['hair-care'].items[13].spotlightImage, 'https://cdn.test/14.png');
  assert.deepEqual(report[0].created, ['hair-serum', 'aloe-vera-protein-shampoo']);
  // The old "left over" bucket is gone, because nothing is left over.
  assert.equal(report[0].cappedOut, undefined);

  // A realistic Wellness-sized batch lands in full.
  const big = Array.from({ length: 46 }, (_, i) => ({
    slug: `w${i}`, url: `https://cdn.test/w${i}.png`, categories: ['wellness'],
  }));
  const { categories: wellness } = applyUploads({ categories: {} }, big);
  assert.equal(wellness.wellness.items.length, 46, 'all 46 assigned');
  assert.equal(new Set(wellness.wellness.items.map((i) => i.id)).size, 46, 'each keeps a unique stable id');
});

test('P7 a category that was filling itself is flagged as now curated', () => {
  const { report } = applyUploads({ categories: {} }, [
    { slug: 'hair-serum', url: 'https://cdn.test/s.png', categories: ['hair-care'] },
  ]);
  assert.equal(report[0].wasUsingFallback, true,
    'creating the first item changes a category from automatic to curated — say so');
});

test('P8 unrelated homepage settings survive the write', () => {
  const homepage = {
    discovery: { categoryCards: [{ id: 'x' }], concernCards: [] },
    bestseller_title: 'Bestsellers',
    hero_cta_label: 'Shop now',
    categoryExperience: { categories: {} },
  };
  const merged = mergeIntoHomepage(homepage, { categories: { 'hair-care': { items: [] } } });
  assert.deepEqual(merged.discovery, homepage.discovery, 'discovery is carried through untouched');
  assert.equal(merged.bestseller_title, 'Bestsellers');
  assert.equal(merged.hero_cta_label, 'Shop now');
  assert.deepEqual(merged.categoryExperience.categories['hair-care'], { items: [] });
  assert.deepEqual(mergeIntoHomepage(null, { categories: {} }).categoryExperience, { categories: {} });
});

test('P12 RE-IMPORT refreshes the image and auto theme, and nothing else', () => {
  // The owner has already imported 131 packshots. Re-importing them through
  // the new processor must replace the artwork and the generated colours while
  // leaving every hand-made decision — and every id and position — alone.
  const before = normalizeCategoryExperience({
    categories: {
      'hair-care': {
        enabled: true, autoRotate: false, intervalMs: 6000,
        theme: { background: '#EFE9F1', gradient: '' },
        items: [
          { id: 'keep-me', productSlug: 'hair-serum', spotlightImage: 'https://cdn.test/old-serum.png',
            headline: 'Our pick', subline: 'Cold pressed',
            background: '#ABCDEF', gradient: 'linear-gradient(168deg, #ABCDEF 0%, #123456 100%)',
            autoTheme: { background: '#111111', gradient: '' },
            visualScale: 1.2, verticalOffset: -18, enabled: false },
          { id: 'second', productSlug: 'aloe-vera-protein-shampoo', spotlightImage: 'https://cdn.test/old-shampoo.png' },
        ],
      },
    },
  });

  const { categories, report } = applyUploads(before, [
    { slug: 'hair-serum', url: 'https://cdn.test/NEW-serum.png',
      autoTheme: { background: '#F6E7DE', gradient: 'linear-gradient(168deg, #F8EEE5 0%, #F3DBD0 100%)' },
      categories: ['hair-care'] },
    { slug: 'aloe-vera-protein-shampoo', url: 'https://cdn.test/NEW-shampoo.png',
      autoTheme: { background: '#E9ECD9', gradient: 'linear-gradient(168deg, #F0F0E2 0%, #DCE3C7 100%)' },
      categories: ['hair-care'] },
  ]);

  const items = categories['hair-care'].items;
  assert.equal(items.length, 2, 'no duplicate items are created');
  assert.deepEqual(items.map((i) => i.productSlug), ['hair-serum', 'aloe-vera-protein-shampoo'],
    'ordering is unchanged');

  const serum = items[0];
  assert.equal(serum.id, 'keep-me', 'the stable id survives');
  assert.equal(serum.spotlightImage, 'https://cdn.test/NEW-serum.png', 'the artwork is refreshed');
  assert.equal(serum.autoTheme.background, '#F6E7DE', 'and so is the generated theme');
  // Everything the owner authored is untouched.
  assert.equal(serum.headline, 'Our pick');
  assert.equal(serum.subline, 'Cold pressed');
  assert.equal(serum.background, '#ABCDEF', 'MANUAL background preserved');
  assert.match(serum.gradient, /#ABCDEF/, 'MANUAL gradient preserved');
  assert.equal(serum.visualScale, 1.2, 'Visual Scale preserved');
  assert.equal(serum.verticalOffset, -18, 'Vertical Offset preserved');
  assert.equal(serum.enabled, false, 'a hidden item stays hidden');

  // Category settings survive, and the import publishes nothing.
  const cfg = categories['hair-care'];
  assert.equal(cfg.autoRotate, false);
  assert.equal(cfg.intervalMs, 6000);
  assert.equal(cfg.theme.background, '#EFE9F1');
  assert.equal(report[0].updated.length, 2, 'both were updates, not additions');
  assert.equal(report[0].created.length, 0);
});

test('P13 an upload with no generated theme leaves the stored one alone', () => {
  // A source the processor could not read a colour from must not blank out a
  // theme that a previous, successful import produced.
  const before = normalizeCategoryExperience({
    categories: {
      'hair-care': {
        items: [{ id: 'a', productSlug: 'hair-serum', autoTheme: { background: '#F6E7DE', gradient: '' } }],
      },
    },
  });
  const { categories } = applyUploads(before, [
    { slug: 'hair-serum', url: 'https://cdn.test/new.png', categories: ['hair-care'] },
  ]);
  const item = categories['hair-care'].items[0];
  assert.equal(item.spotlightImage, 'https://cdn.test/new.png', 'the image still updates');
  assert.equal(item.autoTheme.background, '#F6E7DE', 'the previous generated theme is kept');
});

test('P9 the importer NEVER flips a category from off to on', () => {
  // Importing prepares a category; the owner publishes it. A disabled category
  // that receives packshots is still disabled afterwards.
  const off = normalizeCategoryExperience({ categories: { 'hair-care': { enabled: false, items: [] } } });
  const { categories, report } = applyUploads(off, [
    { slug: 'hair-serum', url: 'https://cdn.test/a.png', categories: ['hair-care'] },
    { slug: 'aloe-vera-protein-shampoo', url: 'https://cdn.test/b.png', categories: ['hair-care'] },
  ]);
  assert.equal(categories['hair-care'].enabled, false, 'still not published');
  assert.equal(categories['hair-care'].items.length, 2, 'but the work is assigned');
  assert.equal(report[0].enabled, false, 'and the summary says so');

  // An already-published category is equally untouched — nothing is turned OFF.
  const on = normalizeCategoryExperience({ categories: { 'hair-care': { enabled: true, items: [] } } });
  const after = applyUploads(on, [{ slug: 'hair-serum', url: 'https://cdn.test/a.png', categories: ['hair-care'] }]);
  assert.equal(after.categories['hair-care'].enabled, true, 'stays live');
  assert.equal(after.report[0].enabled, true);
});

test('P10 a category the importer creates starts DISABLED', () => {
  // wellness has no configuration; importing 46 packshots into it must not
  // publish a brand-new spotlight on deploy day.
  const { categories, report } = applyUploads({ categories: {} }, [
    { slug: 'w1', url: 'https://cdn.test/1.png', categories: ['wellness'] },
    { slug: 'w2', url: 'https://cdn.test/2.png', categories: ['wellness'] },
  ]);
  assert.equal(categories.wellness.enabled, false, 'created off');
  assert.equal(categories.wellness.items.length, 2);
  assert.equal(report[0].enabled, false);
  // It IS persisted, because the assigned items are real work worth keeping.
  const payload = categoryExperiencePayload(categories);
  assert.equal(payload.categories.wellness.items.length, 2);
  assert.equal(payload.categories.wellness.enabled, false);
});

test('P11 the importer UI says nothing is published by importing', () => {
  const cmp = code('../src/admin/components/BulkPackshotImport.jsx');
  assert.match(cmp, /Importing never publishes anything/i, 'stated before the run');
  assert.match(cmp, /turn Spotlight enabled on when you/i, 'and again afterwards');
  assert.match(cmp, /READY . NOT LIVE/, 'per-category status after the import');
  assert.doesNotMatch(cmp, /enabled: true/, 'the importer never writes an enabled flag');
});


// ====================================================================
console.log('\n— The importer component —');
// ====================================================================

test('C1 it uploads through the existing admin path, with no service-role key', () => {
  const cmp = code('../src/admin/components/BulkPackshotImport.jsx');
  assert.match(cmp, /processSpotlightPackshot\(row\.file\)/, 'normalizes locally before upload');
  assert.match(cmp, /uploadHomepageImage\(processed\.file\)/, 'reuses the authenticated admin upload for the PNG');
  assert.doesNotMatch(cmp, /service_role|SERVICE_ROLE|serviceRole/i, 'no service-role key anywhere');
  assert.doesNotMatch(cmp, /biosash\.com/i, 'nothing is hotlinked from the source site');
  // The stored value is the URL storage returned, never a remote one.
  assert.match(cmp, /urlsRef\.current\.set\(row\.slug, url\)/);
});

test('C2 the settings write happens once, after a fresh read', () => {
  const cmp = code('../src/admin/components/BulkPackshotImport.jsx');
  assert.equal((cmp.match(/adminSetSetting\(/g) || []).length, 1, 'exactly one write for the batch');
  const run = cmp.slice(cmp.indexOf('async function run()'));
  const read = run.indexOf("adminGetSetting('homepage')");
  const write = run.indexOf('adminSetSetting(');
  assert.ok(read > -1 && write > -1 && read < write, 'it re-reads immediately before writing');
  assert.match(run, /mergeIntoHomepage\(currentHomepage, payload\)/, 'and merges rather than replaces');
});

test('C3 one failed upload does not abort the batch', () => {
  const cmp = code('../src/admin/components/BulkPackshotImport.jsx');
  const loop = cmp.slice(cmp.indexOf('for (let i = 0'), cmp.indexOf('if (uploads.length)'));
  assert.match(loop, /try \{/, 'each upload is guarded');
  assert.match(loop, /catch \(ex\)/);
  assert.match(loop, /IMPORT_STATUS\.FAILED/, 'a failure marks the row');
  assert.doesNotMatch(loop, /throw |return;/, 'and never leaves the loop');
});

test('C4 progress is reported as uploaded / total', () => {
  const cmp = code('../src/admin/components/BulkPackshotImport.jsx');
  assert.match(cmp, /\{uploadedCount\} \/ \{totalToUpload\}/, 'e.g. "37 / 132 uploaded"');
  assert.match(cmp, /aria-live="polite"/, 'and announced');
});

test('C5 it renders the pickers, and declares every status bucket', () => {
  const Cmp = component('../src/admin/components/BulkPackshotImport.jsx', 'BulkPackshotImport', {
    adminGetSetting: async () => ({}), adminSetSetting: async () => {},
    uploadHomepageImage: async () => 'https://cdn.test/x.png',
    processSpotlightPackshot: async (file) => ({ file, theme: { background: '#EEEEEE', gradient: '' } }),
    products: CATALOGUE,
    normalizeCategoryExperience, categoryExperiencePayload: (c) => ({ categories: c }),
    IMPORT_STATUS, planImport, parseMappingCsv, applyUploads, mergeIntoHomepage,
    buildSummaryText, countByStatus,
  });
  const html = renderToStaticMarkup(h(Cmp, {}));
  assert.match(html, /Bulk import spotlight packshots/);
  assert.match(html, /type="file"[^>]*multiple/, 'multiple files can be selected');
  assert.match(html, /accept="\.csv,text\/csv"/, 'the mapping file is accepted too');
  // The tallies only appear once files are chosen — an empty grid of zeroes
  // before you have selected anything is noise. A file input cannot be driven
  // in SSR, so the buckets themselves are asserted in the source.
  assert.doesNotMatch(html, /adm-bpi__counts/, 'no tallies before a selection');
  const cmp = code('../src/admin/components/BulkPackshotImport.jsx');
  for (const label of ['Matched', 'Uploading', 'Uploaded', 'Skipped', 'Failed', 'Ambiguous', 'Unmatched']) {
    assert.match(cmp, new RegExp(`label="${label}"`), `the ${label} tally is declared`);
  }
  assert.match(cmp, /Download summary/, 'and the summary can be downloaded');
});

test('C6 the summary names every bucket, including what was NOT assigned', () => {
  const { plan } = planImport({
    files: [f('hair-serum.png'), f('sold-out-oil.png'), f('nope.png')],
    products: CATALOGUE,
  });
  plan[0].status = IMPORT_STATUS.UPLOADED;
  const text = buildSummaryText(plan, { uploadedUrls: new Map([['hair-serum', 'https://cdn.test/s.png']]) });
  assert.match(text, /UPLOADED \(1\)[\s\S]*hair-serum\s+https:\/\/cdn\.test\/s\.png/);
  assert.match(text, /SKIPPED \(1\)[\s\S]*sold-out-oil/);
  assert.match(text, /UNMATCHED FILES \(1\)[\s\S]*nope\.png/);
  assert.match(text, /AMBIGUOUS \(left for review, nothing assigned\) \(0\)/,
    'empty buckets are still reported, and the heading says nothing was assigned');
});

test('C8 the shape of the import is shown before it runs, with no cap talk', () => {
  const cmp = code('../src/admin/components/BulkPackshotImport.jsx');
  // Images and assignments are counted separately, because one product in two
  // categories legitimately produces two assignments from one image.
  assert.match(cmp, /assignments \+= 1;/, 'assignments are counted per category');
  assert.match(cmp, /preflight\.assignments > matched/,
    'and the difference is explained rather than presented as duplication');
  assert.match(cmp, /!running && !done && matched > 0/, 'shown before the run');
  // Every trace of the removed 12-item ceiling is gone from the UI.
  assert.doesNotMatch(cmp, /MAX_SPOTLIGHT_ITEMS|MAX_ITEMS|cappedOut/, 'no cap remains');
  assert.doesNotMatch(cmp, /left over|item limit|Limit of/i, 'and no cap wording remains');
});

test('C7 the admin page reloads its state after an import', () => {
  const page = code('../src/admin/pages/CategoryExperience.jsx');
  assert.match(page, /<BulkPackshotImport onImported=\{reloadFromSettings\} \/>/,
    'otherwise the editor would keep showing pre-import values');
  assert.match(page, /async function reloadFromSettings\(\)/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
