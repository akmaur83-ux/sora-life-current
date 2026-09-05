// ============================================================
// Post-migration verification for 0025_product_content_fields.sql
//
// READ-ONLY. Performs no writes and no DDL. Uses the PUBLIC publishable key
// (the same one the browser uses), so it also proves the new columns are
// readable by anonymous callers — they are public product fields — while the
// table's existing write gate is untouched.
//
// Run: node scripts/verify-migration-0025.mjs
// ============================================================
import { readFileSync } from 'node:fs';

const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
if (!URL_ || !KEY) { console.error('Could not read Supabase config from bundle.'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass += 1; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail += 1; };

async function q(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
  let body = null;
  try { body = JSON.parse(await r.text()); } catch { /* empty */ }
  return { status: r.status, body };
}

const COLUMNS = [
  'brand', 'benefits', 'ingredients', 'how_to_use', 'specifications',
  'key_claims', 'net_content', 'content_source', 'content_updated_at',
];

console.log('\n— 0025: content columns exist and are readable —');

for (const col of COLUMNS) {
  const r = await q(`products?select=id,${col}&limit=1`);
  // PostgREST reports an unknown column as 42703, which is exactly the
  // signal that the migration has not been applied.
  if (r.status === 400 && r.body?.code === '42703') bad(`products.${col} does NOT exist — migration not applied`);
  else if (r.status === 200) ok(`products.${col} exists and is readable`);
  else bad(`products.${col} unexpected ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
}

console.log('\n— Nothing was given a masking default —');

// The whole point of leaving these NULL is that "not authored yet" stays
// distinguishable from "authored as empty". A default of '[]' or '' would
// erase that difference on all 164 rows at once, so a fresh table full of
// non-null content columns means the migration was applied wrongly.
const all = await q(`products?select=${COLUMNS.join(',')}&limit=1000`);
if (all.status !== 200 || !Array.isArray(all.body)) {
  bad(`could not read products for the default check (${all.status})`);
} else {
  const rows = all.body;
  for (const col of ['benefits', 'ingredients', 'how_to_use', 'specifications', 'key_claims']) {
    const nonNull = rows.filter((r) => r[col] !== null && r[col] !== undefined).length;
    if (nonNull === rows.length && rows.length > 0) {
      bad(`every row has a non-null ${col} — a default was applied, which masks emptiness`);
    } else {
      ok(`${col}: ${nonNull}/${rows.length} populated (NULL still means "not authored")`);
    }
  }
}

console.log('\n— Existing columns untouched —');

const priced = await q('products?select=id,original_price,sale_price,discount_percent&limit=5');
if (priced.status === 200 && Array.isArray(priced.body) && priced.body.length) {
  ok('price columns still present and readable');
} else {
  bad(`price columns unreadable after migration (${priced.status})`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exitCode = fail ? 1 : 0;
