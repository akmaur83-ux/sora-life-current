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
//
// The fashion departments followed: /fashion/men and /fashion/women
// (FashionDepartment.jsx and departmentContent.js; test-fashion-departments.mjs
// owns them) and the chooser the default Fashion doorways open
// (FashionEntryLink.jsx). `sansFashionDepartments` undoes exactly what that
// change did to six shared files, the same way. `sansStorefrontChanges` applies
// both, newest first; the suites call that one, so the next approved change is
// added here, once.
//
// Approved cart changes are undone the same way by `sansCartChanges`, first
// in the chain since they are the newest: the hunks are the change itself,
// so a cart or payment file that passes through and equals its baseline
// proves nothing else in it moved.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DEFAULT_FASHION_STOREFRONT as F, DEFAULT_LIFESTYLE_STOREFRONT as L } from '../src/lib/storefrontCustomization.js';

/**
 * The admin pages and libs 99b67ba added or touched: no storefront renders them.
 * The catalogue admin work (2026-10-06) adds admin-only modules beside them —
 * the WebP converter, the CSV import planner and the claim warnings — owned by
 * the test-store-catalogue-*.mjs suites, which also pin that no storefront
 * file imports any of them.
 */
export const STOREFRONT_ADMIN_FILES = /^(src\/admin\/AdminLayout\.jsx|src\/admin\/admin\.css|src\/admin\/pages\/(Storefronts|StoreCatalogue)\.jsx|src\/lib\/storefrontCustomization\.js|src\/lib\/storeCatalogue(Admin|AdminApi|Image|Csv)\.js|src\/lib\/claimWarnings\.js)$/;

/** Deploy configuration, not storefront code: f927077 keeps the local QA folders and reports out of every deployment. */
export const DEPLOY_CONFIG_FILES = /^\.vercelignore$/;

/** The storefront files that now read the setting — each undone by sansStorefrontSettings. */
export const STOREFRONT_SETTINGS_READS = /^(src\/App\.jsx|src\/fashion\/(FashionHome|FashionLayout)\.jsx|src\/lifestyle\/(LifestyleHome|LifestyleLayout)\.jsx|src\/data\/lifestyleHomepage\.js)$/;

/** The files the fashion departments added: the two pages, the chooser, their sheets and the editorial artwork. */
export const FASHION_DEPARTMENT_FILES = /^(src\/fashion\/(FashionDepartment\.jsx|departmentContent\.js)|src\/components\/FashionEntryLink\.jsx|src\/styles\/fashion-(choice|departments)\.css|img\/fashion-editorial\/[a-z0-9-]+\.webp)$/;

/** The shared files the departments edited — each undone by sansFashionDepartments. */
export const FASHION_DEPARTMENT_EDITS = /^(src\/App\.jsx|src\/fashion\/(FashionHome|FashionLayout)\.jsx|src\/lifestyle\/LifestyleHome\.jsx|src\/components\/FashionBanner\.jsx|build\/build-css\.mjs)$/;

/**
 * The shared cart and payment files an approved cart change edited — each undone
 * by sansCartChanges. A suite may allow one in its changed-file list only where
 * it also byte-checks that file through sansStorefrontChanges.
 */
export const CART_CHANGE_EDITS = /^(src\/lib\/(store\.jsx|payments\.js|couponApi\.js|homelivingPdp\.js)|api\/_lib\/(pricing|supabaseAdmin|couponQuote)\.js|api\/razorpay\/(create-order|verify|webhook)\.js|src\/admin\/pages\/Orders\.jsx|src\/homeliving\/HomeLivingProduct(Card|Page)\.jsx|src\/data\/homelivingHomepage\.js|src\/components\/CartCoupons\.jsx|src\/pages\/Checkout\.jsx)$/;

/**
 * Order holds (money-path fix 6+3; test-order-holds.mjs owns them): what an order holds and for how
 * long (api/_lib/orderHolds.js), the suite, the recorded patch, and migration 0039 with its rollback.
 */
export const ORDER_HOLDS_FILES = /^(api\/_lib\/orderHolds\.js|scripts\/test-order-holds\.mjs|scripts\/pins\/order-holds\.patch|supabase\/migrations\/(0039_order_holds\.sql|rollback\/0039_order_holds_down\.sql))$/;

/**
 * Order confirmation (money-path fix 5+7+11; test-order-confirmation.mjs owns them): the admin route
 * that records a COD order's cash as collected, the suite and the recorded patch.
 */
export const ORDER_CONFIRMATION_FILES = /^(api\/admin\/mark-cod-collected\.js|scripts\/test-order-confirmation\.mjs|scripts\/pins\/order-confirmation\.patch)$/;

