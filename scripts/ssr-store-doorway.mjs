// ============================================================
// The homepage store doorway — a self-contained static render for review.
//
//   npm run build && node scripts/ssr-store-doorway.mjs
//
// Renders src/components/FashionBanner.jsx exactly as the homepage mounts
// it (whole-card links through the real router), with the images revealed
// so the <picture> choice is visible, inlines the BUILT storefront sheet
// (public/app.css — run the build first; this refuses a stale one) and all
// four photographs as data URIs, and writes reports/homepage-store-doorway.html.
// The file makes NO network requests when opened: resize it through 390,
// 768 and 1280 to see the portrait/landscape swap and the copy on the photo.
// No browser is launched here; nothing is fetched.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, h, loadModule } from './grocery-ssr.mjs';
// Review only: SSR_FONTS_CSS may point at a stylesheet of inline @font-face rules so the zero-network file measures with the real faces. Not set in the repo.
const REVIEW_FONTS = process.env.SSR_FONTS_CSS ? readFileSync(process.env.SSR_FONTS_CSS, 'utf8') : '';

const OUT = resolve(ROOT, 'reports');
const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const css = read('public/app.css');
if (!/\.fsb__card \{[^}]*container-type: inline-size/.test(css)) throw new Error('public/app.css predates the doorway rebuild — run npm run build first');

const Icon = loadModule('src/components/Icon.jsx').default;
const EagerImage = ({ src, sources = [], loading, decoding, fetchPriority, ...props }) =>
  h('picture', null, ...sources.map((s) => h('source', { key: s.media, media: s.media, srcSet: s.srcSet })), h('img', { ...props, src }));
const doorway = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage: EagerImage });
// The two sections as Home.jsx places them (the banner after the offers, the carousel above the popular rail), with a
// stand-in for the sections between them so the gap reads as it does on the page.
const between = '<section class="v2-sec" style="padding:40px 0;text-align:center;color:#8a8f86;font:14px Inter,sans-serif">— Start here · Shop by category · Concerns · Brands · Discovery edit (the wellness sections, unchanged) —</section>';
const body = (renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(doorway.LifestyleBanner))) + between + renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(doorway.StoreCarousel))))
  .replace(/(srcSet|src)="\/img\/([^"]+\.webp)"/g, (_, attr, f) => `${attr}="${dataUri(f)}"`);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SSR — homepage store doorway</title><style>${REVIEW_FONTS}</style><style>${css.replace(/url\('\/img\/([^']+\.webp)'\)/g, (_, f) => `url('${dataUri(f)}')`)}</style>
<style>body{margin:0;background:#FBF8F1}</style></head><body><main class="v2-home">${body}</main></body></html>`;
mkdirSync(OUT, { recursive: true });
const out = join(OUT, 'homepage-store-doorway.html');
writeFileSync(out, html);
const external = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/'));
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, 4 images inlined, ${external.length} external references)`);
