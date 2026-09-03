import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productBrandName, selectHomeMerchandising, selectMarketplaceHeroProducts } from '../src/lib/homeMerchandising.js';

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };
const product = (id, category, extra = {}) => ({
  id, slug: `product-${id}`, name: `Product ${id}`, category, categories: [category],
  stock: 10, sortOrder: id, price: 100 + id, priceVerified: true, ...extra,
});
const categories = [
  { slug: 'wellness', name: 'Wellness' },
  { slug: 'skin-care', name: 'Skin Care' },
  { slug: 'mom-trust', name: 'Mom Trust' },
];
const catalogue = [
  product(1, 'wellness', { isFeatured: true, permalink: 'https://biosash.com/product/a' }),
  product(2, 'skin-care', { isFeatured: true, isNew: true, brand: 'Real Label' }),
  product(3, 'mom-trust', { name: 'Mom Trust Daily Care', isNew: true }),
  product(4, 'wellness', { isBestseller: true }),
  product(5, 'skin-care', { isBestseller: true }),
  product(6, 'mom-trust', { isBestseller: true }),
  product(7, 'wellness', { isBestseller: true }),
  product(8, 'skin-care', { discountPct: 10, onSale: true }),
  product(9, 'mom-trust'),
  product(10, 'wellness'),
];

check('all merchandising products come from the input catalogue', () => {
  const selected = selectHomeMerchandising(catalogue, categories);
  const ids = new Set(catalogue.map((item) => item.id));
  for (const list of [selected.trending, selected.discover, selected.popular, selected.momProducts]) {
    for (const item of list) assert.ok(ids.has(item.id));
  }
});

check('inactive and out-of-stock products never enter Homepage sections', () => {
  const selected = selectHomeMerchandising([
    ...catalogue,
    product(11, 'wellness', { stock: 0, isFeatured: true }),
    product(12, 'wellness', { isActive: false, isNew: true }),
  ], categories);
  assert.ok(!selected.available.some((item) => item.id === 11 || item.id === 12));
});

check('Bestsellers wording requires four genuinely flagged products', () => {
  assert.equal(selectHomeMerchandising(catalogue, categories).popularTitle, 'Bestsellers');
  assert.equal(selectHomeMerchandising(catalogue.filter((item) => item.id !== 7), categories).popularTitle, 'Worth discovering');
});

check('Discover links to the new filter only when real new flags exist', () => {
  assert.equal(selectHomeMerchandising(catalogue, categories).discoverLink, '/shop?filter=new');
  assert.equal(selectHomeMerchandising(catalogue.map((item) => ({ ...item, isNew: false })), categories).discoverLink, '/shop');
});

check('brands require explicit catalogue or source evidence', () => {
  assert.equal(productBrandName(catalogue[0]), 'Biosash');
  assert.equal(productBrandName(catalogue[1]), 'Real Label');
  assert.equal(productBrandName(catalogue[2]), 'Mom Trust');
  assert.equal(productBrandName(product(30, 'wellness')), '');
});

check('Mom Trust spotlight is driven by real matching products', () => {
  const selected = selectHomeMerchandising(catalogue, categories);
  assert.equal(selected.momCategory.slug, 'mom-trust');
  assert.deepEqual(selected.momProducts.map((item) => item.id), [3, 6, 9]);
});

check('curated collections use only real category routes and products', () => {
  const selected = selectHomeMerchandising(catalogue, categories);
  assert.deepEqual(selected.collections.map((item) => item.category.slug), categories.map((item) => item.slug));
  assert.ok(selected.collections.every((item) => item.products.length > 0));
});

check('fallback hero uses real imaged products across catalogue categories', () => {
  const hero = selectMarketplaceHeroProducts(catalogue.map((item) => ({ ...item, image: `/img/${item.id}.png` })), 5);
  assert.equal(hero.length, 5);
  assert.ok(hero.every((item) => catalogue.some((source) => source.id === item.id)));
  assert.ok(new Set(hero.map((item) => item.category)).size >= 3);
});

check('fallback hero excludes missing-image, inactive and out-of-stock products', () => {
  const hero = selectMarketplaceHeroProducts([
    product(40, 'wellness', { image: '/img/40.png' }),
    product(41, 'skin-care', { image: null }),
    product(42, 'mom-trust', { image: '/img/42.png', stock: 0 }),
    product(43, 'skin-care', { image: '/img/43.png', isActive: false }),
  ], 6);
  assert.deepEqual(hero.map((item) => item.id), [40]);
});

check('Homepage has no placeholder links or fabricated social proof', () => {
  const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  const sections = readFileSync(new URL('../src/components/HomeMarketplace.jsx', import.meta.url), 'utf8');
  const hero = readFileSync(new URL('../src/components/Hero.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(`${home}\n${sections}\n${hero}`, /href=["']#|customers served|five[- ]star|guaranteed delivery|HERO_PRODUCT_SLUG|SAFE_HERO_COPY/i);
  assert.match(hero, /if \(!heroSlidesConfigured\) return <MarketplaceHero \/>/);
  assert.match(hero, /const DISPLAY_SLIDES = SLIDES/);
  assert.doesNotMatch(hero, /withSafeHeroCopy/);
  for (const id of ['brands', 'discover', 'mom-trust', 'collections', 'creator', 'why-sora-life']) {
    assert.match(sections, new RegExp(`data-home-section=["']${id}["']`));
  }
  assert.match(home, /MarketplaceProductRail id="trending"/);
  assert.match(home, /id="popular"/);
});

check('the default announcement stays marketplace-neutral', () => {
  // The built-in notices ship whenever an admin has not configured their own.
  // A single-brand line there contradicts the marketplace positioning the rest
  // of the homepage is built on, so the default must not name one label.
  const settings = readFileSync(new URL('../src/lib/settings.js', import.meta.url), 'utf8');
  const notices = settings.slice(settings.indexOf('export let announcement'), settings.indexOf('export let homepage'));
  assert.doesNotMatch(notices, /biosash/i, 'no single-brand takeover in the default announcement');
  assert.match(notices, /applyAnnouncement/, 'the admin override must stay documented and intact');
  assert.ok((notices.match(/'[^']+',/g) || []).length >= 2, 'rotation keeps more than one notice');
});

console.log(`\n${passed} passed, 0 failed`);
