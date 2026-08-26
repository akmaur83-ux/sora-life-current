// ============================================================
// Juice catalogue audit (READ-ONLY)
//
// Pulls every active product from the live database, isolates the juices, and
// prints them with the fields needed to decide variant eligibility:
//   - our FK (id), biosash_id, slug, source_url (official identity)
//   - original_price / sale_price / discount_percent (our pricing rule)
//   - which already have variant rows
//
// No writes. Uses the public publishable key from the bundle.
// ============================================================
import { readFileSync } from 'node:fs';

const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
if (!URL_ || !KEY) { console.error('No Supabase config in bundle.'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function q(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
  if (!r.ok) { console.error(`Query failed ${r.status}: ${path}`); return []; }
  return r.json();
}

const products = await q('products?select=id,biosash_id,slug,name,category,original_price,sale_price,discount_percent,source_url,is_active&is_active=eq.true&order=name');
const variants = await q('product_variants?select=product_id,label,size,unit,mrp,sale_price,sku,is_active&order=sort_order');

const varsByProduct = {};
for (const v of variants) (varsByProduct[v.product_id] ||= []).push(v);

// A product is a "juice" if its category says so or its name contains juice.
const isJuice = (p) =>
  /juice/i.test(p.name) ||
  /juice/i.test(p.category || '') ||
  /juice/i.test(p.slug || '');

const juices = products.filter(isJuice);

console.log(`\n=== CATALOGUE SUMMARY ===`);
console.log(`Total active products: ${products.length}`);
console.log(`Juice products:        ${juices.length}`);
console.log(`Existing variant rows: ${variants.length}`);
console.log(`Products with variants:${Object.keys(varsByProduct).length}`);

console.log(`\n=== JUICE PRODUCTS ===`);
const rows = juices.map((p) => {
  const vs = varsByProduct[p.id] || [];
  return {
    id: p.id,
    biosash_id: p.biosash_id,
    name: p.name,
    slug: p.slug,
    mrp: p.original_price,
    price: p.sale_price,
    disc: p.discount_percent,
    variants: vs.length,
    variantLabels: vs.map((v) => v.label).join('/') || '-',
    source_url: p.source_url || '(none)',
  };
});
for (const r of rows) {
  console.log(
    `${String(r.biosash_id).padEnd(7)} id=${String(r.id).padEnd(4)} ` +
    `MRP ${String(r.mrp).padEnd(5)} price ${String(r.price).padEnd(5)} ${String(r.disc).padStart(2)}%off ` +
    `vars=${r.variants}(${r.variantLabels})  ${r.name}`,
  );
}

// Emit machine-readable JSON for the cross-reference step.
console.log(`\n=== JSON ===`);
console.log(JSON.stringify(rows, null, 0));
