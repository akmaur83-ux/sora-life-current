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
const prod = (n, name, slug, catSlug, mrp, sale_price, image, sku, net_content, stock) => ({
  id: pid(n), store: 'homeliving', name, slug, brand: 'SORA LIFE', description: `${name}.`, category_id: byCat[catSlug],
  mrp, sale_price, discount_percent: Math.round(((mrp - sale_price) / mrp) * 100), images: [image], sku, hsn_code: null, gst_rate: null, net_content, stock,
  rating: 0, review_count: 0, is_active: true, is_new: false, is_bestseller: false, sort_order: n, is_demo: true,
});
export const PRODUCTS = [
  prod(1, 'Botanical Bedsheet Set', 'botanical-bedsheet-set-king', 'bedsheets', 1899, 1499, '/img/homeliving-product-botanical-bedsheet-set.webp', 'SL-HL-BED-BOT-K', 'King · 1 bedsheet + 2 pillow covers', 40),
  prod(2, 'Leaf Cushion Cover Pair', 'leaf-cushion-cover-pair', 'cushion-covers', 699, 599, '/img/homeliving-product-leaf-cushion-cover-pair.webp', 'SL-HL-CUS-LEAF-2', 'Set of 2 · 40 × 40 cm', 60),
  prod(3, 'Cotton Quilt', 'cotton-quilt-single', 'quilts-blankets', 2399, 1999, '/img/homeliving-product-cotton-quilt.webp', 'SL-HL-QLT-COT-S', 'Single · 150 × 220 cm', 25),
  prod(4, 'Bath Towel Set', 'bath-towel-set-pack-of-2', 'towels', 949, 799, '/img/homeliving-product-bath-towel-set.webp', 'SL-HL-TWL-BATH-2', 'Pack of 2 · 70 × 140 cm', 50),
];
export const INITIAL = { categories: CATEGORIES, products: PRODUCTS };

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
  const card = loadModule('src/homeliving/HomeLivingProductCard.jsx', { Icon, money });
  const layout = loadModule('src/homeliving/HomeLivingLayout.jsx', { Link, Outlet, useLocation, Icon, Footer, Toasts, useStore, branding, ...data });
  const home = loadModule('src/homeliving/HomeLivingHome.jsx', { Link, Icon, ...data, HomeLivingProductCard: card.default });
  const App = ({ path }) => h(StaticRouter, { location: path },
    h(Routes, null,
      h(Route, { path: '/homeliving', element: h(layout.default) },
        h(Route, { index: true, element: h(home.default) }))));
  return { App, data, render: (path) => renderToStaticMarkup(h(App, { path })), modules: { card, layout, home } };
}
