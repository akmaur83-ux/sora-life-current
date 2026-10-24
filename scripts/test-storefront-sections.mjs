// ============================================================
// Storefront sections an admin edits — offline suite.
//
//   node scripts/test-storefront-sections.mjs
//
// Pins, with no network and no database:
//   * every section's built-in content fits its own schema: the same fields,
//     the same list and line counts, every value passing the editor's rules —
//     so a section left alone reads back exactly as built in;
//   * the editor's rules: two photographs (phone and desktop) together; a
//     colour-matched photograph's colour with them; text position from the
//     presets only; show/hide as on/off; nothing that is not a field;
//   * the page's reading: every field that breaks its rule falls back to the
//     built-in value, field by field — never rendered broken;
//   * the build copies a section's uploaded photographs like any other;
//   * with nothing published, all fifteen renders equal the tree before the
//     sections were editable, byte for byte; with content published, each page
//     shows it: copy, photographs (phone and desktop), links, hidden sections
//     and tiles, the position preset and the matched colour;
//   * the admin page edits every store's sections through the WebP converter,
//     with the claim checker's warnings; no storefront page imports the editor.
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import * as content from '../src/lib/storefrontContent.js';
import { buildFashionApp, loadModule as loadFashionModule } from './fashion-ssr.mjs';
import { loadGroceryData, loadModule } from './grocery-ssr.mjs';
import { loadHomeLivingData } from './homeliving-ssr.mjs';
import { REPO, exportBaseline } from './baseline-export.mjs';
import { Link, useLocation } from 'react-router-dom';

const BASELINE_SHA = '340b399';
const read = (rel) => readFileSync(join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}

// ---- every section and its built-in content, as the pages define them ----------------------------
const fashionApp = await buildFashionApp({});
const department = loadFashionModule('src/fashion/departmentContent.js');
const jewellery = loadFashionModule('src/fashion/jewelleryContent.js');
const Icon = loadModule('src/components/Icon.jsx').default;
const DeferredImage = loadModule('src/components/DeferredImage.jsx').default;
const FashionEntryLink = loadModule('src/components/FashionEntryLink.jsx', { Link, useLocation, Icon }).default;
const wellness = loadModule('src/components/HomeStorefront.jsx', { Link, Icon, DeferredImage, FashionEntryLink });
const doorway = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage, FashionEntryLink });
const homeliving = loadHomeLivingData();
const grocery = loadGroceryData();

const SECTIONS = [
  ['wellness', 'hero', wellness.HERO_SECTION],
  ['wellness', 'trust', wellness.TRUST_SECTION],
  ['wellness', 'tiles', wellness.TILES_SECTION],
  ['wellness', 'stores', wellness.STORES_SECTION],
  ['wellness', 'promo', wellness.FESTIVE_SECTION],
  ['wellness', 'lifestyleBanner', doorway.LIFESTYLE_SECTION],
  ['wellness', 'jewelleryBanner', wellness.JEWELLERY_BANNER_SECTION],
  ['wellness', 'storeCarousel', doorway.STORE_CAROUSEL_SECTION],
  ['fashion', 'strips.delivery', fashionApp.modules.layout.DELIVERY_STRIP],
  ['fashion', 'strips.benefits', fashionApp.modules.home.BENEFITS_STRIP],
  ...['women', 'men', 'sarees'].flatMap((page) => Object.entries(department.DEPARTMENT_SECTIONS[page]).map(([key, d]) => ['fashion', `${page}.${key}`, d])),
  ...Object.entries(jewellery.JEWELLERY_SECTIONS).map(([key, d]) => ['fashion', `jewellery.${key}`, d]),
  ...Object.entries(homeliving.HOMELIVING_SECTIONS).map(([key, d]) => ['homeliving', key, d]),
  ...Object.entries(grocery.GROCERY_SECTIONS).map(([key, d]) => ['grocery', key, d]),
];

/** The section paths the schema defines: every top-level group of the three section stores, and Fashion's pages. */
function schemaSections() {
  const out = [];
  for (const store of ['wellness', 'homeliving', 'grocery']) for (const key of Object.keys(content.STOREFRONT_SCHEMAS[store].fields)) out.push(`${store}:${key}`);
  for (const [page, spec] of Object.entries(content.STOREFRONT_SCHEMAS.fashion.fields)) {
    if (content.STOREFRONT_HOME_KEYS.fashion.includes(page)) continue;
    for (const key of Object.keys(spec.fields)) out.push(`fashion:${page}.${key}`);
  }
  return out.sort();
}

