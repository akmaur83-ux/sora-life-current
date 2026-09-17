// ============================================================
// Grocery store — a self-contained static render of /grocery for review.
//
//   node scripts/ssr-grocery-page.mjs
//
// Renders the real shell and homepage through the real router with the
// data file's content (scripts/grocery-ssr.mjs), inlines the committed
// stylesheets plus src/styles/grocery.css (exactly what the build appends
// to the deferred sheet) and every photograph as a data URI, and writes
// reports/grocery/grocery-home.html. The file makes NO network requests
// when opened — open it from disk at any width. No browser is launched
// here; nothing is fetched.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, buildGroceryApp } from './grocery-ssr.mjs';

const OUT = resolve(ROOT, 'reports/grocery');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const inlineCss = (css) => css.replace(/url\('\/img\/([^']+\.webp)'\)/g, (_, f) => `url('${dataUri(f)}')`);
const inlineMarkup = (html) => html.replace(/src="\/img\/([^"]+\.webp)"/g, (_, f) => `src="${dataUri(f)}"`).replace(/loading="lazy"/g, 'loading="eager"');
const css = [inlineCss(read('public/app.css')), inlineCss(read('public/app-deferred.css')), read('src/styles/grocery.css')].join('\n');

const app = await buildGroceryApp({ cartCount: 3 });
const body = inlineMarkup(app.render('/grocery'));
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SSR — grocery home</title><style>${css}</style><style>body{margin:0;background:#FBF8F1}</style></head><body>${body}</body></html>`;
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'grocery-home.html'), page);
console.log(`wrote ${join(OUT, 'grocery-home.html')} (${(page.length / 1024).toFixed(0)} KB, ${(body.match(/<img /g) || []).length} images inlined, 0 external references)`);
