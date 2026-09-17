// ============================================================
// Grocery store — server-side render of the real shell and homepage, for
// the offline suite. Compiles the JSX in memory (the same babel loader the
// fashion harness uses), stubs only what needs the network or the browser
// (the Footer, the store), and renders any /grocery path through the real
// router. NO NETWORK, NO DATABASE, NO BROWSER.
//
// GROCERY_SRC_ROOT points the loader at another checkout's source — the
// suite runs itself against the pre-change tree to prove it is not vacuous.
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
export function loadModule(rel, deps = {}) {
  const names = [];
  const { code } = transformSync(read(rel), {
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

// ---- the app, wired like App.jsx --------------------------------------------
export async function buildGroceryApp({ cartCount = 0, onAdd = null } = {}) {
  const data = await import(pathToFileURL(resolve(ROOT, 'src/data/groceryHomepage.js')).href);
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