/** The files the Home & Living cart added: its cart line module, and the suite and undo patch that pin it. */
export const HOMELIVING_CART_FILES = /^(src\/lib\/homelivingCartLine\.js|scripts\/test-homeliving-cart\.mjs|scripts\/pins\/homeliving-cart\.patch)$/;

/** Scroll on navigation, site-wide: its own files (the manager, its rules, its suite and its undo patch). */
export const SCROLL_MANAGER_FILES = /^(src\/components\/ScrollManager\.jsx|src\/lib\/scrollOnNavigate\.js|scripts\/test-scroll-on-navigate\.mjs|scripts\/pins\/scroll-manager\.patch)$/;

/** The fashion PDP's thumbnail fix — undone by sansCartChanges (scripts/pins/fashion-pdp-thumbs.patch). */
export const FASHION_PDP_THUMBS_EDITS = /^src\/fashion\/FashionProductPage\.jsx$/;

/** The shared fashion card shows no rating row until a product has reviews — undone by sansCartChanges (scripts/pins/fashion-rating-row.patch). */
export const FASHION_RATING_ROW_EDITS = /^src\/fashion\/FashionProductCard\.jsx$/;

/** The homepage banner's own sheet: the full-bleed banner and the fashion category strip (test-store-doorway.mjs pins it). */
export const FASHION_BANNER_SHEET = /^src\/styles\/fashion-banner\.css$/;

/** The white/orange top of the wellness homepage: its component and its photographs (test-home-storefront.mjs owns them). */
export const HOME_STOREFRONT_FILES = /^(src\/components\/HomeStorefront\.jsx|img\/home-[a-z0-9-]+\.webp|scripts\/pins\/home-storefront\.patch)$/;

/** The homepage's own two files it edited — each undone by sansCartChanges (scripts/pins/home-storefront.patch). */
export const HOME_STOREFRONT_EDITS = /^(src\/pages\/Home\.jsx|src\/styles\/v2-home\.css)$/;

// The jewellery page at /fashion/jewellery (test-fashion-jewellery.mjs owns it): its own files, and
// the shared ones it edits through its recorded undo (the route, its header and shell class, the
// women's page link, its .jw rules appended to the departments' sheet).
export const JEWELLERY_FILES = /^(src\/fashion\/(FashionJewellery\.jsx|jewelleryContent\.js)|scripts\/pins\/fashion-jewellery\.patch|scripts\/test-fashion-jewellery\.mjs)$/;
export const JEWELLERY_EDITS = /^(src\/App\.jsx|src\/fashion\/(FashionLayout|FashionDepartment)\.jsx|src\/fashion\/departmentContent\.js|src\/styles\/fashion-departments\.css)$/;

/** The shared files it edited — main.jsx (the mount) and Layout.jsx (the old reset removed), each undone by sansCartChanges. */
export const SCROLL_MANAGER_EDITS = /^(src\/main\.jsx|src\/components\/Layout\.jsx)$/;

/** Migration 0036 (catalogue declarations), applied by the owner on 2026-10-12: the schema file and its rollback, nothing else under supabase/. */
export const CATALOGUE_DECLARATION_MIGRATION = /^supabase\/migrations\/(0036_catalogue_declarations\.sql|rollback\/0036_catalogue_declarations_down\.sql)$/;

/** Product information and consumer care (test-product-declarations.mjs owns them): the section, its read, its rules, the consumer-care hook and the recorded patch. */
export const PRODUCT_INFORMATION_FILES = /^(src\/components\/ProductInformation\.jsx|src\/lib\/(productDeclarations|productDeclarationsApi|consumerCare)\.js|scripts\/test-product-declarations\.mjs|scripts\/pins\/product-information\.patch)$/;
/** The shared files it edited — the two product pages (the section after Details), the footer (consumer care) and its sheet — each undone by sansCartChanges (scripts/pins/product-information.patch). */
export const PRODUCT_INFORMATION_EDITS = /^(src\/fashion\/FashionProductPage\.jsx|src\/homeliving\/HomeLivingProductPage\.jsx|src\/components\/Footer\.jsx|src\/styles\/info\.css)$/;

/**
 * The retired admin controls (52d3d12): the Hero Slides page and the carousel it fed, the hero buttons'
 * styling, the category strip — DELETED, nothing read them. Admitted only while each stays deleted.
 */
