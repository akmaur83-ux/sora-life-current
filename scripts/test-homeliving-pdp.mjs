// ============================================================
// Home & Living — the product page (/homeliving/p/<slug>). Offline suite.
//
// The ordered gallery from catalogue_product_media (primary first, then
// sort_order; images[] as the fallback; one image or several), the
// selection rules for the three product shapes (size × colour, size-only,
// no variants) with unavailable combinations marked rather than hidden,
// the price row (MRP and discount only for the product's own price), the
// real page rendered through the real router in every state, the
// not-found state inside the shell, every card linking here, no speed
// claim, the three widths, and the isolation of everything else.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-homeliving-pdp.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-homeliving-pdp.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, read, loadModule, buildHomeLivingApp, loadHomeLivingData, CATEGORIES, PRODUCTS, PDP, PDP_PRODUCTS } from './homeliving-ssr.mjs';
import { REPO, atCommit } from './baseline-export.mjs';

// The tip before the product page (the listing's bundle commit).
const BASELINE_SHA = '99c4282';
let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const text = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
console.log(`\nsource root: ${ROOT}`);

const NEW_FILES = ['src/lib/homelivingPdp.js', 'src/homeliving/HomeLivingProductPage.jsx', 'src/homeliving/HomeLivingProductCard.jsx', 'src/data/homelivingHomepage.js', 'src/styles/homeliving.css'];
const SPEED_CLAIMS = [/\bfast\b/i, /\bfaster\b/i, /\bexpress\b/i, /\binstant/i, /\bsecure\s+deliver/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\bquick\b/i, /\brapid\b/i, /\bspeedy\b/i, /\beco[- ]friendly\b/i];

let rules = null;
try { rules = loadModule('src/lib/homelivingPdp.js', {}); } catch { rules = null; }
const data = loadHomeLivingData({ initial: PDP });
const P = data.getHomeLivingCatalogue().products;
const by = (slug) => P.find((p) => p.slug === slug);

// ============================================================
console.log('\n— The gallery: ordered media, images[] as the fallback —');
// ============================================================

await test('galleryOf orders media primary-first then by sort_order (whatever order the rows arrive in), keeps alt text, invents a view number where alt is blank; images[] is the fallback', () => {
  const sheet = by('sage-fitted-sheet');
  assert.deepEqual(sheet.gallery, [
    { url: '/img/homeliving-product-botanical-bedsheet-set.webp', alt: 'Sage Fitted Sheet on a king bed', primary: true },
    { url: '/img/homeliving-circle-bedsheets.webp', alt: 'Folded, showing the print', primary: false },
    { url: '/img/homeliving-hero.webp', alt: 'Sage Fitted Sheet — view 3', primary: false },
  ]);
  const bed = by('botanical-bedsheet-set-king');
  assert.deepEqual(bed.gallery, [{ url: '/img/homeliving-product-botanical-bedsheet-set.webp', alt: 'Botanical Bedsheet Set', primary: true }], 'no media rows → images[]');
  assert.deepEqual(data.galleryOf({ name: 'X', images: [], media: [] }), []);
  assert.deepEqual(data.galleryOf({ name: 'X', images: ['/a.webp', '/b.webp'], media: [{ id: 'm', public_url: '', alt_text: 'blank', sort_order: 0, is_primary: true }] }).map((g) => g.url), ['/a.webp', '/b.webp'], 'a media row without a url does not count');
  // The query really embeds the media rows.
  const calls = [];
  const from = (table) => { const q = { table, ops: [] }; calls.push(q); const chain = new Proxy({}, { get(_, m) { if (m === 'then') return (res) => Promise.resolve({ data: [], error: null }).then(res); return (...a) => { q.ops.push([m, ...a]); return chain; }; } }); return chain; };
  return loadModule('src/data/homelivingHomepage.js', { supabase: { from } }).getHomeLivingProducts().then(() => {
    assert.match(calls[0].ops.find((o) => o[0] === 'select')[1], /, media:catalogue_product_media \(id, public_url, alt_text, sort_order, is_primary\)$/, 'the embed');
  });
});

// ============================================================
console.log('\n— The selection rules: three shapes —');
// ============================================================

