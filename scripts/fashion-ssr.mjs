// ============================================================
// Fashion store — server-side render of the real pages, for the offline
// suite and the screenshot harness. Compiles the JSX in memory (the same
// babel loader the portal harness uses), stubs only what needs the network
// or the browser (the Footer, the store, customer auth), and renders any
// /fashion path through the real router with a seeded catalogue.
//
// FASHION_SRC_ROOT points the loader at another checkout's source — the
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

export const ROOT = process.env.FASHION_SRC_ROOT
  ? resolve(process.env.FASHION_SRC_ROOT)
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

// ---- the seeded catalogue, shaped like the tables ----------------------------
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const CATEGORIES = [
  { id: id(1), parent_id: null, name: 'Clothing', slug: 'clothing', tagline: 'For Every You', image_url: '/img/demo-kurta-set.webp', sort_order: 1, is_active: true },
  { id: id(2), parent_id: null, name: 'Beauty', slug: 'beauty', tagline: 'Glow Everyday', image_url: null, sort_order: 2, is_active: true },
  { id: id(3), parent_id: null, name: 'Footwear', slug: 'footwear', tagline: 'Step Ahead', image_url: '/img/demo-sneakers.webp', sort_order: 3, is_active: true },
  { id: id(4), parent_id: null, name: 'Bags & Accessories', slug: 'bags-accessories', tagline: 'Complete Your Look', image_url: '/img/demo-handbag.webp', sort_order: 4, is_active: true },
  { id: id(11), parent_id: id(1), name: 'Men', slug: 'men', tagline: 'Everyday essentials', image_url: '/img/demo-mens-shirt.webp', sort_order: 1, is_active: true },
  { id: id(12), parent_id: id(1), name: 'Women', slug: 'women', tagline: 'Effortless style', image_url: '/img/demo-kurta-set.webp', sort_order: 2, is_active: true },
  { id: id(13), parent_id: id(1), name: 'Kids', slug: 'kids', tagline: 'Little explorers', image_url: '/img/demo-kids-set.webp', sort_order: 3, is_active: true },
  { id: id(111), parent_id: id(11), name: 'Shirts', slug: 'mens-shirts', tagline: '', image_url: null, sort_order: 1, is_active: true },
  { id: id(112), parent_id: id(11), name: 'T-Shirts', slug: 'mens-t-shirts', tagline: '', image_url: null, sort_order: 2, is_active: true },
  { id: id(113), parent_id: id(11), name: 'Trousers', slug: 'mens-trousers', tagline: '', image_url: null, sort_order: 3, is_active: true },
];
const v = (n, product_id, size, colour, colour_hex, sku, stock, price_override = null, sort_order = 0) => ({ id: id(9000 + n), product_id, size, colour, colour_hex, sku, stock, price_override, is_active: true, sort_order });
export const PRODUCTS = [
  { id: id(501), name: 'Meadow Linen Shirt — Sage', slug: 'meadow-linen-shirt-sage', brand: 'Aurelia Wear', description: 'A breathable linen-blend shirt in a soft sage.', category_id: id(111), mrp: 1999, sale_price: 1099, discount_percent: 45, images: ['/img/demo-mens-shirt.webp'], rating: 4.4, review_count: 812, is_active: true, is_new: true, is_bestseller: false, sort_order: 1, is_demo: true,
    fashion_variants: [v(1, id(501), 'S', 'Sage', '#8A9A6B', 'AW-MLS-S-SAGE', 6, null, 1), v(2, id(501), 'M', 'Sage', '#8A9A6B', 'AW-MLS-M-SAGE', 0, null, 2), v(3, id(501), 'L', 'Sage', '#8A9A6B', 'AW-MLS-L-SAGE', 4, null, 3),
      v(4, id(501), 'S', 'Navy', '#2F3A56', 'AW-MLS-S-NAVY', 5, null, 4), v(5, id(501), 'M', 'Navy', '#2F3A56', 'AW-MLS-M-NAVY', 8, null, 5), v(6, id(501), 'L', 'Navy', '#2F3A56', 'AW-MLS-L-NAVY', 2, null, 6),
      v(7, id(501), 'M', 'Ivory', '#EDE6D6', 'AW-MLS-M-IVRY', 3, null, 7), v(8, id(501), 'XL', 'Ivory', '#EDE6D6', 'AW-MLS-XL-IVRY', 0, null, 8),
      v(9, id(501), 'M', 'Rust', '#B4552E', 'AW-MLS-M-RUST', 2, null, 9), v(10, id(501), 'M', 'Black', '#1B1B1B', 'AW-MLS-M-BLK', 1, null, 10)] },
  { id: id(502), name: 'Little Explorer Frock & Pant Set', slug: 'little-explorer-frock-pant-set', brand: 'Cub & Clover', description: 'A two-piece set in embroidered cotton.', category_id: id(13), mrp: 1499, sale_price: 599, discount_percent: 60, images: ['/img/demo-kids-set.webp'], rating: 4.3, review_count: 2400, is_active: true, is_new: false, is_bestseller: true, sort_order: 2, is_demo: true,
    fashion_variants: [v(11, id(502), '2-3Y', 'Sage', '#B7C4A1', 'CC-LEF-23-SAGE', 7, null, 1), v(12, id(502), '4-5Y', 'Sage', '#B7C4A1', 'CC-LEF-45-SAGE', 5, null, 2), v(13, id(502), '6-7Y', 'Sage', '#B7C4A1', 'CC-LEF-67-SAGE', 0, null, 3), v(14, id(502), '4-5Y', 'Peach', '#F1C6B0', 'CC-LEF-45-PCH', 4, null, 4)] },
  { id: id(503), name: 'Cloudstep Minimal Sneakers', slug: 'cloudstep-minimal-sneakers', brand: 'Nova Stride', description: 'Clean white sneakers on a cushioned sole.', category_id: id(3), mrp: 2499, sale_price: 999, discount_percent: 60, images: ['/img/demo-sneakers.webp'], rating: 4.5, review_count: 3200, is_active: true, is_new: false, is_bestseller: true, sort_order: 3, is_demo: true,
    fashion_variants: [v(15, id(503), 'UK 6', 'White', '#F5F2EA', 'NS-CMS-6-WHT', 9, null, 1), v(16, id(503), 'UK 7', 'White', '#F5F2EA', 'NS-CMS-7-WHT', 12, null, 2), v(17, id(503), 'UK 8', 'White', '#F5F2EA', 'NS-CMS-8-WHT', 0, null, 3), v(18, id(503), 'UK 9', 'White', '#F5F2EA', 'NS-CMS-9-WHT', 6, null, 4), v(19, id(503), 'UK 8', 'Forest', '#1E3A2F', 'NS-CMS-8-FOR', 3, 1099, 5)] },
  { id: id(504), name: 'Verona Structured Handbag — Blush', slug: 'verona-structured-handbag-blush', brand: 'Celeste & Co.', description: 'A structured top-handle bag in a blush finish.', category_id: id(4), mrp: 2999, sale_price: 1299, discount_percent: 57, images: ['/img/demo-handbag.webp'], rating: 4.6, review_count: 1100, is_active: true, is_new: true, is_bestseller: false, sort_order: 4, is_demo: true,
    fashion_variants: [v(20, id(504), 'One size', 'Blush', '#E7B8A6', 'CC-VSH-OS-BLSH', 10, null, 1), v(21, id(504), 'One size', 'Forest', '#1E3A2F', 'CC-VSH-OS-FOR', 4, null, 2), v(22, id(504), 'One size', 'Black', '#1B1B1B', 'CC-VSH-OS-BLK', 0, null, 3)] },
  { id: id(505), name: 'Sunhaven Oversized Sunglasses', slug: 'sunhaven-oversized-sunglasses', brand: 'Sunhaven', description: 'Oversized square frames with gradient lenses.', category_id: id(4), mrp: 1299, sale_price: 599, discount_percent: 54, images: ['/img/demo-sunglasses.webp'], rating: 4.2, review_count: 640, is_active: true, is_new: false, is_bestseller: false, sort_order: 5, is_demo: true,
    fashion_variants: [v(23, id(505), 'One size', 'Gold', '#C79A45', 'SH-OSG-OS-GLD', 15, null, 1), v(24, id(505), 'One size', 'Black', '#1B1B1B', 'SH-OSG-OS-BLK', 8, null, 2)] },
  { id: id(506), name: 'Ethnic Embroidered Kurta Set — Sage', slug: 'ethnic-embroidered-kurta-set-sage', brand: 'Aurelia Wear', description: 'A three-piece kurta set in soft sage.', category_id: id(12), mrp: 1999, sale_price: 1199, discount_percent: 40, images: ['/img/demo-kurta-set.webp'], rating: 4.5, review_count: 3200, is_active: true, is_new: true, is_bestseller: true, sort_order: 6, is_demo: true,
    fashion_variants: [v(25, id(506), 'S', 'Sage', '#A9B48C', 'AW-EKS-S-SAGE', 4, null, 1), v(26, id(506), 'M', 'Sage', '#A9B48C', 'AW-EKS-M-SAGE', 6, null, 2), v(27, id(506), 'L', 'Sage', '#A9B48C', 'AW-EKS-L-SAGE', 2, null, 3), v(28, id(506), 'XL', 'Sage', '#A9B48C', 'AW-EKS-XL-SAGE', 0, null, 4), v(29, id(506), 'M', 'Rust', '#B4552E', 'AW-EKS-M-RUST', 5, null, 5), v(30, id(506), 'L', 'Rust', '#B4552E', 'AW-EKS-L-RUST', 3, null, 6)] },
];
export const INITIAL = { categories: CATEGORIES, products: PRODUCTS };