export const RETIRED_CONTROL_FILES = /^(src\/admin\/pages\/HeroSlides\.jsx|src\/admin\/components\/HeroCtaAppearanceControls\.jsx|src\/lib\/heroCtaAppearance\.js|src\/components\/(Hero|HeroCta|HomeCategoryStrip)\.jsx|scripts\/test-hero-cta-appearance\.mjs)$/;
/**
 * The shared files the retirement edited that these suites had not admitted before — each byte-checked
 * through sansCartChanges (scripts/pins/retire-dead-controls.patch) where it is admitted. The patch also
 * undoes its edits to App.jsx, main.jsx, settings.js and AdminLayout.jsx, admitted already by older pins.
 */
export const RETIRED_CONTROL_EDITS = /^(src\/lib\/(adminApi|theme|homepageAppearance)\.js|src\/admin\/pages\/(Dashboard|Homepage|Appearance)\.jsx|src\/admin\/components\/HomepageVisualControls\.jsx)$/;
/** A changed path the retirement accounts for: a retired file that is gone, the recorded patch, or one of its edits. */
export const retiredControl = (f) => (RETIRED_CONTROL_FILES.test(f) && !existsSync(new URL(`../${f}`, import.meta.url)))
  || f === 'scripts/pins/retire-dead-controls.patch' || RETIRED_CONTROL_EDITS.test(f);

/**
 * Publish-time storefront content (8c993ca; test-storefront-publish.mjs owns it): the content rules and
 * the admin's save and publish calls, the build step, the publish endpoint, migrations 0037 and 0038
 * with their rollbacks, the suite and the recorded patch.
 */
export const STOREFRONT_CONTENT_FILES = /^(src\/lib\/storefrontContent(Api)?\.js|build\/publish-content\.mjs|api\/admin\/publish-storefront\.js|scripts\/test-storefront-publish\.mjs|scripts\/pins\/storefront-content\.patch)$/;
/** Its migrations — the drafts and published records (0037) and hero_slides dropped (0038) — with their rollbacks; nothing else under supabase/. */
export const STOREFRONT_CONTENT_MIGRATION = /^supabase\/migrations\/((0037_storefront_content|0038_drop_hero_slides)\.sql|rollback\/(0037_storefront_content|0038_drop_hero_slides)_down\.sql)$/;
/**
 * The shared files it edited that these suites had not admitted before — the ignore list, the page's marker and
 * the build command — each byte-checked through sansCartChanges (scripts/pins/storefront-content.patch) where
 * it is admitted. The patch also undoes its edits to main.jsx, settings.js, adminApi.js and the admin files,
 * admitted already by older pins.
 */
export const STOREFRONT_CONTENT_EDITS = /^(\.gitignore|index\.html|vercel\.json)$/;
/**
 * The dead homepage code cleared beside it (4e72220, 34b4300): the unused category rail, the retired hero's
 * stylesheet, the old hero media, two unused hero photographs, the script that checked that poster and the one that
 * captured the old hero — DELETED, admitted only while each stays deleted.
 */
export const DEAD_HOMEPAGE_FILES = /^(src\/components\/CategoryRail\.jsx|src\/styles\/hero-cta\.css|media\/hero(-poster(-1024|-1600)?|-slide2)?\.(mp4|jpg|webp)|media\/home-hero-(juice|seedoil)\.jpg|scripts\/(verify-picture|capture-home)\.mjs)$/;
/** The sheets it pruned and the CSS build list — each byte-checked through sansCartChanges (scripts/pins/dead-homepage-code.patch). */
export const DEAD_HOMEPAGE_EDITS = /^(build\/build-css\.mjs|src\/styles\/(components|home|homepage-appearance|layout|storefront-motion|storefront-refinements|v2-home-marketplace|v2-home)\.css)$/;
/** The two components that still pointed at the retired hero (34b4300) — each byte-checked through sansCartChanges (scripts/pins/retired-hero-pointers.patch). */
export const RETIRED_HERO_POINTER_EDITS = /^src\/components\/(StorefrontMotion|ProductImage)\.jsx$/;
/**
 * The editable storefront sections (88629a2; test-storefront-sections.mjs owns them): the page-side reading, the
 * admin's section editor and its registry, the sheet for position presets and matched colours, the render dump,
 * the suite and the recorded patch.
 */
export const STOREFRONT_SECTIONS_FILES = /^(src\/lib\/storefrontSections\.js|src\/styles\/storefront-sections\.css|src\/admin\/components\/StorefrontSectionEditor\.jsx|src\/admin\/storefrontSections\.js|scripts\/(storefront-sections-dump|test-storefront-sections)\.mjs|scripts\/pins\/((storefront|wellness)-sections|men-shop-tiles)\.patch)$/;
/**
 * The shared files it edited — each section reading its published content over its built-in content — each
 * byte-checked through sansCartChanges (scripts/pins/storefront-sections.patch) where it is admitted.
 */
