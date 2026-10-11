// ============================================================
// /fashion/jewellery — the SORA LIFE Jewellery page (FashionJewellery.jsx,
// jewelleryContent.js, the .jw rules in fashion-departments.css) — offline suite.
//
// Laid out as the owner's reference, section for section: the hero, one trust
// strip, seven category circles, four real catalogue pieces, two editorial
// banners, the story beside the craftsmanship photograph, the newsletter. Every
// statement is true; nothing claims sourcing, certification, sustainability,
// popularity or reviews; prices and ratings come only from the catalogue. The
// shared files (the route, the fashion header, the women's page link, the
// departments' sheet) change exactly as scripts/pins/fashion-jewellery.patch
// records. NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-fashion-jewellery.mjs
//   FASHION_SRC_ROOT=<pre-change checkout> node scripts/test-fashion-jewellery.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { buildFashionApp, loadModule, INITIAL, ROOT, read, has } from './fashion-ssr.mjs';
import { loadSource } from './grocery-ssr.mjs';
import { atCommit } from './baseline-export.mjs';

// The tree before this page: the Fashion portrait renamed (16e5395).
const BASELINE_SHA = '16e5395';
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const h = React.createElement;
const text = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ');
console.log(`\nsource root: ${ROOT}`);

/** Width and height from a WebP header. */
function webpSize(buf) {
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${chunk}`);
}
/** WCAG 2.x contrast of two #rrggbb colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ---- the catalogue: Jewellery and its seven sub-categories as the owner created them -------
const jid = (n) => `00000000-0000-4000-8000-00000000a${String(n).padStart(3, '0')}`;
const SUBS = [['Rings', 'rings'], ['Necklaces', 'necklaces'], ['Earrings', 'earrings'], ['Bracelets', 'bracelets'], ['Wedding', 'wedding-jewellery'], ["Men's", 'mens-jewellery'], ['Gifts', 'jewellery-gifts']];
const J_CATEGORIES = [
  { id: jid(100), parent_id: null, name: 'Jewellery', slug: 'jewellery', tagline: '', image_url: null, sort_order: 5, is_active: true },
  ...SUBS.map(([name, slug], i) => ({ id: jid(101 + i), parent_id: jid(100), name, slug, tagline: '', image_url: null, sort_order: i + 1, is_active: true })),
  { id: jid(120), parent_id: jid(100), name: 'Archive', slug: 'jewellery-archive', tagline: '', image_url: null, sort_order: 9, is_active: false },
];
const base = INITIAL.products[0];
const piece = (n, slug, cat, extra = {}) => ({ ...base, id: jid(200 + n), name: slug.replace(/-/g, ' '), slug, category_id: jid(cat), mrp: 5000 + n * 100, sale_price: 4000 + n * 100, discount_percent: 20, images: [`/img/${slug}.webp`], rating: 0, review_count: 0, is_new: false, is_bestseller: false, sort_order: n, is_demo: false, ...extra });
const J_PRODUCTS = [
  piece(1, 'plain-gold-band', 101),
  piece(2, 'pendant-necklace', 102, { is_bestseller: true, sort_order: 5, rating: 4.6, review_count: 12 }),
  piece(3, 'drop-earrings', 103, { is_new: true }),
  piece(4, 'chain-bracelet', 104),
  piece(5, 'wedding-band-pair', 105, { is_bestseller: true, sort_order: 6 }),
  piece(6, 'archived-ring', 120, { is_bestseller: true }),
];
const WITH = { categories: [...INITIAL.categories, ...J_CATEGORIES], products: [...INITIAL.products, ...J_PRODUCTS] };
const EMPTY = { categories: [...INITIAL.categories, ...J_CATEGORIES], products: INITIAL.products };

const app = await buildFashionApp();
const page = has('src/fashion/FashionJewellery.jsx') ? app.render('/fashion/jewellery', WITH) : '';
const empty = has('src/fashion/FashionJewellery.jsx') ? app.render('/fashion/jewellery', EMPTY) : '';
const content = has('src/fashion/jewelleryContent.js') ? loadModule('src/fashion/jewelleryContent.js').JEWELLERY : null;

// ---- the photographs -----------------------------------------------------------
const IMAGES = {
  'jewellery-hero': [1600, 667], 'jewellery-hero-1000': [1000, 417], 'jewellery-hero-mobile': [800, 1067],
  'jewellery-cat-rings': [400, 400], 'jewellery-cat-necklaces': [400, 400], 'jewellery-cat-earrings': [400, 400], 'jewellery-cat-bracelets': [400, 400],
  'jewellery-cat-wedding': [400, 400], 'jewellery-cat-mens': [400, 400], 'jewellery-cat-gifts': [400, 400],
  'jewellery-edit-wedding': [1200, 686], 'jewellery-edit-wedding-700': [700, 400], 'jewellery-edit-gifting': [1200, 686], 'jewellery-edit-gifting-700': [700, 400],
  'jewellery-story': [800, 960], 'jewellery-news': [1600, 625], 'jewellery-news-mobile': [800, 741],
};
await test('the photographs: seventeen WebP files under new names, each under 150 KB, at the sizes the content declares; every image the page names exists', () => {
  for (const [name, [w, hgt]] of Object.entries(IMAGES)) {
    const rel = `img/fashion-editorial/${name}.webp`;
    assert.ok(has(rel), `${rel} is missing`);
    assert.ok(statSync(resolve(ROOT, rel)).size <= 150 * 1024, `${rel} is over 150 KB`);
    assert.deepEqual(webpSize(readFileSync(resolve(ROOT, rel))), [w, hgt], `${rel} dimensions`);
  }
  assert.ok(content, 'jewelleryContent.js');
  const named = JSON.stringify(content).match(/\/img\/fashion-editorial\/[a-z0-9-]+\.webp/g);
  for (const src of new Set(named)) assert.ok(has(src.slice(1)), `${src} is named but missing`);
  for (const image of [content.hero.image, ...content.edits.map((e) => e.image), content.story.image]) {
    const [w, hgt] = webpSize(readFileSync(resolve(ROOT, image.src.slice(1))));
    assert.deepEqual([image.width, image.height], [w, hgt], `${image.src}: declared size`);
  }
});

// ---- the route and the page -------------------------------------------------------
await test('the route: /fashion/jewellery in App.jsx; the page has its own header — a bar of two true facts, the logo, its links, the icons — never the default header and its "Fast & reliable delivery"', () => {
  assert.match(read('src/App.jsx'), /<Route path="jewellery" element={<FashionJewellery \/>} \/>/);
  assert.match(read('src/App.jsx'), /import FashionJewellery from '\.\/fashion\/FashionJewellery\.jsx';/);
  assert.match(page, /<div class="fs fs--jewellery">/, 'its own shell class');
  assert.match(page, /<header class="jw-header"><p class="jw-header__bar"><span>Free standard delivery on every order<\/span><span>Easy returns within 7 days of delivery<\/span><\/p>/);
  assert.match(page, /<nav class="jw-header__nav" aria-label="Jewellery"><a href="\/fashion\/jewellery">Home<\/a><a href="#jw-products">Shop<\/a><a href="#jw-categories">Collections<\/a><a href="\/fashion\/women">Women<\/a><a href="\/about">About<\/a><a href="\/contact">Contact<\/a><\/nav>/);
  assert.doesNotMatch(page, /fs-hdr|fs-strip|Fast &amp; reliable|Fast & reliable/, 'not the default header');
});

await test('the sections in the reference\'s order: hero, trust strip, shop by category, our most loved pieces, the two banners, our story, the newsletter — and nothing else (no second trust strip, no reviews, no Instagram)', () => {
  const order = [...page.matchAll(/<(?:section|nav) class="(jw-[a-z]+)[ "]/g)].map((m) => m[1]);
  assert.deepEqual(order, ['jw-hero', 'jw-trust', 'jw-cats', 'jw-loved', 'jw-edits', 'jw-story', 'jw-news']);
  assert.match(page, /<h1 id="jw-title"><span>Jewellery that tells<\/span><span>your story<\/span><\/h1><p class="jw-hero__intro">Timeless designs for your most precious moments<\/p><a class="jw-button" href="\/fashion\/c\/jewellery">Shop the collection <svg/, 'the hero: two-line headline, subline, CTA to the Jewellery listing');
  assert.match(page, /<p class="jw-eyebrow">SORA LIFE Jewellery<\/p>/);
  const trust = [...page.matchAll(/<li><a href="([^"]+)"><svg[\s\S]*?<\/svg><span class="jw-trust__full"><strong>([^<]+)<\/strong><small>([^<]+)<\/small><\/span><span class="jw-trust__phone"><strong>([^<]+)<\/strong><small>([^<]+)<\/small><\/span><\/a><\/li>/g)].map((m) => m.slice(1));
  assert.deepEqual(trust, [
    ['/shipping', 'Free Standard Delivery', 'On every order', 'Free Standard', 'Delivery'],
    ['/returns', 'Easy Returns', '7 days from delivery', 'Easy Returns', '7 days'],
    ['/shipping', 'Cash on Delivery', 'Available', 'Cash on', 'Delivery'],
    ['/contact', 'Support', '9am–6pm IST', 'Support', '9am–6pm IST'],
  ]);
  assert.equal((page.match(/class="jw-trust"/g) || []).length, 1, 'one trust strip');
  assert.match(page, /<h2 id="jw-story-title">Made to be worn every day<\/h2><p>Pieces chosen for how they feel and how long they last, for the moments you want to remember\.<\/p><a class="jw-button" href="\/about">Our story <svg/);
  assert.match(page, /<h2 id="jw-news-title">Be the first to know<\/h2><p>Subscribe to hear when new jewellery arrives\. You can unsubscribe whenever you like\.<\/p><form class="jw-news__form" novalidate="">/);
});

await test('shop by category: seven circles — Rings, Necklaces, Earrings, Bracelets, Wedding, Men\'s, Gifts — each opening its own sub-category listing; the two banners open Wedding and Gifts', () => {
  const circles = [...page.matchAll(/<li><a class="jw-cat" href="([^"]+)"><picture class="jw-cat__art"><img src="\/img\/fashion-editorial\/jewellery-cat-[a-z]+\.webp"[^>]*alt="[^"]{8,}"[^>]*\/><\/picture><span>([^<]+)<\/span><\/a><\/li>/g)].map((m) => [m[2].replace('&#x27;', '\''), m[1]]);
  assert.deepEqual(circles, SUBS.map(([name, slug]) => [name, `/fashion/c/${slug}`]));
  assert.match(page, /<a class="jw-edit jw-edit--1" href="\/fashion\/c\/wedding-jewellery">[\s\S]*?<h2><span>For life&#x27;s<\/span><span>special<\/span><span>moments<\/span><\/h2><span class="jw-button">Explore wedding <svg/);
  assert.match(page, /<a class="jw-edit jw-edit--2" href="\/fashion\/c\/jewellery-gifts">[\s\S]*?<h2><span>A gift<\/span><span>to treasure<\/span><\/h2><span class="jw-button">Shop gifts <svg/);
  // Without the categories in the catalogue nothing breaks: every link falls back to the page's own products.
  const bare = app.render('/fashion/jewellery');
  assert.equal((bare.match(/<a class="jw-cat" href="[^"]*#jw-products">/g) || []).length, 7);
});

await test('our most loved pieces: four real catalogue pieces from Jewellery\'s active sub-categories, any flagged bestseller first; prices and ratings exactly the catalogue\'s; the empty state until products exist, with no price, rating or card', () => {
  const cards = [...page.matchAll(/data-product="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(cards)], ['pendant-necklace', 'wedding-band-pair', 'drop-earrings', 'plain-gold-band'], 'bestsellers, then new, then the admin order; four');
  assert.doesNotMatch(page, /archived-ring|meadow-linen-shirt-sage/, 'nothing from a hidden sub-category or outside Jewellery');
  assert.match(page, /<h2 id="jw-loved-title">Our most loved pieces<\/h2><a class="jw-more" href="\/fashion\/c\/jewellery">View all <svg/);
  assert.ok(text(page).includes('4.6') && text(page).includes('(12)'), 'the one rated piece shows its real rating');
  assert.doesNotMatch(empty, /data-product=|fs-price|fs-rating|jw-loved__grid|View all/);
  assert.match(empty, /<div class="jw-empty" role="status"><p>Our first jewellery pieces are on their way\. Explore the categories above in the meantime\.<\/p><a href="#jw-categories" class="jw-more">Shop by category <svg/);
});

await test('the newsletter posts to the site\'s sign-up and confirms ONLY after the server stores the address: a refusal, a failed request or an invalid address never shows the confirmation', async () => {
  const { hooks, mount, findAll, textOf, change, submit } = await import('./catalogue-admin-harness.mjs');
  const calls = [];
  let reply = null;
  const fetch = async (url, init) => { calls.push([url, JSON.parse(init.body)]); if (reply === 'throw') throw new Error('offline'); return reply; };
  const m = loadSource(read('src/fashion/FashionJewellery.jsx'), { ...hooks, fetch, Link: 'a', Icon: () => null, categoryHref: (c) => `/fashion/c/${c.slug}`,
    useFashionCatalogue: () => ({ tree: null, views: [], status: 'ready' }), departmentCatalogue: () => ({ category: null, categories: [], products: [] }), FashionProductCard: () => null, JEWELLERY: content });
  const run = async (email, r) => {
    reply = r;
    const tree = await mount(h(m.default));
    const input = findAll(tree.tree, (n) => n.type === 'input' && n.props.id === 'jw-news-email')[0];
    await tree.act(() => change(input, email));
    await tree.act(() => submit(findAll(tree.tree, (n) => n.type === 'form')[0]));
    return textOf(tree.tree);
  };
  const ok = { ok: true, json: async () => ({ subscribed: true }) };
  assert.match(await run('reader@example.com', ok), /You’re subscribed\./);
  assert.deepEqual(calls.at(-1), ['/api/newsletter/subscribe', { email: 'reader@example.com' }]);
  const refused = await run('reader@example.com', { ok: false, json: async () => ({ error: 'That address is already subscribed.' }) });
  assert.match(refused, /That address is already subscribed\./); assert.doesNotMatch(refused, /You’re subscribed/);
  const unconfirmed = await run('reader@example.com', { ok: true, json: async () => ({}) });
  assert.doesNotMatch(unconfirmed, /You’re subscribed/, 'a 200 without the write confirmed is not a subscription');
  assert.doesNotMatch(await run('reader@example.com', 'throw'), /You’re subscribed/);
  const before = calls.length;
  assert.match(await run('not-an-address', ok), /Please enter a valid email address\./);
  assert.equal(calls.length, before, 'an invalid address is never sent');
});

await test('the copy is true: none of the reference\'s claims ship — no threshold, no 30-day returns, no sourcing, certification or sustainability, no reviews or "trusted by", no Instagram, no AURELIA, no legacy or handcrafted, no "lasts forever", no offers — in the page\'s code and in its render', () => {
  const header = read('src/fashion/FashionLayout.jsx').match(/\/\/ The jewellery page:[\s\S]*?\n {2}\);/)?.[0] || '';
  const sources = ['src/fashion/FashionJewellery.jsx', 'src/fashion/jewelleryContent.js'].map((rel) => [rel, read(rel).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')]);
  const banned = [/over \$?\s?100|threshold|\$\s?\d/i, /30[- ]day/i, /ethical|conflict[- ]free|certif|sustainab/i, /loved by thousands|trusted by|\d+\s*k\+|testimonial|review(?!_count|Count)/i,
    /instagram|shining community/i, /aurelia/i, /legacy|handcraft|hand-craft/i, /free shipping|fast\s*&(amp;)?\s*reliable|express delivery/i, /lasts? forever/i, /exclusive offers?|\boffers?\b|% off|\bsale\b/i];
  for (const [name, s] of [...sources, ['header', header], ['render (no products)', text(empty)]]) {
    for (const re of banned) assert.doesNotMatch(s, re, `${name}: ${re}`);
  }
  for (const s of ['Free Standard Delivery', 'On every order', '7 days from delivery', 'Cash on Delivery', '9am–6pm IST', 'Our most loved pieces', 'Made to be worn every day']) assert.ok(text(page).includes(s), s);
});

// ---- the stylesheet -------------------------------------------------------------------
const SHEET = 'src/styles/fashion-departments.css';
const sheet = has(SHEET) ? read(SHEET) : '';
const jwAt = sheet.indexOf('/* The women\'s page\'s way into the jewellery store');
const jw = jwAt < 0 ? '' : sheet.slice(jwAt).replace(/\/\*[\s\S]*?\*\//g, '');
const rulesOf = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);

await test('scoped and appended: every new rule is .jw, .jw-header, .fs--jewellery or the women\'s .wm-jewellery panel; the sheet before them is exactly as it was', () => {
  assert.ok(jw, 'the jewellery block');
  const base = atCommit(BASELINE_SHA, SHEET).replace(/\r\n/g, '\n');
  assert.equal(sheet.slice(0, base.length), base, 'everything before the block is byte-identical');
  const rules = rulesOf(jw);
  assert.ok(rules.length >= 90, `the rules (${rules.length})`);
  for (const [sel] of rules) for (const part of sel.replace(/^@media[^{]*/, '').split(',').map((p) => p.trim()).filter(Boolean)) {
    assert.match(part, /^(\.jw[\s.:>-]|\.jw$|\.jw-|\.fs--jewellery|\.fs \.jw|\.wm-jewellery|\.wm \.wm-jewellery)/, `unscoped selector: ${part}`);
  }
});

await test('square edges, matching the women\'s page: the only rounding is the category circles, the story\'s arched frame and the header\'s count badge', () => {
  const rounded = rulesOf(jw).map(([sel, body]) => [sel, body.match(/border-radius:\s*([^;]+)/)?.[1].trim()]).filter(([, r]) => r && r !== '0').map(([sel, r]) => `${sel} → ${r}`);
  assert.deepEqual(rounded, ['.jw-header__actions span → 50%', '.jw-cat__art → 50%', '.jw-story__art → 999px 999px 0 0']);
  assert.match(jw, /\.fs \.jw \.jw-button \{[^}]*border-radius: 0;/); assert.match(jw, /\.jw-news__form input \{[^}]*border-radius: 0;/);
});

await test('contrast (WCAG 2.x), from the stylesheet: white on the gold buttons, the gold eyebrows on the ivory, the muted text on the ivory and on the sand, the header bar — each at least 4.5:1', () => {
  const token = (name) => { const m = jw.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`)); assert.ok(m, name); return m[1]; };
  const gold = token('--jw-gold'), ivory = token('--jw-ivory'), sand = token('--jw-sand'), ink = token('--jw-ink'), muted = token('--jw-muted');
  const pairs = [['white on the gold buttons', '#ffffff', gold], ['gold eyebrow on the ivory', gold, ivory], ['ink on the ivory', ink, ivory], ['muted text on the ivory', muted, ivory],
    ['muted text on the sand (trust strip, empty state)', muted, sand], ['header bar text', '#4a4036', '#efe6da']];
  for (const [what, fg, bg] of pairs) {
    const r = contrast(fg, bg);
    assert.ok(r >= 4.5, `${what}: ${r.toFixed(2)}:1`);
    console.log(`        ${what}: ${fg} on ${bg} = ${r.toFixed(2)}:1`);
  }
});

