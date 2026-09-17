// ============================================================
// Fashion store — render a fixed set of pages with the seeded catalogue and
// print them as JSON. Run once against the working tree and once with
// FASHION_SRC_ROOT pointed at another checkout, and diff: the catalogue
// suite (test-catalogue.mjs) uses this to prove the fashion pages render
// byte-identically before and after the data layer moved to catalogue_*.
//
//   node scripts/fashion-ssr-dump.mjs
//   FASHION_SRC_ROOT=<checkout> node scripts/fashion-ssr-dump.mjs
// ============================================================
import { buildFashionApp } from './fashion-ssr.mjs';

export const PAGES = [
  '/fashion',
  '/fashion/c/clothing',
  '/fashion/c/mens-shirts?size=M&colour=Navy&view=list',
  '/fashion/p/meadow-linen-shirt-sage',
  '/fashion/p/meadow-linen-shirt-sage?size=M&colour=Sage',
  '/fashion/p/meadow-linen-shirt-sage?size=M&colour=Navy',
  '/fashion/search?q=sage',
  '/fashion/wishlist',
];

const app = await buildFashionApp({ cartCount: 4, wishlist: ['00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000504'] });
const out = {};
for (const p of PAGES) out[p] = app.render(p);
process.stdout.write(JSON.stringify(out));
