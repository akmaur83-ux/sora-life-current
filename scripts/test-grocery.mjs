// ============================================================
// Grocery store — shell + homepage. Offline suite.
//
// The data file (the one place content lives), the images (renamed,
// WebP, under 150 KB, no text baked in), the real shell and homepage
// rendered through the real router, the delivery copy (one factual
// promise, nothing faster), the shared cart's grocery namespace (wellness
// and fashion lines byte-identical to the pre-change reducer), the
// stylesheet's three widths, and the isolation of everything else.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-grocery.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-grocery.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, buildGroceryApp, loadModule, loadGroceryData, CATEGORIES, PRODUCTS } from './grocery-ssr.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The tip before the grocery store existed (the Phase 2 bundle commit). Pinned,
// not HEAD, so the comparisons stay meaningful after the grocery commit lands.
const BASELINE_SHA = '5401f3a';
const atBaseline = (rel) => execFileSync('git', ['show', `${BASELINE_SHA}:${rel}`], { cwd: REPO, encoding: 'utf8' }).replace(/\r\n/g, '\n');
let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
console.log(`\nsource root: ${ROOT}`);

const NEW_FILES = ['src/data/groceryHomepage.js', 'src/lib/groceryCartLine.js', 'src/lib/catalogueCartCache.js', 'src/grocery/GroceryLayout.jsx', 'src/grocery/GroceryHome.jsx', 'src/grocery/GroceryProductCard.jsx', 'src/styles/grocery.css'];
// The one delivery promise. Anything faster is a false claim, not a style.
const FORBIDDEN_DELIVERY = [/\b10\s*-?\s*min/i, /\b30\s*-?\s*min/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\binstant/i, /\bfast(er)?\s+(&\s+reliable\s+)?deliver/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\bexpress\b/i];

// The data module, with the network stubbed and the catalogue seeded with
// rows shaped like catalogue_categories / catalogue_products (the 0034 seed).
let data = null;
try { data = loadGroceryData(); } catch { data = null; }
const priceOf = (p) => (data?.priceOf ? data.priceOf(p) : null);

// ============================================================
console.log('\n— The data module: the catalogue tables, plus the homepage copy —');
// ============================================================

