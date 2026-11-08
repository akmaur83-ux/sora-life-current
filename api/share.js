// ============================================================
// GET /product/:slug, /fashion/p/:slug, /homeliving/p/:slug (rewritten here by
// vercel.json; owner, 2026-11-08: more features)
//
// A product link pasted into WhatsApp, Instagram or Facebook shows a card built
// from the page's <head>, read by a bot that does not run JavaScript, so every
// product used to share as the bare site name. This serves the same app page
// (index.html, unchanged otherwise) with that product's title, description,
// picture and price in the <head>, and its Product data for search engines. The
// app then starts exactly as before.
//
// Reads with the public key only the rows anyone can see. Anything missing or
// failing serves index.html as it is: a share card is decoration, never a reason
// for a product page not to open. Cached at the edge for ten minutes.
// ============================================================
import { readFileSync } from 'node:fs';

const ORIGIN = 'https://www.soralifestyle.in';
const SITE = 'SORA LIFESTYLE';
const SLUG = /^[a-z0-9][a-z0-9-]{0,160}$/i;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { const t = String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t; };
const abs = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`);
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

let shell = null;
function readShell() {
  if (shell) return shell;
  try { shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8'); } catch { shell = null; }
  return shell;
}

async function readRow(url, key, table, query) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch { return null; }
}

/** The page's facts from a row: { title, description, image, price, mrp, brand, inStock, path }. Pure. */
export function shareFacts(kind, row, slug) {
  if (!row) return null;
  if (kind === 'product') {
    const mrp = Number(row.original_price) || 0;
    const price = Number(row.sale_price) > 0 ? Number(row.sale_price) : mrp;
    return { name: row.name, description: row.description, image: row.image_url, price, mrp, brand: row.brand, inStock: Number(row.stock) > 0, path: `/product/${slug}` };
  }
  const mrp = Number(row.mrp) || 0;
  const price = row.sale_price != null && Number(row.sale_price) > 0 && Number(row.sale_price) < mrp ? Number(row.sale_price) : mrp;
  const image = Array.isArray(row.images) ? row.images.find(Boolean) : null;
  const variants = Array.isArray(row.catalogue_variants) ? row.catalogue_variants.filter((v) => v.is_active !== false) : [];
  const inStock = variants.length ? variants.some((v) => Number(v.stock) > 0) : Number(row.stock) > 0;
  return { name: row.name, description: row.description, image, price, mrp, brand: row.brand, inStock, path: kind === 'fashion' ? `/fashion/p/${slug}` : `/homeliving/p/${slug}` };
}

/** index.html with the product's head; pure, so a test can call it. */
export function withProductHead(html, f) {
  if (!html || !f || !f.name || !(f.price > 0)) return html;
  const off = f.mrp > f.price ? ` (${Math.round((1 - f.price / f.mrp) * 100)}% off)` : '';
  const title = `${f.name} — ${rupees(f.price)}${off} | ${SITE}`;
  const desc = clip(f.description || `${f.name}${f.brand ? ` by ${f.brand}` : ''}. Free delivery in 6–7 business days, cash on delivery available.`, 180);
  const url = `${ORIGIN}${f.path}`;
  const image = abs(f.image);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: f.name, ...(image ? { image: [image] } : {}),
    ...(f.brand ? { brand: { '@type': 'Brand', name: f.brand } } : {}), description: desc,
    offers: { '@type': 'Offer', url, priceCurrency: 'INR', price: Number(f.price).toFixed(2), availability: f.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition' },
  };
  const head = [
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta property="product:price:amount" content="${Number(f.price).toFixed(2)}" />`,
    `<meta property="product:price:currency" content="INR" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n    ');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace('</head>', `    ${head}\n  </head>`);
}

export default async function handler(req, res) {
  const kind = String(req.query?.kind || '');
  const slug = String(req.query?.slug || '');
  let html = readShell();
  if (!html) {
    try { const r = await fetch(`${ORIGIN}/`, { signal: AbortSignal.timeout(4000) }); html = r.ok ? await r.text() : ''; } catch { html = ''; }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!html) return res.status(500).send('<!doctype html><title>SORA LIFESTYLE</title><p>Please refresh the page.</p>');
  let facts = null;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key && SLUG.test(slug) && ['product', 'fashion', 'homeliving'].includes(kind)) {
    const row = kind === 'product'
      ? await readRow(url, key, 'products', `select=name,description,image_url,original_price,sale_price,brand,stock&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`)
      : await readRow(url, key, 'catalogue_products', `select=name,description,images,mrp,sale_price,brand,stock,catalogue_variants(stock,is_active)&store=eq.${kind}&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`);
    facts = shareFacts(kind, row, slug);
  }
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  return res.status(200).send(withProductHead(html, facts));
}
