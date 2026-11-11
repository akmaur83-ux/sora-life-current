// ============================================================
// GET /feed/products.xml (rewritten by vercel.json to /api/sitemap?feed=products,
// which hands it here: the plan allows twelve functions; owner, 2026-11-10:
// features for promotion)
//
// The product feed for Google Merchant Center (free listings in Google Shopping
// and Search, and Shopping ads) and for Meta Commerce Manager (the Facebook and
// Instagram shop, and catalogue ads). One RSS 2.0 file with the g: fields both
// read: id, title, description, link, picture, price (and sale price when there is
// a real discount), availability, brand, condition. Every active wellness, Fashion
// and Home & Living product with a price and a picture; demo rows left out.
//
// Reads with the public key only the rows anyone can see; nothing private. Cached at
// the edge for an hour, so a price changed in the admin reaches the feed within it.
// ============================================================
const ORIGIN = 'https://www.soralifestyle.in';
const SITE = 'SORA LIFESTYLE';
const SLUG = /^[a-z0-9][a-z0-9-]{0,160}$/i;

const xml = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const text = (s, n) => { const t = String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t; };
const abs = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const inr = (n) => `${(Math.round(n * 100) / 100).toFixed(2)} INR`;

/** A wellness row's prices as the storefront shows them (src/data/products.js). */
export function wellnessPrices(r) {
  const mrp = num(r.original_price);
  if (!(mrp > 0)) return null;
  const pct = num(r.discount_percent);
  const sale = r.sale_price != null && num(r.sale_price) > 0 ? Math.round(num(r.sale_price)) : Math.round(mrp * (1 - pct / 100));
  return { mrp, price: sale > 0 && sale < mrp ? sale : mrp };
}

/** A Fashion or Home & Living row's prices (homelivingHomepage.js priceOf). */
export function cataloguePrices(r) {
  const mrp = num(r.mrp);
  const sale = r.sale_price == null ? 0 : num(r.sale_price);
  const price = sale > 0 && sale < mrp ? sale : mrp;
  return price > 0 ? { mrp, price } : null;
}

const STORE = {
  fashion: { href: (s) => `/fashion/p/${s}`, label: 'Fashion' },
  homeliving: { href: (s) => `/homeliving/p/${s}`, label: 'Home & Living' },
};

/** Feed items from the rows; pure, so a test can call it. */
export function feedItems({ wellness = [], catalogue = [] } = {}) {
  const items = [];
  for (const r of wellness) {
    if (!r || !SLUG.test(r.slug || '') || !r.image_url) continue;
    const p = wellnessPrices(r);
    if (!p) continue;
    items.push({
      id: `W-${r.id}`, title: r.name, description: r.description || r.name, link: `/product/${r.slug}`,
      image: r.image_url, extra: (Array.isArray(r.gallery_urls) ? r.gallery_urls : []).filter((u) => u && u !== r.image_url),
      ...p, inStock: num(r.stock) > 0, brand: r.brand || SITE, type: `Wellness > ${r.category || 'Health & wellness'}`,
    });
  }
  for (const r of catalogue) {
    const store = STORE[r?.store];
    if (!store || r.is_demo || !SLUG.test(r.slug || '')) continue;
    const pics = (Array.isArray(r.images) ? r.images : []).filter(Boolean);
    if (!pics.length) continue;
    const p = cataloguePrices(r);
    if (!p) continue;
    const variants = (Array.isArray(r.variants) ? r.variants : []).filter((v) => v && v.is_active !== false);
    const inStock = variants.length ? variants.some((v) => num(v.stock) > 0) : num(r.stock) > 0;
    items.push({
      id: `${r.store === 'fashion' ? 'F' : 'H'}-${r.id}`, title: r.name, description: r.description || r.name, link: store.href(r.slug),
      image: pics[0], extra: pics.slice(1), ...p, inStock, brand: r.brand || SITE, type: store.label,
    });
  }
  return items;
}

/** The RSS document; pure. */
export function buildFeed(items) {
  const body = items.map((it) => {
    const sale = it.price < it.mrp;
    return [
      '    <item>',
      `      <g:id>${xml(it.id)}</g:id>`,
      `      <title>${xml(text(it.title, 150))}</title>`,
      `      <description>${xml(text(it.description, 4900))}</description>`,
      `      <link>${xml(abs(it.link))}</link>`,
      `      <g:image_link>${xml(abs(it.image))}</g:image_link>`,
      ...it.extra.slice(0, 10).map((u) => `      <g:additional_image_link>${xml(abs(u))}</g:additional_image_link>`),
      `      <g:availability>${it.inStock ? 'in_stock' : 'out_of_stock'}</g:availability>`,
      `      <g:price>${inr(sale ? it.mrp : it.price)}</g:price>`,
      ...(sale ? [`      <g:sale_price>${inr(it.price)}</g:sale_price>`] : []),
      `      <g:brand>${xml(text(it.brand, 70))}</g:brand>`,
      '      <g:condition>new</g:condition>',
      '      <g:identifier_exists>no</g:identifier_exists>',
      `      <g:product_type>${xml(it.type)}</g:product_type>`,
      '    </item>',
    ].join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>${SITE}</title>\n    <link>${ORIGIN}</link>\n    <description>${SITE} products: wellness, fashion and home</description>\n${body}\n  </channel>\n</rss>\n`;
}

/** Every matching row, a thousand at a time (the API's own cap per read). */
export async function readRows(url, key, table, query, fetchImpl = fetch, page = 1000) {
  const out = [];
  try {
    for (let offset = 0; offset < 20000; offset += page) {
      const res = await fetchImpl(`${url}/rest/v1/${table}?${query}&limit=${page}&offset=${offset}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(9000) });
      if (!res.ok) break;
      const rows = await res.json();
      if (!Array.isArray(rows)) break;
      out.push(...rows);
      if (rows.length < page) break;
    }
  } catch { /* what was read so far */ }
  return out;
}

export async function feedHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  let wellness = [], catalogue = [];
  if (url && key) {
    [wellness, catalogue] = await Promise.all([
      readRows(url, key, 'products', 'select=id,name,slug,description,category,image_url,gallery_urls,original_price,discount_percent,sale_price,stock,brand&is_active=eq.true&order=sort_order.asc,id.asc'),
      readRows(url, key, 'catalogue_products', 'select=id,store,name,slug,brand,description,mrp,sale_price,images,stock,is_demo,variants:catalogue_variants(stock,is_active)&is_active=eq.true&store=in.(fashion,homeliving)&order=sort_order.asc,id.asc'),
    ]);
  }
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(buildFeed(feedItems({ wellness, catalogue })));
}
