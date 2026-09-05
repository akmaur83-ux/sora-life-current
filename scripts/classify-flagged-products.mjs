// ============================================================
// SORA LIFE — split the claims-screening report into two decisions
//
//   node scripts/classify-flagged-products.mjs
//   node scripts/classify-flagged-products.mjs --compare <old-flagged.csv>
//
// READ-ONLY. Reads reports/biosash-ingest-flagged.csv and sorts each flagged
// product into one of two buckets:
//
//   THERAPEUTIC — the copy names a disease or condition. Excluded from launch.
//   COSMETIC    — flagged only by the screen's vocabulary (generic treatment
//                 verbs, or "infection" on a wash/soap), with no condition
//                 named. Stays sellable; description withheld pending a
//                 rewrite.
//
// The distinction matters because the consequence changed. The screen was
// tuned to over-flag when the cost was a withheld description; once a flag
// means a delisted product, "remedy" appearing in a bathing bar's copy is not
// grounds for pulling it from the shop.
//
// --compare diffs against an earlier report and names every product that
// moved bucket, appeared, or disappeared — so a re-run of the screen can never
// silently change which products get switched off.
// ============================================================
import { readFileSync, existsSync } from 'node:fs';

const CSV = 'reports/biosash-ingest-flagged.csv';

// Generic treatment language: a claim shape, but no condition attached.
const VERBS = new Set([
  'cure', 'cures', 'curing', 'treat', 'treats', 'treating', 'treatment of',
  'remedy', 'remedies', 'heals', 'healing of', 'prevents disease',
  'medicine for', 'medicinal use', 'therapeutic', 'clinically proven',
  'doctor recommended', 'prescription',
]);

// "Infection" is the one condition word that routinely appears on ordinary
// cosmetics — "helps prevent infection" on a face wash or a soap is an
// antibacterial cosmetic claim, not a therapeutic one.
//
// But that reading depends entirely on WHAT THE PRODUCT IS. The same sentence
// on a swallowed capsule is a therapeutic claim, and an immunity supplement
// promising to "protect the body against infections" was landing in the
// cosmetic bucket on the strength of the word alone. So the softening applies
// only to topical categories; anything ingested is judged on the plain
// meaning of the term.
const SOFT = new Set(['infection']);
const TOPICAL_CATEGORIES = new Set([
  'skin-care', 'bath-body', 'hair-care', 'personal-care', 'mens-care',
]);

const splitRow = (line) => {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i += 1; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

/**
 * Header-driven, not positional.
 *
 * --compare has to read reports written before the category column existed.
 * With fixed indices the older layout would be read one column out — a URL
 * parsed as a category, the wrong field as the term list — and the resulting
 * diff would have looked plausible and been nonsense.
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const head = splitRow(lines[0]).map((h) => h.trim());
  const iSlug = head.indexOf('slug');
  const iCat = head.indexOf('category');
  const iTerms = head.indexOf('matched_terms');
  const iId = head.indexOf('product_id');
  if (iSlug < 0 || iTerms < 0) throw new Error(`unrecognised report layout: ${lines[0].slice(0, 120)}`);
  return lines.slice(1).map((line) => {
    const out = splitRow(line);
    return {
      id: iId >= 0 ? out[iId] : '',
      slug: out[iSlug],
      category: iCat >= 0 ? out[iCat] : '',
      terms: (out[iTerms] || '').split(';').map((s) => s.trim()).filter(Boolean),
    };
  });
}

const classify = (terms, category) => {
  const soft = TOPICAL_CATEGORIES.has(String(category || '')) ? SOFT : new Set();
  return terms.every((t) => VERBS.has(t) || soft.has(t)) ? 'COSMETIC' : 'THERAPEUTIC';
};

const rows = parseCsv(readFileSync(CSV, 'utf8'));
const bucket = new Map(rows.map((r) => [r.slug, { ...r, kind: classify(r.terms, r.category) }]));
const therapeutic = [...bucket.values()].filter((r) => r.kind === 'THERAPEUTIC');
const cosmetic = [...bucket.values()].filter((r) => r.kind === 'COSMETIC');

console.log(`\nFlagged ${rows.length} · therapeutic ${therapeutic.length} · cosmetic ${cosmetic.length}\n`);
console.log(`THERAPEUTIC — exclude from launch (${therapeutic.length})`);
for (const r of therapeutic) console.log(`   ${r.slug.padEnd(42)} ${String(r.category).padEnd(14)} ${r.terms.join(', ')}`);
console.log(`\nCOSMETIC — keep sellable, withhold copy (${cosmetic.length})`);
for (const r of cosmetic) console.log(`   ${r.slug.padEnd(42)} ${String(r.category).padEnd(14)} ${r.terms.join(', ')}`);

const compareIdx = process.argv.indexOf('--compare');
if (compareIdx > 0) {
  const prev = process.argv[compareIdx + 1];
  if (!prev || !existsSync(prev)) { console.log(`\n--compare: ${prev} not found`); process.exit(1); }
  const before = new Map(parseCsv(readFileSync(prev, 'utf8')).map((r) => [r.slug, { ...r, kind: classify(r.terms, r.category) }]));

  const moved = [], added = [], dropped = [];
  for (const [slug, now] of bucket) {
    const was = before.get(slug);
    if (!was) added.push(now);
    else if (was.kind !== now.kind) moved.push({ slug, from: was.kind, to: now.kind, was: was.terms, now: now.terms });
  }
  for (const [slug, was] of before) if (!bucket.has(slug)) dropped.push(was);

  console.log('\n— CHANGES vs ' + prev + ' —');
  console.log(`  no longer flagged at all (${dropped.length}):`);
  for (const r of dropped) console.log(`     ${r.slug.padEnd(42)} was ${r.kind}: ${r.terms.join(', ')}`);
  console.log(`  newly flagged (${added.length}):`);
  for (const r of added) console.log(`     ${r.slug.padEnd(42)} ${r.kind}: ${r.terms.join(', ')}`);
  console.log(`  moved bucket (${moved.length}):`);
  for (const m of moved) {
    console.log(`     ${m.slug.padEnd(42)} ${m.from} -> ${m.to}`);
    console.log(`         was: ${m.was.join(', ')}`);
    console.log(`         now: ${m.now.join(', ')}`);
  }
  if (!dropped.length && !added.length && !moved.length) console.log('     none — the split is unchanged.');
}
