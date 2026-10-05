// ============================================================
// 99b67ba made the Fashion and Lifestyle storefront copy editable from the
// admin: src/lib/storefrontCustomization.js holds the defaults, the public
// `homepage` setting holds what an admin saves, and six storefront files now
// read it. test-storefront-customization.mjs and test-store-catalogue-admin.mjs
// own that feature; this module lets the older isolation pins keep comparing
// those six files byte for byte.
//
// `sansStorefrontSettings(rel, text)` puts back every hunk 99b67ba made to the
// file, with each default it now reads resolved to the literal it replaced —
// the literals are built FROM the defaults, not copied. So a file that passes
// through it and equals its baseline proves two things: nothing but the
// settings read changed, and the defaults are the old wording. Each hunk must
// match exactly once; any other edit in those spots fails here, loudly.
// Files outside the six pass through untouched.
// ============================================================
import assert from 'node:assert/strict';
import { DEFAULT_FASHION_STOREFRONT as F, DEFAULT_LIFESTYLE_STOREFRONT as L } from '../src/lib/storefrontCustomization.js';

/** The admin pages and libs 99b67ba added or touched: no storefront renders them. */
export const STOREFRONT_ADMIN_FILES = /^(src\/admin\/AdminLayout\.jsx|src\/admin\/admin\.css|src\/admin\/pages\/(Storefronts|StoreCatalogue)\.jsx|src\/lib\/storefrontCustomization\.js|src\/lib\/storeCatalogueAdmin(Api)?\.js)$/;

/** The storefront files that now read the setting — each undone by sansStorefrontSettings. */
export const STOREFRONT_SETTINGS_READS = /^(src\/App\.jsx|src\/fashion\/(FashionHome|FashionLayout)\.jsx|src\/lifestyle\/(LifestyleHome|LifestyleLayout)\.jsx|src\/data\/lifestyleHomepage\.js)$/;

