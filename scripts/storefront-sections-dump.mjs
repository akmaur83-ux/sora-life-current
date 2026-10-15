// ============================================================
// Every page with sections an admin can edit, rendered and printed as JSON:
// the fashion home page (its strips), the women's, men's, saree and jewellery
// pages, the grocery and Home & Living homepages, and the wellness homepage's
// hero, trust strip, store tiles, store circles, festive promo, Lifestyle
// banner, jewellery banner and store carousel.
//
//   node scripts/storefront-sections-dump.mjs                      nothing published
//   STOREFRONT_PUBLISHED=<file.json> node scripts/...               { stores: {...} } published
//   FASHION_SRC_ROOT=<tree> GROCERY_SRC_ROOT=<tree> node scripts/... another tree's pages
//
// test-storefront-sections.mjs runs it against this tree and the tree before
// the sections were editable, and compares: with nothing published they match
// byte for byte.
// ============================================================
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, useLocation } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { applyStorefrontDrafts } from '../src/lib/settings.js';
import { buildFashionApp } from './fashion-ssr.mjs';
import { buildGroceryApp, loadModule } from './grocery-ssr.mjs';
import { buildHomeLivingApp } from './homeliving-ssr.mjs';

export const FASHION_PAGES = ['/fashion', '/fashion/women', '/fashion/men', '/fashion/women/sarees', '/fashion/jewellery'];

if (process.env.STOREFRONT_PUBLISHED) {
  const { stores } = JSON.parse(readFileSync(process.env.STOREFRONT_PUBLISHED, 'utf8'));
  applyStorefrontDrafts(Object.entries(stores).map(([store, content]) => ({ store, content })));
}

const h = React.createElement;
const out = {};
const fashion = await buildFashionApp({});
for (const path of FASHION_PAGES) out[path] = fashion.render(path);
out['/grocery'] = (await buildGroceryApp({})).render('/grocery');
out['/homeliving'] = (await buildHomeLivingApp({})).render('/homeliving');

const Icon = loadModule('src/components/Icon.jsx').default;
const DeferredImage = loadModule('src/components/DeferredImage.jsx').default;
const FashionEntryLink = loadModule('src/components/FashionEntryLink.jsx', { Link, useLocation, Icon }).default;
const wellness = loadModule('src/components/HomeStorefront.jsx', { Link, Icon, DeferredImage, FashionEntryLink });
const doorway = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage, FashionEntryLink });
const section = (Component) => renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(Component)));
out['/#hero'] = section(wellness.HomeHero);
out['/#trust'] = section(wellness.HomeTrustStrip);
out['/#tiles'] = section(wellness.HomeTiles);
out['/#stores'] = section(wellness.ExploreStores);
out['/#promo'] = section(wellness.FestivePromo);
out['/#lifestyleBanner'] = section(doorway.LifestyleBanner);
out['/#jewelleryBanner'] = section(wellness.JewelleryBanner);
out['/#storeCarousel'] = section(doorway.StoreCarousel);

process.stdout.write(JSON.stringify(out));
