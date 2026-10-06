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
import { readFileSync } from 'node:fs';
import { DEFAULT_FASHION_STOREFRONT as F, DEFAULT_LIFESTYLE_STOREFRONT as L } from '../src/lib/storefrontCustomization.js';

/** The admin pages and libs 99b67ba added or touched: no storefront renders them. */
export const STOREFRONT_ADMIN_FILES = /^(src\/admin\/AdminLayout\.jsx|src\/admin\/admin\.css|src\/admin\/pages\/(Storefronts|StoreCatalogue)\.jsx|src\/lib\/storefrontCustomization\.js|src\/lib\/storeCatalogueAdmin(Api)?\.js)$/;

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
export const CART_CHANGE_EDITS = /^(src\/lib\/(store\.jsx|payments\.js|couponApi\.js|homelivingPdp\.js)|api\/_lib\/(pricing|supabaseAdmin|couponQuote)\.js|api\/razorpay\/create-order\.js|src\/homeliving\/HomeLivingProduct(Card|Page)\.jsx|src\/data\/homelivingHomepage\.js|src\/components\/CartCoupons\.jsx)$/;

/** The files the Home & Living cart added: its cart line module, and the suite and undo patch that pin it. */
export const HOMELIVING_CART_FILES = /^(src\/lib\/homelivingCartLine\.js|scripts\/test-homeliving-cart\.mjs|scripts\/pins\/homeliving-cart\.patch)$/;

/** Rendered /fashion: the Men and Women tiles open their department pages instead of the category listings. */
export const sansDepartmentTiles = (html) => html.replace(/<a class="fs-tile" href="\/fashion\/(men|women)">/g, '<a class="fs-tile" href="/fashion/c/$1">');

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

const CART_CHANGES = [UNDO_DELIVERY_COPY, UNDO_COUPON_OFFERS, UNDO_HOMELIVING_CART, UNDO_GROCERY_LABEL];

/**
 * The Home & Living cart undone on its own — for a suite that owns an OLDER cart
 * change (test-grocery owns the size label) and must see that change, not its undo.
 */
export function sansHomeLivingCart(rel, text) {
  const undo = UNDO_HOMELIVING_CART[rel];
  return undo ? undo(text.replace(/\r\n/g, '\n'), rel) : text;
}

/** The file as it stood before the approved cart changes, LF-normalised; anything they did not touch comes back as given. */
export function sansCartChanges(rel, text) {
  const undos = CART_CHANGES.map((c) => c[rel]).filter(Boolean);
  if (!undos.length) return text;
  return undos.reduce((t, undo) => undo(t, rel), text.replace(/\r\n/g, '\n'));
}

/** Every approved change above undone, newest first: what the older pins compare. */
export const sansStorefrontChanges = (rel, text) => sansStorefrontSettings(rel, sansFashionDepartments(rel, sansCartChanges(rel, text)));