await test('selectionShape: size-colour / size / none', () => {
  assert.ok(rules, 'src/lib/homelivingPdp.js exists');
  assert.equal(rules.selectionShape(by('sage-fitted-sheet')), 'size-colour');
  assert.equal(rules.selectionShape(by('waffle-bath-towel')), 'size');
  assert.equal(rules.selectionShape(by('botanical-bedsheet-set-king')), 'none');
});

await test('size × colour: availability answers for the pair; King/Sage is out while Single/Sage is in; a missing pair says so; the prompt names what is still to choose', () => {
  const v = by('sage-fitted-sheet');
  const none = rules.selectionState(v, {});
  assert.equal(none.status, 'choose'); assert.equal(none.missing, 'Choose a size and colour'); assert.equal(none.canAdd, false); assert.equal(none.price, 999);
  assert.deepEqual(none.sizes.map((s) => [s.size, s.available]), [['Single', true], ['King', true]], 'King is available in Ivory');
  assert.deepEqual(none.colours.map((c) => [c.colour, c.available]), [['Sage', true], ['Ivory', true]]);
  const sage = rules.selectionState(v, { colour: 'Sage' });
  assert.deepEqual(sage.sizes.map((s) => [s.size, s.available]), [['Single', true], ['King', false]], 'King in Sage is out');
  assert.equal(sage.missing, 'Choose a size');
  const king = rules.selectionState(v, { size: 'King' });
  assert.deepEqual(king.colours.map((c) => [c.colour, c.available]), [['Sage', false], ['Ivory', true]]);
  assert.equal(king.missing, 'Choose a colour');
  const out = rules.selectionState(v, { size: 'King', colour: 'Sage' });
  assert.equal(out.status, 'out'); assert.equal(out.stockNote, 'Out of stock in this size and colour'); assert.equal(out.canAdd, false); assert.equal(out.label, 'King · Sage');
  const inn = rules.selectionState(v, { size: 'Single', colour: 'Sage' });
  assert.equal(inn.status, 'in'); assert.equal(inn.canAdd, true); assert.equal(inn.stock, 6);
  const low = rules.selectionState(v, { size: 'Single', colour: 'Ivory' });
  assert.equal(low.status, 'low'); assert.equal(low.stockNote, 'Only 2 left');
  assert.deepEqual(rules.readSelection('size=King&colour=Sage', v), { size: 'King', colour: 'Sage' });
  assert.deepEqual(rules.readSelection('size=XXL&colour=Rust', v), { size: null, colour: null }, 'unknown choices are ignored');
  assert.equal(rules.writeSelection(new URLSearchParams('x=1'), { size: 'King', colour: null }).toString(), 'x=1&size=King');
});

await test('size-only: complete once a size is chosen; the out size is marked, not hidden; a variant price_override is shown alone without the product MRP', () => {
  const v = by('waffle-bath-towel');
  const none = rules.selectionState(v, {});
  assert.equal(none.missing, 'Choose a size'); assert.deepEqual(none.colours, []);
  assert.deepEqual(none.sizes.map((s) => [s.size, s.available]), [['Hand', true], ['Bath', true], ['Sheet', false]]);
  assert.deepEqual(rules.readSelection('size=Hand&colour=Sage', v), { size: 'Hand', colour: null }, 'a colour is never read for a size-only product');
  const hand = rules.selectionState(v, { size: 'Hand' });
  assert.equal(hand.status, 'in'); assert.equal(hand.canAdd, true); assert.equal(hand.label, 'Hand');
  assert.equal(hand.price, 349); assert.equal(hand.hasDiscount, false); assert.equal(hand.discountPct, 0, 'an override has no MRP it was measured against');
  const bath = rules.selectionState(v, { size: 'Bath' });
  assert.equal(bath.price, 749); assert.equal(bath.hasDiscount, true); assert.equal(bath.discountPct, 17); assert.equal(bath.status, 'low');
  const sheet = rules.selectionState(v, { size: 'Sheet' });
  assert.equal(sheet.status, 'out'); assert.equal(sheet.stockNote, 'Out of stock in this size');
});

