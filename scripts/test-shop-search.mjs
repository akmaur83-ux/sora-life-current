import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyCatalog, products, searchProducts } from '../src/data/products.js';
import {
  PRICE_BANDS, normalizedShopSort, productMatchesHighlight,
  productMatchesPriceBand, readShopUrlState, updateShopUrlState,
} from '../src/lib/shopFilters.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const slugs = (query) => searchProducts(query).map((product) => product.slug).sort();
const browserSource = fs.readFileSync(new URL('../src/components/ProductBrowser.jsx', import.meta.url), 'utf8');
const headerSource = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const shopCss = fs.readFileSync(new URL('../src/styles/v2-shop.css', import.meta.url), 'utf8');

applyCatalog([
  { id: 'p1', slug: 'moms-trust-shampoo', name: 'Mom’s Trust Herbal Shampoo', category: 'hair-care', form: '200ml', originalPrice: 300, isNew: true },
  { id: 'p2', slug: 'moms-trust-face-wash', name: "Mom's Trust Face Wash", category: 'skin-care', form: '100 ml', originalPrice: 450 },
  { id: 'p3', slug: 'avocado-shampoo', name: 'Avocado Shampoo', category: 'hair-care', form: '100ml', originalPrice: 175 },
  { id: 'p4', slug: 'vitamin-c-serum', name: 'Vitamin C Serum', category: 'skin-care', form: '30ml', originalPrice: 1200, discountPercent: 10 },
  { id: 'p5', slug: 'daily-capsules', name: 'Daily Capsules', category: 'supplements', form: '60 Capsules', originalPrice: 900 },
  { id: 'p6', slug: 'sea-buckthorn-juice', name: 'Sea Buckthorn Juice', category: 'juices-drinks', form: '250ml', originalPrice: 500 },
  { id: 'p7', slug: 'clay-face-pack', name: 'Clay Face Pack', category: 'skin-care', form: '50g', originalPrice: 499 },
], 'test');

check('apostrophe variants produce identical Mom’s Trust results', () => {
  assert.deepEqual(slugs("Mom's Trust"), slugs('Mom’s Trust'));
  assert.deepEqual(slugs("Mom's Trust"), slugs('Moms Trust'));
  assert.ok(slugs('Moms Trust').length > 0);
});

check('skin care separator variants produce identical category results', () => {
  assert.deepEqual(slugs('skincare'), slugs('skin care'));
  assert.deepEqual(slugs('skincare'), slugs('skin-care'));
  assert.ok(slugs('skincare').length > 0);
});

check('exact, partial, uppercase and padded searches remain supported', () => {
  assert.ok(slugs('Avocado Shampoo').includes('avocado-shampoo'));
  assert.deepEqual(slugs('shampoo'), slugs('SHAMPOO'));
  assert.deepEqual(slugs('shampoo'), slugs('   shampoo   '));
  assert.deepEqual(slugs('shampoo'), slugs('(shampoo)!!!'));
  assert.ok(slugs('sea buckthorn').includes('sea-buckthorn-juice'));
  assert.ok(slugs('face wash').includes('moms-trust-face-wash'));
});

check('nonsense, punctuation-only and form-only noise return no broad matches', () => {
  assert.deepEqual(slugs('zzzz-no-such-product-zzzz'), []);
  assert.deepEqual(slugs('ml'), []);
  assert.deepEqual(slugs('50g'), []);
  assert.deepEqual(slugs('%'), []);
  assert.deepEqual(slugs('&'), []);
});

check('highlight semantics use normalized product fields and real sale state', () => {
  assert.equal(productMatchesHighlight({ isNew: true }, 'new'), true);
  assert.equal(productMatchesHighlight({ isNew: false, flags: ['new'] }, 'new'), false);
  assert.equal(productMatchesHighlight({ isBestseller: true }, 'bestseller'), true);
  assert.equal(productMatchesHighlight({ isBestseller: false, flags: ['bestseller'] }, 'bestseller'), false);
  assert.equal(productMatchesHighlight({ discountPct: 15 }, 'sale'), true);
  assert.equal(productMatchesHighlight({ onSale: true, discountPct: 0 }, 'sale'), true);
  assert.equal(productMatchesHighlight({ onSale: false, discountPct: 0 }, 'sale'), false);
});

