// ============================================================
// Fashion store, Phase 1 — offline suite.
//
// The category rules (three levels, depth and cycles refused), the migration
// (tables, policies, the guard, demo rows, no real brand), per-combination
// stock, URL-backed filters and back-navigation, the omit-when-absent rule,
// the real pages rendered through the real router, the shared cart badge,
// and the wellness homepage's composition before and after.
// NO NETWORK, NO DATABASE.
//
//   node scripts/test-fashion.mjs
//   FASHION_SRC_ROOT=<pre-change checkout> node scripts/test-fashion.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import { Link } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, buildFashionApp, loadModule, CATEGORIES, PRODUCTS, INITIAL } from './fashion-ssr.mjs';

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log(`\nsource root: ${ROOT}`);

// Real companies that must not appear anywhere in the seed or the fixtures.
const REAL_BRANDS = ['allen solly', 'biba', 'lakme', 'lakmé', 'puma', 'titan', 'caprese', 'nike', 'adidas', 'zara', 'h&m', "levi's", 'levis', 'reebok', 'bata', 'fabindia', 'w for woman', 'max fashion', 'peter england', 'van heusen', 'nykaa', 'myntra', 'amazon', 'flipkart', 'safari', 'ajmal', 'spaces', 'home centre'];
const mentionsRealBrand = (s) => REAL_BRANDS.filter((b) => new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s));

let rules = null;
try { rules = await import(pathToFileURL(resolve(ROOT, 'src/lib/fashion.js')).href); } catch { rules = null; }

// ============================================================
console.log('\n— Category tree —');
// ============================================================

await test('the tree resolves at all three levels, with breadcrumbs and scope', () => {
  assert.ok(rules, 'src/lib/fashion.js exists');
  const t = rules.buildTree(CATEGORIES);
  assert.deepEqual(t.roots.map((r) => r.slug), ['clothing', 'beauty', 'footwear', 'bags-accessories']);
  const clothing = rules.resolveCategory(t, 'clothing'); const men = rules.resolveCategory(t, 'men'); const shirts = rules.resolveCategory(t, 'mens-shirts');
  assert.equal(t.depth(clothing.id), 1); assert.equal(t.depth(men.id), 2); assert.equal(t.depth(shirts.id), 3);
  assert.deepEqual(t.children(clothing.id).map((c) => c.slug), ['men', 'women', 'kids']);
  assert.deepEqual(t.children(men.id).map((c) => c.slug), ['mens-shirts', 'mens-t-shirts', 'mens-trousers']);
  assert.deepEqual(rules.breadcrumbFor(t, shirts).map((c) => c.name), ['Fashion', 'Clothing', 'Men', 'Shirts']);
  assert.deepEqual(rules.breadcrumbFor(t, shirts).map((c) => c.href), ['/fashion', '/fashion/c/clothing', '/fashion/c/men', '/fashion/c/mens-shirts']);
  assert.equal(rules.categoryScope(t, clothing).size, 7, 'clothing covers itself, three children and three grandchildren');
  assert.equal(rules.categoryScope(t, shirts).size, 1);
  assert.equal(rules.resolveCategory(t, 'nope'), null);
  assert.equal(rules.resolveCategory(t, 'CLOTHING').slug, 'clothing', 'case-insensitive');
});

await test('depth beyond 3 and cycles are rejected — in the rules and in the SQL guard', () => {
  assert.ok(rules);
  const shirts = CATEGORIES.find((c) => c.slug === 'mens-shirts'); const men = CATEGORIES.find((c) => c.slug === 'men'); const clothing = CATEGORIES.find((c) => c.slug === 'clothing');
  assert.equal(rules.validatePlacement(CATEGORIES, { parentId: shirts.id }).reason, 'depth', 'a fourth level under Shirts');
  assert.equal(rules.validatePlacement(CATEGORIES, { parentId: men.id }).ok, true, 'a third level under Men is fine');
  assert.equal(rules.validatePlacement(CATEGORIES, { id: clothing.id, parentId: shirts.id }).reason, 'cycle', 'Clothing under its own grandchild');
  assert.equal(rules.validatePlacement(CATEGORIES, { id: men.id, parentId: men.id }).reason, 'cycle', 'self-parent');
  const beauty = CATEGORIES.find((c) => c.slug === 'beauty');
  assert.equal(rules.validatePlacement(CATEGORIES, { id: clothing.id, parentId: beauty.id }).reason, 'depth', 'moving Clothing (two levels below it) under Beauty makes level 4');
  assert.equal(rules.validatePlacement(CATEGORIES, { id: men.id, parentId: beauty.id }).ok, true, 'moving Men (one level below it) under Beauty stays at 3');
  const loop = [{ id: 'a', parent_id: 'b', name: 'A', slug: 'a' }, { id: 'b', parent_id: 'a', name: 'B', slug: 'b' }];
  assert.equal(rules.validatePlacement(loop, { id: 'c', parentId: 'a' }).reason, 'cycle', 'a corrupt loop cannot hang the walk');
  assert.equal(rules.buildTree(loop).ancestors('a').length, 2, 'ancestors stop on a cycle');
  const sql = read('supabase/migrations/0033_fashion_store.sql');
  assert.match(sql, /create or replace function public\.fashion_categories_guard\(\)/);
  assert.match(sql, /cannot be its own ancestor/); assert.match(sql, /if v_steps > 3 then/);
  assert.match(sql, /if v_depth \+ v_height > 3 then/, 'moving a branch counts its subtree');
  assert.match(sql, /before insert or update of parent_id, id on public\.fashion_categories/);
  assert.match(sql, /check \(parent_id is distinct from id\)/);
});