await test('no variants: the product\'s own stock decides; in / low / out; the price row is the product\'s with its discount_percent', () => {
  const bed = rules.selectionState(by('botanical-bedsheet-set-king'), {});
  assert.equal(bed.shape, 'none'); assert.equal(bed.status, 'in'); assert.equal(bed.canAdd, true); assert.equal(bed.stock, 40); assert.equal(bed.missing, null);
  assert.equal(bed.price, 1499); assert.equal(bed.mrp, 1899); assert.equal(bed.hasDiscount, true); assert.equal(bed.discountPct, 21);
  const curtain = rules.selectionState(by('linen-curtain-pair'), {});
  assert.equal(curtain.status, 'out'); assert.equal(curtain.stockNote, 'Out of stock'); assert.equal(curtain.canAdd, false);
  assert.equal(rules.selectionState(data.homelivingProductView({ ...PDP_PRODUCTS[0], stock: 3 }), {}).stockNote, 'Only 3 left');
  assert.equal(rules.selectionState(data.homelivingProductView({ ...PDP_PRODUCTS[5], sale_price: null }), {}).hasDiscount, false, 'no sale, no strike-through');
  assert.deepEqual(rules.readSelection('size=King', by('botanical-bedsheet-set-king')), { size: null, colour: null });
});

await test('relatedFor: same category, then same brand, never itself, capped', () => {
  const rel = rules.relatedFor(by('sage-fitted-sheet'), P, 4).map((p) => p.slug);
  assert.ok(!rel.includes('sage-fitted-sheet')); assert.equal(rel.length, 4);
  assert.equal(rules.relatedFor(by('botanical-bedsheet-set-king'), P, 2).length, 2);
  assert.deepEqual(rules.relatedFor(by('jute-runner'), [by('jute-runner')]), []);
});

// ============================================================
console.log('\n— The page, rendered through the real router —');
// ============================================================

const app = await buildHomeLivingApp({ cartCount: 1, initial: PDP }).catch((e) => ({ error: e }));
const render = (p) => app.render(p);

