// ============================================================
// SORA LIFE — strip HTML out of already-stored product copy
//
//   node scripts/clean-stored-html.mjs --dry-run   (default; touches nothing)
//   node scripts/clean-stored-html.mjs --live
//
// The first live ingest stored the source's markup verbatim, so 50 of 122
// descriptions and 6 how_to_use entries carry `<p>` and `<span>` tags that the
// PDP renders as literal text. The ingest itself now strips at parse time, but
// it is FILL-ONLY — it will never revisit a row it already populated — so the
// rows it already wrote need this one pass.
//
// Rewrites ONLY fields that still look like markup, and only the text inside
// them. It cannot introduce content, cannot touch a clean field, and cannot
// reach any column other than description / benefits / how_to_use / key_claims
// / specifications.
// ============================================================
import { readFileSync } from 'node:fs';
import { stripHtml, looksLikeHtml } from './lib/strip-html.mjs';

const LIVE = process.argv.includes('--live');

function env(name) {
  const line = readFileSync('.env.local', 'utf8')
    .split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null;
}
const SUPABASE_URL = env('VITE_SUPABASE_URL');
const READ_KEY = env('VITE_SUPABASE_PUBLISHABLE_KEY');
const WRITE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !READ_KEY) { console.error('Missing Supabase config'); process.exit(1); }
if (LIVE && !WRITE_KEY) { console.error('--live needs SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

/** Clean every string inside a value, whatever its shape, leaving the shape alone. */
function cleanDeep(value) {
  if (typeof value === 'string') return stripHtml(value);
  if (Array.isArray(value)) return value.map(cleanDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanDeep(v)]));
  }
  return value;
}

const hasHtmlDeep = (value) => {
  if (typeof value === 'string') return looksLikeHtml(value);
  if (Array.isArray(value)) return value.some(hasHtmlDeep);
  if (value && typeof value === 'object') return Object.values(value).some(hasHtmlDeep);
  return false;
};

const FIELDS = ['description', 'benefits', 'how_to_use', 'key_claims', 'specifications'];

(async () => {
  const H = { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` };
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,slug,${FIELDS.join(',')}&limit=1000`,
    { headers: H },
  );
  if (!r.ok) { console.error(`read failed: ${r.status}`); process.exit(1); }
  const all = await r.json();

  const jobs = [];
  for (const p of all) {
    const patch = {};
    const touched = [];
    for (const f of FIELDS) {
      if (p[f] == null || !hasHtmlDeep(p[f])) continue;
      const cleaned = cleanDeep(p[f]);
      // Never write an empty field over one that had content: a description
      // that was nothing but markup is a parsing problem to look at, not
      // something to silently blank.
      if (typeof cleaned === 'string' && !cleaned.trim()) {
        console.log(`  SKIP ${p.slug}.${f} — stripping would leave it empty`);
        continue;
      }
      patch[f] = cleaned;
      touched.push(f);
    }
    if (touched.length) jobs.push({ p, patch, touched });
  }

  console.log(`\nCLEAN STORED HTML · mode ${LIVE ? 'LIVE' : 'DRY RUN'}`);
  console.log(`Scanned ${all.length} products · ${jobs.length} need cleaning\n`);

  for (const j of jobs.slice(0, 8)) {
    console.log(`  ${j.p.slug}  [${j.touched.join(', ')}]`);
    if (typeof j.p.description === 'string' && j.patch.description) {
      console.log(`     before: ${JSON.stringify(j.p.description.slice(0, 90))}`);
      console.log(`     after : ${JSON.stringify(j.patch.description.slice(0, 90))}`);
    }
  }
  if (jobs.length > 8) console.log(`  … and ${jobs.length - 8} more`);

  const byField = {};
  for (const j of jobs) for (const f of j.touched) byField[f] = (byField[f] || 0) + 1;
  console.log('\nPer field:', Object.entries(byField).map(([k, v]) => `${k} ${v}`).join(' · ') || '(none)');

  if (!LIVE) { console.log('\nDry run — nothing was written.'); return; }

  let ok = 0, failed = 0;
  for (const j of jobs) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${j.p.id}`, {
      method: 'PATCH',
      headers: {
        apikey: WRITE_KEY,
        Authorization: `Bearer ${WRITE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      // updated_at is stamped on every write, including this one. The admin
      // editor now refuses a save whose captured updated_at no longer matches
      // the row, and that check is only as good as the writers around it: a
      // script that changes content WITHOUT moving updated_at leaves a form
      // opened beforehand holding a token that still matches, so its stale
      // values overwrite this script's work and nobody sees it happen. That is
      // exactly how the first ingest's descriptions were lost.
      body: JSON.stringify({ ...j.patch, updated_at: new Date().toISOString() }),
    });
    if (res.ok) ok += 1;
    else { failed += 1; console.log(`  FAILED ${j.p.slug}: ${res.status} ${(await res.text()).slice(0, 120)}`); }
  }
  console.log(`\nCleaned ${ok} · failed ${failed}`);
})();
