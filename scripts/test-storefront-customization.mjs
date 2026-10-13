import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFashionApp } from './fashion-ssr.mjs';
import { buildLifestyleApp } from './lifestyle-ssr.mjs';
import {
  DEFAULT_FASHION_STOREFRONT,
  DEFAULT_LIFESTYLE_STOREFRONT,
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

await test('the storefront reads saved values leniently: a value that does not fit falls back to its default, never breaks the page', () => {
  const fashion = normalizeFashionStorefront({ header: { tagline: '  Custom Fashion  ' }, hero: { ctaLink: 'https://evil.example', image: 'javascript:alert(1)' } });
  const lifestyle = normalizeLifestyleStorefront({ heroSlides: [{ headlineOne: 'Custom Home', ctaLink: '//evil.example' }], promo: { ctaLink: '/homeliving/sale' } });
  assert.equal(fashion.header.tagline, 'Custom Fashion');
  assert.equal(fashion.hero.ctaLink, DEFAULT_FASHION_STOREFRONT.hero.ctaLink);
  assert.equal(fashion.hero.image, DEFAULT_FASHION_STOREFRONT.hero.image);
  assert.equal(lifestyle.heroSlides[0].headlineOne, 'Custom Home');
  assert.equal(lifestyle.heroSlides[0].ctaLink, DEFAULT_LIFESTYLE_STOREFRONT.heroSlides[0].ctaLink);
  assert.equal(lifestyle.promo.ctaLink, '/homeliving/sale');
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

await test('the protected admin editor is routed and navigable, saves version-checked drafts, previews them, publishes them, and converts every upload', () => {
  const app = read('src/App.jsx');
  const nav = read('src/admin/AdminLayout.jsx');
  const page = read('src/admin/pages/Storefronts.jsx');
  assert.match(app, /const Storefronts = lazy\(\(\) => import\('\.\/admin\/pages\/Storefronts\.jsx'\)\);/);
  assert.match(app, /<Route path="storefronts" element=\{<Storefronts \/>\} \/>/);
  assert.match(nav, /to: '\/admin\/storefronts', label: 'Fashion & Lifestyle'/);
  assert.match(page, /await adminLoadStorefronts\(\)/);
  assert.match(page, /validateStorefrontContent\(tab, forms\[tab\]\)/, 'every field is checked before a save');
  assert.match(page, /await adminSaveStorefrontDraft\(tab, forms\[tab\], draft\.version\)/, 'saved against the version it opened');
  assert.match(page, /await publishStorefront\(tab, draft\.version\)/, 'publishes the saved draft it names');
  assert.match(page, /STORES\[tab\]\.path\}\?preview=draft/, 'the preview link opens the store with ?preview=draft');
  assert.match(page, /await uploadStorefrontImage\(file\)/, 'uploads go through the WebP converter');
  assert.doesNotMatch(page, /uploadHomepageImage|adminSetSetting\('homepage'|announceHomepageSaved/, 'nothing is written to the shared homepage record');
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`\n${passed} tests passed.`);