await test('/homeliving/p/sage-fitted-sheet: breadcrumb back through the category, three ordered slides with thumbnails and alt text, brand, name, net_content, price with MRP and discount, both selectors, delivery, description, details, related', () => {
  assert.ok(!app.error, app.error?.message);
  const html = render('/homeliving/p/sage-fitted-sheet');
  assert.match(html, /<div class="hl"><header class="hl-hdr">/, 'inside the shell');
  assert.match(html, /<nav class="hl-crumb" aria-label="Breadcrumb"><ol><li><a href="\/homeliving">Home &amp; Living<\/a><\/li><li><a href="\/homeliving\/category\/bedsheets">Bedsheets<\/a><\/li><li><a href="\/homeliving\/category\/fitted-sheets">Fitted Sheets<\/a><\/li><li><span aria-current="page">Sage Fitted Sheet<\/span><\/li><\/ol><\/nav>/);
  const slides = [...html.matchAll(/<figure class="hl-gallery__slide[^"]*" id="hl-slide-(\d)"><img src="([^"]+)" alt="([^"]*)"/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(slides, [['0', '/img/homeliving-product-botanical-bedsheet-set.webp', 'Sage Fitted Sheet on a king bed'], ['1', '/img/homeliving-circle-bedsheets.webp', 'Folded, showing the print'], ['2', '/img/homeliving-hero.webp', 'Sage Fitted Sheet — view 3']], 'primary first, in order, with alt text');
  assert.match(html, /<figure class="hl-gallery__slide is-on" id="hl-slide-0"><img [^>]*loading="eager" fetchpriority="high"\/>/);
  assert.equal((html.match(/class="hl-gallery__thumb( is-on)?"/g) || []).length, 3, 'a thumbnail per image');
  assert.match(html, /<a href="#hl-slide-0" role="tab" aria-selected="true" class="hl-gallery__thumb is-on">/);
  assert.match(html, /<p class="hl-pdp__brand">Meadow Weave<\/p><h1 class="hl-pdp__h serif">Sage Fitted Sheet<\/h1><p class="hl-pdp__size">Fitted sheet<\/p>/);
  assert.match(html, /<p class="hl-price hl-price--lg" data-price="999"><strong><span class="hl-price__cur">₹<\/span>999<\/strong><span class="hl-price__mrp">M\.R\.P: <s>₹1,299<\/s><\/span><span class="hl-badge">23% OFF<\/span><\/p><p class="hl-pdp__tax">Inclusive of all taxes<\/p>/);
  assert.match(html, /<legend>Colour<\/legend>/); assert.match(html, /<legend>Size<\/legend>/);
  assert.deepEqual([...html.matchAll(/class="hl-pick__swatch[^"]*" style="--sw:([^"]+)"/g)].map((m) => m[1]), ['#8A9A6B', '#EDE6D6']);
  assert.deepEqual([...html.matchAll(/class="hl-pick__size[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]), ['Single', 'King']);
  assert.match(html, /<p class="hl-pick__note is-choose" role="status">Choose a size and colour<\/p>/);
  assert.match(html, /<h2 class="hl-pdp__h2" id="hl-deliv-h">[\s\S]*?Delivery<\/h2><p class="hl-pdp__ship"><span>Standard delivery<em>6-7 days<\/em><\/span><b>Free<\/b><\/p><p class="hl-pdp__fine">Other delivery options are chosen at checkout\.<\/p>/);
  assert.match(html, /About this product<\/h2><p class="hl-pdp__desc">Sage Fitted Sheet\.<\/p>/);
  assert.match(html, /<dt>Category<\/dt><dd>Bedsheets › Fitted Sheets<\/dd>/); assert.match(html, /<dt>Sizes<\/dt><dd>Single, King<\/dd>/); assert.match(html, /<dt>Colours<\/dt><dd>Sage, Ivory<\/dd>/); assert.match(html, /<dt>SKU<\/dt><dd>SL-HL-FIT-SAGE<\/dd>/);
  const related = html.slice(html.indexOf('You may also like'));
  const cards = [...related.matchAll(/data-product="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(cards.length === 4 && !cards.includes('sage-fitted-sheet'), 'related, never itself');
});

await test('the URL drives the selection: ?size=King&colour=Sage marks Sage struck for King and says out of stock; ?size=Single&colour=Ivory says Only 2 left; the phone bar mirrors it', () => {
  const out = render('/homeliving/p/sage-fitted-sheet?size=King&colour=Sage');
  assert.match(out, /<legend>Colour<b>: Sage<\/b><\/legend>/); assert.match(out, /<legend>Size<b>: King<\/b><\/legend>/);
  assert.match(out, /class="hl-pick__swatch is-on is-out" style="--sw:#8A9A6B" aria-pressed="true" aria-label="Sage — not available for this size"/, 'the chosen colour stays chosen but is marked out for this size');
  assert.match(out, /<button type="button" class="hl-pick__size is-on is-out" aria-pressed="true" aria-label="King — out of stock"/, 'the chosen size stays chosen (so it can be un-chosen) but is marked out for Sage');
  assert.match(out, /<p class="hl-pick__note is-out" role="status">Out of stock in this size and colour<\/p>/);
  assert.match(out, /<div class="hl-pdp__bar" role="region" aria-label="Buy" data-slot="add-to-cart"><span class="hl-pdp__bar-price"><b><span class="hl-price__cur">₹<\/span>999<\/b><em>King · Sage<\/em><\/span><span class="hl-pick__note is-out">Out of stock in this size and colour<\/span><\/div>/);
  const low = render('/homeliving/p/sage-fitted-sheet?size=Single&colour=Ivory');
  assert.match(low, /<p class="hl-pick__note is-low" role="status">Only 2 left<\/p>/);
  assert.match(low, /data-can-add="yes"/);
  const sageOnly = render('/homeliving/p/sage-fitted-sheet?colour=Sage');
  assert.match(sageOnly, /<button type="button" class="hl-pick__size is-out" aria-pressed="false" disabled="" aria-label="King — out of stock"/, 'King is disabled for Sage, not hidden');
  assert.match(sageOnly, /Choose a size<\/p>/);
});

await test('size-only and no-variant products: sizes alone with the out one struck; the product\'s own stock line with no picker; an override shown without MRP', () => {
  const towel = render('/homeliving/p/waffle-bath-towel?size=Hand');
  assert.doesNotMatch(towel, /<legend>Colour/); assert.match(towel, /<legend>Size<b>: Hand<\/b><\/legend>/);
  assert.match(towel, /class="hl-pick__size is-out" aria-pressed="false" disabled="" aria-label="Sheet — out of stock"/);
  assert.match(towel, /<p class="hl-price hl-price--lg" data-price="349"><strong><span class="hl-price__cur">₹<\/span>349<\/strong><\/p>/, 'no MRP against an override');
  const bed = render('/homeliving/p/botanical-bedsheet-set-king');
  assert.doesNotMatch(bed, /hl-pick__group/, 'no picker');
  assert.match(bed, /<p class="hl-pick__note hl-pick__note--solo is-in" role="status">In stock<\/p>/);
  assert.equal((bed.match(/class="hl-gallery__thumb( is-on)?"/g) || []).length, 0, 'one image, no thumbnails');
  assert.equal((bed.match(/<figure class="hl-gallery__slide/g) || []).length, 1);
  assert.match(bed, /data-price="1499"[\s\S]*?21% OFF/);
  const curtain = render('/homeliving/p/linen-curtain-pair');
  assert.match(curtain, /<p class="hl-pick__note hl-pick__note--solo is-out" role="status">Out of stock<\/p>/); assert.match(curtain, /data-can-add="no"/);
});

await test('no Add button anywhere, but the slot is reserved: the action row and the phone bar carry data-slot="add-to-cart"; the wishlist sits in the second cell', () => {
  const html = render('/homeliving/p/sage-fitted-sheet');
  assert.doesNotMatch(html, /<button[^>]*>[^<]*Add to (cart|bag)/i);
  assert.match(html, /<div class="hl-pdp__actions" data-slot="add-to-cart" data-can-add="no"><button type="button" class="hl-card__heart hl-heart--inline" aria-label="Save Sage Fitted Sheet to wishlist" aria-disabled="true">/);
  assert.match(read('src/styles/homeliving.css'), /\.hl-pdp__actions \{ display: grid; grid-template-columns: minmax\(0, 1\.4fr\) 48px;/, 'the first cell is kept for it');
  assert.match(read('src/styles/homeliving.css'), /\.hl-heart--inline \{[^}]*grid-column: 2;/);
});

await test('unknown slug: a not-found state inside the shell, never a crash; loading says loading', async () => {
  const html = render('/homeliving/p/nope');
  assert.match(html, /<div class="hl"><header class="hl-hdr">[\s\S]*?<span aria-current="page">Not found<\/span>/);
  assert.match(html, /<p>There is no “nope” in the Home &amp; Living store\.<\/p><a class="hl-btn" href="\/homeliving">Back to Home &amp; Living<\/a>/);
  assert.match(html, /data-stub="footer"/);
  const loading = await buildHomeLivingApp({ initial: null });
  assert.match(loading.render('/homeliving/p/sage-fitted-sheet'), /Loading the catalogue…/);
});

await test('every card links here: the homepage featured row, the listing grid and the related row all point at /homeliving/p/<slug>, and each resolves', async () => {
  const seeded = await buildHomeLivingApp({ initial: { categories: CATEGORIES, products: PRODUCTS } });
  const hrefs = new Set();
  for (const page of ['/homeliving', '/homeliving/category/bedsheets', '/homeliving/p/cotton-quilt-single']) {
    const html = seeded.render(page);
    const cards = [...html.matchAll(/<article class="hl-card[^"]*" data-product="([^"]+)">[\s\S]*?<\/article>/g)];
    assert.ok(cards.length > 0, `${page} has cards`);
    for (const m of cards) {
      const [, slug] = m; const c = m[0];
      assert.ok(c.includes(`<a class="hl-card__img" aria-label="`) && c.includes(`href="/homeliving/p/${slug}">`), `${slug}: the image links`);
      assert.ok(c.includes(`<h3 class="hl-card__name"><a href="/homeliving/p/${slug}">`), `${slug}: the name links`);
      hrefs.add(`/homeliving/p/${slug}`);
    }
  }
  assert.ok(hrefs.size >= 4);
  for (const href of hrefs) assert.match(seeded.render(href), /<h1 class="hl-pdp__h serif">/, `${href} resolves`);
});

await test('text rule and copy: every gallery image has alt text, every thumbnail is decorative, every label is text; no speed claim in the new code or the page', () => {
  const html = render('/homeliving/p/sage-fitted-sheet');
  for (const m of html.matchAll(/<figure class="hl-gallery__slide[^>]*><img [^>]*>/g)) assert.match(m[0], / alt="[^"]+"/);
  for (const m of html.matchAll(/class="hl-gallery__thumb[^>]*><img [^>]*>/g)) assert.match(m[0], / alt=""/);
  const t = text(html);
  for (const s of ['Sage Fitted Sheet', '₹ 999', 'M.R.P: ₹1,299', '23% OFF', 'Fitted sheet', 'Standard delivery 6-7 days Free', 'Inclusive of all taxes']) assert.ok(t.includes(s), s);
  for (const rel of NEW_FILES) for (const re of SPEED_CLAIMS) assert.ok(!re.test(read(rel)), `${rel} matches ${re}`);
  for (const re of SPEED_CLAIMS) assert.ok(!re.test(t), `rendered page matches ${re}`);
  const src = stripComments(read('src/homeliving/HomeLivingProductPage.jsx'));
  assert.doesNotMatch(src, /\/img\/homeliving-|Botanical|price:\s*\d|₹\s*\d/, 'nothing hardcoded');
  assert.doesNotMatch(src, /\b(st|view)\.(price|mrp)\s*[+\-*/]|[+\-*/]\s*(st|view)\.(price|mrp)\b|Math\.round/, 'no price arithmetic in the component');
});

// ============================================================
console.log('\n— The stylesheet: three widths —');
// ============================================================

await test('1280: two-column PDP with a sticky gallery and thumbnails; 768: one column, thumbnails hidden, the track swipes; 390: the fixed price bar sits above the bottom nav', () => {
  const css = read('src/styles/homeliving.css');
  assert.match(css, /\.hl-pdp__grid \{ display: grid; grid-template-columns: minmax\(0, 1\.05fr\) minmax\(0, 1fr\); gap: 32px;/);
  assert.match(css, /\.hl-gallery \{ position: sticky; top: 196px;/);
  assert.match(css, /\.hl-gallery__track \{ display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory;/);
  assert.match(css, /\.hl-pdp__bar \{ display: none; \}/);
  const tablet = css.slice(css.indexOf('@media (max-width: 1019px)'), css.indexOf('@media (max-width: 599px)'));
  assert.match(tablet, /\.hl-pdp__grid \{ grid-template-columns: minmax\(0, 1fr\); gap: 20px; \}/); assert.match(tablet, /\.hl-gallery \{ position: static; \}/); assert.match(tablet, /\.hl-gallery__thumbs \{ display: none; \}/);
  const phone = css.slice(css.indexOf('@media (max-width: 599px)'), css.indexOf('@media (prefers-reduced-motion'));
  assert.match(phone, /\.hl-pdp \{ padding-bottom: 92px; \}/);
  assert.match(phone, /\.hl-pdp__bar \{ position: fixed; left: 0; right: 0; bottom: calc\(var\(--hl-nav-h\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
  const all = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const sel of [...all.matchAll(/(^|\n|\}|\{)\s*([^@{}\n][^{}]*?)\s*\{/g)].map((m) => m[2].trim()).filter(Boolean)) for (const part of sel.split(',')) assert.match(part.trim(), /^\.hl(\b|-)/, `"${part.trim()}" is namespaced`);
  for (const m of all.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) { const v = m[1].trim(); if (v.startsWith('none')) continue; for (const prop of v.split(',').map((p) => p.trim().split(/\s+/)[0])) assert.ok(['transform', 'opacity'].includes(prop), `transitions ${prop}`); }
});

// ============================================================
console.log('\n— Wiring and isolation —');
// ============================================================

await test('App.jsx: p/:slug is a child of the Home & Living route; nothing else shared changed; the other storefronts, cart, checkout, coupons, auth and payments are byte-identical', () => {
  const src = read('src/App.jsx');
  assert.match(src, /<Route path="category\/:slug" element=\{<HomeLivingCategory \/>\} \/>\n\s+<Route path="p\/:slug" element=\{<HomeLivingProductPage \/>\} \/>\n\s+<\/Route>/);
  // The lifestyle storefront (a later phase) added its own imports and route block; strip those before comparing.
  assert.equal(src.replace("import HomeLivingProductPage from './homeliving/HomeLivingProductPage.jsx';\n", '').replace('        <Route path="p/:slug" element={<HomeLivingProductPage />} />\n', '').replace(/import Lifestyle[A-Za-z]+ from '\.\/lifestyle\/Lifestyle[A-Za-z]+\.jsx';\n/g, '').replace(/\n\s*\{\/\*[^*]*lifestyle[^*]*\*\/\}\n\s+<Route path="\/lifestyle" element=\{<LifestyleLayout \/>\}>\n\s+<Route index element=\{<LifestyleHome \/>\} \/>\n\s+<\/Route>\n/, '\n'), atCommit(BASELINE_SHA, 'src/App.jsx'), 'App.jsx: the import and the route, nothing else');
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // The homepage store doorway (FashionBanner.jsx + fashion-banner.css) was redesigned in 71eb538 — an approved wellness change.
  // The lifestyle storefront (test-lifestyle.mjs) — an approved change: its own files, the route, the sheet, one switcher link per shell; and the doorway images (test-store-doorway.mjs).
  // The display typeface swap (test-typeface.mjs) touched index.html and most stylesheets — an approved change; that suite pins the sheets it must not have touched.
  // Three approved changes landed beside this section and moved files these pins guard:
  //   86ea8cf  src/components/Hero.jsx   — the wellness hero drops the Supabase render-transform URLs (test-homepage-appearance.mjs)
  //   e58317c  src/fashion/FashionHome.jsx — the campaign hero leads /fashion (test-fashion.mjs pins the new order)
  //   a651320  src/pages/Legal.jsx       — the shipping policy rewrite (test-company-surfaces.mjs pins the policy)
  const allowed = /^(src\/homeliving\/|src\/lib\/homelivingPdp\.js$|src\/pages\/Home\.jsx$|src\/components\/Hero\.jsx$|src\/fashion\/FashionHome\.jsx$|src\/pages\/Legal\.jsx$|src\/styles\/[a-z0-9-]+\.css$|index\.html$|src\/lifestyle\/|src\/data\/lifestyleHomepage\.js$|src\/styles\/lifestyle\.css$|img\/lifestyle-|img\/doorway-|img\/homeliving-hero-|build\/build-css\.mjs$|src\/lib\/deferredStyles\.js$|src\/components\/Header\.jsx$|src\/fashion\/FashionLayout\.jsx$|src\/grocery\/GroceryLayout\.jsx$|src\/data\/homelivingHomepage\.js$|src\/styles\/homeliving\.css$|src\/App\.jsx$|src\/components\/FashionBanner\.jsx$|src\/styles\/fashion-banner\.css$|scripts\/|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  for (const rel of ['src/lib/store.jsx', 'src/lib/cartLine.js', 'src/lib/couponApi.js', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'api/_lib/pricing.js', 'api/razorpay/create-order.js', 'src/components/Header.jsx', 'src/fashion/FashionProductPage.jsx', 'src/fashion/FashionLayout.jsx', 'src/lib/fashionPdp.js', 'src/grocery/GroceryLayout.jsx', 'src/data/groceryHomepage.js', 'src/homeliving/HomeLivingCategory.jsx', 'src/lib/homelivingListing.js', 'build/build-css.mjs', 'src/lib/deferredStyles.js']) {
  // The homepage rework (test-homeliving-hero.mjs): the hero runs to the top with the shell floating over it — an approved change to the store's own homepage files; that suite pins the category and product pages unchanged.
    // The lifestyle storefront (test-lifestyle.mjs) added one line about /lifestyle to each shell and the two build files; nothing else.
    const sansLifestyle = (t) => t.split('\n').filter((l) => !/\/lifestyle\b|lifestyle\.css|Lifestyle store/.test(l)).join('\n').replace('|lifestyle)', ')');
    assert.equal(sansLifestyle(read(rel)), sansLifestyle(atCommit(BASELINE_SHA, rel)), `${rel} is byte-identical to ${BASELINE_SHA} but for its lifestyle line`);
  }
  assert.ok(![...changed].some((f) => /^supabase\//.test(f)), 'no migration');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
