// ============================================================
// Home & Living — the category listing (/homeliving/category/<slug>).
// Offline suite.
//
// The pure rules (category resolve / scope / breadcrumb, the URL contract
// for filters, sort and view — the fashion listing's key names and
// validation), the data module's variant facets, and the real page
// rendered through the real router: every state, the three empty states,
// the not-found state inside the shell, every homepage circle resolving,
// the phone/tablet/desktop rules, no speed claim, and the isolation of
// everything else. NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-homeliving-listing.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-homeliving-listing.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, read, has, loadModule, buildHomeLivingApp, loadHomeLivingData, CATEGORIES, PRODUCTS, LISTING, LISTING_CATEGORIES, LISTING_PRODUCTS } from './homeliving-ssr.mjs';
import { REPO, atCommit } from './baseline-export.mjs';

// The tip before the listing (the Home & Living bundle commit).
const BASELINE_SHA = '0423472';
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

const NEW_FILES = ['src/lib/homelivingListing.js', 'src/homeliving/HomeLivingCategory.jsx', 'src/homeliving/HomeLivingProductCard.jsx', 'src/data/homelivingHomepage.js', 'src/styles/homeliving.css'];
const SPEED_CLAIMS = [/\bfast\b/i, /\bfaster\b/i, /\bexpress\b/i, /\binstant/i, /\bsecure\s+deliver/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\bquick\b/i, /\brapid\b/i, /\bspeedy\b/i, /\beco[- ]friendly\b/i];

let rules = null;
try { rules = loadModule('src/lib/homelivingListing.js', {}); } catch { rules = null; }
const data = loadHomeLivingData({ initial: LISTING });
const P = data.getHomeLivingCatalogue().products; // views with facets
const C = data.getHomeLivingCatalogue().categories;
const byId = (n) => LISTING_CATEGORIES.find((c) => c.slug === n).id;

// ============================================================
console.log('\n— The rules: categories —');
// ============================================================

await test('resolveCategory: the shallowest active match; inactive and unknown slugs are null; case and whitespace forgiven', () => {
  assert.ok(rules, 'src/lib/homelivingListing.js exists');
  assert.equal(rules.resolveCategory(C, 'bedsheets').id, byId('bedsheets'));
  assert.equal(rules.resolveCategory(C, ' Bedsheets ').id, byId('bedsheets'));
  assert.equal(rules.resolveCategory(C, 'fitted-sheets').id, byId('fitted-sheets'), 'a child resolves too');
  assert.equal(rules.resolveCategory(LISTING_CATEGORIES, 'retired'), null, 'inactive is not a category');
  assert.equal(rules.resolveCategory(C, 'nope'), null); assert.equal(rules.resolveCategory(C, ''), null); assert.equal(rules.resolveCategory([], 'bedsheets'), null);
});

await test('categoryChildren / categoryScope / breadcrumbFor: a parent covers its children; a child crumb walks up; a cycle cannot hang', () => {
  const bed = rules.resolveCategory(C, 'bedsheets'); const fitted = rules.resolveCategory(C, 'fitted-sheets');
  assert.deepEqual(rules.categoryChildren(C, bed).map((c) => c.slug), ['fitted-sheets']);
  assert.deepEqual(rules.categoryChildren(C, fitted), []);
  assert.deepEqual([...rules.categoryScope(C, bed)].sort(), [byId('bedsheets'), byId('fitted-sheets')].sort());
  assert.deepEqual([...rules.categoryScope(C, fitted)], [byId('fitted-sheets')]);
  assert.equal(rules.categoryScope(C, null), null);
  assert.deepEqual(rules.breadcrumbFor(C, fitted), [{ name: 'Home & Living', href: '/homeliving' }, { name: 'Bedsheets', href: '/homeliving/category/bedsheets' }, { name: 'Fitted Sheets', href: '/homeliving/category/fitted-sheets' }]);
  assert.deepEqual(rules.breadcrumbFor(C, null), [{ name: 'Home & Living', href: '/homeliving' }]);
  const loop = [{ id: 'a', parent_id: 'b', name: 'A', slug: 'a', is_active: true }, { id: 'b', parent_id: 'a', name: 'B', slug: 'b', is_active: true }];
  assert.equal(rules.breadcrumbFor(loop, loop[0]).length, 3, 'stops on the cycle');
  assert.equal(rules.categoryScope(loop, loop[0]).size, 2);
});

