// ============================================================
// Grocery store — server-side render of the real shell and homepage, for
// the offline suite. Compiles the JSX in memory (the same babel loader the
// fashion harness uses), stubs only what needs the network or the browser
// (the Footer, the store, the Supabase client), seeds the grocery catalogue
// with rows shaped like catalogue_categories / catalogue_products, and
// renders any /grocery path through the real router.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
// GROCERY_SRC_ROOT points the loader at another checkout's source — the
// suite runs itself against the pre-change tree to prove it is not vacuous.
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as ReactRouter from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';

export const ROOT = process.env.GROCERY_SRC_ROOT
  ? resolve(process.env.GROCERY_SRC_ROOT)
  : resolve(fileURLToPath(new URL('..', import.meta.url)));
export const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
export const has = (rel) => existsSync(resolve(ROOT, rel));
export const h = React.createElement;

/** Every export of a JSX module, compiled in memory with `deps` in scope. */
export function loadModule(rel, deps = {}) { return loadSource(read(rel), deps); }

/** The same, from module text (a file read from another tree, or a git object). */
export function loadSource(source, deps = {}) {
  const names = [];
  const { code } = transformSync(source, {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) {
        const d = path.node.declaration;
        if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') { names.push(['default', d.id.name]); path.replaceWith(d); }
        else { names.push(['default', '__default__']); path.replaceWith({ type: 'VariableDeclaration', kind: 'const', declarations: [{ type: 'VariableDeclarator', id: { type: 'Identifier', name: '__default__' }, init: d }] }); }
      },
      ExportNamedDeclaration(path) {
        const d = path.node.declaration;
        if (d) {
          if (d.type === 'VariableDeclaration') for (const x of d.declarations) names.push([x.id.name, x.id.name]);
          else names.push([d.id.name, d.id.name]);
          path.replaceWith(d);
        } else { for (const s of path.node.specifiers) names.push([s.exported.name, s.local.name]); path.remove(); }
      },
    } })],
  });
  const scope = { React, ...React, ...deps };
  const body = `${code}\n; return { ${names.map(([e, l]) => `${JSON.stringify(e)}: ${l}`).join(', ')} };`;
  return new Function(...Object.keys(scope), body)(...Object.values(scope));
}

// ---- the seeded catalogue, shaped like the tables (the 0034 grocery seed) ------
const cid = (n) => `00000000-0000-4000-8000-0000000006${String(n).padStart(2, '0')}`;
const pid = (n) => `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`;
const cat = (n, name, slug) => ({ id: cid(n), store: 'grocery', parent_id: null, name, slug, tagline: '', image_url: `/img/grocery-circle-${slug}.webp`, sort_order: n, is_active: true });
export const CATEGORIES = [
  cat(1, 'Everyday Staples', 'everyday-staples'), cat(2, 'Packaged Foods', 'packaged-foods'), cat(3, 'Spices & Masalas', 'spices-masalas'),
  cat(4, 'Cooking Oils', 'cooking-oils'), cat(5, 'Dry Fruits & Nuts', 'dry-fruits-nuts'), cat(6, 'Atta & Rice', 'atta-rice'),
  cat(7, 'Tea & Coffee', 'tea-coffee'), cat(8, 'Pulses & Dal', 'pulses-dal'), cat(9, 'Snacks & Munchies', 'snacks-munchies'), cat(10, 'Pantry Essentials', 'pantry-essentials'),
];
const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.id]));
const prod = (n, name, slug, catSlug, mrp, sale_price, image, sku, net_content) => ({
  id: pid(n), store: 'grocery', name, slug, brand: 'SORA LIFE', description: `${name}.`, category_id: byCat[catSlug],
  mrp, sale_price, discount_percent: Math.round(((mrp - sale_price) / mrp) * 100), images: [image], sku, hsn_code: null, gst_rate: null, net_content, stock: 100,
  rating: 0, review_count: 0, is_active: true, is_new: false, is_bestseller: false, sort_order: n, is_demo: true,
});
export const PRODUCTS = [
  prod(1, 'Sona Masoori Rice', 'sona-masoori-rice-1kg', 'atta-rice', 99, 89, '/img/grocery-product-sona-masoori-rice.webp', 'SL-GR-RICE-SM-1KG', '1 kg'),
  prod(2, 'Whole Wheat Atta', 'whole-wheat-atta-1kg', 'atta-rice', 58, 52, '/img/grocery-product-whole-wheat-atta.webp', 'SL-GR-ATTA-WW-1KG', '1 kg'),
  prod(3, 'Sunflower Oil', 'sunflower-oil-1l', 'cooking-oils', 165, 142, '/img/grocery-product-sunflower-oil.webp', 'SL-GR-OIL-SF-1L', '1 L'),
  prod(4, 'Masoor Dal', 'masoor-dal-500g', 'pulses-dal', 89, 78, '/img/grocery-product-masoor-dal.webp', 'SL-GR-DAL-MAS-500', '500 g'),
];
export const INITIAL = { categories: CATEGORIES, products: PRODUCTS };

/** A Supabase stand-in that refuses to be used: nothing in a seeded render may query. */
export const noSupabase = new Proxy({}, { get: (_, k) => { throw new Error(`supabase.${String(k)} called during an offline render`); } });

/** The grocery data module with the network stubbed and (optionally) seeded. */
export function loadGroceryData({ supabase = noSupabase, initial = INITIAL } = {}) {
  const data = loadModule('src/data/groceryHomepage.js', { supabase });
  if (initial) data.seedGroceryCatalogue(initial);
  return data;
}

// ---- the app, wired like App.jsx --------------------------------------------
export async function buildGroceryApp({ cartCount = 0, onAdd = null, initial = INITIAL } = {}) {
  const data = loadGroceryData({ initial });
  const { Link, Outlet, useLocation, Routes, Route } = ReactRouter;
  const Icon = loadModule('src/components/Icon.jsx', {}).default;
  const Footer = () => h('footer', { className: 'ftr', 'data-stub': 'footer' }, h('div', { className: 'container', style: { paddingBlock: 40 } }, h('strong', { style: { color: '#FBF8F1' } }, 'SORA LIFE'), ' · footer (shared, stub)'));
  const Toasts = () => null;
  const added = [];
  const useStore = () => ({ cartCount, addGroceryToCart: (product, qty = 1) => { added.push({ id: product.id, qty }); if (onAdd) onAdd(product, qty); return true; } });
  const branding = { siteName: 'SORA LIFE', tagline: 'HEALTH & WELLNESS' };
  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const card = loadModule('src/grocery/GroceryProductCard.jsx', { Icon, money, useStore });
  const layout = loadModule('src/grocery/GroceryLayout.jsx', { Link, Outlet, useLocation, Icon, Footer, Toasts, useStore, branding, ...data });
  const home = loadModule('src/grocery/GroceryHome.jsx', { Link, Icon, ...data, GroceryProductCard: card.default });
  const App = ({ path }) => h(StaticRouter, { location: path },
    h(Routes, null,
      h(Route, { path: '/grocery', element: h(layout.default) },
        h(Route, { index: true, element: h(home.default) }))));
  return { App, data, added, render: (path) => renderToStaticMarkup(h(App, { path })), modules: { card, layout, home } };
}
