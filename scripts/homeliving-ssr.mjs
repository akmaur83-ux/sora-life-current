// ============================================================
// Home & Living store — server-side render of the real shell and homepage,
// for the offline suite and the static review page. Same loader and stubs
// as scripts/grocery-ssr.mjs (imported from there); the catalogue is seeded
// with rows shaped like catalogue_categories / catalogue_products — the
// 0035 seed. NO NETWORK, NO DATABASE, NO BROWSER.
//
// GROCERY_SRC_ROOT points the loader at another checkout's source — the
// suite runs itself against the pre-change tree to prove it is not vacuous.
// ============================================================
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactRouter from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule, noSupabase } from './grocery-ssr.mjs';

export { ROOT, read, has, h, loadModule };

const cid = (n) => `00000000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`;
const pid = (n) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`;
const cat = (n, name, slug, tagline) => ({ id: cid(n), store: 'homeliving', parent_id: null, name, slug, tagline, image_url: `/img/homeliving-circle-${slug}.webp`, sort_order: n, is_active: true });
export const CATEGORIES = [
  cat(1, 'Bedsheets', 'bedsheets', 'Soft cotton for every bed'),
  cat(2, 'Curtains', 'curtains', 'Light, drape and privacy'),
  cat(3, 'Cushion Covers', 'cushion-covers', 'Small changes, warmer rooms'),
  cat(4, 'Quilts & Blankets', 'quilts-blankets', 'Layers for every season'),
  cat(5, 'Towels', 'towels', 'Thick, thirsty and soft'),
  cat(6, 'Rugs & Mats', 'rugs-mats', 'Underfoot, everyday'),
];
const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.id]));
const prod = (n, name, slug, catSlug, mrp, sale_price, image, sku, net_content, stock, extra = {}) => ({
  id: pid(n), store: 'homeliving', name, slug, brand: 'SORA LIFE', description: `${name}.`, category_id: byCat[catSlug],
  mrp, sale_price, discount_percent: Math.round(((mrp - sale_price) / mrp) * 100), images: [image], sku, hsn_code: null, gst_rate: null, net_content, stock,
  rating: 0, review_count: 0, is_active: true, is_new: false, is_bestseller: false, sort_order: n, is_demo: true, variants: [], media: [], ...extra,
});
/** The 0035 placeholders — no variants, as seeded. */
export const PRODUCTS = [
  prod(1, 'Botanical Bedsheet Set', 'botanical-bedsheet-set-king', 'bedsheets', 1899, 1499, '/img/homeliving-product-botanical-bedsheet-set.webp', 'SL-HL-BED-BOT-K', 'King · 1 bedsheet + 2 pillow covers', 40),
  prod(2, 'Leaf Cushion Cover Pair', 'leaf-cushion-cover-pair', 'cushion-covers', 699, 599, '/img/homeliving-product-leaf-cushion-cover-pair.webp', 'SL-HL-CUS-LEAF-2', 'Set of 2 · 40 × 40 cm', 60),
  prod(3, 'Cotton Quilt', 'cotton-quilt-single', 'quilts-blankets', 2399, 1999, '/img/homeliving-product-cotton-quilt.webp', 'SL-HL-QLT-COT-S', 'Single · 150 × 220 cm', 25),
  prod(4, 'Bath Towel Set', 'bath-towel-set-pack-of-2', 'towels', 949, 799, '/img/homeliving-product-bath-towel-set.webp', 'SL-HL-TWL-BATH-2', 'Pack of 2 · 70 × 140 cm', 50),
];
export const INITIAL = { categories: CATEGORIES, products: PRODUCTS };

/**
 * A richer catalogue for the LISTING suite: a second bedsheet with size ×
 * colour variants, a third brand, a bestseller and a rated product, and a
 * sub-category, so every facet, sort and scope rule has something to bite on.
 */
const vid = (n) => `00000000-0000-4000-8000-000000000a${String(n).padStart(2, '0')}`;
const v = (n, product_id, size, colour, colour_hex, stock, sort_order) => ({ id: vid(n), product_id, size, colour, colour_hex, sku: `V-${n}`, stock, price_override: null, is_active: true, sort_order });
export const LISTING_CATEGORIES = [...CATEGORIES, { id: cid(7), store: 'homeliving', parent_id: cid(1), name: 'Fitted Sheets', slug: 'fitted-sheets', tagline: '', image_url: null, sort_order: 1, is_active: true }, { id: cid(8), store: 'homeliving', parent_id: null, name: 'Retired', slug: 'retired', tagline: '', image_url: null, sort_order: 9, is_active: false }];
/** Media rows as catalogue_product_media returns them — deliberately out of order, the primary not first. */
const mid = (n) => `00000000-0000-4000-8000-000000000b${String(n).padStart(2, '0')}`;
const media = (n, public_url, alt_text, sort_order, is_primary) => ({ id: mid(n), public_url, alt_text, sort_order, is_primary });
const SHEET_MEDIA = [
  media(2, '/img/homeliving-circle-bedsheets.webp', 'Folded, showing the print', 1, false),
  media(3, '/img/homeliving-hero.webp', '', 2, false),
  media(1, '/img/homeliving-product-botanical-bedsheet-set.webp', 'Sage Fitted Sheet on a king bed', 0, true),
];
const SHEET_IMAGES = ['/img/homeliving-product-botanical-bedsheet-set.webp', '/img/homeliving-circle-bedsheets.webp', '/img/homeliving-hero.webp'];
export const LISTING_PRODUCTS = [
  ...PRODUCTS,
  prod(5, 'Sage Fitted Sheet', 'sage-fitted-sheet', 'bedsheets', 1299, 999, '/img/homeliving-product-botanical-bedsheet-set.webp', 'SL-HL-FIT-SAGE', 'Fitted sheet', 30, {
    category_id: cid(7), brand: 'Meadow Weave', is_bestseller: true, rating: 4.4, review_count: 31, images: SHEET_IMAGES, media: SHEET_MEDIA,
    variants: [v(1, pid(5), 'Single', 'Sage', '#8A9A6B', 6, 1), v(2, pid(5), 'King', 'Sage', '#8A9A6B', 0, 2), v(3, pid(5), 'King', 'Ivory', '#EDE6D6', 4, 3), v(4, pid(5), 'Queen', '', null, 2, 4)],
  }),
  prod(6, 'Jute Runner', 'jute-runner', 'rugs-mats', 1499, 1499, '/img/homeliving-product-cotton-quilt.webp', 'SL-HL-RUG-JUTE', '60 × 180 cm', 12, { brand: 'Loom & Co.', is_new: true, sale_price: null }),
];
export const LISTING = { categories: LISTING_CATEGORIES, products: LISTING_PRODUCTS };

/**
 * The catalogue for the PRODUCT PAGE suite: the fitted sheet with three
 * media rows (arriving out of order) and a size × colour matrix with one
 * pair out and one low; a towel sold by size alone with one size out and a
 * variant carrying its own price; a curtain pair with no variants and no
 * stock. Every product shape the page must handle.
 */
export const PDP_PRODUCTS = [
  ...PRODUCTS,
  prod(5, 'Sage Fitted Sheet', 'sage-fitted-sheet', 'bedsheets', 1299, 999, '/img/homeliving-product-botanical-bedsheet-set.webp', 'SL-HL-FIT-SAGE', 'Fitted sheet', 30, {
    category_id: cid(7), brand: 'Meadow Weave', is_bestseller: true, rating: 4.4, review_count: 31, images: SHEET_IMAGES, media: SHEET_MEDIA,
    variants: [v(1, pid(5), 'Single', 'Sage', '#8A9A6B', 6, 1), v(2, pid(5), 'King', 'Sage', '#8A9A6B', 0, 2), v(3, pid(5), 'King', 'Ivory', '#EDE6D6', 4, 3), v(5, pid(5), 'Single', 'Ivory', '#EDE6D6', 2, 5)],
  }),
  prod(6, 'Jute Runner', 'jute-runner', 'rugs-mats', 1499, 1499, '/img/homeliving-product-cotton-quilt.webp', 'SL-HL-RUG-JUTE', '60 × 180 cm', 12, { brand: 'Loom & Co.', is_new: true, sale_price: null }),
  prod(7, 'Waffle Bath Towel', 'waffle-bath-towel', 'towels', 899, 749, '/img/homeliving-product-bath-towel-set.webp', 'SL-HL-TWL-WAF', 'Bath towel', 0, {
    variants: [{ ...v(6, pid(7), 'Hand', '', null, 9, 1), price_override: 349 }, v(7, pid(7), 'Bath', '', null, 3, 2), v(8, pid(7), 'Sheet', '', null, 0, 3)],
  }),
  prod(8, 'Linen Curtain Pair', 'linen-curtain-pair', 'curtains', 2999, 2499, '/img/homeliving-circle-curtains.webp', 'SL-HL-CUR-LIN-2', 'Pair · 140 × 213 cm', 0),
];
export const PDP = { categories: LISTING_CATEGORIES, products: PDP_PRODUCTS };

/** The Home & Living data module with the network stubbed and (optionally) seeded. */
export function loadHomeLivingData({ supabase = noSupabase, initial = INITIAL } = {}) {
  const data = loadModule('src/data/homelivingHomepage.js', { supabase });
  if (initial) data.seedHomeLivingCatalogue(initial);
  return data;
}

// ---- the app, wired like App.jsx --------------------------------------------
export async function buildHomeLivingApp({ cartCount = 0, initial = INITIAL } = {}) {
  const data = loadHomeLivingData({ initial });
  const { Link, Outlet, useLocation, Routes, Route } = ReactRouter;
  const Icon = loadModule('src/components/Icon.jsx', {}).default;
  const Footer = () => h('footer', { className: 'ftr', 'data-stub': 'footer' }, h('div', { className: 'container', style: { paddingBlock: 40 } }, h('strong', { style: { color: '#FBF8F1' } }, 'SORA LIFE'), ' · footer (shared, stub)'));
  const Toasts = () => null;
  const useStore = () => ({ cartCount });
  const branding = { siteName: 'SORA LIFE', tagline: 'HEALTH & WELLNESS' };
  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const { useParams, useSearchParams } = ReactRouter;
  const card = loadModule('src/homeliving/HomeLivingProductCard.jsx', { Link, Icon, money });
  const layout = loadModule('src/homeliving/HomeLivingLayout.jsx', { Link, Outlet, useLocation, Icon, Footer, Toasts, useStore, branding, ...data });
  // The homepage mounts the shell's nav strip, delivery row and search bar under its hero.
  const home = loadModule('src/homeliving/HomeLivingHome.jsx', { Link, Icon, ...data, HomeLivingProductCard: card.default, BottomNav: layout.BottomNav, DeliveryRow: layout.DeliveryRow, SearchBar: layout.SearchBar });
  const rules = has('src/lib/homelivingListing.js') ? loadModule('src/lib/homelivingListing.js', {}) : {};
  const category = has('src/homeliving/HomeLivingCategory.jsx') ? loadModule('src/homeliving/HomeLivingCategory.jsx', { Link, useParams, useSearchParams, Icon, useHomeLivingCatalogue: data.useHomeLivingCatalogue, ...rules, HomeLivingProductCard: card.default }) : null;
  const pdpRules = has('src/lib/homelivingPdp.js') ? loadModule('src/lib/homelivingPdp.js', {}) : {};
  const pdp = has('src/homeliving/HomeLivingProductPage.jsx') ? loadModule('src/homeliving/HomeLivingProductPage.jsx', { Link, useParams, useSearchParams, Icon, money, HOMELIVING_DELIVERY_WINDOW: data.HOMELIVING_DELIVERY_WINDOW, useHomeLivingCatalogue: data.useHomeLivingCatalogue, breadcrumbFor: rules.breadcrumbFor, ...pdpRules, Breadcrumb: category?.Breadcrumb, HomeLivingProductCard: card.default }) : null;
  const App = ({ path }) => h(StaticRouter, { location: path },
    h(Routes, null,
      h(Route, { path: '/homeliving', element: h(layout.default) },
        h(Route, { index: true, element: h(home.default) }),
        category ? h(Route, { path: 'category/:slug', element: h(category.default) }) : null,
        pdp ? h(Route, { path: 'p/:slug', element: h(pdp.default) }) : null)));
  return { App, data, rules, pdpRules, render: (path) => renderToStaticMarkup(h(App, { path })), modules: { card, layout, home, category, pdp } };
}