await test('src/data/groceryHomepage.js is the grocery data layer: queries, the catalogue hook, and the homepage copy — no product or category literals', () => {
  assert.ok(has('src/data/groceryHomepage.js'), 'the data module is missing');
  assert.ok(data, 'the module loads');
  for (const k of ['HERO_SLIDES', 'DAILY_ESSENTIALS', 'PROMO', 'GROCERY_DELIVERY_WINDOW', 'GROCERY_TAGLINE', 'GROCERY_STORE', 'categoryHref', 'getGroceryCategories', 'getGroceryProducts', 'getGroceryProductsByIds', 'useGroceryCatalogue', 'seedGroceryCatalogue', 'priceOf', 'groceryProductView']) assert.ok(k in data, `exports ${k}`);
  assert.equal(data.GROCERY_DELIVERY_WINDOW, '6-7 days'); assert.equal(data.GROCERY_STORE, 'grocery');
  const src = stripComments(read('src/data/groceryHomepage.js'));
  assert.doesNotMatch(src, /TEMPORARY/, 'the literals are gone');
  assert.doesNotMatch(src, /Sona Masoori|Masoor Dal|Whole Wheat|Sunflower Oil|grocery-circle-|grocery-product-|net_content: '/, 'no category or product literal remains (the hero/promo may still LINK to a category slug)');
  assert.match(src, /from\('catalogue_categories'\)/); assert.match(src, /from\('catalogue_products'\)/);
  assert.doesNotMatch(src, /from\('(fashion|grocery)_/, 'only the shared catalogue tables');
});

await test('hero: an array (one slide for now) whose copy is text — headline, subline, CTA, href, and a photograph', () => {
  assert.ok(Array.isArray(data.HERO_SLIDES) && data.HERO_SLIDES.length >= 1);
  for (const s of data.HERO_SLIDES) {
    for (const k of ['id', 'image', 'headline', 'sub', 'cta', 'href']) assert.ok(typeof s[k] === 'string' && s[k].length > 0, `slide ${s.id}: ${k}`);
    assert.match(s.image, /^\/img\/grocery-[a-z0-9-]+\.webp$/);
    assert.match(s.href, /^\/grocery\//);
  }
});

await test('the seeded catalogue: ten categories (schema field names, image_url) and four products (images[], net_content, mrp/sale_price) with a data-layer price', () => {
  const { categories, products } = data.getGroceryCatalogue();
  assert.equal(categories.length, 10); assert.equal(products.length, 4);
  const slugs = new Set();
  for (const c of categories) {
    assert.match(c.slug, /^[a-z0-9-]+$/); assert.ok(!slugs.has(c.slug)); slugs.add(c.slug);
    assert.equal(c.store, 'grocery'); assert.ok(c.name && c.image_url); assert.ok(!('image' in c), 'schema names only');
    assert.equal(data.categoryHref(c), `/grocery/category/${c.slug}`);
  }
  for (const p of products) {
    for (const k of ['id', 'slug', 'brand', 'name', 'net_content']) assert.ok(typeof p[k] === 'string' && p[k], `${p.slug}: ${k}`);
    assert.ok(Array.isArray(p.images) && p.images[0], `${p.slug}: images[]`);
    assert.ok(!('pack' in p) && !('image' in p), 'schema names only');
    assert.equal(p.price, data.priceOf(p)); assert.ok(p.price > 0 && p.mrp >= p.price, `${p.slug}: price ≤ mrp`);
  }
  assert.equal(data.priceOf({ mrp: 100, sale_price: 80 }), 80); assert.equal(data.priceOf({ mrp: 100, sale_price: null }), 100);
  assert.equal(data.priceOf({ mrp: 100, sale_price: 120 }), 100, 'a sale above MRP is ignored'); assert.equal(data.priceOf({ mrp: 100, sale_price: 0 }), 100);
  assert.equal(data.DAILY_ESSENTIALS.title, 'Daily essentials'); assert.equal(data.DAILY_ESSENTIALS.limit, 4);
});

await test('every image the migration seeds and the homepage copy names exists, is WebP, and is under 150 KB', () => {
  const sql = read('supabase/migrations/0034_catalogue_multistore.sql');
  const seeded = [...sql.matchAll(/'(\/img\/grocery-[a-z0-9-]+\.webp)'/g)].map((m) => m[1]);
  const images = [...new Set([...data.HERO_SLIDES.map((s) => s.image), data.PROMO.image, ...seeded])];
  assert.equal(images.length, 16, 'sixteen distinct photographs');
  for (const rel of images) {
    const file = resolve(ROOT, rel.replace(/^\//, ''));
    const size = statSync(file).size;
    assert.ok(size < 150 * 1024, `${rel} is ${(size / 1024).toFixed(0)} KB`);
    const head = readFileSync(file).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP', `${rel} is WebP`);
  }
});

await test('no component hardcodes product or category data: every name and price the page shows is in the data file', () => {
  for (const rel of ['src/grocery/GroceryLayout.jsx', 'src/grocery/GroceryHome.jsx', 'src/grocery/GroceryProductCard.jsx']) {
    const src = stripComments(read(rel));
    assert.doesNotMatch(src, /\/img\/grocery-/, `${rel} names no image`);
    assert.doesNotMatch(src, /price:\s*\d|₹\s*\d/, `${rel} carries no price`);
    for (const p of PRODUCTS) assert.ok(!src.includes(p.name), `${rel} does not hardcode "${p.name}"`);
    for (const c of CATEGORIES) assert.ok(!src.includes(`'${c.slug}'`), `${rel} does not hardcode "${c.slug}"`);
    assert.match(src, /from '\.\.\/data\/groceryHomepage\.js'|GroceryProductCard/, `${rel} reads the data module (or is the card)`);
    assert.doesNotMatch(src, /\b(c|p|product)\.(pack|image)\b/, `${rel} reads schema field names (image_url, images[], net_content), not the old literals`);
  }
});

// ============================================================
console.log('\n— Delivery copy: one promise, nothing faster —');
// ============================================================

await test('"Delivery in 6-7 days" is the badge; no 10-minute, 30-minute, instant or fast-delivery copy exists in any new file', () => {
  for (const rel of NEW_FILES) {
    const src = read(rel);
    for (const re of FORBIDDEN_DELIVERY) assert.ok(!re.test(src), `${rel} matches ${re}`);
  }
});

// ============================================================
console.log('\n— The shell and the homepage, rendered through the real router —');
// ============================================================

const app = await buildGroceryApp({ cartCount: 3 }).catch((e) => ({ error: e }));
const home = app.error ? '' : app.render('/grocery');

await test('header: cream shell, hamburger, centred SORA LIFE wordmark in the serif with the tagline beneath, inert wishlist, cart with the shared count', () => {
  assert.ok(!app.error, app.error?.message);
  assert.match(home, /^<div class="gs"><header class="gs-hdr"><div class="gs-hdr__row"><button type="button" class="gs-hdr__menu" aria-label="Open menu">/);
  assert.match(home, /<a class="gs-logo" aria-label="SORA LIFE grocery home" href="\/grocery"><strong class="serif">SORA LIFE<\/strong><em>Good food, brighter days<\/em><\/a>/);
  assert.match(home, /<button type="button" class="gs-hdr__act" aria-label="Wishlist" aria-disabled="true">/);
  assert.match(home, /<a class="gs-hdr__act" aria-label="Cart, 3 items" href="\/cart">[\s\S]*?<span class="gs-hdr__count">3<\/span><\/a>/);
  const empty = app.render('/grocery');
  assert.ok(empty.includes('gs-hdr__count'), 'count shown at 3');
  const css = read('src/styles/grocery.css');
  assert.match(css, /\.gs \{[^}]*--gs-hdr: #F7F3EA/); assert.match(css, /\.gs-hdr \{[^}]*background: var\(--gs-hdr\)/);
  assert.match(css, /\.gs-hdr__row \{[^}]*grid-template-columns: 1fr auto 1fr/, 'the wordmark is centred between equal columns');
  assert.match(css, /\.gs \.serif \{[^}]*font-family: var\(--font-display, 'Playfair Display'/);
});

await test('below the header: the static address row and a badge reading exactly "Delivery in 6-7 days"; the search bar is visual only', () => {
  assert.match(home, /<div class="gs-deliver" aria-label="Delivery"><span class="gs-deliver__addr">[\s\S]*?<b>Deliver to Home /);
  assert.match(home, /<span class="gs-deliver__badge">[\s\S]*?<\/svg> Delivery in 6-7 days<\/span>/);
  assert.doesNotMatch(read('src/grocery/GroceryLayout.jsx'), /geolocation|navigator\.|fetch\(/, 'no geolocation, no requests');
  assert.match(home, /<input type="search" placeholder="Search for groceries, staples, and more\.\.\." aria-label="Search groceries \(coming soon\)" readonly=""\/>/);
  assert.doesNotMatch(home, /<form/, 'nothing submits');
});

await test('bottom nav: Home / Categories / Offers / Orders / Account — only Home is a link and current; the rest are inert spans, never 404s', () => {
  const nav = home.slice(home.indexOf('<nav class="gs-nav"'), home.indexOf('</nav>', home.indexOf('<nav class="gs-nav"')) + 6);
  const labels = [...nav.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Home', 'Categories', 'Offers', 'Orders', 'Account']);
  assert.match(nav, /<a class="gs-nav__item is-on" aria-current="page" href="\/grocery">/);
  assert.equal((nav.match(/<a /g) || []).length, 1, 'Home is the only link');
  assert.equal((nav.match(/aria-disabled="true"/g) || []).length, 4, 'four inert items');
  assert.doesNotMatch(nav, /href="\/grocery\/(categories|offers|orders|account)/);
});

await test('section order: trust strip → hero → category circles → Daily essentials → promo', () => {
  const marks = ['<ul class="gs-trust"', '<section class="gs-hero"', '<nav class="gs-circles"', 'id="gs-daily-h"', '<section class="gs-promo"'];
  const idx = marks.map((m) => home.indexOf(m));
  assert.ok(idx.every((i) => i >= 0), `every section present: ${idx}`);
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'in the specified order');
  assert.ok(home.indexOf('<main class="gs-main">') < idx[0], 'inside main');
  assert.ok(home.indexOf('data-stub="footer"') > idx[4], 'the shared footer follows');
});

await test('trust strip: exactly the three items', () => {
  const strip = home.slice(home.indexOf('<ul class="gs-trust"'), home.indexOf('</ul>', home.indexOf('<ul class="gs-trust"')));
  const items = [...strip.matchAll(/<strong>([^<]+)<\/strong><em>([^<]+)<\/em>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(items, [['Standard Delivery', '6-7 days'], ['Fresh Products', 'Sourced with care'], ['Trusted Quality', 'Good food, safer lives']]);
});

await test('hero: the slide copy is HTML over a photograph — h1, subline, gold CTA link, dot per slide; the image has an empty alt', () => {
  const hero = home.slice(home.indexOf('<section class="gs-hero"'), home.indexOf('</section>', home.indexOf('<section class="gs-hero"')));
  const s = data.HERO_SLIDES[0];
  assert.match(hero, /aria-roledescription="carousel"/);
  assert.match(hero, /<img class="gs-hero__img" src="\/img\/grocery-hero\.webp" alt="" width="1600" height="900"[^>]*fetchpriority="high" loading="eager"\/>/);
  assert.ok(hero.includes(`<h1 class="gs-hero__h serif">${s.headline}</h1>`), 'headline is an h1');
  assert.ok(hero.includes(`<p class="gs-hero__sub">${s.sub.replace(/&/g, '&amp;')}</p>`), 'subline is a p');
  assert.ok(hero.includes(`<a class="gs-hero__cta" tabindex="0" href="${s.href}">${s.cta} <svg`), 'CTA is a link');
  assert.equal((hero.match(/class="gs-hero__dot( is-on)?"/g) || []).length, data.HERO_SLIDES.length, 'one dot per slide');
  assert.match(hero, /<div class="gs-hero__track" style="transform:translateX\(-0%\)">/, 'the track moves on transform only');
  const css = read('src/styles/grocery.css');
  assert.match(css, /\.gs-hero__cta, \.gs-promo__cta \{[^}]*background: var\(--slv2-gold\)/, 'gold CTA');
});

await test('hero carousel: several slides render one visible, the rest aria-hidden with their CTAs out of the tab order; autoplay only with 2+, pauses on hover/focus, honours reduced motion', () => {
  const { HeroCarousel } = app.modules.home;
  const three = [1, 2, 3].map((i) => ({ ...data.HERO_SLIDES[0], id: `s${i}`, headline: `Slide ${i}` }));
  const html = renderToStaticMarkup(h(StaticRouter, { location: '/grocery' }, h(HeroCarousel, { slides: three })));
  assert.equal((html.match(/<article class="gs-hero__slide" aria-hidden="true"/g) || []).length, 2); assert.equal((html.match(/gs-hero__slide is-on/g) || []).length, 1);
  assert.equal((html.match(/tabindex="-1"/g) || []).length, 2); assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.match(html, /aria-label="1 of 3"/);
  const src = stripComments(read('src/grocery/GroceryHome.jsx'));
  assert.match(src, /if \(slides\.length < 2 \|\| paused\) return undefined;/, 'no timer for a single slide or while paused');
  assert.match(src, /setInterval\(\(\) => \{ if \(!reduced\.current\) setIndex/, 'reduced motion never advances');
  assert.match(src, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(src, /onMouseEnter=\{\(\) => setPaused\(true\)\} onMouseLeave=\{\(\) => setPaused\(false\)\} onFocus=\{\(\) => setPaused\(true\)\} onBlur=\{\(\) => setPaused\(false\)\}/);
  assert.match(src, /clearInterval\(t\)/);
});

await test('category circles: ten links, two rows of five, each /grocery/category/<slug> with its photo and its name as text', () => {
  const circles = home.slice(home.indexOf('<nav class="gs-circles"'), home.indexOf('</nav>', home.indexOf('<nav class="gs-circles"')));
  const links = [...circles.matchAll(/<a class="gs-circle" href="([^"]+)"><span class="gs-circle__img"><img src="([^"]+)" alt="" loading="lazy"[^>]*><\/span><span class="gs-circle__name">([^<]+)<\/span><\/a>/g)];
  assert.equal(links.length, 10);
  assert.deepEqual(links.map((m) => m[1]), CATEGORIES.map((c) => `/grocery/category/${c.slug}`));
  assert.deepEqual(links.map((m) => m[2]), CATEGORIES.map((c) => c.image_url), 'the circle is the row\'s image_url');
  assert.deepEqual(links.map((m) => m[3].replace(/&amp;/g, '&')), CATEGORIES.map((c) => c.name));
  const css = read('src/styles/grocery.css');
  assert.match(css, /\.gs-circles \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/, 'five across on a wide screen');
  const phone = css.slice(css.indexOf('@media (max-width: 599px)'));
  assert.match(phone, /\.gs-circles \{[^}]*grid-template-rows: repeat\(2, auto\)[^}]*overflow-x: auto/, 'two rows, scrolling sideways on a phone');
});

await test('Daily essentials: four cards with image, brand, name, pack, price and an Add button; "See all" links out', () => {
  assert.match(home, /<h2 class="gs-sec__h serif" id="gs-daily-h">Daily essentials<\/h2><p class="gs-sec__sub">Good food for a brighter you<\/p>/);
  assert.match(home, /<a class="gs-sec__link" href="\/grocery\/category\/everyday-staples">See all /);
  const cards = [...home.matchAll(/<article class="gs-card" data-product="([^"]+)">[\s\S]*?<\/article>/g)];
  assert.equal(cards.length, 4);
  cards.forEach((m, i) => {
    const p = PRODUCTS[i]; const c = m[0]; const price = priceOf(p);
    assert.equal(m[1], p.slug);
    assert.ok(c.includes(`<img src="${p.images[0]}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}"`), `${p.slug}: photo (images[0]), first two eager`);
    assert.ok(c.includes(`<p class="gs-card__brand">${p.brand}</p>`), 'brand line');
    assert.ok(c.includes(`<h3 class="gs-card__name">${p.name}</h3>`), 'name');
    assert.ok(c.includes(`<p class="gs-card__pack">${p.net_content}</p>`), 'net content');
    assert.ok(c.includes(`<p class="gs-price" data-price="${price}"><strong>₹${price}</strong><s class="gs-price__mrp">₹${p.mrp}</s>`), 'the data layer\'s price, MRP struck');
    assert.ok(c.includes(`<button type="button" class="gs-add" aria-label="Add ${p.name} ${p.net_content} to cart">Add</button>`), 'Add');
  });
});

await test('promo strip: photograph left, HTML headline + subline + gold CTA right', () => {
  const promo = home.slice(home.indexOf('<section class="gs-promo"'));
  assert.match(promo, /^<section class="gs-promo" aria-labelledby="gs-promo-h"><div class="gs-promo__art" aria-hidden="true"><img src="\/img\/grocery-promo\.webp" alt="" loading="lazy"/);
  assert.ok(promo.includes(`<h2 class="gs-promo__h serif" id="gs-promo-h">${data.PROMO.headline}</h2><p class="gs-promo__sub">${data.PROMO.sub}</p><a class="gs-promo__cta" href="${data.PROMO.href}">${data.PROMO.cta} <svg`));
  assert.match(read('src/styles/grocery.css'), /\.gs-promo \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.2fr\)/);
});

await test('text-in-image rule: every <img> on the page is decorative (alt=""), and every headline, label and price is in the HTML text', () => {
  const imgs = [...home.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  assert.ok(imgs.length >= 16, `${imgs.length} images`);
  for (const i of imgs) assert.match(i, / alt=""/, `${i.slice(0, 60)} carries no text`);
  const t = text(home);
  for (const s of data.HERO_SLIDES) for (const k of ['headline', 'sub', 'cta']) assert.ok(t.includes(s[k]), `hero ${k}`);
  for (const c of CATEGORIES) assert.ok(t.includes(c.name), c.name);
  for (const p of PRODUCTS) { assert.ok(t.includes(p.name)); assert.ok(t.includes(`₹${priceOf(p)}`)); assert.ok(t.includes(p.net_content)); }
  for (const k of ['headline', 'sub', 'cta']) assert.ok(t.includes(data.PROMO[k]), `promo ${k}`);
  assert.ok(t.includes('Delivery in 6-7 days'));
});

await test('the Add button calls the shared store\'s grocery add path with the product from the data file', () => {
  const src = stripComments(read('src/grocery/GroceryProductCard.jsx'));
  assert.match(src, /const \{ addGroceryToCart \} = useStore\(\);/);
  assert.match(src, /onClick=\{\(\) => addGroceryToCart\(product\)\}/);
  assert.doesNotMatch(src, /product\.(price|mrp)\s*[+\-*/]|[+\-*/]\s*product\.(price|mrp)|qty\s*[*+]/, 'no price arithmetic in the component');
});

// ============================================================
console.log('\n— The shared cart: the grocery namespace; wellness and fashion unchanged —');
// ============================================================

/** The reducer alone, lifted out of store.jsx and compiled with its two catalogue helpers in scope. */
function loadReducer(source, deps) {
  const start = source.indexOf('function reducer(state, action) {');
  const end = source.indexOf('\nexport function StoreProvider');
  assert.ok(start > 0 && end > start, 'reducer found');
  const body = source.slice(start, end);
  return new Function(...Object.keys(deps), `${body}\n; return reducer;`)(...Object.values(deps));
}
const fashionDeps = { FASHION_CATALOGUE: 'fashion', fashionLineKey: (p, v) => `fashion:${p}::${v ?? ''}` };
const groceryDeps = { GROCERY_CATALOGUE: 'grocery', groceryLineKey: (p, v) => `grocery:${p}::${v ?? ''}` };
const G1 = '00000000-0000-4000-8000-000000000701';
const SCRIPT = [
  { type: 'ADD', id: 'b183', qty: 2 },
  { type: 'ADD', id: 'b183', qty: 1, variantId: 'v750', variant: '750 ml' },
  { type: 'ADD', id: 'b183', qty: 1 },
  { type: 'ADD', catalogue: 'fashion', id: 'f501', qty: 1, variant: 'M · Navy', variantId: 'v5' },
  { type: 'ADD', catalogue: 'fashion', id: 'f501', qty: 2, variant: 'M · Navy', variantId: 'v5' },
  { type: 'ADD', id: 'f501', qty: 1 },
  { type: 'ADD', id: 'x9', qty: 1, variant: 'Pack of 2' },
  { type: 'SET_QTY', key: 'b183::v750', qty: 4 },
  { type: 'SAVE_LATER', key: 'x9::Pack of 2' },
  { type: 'REMOVE', key: 'b183' },
  { type: 'PRUNE_MISSING', keys: ['nope'] },
  { type: 'PRUNE_MISSING', keys: ['f501'] },
];
const run = (reducer, actions, state = { cart: [], saved: [] }) => actions.reduce((s, a) => reducer(s, a), state);

await test('wellness and fashion lines are byte-identical to the pre-change reducer (the pinned baseline) over a mixed script', () => {
  const before = atBaseline('src/lib/store.jsx');
  const after = read('src/lib/store.jsx');
  const oldReducer = loadReducer(before, { ...fashionDeps });
  const newReducer = loadReducer(after, { ...fashionDeps, ...groceryDeps });
  const a = run(oldReducer, SCRIPT), b = run(newReducer, SCRIPT);
  assert.equal(JSON.stringify(b), JSON.stringify(a));
  assert.equal(b.cart.length, 2, 'the variant line, the fashion line; base removed; x9 saved');
  assert.deepEqual(Object.keys(b.cart[0]), ['key', 'id', 'variant', 'variantId', 'qty'], 'a wellness line has no catalogue field');
  assert.deepEqual(b.cart[1], { key: 'fashion:f501::v5', catalogue: 'fashion', id: 'f501', variant: 'M · Navy', variantId: 'v5', qty: 3 });
  assert.equal(b.saved.length, 1);
});

await test('a grocery line is keyed grocery:<id>:: and carries catalogue: "grocery"; the same id in three catalogues stays three lines; adding twice merges', () => {
  const reducer = loadReducer(read('src/lib/store.jsx'), { ...fashionDeps, ...groceryDeps });
  const s = run(reducer, [
    { type: 'ADD', catalogue: 'grocery', id: G1, qty: 1, variant: '1 kg', variantId: null },
    { type: 'ADD', id: G1, qty: 1 },
    { type: 'ADD', catalogue: 'fashion', id: G1, qty: 1, variant: 'M', variantId: 'v1' },
    { type: 'ADD', catalogue: 'grocery', id: G1, qty: 2, variant: '1 kg', variantId: null },
    { type: 'ADD', catalogue: 'wholesale', id: G1, qty: 1 },
  ]);
  assert.deepEqual(s.cart.map((l) => l.key), [`grocery:${G1}::`, G1, `fashion:${G1}::v1`]);
  assert.deepEqual(s.cart[0], { key: `grocery:${G1}::`, catalogue: 'grocery', id: G1, variant: '1 kg', variantId: null, qty: 3 });
  assert.deepEqual(Object.keys(s.cart[1]), ['key', 'id', 'variant', 'variantId', 'qty'], 'an unknown catalogue word is treated as wellness, exactly as before');
  assert.equal(s.cart[1].qty, 2);
});

await test('store.jsx: the grocery add path, hydration branch, reconciliation, and the context export — the fashion lines untouched', () => {
  const store = stripComments(read('src/lib/store.jsx'));
  assert.match(store, /const addGroceryToCart = useCallback\(\(product, qty = 1\) => \{/);
  assert.match(store, /dispatch\(\{ type: 'ADD', catalogue: GROCERY_CATALOGUE, id: String\(product\.id\), qty, variant: product\.pack \|\| null, variantId: null \}\);/);
  assert.match(store, /: isGroceryLine\(l\) \? hydrateGroceryCartLine\(l, groceryProductFor\(l\.id\)\)\s*: hydrateCartLine\(l, productById\[l\.id\]\)\);/);
  assert.match(store, /\? hydrateFashionCartLine\(l, fashionRowFor\(l\.id\), \{ resolved: isFashionIdResolved\(l\.id\) \}\)/, 'fashion hydration as it was');
  assert.match(store, /\.filter\(\(l\) => !isFashionLine\(l\) && !isGroceryLine\(l\) && !productById\[l\.id\]\)/, 'the wellness prune never judges a grocery line');
  assert.match(store, /const keys = groceryKeysToPrune\(\[\.\.\.state\.cart, \.\.\.state\.saved\]\);/);
  assert.match(store, /addToCart,\n\s+addFashionToCart,\n\s+addGroceryToCart,/);
  // The fashion add path and payload plumbing are exactly as Phase 2 left them.
  assert.match(store, /dispatch\(\{ type: 'ADD', catalogue: FASHION_CATALOGUE, id: String\(view\.id\), qty, variant: label, variantId: String\(variant\.id\) \}\);/);
  const before = atBaseline('src/lib/store.jsx');
  const cut = (s) => s.slice(s.indexOf('const addFashionToCart'), s.indexOf('  }, [toast]);', s.indexOf('const addFashionToCart')));
  assert.equal(cut(read('src/lib/store.jsx')), cut(before), 'addFashionToCart is byte-identical');
});

await test('groceryCartLine: pending until its row lands, then priced from catalogue_products and still NOT purchasable (no server pricing yet); a confirmed-gone product prunes', async () => {
  const cache = loadModule('src/lib/catalogueCartCache.js', {});
  const calls = [];
  const mod = loadModule('src/lib/groceryCartLine.js', { ...cache, groceryProductView: data.groceryProductView, getGroceryProductsByIds: async (ids) => { calls.push(ids); return PRODUCTS.filter((p) => ids.includes(p.id)); } });
  assert.equal(mod.GROCERY_CATALOGUE, 'grocery');
  assert.equal(mod.groceryLineKey(G1, null), `grocery:${G1}::`);
  assert.ok(mod.isGroceryLine({ catalogue: 'grocery' })); assert.ok(!mod.isGroceryLine({ catalogue: 'fashion' })); assert.ok(!mod.isGroceryLine({ id: 'b183' }));
  const line = { key: `grocery:${G1}::`, catalogue: 'grocery', id: G1, variant: null, variantId: null, qty: 3 };
  const gone = { key: 'grocery:00000000-0000-4000-8000-000000000799::', catalogue: 'grocery', id: '00000000-0000-4000-8000-000000000799', variant: null, variantId: null, qty: 1 };
  // before any fetch: pending, counted, blocked, never null
  const pending = mod.hydrateGroceryCartLine(line, mod.groceryProductFor(G1));
  assert.equal(pending.pending, true); assert.equal(pending.purchasable, false); assert.equal(pending.unavailableReason, 'Checking availability…');
  assert.equal(pending.qty, 3); assert.equal(pending.unitPrice, null); assert.equal(pending.lineTotal, 0); assert.equal(pending.product.href, '/grocery');
  // the store's reconciliation asks for the rows and prunes nothing yet
  let bumps = 0; cache.subscribeCatalogueCart(() => { bumps += 1; });
  assert.deepEqual(mod.groceryKeysToPrune([line, gone, { key: 'b183', id: 'b183' }]), [], 'nothing pruned before a fetch has answered');
  assert.equal(calls.length, 1); assert.deepEqual([...calls[0]].sort(), [G1, gone.id].sort(), 'one fetch for the unresolved grocery ids only');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(bumps >= 1, 'the shared version bumped when the rows landed, so the cart re-prices');
  // after: priced from the row, blocked with the checkout note
  const l = mod.hydrateGroceryCartLine(line, mod.groceryProductFor(G1));
  assert.equal(l.product.name, 'Sona Masoori Rice'); assert.equal(l.product.href, '/grocery'); assert.equal(l.product.image, '/img/grocery-product-sona-masoori-rice.webp');
  assert.equal(l.unitPrice, 89); assert.equal(l.unitMrp, 99); assert.equal(l.lineTotal, 267); assert.equal(l.variantLabel, '1 kg', 'the label comes from net_content'); assert.equal(l.product.form, '1 kg');
  assert.equal(l.purchasable, false, 'no server pricing yet — the line is blocked at checkout');
  assert.equal(l.unavailableReason, mod.GROCERY_CHECKOUT_NOTE);
  assert.equal(mod.hydrateGroceryCartLine(gone, mod.groceryProductFor(gone.id)), null, 'a product a fetch confirmed gone is dropped');
  assert.deepEqual(mod.groceryKeysToPrune([line, gone, { key: 'b183', id: 'b183' }]), [gone.key], 'only the confirmed-gone grocery line; a wellness line is not this module\'s business');
  assert.equal(calls.length, 1, 'resolved ids are not fetched again');
  const inactive = mod.hydrateGroceryCartLine(line, data.groceryProductView({ ...PRODUCTS[0], is_active: false }));
  assert.equal(inactive.unavailableReason, 'This item is no longer available.');
  // a network failure leaves the line pending, never pruned
  const offline = loadModule('src/lib/groceryCartLine.js', { ...loadModule('src/lib/catalogueCartCache.js', {}), groceryProductView: data.groceryProductView, getGroceryProductsByIds: async () => { throw new Error('offline'); } });
  assert.deepEqual(offline.groceryKeysToPrune([line]), []);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(offline.isGroceryIdResolved(G1), false); assert.deepEqual(offline.groceryKeysToPrune([line]), []);
  // Cart and Checkout gate on purchasable, so a grocery line can never reach create-order.
  assert.match(stripComments(read('src/pages/Checkout.jsx')), /blockedCartLines/);
});

await test('checkout plumbing untouched: a grocery line goes to neither endpoint with a price, and wellness/fashion payloads are exactly as before', () => {
  const api = loadModule('src/lib/couponApi.js', { supabase: {}, getVisitorId: () => 'v' });
  const lines = [{ id: 'b183', qty: 2, variantId: null, variant: null }, { key: 'k', catalogue: 'fashion', id: 'f1', qty: 1, variantId: 'v', variant: 'M', unitPrice: 1 }, { key: 'g', catalogue: 'grocery', id: G1, qty: 1, variantId: null, variant: '1 kg', unitPrice: 89, lineTotal: 89 }];
  const payload = api.cartToPayload(lines);
  assert.deepEqual(payload[0], { id: 'b183', qty: 2, variantId: null, variant: null });
  assert.deepEqual(payload[1], { id: 'f1', qty: 1, variantId: 'v', variant: 'M', catalogue: 'fashion' });
  assert.ok(!('unitPrice' in payload[2]) && !('lineTotal' in payload[2]) && !('price' in payload[2]), 'never a price');
  for (const rel of ['src/lib/couponApi.js', 'src/lib/payments.js', 'src/lib/cartLine.js', 'src/lib/cartQuote.js', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'api/_lib/pricing.js', 'api/razorpay/create-order.js']) {
    const now = read(rel);
    // Express and Scheduled were withdrawn (test-company-surfaces.mjs pins the fee map against the
    // published policy; the three payment suites pin that a withdrawn method cannot be charged).
    // For the two files that carries — the fee map and the checkout picker — normalise that one
    // declaration and the comments around it; every other file below stays a byte comparison.
    const sansDelivery = (t) => (/DELIVERY_FEES = \{|const DELIVERY = \[/.test(t)
      ? t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        .replace(/export const DELIVERY_FEES = \{[^}]*\};/, 'DELIVERY_FEES')
        .replace(/const DELIVERY = \[[\s\S]*?\n\];/, 'DELIVERY')
        .split('\n').filter((l) => l.trim()).join('\n')
      : t);
    assert.equal(sansDelivery(now), sansDelivery(atBaseline(rel)), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
});

// ============================================================
console.log('\n— The stylesheet: namespaced, deferred, three widths, reduced motion —');
// ============================================================

await test('grocery.css: every selector is under .gs; only transform and opacity transition; a reduced-motion block', () => {
  const css = read('src/styles/grocery.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(^|\n|\}|\{)\s*([^@{}\n][^{}]*?)\s*\{/g)].map((m) => m[2].trim()).filter(Boolean);
  assert.ok(selectors.length > 60, `${selectors.length} rules`);
  for (const sel of selectors) for (const part of sel.split(',')) assert.match(part.trim(), /^\.gs(\b|-)/, `"${part.trim()}" is namespaced`);
  for (const m of css.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) {
    const v = m[1].trim();
    if (v === 'none' || v === 'none !important') continue;
    for (const prop of v.split(',').map((p) => p.trim().split(/\s+/)[0])) assert.ok(['transform', 'opacity'].includes(prop), `transitions ${prop}`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.gs \*, \.gs \*::before, \.gs \*::after \{ transition: none !important; \}/);
  assert.match(css, /\.gs-hero__track \{ transition: none; \}/, 'the carousel never slides under reduced motion');
});

await test('390px: two-row category scroller, snapping product row, bottom nav fixed above the safe area, hero copy stacked over a top wash', () => {
  const css = read('src/styles/grocery.css');
  const phone = css.slice(css.indexOf('@media (max-width: 599px)'), css.indexOf('@media (prefers-reduced-motion'));
  assert.match(phone, /\.gs-circles \{[^}]*grid-auto-flow: column;[^}]*grid-template-rows: repeat\(2, auto\);[^}]*grid-auto-columns: 64px;[^}]*overflow-x: auto/);
  assert.match(phone, /\.gs-row \{ display: flex;[^}]*overflow-x: auto; scroll-snap-type: x mandatory/);
  assert.match(phone, /\.gs-card \{ flex: 0 0 168px; scroll-snap-align: start; \}/);
  assert.match(phone, /\.gs-hero__txt \{ max-width: 100%; \}/);
  assert.match(phone, /\.gs-trust li \{ flex-direction: column/);
  assert.match(css, /\.gs-nav \{ position: fixed; left: 0; right: 0; bottom: 0;[^}]*height: calc\(var\(--gs-nav-h\) \+ env\(safe-area-inset-bottom, 0px\)\); padding: 0 4px env\(safe-area-inset-bottom, 0px\)/);
  assert.match(css, /\.gs \{ padding-bottom: calc\(var\(--gs-nav-h\) \+ env\(safe-area-inset-bottom, 0px\)\); \}/, 'the footer clears the nav');
});

await test('768px: the tablet rules — nav still fixed, four cards across, five circles across, hero copy at 60%', () => {
  const css = read('src/styles/grocery.css');
  const tablet = css.slice(css.indexOf('@media (max-width: 1019px)'), css.indexOf('@media (max-width: 599px)'));
  assert.match(tablet, /\.gs-row \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(tablet, /\.gs-hero__txt \{ max-width: 60%; \}/);
  assert.match(tablet, /\.gs-circle__img \{ width: 104px; height: 104px; \}/);
  assert.doesNotMatch(tablet, /\.gs-nav \{/, 'nothing at 768 un-fixes the nav');
  assert.match(css, /@media \(min-width: 1020px\)/, 'the un-fix starts at 1020');
});

await test('1280px: the nav is a static strip under the header, no bottom padding, four cards and five circles in a 1280 container', () => {
  const css = read('src/styles/grocery.css');
  const wide = css.slice(css.indexOf('@media (min-width: 1020px)'), css.indexOf('@media (max-width: 1019px)'));
  assert.match(wide, /\.gs \{ padding-bottom: 0; \}/);
  assert.match(wide, /\.gs-nav \{ position: static; height: auto;[^}]*justify-content: center/);
  assert.match(css, /\.gs-main \{ display: block; max-width: 1280px; margin: 0 auto; padding: 0 16px 48px; \}/);
  assert.match(css, /\.gs-row \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); gap: 16px; \}/);
});

await test('deferred like fashion: grocery.css last in DEFERRED, /grocery in DEFERRED_ROUTES, nothing added to the storefront sheet', () => {
  const build = read('build/build-css.mjs');
  const deferred = build.slice(build.indexOf('const DEFERRED = ['), build.indexOf('];', build.indexOf('const DEFERRED = [')));
  assert.match(deferred, /'src\/styles\/fashion\.css',\n[\s\S]*?'src\/styles\/grocery\.css',\n/, 'appended after fashion.css (a later store may follow)');
  const storefront = build.slice(build.indexOf('const STOREFRONT = ['), build.indexOf('const DEFERRED'));
  assert.doesNotMatch(storefront, /grocery/);
  assert.match(read('src/lib/deferredStyles.js'), /DEFERRED_ROUTES = \/\^\\\/\(admin\|passport\|creator\|fashion\|grocery(\|[a-z]+)*\)\(\\\/\|\$\)\/;/, 'the deferred sheet is fetched on /grocery (a later store may follow)');
});

// ============================================================
console.log('\n— Isolation —');
// ============================================================

await test('App.jsx: /grocery is a sibling route tree with its own layout, outside the wellness Layout and outside /fashion', () => {
  const src = read('src/App.jsx');
  assert.match(src, /<Route path="\/grocery" element=\{<GroceryLayout \/>\}>\n\s+<Route index element=\{<GroceryHome \/>\} \/>\n\s+<\/Route>/);
  assert.ok(src.indexOf('<Route path="/grocery"') < src.indexOf('<Route element={<Layout />}>'), 'before the wellness layout');
  assert.ok(src.indexOf('<Route path="/grocery"') > src.indexOf('<Route path="/fashion"'), 'after the fashion tree, not inside it');
  const fashionBlock = src.slice(src.indexOf('<Route path="/fashion"'), src.indexOf('</Route>', src.indexOf('<Route path="/fashion"')));
  assert.doesNotMatch(fashionBlock, /Grocery/);
});

await test('nothing under the wellness storefront, /fashion, checkout, pricing, coupons, auth or payments changed since the baseline (working tree included)', () => {
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // public/ is build output — it changes with every release commit, by design, and is never hand-edited.
  // The data layer (src/lib/fashion*.js, catalogueCartCache.js, groceryCartLine.js, src/data/) and the
  // grocery components are this work's; the cart, checkout, coupons, auth and payment code are not.
  // (store.jsx carries the approved grocery namespace from this store's first phase; test-catalogue.mjs pins it since.)
  // The store switcher (test-store-nav.mjs) adds links to the wellness and fashion headers — those four files are pinned there.
  // (A later store's own sheet — homeliving.css — is that store's, pinned by test-homeliving.mjs.)
  // The homepage store doorway (FashionBanner.jsx + fashion-banner.css) was redesigned in 71eb538 — an approved wellness change.
  // The display typeface swap (test-typeface.mjs) touched index.html and most stylesheets — an approved change; that suite pins the sheets it must not have touched.
  // Three approved changes landed beside this section and moved files these pins guard:
  //   86ea8cf  src/components/Hero.jsx   — the wellness hero drops the Supabase render-transform URLs (test-homepage-appearance.mjs)
  //   e58317c  src/fashion/FashionHome.jsx — the campaign hero leads /fashion (test-fashion.mjs pins the new order)
  //   a651320  src/pages/Legal.jsx       — the shipping policy rewrite (test-company-surfaces.mjs pins the policy)
  // Express and Scheduled were withdrawn — brands ship standard, and the published Shipping Policy
  // documents Standard only. That edited the fee map (api/_lib/pricing.js), the checkout picker,
  // the PDP's display copy (src/data/pdpContent.js) and the PDP delivery panel, and nothing else.
  // test-company-surfaces.mjs pins the fee map against the policy; test-payment-hardening.mjs,
  // test-payment-logic.mjs and test-commerce-pricing.mjs pin that a withdrawn method cannot be charged.
  const untouchable = /^(src\/fashion\/(?!FashionLayout\.jsx$|FashionHome\.jsx$)|src\/pages\/(?!Home\.jsx$|Legal\.jsx$|Checkout\.jsx$)|src\/components\/(?!Header\.jsx$|FashionBanner\.jsx$|Hero\.jsx$|pdp\/ProductDeliveryInfo\.jsx$)|src\/lib\/(cartLine\.js|cartQuote\.js|payments\.js|coupon[A-Za-z]*\.js|customerAuth\.jsx|adminAuth\.jsx|wishlist[A-Za-z]*\.js)$|api\/(?!_lib\/pricing\.js$))/;
  const bad = [...changed].filter((f) => untouchable.test(f));
  assert.deepEqual(bad, [], `untouchable files changed: ${bad.join(', ')}`);
  // src/pages/Home.jsx mounts the store doorways (test-store-doorway.mjs pins its exact diff) and src/pages/Legal.jsx carries the shipping-policy
  // rewrite (a651320, pinned by test-company-surfaces.mjs). Checkout.jsx and api/_lib/pricing.js carry the
  // Express/Scheduled withdrawal, compared above with that one declaration normalised out; everything else
  // under src/pages and the whole of api/ is untouched.
  assert.equal(execFileSync('git', ['diff', '--stat', BASELINE_SHA, '--', 'api', ':(exclude)api/_lib/pricing.js', 'src/pages', ':(exclude)src/pages/Home.jsx', ':(exclude)src/pages/Legal.jsx', ':(exclude)src/pages/Checkout.jsx', 'src/components/CategorySpotlight.jsx', 'src/components/ProductCard.jsx'], { cwd: REPO, encoding: 'utf8' }).trim(), '');
});

await test('no migration beyond 0034, no dependency change since the baseline', () => {
  const changed = execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(!changed.some((f) => /^supabase\/migrations\/(?!0034_catalogue_multistore\.sql$|rollback\/0034_|0035_homeliving_store\.sql$|rollback\/0035_)/.test(f)), 'no migration other than 0034 (the catalogue) and 0035 (the Home & Living store), with their rollbacks');
  assert.ok(!changed.some((f) => /^package(-lock)?\.json$/.test(f)), 'no dependency change');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