console.log('\n— Each section and its built-in content —');

await test('every editable section the schema defines has its built-in content, and the admin lists every one of them', () => {
  assert.deepEqual(SECTIONS.map(([s, p]) => `${s}:${p}`).sort(), schemaSections());
  assert.equal(SECTIONS.length, 48, 'forty-eight sections across eight pages');
  const registry = read('src/admin/storefrontSections.js');
  for (const name of ['HERO_SECTION', 'TRUST_SECTION', 'TILES_SECTION', 'STORES_SECTION', 'FESTIVE_SECTION','LIFESTYLE_SECTION', 'JEWELLERY_BANNER_SECTION', 'STORE_CAROUSEL_SECTION', 'DELIVERY_STRIP', 'BENEFITS_STRIP', 'JEWELLERY_SECTIONS', 'HOMELIVING_SECTIONS', 'GROCERY_SECTIONS']) assert.match(registry, new RegExp(`\\b${name}\\b`), name);
  for (const page of ['women', 'men', 'sarees']) assert.match(registry, new RegExp(`each\\('${page}\\.', DEPARTMENT_SECTIONS\\.${page}\\)`), page);
  assert.match(registry, /each\('jewellery\.', JEWELLERY_SECTIONS\)/);
  assert.match(registry, /each\('', HOMELIVING_SECTIONS\)/); assert.match(registry, /each\('', GROCERY_SECTIONS\)/);
});

await test('the built-in content has every field of its schema, the same counts, and passes the editor\'s rules', () => {
  const shape = (spec, value, at) => {
    switch (spec.type) {
      case 'group': for (const [k, f] of Object.entries(spec.fields)) { assert.ok(Object.hasOwn(value, k), `${at}.${k} is built in`); shape(f, value[k], `${at}.${k}`); } break;
      case 'list': assert.equal(value.length, spec.length, `${at} has ${spec.length} entries`); value.forEach((item, i) => shape({ type: 'group', fields: spec.fields }, item, `${at}.${i}`)); break;
      case 'lines': assert.equal(value.length, spec.length, `${at} has ${spec.length} lines`); break;
      case 'pic': assert.ok(value.phone && value.desktop, `${at} has both photographs`); break;
      case 'tone': assert.ok(value.phone && value.desktop && value.colour === '', `${at} has both photographs and no colour of its own`); break;
      case 'bool': assert.equal(value, false, `${at} is shown`); break;
      case 'enum': assert.ok(spec.options.includes(value), `${at} is a preset`); break;
      default: assert.equal(typeof value, 'string', `${at} is text`);
    }
  };
  for (const [store, path, defaults] of SECTIONS) {
    const spec = content.sectionSpec(store, path);
    shape(spec, defaults, `${store}.${path}`);
    // The built-in content, saved as it is, is a valid draft.
    const draft = {}; let node = draft; const keys = path.split('.');
    keys.slice(0, -1).forEach((k) => { node[k] = {}; node = node[k]; });
    node[keys.at(-1)] = strip(spec, defaults);
    assert.deepEqual(content.validateStorefrontContent(store, draft).errors, {}, `${store}.${path}`);
  }
});

/** Only the schema's fields of a value (the page's own extras — icons, ids, original images — left out). */
function strip(spec, value) {
  if (spec.type === 'group') return Object.fromEntries(Object.entries(spec.fields).map(([k, f]) => [k, strip(f, value[k])]));
  if (spec.type === 'list') return value.map((item) => strip({ type: 'group', fields: spec.fields }, item));
  if (spec.type === 'pic') return { phone: value.phone, desktop: value.desktop };
  if (spec.type === 'tone') return { colour: '', phone: '', desktop: '' };
  return value;
}

