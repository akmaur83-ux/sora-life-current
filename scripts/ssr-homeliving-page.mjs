// ============================================================
// Home & Living store — a self-contained static render of /homeliving for review.
//
//   node scripts/ssr-homeliving-page.mjs
//
// Renders the real shell and homepage through the real router with the
// seeded catalogue (scripts/homeliving-ssr.mjs), inlines the committed
// stylesheets plus src/styles/homeliving.css (exactly what the build
// appends to the deferred sheet) and every photograph as a data URI, and
// writes reports/homeliving/homeliving-home.html and a category listing
// (homeliving-category-bedsheets.html, seeded with the listing fixture so
// every facet shows). The files make NO network requests when opened —
// open them from disk at any width. No browser is launched here; nothing
// is fetched.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, buildHomeLivingApp, LISTING } from './homeliving-ssr.mjs';

const OUT = resolve(ROOT, 'reports/homeliving');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const inlineCss = (css) => css.replace(/url\('\/img\/([^']+\.webp)'\)/g, (_, f) => `url('${dataUri(f)}')`);
const inlineMarkup = (html) => html.replace(/src="\/img\/([^"]+\.webp)"/g, (_, f) => `src="${dataUri(f)}"`).replace(/loading="lazy"/g, 'loading="eager"');
const css = [inlineCss(read('public/app.css')), inlineCss(read('public/app-deferred.css')), read('src/styles/homeliving.css')].join('\n');

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${css}</style><style>body{margin:0;background:#FBF8F1}</style></head><body>${body}</body></html>`;
mkdirSync(OUT, { recursive: true });
const write = (name, title, body) => {
  const html = page(title, inlineMarkup(body));
  writeFileSync(join(OUT, name), html);
  console.log(`wrote ${join(OUT, name)} (${(html.length / 1024).toFixed(0)} KB, ${(body.match(/<img /g) || []).length} images inlined, 0 external references)`);
};
const home = await buildHomeLivingApp({ cartCount: 3 });
write('homeliving-home.html', 'SSR — Home &amp; Living home', home.render('/homeliving'));
if (home.modules.category) {
  const listing = await buildHomeLivingApp({ cartCount: 3, initial: LISTING });
  write('homeliving-category-bedsheets.html', 'SSR — Home &amp; Living: Bedsheets', listing.render('/homeliving/category/bedsheets'));
  write('homeliving-category-bedsheets-filtered.html', 'SSR — Home &amp; Living: Bedsheets, King · Sage, list', listing.render('/homeliving/category/bedsheets?size=King&colour=Sage&sort=price-desc&view=list'));
}
