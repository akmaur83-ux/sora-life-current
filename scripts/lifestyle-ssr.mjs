// ============================================================
// Lifestyle storefront — server-side render of the real shell and homepage,
// for the offline suite and the static review page. Same loader and stubs
// as scripts/grocery-ssr.mjs; the two catalogues are the Home & Living
// fixtures (scripts/homeliving-ssr.mjs, shaped like the 0035 seed) and the
// fashion fixtures (scripts/fashion-ssr.mjs, shaped like the 0033 seed as
// the catalogue_* tables hold it). NO NETWORK, NO DATABASE, NO BROWSER.
//
// GROCERY_SRC_ROOT points the loader at another checkout's source — the
// suite runs itself against the pre-change tree to prove it is not vacuous.
// ============================================================
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactRouter from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule, noSupabase } from './grocery-ssr.mjs';
import { CATEGORIES as HOME_CATEGORIES, PRODUCTS as HOME_PRODUCTS } from './homeliving-ssr.mjs';
import { CATEGORIES as FASHION_CATEGORIES, PRODUCTS as FASHION_PRODUCTS } from './fashion-ssr.mjs';

export { ROOT, read, has, h, loadModule, HOME_CATEGORIES, HOME_PRODUCTS, FASHION_CATEGORIES, FASHION_PRODUCTS };

/** Both stores' seeds, as the data layer takes them. */
export const INITIAL = { homeCategories: HOME_CATEGORIES, homeProducts: HOME_PRODUCTS, fashionCategories: FASHION_CATEGORIES, fashionProducts: FASHION_PRODUCTS };

/**
 * The lifestyle data module with the network stubbed and (optionally)
 * seeded. Its imports — the Home & Living reads and view, the fashion reads,
 * buildTree/productView, circleArt — are the real modules, loaded the same
 * way, so what the page derives is what the stores derive.
 */
export function loadLifestyleData({ supabase = noSupabase, initial = INITIAL } = {}) {
  const homeliving = loadModule('src/data/homelivingHomepage.js', { supabase });
  const fashion = loadModule('src/lib/fashion.js', {});
  const fashionApi = loadModule('src/lib/fashionApi.js', { supabase, FASHION_STORE: fashion.FASHION_STORE });
  const fashionArt = loadModule('src/fashion/fashionArt.js', {});
  const data = loadModule('src/data/lifestyleHomepage.js', {
    HOMELIVING_DELIVERY_WINDOW: homeliving.HOMELIVING_DELIVERY_WINDOW, getHomeLivingCategories: homeliving.getHomeLivingCategories, getHomeLivingProducts: homeliving.getHomeLivingProducts, homelivingProductView: homeliving.homelivingProductView,
    getFashionCategories: fashionApi.getFashionCategories, getFashionProducts: fashionApi.getFashionProducts,
    buildTree: fashion.buildTree, fashionProductView: fashion.productView, circleArt: fashionArt.circleArt,
  });
  if (initial) data.seedLifestyleCatalogue(initial);
  return data;
}

// ---- the app, wired like App.jsx --------------------------------------------
export async function buildLifestyleApp({ cartCount = 0, initial = INITIAL } = {}) {
  const data = loadLifestyleData({ initial });
  const { Link, Outlet, useLocation, Routes, Route } = ReactRouter;
  const Icon = loadModule('src/components/Icon.jsx', {}).default;
  const Footer = () => h('footer', { className: 'ftr', 'data-stub': 'footer' }, h('div', { className: 'container', style: { paddingBlock: 40 } }, h('strong', { style: { color: '#FBF8F1' } }, 'SORA LIFE'), ' · footer (shared, stub)'));
  const Toasts = () => null;
  const useStore = () => ({ cartCount });
  const branding = { siteName: 'SORA LIFE', tagline: 'HEALTH & WELLNESS' };
  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const layout = loadModule('src/lifestyle/LifestyleLayout.jsx', { Link, Outlet, useLocation, Icon, Footer, Toasts, useStore, branding, ...data });
  const home = loadModule('src/lifestyle/LifestyleHome.jsx', { Link, Icon, money, ...data });
  const App = ({ path }) => h(StaticRouter, { location: path },
    h(Routes, null,
      h(Route, { path: '/lifestyle', element: h(layout.default) },
        h(Route, { index: true, element: h(home.default) }))));
  return { App, data, render: (path) => renderToStaticMarkup(h(App, { path })), modules: { layout, home } };
}
