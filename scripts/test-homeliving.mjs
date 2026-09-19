// ============================================================
// Home & Living store — shell + homepage. Offline suite.
//
// The data module (catalogue_* where store = 'homeliving', the hook, the
// homepage copy), the images (renamed, WebP, under 150 KB), the real shell
// and homepage rendered through the real router in the mockup's order, the
// one delivery promise and no speed claim anywhere, the four-store
// switcher in every shell, the stylesheet's three widths, migration 0035
// and its rollback, and the isolation of everything else.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-homeliving.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-homeliving.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule, buildHomeLivingApp, loadHomeLivingData, CATEGORIES, PRODUCTS } from './homeliving-ssr.mjs';
import { REPO, atCommit } from './baseline-export.mjs';

// The tip before the Home & Living store (the store-switcher bundle commit).
const BASELINE_SHA = 'c060167';
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

const NEW_FILES = ['src/data/homelivingHomepage.js', 'src/homeliving/HomeLivingLayout.jsx', 'src/homeliving/HomeLivingHome.jsx', 'src/homeliving/HomeLivingProductCard.jsx', 'src/styles/homeliving.css', 'supabase/migrations/0035_homeliving_store.sql'];
// The one delivery promise. Anything faster, or "secure", is a claim nobody has substantiated.
const SPEED_CLAIMS = [/\bfast\b/i, /\bfaster\b/i, /\bexpress\b/i, /\binstant/i, /\bsecure\s+deliver/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\bquick\b/i, /\brapid\b/i, /\bspeedy\b/i, /\beco[- ]friendly\b/i];

let data = null;
try { data = loadHomeLivingData(); } catch { data = null; }
const priceOf = (p) => (data?.priceOf ? data.priceOf(p) : null);

// ============================================================
console.log('\n— The data module: the catalogue tables, plus the homepage copy —');
// ============================================================