await test('a section left alone reads back exactly as built in — nothing published, an empty draft, or empty fields', () => {
  for (const [store, path, defaults] of SECTIONS) {
    const spec = content.sectionSpec(store, path);
    assert.deepEqual(content.readSection(spec, {}, defaults), defaults, `${store}.${path} from {}`);
    const empty = (s) => (s.type === 'group' ? Object.fromEntries(Object.entries(s.fields).map(([k, f]) => [k, empty(f)])) : s.type === 'list' ? [] : s.type === 'lines' ? [] : s.type === 'bool' ? false : s.type === 'pic' ? { phone: '', desktop: '' } : s.type === 'tone' ? { colour: '', phone: '', desktop: '' } : '');
    assert.deepEqual(content.readSection(spec, empty(spec), defaults), defaults, `${store}.${path} with every field empty`);
  }
});

console.log('\n— The rules —');

const U = (name) => `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/product-images/storefront/${name}.webp`;

await test('the editor: photographs in pairs, a matched colour with its photographs, presets only, on/off, nothing that is not a field', () => {
  const v = (store, value) => content.validateStorefrontContent(store, value).errors;
  assert.match(v('fashion', { women: { hero: { picture: { phone: U('p'), desktop: '' } } } })['women.hero.picture'], /both photographs, phone and desktop/);
  assert.deepEqual(v('fashion', { women: { hero: { picture: { phone: U('p'), desktop: U('d') } } } }), {});
  assert.deepEqual(v('fashion', { women: { hero: { picture: { phone: '', desktop: '' } } } }), {}, 'both empty: the built-in photographs');
  assert.match(v('homeliving', { promo: { picture: { colour: '', phone: U('p'), desktop: U('d') } } })['promo.picture'], /background colour together/);
  assert.match(v('homeliving', { promo: { picture: { colour: '#F4EFE6', phone: '', desktop: '' } } })['promo.picture'], /together/, 'nor a colour without its photograph');
  assert.match(v('homeliving', { promo: { picture: { colour: 'red', phone: U('p'), desktop: U('d') } } })['promo.picture.colour'], /#F4EFE6/);
  assert.deepEqual(v('homeliving', { promo: { picture: { colour: '#F4EFE6', phone: U('p'), desktop: U('d') } } }), {});
  assert.match(v('grocery', { hero: { position: 'top-left' } })['hero.position'], /left, center, right/);
  assert.deepEqual(v('grocery', { hero: { position: 'center' } }), {});
  assert.match(v('grocery', { trust: { hidden: 'yes' } })['trust.hidden'], /on or off/);
  assert.match(v('wellness', { hero: { slides: [{ title: ['a', 'b', 'c'] }] } })['hero.slides.0.title'], /At most 2 lines/);
  assert.match(v('wellness', { hero: { slides: [{}, {}, {}] } })['hero.slides'], /At most 2/);
  assert.match(v('fashion', { men: { hero: { picture: { phone: U('p'), desktop: U('d'), colour: '#000000' } } } })['men.hero.picture.colour'], /Not a field/, 'a plain photograph pair has no colour');
  assert.match(v('fashion', { men: { hero: { picture: { phone: 'javascript:alert(1)', desktop: U('d') } } } })['men.hero.picture.phone'], /uploaded here/);
  assert.match(v('fashion', { men: { hero: { picture: { phone: '/img/x.webp");background:red', desktop: '/img/y.webp' } } } })['men.hero.picture.phone'], /uploaded here/, 'a shipped photograph is an /img/ image file');
  assert.match(v('fashion', { men: { closing: { link: 'https://evil.example' } } })['men.closing.link'], /starting with \//);
  assert.match(v('fashion', { men: { closing: { title: 'x'.repeat(81) } } })['men.closing.title'], /80 characters/);
  assert.match(v('fashion', { men: { hero: { colour: '#000000' } } })['men.hero.colour'], /Not a field/);
});

await test('the page: a field that breaks its rule falls back to the built-in value, field by field', () => {
  const spec = content.sectionSpec('fashion', 'women.hero');
  const built = department.DEPARTMENT_SECTIONS.women.hero;
  const read = content.readSection(spec, {
    eyebrow: 'x'.repeat(61), title: ['New', 'x'.repeat(31), 42], intro: 'Line\u0000', cta: 'Shop', link: '//evil.example',
    picture: { phone: U('p') }, alt: 'A new photograph', position: 'diagonal', hidden: 'yes',
  }, built);
  assert.equal(read.eyebrow, built.eyebrow, 'too long');
  assert.deepEqual(read.title, ['New', built.title[1], built.title[2]], 'each line on its own');
  assert.equal(read.intro, built.intro, 'a control character');
  assert.equal(read.cta, 'Shop');
  assert.equal(read.link, built.link, 'not a page of this site');
  assert.equal(read.picture, built.picture, 'one photograph of the two');
  assert.equal(read.alt, 'A new photograph');
  assert.equal(read.position, 'left'); assert.equal(read.hidden, false);
  const tone = content.sectionSpec('grocery', 'promo').fields.picture;
  const def = grocery.GROCERY_SECTIONS.promo.picture;
  assert.equal(content.readSection(tone, { colour: 'red', phone: U('p'), desktop: U('d') }, def), def, 'a colour that is not #RRGGBB');
  assert.deepEqual(content.readSection(tone, { colour: '#AABBCC', phone: U('p'), desktop: U('d') }, def), { colour: '#AABBCC', phone: U('p'), desktop: U('d') });
});

await test('the build copies a section\'s photographs like any other upload, and writes them back as the site\'s own files', () => {
  const store = { women: { hero: { picture: { phone: U('wp'), desktop: U('wd') } } }, jewellery: { hero: { picture: { phone: U('jp'), desktop: '/img/x.webp' } } } };
  assert.deepEqual(content.contentImages('fashion', store), [U('wp'), U('wd'), U('jp'), '/img/x.webp']);
  const mapped = content.mapContentImages('fashion', store, (u) => (u.startsWith('https:') ? `/img/published/${u.slice(-7)}` : u));
  assert.deepEqual(mapped.women.hero.picture, { phone: '/img/published/wp.webp', desktop: '/img/published/wd.webp' });
  assert.deepEqual(content.contentImages('homeliving', { promo: { picture: { colour: '#F4EFE6', phone: U('a'), desktop: U('b') } } }), [U('a'), U('b')]);
});

console.log('\n— The pages —');

const baselineDir = exportBaseline(BASELINE_SHA);
const dump = (env) => JSON.parse(execFileSync(process.execPath, [join(REPO, 'scripts', 'storefront-sections-dump.mjs')], { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }));
const now = dump({});

await test(`with nothing published, every page renders exactly as it did before the sections were editable (${BASELINE_SHA}), byte for byte`, () => {
  const then = dump({ FASHION_SRC_ROOT: baselineDir, GROCERY_SRC_ROOT: baselineDir });
  assert.deepEqual(Object.keys(now), Object.keys(then));
  assert.equal(Object.keys(now).length, 15);
  // The fashion category strip under the Lifestyle banner is not an editable section; it gained the
  // men's five photographed tiles since (test-store-doorway.mjs pins it), so it is left out of the comparison.
  const sansStrip = (page, html) => (page === '/#lifestyleBanner' ? html.replace(/<section class="fsb-strip"[\s\S]*?<\/section>/, '') : html);
  // The site name changed since (test-site-name.mjs owns it): a few labels that are not editable sections carry it.
  const sansSiteName = (html) => html.replace(/SORA LIFESTYLE/g, 'SORA LIFE').replace(/Sora Lifestyle/g, 'Sora Life');
  for (const page of Object.keys(then)) assert.equal(sansStrip(page, sansSiteName(now[page])), sansStrip(page, then[page]), page);
});

const PUBLISHED = { stores: {
  wellness: {
    hero: { slides: [{ title: ['Published', 'hero'], ctaLabel: 'Go there', ctaLink: '/shop?edit=1', picture: { colour: '#F4EFE6', phone: U('hp'), desktop: U('hd') }, position: 'right' }, { hidden: true }] },
    trust: { items: [{ title: ['Published', 'trust'] }, { link: '/about' }, {}, { hidden: true }] },
    tiles: { fashion: { title: ['Dressed', 'for', 'today.'], cta: 'See fashion', picture: { colour: '#1D2A44', phone: U('fp'), desktop: U('fd') } }, living: { hidden: true } },
    stores: { title: 'Published stores', items: [{ name: 'Wellbeing', picture: { colour: '#EEE8DD', phone: U('cp'), desktop: U('cd') } }, { hidden: true }] },
    promo: { title: 'Published gifting', position: 'left', link: '/shop?gift=1' },
    lifestyleBanner: { hidden: true },
    jewelleryBanner: { eyebrow: 'Published jewels', position: 'center', picture: { phone: U('jp'), desktop: U('jd') }, link: '/fashion/jewellery?edit=1' },
    storeCarousel: { title: 'Published worlds', cards: [{}, { hidden: true }] },
  },
  fashion: {
    strips: { delivery: { promise: 'Published delivery promise' }, benefits: { items: [{ hidden: true }] } },
    women: {
      hero: { eyebrow: 'Published women', title: ['One', 'Two', ''], link: '/fashion/c/dresses', picture: { phone: U('wp'), desktop: U('wd') }, alt: 'Published alt', position: 'center' },
      capsule: { hidden: true },
      categories: { items: [{ title: 'Published tile', link: '/fashion/c/knitwear' }] },
    },
    men: { hero: { title: ['x'.repeat(31), 'Valid'] }, closing: { title: 'Published closing' } },
    sarees: { collections: { title: ['Published', 'Collections'] }, services: { hidden: true } },
    jewellery: { hero: { picture: { phone: U('jhp'), desktop: U('jhd') } }, trust: { items: [{ title: 'Published trust' }] } },
  },
  homeliving: { hero: { headline: 'Published home', picture: { colour: '#EFE7DA', phone: U('lp'), desktop: U('ld') }, position: 'right' }, promo: { badges: [{ hidden: true }] } },
  grocery: { trust: { hidden: true }, promo: { picture: { colour: '#FFF4E0', phone: U('gp'), desktop: U('gd') } } },
} };
const dir = mkdtempSync(join(process.env.TEMP || tmpdir(), 'storefront-sections-'));
writeFileSync(join(dir, 'published.json'), JSON.stringify(PUBLISHED));
const pub = dump({ STOREFRONT_PUBLISHED: join(dir, 'published.json') });
rmSync(dir, { recursive: true, force: true });
const amp = (u) => u.replace(/&/g, '&amp;');

await test('the wellness homepage: the hero\'s copy, button, photographs, matched colour and position; a hidden slide and a hidden banner gone; the jewellery banner and the carousel changed', () => {
  const hero = pub['/#hero'];
  assert.match(hero, /<span>Published<\/span> <span class="hx-hl">hero<\/span>/);
  assert.match(hero, /data-pos="right" data-tone="" style="--sf-tone:#F4EFE6"/);
  assert.ok(hero.includes(`srcSet="${U('hp')}"`), 'the phone photograph');
  assert.match(hero, new RegExp(`href="${amp('/shop?edit=1').replace(/[?.]/g, '\\$&')}"[^>]*>Go there`));
  assert.equal((hero.match(/hx-hero__slide /g) || []).length, 1, 'the hidden slide is gone');
  assert.doesNotMatch(hero, /hx-hero__dots/, 'and with one slide there are no dots');
  assert.doesNotMatch(pub['/#lifestyleBanner'], /fsb-lead"/, 'the hidden banner is gone');
  assert.match(pub['/#lifestyleBanner'], /fsb-strip/, 'the category strip under it stays');
  const jewel = pub['/#jewelleryBanner'];
  assert.match(jewel, /class="hx hx-jewel" data-pos="center"/); assert.match(jewel, /Published jewels/);
  assert.match(jewel, /href="\/fashion\/jewellery\?edit=1"/);
  // Its photograph loads as it scrolls near (DeferredImage), so it is read from what the banner is given.
  const banner = wellness.jewelleryBannerOf(content.readSection(content.sectionSpec('wellness', 'jewelleryBanner'), PUBLISHED.stores.wellness.jewelleryBanner, wellness.JEWELLERY_BANNER_SECTION));
  assert.equal(banner.wide.src, U('jd')); assert.equal(banner.tall, U('jp'));
  // The trust strip: a new title (two lines on a phone), a link added, a hidden item, the rest even.
  const trust = pub['/#trust'];
  assert.match(trust, /<ul class="hx-wrap hx-trust__list" data-count="3" style="--hx-trust-n:3">/);
  assert.match(trust, /<li class="hx-trust--split"><a href="\/shipping">[\s\S]*?<strong><span>Published<\/span><span> trust<\/span><\/strong><small>On every order<\/small>/, 'an empty line under it is the built-in one');
  assert.match(trust, /<a href="\/about">[\s\S]*?Genuine/, 'a link where there was none');
  assert.doesNotMatch(trust, /Support/, 'the hidden item');
  // The tiles: the large one's headline, button, photographs and a dark panel colour (light copy); a hidden tile closed up.
  const tiles = pub['/#tiles'];
  assert.match(tiles, /<div class="hx-wrap hx-tiles__grid" data-without="living">/);
  assert.match(tiles, /class="hx-tile hx-tile--fashion" data-tone="" data-tone-dark="" style="--sf-tone:#1D2A44"/);
  assert.match(tiles, /<h2 class="hx-tile__h" id="hx-fashion-h"><span>Dressed<\/span> <span>for<\/span> <span>today\.<\/span><\/h2>/);
  assert.match(tiles, />See fashion </); assert.doesNotMatch(tiles, /hx-tile--living/);
  const fashionTile = content.readSection(content.sectionSpec('wellness', 'tiles'), PUBLISHED.stores.wellness.tiles, wellness.TILES_SECTION).fashion.picture;
  assert.deepEqual(fashionTile, { colour: '#1D2A44', phone: U('fp'), desktop: U('fd') });
  // The circles: a heading, a renamed circle on its own colour, a hidden one, the row even.
  const stores = pub['/#stores'];
  assert.match(stores, /<h2 class="hx-stores__h" id="hx-stores-h">Published stores<\/h2>/);
  assert.match(stores, /<ul class="hx-stores__row" data-count="5" style="--hx-stores-n:5">/);
  assert.match(stores, /<span class="hx-store__art" data-tone="" style="--sf-tone:#EEE8DD">[\s\S]*?<span class="hx-store__name">Wellbeing<\/span>/);
  assert.doesNotMatch(stores, /Personal Care/, 'the hidden circle');
  // The festive promo: its headline, link and the copy moved left of its built-in centre.
  const promo = pub['/#promo'];
  assert.match(promo, /<section class="hx hx-promo" data-pos="left"/); assert.match(promo, /Published gifting/); assert.match(promo, /href="\/shop\?gift=1"/);
  const carousel = pub['/#storeCarousel'];
  assert.match(carousel, /<h2 id="fsb-h">Published worlds<\/h2>/);
  assert.equal((carousel.match(/fsb__card fsb__card--/g) || []).length, 1); assert.doesNotMatch(carousel, /fsb__dots/);
});

await test('fashion: the strips; the women\'s hero (copy, lines, link, both photographs, description, position), a hidden section, a tile; the men\'s fallback; the saree heading; the jewellery hero\'s photograph and its blurred copy', () => {
  assert.match(pub['/fashion'], /Published delivery promise/); assert.doesNotMatch(pub['/fashion'], /Delivery in 6–7 business days/);
  assert.doesNotMatch(pub['/fashion'], /Free standard<br\/>/, 'the hidden benefit');
  assert.match(pub['/fashion'], /UPI &amp; cards<br\/>at checkout/);
  const women = pub['/fashion/women'];
  assert.match(women, /<section class="wm-hero" data-pos="center"/);
  assert.match(women, /<h1 id="wm-title"><span>One<\/span><span>Two<\/span><span>You\.<\/span><\/h1>/, 'an empty line is the built-in line');
  assert.match(women, /<p class="wm-eyebrow">Published women<\/p>/);
  assert.match(women, /<a class="wm-button" href="\/fashion\/c\/dresses">/);
  assert.ok(women.includes(`<source media="(max-width: 700px)" srcSet="${U('wp')}"/><img src="${U('wd')}"`), 'phone and desktop photographs, no built-in srcset');
  assert.match(women, /alt="Published alt"/);
  assert.doesNotMatch(women, /wm-capsule/, 'the hidden section');
  assert.match(women, /<a class="wm-category" href="\/fashion\/c\/knitwear">[\s\S]*?<span>Published tile<\/span>/);
  const men = pub['/fashion/men'];
  assert.match(men, /<span>Summer<\/span><span>Valid<\/span>/, 'a line too long is the built-in line');
  assert.match(men, /<h2>Published closing<\/h2>/);
  assert.match(pub['/fashion/women/sarees'], /<h2 id="sw-collections-title">Published<br\/> Collections<\/h2>/);
  assert.doesNotMatch(pub['/fashion/women/sarees'], /sw-services/);
  const jw = pub['/fashion/jewellery'];
  assert.ok(jw.includes(`data-art="" style="--jw-hero-art:url(&quot;${U('jhd')}&quot;)"`), 'the blurred backdrop follows the photograph');
  assert.ok(jw.includes(`srcSet="${U('jhp')}"`)); assert.match(jw, /<strong>Published trust<\/strong>/);
});

await test('Home & Living and grocery: the hero\'s copy, both photographs, wash colour and position; hidden badges and a hidden strip; the promo\'s photograph and panel colour', () => {
  const hl = pub['/homeliving'];
  assert.match(hl, /Published home/);
  assert.match(hl, /data-pos="right" data-tone="" style="--sf-tone:#EFE7DA"/);
  assert.ok(hl.includes(`<source media="(max-width: 767px)" srcSet="${U('lp')}"/><img class="hl-hero__img" src="${U('ld')}"`));
  assert.doesNotMatch(hl, /<span>Natural Fabrics<\/span>/, 'the hidden badge');
  const gs = pub['/grocery'];
  assert.doesNotMatch(gs, /gs-trust/, 'the hidden strip');
  assert.match(gs, /<section class="gs-promo" data-tone="" style="--sf-tone:#FFF4E0"/);
  assert.ok(gs.includes(`<picture><source media="(max-width: 700px)" srcSet="${U('gp')}"/><img src="${U('gd')}"`));
});

console.log('\n— The admin —');

await test('the admin page edits every store\'s sections: each photograph twice through the WebP converter, a matched colour beside its photographs, presets, show/hide, and the claim checker on every word', () => {
  const page = read('src/admin/pages/Storefronts.jsx');
  const editor = read('src/admin/components/StorefrontSectionEditor.jsx');
  for (const store of content.STOREFRONT_CONTENT_STORES) assert.match(page, new RegExp(`  ${store}: \\{ form:`), store);
  assert.match(page, /<SectionPages store=\{tab\}/);
  assert.match(page, /validateStorefrontContent\(tab, forms\[tab\]\)/, 'the whole store is checked before a save');
  assert.match(page, /href=\{`\$\{page\.href\}\?preview=draft`\}/, 'each page previews its saved draft');
  assert.match(editor, /await uploadStorefrontImage\(file\)/, 'every upload goes through the WebP converter');
  assert.match(editor, /label="Phone"[\s\S]*label="Desktop"/, 'two uploads per photograph');
  assert.match(editor, /tone && \(/); assert.match(editor, /type="color"/);
  assert.match(editor, /spec\.options\.map/, 'the position presets');
  assert.match(editor, /Hide it on the site/);
  assert.match(editor, /claimWarnings\(text\)/, 'every word is read by the claim checker');
  assert.doesNotMatch(editor, /dangerouslySetInnerHTML|style=\{\{[^}]*url\(/);
});

await test('nothing the storefront renders imports the editor, the admin registry, the converter or the claim checker; colours reach a page only as a checked #RRGGBB', () => {
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!p.includes(`${join('src', 'admin')}`)) walk(p); } else if (/\.(jsx?|mjs)$/.test(n)) files.push(p); } };
  walk(join(REPO, 'src'));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (/src[\\/]lib[\\/](storeCatalogue(AdminApi|Image|Csv|Admin)|claimWarnings)\.js$/.test(f)) continue;
    assert.doesNotMatch(src, /StorefrontSectionEditor|admin\/storefrontSections|claimWarnings|compressToWebp/, relative(REPO, f));
  }
  // Every rule of the sections' sheet needs an attribute only an admin's setting puts on a section.
  const css = read('src/styles/storefront-sections.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, sel]) => sel.split(','));
  assert.ok(selectors.length > 40);
  for (const sel of selectors) assert.match(sel, /\[data-(pos|tone|tone-dark|art|count|without)\b/, sel.trim());
  assert.doesNotMatch(css, /url\(|expression|@import/, 'no file of its own: a replaced photograph arrives as a checked custom property');
  assert.match(read('build/build-css.mjs'), /'src\/styles\/fashion-choice\.css',\n[\s\S]*'src\/styles\/storefront-sections\.css',\n\];/, 'the last sheet of the storefront cascade');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