// ============================================================
console.log('\n— The rules: the URL contract (the fashion listing\'s) —');
// ============================================================

await test('readListingState validates every key against a closed list and defaults the rest', () => {
  const s = rules.readListingState('sort=price-desc&price=1000-1999&size=King,Single,King&colour=Sage&brand=Meadow%20Weave,Loom%20%26%20Co.&discount=25&rating=4&view=list');
  assert.deepEqual(s, { sort: 'price-desc', price: '1000-1999', sizes: ['King', 'Single'], colours: ['Sage'], brands: ['Meadow Weave', 'Loom & Co.'], discount: 25, rating: 4, view: 'list' });
  assert.deepEqual(rules.readListingState('sort=cheapest&price=free&discount=99&rating=5&view=table&size=,,'), { sort: 'featured', price: null, sizes: [], colours: [], brands: [], discount: null, rating: null, view: 'grid' }, 'nothing unknown survives');
  assert.deepEqual(rules.readListingState(new URLSearchParams('')), { sort: 'featured', price: null, sizes: [], colours: [], brands: [], discount: null, rating: null, view: 'grid' });
});

await test('updateListingState writes only non-default values, so a clean listing has a clean URL and a shared URL round-trips', () => {
  const p = rules.updateListingState(new URLSearchParams(''), { sort: 'price-asc', price: 'under-500', sizes: ['King', 'King', ''], colours: ['Sage'], brands: [], discount: 40, rating: 3, view: 'list' });
  assert.equal(p.toString(), 'sort=price-asc&price=under-500&size=King&colour=Sage&discount=40&rating=3&view=list');
  const back = rules.updateListingState(p, { sort: 'featured', view: 'grid', price: null, sizes: [], colours: [], discount: null, rating: null });
  assert.equal(back.toString(), '', 'defaults are deleted, not written');
  assert.equal(rules.updateListingState(new URLSearchParams('q=keep'), { sort: 'new' }).toString(), 'q=keep&sort=new', 'untouched params survive');
  assert.deepEqual(rules.readListingState(rules.updateListingState(new URLSearchParams(''), rules.readListingState(p))), rules.readListingState(p), 'read → write → read is stable');
  assert.equal(rules.updateListingState(p, rules.CLEAR_FILTERS).toString(), 'sort=price-asc&view=list', 'clearing filters keeps sort and view');
  assert.equal(rules.activeFilterCount(rules.readListingState(p)), 5);
});

// ============================================================
console.log('\n— The rules: facets, filters, sorts, scope —');
// ============================================================

await test('the data module exposes variant facets: variants (active, ordered), sizes (distinct), swatches (distinct, empty colours skipped); a product without variants has empty facets', () => {
  const fitted = P.find((p) => p.slug === 'sage-fitted-sheet');
  assert.deepEqual(fitted.sizes, ['Single', 'King', 'Queen'], 'in variant order, distinct');
  assert.deepEqual(fitted.swatches, [{ colour: 'Sage', hex: '#8A9A6B' }, { colour: 'Ivory', hex: '#EDE6D6' }], 'the empty colour is not a swatch');
  assert.equal(fitted.variants.length, 4); assert.equal(fitted.variants[1].stock, 0);
  const bed = P.find((p) => p.slug === 'botanical-bedsheet-set-king');
  assert.deepEqual(bed.sizes, []); assert.deepEqual(bed.swatches, []); assert.deepEqual(bed.variants, []);
  // The query really embeds the variants (executed against a recording stand-in, not grepped).
  const calls = [];
  const from = (table) => { const q = { table, ops: [] }; calls.push(q); const chain = new Proxy({}, { get(_, m) { if (m === 'then') return (res) => Promise.resolve({ data: [], error: null }).then(res); return (...a) => { q.ops.push([m, ...a]); return chain; }; } }); return chain; };
  const inactive = data.homelivingProductView({ ...LISTING_PRODUCTS[4], variants: LISTING_PRODUCTS[4].variants.map((v) => ({ ...v, is_active: false })) });
  assert.deepEqual(inactive.sizes, []);
  return loadModule('src/data/homelivingHomepage.js', { supabase: { from } }).getHomeLivingProducts().then(() => {
    assert.equal(calls[0].table, 'catalogue_products');
    // The product page (a later phase) appends the media embed after the variants; the variants embed itself is pinned here.
    assert.match(calls[0].ops.find((o) => o[0] === 'select')[1], /, variants:catalogue_variants \(id, product_id, size, colour, colour_hex, sku, stock, price_override, is_active, sort_order\)(, media:catalogue_product_media \([^)]+\))?$/, 'the embed');
  });
});

