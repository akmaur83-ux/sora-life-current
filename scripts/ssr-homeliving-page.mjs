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
import { ROOT, buildHomeLivingApp, LISTING, PDP } from './homeliving-ssr.mjs';
// Review only: SSR_FONTS_CSS may point at a stylesheet of inline @font-face rules so the zero-network file measures with the real faces. Not set in the repo.
const REVIEW_FONTS = process.env.SSR_FONTS_CSS ? readFileSync(process.env.SSR_FONTS_CSS, 'utf8') : '';

const OUT = resolve(ROOT, 'reports/homeliving');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const inlineCss = (css) => css.replace(/url\('\/img\/([^']+\.webp)'\)/g, (_, f) => `url('${dataUri(f)}')`);
const inlineMarkup = (html) => html.replace(/(srcSet|src)="\/img\/([^"]+\.webp)"/g, (_, attr, f) => `${attr}="${dataUri(f)}"`).replace(/loading="lazy"/g, 'loading="eager"');
const css = [inlineCss(read('public/app.css')), inlineCss(read('public/app-deferred.css')), read('src/styles/homeliving.css')].join('\n');

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${REVIEW_FONTS}</style><style>${css}</style><style>body{margin:0;background:#FBF8F1}</style></head><body>${body}</body></html>`;
mkdirSync(OUT, { recursive: true });
const write = (name, title, body) => {
  const html = page(title, inlineMarkup(body));
  writeFileSync(join(OUT, name), html);
  console.log(`wrote ${join(OUT, name)} (${(html.length / 1024).toFixed(0)} KB, ${(body.match(/(srcSet|src)="\/img\//g) || []).length} images inlined, 0 external references)`);
};
const home = await buildHomeLivingApp({ cartCount: 3 });
write('homeliving-home.html', 'SSR — Home &amp; Living home', home.render('/homeliving'));
if (home.modules.category) {
  const listing = await buildHomeLivingApp({ cartCount: 3, initial: LISTING });
  write('homeliving-category-bedsheets.html', 'SSR — Home &amp; Living: Bedsheets', listing.render('/homeliving/category/bedsheets'));
  write('homeliving-category-bedsheets-filtered.html', 'SSR — Home &amp; Living: Bedsheets, King · Sage, list', listing.render('/homeliving/category/bedsheets?size=King&colour=Sage&sort=price-desc&view=list'));
  if (listing.modules.pdp) {
    const pdp = await buildHomeLivingApp({ cartCount: 3, initial: PDP });
    write('homeliving-product-sage-fitted-sheet.html', 'SSR — Home &amp; Living: Sage Fitted Sheet (three images, size × colour)', pdp.render('/homeliving/p/sage-fitted-sheet?size=King&colour=Sage'));
    write('homeliving-product-botanical-bedsheet-set.html', 'SSR — Home &amp; Living: Botanical Bedsheet Set (one image, no variants)', pdp.render('/homeliving/p/botanical-bedsheet-set-king'));
  }
}
