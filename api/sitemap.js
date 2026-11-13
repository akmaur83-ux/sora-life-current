// ============================================================
// GET /sitemap.xml (rewritten here by vercel.json)
//
// The site's sitemap for search engines, built live from the catalogue so a
// product added in the admin is listed without a deploy: the public pages,
// every active wellness product (/product/:slug), and the active Fashion and
// Home & Living products (/fashion/p/:slug, /homeliving/p/:slug). Grocery is
// left out because it cannot be bought yet.
//
// Reads only what the storefront already reads, with the public key (the
// same rows anyone can see); no service-role key here. A read that fails
// still yields the public pages, never an error page. Cached at the edge
// for an hour.
// ============================================================
import { shareHandler } from './_lib/share.js';
import { feedHandler } from './_lib/feed.js';

const ORIGIN = 'https://www.soralifestyle.in';

export const STATIC_PATHS = [
  '/', '/shop', '/offers', '/brands', '/fashion', '/homeliving', '/lifestyle', '/grocery',
  '/about', '/contact', '/shipping', '/returns', '/privacy', '/terms',
  '/refund-policy', '/shipping-policy', '/grievance',
];

const STORE_HREF = {
  fashion: (slug) => `/fashion/p/${slug}`,
  homeliving: (slug) => `/homeliving/p/${slug}`,
};

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const SLUG = /^[a-z0-9][a-z0-9-]*$/i;

async function readRows(url, key, table, query) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** The <urlset> for the given rows; pure, so a test can call it. */
export function buildSitemap({ wellness = [], catalogue = [] } = {}) {
  const seen = new Set();
  const entries = [];
  const add = (path, lastmod) => {
    if (seen.has(path)) return;
    seen.add(path);
    const day = lastmod && !Number.isNaN(Date.parse(lastmod)) ? new Date(lastmod).toISOString().slice(0, 10) : null;
    entries.push(`  <url><loc>${xmlEscape(ORIGIN + path)}</loc>${day ? `<lastmod>${day}</lastmod>` : ''}</url>`);
  };
  for (const p of STATIC_PATHS) add(p);
  for (const r of wellness) if (SLUG.test(r?.slug || '')) add(`/product/${r.slug}`, r.updated_at);
  for (const r of catalogue) {
    const href = STORE_HREF[r?.store];
    if (href && SLUG.test(r?.slug || '')) add(href(r.slug), r.updated_at);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

export default async function handler(req, res) {
  // A product page with its share card (api/_lib/share.js): the same function, as the plan allows twelve.
  if (req.query?.kind) return shareHandler(req, res);
  // The product feed for Google Shopping and Meta catalogues (api/_lib/feed.js), here for the same reason.
  if (req.query?.feed === 'products') return feedHandler(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  let wellness = [];
  let catalogue = [];
  if (url && key) {
    [wellness, catalogue] = await Promise.all([
      readRows(url, key, 'products', 'select=slug,updated_at&is_active=eq.true&order=sort_order.asc&limit=5000'),
      readRows(url, key, 'catalogue_products', 'select=store,slug,updated_at&is_active=eq.true&store=in.(fashion,homeliving)&order=sort_order.asc&limit=5000'),
    ]);
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(buildSitemap({ wellness, catalogue }));
}