await test('filterOptions offers only what is in the listing: sizes in bed order, colours with hex, brands sorted; discount and rating only when a product has one', () => {
  const o = rules.filterOptions(P);
  assert.deepEqual(o.sizes, ['Single', 'Queen', 'King'], 'Single before Queen before King');
  assert.deepEqual(o.colours, [{ colour: 'Ivory', hex: '#EDE6D6' }, { colour: 'Sage', hex: '#8A9A6B' }]);
  assert.deepEqual(o.brands, ['Loom & Co.', 'Meadow Weave', 'SORA LIFE']);
  assert.deepEqual(o.discounts, [10, 25, 40, 50]); assert.deepEqual(o.ratings, [4, 3]);
  const plain = rules.filterOptions(P.filter((p) => p.slug === 'jute-runner'));
  assert.deepEqual(plain, { sizes: [], colours: [], brands: ['Loom & Co.'], discounts: [], ratings: [] }, 'no facet that could only say "nothing matches"');
  assert.deepEqual(rules.filterOptions([]), { sizes: [], colours: [], brands: [], discounts: [], ratings: [] });
});

await test('matchesFilters: price band, size, colour, brand, discount and rating, each on its own and together', () => {
  const st = (o) => ({ sort: 'featured', price: null, sizes: [], colours: [], brands: [], discount: null, rating: null, view: 'grid', ...o });
  const fitted = P.find((p) => p.slug === 'sage-fitted-sheet'); const quilt = P.find((p) => p.slug === 'cotton-quilt-single'); const runner = P.find((p) => p.slug === 'jute-runner');
  assert.ok(rules.matchesFilters(fitted, st({ price: '500-999' }))); assert.ok(!rules.matchesFilters(quilt, st({ price: '500-999' }))); assert.ok(rules.matchesFilters(quilt, st({ price: '1000-1999' })));
  assert.ok(rules.matchesFilters(fitted, st({ sizes: ['King'] }))); assert.ok(!rules.matchesFilters(quilt, st({ sizes: ['King'] })), 'no variants, no size');
  assert.ok(rules.matchesFilters(fitted, st({ colours: ['Ivory'] }))); assert.ok(!rules.matchesFilters(fitted, st({ colours: ['Rust'] })));
  assert.ok(rules.matchesFilters(runner, st({ brands: ['Loom & Co.'] }))); assert.ok(!rules.matchesFilters(runner, st({ brands: ['SORA LIFE'] })));
  assert.ok(rules.matchesFilters(fitted, st({ discount: 10 }))); assert.ok(!rules.matchesFilters(runner, st({ discount: 10 })), 'no sale, no discount');
  assert.ok(rules.matchesFilters(fitted, st({ rating: 4 }))); assert.ok(!rules.matchesFilters(quilt, st({ rating: 3 })));
  assert.ok(rules.matchesFilters(fitted, st({ price: '500-999', sizes: ['Single'], colours: ['Sage'], brands: ['Meadow Weave'], discount: 10, rating: 4 })));
  assert.ok(!rules.matchesFilters(fitted, st({ price: '500-999', sizes: ['Single'], colours: ['Sage'], brands: ['Meadow Weave'], discount: 25 })), 'one miss is a miss');
});

await test('sortProducts: featured (bestseller → new → sort_order → name), price both ways, discount, rating, newest', () => {
  const names = (arr) => arr.map((p) => p.slug);
  assert.deepEqual(names(rules.sortProducts(P, 'featured')).slice(0, 2), ['sage-fitted-sheet', 'jute-runner'], 'bestseller, then new');
  assert.deepEqual(names(rules.sortProducts(P, 'price-asc')), ['leaf-cushion-cover-pair', 'bath-towel-set-pack-of-2', 'sage-fitted-sheet', 'jute-runner', 'botanical-bedsheet-set-king', 'cotton-quilt-single']);
  assert.deepEqual(names(rules.sortProducts(P, 'price-desc'))[0], 'cotton-quilt-single');
  assert.deepEqual(names(rules.sortProducts(P, 'discount'))[0], 'sage-fitted-sheet', '23% beats the rest');
  assert.deepEqual(names(rules.sortProducts(P, 'rating'))[0], 'sage-fitted-sheet');
  assert.deepEqual(names(rules.sortProducts(P, 'new'))[0], 'jute-runner');
  assert.deepEqual(names(rules.sortProducts(P, 'zzz')), names(rules.sortProducts(P, 'featured')), 'unknown sort is featured');
  assert.equal(P.map((p) => p.slug).join(), LISTING_PRODUCTS.map((p) => p.slug).join(), 'the input is never mutated');
});