await test('the phone: the hero\'s photograph under a band of its own cream so the two-line headline and the button stay clear of her; the trust strip one row of four, two lines each; the circles one scrolling row with a half circle as the cue; two products a row; the banners stacked; no rule pairs aspect-ratio with a min/max height', () => {
  const at = jw.indexOf('@media (max-width: 700px) {\n  .jw-wrap');
  const phone = jw.slice(at, jw.indexOf('\n}\n', at));
  assert.ok(at > 0, 'the phone block');
  assert.match(phone, /\.jw-hero__art \{ position: relative; inset: auto; z-index: auto; height: auto; margin-top: 112px;/);
  assert.match(phone, /\.jw-hero__copy > h1, \.jw-hero__copy > \.jw-button \{ max-width: none; \}/);
  assert.match(jw, /\.jw-trust ul \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/); assert.match(phone, /\.jw-trust__full \{ display: none; \}/);
  assert.match(phone, /\.jw-trust strong, \.jw-trust small \{[^}]*white-space: nowrap;/);
  assert.match(phone, /\.jw-cats__row \{ display: flex;[^}]*overflow-x: auto;/); assert.match(phone, /\.jw-cats__row li \{ flex: 0 0 calc\(\(100% - 4 \* 12px\) \/ 4\.5\);/);
  assert.match(jw, /\.jw-cats__row \{ display: grid; grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/, 'seven in one row on a desktop');
  assert.match(phone, /\.jw-loved__grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(phone, /\.jw-edits \{ grid-template-columns: 1fr; \}/);
  for (const [sel, body] of rulesOf(jw)) assert.ok(!(/aspect-ratio:\s*(?!auto\b)[^;\s]/.test(body) && /(min|max)-height:\s*(?!0[;\s]|none\b)[^;\s]/.test(body)), `${sel}: aspect-ratio with a min/max height`);
});

// ---- the women's page and the shared files ----------------------------------------------
await test('linked from the women\'s page: its header and a panel after the saree store\'s open /fashion/jewellery', () => {
  const women = app.render('/fashion/women');
  assert.match(women, /<a href="\/fashion\/women\/sarees">Sarees<\/a><a href="\/fashion\/jewellery">Jewellery<\/a><a href="\/fashion\/men">Men<\/a><\/nav>/);
  assert.match(women, /<section class="wm-sarees wm-jewellery wm-wrap" aria-labelledby="wm-jewellery-title">[\s\S]*?<h2 id="wm-jewellery-title">Jewellery that tells your story<\/h2><p>Rings, necklaces, earrings and bracelets, in a store of their own\.<\/p><a class="wm-button" href="\/fashion\/jewellery">Visit the jewellery store <svg/);
  assert.ok(women.indexOf('wm-sarees-title') < women.indexOf('wm-jewellery-title'), 'after the saree store\'s');
});

await test('the shared files change exactly as scripts/pins/fashion-jewellery.patch records: undoing it gives each file as it was', () => {
  assert.ok(has('scripts/pins/fashion-jewellery.patch'), 'the recorded patch');
  const patch = read('scripts/pins/fashion-jewellery.patch');
  const files = {}; let rel = null; let hunk = null;
  const flush = () => { if (hunk && rel) (files[rel] ||= []).push([hunk.now.join('\n'), hunk.then.join('\n')]); hunk = null; };
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) { flush(); rel = null; continue; }
    if (line.startsWith('+++ ')) { rel = line.slice(4).replace(/^b\//, ''); continue; }
    if (line.startsWith('@@')) { flush(); hunk = { now: [], then: [] }; continue; }
    if (!hunk || line === '' || line.startsWith('\\')) continue;
    if (line[0] === ' ') { hunk.now.push(line.slice(1)); hunk.then.push(line.slice(1)); }
    else if (line[0] === '+') hunk.now.push(line.slice(1));
    else if (line[0] === '-') hunk.then.push(line.slice(1));
  }
  flush();
  assert.deepEqual(Object.keys(files).sort(), ['src/App.jsx', 'src/fashion/FashionDepartment.jsx', 'src/fashion/FashionLayout.jsx', 'src/fashion/departmentContent.js', 'src/styles/fashion-departments.css']);
  for (const [r, hunks] of Object.entries(files)) {
    let t = read(r);
    for (const [now, then] of hunks) { assert.equal(t.split(now).length - 1, 1, `${r}: a recorded hunk`); t = t.replace(now, then); }
    assert.equal(t, atCommit(BASELINE_SHA, r).replace(/\r\n/g, '\n'), `${r}: undone, as it was`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