await test('src/data/homelivingHomepage.js is the data layer: queries under store = homeliving, the catalogue hook, and the homepage copy — no product or category literals', () => {
  assert.ok(has('src/data/homelivingHomepage.js'), 'the data module is missing');
  assert.ok(data, 'the module loads');
  for (const k of ['HERO_SLIDES', 'TRUST', 'CATEGORY_SECTION', 'FEATURED', 'PROMO', 'HOMELIVING_DELIVERY_WINDOW', 'HOMELIVING_TAGLINE', 'HOMELIVING_STORE', 'categoryHref', 'getHomeLivingCategories', 'getHomeLivingProducts', 'useHomeLivingCatalogue', 'seedHomeLivingCatalogue', 'getHomeLivingCatalogue', 'priceOf', 'homelivingProductView']) assert.ok(k in data, `exports ${k}`);
  assert.equal(data.HOMELIVING_DELIVERY_WINDOW, '6-7 days'); assert.equal(data.HOMELIVING_STORE, 'homeliving');
  const src = stripComments(read('src/data/homelivingHomepage.js'));
  assert.doesNotMatch(src, /Botanical Bedsheet|Cushion Cover Pair|Cotton Quilt|Bath Towel|homeliving-circle-|homeliving-product-|net_content: '/, 'no category or product literal (the hero/promo may still LINK to a category slug)');
  assert.match(src, /from\('catalogue_categories'\)/); assert.match(src, /from\('catalogue_products'\)/);
  assert.doesNotMatch(src, /from\('(fashion|grocery|homeliving)_/, 'only the shared catalogue tables');
  assert.equal(data.HERO_SLIDES[0].eyebrow, 'Home & Living'); assert.equal(data.HERO_SLIDES[0].cta, 'Explore Home Collection');
  assert.deepEqual(data.TRUST.map((t) => t.title), ['Premium Fabrics', 'Trusted Quality', 'Standard Delivery', 'For a Happier Home']);
  assert.equal(data.TRUST[2].sub, '6-7 days');
  assert.deepEqual(data.PROMO.badges.map((b) => b.title), ['Natural Fabrics', 'Long-Lasting Quality', 'Beautiful Homes, Happier Lives']);
});

await test('the queries hit catalogue_* where store = homeliving; rows keep the schema field names and gain a data-layer price', async () => {
  const calls = [];
  const from = (table) => { const q = { table, ops: [] }; calls.push(q); const chain = new Proxy({}, { get(_, m) { if (m === 'then') return (res) => Promise.resolve({ data: table === 'catalogue_categories' ? CATEGORIES : PRODUCTS, error: null }).then(res); return (...a) => { q.ops.push([m, ...a]); return chain; }; } }); return chain; };
  const mod = loadModule('src/data/homelivingHomepage.js', { supabase: { from } });
  const cats = await mod.getHomeLivingCategories(); const prods = await mod.getHomeLivingProducts();
  assert.deepEqual(calls.map((q) => q.table), ['catalogue_categories', 'catalogue_products']);
  assert.deepEqual(calls[0].ops.find((o) => o[0] === 'eq').slice(1), ['store', 'homeliving']);
  assert.deepEqual(calls[1].ops.filter((o) => o[0] === 'eq').map((o) => o.slice(1)), [['store', 'homeliving'], ['is_active', true]]);
  assert.match(calls[1].ops.find((o) => o[0] === 'select')[1], /\bimages\b.*\bnet_content\b.*\bstock\b/);
  assert.equal(cats.length, 6); assert.equal(prods.length, 4);
  const view = mod.homelivingProductView(PRODUCTS[0]);
  assert.equal(view.price, 1499); assert.equal(view.mrp, 1899); assert.equal(view.net_content, 'King · 1 bedsheet + 2 pillow covers');
  assert.ok(!('pack' in view) && !('image' in view));
  assert.equal(mod.priceOf({ mrp: 100, sale_price: 120 }), 100, 'a sale above MRP is ignored');
});

await test('the seeded catalogue renders synchronously; unseeded is "loading" with nothing invented', () => {
  const Probe = () => { const { status, categories, products } = data.useHomeLivingCatalogue(); return h('p', { 'data-status': status }, `${categories.length}/${products.length}`); };
  assert.equal(renderToStaticMarkup(h(Probe)), '<p data-status="ready">6/4</p>');
  const empty = loadHomeLivingData({ initial: null });
  const Probe2 = () => { const s = empty.useHomeLivingCatalogue(); return h('p', { 'data-status': s.status }, `${s.categories.length}/${s.products.length}`); };
  assert.equal(renderToStaticMarkup(h(Probe2)), '<p data-status="loading">0/0</p>');
});

await test('every image the migration seeds and the homepage copy names exists, is WebP, and is under 150 KB; the weaver is compressed but not placed', () => {
  const sql = read('supabase/migrations/0035_homeliving_store.sql');
  const seeded = [...sql.matchAll(/'(\/img\/homeliving-[a-z0-9-]+\.webp)'/g)].map((m) => m[1]);
  const images = [...new Set([...data.HERO_SLIDES.map((s) => s.image), data.PROMO.image, ...seeded])];
  assert.equal(images.length, 12, 'twelve distinct photographs on the page');
  for (const rel of [...images, '/img/homeliving-artisan.webp']) {
    const file = resolve(ROOT, rel.replace(/^\//, ''));
    const size = statSync(file).size;
    assert.ok(size < 150 * 1024, `${rel} is ${(size / 1024).toFixed(0)} KB`);
    const head = readFileSync(file).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP', `${rel} is WebP`);
  }
  for (const rel of ['src/homeliving/HomeLivingHome.jsx', 'src/data/homelivingHomepage.js']) assert.doesNotMatch(read(rel), /homeliving-artisan/, `${rel} does not place the weaver`);
});

await test('no component hardcodes product or category data, and every one reads schema field names', () => {
  for (const rel of ['src/homeliving/HomeLivingLayout.jsx', 'src/homeliving/HomeLivingHome.jsx', 'src/homeliving/HomeLivingProductCard.jsx']) {
    const src = stripComments(read(rel));
    assert.doesNotMatch(src, /\/img\/homeliving-/, `${rel} names no image`);
    assert.doesNotMatch(src, /price:\s*\d|₹\s*\d/, `${rel} carries no price`);
    for (const p of PRODUCTS) assert.ok(!src.includes(p.name), `${rel} does not hardcode "${p.name}"`);
    for (const c of CATEGORIES) assert.ok(!src.includes(`'${c.slug}'`), `${rel} does not hardcode "${c.slug}"`);
    assert.doesNotMatch(src, /\b(c|p|product)\.(pack|image)\b/, `${rel} reads image_url / images[] / net_content`);
    assert.doesNotMatch(src, /product\.(price|mrp)\s*[+\-*/]|[+\-*/]\s*product\.(price|mrp)/, `${rel}: no price arithmetic`);
  }
});

// ============================================================
console.log('\n— Delivery copy: one promise, no speed claim —');
// ============================================================

await test('"Standard Delivery / 6-7 days" is the only delivery copy; no fast, express, instant, secure-delivery, same-day or minute claim exists in any new file', () => {
  for (const rel of NEW_FILES) {
    const src = read(rel);
    for (const re of SPEED_CLAIMS) assert.ok(!re.test(src), `${rel} matches ${re}`);
  }
});

// ============================================================
console.log('\n— The shell and the homepage, rendered through the real router —');
// ============================================================

const app = await buildHomeLivingApp({ cartCount: 3 }).catch((e) => ({ error: e }));
const home = app.error ? '' : app.render('/homeliving');

await test('header: cream shell, hamburger, centred SORA LIFE wordmark with the tagline, the three other stores, inert wishlist, cart with the shared count', () => {
  assert.ok(!app.error, app.error?.message);
  assert.match(home, /^<div class="hl"><header class="hl-hdr"><div class="hl-hdr__row"><button type="button" class="hl-hdr__menu" aria-label="Open menu">/);
  assert.match(home, /<a class="hl-logo" aria-label="SORA LIFE Home &amp; Living home" href="\/homeliving"><strong class="serif">SORA LIFE<\/strong><em>Comfort for every home<\/em><\/a>/);
  assert.match(home, /<span class="hl-hdr__stores" role="navigation" aria-label="Other stores"><a class="hl-hdr__store" href="\/"><svg[\s\S]*?<\/svg> Wellness store<\/a><a class="hl-hdr__store" href="\/fashion">Fashion <svg[\s\S]*?<\/svg><\/a><a class="hl-hdr__store" href="\/grocery">Grocery <svg[\s\S]*?<\/svg><\/a><\/span>/);
  assert.doesNotMatch(home, /hl-hdr__store" href="\/homeliving"/, 'never links to itself');
  assert.match(home, /<button type="button" class="hl-hdr__act" aria-label="Wishlist" aria-disabled="true">/);
  assert.match(home, /<a class="hl-hdr__act" aria-label="Cart, 3 items" href="\/cart">[\s\S]*?<span class="hl-hdr__count">3<\/span><\/a>/);
  const css = read('src/styles/homeliving.css');
  assert.match(css, /\.hl \{[^}]*--hl-hdr: #F7F3EA/); assert.match(css, /\.hl-hdr \{[^}]*background: var\(--hl-hdr\)/);
  assert.match(css, /\.hl-hdr__row \{[^}]*grid-template-columns: 1fr auto 1fr/, 'the wordmark is centred');
});

await test('the delivery badge reads "Standard Delivery · 6-7 days"; the search bar is visual only; the drawer lists the six categories and the three other stores', () => {
  assert.match(home, /<span class="hl-deliver__badge">[\s\S]*?<\/svg> Standard Delivery · 6-7 days<\/span>/);
  assert.match(home, /<input type="search" placeholder="Search for bedsheets, curtains, cushions\.\.\." aria-label="Search Home &amp; Living \(coming soon\)" readonly=""\/>/);
  assert.doesNotMatch(home, /<form/, 'nothing submits');
  const layout = read('src/homeliving/HomeLivingLayout.jsx');
  assert.match(layout, /<Link to="\/fashion" className="hl-drawer__back"[^>]*>[\s\S]*?Fashion store<\/Link>\n\s+<Link to="\/grocery" className="hl-drawer__back"[^>]*>[\s\S]*?Grocery store<\/Link>\n(\s+<Link to="\/lifestyle" className="hl-drawer__back"[^>]*>[\s\S]*?Lifestyle store<\/Link>\n)?\s+<Link to="\/" className="hl-drawer__back"[^>]*>[\s\S]*?Back to the wellness store<\/Link>/);
  assert.match(layout, /categories\.map\(\(c\) => <li key=\{c\.id\}><Link to=\{categoryHref\(c\)\}/, 'the drawer lists the live categories');
});

await test('bottom nav matches grocery: Home / Categories / Offers / Orders / Account — only Home is a link; the rest are inert', () => {
  const nav = home.slice(home.indexOf('<nav class="hl-nav"'), home.indexOf('</nav>', home.indexOf('<nav class="hl-nav"')) + 6);
  assert.deepEqual([...nav.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]), ['Home', 'Categories', 'Offers', 'Orders', 'Account']);
  assert.match(nav, /<a class="hl-nav__item is-on" aria-current="page" href="\/homeliving">/);
  assert.equal((nav.match(/<a /g) || []).length, 1); assert.equal((nav.match(/aria-disabled="true"/g) || []).length, 4);
});

await test('section order: hero → trust strip → category circles → featured row → promo', () => {
  const marks = ['<section class="hl-hero"', '<ul class="hl-trust"', '<nav class="hl-circles"', 'id="hl-featured-h"', '<section class="hl-promo"'];
  const idx = marks.map((m) => home.indexOf(m));
  assert.ok(idx.every((i) => i >= 0), `every section present: ${idx}`);
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'in the specified order');
  assert.ok(home.indexOf('<main class="hl-main">') < idx[0] && home.indexOf('data-stub="footer"') > idx[4]);
});

await test('hero: eyebrow HOME & LIVING, headline, subline, gold CTA "Explore Home Collection", the note — all HTML over a photograph with an empty alt; one slide, no dots', () => {
  const hero = home.slice(home.indexOf('<section class="hl-hero"'), home.indexOf('</section>', home.indexOf('<section class="hl-hero"')));
  const s = data.HERO_SLIDES[0];
  assert.match(hero, /<img class="hl-hero__img" src="\/img\/homeliving-hero\.webp" alt="" width="1600" height="900"[^>]*fetchpriority="high" loading="eager"\/>/);
  assert.ok(hero.includes('<p class="hl-hero__eyebrow">Home &amp; Living</p>'), 'eyebrow');
  assert.ok(hero.includes(`<h1 class="hl-hero__h serif">${s.headline}</h1>`), 'headline is an h1');
  assert.ok(hero.includes(`<p class="hl-hero__sub">${s.sub}</p>`), 'subline');
  assert.ok(hero.includes(`<a class="hl-cta" tabindex="0" href="${s.href}">${s.cta} <svg`), 'CTA is a link');
  assert.ok(hero.includes(`<p class="hl-hero__note serif" aria-hidden="true">${s.note}</p>`), 'the note is HTML, not in the image');
  assert.doesNotMatch(hero, /hl-hero__dot/, 'no dots for a single slide');
  const css = read('src/styles/homeliving.css');
  assert.match(css, /\.hl-cta \{[^}]*background: var\(--slv2-gold\)/, 'gold CTA');
  assert.match(css, /\.hl-hero__img \{[^}]*object-position: right center/, 'the bed stays right');
  assert.match(css, /\.hl-hero__slide::before \{[^}]*linear-gradient\(90deg, rgba\(251, 248, 241, \.96\) 0%/, 'a cream wash under the copy');
  assert.match(css, /\.hl-hero__txt \{ max-width: 44%; \}/, 'the copy keeps to the wall on the left');
});

await test('hero carousel: several slides render one visible, the rest aria-hidden with CTAs out of the tab order, dots appear; autoplay only with 2+, pauses on hover/focus, honours reduced motion', () => {
  const { HeroCarousel } = app.modules.home;
  const three = [1, 2, 3].map((i) => ({ ...data.HERO_SLIDES[0], id: `s${i}`, headline: `Slide ${i}` }));
  const html = renderToStaticMarkup(h(StaticRouter, { location: '/homeliving' }, h(HeroCarousel, { slides: three })));
  assert.equal((html.match(/<article class="hl-hero__slide" aria-hidden="true"/g) || []).length, 2);
  assert.equal((html.match(/tabindex="-1"/g) || []).length, 2); assert.equal((html.match(/role="tab"/g) || []).length, 3);
  const src = stripComments(read('src/homeliving/HomeLivingHome.jsx'));
  assert.match(src, /if \(slides\.length < 2 \|\| paused\) return undefined;/);
  assert.match(src, /setInterval\(\(\) => \{ if \(!reduced\.current\) setIndex/);
  assert.match(src, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(src, /onMouseEnter=\{\(\) => setPaused\(true\)\} onMouseLeave=\{\(\) => setPaused\(false\)\} onFocus=\{\(\) => setPaused\(true\)\} onBlur=\{\(\) => setPaused\(false\)\}/);
});

await test('trust strip: exactly the four items, with "Standard Delivery / 6-7 days"', () => {
  const strip = home.slice(home.indexOf('<ul class="hl-trust"'), home.indexOf('</ul>', home.indexOf('<ul class="hl-trust"')));
  const items = [...strip.matchAll(/<strong>([^<]+)<\/strong><em>([^<]+)<\/em>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(items, [['Premium Fabrics', 'Chosen for touch and wear'], ['Trusted Quality', 'Checked before it ships'], ['Standard Delivery', '6-7 days'], ['For a Happier Home', 'Small details, warmer rooms']]);
});

await test('category circles: the six textile categories, each /homeliving/category/<slug> with its photo (image_url) and its name as text; "View all"', () => {
  assert.match(home, /<p class="hl-eyebrow">Explore categories<\/p><h2 class="hl-sec__h hl-sec__h--rule serif" id="hl-cats-h">Everything for a Beautiful Home<\/h2>/);
  const circles = home.slice(home.indexOf('<nav class="hl-circles"'), home.indexOf('</nav>', home.indexOf('<nav class="hl-circles"')));
  const links = [...circles.matchAll(/<a class="hl-circle" href="([^"]+)"><span class="hl-circle__img"><img src="([^"]+)" alt="" loading="lazy"[^>]*><\/span><span class="hl-circle__name">([^<]+)<\/span><\/a>/g)];
  assert.equal(links.length, 6);
  assert.deepEqual(links.map((m) => m[1]), CATEGORIES.map((c) => `/homeliving/category/${c.slug}`));
  assert.deepEqual(links.map((m) => m[2]), CATEGORIES.map((c) => c.image_url));
  assert.deepEqual(links.map((m) => m[3].replace(/&amp;/g, '&')), ['Bedsheets', 'Curtains', 'Cushion Covers', 'Quilts & Blankets', 'Towels', 'Rugs & Mats']);
  const css = read('src/styles/homeliving.css');
  assert.match(css, /\.hl-circles \{[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/, 'six across on a wide screen');
  assert.match(css.slice(css.indexOf('@media (max-width: 599px)')), /\.hl-circles \{ display: flex;[^}]*overflow-x: auto/, 'a scroller on a phone');
});

await test('featured row: four cards from the catalogue with photo, brand, name, size and the data-layer price with MRP struck; no Add button (no cart namespace yet)', () => {
  assert.match(home, /<h2 class="hl-sec__h serif" id="hl-featured-h">Featured Home Linen<\/h2>/);
  const cards = [...home.matchAll(/<article class="hl-card" data-product="([^"]+)">[\s\S]*?<\/article>/g)];
  assert.equal(cards.length, 4);
  cards.forEach((m, i) => {
    const p = PRODUCTS[i]; const c = m[0]; const price = priceOf(p);
    assert.equal(m[1], p.slug);
    assert.ok(c.includes(`<img src="${p.images[0]}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}"`), `${p.slug}: photo, first two eager`);
    assert.ok(c.includes(`<p class="hl-card__brand">${p.brand}</p>`)); assert.ok(c.includes(`<h3 class="hl-card__name"><a href="/homeliving/p/${p.slug}">${p.name}</a></h3>`), 'the name links to the product page');
    assert.ok(c.includes(`<p class="hl-card__size">${p.net_content.replace(/×/g, '×')}</p>`), 'size line');
    assert.ok(c.includes(`<p class="hl-price" data-price="${price}"><strong>₹${price.toLocaleString('en-IN')}</strong><s class="hl-price__mrp">₹${p.mrp.toLocaleString('en-IN')}</s>`), 'price with MRP');
    assert.doesNotMatch(c, /<button[^>]*>Add/, 'no add-to-cart that has nowhere to go');
  });
  const empty = app.render('/homeliving');
  assert.ok(empty.includes('data-product='), 'seeded');
});

await test('promo strip: photograph left, eyebrow + headline + subline + gold CTA + three badges right, all HTML', () => {
  const promo = home.slice(home.indexOf('<section class="hl-promo"'));
  assert.match(promo, /^<section class="hl-promo" aria-labelledby="hl-promo-h"><div class="hl-promo__art" aria-hidden="true"><img src="\/img\/homeliving-promo\.webp" alt="" loading="lazy"/);
  assert.ok(promo.includes(`<p class="hl-eyebrow">${data.PROMO.eyebrow}</p><h2 class="hl-promo__h serif" id="hl-promo-h">${data.PROMO.headline}</h2><p class="hl-promo__sub">${data.PROMO.sub}</p><a class="hl-cta" href="${data.PROMO.href}">${data.PROMO.cta.replace(/&/g, '&amp;')} <svg`));
  const badges = [...promo.matchAll(/<li><span class="hl-trust__icon">[\s\S]*?<\/span><span>([^<]+)<\/span><\/li>/g)].map((m) => m[1]);
  assert.deepEqual(badges, ['Natural Fabrics', 'Long-Lasting Quality', 'Beautiful Homes, Happier Lives']);
});

await test('text-in-image rule: every <img> on the page is decorative (alt=""), and every headline, label and price is in the HTML text', () => {
  const imgs = [...home.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  assert.equal(imgs.length, 12);
  for (const i of imgs) assert.match(i, / alt=""/, `${i.slice(0, 60)} carries no text`);
  const t = text(home);
  for (const k of ['eyebrow', 'headline', 'sub', 'cta', 'note']) assert.ok(t.includes(data.HERO_SLIDES[0][k]), `hero ${k}`);
  for (const c of CATEGORIES) assert.ok(t.includes(c.name), c.name);
  for (const p of PRODUCTS) { assert.ok(t.includes(p.name)); assert.ok(t.includes(`₹${priceOf(p).toLocaleString('en-IN')}`)); assert.ok(t.includes(p.net_content)); }
  for (const k of ['eyebrow', 'headline', 'sub', 'cta']) assert.ok(t.includes(data.PROMO[k]), `promo ${k}`);
  assert.ok(t.includes('Standard Delivery · 6-7 days'));
  for (const re of SPEED_CLAIMS) assert.ok(!re.test(t), `rendered page matches ${re}`);
});

// ============================================================
console.log('\n— The store switcher: four stores, every shell links to the other three —');
// ============================================================

await test('wellness, fashion and grocery each gained "Home & Living" in the bar and the drawer; sibling labels are short, the return link keeps "Wellness store"; the wellness bar shows the group from 1100px', () => {
  const header = read('src/components/Header.jsx');
  assert.match(header, /<Link to="\/fashion" className="v2-hdr__store">Fashion <Icon/); assert.match(header, /<Link to="\/grocery" className="v2-hdr__store">Grocery <Icon/);
  assert.match(header, /<Link to="\/homeliving" className="v2-hdr__store">Home &amp; Living <Icon/);
  assert.match(header, /<Link to="\/homeliving" className="drawer__cat">Home &amp; Living store<Icon/);
  assert.doesNotMatch(header, /v2-hdr__store">(Fashion|Grocery) store/, 'the sibling labels dropped "store"');
  assert.match(read('src/styles/v2-header.css'), /\.v2-hdr__stores \{ display:none; \}\n@media \(min-width: 1100px\) \{/);
  const fashion = read('src/fashion/FashionLayout.jsx');
  assert.match(fashion, /<Link to="\/" className="fs-hdr__back"><Icon name="chevronLeft" size=\{15\} \/> Wellness store<\/Link>\n\s+<Link to="\/grocery" className="fs-hdr__back">Grocery <Icon[^\n]*\n\s+<Link to="\/homeliving" className="fs-hdr__back">Home &amp; Living <Icon/);
  assert.match(fashion, /<Link to="\/homeliving" className="fs-drawer__back" onClick=\{onClose\}><Icon name="chevronRight" size=\{16\} \/> Home &amp; Living store<\/Link>/);
  const grocery = read('src/grocery/GroceryLayout.jsx');
  assert.match(grocery, /<Link to="\/" className="gs-hdr__store"><Icon name="chevronLeft" size=\{15\} \/> Wellness store<\/Link>\n\s+<Link to="\/fashion" className="gs-hdr__store">Fashion <Icon[^\n]*\n\s+<Link to="\/homeliving" className="gs-hdr__store">Home &amp; Living <Icon/);
  assert.match(grocery, /<Link to="\/homeliving" className="gs-drawer__back" onClick=\{onClose\}><Icon name="chevronRight" size=\{16\} \/> Home &amp; Living store<\/Link>/);
  // Each shell: exactly the other three, by path.
  const paths = (src, cls) => [...src.matchAll(new RegExp(`<Link to="([^"]+)" className="${cls}"`, 'g'))].map((m) => m[1]);
  // A later store (Lifestyle, test-lifestyle.mjs) appends its own link after these.
  const upTo = (list, n) => list.slice(0, n);
  assert.deepEqual(upTo(paths(header, 'v2-hdr__store'), 3), ['/fashion', '/grocery', '/homeliving']);
  assert.deepEqual(upTo(paths(fashion, 'fs-hdr__back'), 3), ['/', '/grocery', '/homeliving']);
  assert.deepEqual(upTo(paths(grocery, 'gs-hdr__store'), 3), ['/', '/fashion', '/homeliving']);
  assert.deepEqual(upTo(paths(read('src/homeliving/HomeLivingLayout.jsx'), 'hl-hdr__store'), 3), ['/', '/fashion', '/grocery']);
});

// ============================================================
console.log('\n— The stylesheet: namespaced, deferred, three widths, reduced motion —');
// ============================================================

await test('homeliving.css: every selector is under .hl; only transform and opacity transition; a reduced-motion block', () => {
  const css = read('src/styles/homeliving.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(^|\n|\}|\{)\s*([^@{}\n][^{}]*?)\s*\{/g)].map((m) => m[2].trim()).filter(Boolean);
  assert.ok(selectors.length > 60, `${selectors.length} rules`);
  for (const sel of selectors) for (const part of sel.split(',')) assert.match(part.trim(), /^\.hl(\b|-)/, `"${part.trim()}" is namespaced`);
  for (const m of css.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) {
    const v = m[1].trim();
    if (v === 'none' || v === 'none !important') continue;
    for (const prop of v.split(',').map((p) => p.trim().split(/\s+/)[0])) assert.ok(['transform', 'opacity'].includes(prop), `transitions ${prop}`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.hl \*, \.hl \*::before, \.hl \*::after \{ transition: none !important; \}/);
});

await test('390px: stacked hero copy over a top-down wash, circles and cards scroll sideways, 2×2 trust, promo art on top, bottom nav fixed above the safe area', () => {
  const css = read('src/styles/homeliving.css');
  const phone = css.slice(css.indexOf('@media (max-width: 599px)'), css.indexOf('@media (prefers-reduced-motion'));
  assert.match(phone, /\.hl-hero__slide::before \{ background: linear-gradient\(180deg/);
  assert.match(phone, /\.hl-hero__txt \{ max-width: 100%; \}/);
  assert.match(phone, /\.hl-circles \{ display: flex;[^}]*overflow-x: auto/); assert.match(phone, /\.hl-circle \{ flex: 0 0 88px/);
  assert.match(phone, /\.hl-row \{ display: flex;[^}]*scroll-snap-type: x mandatory/); assert.match(phone, /\.hl-card \{ flex: 0 0 168px; scroll-snap-align: start; \}/);
  assert.match(phone, /\.hl-trust \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(phone, /\.hl-promo__art \{ position: static; width: 100%; aspect-ratio: 16 \/ 7; \}/);
  assert.match(css, /\.hl-nav \{ position: fixed; left: 0; right: 0; bottom: 0;[^}]*env\(safe-area-inset-bottom, 0px\)/);
  assert.match(css, /\.hl \{ padding-bottom: calc\(var\(--hl-nav-h\) \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
});

await test('768px: the tablet rules — bar switcher hidden, hero copy at 56%, six circles at 100px, 2×2 trust, promo art at 38%, nav still fixed', () => {
  const css = read('src/styles/homeliving.css');
  const tablet = css.slice(css.indexOf('@media (max-width: 1019px)'), css.indexOf('@media (max-width: 599px)'));
  assert.match(tablet, /\.hl-hdr__stores \{ display: none; \}/);
  assert.match(tablet, /\.hl-hero__txt \{ max-width: 56%; \}/);
  assert.match(tablet, /\.hl-circle__img \{ width: 100px; height: 100px; \}/);
  assert.match(tablet, /\.hl-trust \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(tablet, /\.hl-promo__art \{ width: 38%; \}/);
  assert.doesNotMatch(tablet, /\.hl-nav \{/, 'nothing at 768 un-fixes the nav');
});

await test('1280px: the nav is a static strip under the header, the bar switcher shows, four cards and six circles in a 1280 wrap, the hero and promo run edge to edge', () => {
  const css = read('src/styles/homeliving.css');
  const wide = css.slice(css.indexOf('@media (min-width: 1020px)'), css.indexOf('@media (max-width: 1019px)'));
  assert.match(wide, /\.hl \{ padding-bottom: 0; \}/); assert.match(wide, /\.hl-nav \{ position: static; height: auto;[^}]*justify-content: center/);
  assert.match(css, /\.hl-main \{ display: block; padding: 0 0 48px; \}/, 'no container on main');
  assert.match(css, /\.hl-wrap \{ max-width: 1280px; margin: 0 auto; padding: 0 16px; \}/, 'sections wrap themselves');
  assert.match(css, /\.hl-row \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); gap: 16px; \}/);
  assert.match(css, /\.hl-hdr__stores \{ display: inline-flex/);
});

await test('deferred like grocery: homeliving.css last in DEFERRED, /homeliving in DEFERRED_ROUTES, the route mounted after /grocery and outside the wellness Layout', () => {
  const build = read('build/build-css.mjs');
  const deferred = build.slice(build.indexOf('const DEFERRED = ['), build.indexOf('];', build.indexOf('const DEFERRED = [')));
  assert.match(deferred, /'src\/styles\/grocery\.css',\n[\s\S]*?'src\/styles\/homeliving\.css',\n(\s*\/\/[^\n]*\n\s*'src\/styles\/lifestyle\.css',\n)?$/);
  assert.doesNotMatch(build.slice(build.indexOf('const STOREFRONT = ['), build.indexOf('const DEFERRED')), /homeliving/);
  assert.match(read('src/lib/deferredStyles.js'), /DEFERRED_ROUTES = \/\^\\\/\(admin\|passport\|creator\|fashion\|grocery\|homeliving(\|lifestyle)?\)\(\\\/\|\$\)\/;/);
  const src = read('src/App.jsx');
  // The index route first; later phases add children (category/:slug — test-homeliving-listing.mjs) inside the same block.
  assert.match(src, /<Route path="\/homeliving" element=\{<HomeLivingLayout \/>\}>\n\s+<Route index element=\{<HomeLivingHome \/>\} \/>\n(\s+<Route path="[^"]+" element=\{<HomeLiving[A-Za-z]+ \/>\} \/>\n)*\s+<\/Route>/);
  assert.ok(src.indexOf('<Route path="/grocery"') < src.indexOf('<Route path="/homeliving"') && src.indexOf('<Route path="/homeliving"') < src.indexOf('<Route element={<Layout />}>'));
});

// ============================================================
console.log('\n— Migration 0035 and its rollback —');
// ============================================================

await test('0035 widens the store CHECK on all three tables to include homeliving, seeds the six categories and four demo products with the fixture ids; the rollback deletes them and narrows the CHECK back', () => {
  const sql = read('supabase/migrations/0035_homeliving_store.sql');
  for (const t of ['catalogue_categories', 'catalogue_products', 'catalogue_variants']) {
    assert.match(sql, new RegExp(`alter table public\\.${t}\\s+drop constraint if exists ${t}_store_chk;\\nalter table public\\.${t}\\s+add constraint ${t}_store_chk check \\(store in \\('fashion', 'grocery', 'homeliving'\\)\\);`));
  }
  for (const c of CATEGORIES) assert.match(sql.replace(/\s+/g, ' '), new RegExp(`\\('${c.name.replace(/&/g, '&')}', '${c.slug}', '${c.tagline}', '${c.image_url}'`), `seeds ${c.slug}`);
  for (const p of PRODUCTS) { assert.match(sql.replace(/\s+/g, ' '), new RegExp(`\\('${p.id}', '${p.name}', '${p.slug}'`), `seeds ${p.slug} with the fixture id`); assert.ok(sql.includes(`'${p.sku}'`)); }
  assert.equal((sql.match(/is_demo\)/g) || []).length, 2, 'both seeds are demo rows');
  assert.match(sql, /where p\.store = 'homeliving' and u\.url is not null/, 'media rows for the placeholders');
  const down = read('supabase/migrations/rollback/0035_homeliving_store_down.sql');
  assert.match(down, /delete from public\.catalogue_variants\s+where store = 'homeliving';\ndelete from public\.catalogue_products\s+where store = 'homeliving';\ndelete from public\.catalogue_categories\s+where store = 'homeliving';/);
  for (const t of ['catalogue_categories', 'catalogue_products', 'catalogue_variants']) assert.match(down, new RegExp(`add constraint ${t}_store_chk check \\(store in \\('fashion', 'grocery'\\)\\);`));
  assert.ok(down.indexOf('delete from public.catalogue_products') < down.indexOf("check (store in ('fashion', 'grocery'))"), 'rows go before the CHECK narrows');
});

// ============================================================
console.log('\n— Isolation —');
// ============================================================

await test('the wellness, fashion and grocery storefronts changed only by the approved switcher lines; cart, checkout, coupons, auth, payments and the data layers are byte-identical', () => {
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // The homepage store doorway (FashionBanner.jsx + fashion-banner.css) was redesigned in 71eb538 — an approved wellness change.
  // The lifestyle storefront (test-lifestyle.mjs) — an approved change: its own files, the route, the sheet, one switcher link per shell; and the doorway images (test-store-doorway.mjs).
  // The display typeface swap (test-typeface.mjs) touched index.html and most stylesheets — an approved change; that suite pins the sheets it must not have touched.
  const allowed = /^(src\/homeliving\/|src\/lib\/homeliving[A-Za-z]*\.js$|src\/pages\/Home\.jsx$|src\/styles\/[a-z0-9-]+\.css$|index\.html$|src\/lifestyle\/|src\/data\/lifestyleHomepage\.js$|src\/styles\/lifestyle\.css$|img\/lifestyle-|img\/doorway-|src\/data\/homelivingHomepage\.js$|src\/styles\/homeliving\.css$|scripts\/|supabase\/migrations\/(0035_homeliving_store\.sql|rollback\/0035_homeliving_store_down\.sql)$|src\/App\.jsx$|build\/build-css\.mjs$|src\/lib\/deferredStyles\.js$|src\/components\/Header\.jsx$|src\/styles\/v2-header\.css$|src\/fashion\/FashionLayout\.jsx$|src\/grocery\/GroceryLayout\.jsx$|src\/components\/FashionBanner\.jsx$|src\/styles\/fashion-banner\.css$|img\/homeliving-|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  for (const rel of ['src/lib/store.jsx', 'src/lib/cartLine.js', 'src/lib/couponApi.js', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'api/_lib/pricing.js', 'api/razorpay/create-order.js', 'src/lib/fashionApi.js', 'src/data/groceryHomepage.js', 'src/grocery/GroceryHome.jsx', 'src/fashion/FashionHome.jsx', 'src/styles/layout.css']) { // fashion.css and grocery.css carry the typeface map now (test-typeface.mjs pins it)
    assert.equal(read(rel), atCommit(BASELINE_SHA, rel), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  // The three touched shells differ from the baseline by their switcher lines only.
  const onlySwitcher = (rel, keep) => {
    const now = read(rel).split('\n').filter((l) => !keep.test(l)).join('\n');
    const then = atCommit(BASELINE_SHA, rel).split('\n').filter((l) => !keep.test(l)).join('\n');
    assert.equal(now, then, `${rel}: nothing beyond the switcher lines changed`);
  };
  onlySwitcher('src/components/Header.jsx', /v2-hdr__store"|drawer__cat">(Fashion|Grocery|Home &amp; Living|Lifestyle) store/);
  onlySwitcher('src/fashion/FashionLayout.jsx', /className="fs-hdr__back"|className="fs-drawer__back"/);
  onlySwitcher('src/grocery/GroceryLayout.jsx', /className="gs-hdr__store"|className="gs-drawer__back"/);
  const v2 = read('src/styles/v2-header.css'), v2then = atCommit(BASELINE_SHA, 'src/styles/v2-header.css');
  assert.equal(v2.replace(/@media \(min-width: 1100px\)/, '@media (min-width: 1024px)').replace(/below 1100px \(three short\n   labels beside the search box, the logo and three icons need the room\)/, 'below 1024px'), v2then, 'v2-header.css: the breakpoint and its comment only');
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).split('\n').map((l) => l.slice(3).replace(/^"|"$/g, '')).filter(Boolean);
  assert.ok(!untracked.some((f) => /^package(-lock)?\.json$/.test(f)), 'no dependency change');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
