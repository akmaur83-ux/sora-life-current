import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFashionApp } from './fashion-ssr.mjs';
import { buildLifestyleApp } from './lifestyle-ssr.mjs';
import {
  DEFAULT_FASHION_STOREFRONT,
  DEFAULT_LIFESTYLE_STOREFRONT,
  mergeStorefrontCustomization,
  normalizeFashionStorefront,
  normalizeLifestyleStorefront,
} from '../src/lib/storefrontCustomization.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (error) { console.error(`  FAIL  ${name}\n        ${error.stack || error.message}`); process.exitCode = 1; }
}

console.log('\n— Fashion & Lifestyle admin customization —');

await test('built-in defaults preserve the current storefront content before an admin saves', () => {
  assert.deepEqual(normalizeFashionStorefront(), DEFAULT_FASHION_STOREFRONT);
  assert.deepEqual(normalizeLifestyleStorefront(), DEFAULT_LIFESTYLE_STOREFRONT);
  assert.equal(DEFAULT_FASHION_STOREFRONT.hero.image, '/img/fashion-hero.webp');
  assert.equal(DEFAULT_LIFESTYLE_STOREFRONT.heroSlides.length, 3);
  assert.equal(DEFAULT_LIFESTYLE_STOREFRONT.heroSlides[0].wide, '/img/doorway-living-wide.webp');
});

await test('saved values are sanitized, internal CTA routes stay internal and unknown homepage settings survive', () => {
  const next = mergeStorefrontCustomization(
    { bestseller_title: 'Keep me', visuals: { offers: { enabled: true } }, unknown_future_key: 17 },
    { header: { tagline: '  Custom Fashion  ' }, hero: { ctaLink: 'https://evil.example', image: 'javascript:alert(1)' } },
    { heroSlides: [{ headlineOne: 'Custom Home', ctaLink: '//evil.example' }], promo: { ctaLink: '/homeliving/sale' } },
  );
  assert.equal(next.bestseller_title, 'Keep me');
  assert.deepEqual(next.visuals, { offers: { enabled: true } });
  assert.equal(next.unknown_future_key, 17);
  assert.equal(next.fashion_storefront.header.tagline, 'Custom Fashion');
  assert.equal(next.fashion_storefront.hero.ctaLink, DEFAULT_FASHION_STOREFRONT.hero.ctaLink);
  assert.equal(next.fashion_storefront.hero.image, DEFAULT_FASHION_STOREFRONT.hero.image);
  assert.equal(next.lifestyle_storefront.heroSlides[0].headlineOne, 'Custom Home');
  assert.equal(next.lifestyle_storefront.heroSlides[0].ctaLink, DEFAULT_LIFESTYLE_STOREFRONT.heroSlides[0].ctaLink);
  assert.equal(next.lifestyle_storefront.promo.ctaLink, '/homeliving/sale');
});

await test('Fashion renders saved header, hero and section copy without changing its catalogue', async () => {
  const fashion = normalizeFashionStorefront({
    header: { tagline: 'Admin Fashion', searchPlaceholder: 'Find an outfit' },
    hero: { title: 'Styled in Admin', ctaLabel: 'Browse looks', ctaLink: '/fashion/search' },
    sections: { categoriesTitle: 'Admin Categories', brandsTitle: 'Admin Brands', productsTitle: 'Admin Products' },
  });
  const app = await buildFashionApp({ homepage: { fashion_storefront: fashion } });
  const html = app.render('/fashion');
  for (const copy of ['Admin Fashion', 'Find an outfit', 'Styled in Admin', 'Browse looks', 'Admin Categories', 'Admin Brands', 'Admin Products']) assert.ok(html.includes(copy), copy);
  assert.match(html, /href="\/fashion\/search">Browse looks/);
  assert.ok(html.includes('Meadow Linen Shirt'), 'catalogue still renders');
});

await test('Lifestyle renders saved header, slide, banner, headings and promo', async () => {
  const lifestyle = normalizeLifestyleStorefront({
    header: { tagline: 'Admin Lifestyle' },
    heroSlides: [{ headlineOne: 'Admin Home', ctaLabel: 'Enter home' }],
    fashionBanner: { headlineOne: 'Admin Doorway', ctaLabel: 'Enter fashion' },
    sections: { fashionCategoriesTitle: 'Admin Fashion Categories', trendingTitle: 'Admin Trending' },
    promo: { headline: 'Admin Promo', ctaLabel: 'See promo' },
  });
  const app = await buildLifestyleApp({ homepage: { lifestyle_storefront: lifestyle } });
  const html = app.render('/lifestyle');
  for (const copy of ['Admin Lifestyle', 'Admin Home', 'Enter home', 'Admin Doorway', 'Enter fashion', 'Admin Fashion Categories', 'Admin Trending', 'Admin Promo', 'See promo']) assert.ok(html.includes(copy), copy);
  assert.ok(html.includes('Botanical Bedsheet'), 'combined catalogue still renders');
});

await test('the protected admin editor is routed, navigable, image-enabled and saves through the existing homepage setting', () => {
  const app = read('src/App.jsx');
  const nav = read('src/admin/AdminLayout.jsx');
  const page = read('src/admin/pages/Storefronts.jsx');
  assert.match(app, /const Storefronts = lazy\(\(\) => import\('\.\/admin\/pages\/Storefronts\.jsx'\)\);/);
  assert.match(app, /<Route path="storefronts" element=\{<Storefronts \/>\} \/>/);
  assert.match(nav, /to: '\/admin\/storefronts', label: 'Fashion & Lifestyle'/);
  assert.match(page, /adminGetSetting\('homepage'\)/);
  assert.match(page, /adminSetSetting\('homepage', next\)/);
  assert.match(page, /mergeStorefrontCustomization\(current, fashion, lifestyle\)/);
  assert.match(page, /uploadHomepageImage\(file\)/);
  assert.match(page, /announceHomepageSaved\(next\)/);
  assert.match(page, /href="\/fashion"[\s\S]*href="\/lifestyle"/);
  assert.doesNotMatch(page, /adminSetSetting\('(fashion|lifestyle)/, 'no new top-level public setting/RLS requirement');
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`\n${passed} tests passed.`);
