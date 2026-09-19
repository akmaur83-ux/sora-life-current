// ============================================================
// Lifestyle storefront — a self-contained static render of /lifestyle for review.
//
//   npm run build && node scripts/ssr-lifestyle-page.mjs
//
// Renders the real shell and homepage through the real router with both
// stores' seeded catalogues (scripts/lifestyle-ssr.mjs), inlines the BUILT
// stylesheets (public/app.css + public/app-deferred.css — run the build
// first; this refuses a stale one) and every photograph as a data URI, and
// writes reports/lifestyle/lifestyle-home.html. The file makes NO network
// requests when opened — resize it through 390, 768 and 1280 to see the
// portrait/landscape hero swap. No browser is launched here; nothing is
// fetched.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, read, buildLifestyleApp } from './lifestyle-ssr.mjs';

const OUT = resolve(ROOT, 'reports/lifestyle');
const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const inlineCss = (css) => css.replace(/url\('\/img\/([^']+\.webp)'\)/g, (_, f) => `url('${dataUri(f)}')`);
const inlineMarkup = (html) => html.replace(/(srcSet|src)="\/img\/([^"]+\.webp)"/g, (_, attr, f) => `${attr}="${dataUri(f)}"`).replace(/loading="lazy"/g, 'loading="eager"');
const deferred = read('public/app-deferred.css');
if (!/\.ls-hero__ctl \{/.test(deferred)) throw new Error('public/app-deferred.css predates the lifestyle storefront — run npm run build first');
const css = [inlineCss(read('public/app.css')), inlineCss(deferred)].join('\n');

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${css}</style><style>body{margin:0;background:#FBF8F1}</style></head><body>${body}</body></html>`;
mkdirSync(OUT, { recursive: true });
const app = await buildLifestyleApp({ cartCount: 3 });
const body = app.render('/lifestyle');
const html = page('SSR — Lifestyle home', inlineMarkup(body));
const out = join(OUT, 'lifestyle-home.html');
writeFileSync(out, html);
const external = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/'));
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${(body.match(/<img /g) || []).length} images inlined, ${external.length} external references)`);