check('legacy bestseller URLs remain valid without exposing unsupported UI', () => {
  const state = readShopUrlState('?filter=bestseller', []);
  assert.deepEqual(state.highlights, ['bestseller']);
  assert.equal(products.filter((product) => state.highlights.every((flag) => productMatchesHighlight(product, flag))).length, 0);
  assert.match(browserSource, /productMatchesHighlight\(p, flag\)/);
  assert.doesNotMatch(browserSource, />Bestsellers</);
  assert.doesNotMatch(browserSource, /Best selling|Top rated|4\.5\+/);
  assert.doesNotMatch(headerSource, /shop\?sort=bestselling/);
});

check('default sorting keeps the old ordering under a truthful label', () => {
  assert.equal(normalizedShopSort('featured'), 'recommended');
  assert.equal(normalizedShopSort('bestselling'), 'recommended');
  assert.match(browserSource, /SHOP_SORTS/);
});

check('URL state rehydrates supported filters and rejects invalid values', () => {
  const state = readShopUrlState(
    '?q=serum&sort=price-desc&category=skin-care,nope&filter=new,sale,nope&stock=1&price=1000-1999',
    ['skin-care', 'hair-care'],
  );
  assert.deepEqual(state, {
    q: 'serum', sort: 'price-desc', categories: ['skin-care'],
    highlights: ['new', 'sale'], inStock: true, priceBand: '1000-1999',
  });
});

check('q, sort, filters and discovery parameters coexist', () => {
  const start = new URLSearchParams('collection=daily&q=oil&sort=price-asc');
  const next = updateShopUrlState(start, {
    categories: ['hair-care'], highlights: ['new'], inStock: true, priceBand: '500-999',
  });
  assert.equal(next.get('collection'), 'daily');
  assert.equal(next.get('q'), 'oil');
  assert.equal(next.get('sort'), 'price-asc');
  assert.equal(next.get('category'), 'hair-care');
  assert.equal(next.get('filter'), 'new');
  assert.equal(next.get('stock'), '1');
  assert.equal(next.get('price'), '500-999');
});

check('Clear All removes only filter parameters', () => {
  const start = new URLSearchParams('concern=hair&q=oil&sort=new&category=hair-care&filter=sale&stock=1&price=under-500');
  const next = updateShopUrlState(start, {
    categories: [], highlights: [], inStock: false, priceBand: null,
  });
  assert.equal(next.toString(), 'concern=hair&q=oil&sort=new');
});

check('price bands cover all non-negative prices exactly once', () => {
  for (let price = 0; price <= 50000; price += 1) {
    const matches = PRICE_BANDS.filter((band) => productMatchesPriceBand({ price }, band.id));
    assert.equal(matches.length, 1, `expected one price band for ${price}`);
  }
  for (const price of [499, 500, 999, 1000, 1999, 2000, 4999, 5000]) {
    const matches = PRICE_BANDS.filter((band) => productMatchesPriceBand({ price }, band.id));
    assert.equal(matches.length, 1, `boundary ${price} belongs to exactly one band`);
  }
  assert.equal(productMatchesPriceBand({ price: 36000 }, '5000-plus'), true);
  assert.equal(productMatchesPriceBand({ price: 40500 }, '5000-plus'), true);
});

check('Shop/category routes, semantic headings and responsive grids remain present', () => {
  assert.match(appSource, /path="\/shop"/);
  assert.match(appSource, /path="\/category\/:slug"/);
  assert.match(browserSource, /<h2>Filters<\/h2>/);
  assert.match(browserSource, /<h2>Nothing matched<\/h2>/);
  assert.match(shopCss, /\.v2-check\s*\{[\s\S]*?min-height:44px/);
  assert.match(shopCss, /\.v2-fd__foot \.v2-btn \{ min-height:44px; \}/);
  assert.match(shopCss, /grid-template-columns:1fr 1fr/);
  assert.match(shopCss, /grid-template-columns:repeat\(3, 1fr\)/);
  assert.match(shopCss, /grid-template-columns:repeat\(4, 1fr\)/);
});

console.log(`\n${passed} Shop/search regression tests passed.`);
