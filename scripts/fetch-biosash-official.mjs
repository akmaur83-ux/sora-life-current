// ============================================================
// Fetch OFFICIAL Biosash variant data for every juice (READ-ONLY, external)
//
// For each juice's official product slug (taken from our stored source_url),
// query the public WooCommerce Store API and report the ground truth:
//   - product type: "variable" (has pack sizes) vs "simple" (single size)
//   - the exact size options offered
//   - official price range (min = smallest pack, max = largest pack)
//
// This is the SOURCE OF TRUTH for sizes and MRP. We invent nothing.
// ============================================================

const JUICES = JSON.parse(process.argv[2] || '[]');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function officialSlug(sourceUrl) {
  const m = String(sourceUrl || '').match(/\/product\/([^/]+)\/?/);
  return m ? m[1] : null;
}

async function fetchStore(host, slug) {
  const url = `https://${host}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) return { ok: false, status: r.status };
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) return { ok: false, status: 'empty' };
    return { ok: true, product: arr[0] };
  } catch (e) {
    return { ok: false, status: e.message };
  }
}

// Prefer .com (where the Store API is known to answer); fall back to .in.
async function official(slug) {
  let r = await fetchStore('biosash.com', slug);
  if (!r.ok) r = await fetchStore('biosash.in', slug);
  return r;
}

const out = [];
for (const j of JUICES) {
  const slug = officialSlug(j.source_url);
  if (!slug) { out.push({ ...j, official: 'no-source-url' }); continue; }
  const r = await official(slug);
  if (!r.ok) { out.push({ ...j, officialSlug: slug, official: `unreachable(${r.status})` }); continue; }
  const p = r.product;
  const sizeAttr = (p.attributes || []).find((a) => /size|volume|pack|quantity|ml/i.test(a.name || a.taxonomy || ''));
  const sizes = sizeAttr ? sizeAttr.terms.map((t) => t.name) : [];
  out.push({
    id: j.id, biosash_id: j.biosash_id, name: j.name, ourMrp: j.mrp, ourPrice: j.price, ourDisc: j.disc,
    ourVariants: j.variants,
    officialSlug: slug,
    type: p.type,
    sizeAttrName: sizeAttr ? sizeAttr.name : null,
    sizes,
    priceMin: p.prices?.price_range?.min_amount ? Number(p.prices.price_range.min_amount) / Math.pow(10, p.prices.currency_minor_unit || 2) : Number(p.prices?.price || 0) / Math.pow(10, p.prices?.currency_minor_unit || 2),
    priceMax: p.prices?.price_range?.max_amount ? Number(p.prices.price_range.max_amount) / Math.pow(10, p.prices.currency_minor_unit || 2) : Number(p.prices?.price || 0) / Math.pow(10, p.prices?.currency_minor_unit || 2),
  });
  process.stderr.write('.');
}
process.stderr.write('\n');

console.log('=== OFFICIAL DATA ===');
for (const o of out) {
  if (o.official) { console.log(`${String(o.biosash_id).padEnd(7)} ${o.name}\n   -> ${o.official} (slug ${o.officialSlug || '?'})`); continue; }
  console.log(
    `${String(o.biosash_id).padEnd(7)} ${o.name}\n` +
    `   type=${o.type} sizes=[${o.sizes.join(', ')}] official=₹${o.priceMin}..₹${o.priceMax} ` +
    `| ours: MRP ${o.ourMrp} price ${o.ourPrice} ${o.ourDisc}%off vars=${o.ourVariants}`,
  );
}
console.log('\n=== JSON ===');
console.log(JSON.stringify(out));
