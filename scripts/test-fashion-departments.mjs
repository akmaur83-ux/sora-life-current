// Offline regression: real routes/cards, department isolation and banner entry.
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
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

const womenCategory = INITIAL.categories.find((c) => c.slug === 'women');
const womenProduct = INITIAL.products.find((p) => p.category_id === womenCategory.id);

test('the department routes render distinct reference-led pages and real cards', () => {
  const men = app.render('/fashion/men');
  const women = app.render('/fashion/women');
  const sarees = app.render('/fashion/women/sarees');
  assert.match(men, /Summer<\/span><span>Essentials/);
  assert.match(men, /Shop the look/);
  // The saree store moved to /fashion/women/sarees as it was.
  assert.match(sarees, /Beautiful Sarees/);
  assert.match(sarees, /for Every Story/);
  assert.match(sarees, /Traditional Handloom Sarees/);
  assert.match(sarees, /Banarasi Sarees/);
  assert.doesNotMatch(sarees, /fd-story|fd-looks|Woven with tradition|Styled for today/);
  // /fashion/women is the main women's page now.
  assert.match(women, /<h1 id="wm-title"><span>Style\.<\/span><span>Confidence\.<\/span><span>You\.<\/span><\/h1>/);
  assert.match(women, /Shop by category/);
  assert.match(women, /The capsule edit/);
  assert.doesNotMatch(women, /Beautiful Sarees|sw-hero/);
  assert.match(men, /fs--department/);
  assert.match(men, /data-product="meadow-linen-shirt-sage"/);
  for (const page of [women, sarees]) {
    assert.doesNotMatch(page, /data-product="meadow-linen-shirt-sage"/);
    assert.ok(page.includes(`data-product="${womenProduct.slug}"`));
  }
  assert.ok(!men.includes(`data-product="${womenProduct.slug}"`));
  assert.match(men, /data-quick="sheet"/);
  assert.match(men, /href="\/fashion\/p\/meadow-linen-shirt-sage"/);
  assert.match(men, /Save Meadow Linen Shirt/);
  assert.doesNotMatch(men + women + sarees, /50% OFF|WELCOME10|Free shipping worldwide|30 Days Return/i);
});

test('missing/empty departments never borrow another category catalogue', () => {
  for (const path of ['/fashion/women', '/fashion/women/sarees']) {
    const empty = app.render(path, { categories: INITIAL.categories, products: [] });
    assert.match(empty, /A new chapter in style/);
  }
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
  for (const path of ['men', 'women', 'women/sarees', 'c/:slug', 'p/:slug', 'wishlist', 'search']) assert.ok(router.includes(`path="${path}"`));
});

test('supplied artwork has working local files and mobile art direction without replacing inventory images', () => {
  for (const [path, hero] of [['/fashion/men', 'men-hero'], ['/fashion/women', 'women-main-hero'], ['/fashion/women/sarees', 'women-hero']]) {
    const html = app.render(path);
    assert.ok(html.includes(`/img/fashion-editorial/${hero}-desktop.webp`), `${path}: ${hero}-desktop`);
    assert.ok(html.includes(`<source media="(max-width: 700px)" srcSet="/img/fashion-editorial/${hero}-mobile.webp"`), `${path}: ${hero}-mobile`);
    for (const match of html.matchAll(/\/img\/fashion-editorial\/[a-z0-9-]+\.webp/g)) assert.ok(existsSync(resolve(`.${match[0]}`)), `Missing artwork: ${match[0]}`);
  }
  for (const path of ['/fashion/women', '/fashion/women/sarees']) {
    const html = app.render(path);
    assert.match(html, /src="\/img\/demo-kurta-set.webp"/); // Real fixture product image stays real.
    assert.match(html, /aria-label="Search fashion"/);
    assert.match(html, /href="\/fashion\/wishlist"/);
    assert.doesNotMatch(html, /WELCOME10|Get 10% Off|Rs\. 8,500/);
  }
  assert.match(app.render('/fashion/women/sarees'), /aria-label="Next collection image"/);
});