const q = (s) => { assert.ok(!/['\\\n]/.test(s), `default needs escaping: ${s}`); return `'${s}'`; };
const pair = (a, b) => `[${q(a)}, ${q(b)}]`;
const lines = (indent, entries) => entries.map(([k, v]) => `${indent}${k}: ${v},\n`).join('');

const swap = (rel, text, now, then) => {
  const n = text.split(now).length - 1;
  assert.equal(n, 1, `${rel}: expected the 99b67ba hunk exactly once, found ${n}: ${now.slice(0, 80)}`);
  return text.replace(now, () => then);
};
const swapAll = (rel, text, re, then, count) => {
  const n = (text.match(re) || []).length;
  assert.equal(n, count, `${rel}: expected ${count} of ${re}, found ${n}`);
  return text.replace(re, then);
};

const HOMEPAGE_READ = (key, normalize) =>
  `  const homepage = useSyncExternalStore(subscribeHomepage, getHomepageSnapshot, getHomepageSnapshot);\n  const config = ${normalize}(homepage.${key});\n`;

const UNDO = {
  'src/App.jsx': (t, r) => {
    t = swap(r, t, "const Storefronts = lazy(() => import('./admin/pages/Storefronts.jsx'));\nconst StoreCatalogue = lazy(() => import('./admin/pages/StoreCatalogue.jsx'));\n", '');
    return swap(r, t, '        <Route path="storefronts" element={<Storefronts />} />\n        <Route path="store-catalogue/:store/:productId?" element={<StoreCatalogue />} />\n', '');
  },

  'src/fashion/FashionHome.jsx': (t, r) => {
    const s = F.sections;
    t = swap(r, t, "import { useSyncExternalStore } from 'react';\n", '');
    t = swap(r, t, "import { getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';\nimport { DEFAULT_FASHION_STOREFRONT, normalizeFashionStorefront } from '../lib/storefrontCustomization.js';\n", '');
    t = swap(r, t,
      'export const HERO = {\n  ...DEFAULT_FASHION_STOREFRONT.hero,\n  sub: DEFAULT_FASHION_STOREFRONT.hero.subtitle,\n  cta: DEFAULT_FASHION_STOREFRONT.hero.ctaLabel,\n  href: DEFAULT_FASHION_STOREFRONT.hero.ctaLink,\n  image: HERO_IMAGE,\n};\n',
      `export const HERO = {\n${lines('  ', [['eyebrow', q(F.hero.eyebrow)], ['title', q(F.hero.title)], ['sub', q(F.hero.subtitle)], ['cta', q(F.hero.ctaLabel)], ['href', q(F.hero.ctaLink)], ['note', q(F.hero.note)]])}  image: HERO_IMAGE, // the supplied banner; null falls back to the typographic slot\n};\n`);
    t = swap(r, t, 'function Hero({ config }) {\n  const hero = config || HERO;\n', 'function Hero() {\n');
    t = swap(r, t, '{hero.subtitle || hero.sub}', '{HERO.sub}');
    t = swap(r, t, '{hero.ctaLink || hero.href}', '{HERO.href}');
    t = swap(r, t, '{hero.ctaLabel || hero.cta}', '{HERO.cta}');
    t = swapAll(r, t, /(?<![\w.])hero\./g, 'HERO.', 6);
    t = swap(r, t, 'function ShopByCategory({ tree, copy }) {', 'function ShopByCategory({ tree }) {');
    t = swap(r, t, '{copy.categoriesTitle}', s.categoriesTitle);
    t = swap(r, t, '{copy.categoriesCta} <Icon', `${s.categoriesCta} <Icon`);
    t = swap(r, t, 'function TopBrands({ views, copy }) {', 'function TopBrands({ views }) {');
    t = swap(r, t, '{copy.brandsTitle}', s.brandsTitle);
    t = swap(r, t, '{copy.brandsCta} <Icon', `${s.brandsCta} <Icon`);
    t = swap(r, t, HOMEPAGE_READ('fashion_storefront', 'normalizeFashionStorefront'), '');
    t = swap(r, t, '<Hero config={config.hero} />', '<Hero />');
    t = swap(r, t, '<ShopByCategory tree={tree} copy={config.sections} />', '<ShopByCategory tree={tree} />');
    t = swap(r, t, '<TopBrands views={views} copy={config.sections} />', '<TopBrands views={views} />');
    return swap(r, t, '{config.sections.productsTitle}', s.productsTitle);
  },

  'src/fashion/FashionLayout.jsx': (t, r) => {
    // The placeholder default must be the constant the header always fell back to.
    assert.ok(t.includes(`const SEARCH_PLACEHOLDER = ${q(F.header.searchPlaceholder)};`), `${r}: the search placeholder default is SEARCH_PLACEHOLDER`);
    t = swap(r, t, "import { useEffect, useState, useSyncExternalStore } from 'react';", "import { useEffect, useState } from 'react';");
    t = swap(r, t, "import { branding, getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';", "import { branding } from '../lib/settings.js';");
    t = swap(r, t, "import { normalizeFashionStorefront } from '../lib/storefrontCustomization.js';\n", '');
    t = swap(r, t, 'function FashionLogo({ tagline }) {', 'function FashionLogo() {');
    t = swap(r, t, '<em>{tagline}</em>', `<em>${F.header.tagline}</em>`);
    t = swap(r, t, HOMEPAGE_READ('fashion_storefront', 'normalizeFashionStorefront'), '');
    t = swap(r, t, '<FashionLogo tagline={config.header.tagline} />', '<FashionLogo />');
    return swap(r, t, 'placeholder={config.header.searchPlaceholder || SEARCH_PLACEHOLDER}', 'placeholder={SEARCH_PLACEHOLDER}');
  },

  'src/lifestyle/LifestyleLayout.jsx': (t, r) => {
    t = swap(r, t, "import { useEffect, useState, useSyncExternalStore } from 'react';", "import { useEffect, useState } from 'react';");
    t = swap(r, t, "import { branding, getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';\nimport { normalizeLifestyleStorefront } from '../lib/storefrontCustomization.js';\n", "import { branding } from '../lib/settings.js';\n");
    t = swap(r, t, 'function LifestyleLogo({ tagline = LIFESTYLE_TAGLINE }) {', 'function LifestyleLogo() {');
    t = swap(r, t, '<em>{tagline}</em>', '<em>{LIFESTYLE_TAGLINE}</em>');
    t = swap(r, t, HOMEPAGE_READ('lifestyle_storefront', 'normalizeLifestyleStorefront'), '');
    return swap(r, t, '<LifestyleLogo tagline={config.header.tagline} />', '<LifestyleLogo />');
  },

  'src/lifestyle/LifestyleHome.jsx': (t, r) => {
    t = swap(r, t, "import { useEffect, useRef, useState, useSyncExternalStore } from 'react';", "import { useEffect, useRef, useState } from 'react';");
    t = swap(r, t, "import { getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';\nimport { normalizeLifestyleStorefront } from '../lib/storefrontCustomization.js';\n", '');
    t = swap(r, t, 'function FashionBannerCard({ banner = FASHION_BANNER }) {\n  const b = banner;', 'function FashionBannerCard() {\n  const b = FASHION_BANNER;');
    t = swap(r, t, 'function FashionCircles({ categories, copy = FASHION_CATEGORIES }) {', 'function FashionCircles({ categories }) {');
    t = swap(r, t, 'id="ls-fashion-h">{copy.title}</h2>\n        <Link to={copy.viewAll} className="ls-sec__link">{copy.cta} <Icon',
      `id="ls-fashion-h">{FASHION_CATEGORIES.title}</h2>\n        <Link to={FASHION_CATEGORIES.viewAll} className="ls-sec__link">${L.sections.fashionCategoriesCta} <Icon`);
    t = swap(r, t, 'function TrendingRow({ products, status, copy = TRENDING }) {\n  const row = trendingOf(products, copy.limit);', 'function TrendingRow({ products, status }) {\n  const row = trendingOf(products, TRENDING.limit);');
    t = swap(r, t, 'id="ls-trending-h">{copy.title}</h2>\n        <Link to={copy.viewAll} className="ls-sec__link">{copy.cta} <Icon',
      `id="ls-trending-h">{TRENDING.title}</h2>\n        <Link to={TRENDING.viewAll} className="ls-sec__link">${L.sections.trendingCta} <Icon`);
    t = swap(r, t, 'function PromoStrip({ promo = PROMO }) {', 'function PromoStrip() {');
    t = swapAll(r, t, /\{promo\./g, '{PROMO.', 4);
    t = swap(r, t, HOMEPAGE_READ('lifestyle_storefront', 'normalizeLifestyleStorefront') + [
      '  const slides = config.heroSlides.map((slide) => ({',
      '    id: slide.id, tall: slide.tall, wide: slide.wide, alt: slide.alt,',
      '    eyebrow: [slide.eyebrowOne, slide.eyebrowTwo],',
      '    headline: [slide.headlineOne, slide.headlineTwo],',
      '    sub: slide.subtitle, cta: slide.ctaLabel, href: slide.ctaLink, note: slide.note,',
      '  }));',
      '  const banner = {',
      '    image: config.fashionBanner.image, alt: config.fashionBanner.alt,',
      '    eyebrow: [config.fashionBanner.eyebrowOne, config.fashionBanner.eyebrowTwo],',
      '    headline: [config.fashionBanner.headlineOne, config.fashionBanner.headlineTwo],',
      '    sub: config.fashionBanner.subtitle, cta: config.fashionBanner.ctaLabel,',
      '    href: config.fashionBanner.ctaLink, note: config.fashionBanner.note,',
      '  };',
      '  const fashionCopy = {',
      '    ...FASHION_CATEGORIES,',
      '    title: config.sections.fashionCategoriesTitle,',
      '    cta: config.sections.fashionCategoriesCta,',
      '  };',
      '  const trendingCopy = {',
      '    ...TRENDING,',
      '    title: config.sections.trendingTitle,',
      '    cta: config.sections.trendingCta,',
      '  };',
      '  const promo = {',
      '    image: config.promo.image, headline: config.promo.headline,',
      '    cta: config.promo.ctaLabel, href: config.promo.ctaLink,',
      '  };',
      '',
    ].join('\n'), '');
    t = swap(r, t, '<HeroCarousel slides={slides} />', '<HeroCarousel />');
    t = swap(r, t, '<FashionBannerCard banner={banner} />', '<FashionBannerCard />');
    t = swap(r, t, '<FashionCircles categories={fashionCategories} copy={fashionCopy} />', '<FashionCircles categories={fashionCategories} />');
    t = swap(r, t, '<TrendingRow products={products} status={status} copy={trendingCopy} />', '<TrendingRow products={products} status={status} />');
    return swap(r, t, '<PromoStrip promo={promo} />', '<PromoStrip />');
  },

  'src/data/lifestyleHomepage.js': (t, r) => {
    const card = (c) => [['eyebrow', pair(c.eyebrowOne, c.eyebrowTwo)], ['headline', pair(c.headlineOne, c.headlineTwo)], ['sub', q(c.subtitle)], ['cta', q(c.ctaLabel)], ['href', q(c.ctaLink)], ['note', q(c.note)]];
    const D = 'DEFAULT_LIFESTYLE_STOREFRONT';
    t = swap(r, t, `import { ${D} } from '../lib/storefrontCustomization.js';\n`, '');
    t = swap(r, t, `export const LIFESTYLE_TAGLINE = ${D}.header.tagline;`, `export const LIFESTYLE_TAGLINE = ${q(L.header.tagline)};`);
    t = swap(r, t, [
      `export const HERO_SLIDES = ${D}.heroSlides.map((slide) => ({`,
      '  id: slide.id, tall: slide.tall, wide: slide.wide, alt: slide.alt,',
      '  eyebrow: [slide.eyebrowOne, slide.eyebrowTwo],',
      '  headline: [slide.headlineOne, slide.headlineTwo],',
      '  sub: slide.subtitle, cta: slide.ctaLabel, href: slide.ctaLink, note: slide.note,',
      '}));',
    ].join('\n'), `export const HERO_SLIDES = [\n${L.heroSlides.map((s) => `  {\n${lines('    ', [['id', q(s.id)], ['tall', q(s.tall)], ['wide', q(s.wide)], ['alt', q(s.alt)], ...card(s)])}  },\n`).join('')}];`);
    const B = `${D}.fashionBanner`;
    t = swap(r, t, [
      'export const FASHION_BANNER = {',
      `  image: ${B}.image,`,
      `  alt: ${B}.alt,`,
      `  eyebrow: [${B}.eyebrowOne, ${B}.eyebrowTwo],`,
      `  headline: [${B}.headlineOne, ${B}.headlineTwo],`,
      `  sub: ${B}.subtitle,`,
      `  cta: ${B}.ctaLabel,`,
      `  href: ${B}.ctaLink,`,
      `  note: ${B}.note,`,
      '};',
    ].join('\n'), `export const FASHION_BANNER = {\n${lines('  ', [['image', q(L.fashionBanner.image)], ['alt', q(L.fashionBanner.alt)], ...card(L.fashionBanner)])}};`);
    t = swap(r, t, `export const FASHION_CATEGORIES = { title: ${D}.sections.fashionCategoriesTitle, cta: ${D}.sections.fashionCategoriesCta, viewAll: '/fashion' };`,
      `export const FASHION_CATEGORIES = { title: ${q(L.sections.fashionCategoriesTitle)}, viewAll: '/fashion' };`);
    t = swap(r, t, `export const TRENDING = { title: ${D}.sections.trendingTitle, cta: ${D}.sections.trendingCta, viewAll: '/homeliving', limit: 4 };`,
      `export const TRENDING = { title: ${q(L.sections.trendingTitle)}, viewAll: '/homeliving', limit: 4 };`);
    const P = `${D}.promo`;
    return swap(r, t, `export const PROMO = {\n  image: ${P}.image,\n  headline: ${P}.headline,\n  cta: ${P}.ctaLabel,\n  href: ${P}.ctaLink,\n};`,
      `export const PROMO = {\n${lines('  ', [['image', q(L.promo.image)], ['headline', q(L.promo.headline)], ['cta', q(L.promo.ctaLabel)], ['href', q(L.promo.ctaLink)]])}};`);
  },
};

/** The file as it stood before 99b67ba, LF-normalised; anything outside the six comes back as given. */
export function sansStorefrontSettings(rel, text) {
  const undo = UNDO[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text;
}