// ---- the app, wired like App.jsx --------------------------------------------
export async function buildFashionApp({ cartCount = 0, session = null, wishlist = [] } = {}) {
  const rules = await import(pathToFileURL(resolve(ROOT, 'src/lib/fashion.js')).href);
  const wishMod = await import(pathToFileURL(resolve(ROOT, 'src/lib/fashionWishlist.js')).href);
  const art = await import(pathToFileURL(resolve(ROOT, 'src/fashion/fashionArt.js')).href);
  wishMod.fashionWishlist.clear();
  for (const w of wishlist) wishMod.fashionWishlist.toggle(w);
  const { Link, Outlet, useLocation, useNavigate, useParams, useSearchParams, Routes, Route } = ReactRouter;
  const Icon = loadModule('src/components/Icon.jsx', {}).default;
  const { SparrowMark } = loadModule('src/components/Logo.jsx', { Link, useState: React.useState, branding: { siteName: 'SORA LIFE', tagline: 'HEALTH & WELLNESS', logoUrl: '' } });
  const Footer = () => h('footer', { className: 'ftr', 'data-stub': 'footer' }, h('div', { className: 'container', style: { paddingBlock: 40 } }, h('strong', { style: { color: '#FBF8F1' } }, 'SORA LIFE'), ' · footer (shared, stub)'));
  const Toasts = () => null;
  const useStore = () => ({ cartCount, wishCount: 0 });
  const useCustomerAuth = () => ({ session, loading: false });
  const branding = { siteName: 'SORA LIFE', tagline: 'HEALTH & WELLNESS' };
  const catalogue = loadModule('src/fashion/FashionCatalogue.jsx', { getFashionCategories: async () => [], getFashionProducts: async () => [], buildTree: rules.buildTree, productView: rules.productView });
  const card = loadModule('src/fashion/FashionProductCard.jsx', { Link, Icon, money: (n) => `₹${Number(n).toLocaleString('en-IN')}`, swatchOverflow: rules.swatchOverflow, useFashionWishlist: wishMod.useFashionWishlist });
  const layout = loadModule('src/fashion/FashionLayout.jsx', { Link, Outlet, useLocation, useNavigate, Icon, SparrowMark, Footer, Toasts, useStore, branding, useFashionWishlist: wishMod.useFashionWishlist, FashionCatalogueProvider: catalogue.FashionCatalogueProvider, useFashionCatalogue: catalogue.useFashionCatalogue, categoryHref: rules.categoryHref, resolveCategory: rules.resolveCategory });
  const home = loadModule('src/fashion/FashionHome.jsx', { Link, Icon, useCustomerAuth, categoryHref: rules.categoryHref, sortViews: rules.sortViews, topBrands: rules.topBrands, useFashionCatalogue: catalogue.useFashionCatalogue, CategoryChips: layout.CategoryChips, FashionProductCard: card.default, HERO_IMAGE: art.HERO_IMAGE, circleArt: art.circleArt, cardArt: art.cardArt });
  const listing = loadModule('src/fashion/FashionListing.jsx', { Link, useParams, useSearchParams, Icon, ...rules, useFashionWishlist: wishMod.useFashionWishlist, useFashionCatalogue: catalogue.useFashionCatalogue, CategoryChips: layout.CategoryChips, FashionProductCard: card.default });
  const stub = loadModule('src/fashion/FashionProductStub.jsx', { Link, useParams, Icon, money: (n) => `₹${Number(n).toLocaleString('en-IN')}`, breadcrumbFor: rules.breadcrumbFor, stockMatrix: rules.stockMatrix, useFashionCatalogue: catalogue.useFashionCatalogue, CategoryChips: layout.CategoryChips, Breadcrumb: listing.Breadcrumb, Stars: card.Stars });
  const App = ({ path, initial = INITIAL }) => h(StaticRouter, { location: path },
    h(Routes, null,
      h(Route, { path: '/fashion', element: h(layout.default, { initial }) },
        h(Route, { index: true, element: h(home.default) }),
        h(Route, { path: 'c/:slug', element: h(listing.default) }),
        h(Route, { path: 'p/:slug', element: h(stub.default) }),
        h(Route, { path: 'search', element: h(listing.FashionSearch) }),
        h(Route, { path: 'wishlist', element: h(listing.FashionWishlistPage) }))));
  return { App, rules, render: (path, initial = INITIAL) => renderToStaticMarkup(h(App, { path, initial })), modules: { catalogue, card, layout, home, listing, stub } };
}
