// Offline regression: real routes/cards, department isolation and banner entry.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, useLocation } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { buildFashionApp, loadModule, INITIAL, read } from './fashion-ssr.mjs';

const app = await buildFashionApp();
const Icon = loadModule('src/components/Icon.jsx').default;
const entry = loadModule('src/components/FashionEntryLink.jsx', { Link, useLocation, Icon });
const render = (element) => renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' }, element));
const h = React.createElement;
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }

test('both department routes render distinct reference-led pages and real cards', () => {
  const men = app.render('/fashion/men');
  const women = app.render('/fashion/women');
  assert.match(men, /Summer<\/span><span>Essentials/);
  assert.match(men, /Shop the look/);
  assert.match(women, /Beautiful Sarees/);
  assert.match(women, /for Every Story/);
  assert.match(women, /Traditional Handloom Sarees/);
  assert.match(women, /Banarasi Sarees/);
  assert.doesNotMatch(women, /fd-story|fd-looks|Woven with tradition|Styled for today/);
  assert.match(men, /fs--department/);
  assert.match(men, /data-product="meadow-linen-shirt-sage"/);
  assert.doesNotMatch(women, /data-product="meadow-linen-shirt-sage"/);
  const womenCategory = INITIAL.categories.find((c) => c.slug === 'women');
  const womenProduct = INITIAL.products.find((p) => p.category_id === womenCategory.id);
  assert.ok(women.includes(`data-product="${womenProduct.slug}"`));
  assert.ok(!men.includes(`data-product="${womenProduct.slug}"`));
  assert.match(men, /data-quick="sheet"/);
  assert.match(men, /href="\/fashion\/p\/meadow-linen-shirt-sage"/);
  assert.match(men, /Save Meadow Linen Shirt/);
  assert.doesNotMatch(men + women, /50% OFF|WELCOME10|Free shipping worldwide|30 Days Return/i);
});

test('missing/empty departments never borrow another category catalogue', () => {
  const empty = app.render('/fashion/women', { categories: INITIAL.categories, products: [] });
  assert.match(empty, /A new chapter in style/);
  const missing = app.render('/fashion/men', { ...INITIAL, categories: INITIAL.categories.filter((c) => c.slug !== 'men') });
  assert.doesNotMatch(missing, /data-product=/);
  assert.match(missing, /href="\/fashion\/men#fd-products"/);
});

test('inactive branches and products outside the chosen category are excluded', () => {
  const tree = app.rules.buildTree([
    { id: 'm', slug: 'men', is_active: true },
    { id: 's', slug: 'shirts', parent_id: 'm', is_active: true },
    { id: 'off', slug: 'off', parent_id: 'm', is_active: false },
    { id: 'nested', slug: 'nested', parent_id: 'off', is_active: true },
    { id: 'w', slug: 'women', is_active: true },
  ]);
  const views = ['m', 's', 'off', 'nested', 'w'].map((id) => ({ id, category_id: id, sortOrder: 0, name: id }));
  assert.deepEqual(app.modules.department.departmentCatalogue(tree, views, 'men').products.map((p) => p.id).sort(), ['m', 's']);
  assert.equal(app.modules.department.departmentCatalogue(tree, views, 'missing').products.length, 0);
});

test('default entry advertises a dialog; custom admin links remain links', () => {
  const standard = render(h(entry.default, { to: '/fashion' }, 'Explore fashion'));
  const custom = render(h(entry.default, { to: '/fashion/c/clothing' }, 'Explore clothing'));
  assert.match(standard, /aria-haspopup="dialog"/);
  assert.match(standard, /href="\/fashion"/);
  assert.doesNotMatch(custom, /aria-haspopup/);
  assert.match(custom, /href="\/fashion\/c\/clothing"/);
  const chooser = render(h(entry.FashionChooser, { onClose() {} }));
  assert.match(chooser, /<dialog/);
  assert.match(chooser, /href="\/fashion\/men"/);
  assert.match(chooser, /href="\/fashion\/women"/);
  assert.match(chooser, /aria-disabled="true"/);
  assert.match(chooser, /Coming soon/);
  assert.doesNotMatch(chooser, /href="\/fashion\/kids"/);
});

test('existing category/PDP routes are preserved alongside the new pages', () => {
  assert.doesNotMatch(app.render('/fashion/c/men'), /fs--department/);
  assert.doesNotMatch(app.render('/fashion/p/meadow-linen-shirt-sage'), /fs--department/);
  const router = read('src/App.jsx');
  for (const path of ['men', 'women', 'c/:slug', 'p/:slug', 'wishlist', 'search']) assert.ok(router.includes(`path="${path}"`));
});

test('supplied artwork has working local files and mobile art direction without replacing inventory images', () => {
  for (const department of ['men', 'women']) {
    const html = app.render(`/fashion/${department}`);
    assert.ok(html.includes(`/img/fashion-editorial/${department}-hero-desktop.webp`));
    assert.ok(html.includes(`<source media="(max-width: 700px)" srcSet="/img/fashion-editorial/${department}-hero-mobile.webp"`));
    for (const match of html.matchAll(/\/img\/fashion-editorial\/[a-z0-9-]+\.webp/g)) assert.ok(existsSync(resolve(`.${match[0]}`)), `Missing artwork: ${match[0]}`);
  }
  const women = app.render('/fashion/women');
  assert.match(women, /src="\/img\/demo-kurta-set.webp"/); // Real fixture product image stays real.
  assert.match(women, /aria-label="Next collection image"/);
  assert.match(women, /aria-label="Search fashion"/);
  assert.match(women, /href="\/fashion\/wishlist"/);
  assert.doesNotMatch(women, /WELCOME10|Get 10% Off|Rs\. 8,500/);
});

console.log(`\n${passed} fashion department tests passed.`);