await test('applyListing: scope → filters → sort; a parent lists its child\'s products; an unscoped listing is everything', () => {
  const bed = rules.resolveCategory(C, 'bedsheets');
  const st = rules.readListingState('');
  assert.deepEqual(rules.applyListing(P, st, rules.categoryScope(C, bed)).map((p) => p.slug), ['sage-fitted-sheet', 'botanical-bedsheet-set-king']);
  assert.deepEqual(rules.applyListing(P, rules.readListingState('size=King&colour=Sage&sort=price-desc'), rules.categoryScope(C, bed)).map((p) => p.slug), ['sage-fitted-sheet']);
  assert.deepEqual(rules.applyListing(P, rules.readListingState('price=under-500'), rules.categoryScope(C, bed)), []);
  assert.equal(rules.applyListing(P, st, null).length, 6);
  assert.deepEqual(rules.applyListing(P, st, rules.categoryScope(C, rules.resolveCategory(C, 'curtains'))), []);
});

// ============================================================
console.log('\n— The page, rendered through the real router —');
// ============================================================

const app = await buildHomeLivingApp({ cartCount: 1, initial: LISTING }).catch((e) => ({ error: e }));
const render = (p) => app.render(p);

await test('/homeliving/category/bedsheets: breadcrumb, the sub-category pill, title, live count, sort, grid/list, the filter panel with every facet in scope, two cards in featured order', () => {
  assert.ok(!app.error, app.error?.message);
  const html = render('/homeliving/category/bedsheets');
  assert.match(html, /<div class="hl"><header class="hl-hdr">/, 'inside the Home & Living shell');
  assert.match(html, /<nav class="hl-crumb" aria-label="Breadcrumb"><ol><li><a href="\/homeliving">Home &amp; Living<\/a><\/li><li><span aria-current="page">Bedsheets<\/span><\/li><\/ol><\/nav>/);
  assert.match(html, /<nav class="hl-subcats" aria-label="Shop Bedsheets"><a class="hl-subcat" href="\/homeliving\/category\/fitted-sheets">Fitted Sheets<\/a><\/nav>/);
  assert.match(html, /<h1 class="hl-listing__h serif">Bedsheets<\/h1><p class="hl-listing__count" role="status">2 products<\/p>/);
  assert.match(html, /<select aria-label="Sort"><option value="featured" selected="">Featured<\/option><option value="price-asc">Price: low to high<\/option><option value="price-desc">Price: high to low<\/option><option value="discount">Biggest discount<\/option><option value="rating">Top rated<\/option><option value="new">Newest<\/option><\/select>/);
  assert.match(html, /<button type="button" class="is-on" aria-pressed="true" aria-label="Grid view">/); assert.match(html, /<button type="button" class="" aria-pressed="false" aria-label="List view">/);
  const legends = [...html.matchAll(/<legend>([^<]+)<\/legend>/g)].map((m) => m[1]);
  assert.deepEqual(legends, ['Price', 'Size', 'Colour', 'Brand', 'Discount', 'Rating']);
  assert.match(html, /<div class="hl-filter__sizes"><label class="hl-filter__opt"><input type="checkbox"\/><span>Single<\/span><\/label><label class="hl-filter__opt"><input type="checkbox"\/><span>Queen<\/span><\/label><label class="hl-filter__opt"><input type="checkbox"\/><span>King<\/span><\/label><\/div>/);
  assert.match(html, /<span class="hl-filter__swatch" style="background:#8A9A6B" aria-hidden="true"><\/span><span>Sage<\/span>/);
  assert.match(html, /<span>Meadow Weave<\/span>[\s\S]*?<span>SORA LIFE<\/span>/);
  const cards = [...html.matchAll(/<article class="hl-card" data-product="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(cards, ['sage-fitted-sheet', 'botanical-bedsheet-set-king'], 'the child\'s product too, bestseller first');
  assert.match(html, /<div class="hl-grid">/);
  assert.doesNotMatch(html, /<button[^>]*>Add/, 'no add-to-cart that has nowhere to go');
});

await test('URL state drives the render: ?size=King&colour=Sage&sort=price-desc&view=list → one card, list layout, the sort and toggles reflect it, the count says 2 filters', () => {
  const html = render('/homeliving/category/bedsheets?size=King&colour=Sage&sort=price-desc&view=list');
  assert.match(html, /<p class="hl-listing__count" role="status">1 product<\/p>/);
  assert.match(html, /aria-label="Filters, 2 active"[^>]*>[\s\S]*?Filters<b>2<\/b><\/button>/);
  assert.match(html, /<option value="price-desc" selected="">/);
  assert.match(html, /<button type="button" class="is-on" aria-pressed="true" aria-label="List view">/);
  assert.match(html, /<div class="hl-grid hl-grid--list"><article class="hl-card hl-card--list" data-product="sage-fitted-sheet">/);
  assert.match(html, /<label class="hl-filter__opt is-on"><input type="checkbox" checked=""\/><span>King<\/span>/);
  assert.match(html, /<strong>Filters \(2\)<\/strong><button type="button" class="hl-filters__clear">Clear all<\/button>/);
  const unknown = render('/homeliving/category/bedsheets?sort=cheapest&price=free&view=table');
  assert.match(unknown, /<option value="featured" selected="">/); assert.match(unknown, /2 products/, 'unknown params are ignored, not applied');
});

await test('three empty states: filters that match nothing (with Clear), a category with no products (no filler), and loading', async () => {
  const none = render('/homeliving/category/bedsheets?price=under-500');
  assert.match(none, /<p class="hl-listing__count" role="status">0 products<\/p>/);
  assert.match(none, /<div class="hl-empty hl-empty--listing"><p>Nothing matches these filters\.<\/p><button type="button" class="hl-btn">Clear filters<\/button><\/div>/);
  const empty = render('/homeliving/category/curtains');
  assert.match(empty, /<div class="hl-empty hl-empty--listing"><p>No products in Curtains yet — they appear here as they go live\.<\/p><\/div>/);
  assert.doesNotMatch(empty, /hl-card/, 'no filler tiles');
  assert.deepEqual([...empty.matchAll(/<legend>([^<]+)<\/legend>/g)].map((m) => m[1]), ['Price'], 'only the facet that always applies');
  const loading = await buildHomeLivingApp({ initial: null });
  const l = loading.render('/homeliving/category/bedsheets');
  assert.match(l, /Loading the catalogue…/, 'the catalogue has not answered yet');
  assert.doesNotMatch(l, /There is no “bedsheets”/, 'not "not found" while loading');
});

await test('an unknown slug renders a not-found state inside the shell — never a crash', () => {
  const html = render('/homeliving/category/nope');
  assert.match(html, /<div class="hl"><header class="hl-hdr">[\s\S]*?<nav class="hl-crumb"[\s\S]*?<span aria-current="page">Not found<\/span>/);
  assert.match(html, /<p>There is no “nope” category in the Home &amp; Living store\.<\/p><a class="hl-btn" href="\/homeliving">Back to Home &amp; Living<\/a>/);
  assert.match(html, /data-stub="footer"/, 'the shell\'s footer follows');
  assert.doesNotMatch(render('/homeliving/category/retired'), /hl-listing__bar/, 'an inactive category is not found either');
});

await test('every category circle on the homepage resolves to a listing (no 404), including with the 0035 seed alone', async () => {
  const seeded = await buildHomeLivingApp({ initial: { categories: CATEGORIES, products: PRODUCTS } });
  const home = seeded.render('/homeliving');
  const hrefs = [...home.matchAll(/<a class="hl-circle" href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(hrefs.length, 6);
  for (const href of hrefs) {
    const page = seeded.render(href);
    assert.match(page, /<h1 class="hl-listing__h serif">[^<]+<\/h1>/, `${href} renders a listing`);
    assert.doesNotMatch(page, /There is no “/, `${href} is found`);
  }
  for (const href of [...home.matchAll(/class="hl-cta"[^>]*href="([^"]+)"|class="hl-sec__link" href="([^"]+)"/g)].map((m) => m[1] || m[2])) assert.doesNotMatch(seeded.render(href), /There is no “/, `${href} resolves`);
  // with the seed alone: Bedsheets → 1 product, Curtains → the real empty state
  assert.match(seeded.render('/homeliving/category/bedsheets'), /1 product<\/p>/); assert.match(seeded.render('/homeliving/category/curtains'), /No products in Curtains yet/);
});

await test('text rule and copy: every image is decorative, every label is text; no speed claim in the new code or the rendered page', () => {
  const html = render('/homeliving/category/bedsheets');
  for (const i of html.matchAll(/<img [^>]*>/g)) assert.match(i[0], / alt=""/);
  const t = text(html);
  for (const s of ['Bedsheets', 'Fitted Sheets', 'Sage Fitted Sheet', '₹999', '₹1,299', 'Botanical Bedsheet Set', 'Sort by:', 'Under ₹500', 'Standard Delivery · 6-7 days']) assert.ok(t.includes(s), s);
  for (const rel of NEW_FILES) for (const re of SPEED_CLAIMS) assert.ok(!re.test(read(rel)), `${rel} matches ${re}`);
  for (const re of SPEED_CLAIMS) assert.ok(!re.test(t), `rendered page matches ${re}`);
  for (const rel of ['src/homeliving/HomeLivingCategory.jsx']) {
    const src = stripComments(read(rel));
    assert.doesNotMatch(src, /\/img\/homeliving-|Botanical|bedsheets'|price:\s*\d|₹\s*\d/, 'nothing hardcoded');
    assert.doesNotMatch(src, /product\.(price|mrp)\s*[+\-*/]/, 'no price arithmetic');
  }
});

// ============================================================
console.log('\n— The stylesheet: three widths —');
// ============================================================

await test('1280: filters are a sticky aside beside a three-column grid; the Filters button is hidden', () => {
  const css = read('src/styles/homeliving.css');
  assert.match(css, /\.hl-listing__body \{ display: grid; grid-template-columns: 260px minmax\(0, 1fr\); gap: 24px; align-items: start; \}/);
  assert.match(css, /\.hl-filters \{ position: sticky; top: 190px;/);
  assert.match(css, /\.hl-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); gap: 16px; \}/);
  assert.match(css, /\.hl-filters__toggle \{ display: none;/);
  assert.match(css, /\.hl-card--list \{ grid-template-rows: none; grid-template-columns: 200px minmax\(0, 1fr\); \}/);
});

await test('768: the filters become a drawer under the Filters button (scrim, close), three columns stay', () => {
  const css = read('src/styles/homeliving.css');
  const tablet = css.slice(css.indexOf('@media (max-width: 1019px)'), css.indexOf('@media (max-width: 599px)'));
  assert.match(tablet, /\.hl-listing__body \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(tablet, /\.hl-filters__toggle \{ display: inline-flex; \}/);
  assert.match(tablet, /\.hl-filters \{ display: none; position: fixed; left: 0; top: 0; bottom: 0; z-index: 41; width: min\(340px, 88vw\);/);
  assert.match(tablet, /\.hl-listing__body\.has-panel \.hl-filters \{ display: grid; \}/);
  assert.match(tablet, /\.hl-listing__body\.has-panel \.hl-filters__scrim \{ display: block; position: fixed; inset: 0; z-index: 40;/);
  assert.match(tablet, /\.hl-filters__x \{ display: inline-flex; \}/);
  assert.match(tablet, /\.hl-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); gap: 12px; \}/);
});

await test('390: the bar stacks, two columns, list cards at 130px', () => {
  const css = read('src/styles/homeliving.css');
  const phone = css.slice(css.indexOf('@media (max-width: 599px)'), css.indexOf('@media (prefers-reduced-motion'));
  assert.match(phone, /\.hl-listing__bar \{ grid-template-columns: minmax\(0, 1fr\); grid-template-rows: auto auto auto; \}/);
  assert.match(phone, /\.hl-listing__tools \{ grid-column: 1; grid-row: 3; justify-content: space-between; flex-wrap: wrap; gap: 8px; \}/);
  assert.match(phone, /\.hl-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 12px; \}/);
  assert.match(phone, /\.hl-card--list \{ grid-template-columns: 130px minmax\(0, 1fr\); \}/);
  const all = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const sel of [...all.matchAll(/(^|\n|\}|\{)\s*([^@{}\n][^{}]*?)\s*\{/g)].map((m) => m[2].trim()).filter(Boolean)) for (const part of sel.split(',')) assert.match(part.trim(), /^\.hl(\b|-)/, `"${part.trim()}" is namespaced`);
});

// ============================================================
console.log('\n— Wiring and isolation —');
// ============================================================

await test('App.jsx: category/:slug is a child of the Home & Living route; the other storefronts, cart, checkout, coupons, auth, payments and shared build files are byte-identical to the baseline', () => {
  const src = read('src/App.jsx');
  assert.match(src, /<Route path="\/homeliving" element=\{<HomeLivingLayout \/>\}>\n\s+<Route index element=\{<HomeLivingHome \/>\} \/>\n\s+<Route path="category\/:slug" element=\{<HomeLivingCategory \/>\} \/>\n(\s+<Route path="[^"]+" element=\{<HomeLiving[A-Za-z]+ \/>\} \/>\n)*\s+<\/Route>/);
  // Later phases add their own child routes (p/:slug — test-homeliving-pdp.mjs); strip those before comparing.
  const before = atCommit(BASELINE_SHA, 'src/App.jsx');
  const mine = src.replace("import HomeLivingCategory from './homeliving/HomeLivingCategory.jsx';\n", '').replace('        <Route path="category/:slug" element={<HomeLivingCategory />} />\n', '')
    .replace(/import HomeLiving(?!Layout|Home|Category)[A-Za-z]+ from '\.\/homeliving\/HomeLiving[A-Za-z]+\.jsx';\n/g, '').replace(/        <Route path="(?!category\/)[^"]+" element=\{<HomeLiving[A-Za-z]+ \/>\} \/>\n/g, '')
    .replace(/import Lifestyle[A-Za-z]+ from '\.\/lifestyle\/Lifestyle[A-Za-z]+\.jsx';\n/g, '').replace(/\n\s*\{\/\*[^*]*lifestyle[^*]*\*\/\}\n\s+<Route path="\/lifestyle" element=\{<LifestyleLayout \/>\}>\n\s+<Route index element=\{<LifestyleHome \/>\} \/>\n\s+<\/Route>\n/, '\n');
  assert.equal(mine, before, 'App.jsx: the import and the route, nothing else');
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // The homepage store doorway (FashionBanner.jsx + fashion-banner.css) was redesigned in 71eb538 — an approved wellness change.
  // The lifestyle storefront (test-lifestyle.mjs) — an approved change: its own files, the route, the sheet, one switcher link per shell; and the doorway images (test-store-doorway.mjs).
  const allowed = /^(src\/homeliving\/|src\/lib\/homeliving[A-Za-z]*\.js$|src\/pages\/Home\.jsx$|src\/lifestyle\/|src\/data\/lifestyleHomepage\.js$|src\/styles\/lifestyle\.css$|img\/lifestyle-|img\/doorway-|build\/build-css\.mjs$|src\/lib\/deferredStyles\.js$|src\/components\/Header\.jsx$|src\/fashion\/FashionLayout\.jsx$|src\/grocery\/GroceryLayout\.jsx$|src\/data\/homelivingHomepage\.js$|src\/styles\/homeliving\.css$|src\/App\.jsx$|src\/components\/FashionBanner\.jsx$|src\/styles\/fashion-banner\.css$|scripts\/|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  for (const rel of ['src/lib/store.jsx', 'src/lib/cartLine.js', 'src/lib/couponApi.js', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'api/_lib/pricing.js', 'api/razorpay/create-order.js', 'src/components/Header.jsx', 'src/fashion/FashionLayout.jsx', 'src/fashion/FashionListing.jsx', 'src/lib/fashion.js', 'src/grocery/GroceryLayout.jsx', 'src/data/groceryHomepage.js', 'src/homeliving/HomeLivingLayout.jsx', 'src/homeliving/HomeLivingHome.jsx', 'build/build-css.mjs', 'src/lib/deferredStyles.js']) {
    // The lifestyle storefront (test-lifestyle.mjs) added one line about /lifestyle to each shell and the two build files; nothing else.
    const sansLifestyle = (t) => t.split('\n').filter((l) => !/\/lifestyle\b|lifestyle\.css|Lifestyle store/.test(l)).join('\n').replace('|lifestyle)', ')');
    assert.equal(sansLifestyle(read(rel)), sansLifestyle(atCommit(BASELINE_SHA, rel)), `${rel} is byte-identical to ${BASELINE_SHA} but for its lifestyle line`);
  }
  assert.ok(!changed.has('supabase/migrations/0036_') && ![...changed].some((f) => /^supabase\//.test(f)), 'no migration');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
