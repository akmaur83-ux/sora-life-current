// Offline: real JSX rendered in memory. No production/settings/storage writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import { applyPromotions, promosForPlacement } from '../src/lib/promotions.js';
import { categories } from '../src/data/categories.js';
import * as appearance from '../src/lib/homepageAppearance.js';
import { applyHomepage, getHomepageSnapshot, subscribeHomepage } from '../src/lib/settings.js';

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
const PromoPoster = component('../src/components/promo/PromoPoster.jsx', 'PromoPoster', { Link, Icon, PromoCopyCode: () => null, offerCalloutFrom: () => null });
const PromoOfferCard = ({ promo }) => h('article', { className: 'promo-offer' }, promo.title);
const HomeVisualLayers = component('../src/components/HomeVisualLayers.jsx', 'HomeVisualLayers');
const HomeOffers = component('../src/components/promo/HomeOffers.jsx', 'HomeOffers', { ...appearance, promosForPlacement, HomeVisualLayers, PromoPoster, PromoOfferCard });
const CategoryRail = component('../src/components/CategoryRail.jsx', 'CategoryRail', { Link, categories });
const HomeCategoryStrip = component('../src/components/HomeCategoryStrip.jsx', 'HomeCategoryStrip', { categories, CategoryRail, HomeVisualLayers });
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
await check('uploaded artwork has no generated overlay, coupon or CTA', () => {
  const html = offers([promo('a', { subtitle: 'Not over artwork', coupon_code: 'NOTOVERART', cta_text: 'Not over artwork', cta_url: '/shop' })]);
  assert.match(html, /src="\/public\/a.png"/); assert.doesNotMatch(html, /promo-poster__scrim|promo-poster__body|NOTOVERART|Not over artwork/);
});
await check('no-image poster retains existing generated presentation', () => assert.match(offers([promo('a', { image_url: null })]), /promo-poster__body/));
await check('unsafe poster URL falls back to configured copy', () => assert.doesNotMatch(offers([promo('a', { image_url: 'javascript:alert(1)' })]), /javascript:/));
await check('maximum columns clamp to actual item count', () => assert.match(offers([promo('a'), promo('b')], { ...defaults.offers, desktopColumns: 3 }), /--hp-offers-columns:2/));
await check('mobile extra posters expose discoverable controls', () => assert.match(offers([promo('a'), promo('b')]), /Show promotion 2: Promotion b/));

const categoryLinks = (html) => [...html.matchAll(/href="(\/category\/[^\"]+)"/g)].map((m) => m[1]);
const originalLinks = categoryLinks(renderToStaticMarkup(h(CategoryRail)));
await check('category strip keeps every existing link, including marquee copies', () => assert.deepEqual(categoryLinks(strip()), originalLinks));
await check('every real category remains reachable', () => { for (const c of categories) assert.ok(originalLinks.includes(`/category/${c.slug}`)); });
await check('no configured category background works without an image layer', () => { const html = strip(); assert.match(html, /Shop by category/); assert.doesNotMatch(html, /hp-visual-layer--background/); });
await check('configured background retains all category links and image sources', () => {
  const html = strip({ ...defaults.categoryStrip, enabled: true, imageUrl: '/public/strip.png', imageSize: 'contain' });
  assert.match(html, /src="\/public\/strip.png"/); assert.match(html, /object-fit:contain/); assert.deepEqual(categoryLinks(html), originalLinks);
});
await check('disabling category background suppresses decoration layers', () => assert.doesNotMatch(strip({ ...defaults.categoryStrip, imageUrl: '/public/strip.png', leftImage: '/public/left.png' }), /hp-visual-layers/));
await check('fewer than three categories leave no empty section', () => {
  const C = component('../src/components/HomeCategoryStrip.jsx', 'HomeCategoryStrip', { categories: [], CategoryRail, HomeVisualLayers });
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

const validateImage = component('../src/lib/homepageImageUpload.js', 'validateHomepageImage', {});
const fakeFile = (type, bytes, size = bytes.length) => ({ type, size, slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) });
await check('upload accepts matching PNG magic bytes', async () => assert.equal(await validateImage(fakeFile('image/png', [137,80,78,71,13,10,26,10])), 'png'));
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
console.log(`\n${passed} passed, 0 failed`);