export const STOREFRONT_SECTIONS_EDITS = /^(build\/build-css\.mjs|src\/admin\/(AdminLayout\.jsx|admin\.css|pages\/Storefronts\.jsx)|src\/components\/(FashionBanner|HomeStorefront)\.jsx|src\/data\/(grocery|homeliving)Homepage\.js|src\/fashion\/(FashionDepartment|FashionHome|FashionJewellery|FashionLayout)\.jsx|src\/fashion\/(department|jewellery)Content\.js|src\/grocery\/GroceryHome\.jsx|src\/homeliving\/HomeLivingHome\.jsx|src\/lib\/settings\.js)$/;

/** A changed path these changes account for: an own file or migration, a deleted file that is gone, a recorded patch, or one of their edits. */
export const storefrontContentChange = (f) => STOREFRONT_CONTENT_FILES.test(f) || STOREFRONT_CONTENT_MIGRATION.test(f) || STOREFRONT_CONTENT_EDITS.test(f)
  || (DEAD_HOMEPAGE_FILES.test(f) && !existsSync(new URL(`../${f}`, import.meta.url)))
  || f === 'scripts/pins/dead-homepage-code.patch' || DEAD_HOMEPAGE_EDITS.test(f)
  || f === 'scripts/pins/retired-hero-pointers.patch' || RETIRED_HERO_POINTER_EDITS.test(f)
  || STOREFRONT_SECTIONS_FILES.test(f) || STOREFRONT_SECTIONS_EDITS.test(f);

/** The site menu's closed panel casts no shadow (layout.css, one line) — undone by sansCartChanges (scripts/pins/drawer-shadow.patch). */
export const DRAWER_SHADOW_EDITS = /^src\/styles\/layout\.css$/;

/** Rendered /fashion: the Men and Women tiles open their department pages instead of the category listings. */
export const sansDepartmentTiles = (html) => html.replace(/<a class="fs-tile" href="\/fashion\/(men|women)">/g, '<a class="fs-tile" href="/fashion/c/$1">');

/** Rendered fashion shell: the delivery strip's true wording (2026-10-11) back to the speed claim it replaced. */
export const sansStripCopy = (html) => html.replaceAll('Delivery in 6–7 business days</span>', 'Fast &amp; reliable delivery</span>');

