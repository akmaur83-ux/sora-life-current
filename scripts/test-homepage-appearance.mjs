// Offline: real JSX rendered in memory. No production/settings/storage writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import { applyPromotions, promosForPlacement, normalizePromo } from '../src/lib/promotions.js';
import { categories } from '../src/data/categories.js';
import * as appearance from '../src/lib/homepageAppearance.js';
import { selectCategoryCards } from '../src/lib/homeDiscovery.js';
import { applyHomepage, getHomepageSnapshot, subscribeHomepage } from '../src/lib/settings.js';
import { validateImageUpload } from '../src/lib/productMediaOperations.js';

let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
function component(file, name, deps = {}) {
  const { code } = transformSync(read(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExportNamedDeclaration(path) { path.replaceWith(path.node.declaration); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${code}; return ${name};`)(...Object.values(scope));
}
const h = React.createElement;
const Link = ({ to, children, ...props }) => h('a', { ...props, href: to }, children);
const Icon = () => h('span');
// Mirrors the real ticket's shape (visible code + a real copy button) so the
// tests below can see whether a coupon actually reached the customer.
const PromoCopyCode = ({ code, className = '' }) => (code
  ? h('span', { className: `promo-code ${className}` },
    h('code', { className: 'promo-code__value' }, code),
    h('button', { type: 'button', 'aria-label': `Copy coupon code ${code}` }, 'Copy'))
  : null);
const PromoArtwork = component('../src/components/promo/PromoArtwork.jsx', 'PromoArtwork', { Link, PromoCopyCode });
const PromoPoster = component('../src/components/promo/PromoPoster.jsx', 'PromoPoster', { Link, Icon, PromoCopyCode, PromoArtwork, offerCalloutFrom: () => null });
const PromoOfferCard = ({ promo }) => h('article', { className: 'promo-offer' }, promo.title);
const HomeVisualLayers = component('../src/components/HomeVisualLayers.jsx', 'HomeVisualLayers');
const HomeOffers = component('../src/components/promo/HomeOffers.jsx', 'HomeOffers', { ...appearance, promosForPlacement, HomeVisualLayers, PromoPoster, PromoOfferCard, PromoArtwork });
const CategoryRail = component('../src/components/CategoryRail.jsx', 'CategoryRail', { Link, categories });
// The strip now renders the large image-led category cards instead of the
// small circular marquee; the admin appearance wrapper it is tested for is
// unchanged.
const ProductImage = () => h('span');
const ShopByCategory = component('../src/components/HomeDiscoveryRails.jsx', 'ShopByCategory',
  { Link, Icon, ProductImage, selectCategoryCards, selectConcernCards: () => [] });
const HomeCategoryStrip = component('../src/components/HomeCategoryStrip.jsx', 'HomeCategoryStrip', { categories, ShopByCategory, HomeVisualLayers });
const defaults = appearance.sanitizeHomepageVisuals();
const promo = (id, extra = {}) => ({ id, title: `Promotion ${id}`, type: 'poster', placements: ['home'], is_active: true, sort_order: 0, image_url: `/public/${id}.png`, ...extra });
const offers = (rows, config = defaults.offers) => { applyPromotions(rows); return renderToStaticMarkup(h(HomeOffers, { appearance: config })); };
const ids = (html) => [...html.matchAll(/data-promotion-id="([^"]+)"/g)].map((m) => m[1]);
const strip = (config = defaults.categoryStrip) => renderToStaticMarkup(h(HomeCategoryStrip, { appearance: config }));

await check('two active Homepage posters both render', () => assert.deepEqual(ids(offers([promo('a'), promo('b')])), ['a', 'b']));
await check('three promotions are retained without a slice limit', () => assert.deepEqual(ids(offers([promo('a'), promo('b'), promo('c')])), ['a', 'b', 'c']));
await check('sort_order governs posters and offer cards together', () => assert.deepEqual(ids(offers([promo('a', { sort_order: 3 }), promo('b', { sort_order: 1, type: 'offer' }), promo('c', { sort_order: 2 })])), ['b', 'c', 'a']));
await check('inactive, future, expired and other placements stay hidden', () => {
  assert.deepEqual(ids(offers([promo('yes'), promo('inactive', { is_active: false }), promo('future', { starts_at: '2099-01-01' }), promo('expired', { ends_at: '2000-01-01' }), promo('cart', { placements: ['cart'] })])), ['yes']);
});
await check('duplicate promotion IDs render only once', () => assert.deepEqual(ids(offers([promo('a'), promo('a')])), ['a']));
await check('single promotion has one column and a centered single layout', () => {
  const html = offers([promo('a')]); assert.match(html, /--hp-offers-columns:1/); assert.match(html, /hp-offers__gallery--single/); assert.doesNotMatch(html, /hp-offers__pagination/);
});
await check('no active promotions means no frame, heading or blank slot', () => assert.equal(offers([]), ''));
await check('uploaded artwork carries no generated overlay copy', () => {
  // The uploaded creative owns its own typography: no scrim, no text body,
  // and no CTA wording painted over the picture. H3 restored the FUNCTION
  // (click target + coupon) without reinstating any of that overlay.
  const html = offers([promo('a', { subtitle: 'SubtitleOverArt', badge_text: 'BadgeOverArt', coupon_code: 'ARTCODE10', cta_text: 'ShopTheEdit', cta_url: '/shop' })]);
  assert.match(html, /src="\/public\/a.png"/);
  assert.doesNotMatch(html, /promo-poster__scrim|promo-poster__body/);
  assert.doesNotMatch(html, /SubtitleOverArt|BadgeOverArt/);
  // CTA wording is allowed ONLY as the link's accessible name, never as
  // visible text drawn on the artwork.
  assert.match(html, /aria-label="ShopTheEdit"/);
  assert.doesNotMatch(html, />[^<]*ShopTheEdit[^<]*</);
});
await check('no-image poster retains existing generated presentation', () => assert.match(offers([promo('a', { image_url: null })]), /promo-poster__body/));
await check('unsafe poster URL falls back to configured copy', () => assert.doesNotMatch(offers([promo('a', { image_url: 'javascript:alert(1)' })]), /javascript:/));
await check('maximum columns clamp to actual item count', () => assert.match(offers([promo('a'), promo('b')], { ...defaults.offers, desktopColumns: 3 }), /--hp-offers-columns:2/));
await check('mobile extra posters expose discoverable controls', () => assert.match(offers([promo('a'), promo('b')]), /Show promotion 2: Promotion b/));

const categoryLinks = (html) => [...html.matchAll(/href="(\/category\/[^\"]+)"/g)].map((m) => m[1]);
const originalLinks = categoryLinks(renderToStaticMarkup(h(CategoryRail)));
// The marquee duplicated each link; the card rail lists each category once,
// so reachability is now asserted as a set rather than a sequence.
await check('category strip still reaches every category CategoryRail did', () =>
  assert.deepEqual([...new Set(categoryLinks(strip()))].sort(), [...new Set(originalLinks)].sort()));
await check('every real category remains reachable', () => { const l = categoryLinks(strip()); for (const c of categories) assert.ok(l.includes(`/category/${c.slug}`)); });
await check('no configured category background works without an image layer', () => { const html = strip(); assert.match(html, /Shop by category/); assert.doesNotMatch(html, /hp-visual-layer--background/); });
await check('configured background retains all category links and image sources', () => {
  const html = strip({ ...defaults.categoryStrip, enabled: true, imageUrl: '/public/strip.png', imageSize: 'contain' });
  assert.match(html, /src="\/public\/strip.png"/); assert.match(html, /object-fit:contain/); assert.deepEqual([...new Set(categoryLinks(html))].sort(), [...new Set(originalLinks)].sort());
});
await check('disabling category background suppresses decoration layers', () => assert.doesNotMatch(strip({ ...defaults.categoryStrip, imageUrl: '/public/strip.png', leftImage: '/public/left.png' }), /hp-visual-layers/));
await check('fewer than three categories leave no empty section', () => {
  const C = component('../src/components/HomeCategoryStrip.jsx', 'HomeCategoryStrip', { categories: [], ShopByCategory, HomeVisualLayers });
  assert.equal(renderToStaticMarkup(h(C, { appearance: defaults.categoryStrip })), '');
});
await check('legacy settings without visuals receive complete safe defaults', () => assert.deepEqual(appearance.sanitizeHomepageVisuals({}), defaults));
await check('numeric editor defaults satisfy their min, max and step constraints', () => {
  for (const fields of Object.values(appearance.HOMEPAGE_VISUAL_FIELDS)) {
    for (const field of Object.values(fields).filter((f) => f.type === 'number')) {
      assert.ok(field.value >= field.min && field.value <= field.max, field.label);
      const steps = (field.value - field.min) / field.step;
      assert.ok(Math.abs(steps - Math.round(steps)) < 1e-9, field.label);
    }
  }
});
await check('saving visuals preserves legacy and unknown homepage fields', () => {
  const old = { story: { title: 'Existing story' }, editorials: [{ title: 'Existing editorial' }], bestseller_title: 'Existing', custom: 'keep' };
  const next = appearance.mergeHomepageVisuals(old, defaults); for (const key of Object.keys(old)) assert.deepEqual(next[key], old[key]);
});
await check('unknown style fields and injection values are discarded', () => {
  const clean = appearance.sanitizeHomepageVisuals({ offers: { css: 'position:fixed', borderColor: 'red;display:none', gap: Infinity, desktopColumns: '3', mobileWidth: 300 } });
  assert.equal(clean.offers.css, undefined); assert.equal(clean.offers.borderColor, '#702B3B'); assert.equal(clean.offers.gap, 16); assert.equal(clean.offers.desktopColumns, 2); assert.equal(clean.offers.mobileWidth, 92);
});
await check('visual URLs reject script, private hosts, credentials and backslashes', () => {
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,x', '//evil.com/x', '/\\evil.com/x', 'https://127.0.0.1/x', 'https://2130706433/x', 'https://[::1]/x', 'https://localhost/x', 'https://x.internal/x', 'https://user:pass@example.com/x', 'http://example.com/x', 'https://example.com/x.svg', '/public/test.html']) assert.equal(appearance.safeVisualUrl(url), '', url);
});
await check('public and same-origin raster image URLs are accepted', () => { for (const url of ['/public/real.png', 'https://example.com/real.webp']) assert.equal(appearance.safeVisualUrl(url), url); });
await check('saved settings notify the mounted Homepage immediately', () => {
  let calls = 0; const unsubscribe = subscribeHomepage(() => calls++); applyHomepage({ visuals: defaults }); unsubscribe(); assert.equal(calls, 1); assert.deepEqual(getHomepageSnapshot().visuals, defaults);
});

const validateImage = component('../src/lib/homepageImageUpload.js', 'validateHomepageImage', { validateImageUpload });
const fakeFile = (type, bytes, size = bytes.length) => ({ type, size, slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) });
await check('upload accepts matching PNG magic bytes', async () => assert.equal(await validateImage(fakeFile('image/png', [137,80,78,71,13,10,26,10,0,0,0,0])), 'png'));
await check('upload rejects fake MIME, SVG and oversized files', async () => {
  await assert.rejects(validateImage(fakeFile('image/png', [60,115,118,103])), /contents/);
  await assert.rejects(validateImage(fakeFile('image/svg+xml', [60,115,118,103])), /not allowed/);
  await assert.rejects(validateImage(fakeFile('image/png', [137,80,78,71,13,10,26,10], 7 * 1024 * 1024)), /6 MB/);
});
const css = read('../src/styles/homepage-appearance.css');
await check('posters fill card width while preserving their natural aspect ratio', () => {
  assert.match(css, /hp-offers__poster img[^}]*width:100%; height:auto;[^}]*object-fit:contain/s);
  for (const rule of css.matchAll(/\.hp-offers__(?:frame|gallery|item|poster)(?: img)?\s*\{([^}]+)\}/g)) {
    assert.doesNotMatch(rule[1], /(?:min-height|max-height|aspect-ratio)\s*:|(?:^|[;\s])height\s*:\s*(?!auto)[\d.]/);
  }
});
await check('offers frame and gallery reserve no padding below poster artwork', () => {
  for (const selector of ['frame', 'gallery']) {
    // The BASE rule — the unprefixed selector — defines the box, so that is
    // where padding:0 belongs. The `.v2-home `-prefixed rules are the mobile
    // full-bleed overrides added in 58f9587; they only adjust width/margin
    // and correctly leave padding inherited, so demanding padding:0 inside
    // them was asserting against the wrong rules.
    const base = [...css.matchAll(
      new RegExp('(?:^|[{};]|\\*/)\\s*\\.hp-offers__' + selector + '\\s*\\{([^}]+)\\}', 'gm')
    )];
    assert.ok(base.length > 0, `no base .hp-offers__${selector} rule found`);
    for (const [, rule] of base) assert.match(rule, /(?:^|[;\s])padding:0;/);

    // And no rule anywhere may reintroduce padding on these boxes.
    for (const [, rule] of css.matchAll(
      new RegExp('\\.hp-offers__' + selector + '[^{}]*\\{([^}]+)\\}', 'g')
    )) {
      assert.doesNotMatch(rule, /(?:^|[;\s])padding(?:-block|-inline|-top|-bottom)?\s*:\s*(?!0)/);
    }
  }
  assert.match(css, /\.hp-offers__frame[^}]*max-width:calc\(var\(--hp-offers-columns\) \* 620px\)/);
});
await check('carousel navigation overlays artwork without reserving a row or blocking swipes', () => {
  assert.match(css, /\.hp-offers__pagination\s*\{[^}]*position:absolute;[^}]*bottom:6px;[^}]*margin:0;[^}]*pointer-events:none/);
  assert.match(css, /\.hp-offers__pagination button\s*\{[^}]*pointer-events:auto/);
});
await check('mobile is snap-scrolling; tablet/desktop have true equal columns', () => { assert.match(css, /scroll-snap-type:x mandatory/); assert.match(css, /repeat\(var\(--hp-offers-columns\), minmax\(0, 1fr\)\)/); });
await check('decorations cannot intercept category or promotion interaction', () => assert.match(css, /\.hp-visual-layer[^}]*pointer-events:none/));
await check('Homepage save merges existing settings and broadcasts only after save', () => {
  const source = read('../src/admin/pages/Homepage.jsx'); assert.match(source, /mergeHomepageVisuals\(\{ \.\.\.currentHomepage/); assert.match(source, /await adminSetSetting\('homepage', next\);[\s\S]*announceHomepageSaved\(next\)/);
});
// Drive the real editor callbacks with deferred uploads and React-style state
// updates. No storage request or settings save is made by this harness.
function editorHarness() {
  let state = appearance.sanitizeHomepageVisuals();
  let uploads = 0;
  const pending = [];
  const Controls = component('../src/admin/components/HomepageVisualControls.jsx', 'HomepageVisualControls', {
    ...appearance,
    useState: (initial) => [initial, () => {}],
    uploadHomepageImage: () => new Promise((resolve) => pending.push(resolve)),
  });
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const match = find(child, predicate);
      if (match) return match;
    }
  }
  const tree = () => Controls({ value: state,
    onChange: (next) => { state = typeof next === 'function' ? next(state) : next; },
    onUploading: (delta) => { uploads += delta; },
  });
  return {
    get state() { return state; },
    get uploads() { return uploads; },
    pending,
    edit(id, value) {
      find(tree(), (node) => node.props?.id === id).props.onChange({ target: { value } });
    },
    startUpload(id) {
      const image = find(tree(), (node) => node.props?.id === id);
      const input = find(image.type(image.props), (node) => node.type === 'input' && node.props.type === 'file');
      return input.props.onChange({ target: { files: [{}], value: 'test-image' } });
    },
  };
}
await check('upload completion preserves newer edits in the same and other appearance groups', async () => {
  const editor = editorHarness();
  const upload = editor.startUpload('homepage-categoryStrip-imageUrl');
  editor.edit('homepage-offers-gap', '24');
  editor.edit('homepage-categoryStrip-paddingTop', '20');
  const expected = { ...editor.state, categoryStrip: { ...editor.state.categoryStrip, imageUrl: '/public/upload.png' } };
  assert.equal(editor.uploads, 1);
  editor.pending[0]('/public/upload.png');
  await upload;
  assert.equal(editor.state.offers.gap, 24);
  assert.deepEqual(editor.state, expected);
  assert.equal(editor.uploads, 0);
});
await check('concurrent uploads completing out of order retain both images and newer settings', async () => {
  const editor = editorHarness();
  const first = editor.startUpload('homepage-categoryStrip-leftImage');
  const second = editor.startUpload('homepage-offers-textureUrl');
  editor.edit('homepage-offers-gap', '24');
  editor.edit('homepage-categoryStrip-paddingBottom', '18');
  const expected = { ...editor.state,
    categoryStrip: { ...editor.state.categoryStrip, leftImage: '/public/left.png' },
    offers: { ...editor.state.offers, textureUrl: '/public/texture.png' },
  };
  assert.equal(editor.uploads, 2);
  editor.pending[1]('/public/texture.png');
  await second;
  assert.equal(editor.uploads, 1);
  editor.pending[0]('/public/left.png');
  await first;
  assert.deepEqual(editor.state, expected);
  assert.equal(editor.uploads, 0);
});
// ============================================================
// H3 — uploaded artwork must carry its configured CTA and coupon.
//
// Before: an image promotion rendered as a bare <img>; ctaUrl and couponCode
// configured in /admin/promotions were silently discarded, so the artwork was
// unclickable and a published code was unreachable.
//
// The image-first look is unchanged. What is restored is the FUNCTION:
// the picture becomes the click target, and the code ticket sits below it.
// ============================================================
const poster = (extra = {}) => renderToStaticMarkup(
  h(PromoPoster, { promo: normalizePromo({ id: 'p', title: 'Festive Edit', type: 'poster', image_url: '/public/art.png', ...extra }) }),
);
// The coupon's copy control must never sit INSIDE the artwork link.
const noNestedInteractive = (html) => !/<a\s[^>]*>(?:(?!<\/a>)[\s\S])*?<button/i.test(html);

await check('H3.1 image + internal CTA renders a router link to that path', () => {
  const html = poster({ cta_url: '/shop', cta_text: 'Shop the edit' });
  assert.match(html, /<a[^>]+class="promo-artwork__link"[^>]+href="\/shop"/);
  assert.match(html, /<a\s[^>]*>\s*<img[^>]+src="\/public\/art\.png"/);
  assert.doesNotMatch(html, /target="_blank"/, 'internal route must not open a new tab');
});

await check('H3.2 image + external https CTA renders a safe new-tab anchor', () => {
  const html = poster({ cta_url: 'https://sora-life.example/lookbook', cta_text: 'View lookbook' });
  assert.match(html, /href="https:\/\/sora-life\.example\/lookbook"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

await check('H3.3 image + coupon renders the copy ticket below the artwork', () => {
  const html = poster({ coupon_code: 'FESTIVE20' });
  assert.match(html, /FESTIVE20/, 'code is visible to the customer');
  assert.match(html, /Copy coupon code FESTIVE20/, 'copy control is rendered');
  assert.match(html, /promo-artwork--has-code/, 'container switches to the stacked layout');
  assert.match(html, /<img[\s\S]*promo-code/, 'ticket follows the artwork rather than covering it');
});

await check('H3.4 image + CTA + coupon deliver both, with no nested interactives', () => {
  const html = poster({ cta_url: '/shop', cta_text: 'Shop the edit', coupon_code: 'FESTIVE20' });
  assert.match(html, /class="promo-artwork__link"[^>]+href="\/shop"/);
  assert.match(html, /FESTIVE20/);
  assert.equal(noNestedInteractive(html), true, 'copy button must be a sibling of the link, never inside it');
});

await check('H3.5 image without a CTA stays non-clickable', () => {
  const html = poster({ coupon_code: 'FESTIVE20' });
  assert.doesNotMatch(html, /promo-artwork__link/);
  assert.doesNotMatch(html, /<a\s[^>]*>\s*<img/);
});

await check('H3.6 unsafe CTA values never produce a link', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>x</script>', '//evil.example', 'http://insecure.example', 'not a url']) {
    const html = poster({ cta_url: bad, cta_text: 'Go' });
    assert.doesNotMatch(html, /promo-artwork__link/, `${bad} must not become a link`);
    assert.doesNotMatch(html, /javascript:|data:text|evil\.example|insecure\.example/, `${bad} must not reach the DOM`);
  }
});

await check('H3.7 rejected artwork still falls back to the configured poster', () => {
  const html = offers([promo('a', { image_url: 'javascript:alert(1)', subtitle: 'Real copy', coupon_code: 'FALLBACK5', cta_url: '/shop', cta_text: 'Shop now' })]);
  assert.match(html, /promo-poster__body/, 'text poster fallback is used');
  assert.match(html, /Real copy/);
  assert.match(html, /FALLBACK5/, 'coupon still reaches the customer on the fallback');
  assert.doesNotMatch(html, /javascript:/);
});

await check('H3.8 the homepage rail honours the same CTA and coupon contract', () => {
  const html = offers([promo('a', { cta_url: '/shop', cta_text: 'Shop the edit', coupon_code: 'RAIL15' })]);
  assert.match(html, /class="promo-artwork__link"[^>]+href="\/shop"/);
  assert.match(html, /RAIL15/);
  assert.match(html, /hp-offers__poster/, 'rail keeps its own layout class');
  assert.equal(noNestedInteractive(html), true);
});

await check('H3.9 text posters (no artwork) keep their existing presentation', () => {
  const html = poster({ image_url: null, subtitle: 'Everyday care', badge_text: 'Limited time', cta_url: '/shop', cta_text: 'Shop now', coupon_code: 'TEXT10' });
  assert.match(html, /promo-poster__body/);
  assert.match(html, /Festive Edit/);
  assert.match(html, /Everyday care/);
  assert.match(html, /promo-poster__cta/, 'the classic visible CTA button is unchanged');
  assert.doesNotMatch(html, /promo-artwork__link/, 'text posters do not use the artwork link');
});

await check('H3.10 clickable artwork has a meaningful accessible name', () => {
  assert.match(poster({ cta_url: '/shop', cta_text: 'Shop the edit' }), /aria-label="Shop the edit"/);
  // Falls back to the title when the admin left CTA text empty.
  assert.match(poster({ cta_url: '/shop' }), /aria-label="Festive Edit"/);
  // Never an empty accessible name.
  assert.doesNotMatch(poster({ cta_url: '/shop', cta_text: '' }), /aria-label=""/);
});

console.log(`\n${passed} passed, 0 failed`);