test('each page has its own header and shell; the saree store keeps its own, at its new address', () => {
  const women = app.render('/fashion/women');
  const sarees = app.render('/fashion/women/sarees');
  assert.match(women, /class="fs fs--department fs--women"/);
  assert.match(sarees, /class="fs fs--department fs--saree"/);
  assert.match(women, /<header class="wm-header">/);
  assert.doesNotMatch(women, /sw-header|fs-hdr|fs-strip/); // no delivery strip (and its speed claim) over this page
  assert.match(sarees, /<header class="sw-header">/);
  assert.match(sarees, /<a href="\/fashion\/women\/sarees">Home<\/a>/);
  assert.doesNotMatch(sarees, /wm-header|fs--women/);
  for (const path of ['/fashion', '/fashion/men', '/fashion/c/women']) assert.doesNotMatch(app.render(path), /wm-header|sw-header|fs--women|fs--saree/, path);
});

test('the women page: true copy only, the way into the sarees, and the four capsule tiles', () => {
  const content = loadModule('src/fashion/departmentContent.js').DEPARTMENT_CONTENT;
  const women = app.render('/fashion/women');
  // Words outside the product cards (whose prices and badges are the catalogue's own).
  const words = women.replace(/<section class="wm-products[\s\S]*?<\/section>/, '');
  assert.doesNotMatch(words, /%\s*off|sale|discount|ethical|conflict[- ]free|certified|sustainab|trusted by|free shipping|30[- ]day|fast|quick|express|same[- ]day|guarantee/i);
  assert.match(women, /Standard delivery<\/strong><small>6–7 business days<\/small>/);
  assert.match(women, /Returns<\/strong><small>Within 7 days of delivery<\/small>/);
  assert.match(women, /<a class="wm-button" href="\/fashion\/women\/sarees">Visit the saree store/);
  // The capsule: all four tiles, each with its own artwork.
  assert.deepEqual(content.women.capsule.map((item) => item.image.src), ['shirts', 'denim', 'jackets', 'dresses'].map((name) => `/img/fashion-editorial/women-capsule-${name}.webp`));
  for (const item of content.women.capsule) assert.ok(women.includes(`src="${item.image.src}"`), `${item.title} is on the page`);
  assert.equal((women.match(/class="wm-look"/g) || []).length, 4);
  // Bags sit under Bags & Accessories; a slug Women does not have yet opens the Women listing.
  assert.match(women, /<a class="wm-category" href="\/fashion\/c\/bags-accessories">/);
  assert.match(women, /<a class="wm-category" href="\/fashion\/c\/women">.*?<span>Dresses<\/span>/);
  // The design references' brand names appear nowhere in the page's own code, styles or artwork.
  const own = ['src/fashion/FashionDepartment.jsx', 'src/fashion/departmentContent.js', 'src/fashion/FashionLayout.jsx', 'src/styles/fashion-departments.css'].map(read).join('\n');
  assert.doesNotMatch(own + readdirSync('img/fashion-editorial').join('\n'), /aeris|aurelia/i);
});

test('the women page row: new arrivals when any are flagged, a filter per Women sub-category on the shelf', () => {
  const sub = (id, slug, name) => ({ id, parent_id: womenCategory.id, name, slug, tagline: '', image_url: null, sort_order: 1, is_active: true });
  const product = (n, category_id, isNew) => ({ ...womenProduct, id: `00000000-0000-4000-8000-00000000090${n}`, slug: `women-piece-${n}`, name: `Women piece ${n}`, category_id, is_new: isNew });
  const categories = [...INITIAL.categories, sub('w-dresses', 'dresses', 'Dresses'), sub('w-knit', 'knitwear', 'Knitwear')];
  const fresh = app.render('/fashion/women', { categories, products: [product(1, 'w-dresses', true), product(2, 'w-knit', true), product(3, 'w-knit', false)] });
  assert.match(fresh, /<h2 id="wm-products-title">New in<\/h2>/);
  assert.match(fresh, /data-product="women-piece-1"/);
  assert.match(fresh, /data-product="women-piece-2"/);
  assert.doesNotMatch(fresh, /data-product="women-piece-3"/); // not flagged new
  assert.match(fresh, /role="group" aria-label="Show a category"><button type="button" aria-pressed="true">All<\/button><button type="button" aria-pressed="false">Dresses<\/button><button type="button" aria-pressed="false">Knitwear<\/button>/);
  assert.match(fresh, /<a class="wm-category" href="\/fashion\/c\/dresses">/);
  const none = app.render('/fashion/women', { categories, products: [product(3, 'w-knit', false)] });
  assert.match(none, /<h2 id="wm-products-title">From the collection<\/h2>/);
  assert.match(none, /data-product="women-piece-3"/);
  assert.doesNotMatch(none, /Show a category/); // one sub-category on the shelf: nothing to choose between
});

console.log(`\n${passed} fashion department tests passed.`);
