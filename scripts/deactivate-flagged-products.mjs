// ============================================================
// SORA LIFE — deactivate claim-flagged products
//
//   node scripts/deactivate-flagged-products.mjs --dry-run   (default; touches nothing)
//   node scripts/deactivate-flagged-products.mjs --live
//   node scripts/deactivate-flagged-products.mjs --live --restore   (undo)
//
// Sets is_active = false on an EXPLICIT slug list. It does not delete, it does
// not read the flagged CSV directly, and it will not act on a slug that is not
// written into THERAPEUTIC below.
//
// The list is hard-coded on purpose. Reading it from the screening report
// would mean a re-run with a widened term list could silently delist more of
// the catalogue; a launch-day switch-off of sellable products should be a
// diff someone approved, not a side effect of tuning a regex.
//
// --restore sets the same slugs back to is_active = true, so this is
// reversible in one command.
// ============================================================
import { readFileSync } from 'node:fs';

const ARGS = new Set(process.argv.slice(2));
const LIVE = ARGS.has('--live');
const RESTORE = ARGS.has('--restore');

// Products whose source copy names a disease or asserts a treatment effect.
// Excluded from launch entirely pending a copy rewrite.
const THERAPEUTIC = [
  'orthosash-capsule',
  'immunosash-capsules-30-capsules',
  'black-seed-oil-capsule',
  'nonisash',
  'sea-buckthorn-oil-capsule',
  'spirusash-capsule',
  'whegasash-tablets',
  'seabuckthorn-trimfit-juice',
  'seabuckthorn-empower-x-juice',
  'seabuckthorn-ferrosash-juice',
  'seabuckthorn-stressaid-juice',
  'seabuckthorn-giloysash-juice',
  'seabuckthorn-empower-juice',
  'seabuckthorn-femsash-juice',
  'seabuckthorn-digestosash-juice',
  'empower-x-tablets',
  'panch-tulsi-drops',
  'seabuckthorn-cardiosash-juice',
  'leucosash-capsule',
  'fresh-turmeric-rhizome-juice-with-guggul',
  'seabuckthorn-biosip',
  'seabuckthorn-with-turmeric-oil',
  'seabuckthorn-memorysash-juice',
  'wellsash-capsules-60-capsules',
  'seabuckthorn-livosash-juice',
  'diabosash-capsules',
  'orthosash-pain-oil',
  'calsash-tablets',
  'liver-kidney-support',
];

// Cosmetics caught by the screen's vocabulary rather than by a real claim.
// These STAY SELLABLE. Listed here only so the split is visible in one place
// and nobody has to reconstruct it from a report later; this script never
// touches them.
const COSMETIC_KEEP = [
  'coconut-natural-face-wash',
  'milk-chocolate-cream-detangle-shampoo',
  'tulsi-haldi-face-wash',
  'neem-tulsi-bath',
  'liquid-wash-intimate-women',
  'dentosash',
  'after-shave-lotion-for-men',
  'neem-tulsi-face-wash',
  'aloe-vera-and-neem-face-wash',
  'natural-seabuckthorn-bathing-bar',
  'sesame-hair-oil',
  'beard-wash',
  'multani-mitti-bathing-bar',
];

function env(name) {
  const line = readFileSync('.env.local', 'utf8')
    .split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null;
}
const SUPABASE_URL = env('VITE_SUPABASE_URL');
const READ_KEY = env('VITE_SUPABASE_PUBLISHABLE_KEY');
const WRITE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !READ_KEY) { console.error('Missing Supabase config in .env.local'); process.exit(1); }
if (LIVE && !WRITE_KEY) { console.error('--live needs SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }

const target = RESTORE ? true : false;

(async () => {
  const H = { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,slug,name,is_active&limit=1000`, { headers: H });
  if (!r.ok) { console.error(`products read failed: ${r.status}`); process.exit(1); }
  const all = await r.json();
  const bySlug = new Map(all.map((p) => [p.slug, p]));

  const found = [], missing = [], already = [];
  for (const slug of THERAPEUTIC) {
    const p = bySlug.get(slug);
    if (!p) { missing.push(slug); continue; }
    if (p.is_active === target) { already.push(p); continue; }
    found.push(p);
  }

  console.log(`\n${RESTORE ? 'RESTORE' : 'DEACTIVATE'} · mode ${LIVE ? 'LIVE' : 'DRY RUN'}`);
  console.log(`Catalogue ${all.length} · list ${THERAPEUTIC.length} · cosmetics deliberately untouched ${COSMETIC_KEEP.length}\n`);

  console.log(`WOULD SET is_active = ${target} ON ${found.length}:`);
  for (const p of found) console.log(`   ${String(p.id).padStart(4)}  ${p.slug.padEnd(42)} ${p.name}`);
  if (already.length) {
    console.log(`\nALREADY is_active = ${target} (${already.length}):`);
    for (const p of already) console.log(`   ${p.slug}`);
  }
  if (missing.length) {
    // A slug in the list that no longer exists is worth shouting about: it
    // means the list and the catalogue have drifted apart.
    console.log(`\nNOT FOUND IN CATALOGUE (${missing.length}) — check these:`);
    for (const s of missing) console.log(`   ${s}`);
  }

  // Sanity gate. If the list ever grows to a large slice of the catalogue,
  // stop and make a human look rather than switching the shop off.
  const share = found.length / (all.length || 1);
  if (share > 0.35) {
    console.log(`\nREFUSING: that is ${(share * 100).toFixed(0)}% of the catalogue. Review the list first.`);
    process.exit(1);
  }

  if (!LIVE) {
    console.log('\nDry run — nothing was written.');
    return;
  }

  let ok = 0, failed = 0;
  for (const p of found) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: {
        apikey: WRITE_KEY,
        Authorization: `Bearer ${WRITE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ is_active: target }),
    });
    if (res.ok) ok += 1;
    else { failed += 1; console.log(`   FAILED ${p.slug}: ${res.status} ${(await res.text()).slice(0, 120)}`); }
  }
  console.log(`\nUpdated ${ok} · failed ${failed}`);
})();