// ============================================================
console.log('\n— Migration 0033 —');
// ============================================================

await test('three tables, RLS mirrored from categories / product_variants, is_demo on every table', () => {
  const sql = read('supabase/migrations/0033_fashion_store.sql');
  for (const t of ['fashion_categories', 'fashion_products', 'fashion_variants']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t} \\(`));
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`));
    assert.match(sql, new RegExp(`create policy "${t} admin write"\\s+on public\\.${t} for all\\s+using \\(exists \\(select 1 from public\\.admin_users a where a\\.user_id = auth\\.uid\\(\\)\\)\\)\\s+with check \\(exists \\(select 1 from public\\.admin_users a where a\\.user_id = auth\\.uid\\(\\)\\)\\);`));
    assert.match(sql, new RegExp(`${t}[\\s\\S]*?is_demo\\s+boolean not null default false`));
  }
  assert.match(sql, /create policy "fashion_categories public read"\s+on public\.fashion_categories for select\s+using \(is_active = true or exists \(select 1 from public\.admin_users/);
  assert.match(sql, /create policy "fashion_products public read"\s+on public\.fashion_products for select\s+using \(is_active = true or exists/);
  assert.match(sql, /create policy "fashion_variants public read"\s+on public\.fashion_variants for select\s+using \(is_active = true\);/);
  assert.match(sql, /create policy "fashion_variants admin read"/);
  assert.match(sql, /create unique index if not exists fashion_categories_parent_slug_key\s+on public\.fashion_categories \(coalesce\(parent_id, '00000000-0000-0000-0000-000000000000'::uuid\), slug\)/, 'slug unique per parent');
  assert.match(sql, /unique \(product_id, size, colour\)/, 'stock is per size × colour');
  assert.match(sql, /discount_percent integer generated always as/, 'the discount is derived, never written');
  assert.doesNotMatch(sql, /supabase db push/i.source === '' ? /$^/ : /^\s*supabase db push/m);
  assert.doesNotMatch(sql, /\b(alter|drop|update|delete)\s+(table\s+)?public\.(products|categories|product_variants|orders|coupons)\b/i, 'the wellness tables are untouched');
});

await test('the seed: the full tree, six demo products with variants, the shirt\'s M/Sage out and M/Navy in, no real brand', () => {
  const sql = read('supabase/migrations/0033_fashion_store.sql');
  for (const name of ['Clothing', 'Beauty', 'Footwear', 'Bags & Accessories', 'Men', 'Women', 'Kids', 'Shirts', 'T-Shirts', 'Trousers']) assert.ok(sql.includes(`'${name}'`), `tree seeds ${name}`);
  const seed = sql.slice(sql.indexOf('4. DEMO DATA'));
  for (const f of ['demo-mens-shirt', 'demo-kids-set', 'demo-sneakers', 'demo-handbag', 'demo-sunglasses', 'demo-kurta-set']) {
    assert.ok(seed.includes(`/img/${f}.webp`), `seed uses ${f}.webp`);
    assert.ok(has(`img/${f}.webp`), `${f}.webp exists`);
    assert.ok(statSync(resolve(ROOT, `img/${f}.webp`)).size < 150 * 1024, `${f}.webp under 150KB`);
  }
  assert.equal((seed.match(/^  \('[^']+',\s*'[a-z0-9-]+',\s*'[^']+',\s*'[^']*',\s*'[a-z_]+',/gm) || []).length, 6, 'six product rows');
  assert.match(seed, /'AW-MLS-M-SAGE',\s+0,/); assert.match(seed, /'AW-MLS-M-NAVY',\s+8,/);
  assert.match(seed, /select r\.name, r\.slug[\s\S]*?, true\nfrom rows_ r, cat/, 'products insert with is_demo = true');
  assert.match(seed, /v\.price_override, v\.sort_order, true\nfrom v join p/, 'variants insert with is_demo = true');
  assert.match(sql, /delete from public\.fashion_products where is_demo;/, 'the one-action delete is documented');
  assert.deepEqual(mentionsRealBrand(seed), [], 'no real brand in the seed');
  assert.deepEqual(mentionsRealBrand(JSON.stringify(INITIAL)), [], 'no real brand in the fixtures');
});

// ============================================================
console.log('\n— Products, stock, filters —');
// ============================================================

await test('per-combination stock: Medium/Sage is out while Medium/Navy is in, and the card still reads in stock', () => {
  assert.ok(rules);
  const shirt = PRODUCTS.find((p) => p.slug === 'meadow-linen-shirt-sage');
  const view = rules.productView(shirt);
  const m = rules.stockMatrix(view);
  assert.equal(m.stock('M', 'Sage'), 0); assert.equal(m.inStock('M', 'Sage'), false);
  assert.equal(m.stock('M', 'Navy'), 8); assert.equal(m.inStock('M', 'Navy'), true);
  assert.equal(m.get('XL', 'Navy'), null, 'a combination that does not exist is null, not zero');
  assert.deepEqual(m.sizesInStockFor('Ivory'), ['M']);
  assert.equal(view.inStock, true); assert.equal(view.totalStock, 31);
  assert.deepEqual(view.sizes, ['S', 'M', 'L', 'XL']);
  assert.deepEqual(view.swatches.map((s) => s.colour), ['Sage', 'Navy', 'Ivory', 'Rust', 'Black']);
  assert.deepEqual(rules.swatchOverflow(view.swatches, 4), { shown: view.swatches.slice(0, 4), more: 1 });
  assert.equal(view.price, 1099); assert.equal(view.mrp, 1999); assert.equal(view.discountPct, 45); assert.equal(view.hasDiscount, true);
  const sneakers = rules.productView(PRODUCTS.find((p) => p.slug === 'cloudstep-minimal-sneakers'));
  assert.equal(rules.stockMatrix(sneakers).priceOf('UK 8', 'Forest'), 1099, 'a variant price override wins');
  assert.equal(rules.stockMatrix(sneakers).priceOf('UK 7', 'White'), 999);
  const none = rules.productView({ id: 'x', name: 'Bare', slug: 'bare', mrp: 500, sale_price: null, images: [] }, []);
  assert.equal(none.inStock, false); assert.equal(none.hasDiscount, false); assert.equal(none.price, 500);
  assert.equal(rules.productView({ mrp: 1000, sale_price: 1200 }).hasDiscount, false, 'a sale price above MRP is no discount');
});

await test('filters live in the URL, survive a round trip, and back-navigation restores them', () => {
  assert.ok(rules);
  let p = new URLSearchParams();
  const history = [p.toString()];
  const go = (patch) => { p = rules.updateFashionUrlState(p, patch); history.push(p.toString()); };
  go({ price: '500-999' }); go({ sizes: ['M'] }); go({ colours: ['Navy', 'Sage'] }); go({ brands: ['Aurelia Wear'] }); go({ discount: 25 }); go({ rating: 4 }); go({ sort: 'price-asc' }); go({ view: 'list' });
  assert.equal(p.toString(), 'price=500-999&size=M&colour=Navy%2CSage&brand=Aurelia+Wear&discount=25&rating=4&sort=price-asc&view=list');
  const s = rules.readFashionUrlState(p);
  assert.deepEqual(s, { q: '', sort: 'price-asc', price: '500-999', sizes: ['M'], colours: ['Navy', 'Sage'], brands: ['Aurelia Wear'], discount: 25, rating: 4, view: 'list' });
  assert.equal(rules.activeFilterCount(s), 7, 'price, one size, two colours, one brand, discount, rating');
  // Back: each earlier URL reads back to exactly the state it had.
  assert.deepEqual(rules.readFashionUrlState(history[3]).colours, ['Navy', 'Sage']);
  assert.deepEqual(rules.readFashionUrlState(history[2]).colours, []);
  assert.equal(rules.readFashionUrlState(history[1]).price, '500-999');
  assert.equal(rules.readFashionUrlState(history[0]).price, null);
  // Defaults never pollute the URL; junk never reaches state.
  assert.equal(rules.updateFashionUrlState('', { sort: 'featured', view: 'grid', price: 'bogus', discount: 33, rating: 5 }).toString(), '');
  assert.deepEqual(rules.readFashionUrlState('sort=hack&price=free&size=M,M&discount=99&rating=1&view=carousel'), { q: '', sort: 'featured', price: null, sizes: ['M'], colours: [], brands: [], discount: null, rating: null, view: 'grid' });
  assert.equal(rules.updateFashionUrlState('size=M&colour=Navy', { sizes: [] }).toString(), 'colour=Navy', 'clearing one filter keeps the others');
});

await test('filters and sorts apply to the listing', () => {
  assert.ok(rules);
  const views = PRODUCTS.map((p) => rules.productView(p));
  const st = (patch) => rules.readFashionUrlState(rules.updateFashionUrlState('', patch));
  assert.deepEqual(rules.applyListing(views, st({ price: 'under-500' })).map((v) => v.slug), []);
  assert.deepEqual(rules.applyListing(views, st({ price: '500-999' })).map((v) => v.slug).sort(), ['cloudstep-minimal-sneakers', 'little-explorer-frock-pant-set', 'sunhaven-oversized-sunglasses']);
  assert.deepEqual(rules.applyListing(views, st({ sizes: ['M'] })).map((v) => v.slug).sort(), ['ethnic-embroidered-kurta-set-sage', 'meadow-linen-shirt-sage']);
  assert.deepEqual(rules.applyListing(views, st({ colours: ['Navy'] })).map((v) => v.slug), ['meadow-linen-shirt-sage']);
  assert.deepEqual(rules.applyListing(views, st({ brands: ['Cub & Clover'] })).map((v) => v.slug), ['little-explorer-frock-pant-set']);
  assert.equal(rules.applyListing(views, st({ discount: 50 })).length, 4);
  assert.equal(rules.applyListing(views, st({ rating: 4 })).length, 6); assert.deepEqual(rules.applyListing(views, st({ q: 'sunglass' })).map((v) => v.slug), ['sunhaven-oversized-sunglasses']);
  assert.deepEqual(rules.applyListing(views, st({ sort: 'price-asc' })).map((v) => v.price), [599, 599, 999, 1099, 1199, 1299]);
  assert.deepEqual(rules.applyListing(views, st({ sort: 'discount' })).map((v) => v.discountPct), [60, 60, 57, 54, 45, 40]);
  assert.equal(rules.applyListing(views, st({ sort: 'rating' }))[0].slug, 'verona-structured-handbag-blush');
  assert.deepEqual(rules.applyListing(views, st({})).slice(0, 2).map((v) => v.slug), ['ethnic-embroidered-kurta-set-sage', 'little-explorer-frock-pant-set'], 'featured: bestseller + new first');
  const t = rules.buildTree(CATEGORIES);
  assert.equal(rules.applyListing(views, st({}), rules.categoryScope(t, rules.resolveCategory(t, 'clothing'))).length, 3, 'Clothing scopes to its three descendants\' products');
  assert.equal(rules.applyListing(views, st({}), rules.categoryScope(t, rules.resolveCategory(t, 'mens-shirts'))).length, 1);
  const opts = rules.filterOptions(views);
  assert.deepEqual(opts.brands, ['Aurelia Wear', 'Celeste & Co.', 'Cub & Clover', 'Nova Stride', 'Sunhaven']);
  assert.deepEqual(opts.sizes.slice(0, 4), ['S', 'M', 'L', 'XL'], 'apparel sizes in wearing order');
  assert.deepEqual(rules.topBrands(views, 3).map((b) => b.name), ['Aurelia Wear', 'Celeste & Co.', 'Cub & Clover']);
});

await test('admin writes omit what the caller did not mention (and, since 0034, always stamp store = fashion)', () => {
  assert.ok(rules);
  assert.deepEqual(rules.fashionProductToRow({ slug: 'x', name: 'X' }), { store: 'fashion', slug: 'x', name: 'X' }, 'no is_active, no description, no prices invented');
  assert.deepEqual(rules.fashionProductToRow({ slug: 'x', salePrice: null }), { store: 'fashion', slug: 'x', sale_price: null }, 'an explicit null is sent');
  assert.deepEqual(rules.fashionProductToRow({ slug: 'x', isActive: false, images: [] }), { store: 'fashion', slug: 'x', is_active: false, images: [] });
  assert.deepEqual(rules.fashionVariantToRow({ productId: 'p', size: 'M', colour: 'Navy', stock: 3 }), { store: 'fashion', product_id: 'p', size: 'M', colour: 'Navy', stock: 3 });
  assert.deepEqual(rules.fashionCategoryToRow({ id: 'c', parentId: null }), { store: 'fashion', id: 'c', parent_id: null });
  assert.doesNotMatch(read('src/lib/fashionApi.js'), /is_active: (true|false)|description: ''|stock: 0/, 'the API never defaults a column');
});

// ============================================================
console.log('\n— The pages —');
// ============================================================

const app = await buildFashionApp({ cartCount: 2 }).catch((e) => ({ error: e }));

await test('/fashion: tiles, benefits, hero with an image slot, four category cards, invented brands, the product grid', () => {
  assert.ok(!app.error, app.error?.message);
  const html = app.render('/fashion');
  assert.match(html, /placeholder="Search for fashion, lifestyle and more…"/);
  assert.match(html, /class="fs-strip"[\s\S]*?Delivering across India[\s\S]*?Fast &amp; reliable delivery/);
  assert.equal((html.match(/class="fs-chip"/g) || []).length, 4, 'four level-1 chips');
  assert.deepEqual([...html.matchAll(/class="fs-tile__name">([^<]+)</g)].map((m) => m[1]), ['Men', 'Women', 'Kids', 'Beauty', 'Footwear', 'Bags &amp; Accessories']);
  assert.match(html, /fs-benefits__signin[\s\S]*?<strong>Sign in<\/strong> for exclusive benefits/);
  const benefits = html.slice(html.indexOf('fs-benefits__list'), html.indexOf('</ul>', html.indexOf('fs-benefits__list')));
  assert.equal((benefits.match(/<li>/g) || []).length, 4, 'four benefit items');
  assert.match(html, /<section class="fs-hero has-image" aria-labelledby="fs-hero-h">[\s\S]*?Fashion for a brighter you[\s\S]*?New Season Essentials[\s\S]*?Shop now/);
  assert.match(html, /<img src="\/img\/fashion-hero\.webp"[^>]*fetchpriority="high"/, 'the supplied banner, eager');
  assert.doesNotMatch(html, /fs-hero__slot/, 'no typographic stand-in once the artwork exists');
  const tiles = html.slice(html.indexOf('class="fs-tiles"'), html.indexOf('</nav>', html.indexOf('class="fs-tiles"')));
  assert.deepEqual([...tiles.matchAll(/src="([^"]+)"/g)].map((m) => m[1]), ['/img/fashion-circle-men.webp', '/img/fashion-circle-women.webp', '/img/fashion-circle-kids.webp', '/img/fashion-circle-beauty.webp', '/img/fashion-circle-footwear.webp', '/img/fashion-circle-bags.webp'], 'every circle is a photograph — no initial-letter stand-in');
  assert.doesNotMatch(tiles, /<b aria-hidden="true">B<\/b>/, 'the Beauty circle is no longer a B');
  const catcards = html.slice(html.indexOf('class="fs-catcards"'), html.indexOf('Top Brands'));
  assert.deepEqual([...catcards.matchAll(/src="([^"]+)"/g)].map((m) => m[1]), ['/img/fashion-card-clothing.webp', '/img/fashion-card-beauty.webp', '/img/fashion-card-footwear.webp', '/img/fashion-card-bags.webp']);
  for (const f of ['fashion-hero', 'fashion-circle-men', 'fashion-circle-women', 'fashion-circle-kids', 'fashion-circle-beauty', 'fashion-circle-footwear', 'fashion-circle-bags', 'fashion-card-clothing', 'fashion-card-beauty', 'fashion-card-footwear', 'fashion-card-bags']) {
    assert.ok(has(`img/${f}.webp`), `${f}.webp exists`); assert.ok(statSync(resolve(ROOT, `img/${f}.webp`)).size < 150 * 1024, `${f}.webp under 150KB`);
  }
  assert.equal((html.match(/class="fs-catcard"/g) || []).length, 4);
  assert.match(html, /Shop by Category[\s\S]*?<strong>Clothing<\/strong><em>For Every You<\/em>/);
  assert.match(html, /Top Brands on SORA LIFE/);
  const brands = [...html.matchAll(/fs-brandcard__logo serif">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(brands, ['Aurelia Wear', 'Celeste &amp; Co.', 'Cub &amp; Clover', 'Nova Stride', 'Sunhaven']);
  assert.deepEqual(mentionsRealBrand(text(html)), []);
  assert.equal((html.match(/class="fs-card"/g) || []).length, 6);
  assert.match(html, /<a class="fs-hdr__back" href="\/">[\s\S]*?Wellness store<\/a>/, 'a way back to the wellness store');
  assert.match(html, /data-stub="footer"/, 'the shared footer');
});

await test('the product card: badge, heart, quick-add, price with MRP struck, name, rating with count, swatches with +N', () => {
  const html = app.render('/fashion');
  const start = html.indexOf('data-product="meadow-linen-shirt-sage"');
  const card = html.slice(start, html.indexOf('<article', start + 1));
  assert.match(card, /<span class="fs-badge">45% OFF<\/span>/);
  assert.match(card, /<button type="button" class="fs-heart" aria-pressed="false" aria-label="Save Meadow Linen Shirt — Sage to wishlist">/);
  assert.match(card, /<button type="button" class="fs-quick" data-quick="sheet" aria-label="Choose size and colour for Meadow Linen Shirt — Sage">/, 'quick-add is a real control (Phase 2)');
  assert.match(card, /<strong><span class="fs-price__cur">₹<\/span>1,099<\/strong><span class="fs-price__mrp">M\.R\.P: <s>₹1,999<\/s><\/span>/);
  assert.match(card, /<h3 class="fs-card__name"><a href="\/fashion\/p\/meadow-linen-shirt-sage">Meadow Linen Shirt — Sage<\/a><\/h3>/);
  assert.match(card, /<p class="fs-rating"><b>4\.4<\/b><span class="fs-stars"[\s\S]*?<span class="fs-rating__count">\(812\)<\/span>/);
  assert.equal((card.match(/class="fs-swatch"/g) || []).length + (card.match(/class="fs-swatch is-out"/g) || []).length, 4);
  assert.match(card, /class="fs-swatches__more" href="\/fashion\/p\/meadow-linen-shirt-sage">\+1</);
  assert.match(html, /\(2\.4K\)/, 'thousands of reviews read as K');
  assert.match(html, /\(3\.2K\)/);
  const out = app.render('/fashion', { categories: CATEGORIES, products: [{ ...PRODUCTS[4], fashion_variants: PRODUCTS[4].fashion_variants.map((x) => ({ ...x, stock: 0 })) }] });
  assert.match(out, /class="fs-card is-out"[\s\S]*?<span class="fs-badge fs-badge--out">Sold out<\/span>/);
});

await test('/fashion/c/<slug> at every level: breadcrumb, chips, sub-categories, count, sort, view toggle, filter panel, grid', () => {
  const l1 = app.render('/fashion/c/clothing');
  assert.match(l1, /<nav class="fs-crumb"[\s\S]*?<a href="\/fashion">Fashion<\/a>[\s\S]*?<span aria-current="page">Clothing<\/span>/);
  assert.match(l1, /class="fs-chip is-on" aria-current="page" href="\/fashion\/c\/clothing">Clothing</);
  assert.deepEqual([...l1.matchAll(/class="fs-subcat" href="([^"]+)"/g)].map((m) => m[1]), ['/fashion/c/men', '/fashion/c/women', '/fashion/c/kids']);
  assert.match(l1, /<p class="fs-listing__count" role="status">3 products<\/p>/);
  assert.match(l1, /<select aria-label="Sort">[\s\S]*?<option value="price-asc">Price: low to high<\/option>/);
  assert.match(l1, /aria-label="Grid view"[\s\S]*?aria-label="List view"/);
  for (const legend of ['Price', 'Size', 'Colour', 'Brand', 'Discount', 'Rating']) assert.ok(l1.includes(`<legend>${legend}</legend>`), `filter ${legend}`);
  const l2 = app.render('/fashion/c/men');
  assert.match(l2, /<a href="\/fashion\/c\/clothing">Clothing<\/a>[\s\S]*?<span aria-current="page">Men<\/span>/);
  assert.match(l2, /class="fs-chip is-on"[^>]*>Clothing</, 'the root chip stays lit two levels down');
  assert.deepEqual([...l2.matchAll(/class="fs-subcat" href="([^"]+)"/g)].map((m) => m[1]), ['/fashion/c/mens-shirts', '/fashion/c/mens-t-shirts', '/fashion/c/mens-trousers']);
  const l3 = app.render('/fashion/c/mens-shirts');
  assert.match(l3, /<a href="\/fashion\/c\/clothing">Clothing<\/a>[\s\S]*?<a href="\/fashion\/c\/men">Men<\/a>[\s\S]*?<span aria-current="page">Shirts<\/span>/);
  assert.match(l3, /1 product<\/p>/); assert.doesNotMatch(l3, /fs-subcat/, 'a leaf has no sub-categories');
  const empty = app.render('/fashion/c/mens-trousers');
  assert.match(empty, /0 products/); assert.match(empty, /No styles in Trousers yet/);
  const missing = app.render('/fashion/c/nope');
  assert.match(missing, /There is no “nope” category in the fashion store\./); assert.match(missing, /class="fs-btn" href="\/fashion">Back to fashion/);
});

await test('filters in the URL render as chosen: checked inputs, the count, the list layout, the sort', () => {
  const html = app.render('/fashion/c/clothing?size=M&colour=Navy&sort=price-asc&view=list&discount=25');
  assert.match(html, /aria-label="Filters, 3 active"[\s\S]*?Filters<b>3<\/b>/);
  assert.match(html, /<label class="fs-filter__opt is-on"><input type="checkbox" checked=""[^>]*\/><span>M<\/span>/);
  assert.match(html, /<label class="fs-filter__opt is-on"><input type="checkbox" checked=""[^>]*\/><span class="fs-filter__swatch"[^>]*><\/span><span>Navy<\/span>/);
  assert.match(html, /<input type="radio" name="discount" checked=""[^>]*\/><span>25% or more<\/span>/);
  assert.match(html, /<option value="price-asc" selected="">/);
  assert.match(html, /class="fs-view"[\s\S]*?aria-pressed="false" aria-label="Grid view"[\s\S]*?class="is-on" aria-pressed="true" aria-label="List view"/);
  assert.match(html, /class="fs-grid fs-grid--list"/); assert.match(html, /class="fs-card fs-card--list"/);
  assert.match(html, /1 product<\/p>/, 'M + Navy + 25% off within Clothing is the shirt');
  assert.match(html, /data-product="meadow-linen-shirt-sage"/);
  const none = app.render('/fashion/c/clothing?colour=Gold');
  assert.match(none, /Nothing matches these filters\.[\s\S]*?<button type="button" class="fs-btn">Clear filters<\/button>/);
});

await test('the cart badge is the shared store\'s: a wellness item in the bag shows on /fashion', async () => {
  const html = app.render('/fashion');
  assert.match(html, /<a class="fs-hdr__act" aria-label="Cart, 2 items" href="\/cart">[\s\S]*?<span class="fs-hdr__count">2<\/span>/);
  const none = await buildFashionApp({ cartCount: 0 });
  assert.match(none.render('/fashion'), /<a class="fs-hdr__act" aria-label="Cart" href="\/cart">/);
  assert.doesNotMatch(none.render('/fashion'), /fs-hdr__count/);
  assert.match(read('src/fashion/FashionLayout.jsx'), /const \{ cartCount \} = useStore\(\);/, 'read from the shared store, not a fashion copy');
});

await test('the wishlist heart is real: saved styles count in the header and list on /fashion/wishlist', async () => {
  const saved = await buildFashionApp({ cartCount: 0, wishlist: [PRODUCTS[0].id, PRODUCTS[2].id] });
  const home = saved.render('/fashion');
  assert.match(home, /aria-label="Wishlist, 2 items"[\s\S]*?<span class="fs-hdr__count">2<\/span>/);
  assert.match(home, /class="fs-heart is-on" aria-pressed="true" aria-label="Remove Meadow Linen Shirt — Sage from wishlist"/);
  const list = saved.render('/fashion/wishlist');
  assert.match(list, /Your fashion wishlist/); assert.match(list, /2 products/);
  assert.match(list, /data-product="meadow-linen-shirt-sage"/); assert.match(list, /data-product="cloudstep-minimal-sneakers"/);
  assert.doesNotMatch(list, /data-product="little-explorer/);
  const empty = await buildFashionApp({ cartCount: 0, wishlist: [] });
  assert.match(empty.render('/fashion/wishlist'), /Nothing saved yet — tap the heart on any style/);
});

await test('/fashion/search and the product page route: title, breadcrumb, per-combination stock (the page itself is covered by test-fashion-cart.mjs)', () => {
  const s = app.render('/fashion/search?q=sage');
  assert.match(s, /Results for “sage”/); assert.match(s, /2 products/);
  assert.match(app.render('/fashion/search?q=zzz'), /Nothing found for “zzz”/);
  const p = app.render('/fashion/p/meadow-linen-shirt-sage');
  assert.match(p, /<h1 class="fs-pdp__h serif">Meadow Linen Shirt — Sage<\/h1>/);
  assert.match(p, /<span aria-current="page">Meadow Linen Shirt — Sage<\/span>/);
  assert.match(p, /<a href="\/fashion\/c\/mens-shirts">Shirts<\/a>/);
  assert.match(app.render('/fashion/p/meadow-linen-shirt-sage?size=M&colour=Sage'), /fs-pick__note is-out/, 'M/Sage out');
  assert.match(app.render('/fashion/p/meadow-linen-shirt-sage?size=M&colour=Navy'), /fs-pick__note is-in/, 'M/Navy in');
  assert.match(app.render('/fashion/p/nope'), /There is no “nope” in the fashion store\./);
});

// ============================================================
console.log('\n— The wellness storefront —');
// ============================================================

function homeSections(source) {
  // Render Home.jsx with every section component stubbed to a marker, so the
  // composition — the sequence of sections — can be compared exactly.
  const { code } = transformSync(source, {
    configFile: false, babelrc: false, presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: { ImportDeclaration(p) { p.remove(); }, ExportDefaultDeclaration(p) { p.replaceWith(p.node.declaration); } } })],
  });
  const names = ['Hero', 'HomeCategoryStrip', 'EditorialCard', 'StoryBlock', 'Newsletter', 'HomeOffers', 'HomeLeaderboard', 'MarketplaceProductRail', 'FeaturedBrands', 'DiscoveryEdit', 'MomTrustSpotlight', 'CuratedCollections', 'CreatorCommunity', 'WhySoraLife', 'ShopByCategory', 'ShopByConcerns', 'LifestyleBanner', 'StoreCarousel'];
  const stubs = Object.fromEntries(names.map((n) => [n, (props) => h('section', { 'data-c': n + (props?.id ? `#${props.id}` : '') })]));
  const scope = { React, ...React, ...stubs, useSyncExternalStore: () => ({ visuals: {} }), subscribeHomepage: () => () => {}, getHomepageSnapshot: () => ({}),
    sanitizeHomepageVisuals: () => ({}), watchHomepageVisuals: () => {}, products: [], categories: [], selectHomeMerchandising: () => ({ trending: [], discover: [], popular: [], brands: [], momProducts: [], collections: [], popularTitle: 'Popular' }), homepage: {} };
  const Home = new Function(...Object.keys(scope), `${code}\n; return Home;`)(...Object.values(scope));
  return [...renderToStaticMarkup(h(Home)).matchAll(/data-c="([^"]+)"/g)].map((m) => m[1]);
}

await test('the wellness homepage keeps every section in the same order — the Lifestyle banner (after the offers) and the store carousel (above the popular rail) are the only additions', () => {
  // The homepage as it stood before the fashion store (b45cdc8), pinned.
  const before = ['Hero', 'HomeCategoryStrip', 'HomeOffers', 'MarketplaceProductRail#trending', 'ShopByCategory', 'ShopByConcerns', 'FeaturedBrands', 'DiscoveryEdit', 'MarketplaceProductRail#popular', 'MomTrustSpotlight', 'CuratedCollections', 'CreatorCommunity', 'WhySoraLife', 'Newsletter', 'HomeLeaderboard'];
  const after = homeSections(read('src/pages/Home.jsx'));
  const added = ['LifestyleBanner', 'StoreCarousel'];
  for (const s of added) assert.equal(after.filter((x) => x === s).length, 1, `${s} is on the homepage once`);
  assert.deepEqual(after.filter((s) => !added.includes(s)), before, 'every other section, in order');
  assert.equal(after.indexOf('LifestyleBanner'), after.indexOf('HomeOffers') + 1, 'the banner sits after the offers, before the first product rail');
  assert.equal(after.indexOf('StoreCarousel'), after.indexOf('MarketplaceProductRail#popular') - 1, 'the carousel sits directly above the popular rail (test-store-doorway.mjs pins both sections)');
  const Icon = loadModule('src/components/Icon.jsx').default;
  const DeferredImage = loadModule('src/components/DeferredImage.jsx').default;
  const doorway = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage });
  const html = renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(doorway.LifestyleBanner))) + renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(doorway.StoreCarousel)));
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/lifestyle', '/fashion', '/homeliving'], 'the whole-card links use existing stores');
  assert.match(html, /Two Worlds\. A Better You\./);
  assert.equal((html.match(/<img /g) || []).length, 3);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 3);
  assert.doesNotMatch(html, /<img[^>]+ src=/, 'the below-fold images remain deferred on initial render');
  for (const a of html.matchAll(/<a [^>]*>[\s\S]*?<\/a>/g)) assert.doesNotMatch(a[0].slice(2), /<button|<a /, 'no nested interactive controls inside the links');
  assert.equal((html.match(/<button/g) || []).length, 2, 'the carousel dots are the only buttons');
});

await test('the storefront stylesheet order is untouched; the fashion sheets are appended, the store one deferred', () => {
  const list = (src, name) => [...src.slice(src.indexOf(`const ${name}`), src.indexOf('];', src.indexOf(`const ${name}`))).matchAll(/'([^']+\.css)'/g)].map((m) => m[1]);
  // The wellness cascade as it stood before the fashion store (b45cdc8),
  // pinned here so a reorder anywhere in it fails loudly.
  const WELLNESS_CASCADE = ['tokens', 'base', 'components', 'layout', 'pages', 'pdp', 'home', 'promotions', 'v2-foundation', 'v2-header', 'v2-card', 'v2-home', 'v2-shop', 'v2-pdp', 'v2-cart-checkout', 'v2-mobile-cart', 'coupons', 'info', 'homepage-appearance', 'hero-cta', 'v2-home-marketplace', 'v2-home-discovery', 'leaderboard', 'category-spotlight', 'storefront-motion', 'storefront-background', 'storefront-refinements'].map((n) => `src/styles/${n}.css`);
  const after = read('build/build-css.mjs');
  const sf = list(after, 'STOREFRONT');
  assert.deepEqual(sf.slice(0, WELLNESS_CASCADE.length), WELLNESS_CASCADE, 'the cascade the wellness store loads is the same list, in the same order');
  assert.deepEqual(sf.slice(WELLNESS_CASCADE.length), ['src/styles/fashion-banner.css']);
  // Deferred, after the creator sheets; a later store (grocery) may follow it.
  const deferred = list(after, 'DEFERRED');
  assert.ok(deferred.indexOf('src/styles/fashion.css') > deferred.indexOf('src/styles/creator-dashboard.css'), 'fashion.css is deferred, after the creator sheets');
  assert.match(read('src/lib/deferredStyles.js'), /\(admin\|passport\|creator\|fashion(\|[a-z]+)*\)/, 'the deferred sheet is fetched on /fashion');
  const css = read('src/styles/fashion.css');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /^(?!\s*[.@}]|\s*$)[a-z:*][^{]*\{/m, 'every rule is namespaced — no bare element or :root rule');
  assert.ok(css.split('\n').filter((l) => /^[.]/.test(l)).every((l) => l.startsWith('.fs')), 'every selector starts with .fs');
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) for (const part of m[1].replace(/\([^)]*\)/g, '').split(',')) assert.match(part.trim(), /^(?:transform|opacity|none)\b/, `transition on ${part.trim()}`);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

await test('routes and the untouchables: /fashion, c/:slug, p/:slug are wired; checkout, cart mutation, Razorpay, auth, coupons are not in the diff', () => {
  const appSrc = read('src/App.jsx');
  assert.match(appSrc, /<Route path="\/fashion" element=\{<FashionLayout \/>\}>/);
  for (const r of ['index element={<FashionHome />}', 'path="c/:slug" element={<FashionCategory />}', 'path="p/:slug" element={<FashionProductPage />}']) assert.ok(appSrc.includes(r), r);
  // The working tree against HEAD, and the last commit itself, so the check
  // holds before and after the phase is committed. Built output (public/) is
  // regenerated by npm run build, never hand-edited, so it is not in the list.
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const changed = [...new Set([...git('diff', '--name-only', 'HEAD'), ...git('diff', '--name-only', 'HEAD~1', 'HEAD')])];
  // Phase 2 opened the cart and pricing path (store.jsx, cartLine.js, Cart.jsx, payments.js, api/_lib/pricing.js,
  // create-order, the quote). What stays closed: Razorpay itself, auth, the creator programme, the coupon rules,
  // CategorySpotlight and the wellness PDP, the ingest/deactivation/gallery scripts. The wellness Header
  // was opened by the store-switcher task (links only; test-store-nav.mjs pins its exact diff).
  const untouchable = /^(src\/pages\/(Product|Category|Shop)\.jsx|src\/lib\/(customerAuth\.jsx|adminAuth\.jsx|couponRules\.js|couponState\.js|creator[A-Za-z]*\.js)|src\/components\/(CategorySpotlight|ProductCard)\.jsx|src\/components\/(category|pdp)\/|api\/_lib\/(razorpay|coupons|attribution)\.js|api\/razorpay\/(verify|webhook)\.js|api\/coupons\/|api\/creator\/|scripts\/(ingest|deactivate|gallery))/;
  assert.deepEqual(changed.filter((f) => untouchable.test(f)), [], 'nothing on the do-not-touch list changed');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