const q = (s) => { assert.ok(!/['\\\n]/.test(s), `default needs escaping: ${s}`); return `'${s}'`; };
const pair = (a, b) => `[${q(a)}, ${q(b)}]`;
const lines = (indent, entries) => entries.map(([k, v]) => `${indent}${k}: ${v},\n`).join('');

const swap = (rel, text, now, then) => {
  const n = text.split(now).length - 1;
  assert.equal(n, 1, `${rel}: expected the approved hunk exactly once, found ${n}: ${now.slice(0, 80)}`);
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

// Removes one block that starts with `start` (exactly once) and runs to the first `end` after it.
const cut = (rel, text, start, end) => {
  const n = text.split(start).length - 1;
  assert.equal(n, 1, `${rel}: expected the approved block exactly once, found ${n}: ${start.slice(0, 80)}`);
  const from = text.indexOf(start), to = text.indexOf(end, from);
  assert.ok(to > from, `${rel}: the approved block is not closed`);
  return text.slice(0, from) + text.slice(to + end.length);
};

const UNDO_DEPARTMENTS = {
  'src/App.jsx': (t, r) => {
    t = swap(r, t, "import FashionDepartment from './fashion/FashionDepartment.jsx';\n", '');
    return swap(r, t, '        <Route path="men" element={<FashionDepartment key="men" department="men" />} />\n        <Route path="women" element={<FashionDepartment key="women" department="women" />} />\n', '');
  },

  'src/fashion/FashionHome.jsx': (t, r) =>
    swap(r, t, "<Link key={c.id} to={['men', 'women'].includes(c.slug) ? `/fashion/${c.slug}` : categoryHref(c)} className=\"fs-tile\">", '<Link key={c.id} to={categoryHref(c)} className="fs-tile">'),

  'src/fashion/FashionLayout.jsx': (t, r) => {
    // The saree page's own header, returned early on /fashion/women; every other route keeps .fs-hdr.
    t = cut(r, t, '  if (/^\\/fashion\\/women\\/?$/.test(location.pathname)) return (\n    <header className="sw-header">\n', '\n    </header>\n  );\n');
    return swap(r, t, "<div className={`fs${/^\\/fashion\\/(men|women)\\/?$/.test(pathname) ? ' fs--department' : ''}${/^\\/fashion\\/women\\/?$/.test(pathname) ? ' fs--saree' : ''}`}>", '<div className="fs">');
  },

  'src/lifestyle/LifestyleHome.jsx': (t, r) => {
    t = swap(r, t, "import FashionEntryLink from '../components/FashionEntryLink.jsx';\n", '');
    t = swap(r, t, '<FashionEntryLink to={s.href} className="ls-cta" tabIndex={i === index ? 0 : -1}>{s.cta} <Icon name="arrowRight" size={17} /></FashionEntryLink>',
      '<Link to={s.href} className="ls-cta" tabIndex={i === index ? 0 : -1}>{s.cta} <Icon name="arrowRight" size={17} /></Link>');
    t = swap(r, t, '<FashionEntryLink to={b.href} className="ls-banner" aria-labelledby="ls-banner-h ls-banner-cta">', '<Link to={b.href} className="ls-banner" aria-labelledby="ls-banner-h ls-banner-cta">');
    return swap(r, t, '      </FashionEntryLink>\n', '      </Link>\n');
  },

  'src/components/FashionBanner.jsx': (t, r) => {
    t = swap(r, t, "import FashionEntryLink from './FashionEntryLink.jsx';\n", '');
    t = swap(r, t, "  const Entry = store.key === 'fashion' ? FashionEntryLink : Link;\n", '');
    t = swap(r, t, '    <Entry to={store.to} className=', '    <Link to={store.to} className=');
    return swap(r, t, '    </Entry>\n', '    </Link>\n');
  },

  'build/build-css.mjs': (t, r) => {
    t = swap(r, t, "  'src/styles/fashion-banner.css',\n  'src/styles/fashion-choice.css',\n", "  'src/styles/fashion-banner.css',\n");
    return swap(r, t, "  'src/styles/fashion.css',\n  'src/styles/fashion-departments.css',\n", "  'src/styles/fashion.css',\n");
  },
};

/** The file as it stood before the fashion departments, LF-normalised; anything outside the six comes back as given. */
export function sansFashionDepartments(rel, text) {
  const undo = UNDO_DEPARTMENTS[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text;
}

// ---- Approved cart changes, newest first ------------------------------------------
// Each entry undoes one commit's hunks in the shared cart and payment files.

/**
 * A recorded change, read back from its own `git diff -a -U3` (scripts/pins/):
 * each hunk's new side (context and + lines) is swapped for its old side
 * (context and - lines), exactly once per file, so the patch can only undo
 * the text it was recorded from.
 */
function undoFromPatch(name) {
  const text = readFileSync(new URL(`./pins/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const files = {}; let rel = null; let hunk = null;
  const flush = () => { if (hunk && rel) (files[rel] ||= []).push([hunk.now.join('\n'), hunk.then.join('\n')]); hunk = null; };
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) { flush(); rel = null; continue; }
    if (line.startsWith('+++ ')) { rel = line.slice(4).replace(/^b\//, ''); continue; }
    if (line.startsWith('@@')) { flush(); hunk = { now: [], then: [] }; continue; }
    if (!hunk || line === '' || line.startsWith('\\')) continue;
    if (line[0] === ' ') { hunk.now.push(line.slice(1)); hunk.then.push(line.slice(1)); }
    else if (line[0] === '+') hunk.now.push(line.slice(1));
    else if (line[0] === '-') hunk.then.push(line.slice(1));
  }
  flush();
  return Object.fromEntries(Object.entries(files).map(([r, hunks]) => [r, (t, rr) => hunks.reduce((acc, [now, then]) => swap(rr, acc, now, then), t)]));
}

// The women's page: /fashion/women became the main women's page and the saree store moved to
// /fashion/women/sarees as it was. Its own code is the departments' (FashionDepartment.jsx,
// departmentContent.js, fashion-departments.css, test-fashion-departments.mjs owns them); in the
// two shared files it added a route and the page's header and shell class, all undone here.
const UNDO_WOMEN_PAGE = undoFromPatch('fashion-women-page.patch');

// The jewellery page: a route and its header and shell class (App.jsx, FashionLayout.jsx), the
// women's page link (FashionDepartment.jsx, departmentContent.js) and its .jw rules appended to
// fashion-departments.css. Undone here, newest first.
const UNDO_JEWELLERY = undoFromPatch('fashion-jewellery.patch');

// Order numbers: a CSPRNG suffix in generateOrderNumber (pricing.js), and create-order
// retrying an insert once with a fresh number when the order_number unique index rejects
// it. A payment change in the same shared files. Undone here, newest first.
const UNDO_ORDER_NUMBER = undoFromPatch('order-number.patch');

// The site menu (Header.jsx's .drawer) parks its panel off-screen when closed, and the panel's
// 48px shadow showed down the left edge of every page: one line in layout.css drops it while
// closed. Undone here, newest first.
const UNDO_DRAWER_SHADOW = undoFromPatch('drawer-shadow.patch');

// Two fashion fixes: the shell's delivery strip says "Delivery in 6–7 business days" where it
// claimed "Fast & reliable delivery" (FashionLayout.jsx), and the saree hero takes its height from the width
// (fashion-departments.css) — its min-height with aspect-ratio forced it 1317px wide. Undone here, newest first.
const UNDO_FASHION_STRIP_SAREE = undoFromPatch('fashion-strip-saree.patch');

// No rating row until a product has reviews: the shared fashion card and the fashion product page showed
// "0.0 ☆☆☆☆☆ (0)" for every unreviewed product (FashionProductCard.jsx, FashionProductPage.jsx), and the
// card keeps its image square without the row (fashion.css, align-content). Undone here, newest first.
const UNDO_FASHION_RATING_ROW = undoFromPatch('fashion-rating-row.patch');

// Product information: the fashion and Home & Living product pages show what a listing declares
// (migration 0036) after Details, and the shared footer shows the consumer-care contact on every
// store (Footer.jsx, its .ftr__care rules in info.css). The section and its read are new files
// (test-product-declarations.mjs owns them). Undone here, newest first.
const UNDO_PRODUCT_INFORMATION = undoFromPatch('product-information.patch');

// The retired admin controls: the Hero Slides route, menu entry and dashboard links (App.jsx,
// AdminLayout.jsx, Dashboard.jsx), its page-load fetch (main.jsx, adminApi.js, settings.js), the
// Bestsellers fields and category-strip visuals (Homepage.jsx, homepageAppearance.js,
// HomepageVisualControls.jsx) and the theme's Homepage group (theme.js, Appearance.jsx).
// Undone here, newest first.
const UNDO_RETIRED_CONTROLS = undoFromPatch('retire-dead-controls.patch');

// Publish-time storefront content: the page's marker (index.html), the build command (vercel.json), the
// published images kept out of git (.gitignore), the page-load read and the draft preview (settings.js,
// main.jsx, adminApi.js) and the admin's per-store editor (Storefronts.jsx, admin.css,
// storefrontCustomization.js, storeCatalogueAdminApi.js). Undone here, newest first.
const UNDO_STOREFRONT_CONTENT = undoFromPatch('storefront-content.patch');

// The dead homepage code: every rule that named only a class no page renders (the v2 hero carousel, the
// category rail, the hero CTA, the category strip, the old Bestsellers block) and hero-cta.css in the CSS
// build list. Undone here, newest first.
const UNDO_DEAD_HOMEPAGE_CODE = undoFromPatch('dead-homepage-code.patch');

// The last pointers at the retired hero: the reveal selectors and entrance timing for .v2-hero and
// .hm-category-head (StorefrontMotion.jsx) and the unused frame="hero" branch (ProductImage.jsx).
// Undone here, newest first.
const UNDO_RETIRED_HERO_POINTERS = undoFromPatch('retired-hero-pointers.patch');

// The editable storefront sections: each of the eight pages' sections reads its published content over
// the built-in content beside it (the components, departmentContent.js, jewelleryContent.js, the two
// homepage data files), the snapshot of every store's content (settings.js), the editor on the admin's
// Storefronts page and its menu entry, and the new sheet in the CSS build list. Undone here, newest first.
const UNDO_STOREFRONT_SECTIONS = undoFromPatch('storefront-sections.patch');

// The four wellness sections that followed (edbff93): the trust strip, the store tiles, the store circles and
// the festive promo read their published content too (HomeStorefront.jsx). Undone here, newest first.
const UNDO_WELLNESS_SECTIONS = undoFromPatch('wellness-sections.patch');

// The men's five category photographs (7673aa5): their tiles in the fashion category strip under the
// Lifestyle banner (FashionBanner.jsx). Undone here, newest first.
const UNDO_MEN_SHOP_TILES = undoFromPatch('men-shop-tiles.patch');

// One idempotency key per submission (money-path fix 1+2): Checkout.jsx keys the exact request it
// sends (keyForSubmission, payments.js) and create-order refuses a key replayed with a different
// request. A payment change in the shared files. Undone here, newest first.
const UNDO_CHECKOUT_REPLAY = undoFromPatch('checkout-replay.patch');

// Order holds (money-path fix 6+3, migration 0039): create-order holds or takes stock and the coupon
// use, verify and the webhook settle or release them, the browser names the key it replaces and
// gives Razorpay its time limit, the admin sees what a late payment could not be given. Undone here,
// newest first.
const UNDO_ORDER_HOLDS = undoFromPatch('order-holds.patch');

// Order confirmation (money-path fix 5+7+11): the admin records a COD order's cash as collected
// (Orders page + adminApi.js), a paid order is never replayed as payable (create-order), and Checkout
// shows the server's amount and tells the truth after payment. Undone here, newest first.
const UNDO_ORDER_CONFIRMATION = undoFromPatch('order-confirmation.patch');

// The homepage banner restyled to the women's page (full-bleed, square-edged) with the fashion
// category strip beneath it, both in FashionBanner.jsx (test-store-doorway.mjs owns them); the
// store carousel in the same file is unchanged. Undone here, newest first.
const UNDO_BANNER_STRIP = undoFromPatch('fashion-banner-strip.patch');

// The white/orange top of the wellness homepage: five sections in Home.jsx in place of the hero
// and the category strip, and their .hx rules appended to v2-home.css (test-home-storefront.mjs
// owns them; everything else in both files is as it was). Undone here, newest first.
const UNDO_HOME_STOREFRONT = undoFromPatch('home-storefront.patch');

// The fashion PDP's thumbnails: the same fix as Home & Living's — buttons that scroll only the
// gallery track (and Gallery exported so its suite can mount it). A shared fashion file.
const UNDO_FASHION_PDP_THUMBS = undoFromPatch('fashion-pdp-thumbs.patch');

// The Home & Living PDP's thumbnails: buttons that scroll only the gallery track, where
// #hl-slide-N links also jumped the page and added history. The same shared file.
const UNDO_PDP_THUMBS = undoFromPatch('homeliving-pdp-thumbs.patch');

// Scroll on navigation: one ScrollManager mounted in main.jsx replaced the wellness shell's
// own ScrollToTop in Layout.jsx. Not a cart change either; the same exact-undo mechanism.
const UNDO_SCROLL_MANAGER = undoFromPatch('scroll-manager.patch');

// The Home & Living PDP's gallery opens full screen (tap to open, pinch to zoom,
// swipe between images, tap or swipe down to close): GalleryZoom and the button
// around each gallery image. Not a cart change, but the same shared file.
const UNDO_PDP_ZOOM = undoFromPatch('homeliving-pdp-zoom.patch');

// The Home & Living PDP's delivery line: "Other delivery options are chosen at
// checkout" has been false since Express and Scheduled were withdrawn (2fa4ed2).
const UNDO_DELIVERY_COPY = undoFromPatch('homeliving-delivery-copy.patch');

// The Cart page's coupon offers carry the catalogue: without it a fashion or Home &
// Living line was priced as wellness and the whole offers list came back empty.
const UNDO_COUPON_OFFERS = undoFromPatch('coupon-offers.patch');

// The Home & Living cart: its namespace in store.jsx, the server pricing it from
// the catalogue tables, the marker on the wire, and Add to cart on its PDP and card.
const UNDO_HOMELIVING_CART = undoFromPatch('homeliving-cart.patch');

// The grocery size label: addGroceryToCart read product.pack, which no
// catalogue row has, so every grocery line was stored with variant: null.
const UNDO_GROCERY_LABEL = {
  'src/lib/store.jsx': (t, r) => swap(r, t, [
    '  // The grocery add path. Takes a catalogue_products row (store \'grocery\');',
    '  // the line carries the id only, and the size label is display text. No',
    '  // stock gate yet — the line is blocked at checkout regardless',
    '  // (groceryCartLine.js), so nothing here can be bought.',
    '  const addGroceryToCart = useCallback((product, qty = 1) => {',
    '    if (!product?.id) return false;',
    '    // A catalogue row carries net_content, never `pack`, so every grocery line',
    '    // was stored with variant: null since the catalogue migration (0034).',
    '    // hydrateGroceryCartLine falls back to the row\'s net_content, which is why',
    '    // the cart still showed the size.',
    '    dispatch({ type: \'ADD\', catalogue: GROCERY_CATALOGUE, id: String(product.id), qty, variant: product.net_content || null, variantId: null });',
  ].join('\n'), [
    '  // The grocery add path. Takes a product from the grocery data',
    '  // (src/data/groceryHomepage.js); the line carries the id only, and the',
    '  // pack label is display text. No stock gate yet — there is no grocery',
    '  // stock to check until the catalogue migration lands, and the line is',
    '  // blocked at checkout until then (groceryCartLine.js).',
    '  const addGroceryToCart = useCallback((product, qty = 1) => {',
    '    if (!product?.id) return false;',
    '    dispatch({ type: \'ADD\', catalogue: GROCERY_CATALOGUE, id: String(product.id), qty, variant: product.pack || null, variantId: null });',
  ].join('\n')),
};

const CART_CHANGES = [UNDO_ORDER_CONFIRMATION, UNDO_ORDER_HOLDS, UNDO_CHECKOUT_REPLAY, UNDO_MEN_SHOP_TILES, UNDO_WELLNESS_SECTIONS, UNDO_STOREFRONT_SECTIONS, UNDO_RETIRED_HERO_POINTERS, UNDO_DEAD_HOMEPAGE_CODE, UNDO_STOREFRONT_CONTENT, UNDO_RETIRED_CONTROLS, UNDO_PRODUCT_INFORMATION, UNDO_FASHION_RATING_ROW, UNDO_FASHION_STRIP_SAREE, UNDO_DRAWER_SHADOW, UNDO_ORDER_NUMBER, UNDO_JEWELLERY, UNDO_HOME_STOREFRONT, UNDO_BANNER_STRIP, UNDO_WOMEN_PAGE, UNDO_FASHION_PDP_THUMBS, UNDO_PDP_THUMBS, UNDO_SCROLL_MANAGER, UNDO_PDP_ZOOM, UNDO_DELIVERY_COPY, UNDO_COUPON_OFFERS, UNDO_HOMELIVING_CART, UNDO_GROCERY_LABEL];

/**
 * The Home & Living cart undone on its own — for a suite that owns an OLDER cart
 * change (test-grocery owns the size label) and must see that change, not its undo.
 */
export function sansHomeLivingCart(rel, text) {
  const undo = UNDO_HOMELIVING_CART[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text;
}

/**
 * The two fashion fixes (strip copy, saree hero height) undone on their own — for a suite that checks an
 * older change's own patch (test-fashion-jewellery) and must undo the newer one first.
 */
export function sansFashionStripSaree(rel, text) {
  const undo = UNDO_FASHION_STRIP_SAREE[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text;
}

/**
 * The order-number change undone on its own — for a suite whose payment-file pin
 * predates only that change (test-store-catalogue-tax-grocery pins 7c05e7d).
 */
export function sansOrderNumber(rel, text) {
  const undo = UNDO_ORDER_NUMBER[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text;
}

/**
 * The checkout-replay, order-holds and order-confirmation changes undone on their own, newest first — for
 * that same suite, whose pin predates them too: undo these first, then sansOrderNumber.
 */
export function sansCheckoutReplay(rel, text) {
  const undos = [UNDO_ORDER_CONFIRMATION[rel], UNDO_ORDER_HOLDS[rel], UNDO_CHECKOUT_REPLAY[rel]].filter(Boolean);
  return undos.length ? undos.reduce((t, undo) => undo(t, rel), text.replace(/\r\n/g, '\n')) : text;
}

/**
 * The retired-controls change undone on its own — for a suite that checks an older change's own
 * patch (test-fashion-jewellery) and must undo this newer one first.
 */
export function sansRetiredControls(rel, text) {
  const undo = UNDO_RETIRED_CONTROLS[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text;
}

/**
 * The dead-homepage-code change undone on its own — for a suite that compares the start of v2-home.css
 * with its baseline (test-home-storefront) and must undo this newer change first.
 */
export function sansDeadHomepageCode(rel, text) {
  const undo = UNDO_DEAD_HOMEPAGE_CODE[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text.replace(/\r\n/g, '\n');
}

/**
 * The editable-sections change undone on its own — for a suite that checks an older change's own patch
 * (test-fashion-jewellery) and must undo this newer one first.
 */
export function sansStorefrontSections(rel, text) {
  const undos = [UNDO_MEN_SHOP_TILES[rel], UNDO_WELLNESS_SECTIONS[rel], UNDO_STOREFRONT_SECTIONS[rel]].filter(Boolean);
  return undos.length ? undos.reduce((t, undo) => undo(t, rel), text.replace(/\r\n/g, '\n')) : text;
}

/** The file as it stood before the approved cart changes, LF-normalised; anything they did not touch comes back as given. */
export function sansCartChanges(rel, text) {
  const undos = CART_CHANGES.map((c) => c[rel]).filter(Boolean);
  if (!undos.length) return text;
  return undos.reduce((t, undo) => undo(t, rel), text.replace(/\r\n/g, '\n'));
}

/** Every approved change above undone, newest first: what the older pins compare. */
export const sansStorefrontChanges = (rel, text) => sansStorefrontSettings(rel, sansFashionDepartments(rel, sansCartChanges(rel, text)));
