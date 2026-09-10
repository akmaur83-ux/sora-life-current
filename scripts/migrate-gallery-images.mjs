// ============================================================
// SORA LIFE — bring hotlinked gallery images onto our own storage
//
//   node scripts/migrate-gallery-images.mjs            (dry run; default)
//   node scripts/migrate-gallery-images.mjs --live
//   node scripts/migrate-gallery-images.mjs --live --limit 20
//
// Every one of the 608 entries in products.gallery_urls points at
// biosash.com. If that site moves, renames a directory or goes down, 148
// product pages lose their gallery — and three of those URLs are already
// returning 404, so the failure mode is not hypothetical.
//
// This downloads each one, uploads it to the public product-images bucket,
// and rewrites gallery_urls to our own URL.
//
// FILL-ONLY. A URL that is already on our storage, or already relative, is
// never touched. Only genuinely external URLs are candidates.
//
// IDEMPOTENT. The storage key is derived from the SOURCE url
// (gallery/<slug>/<hash>-<name>), so a second run computes the same key,
// finds the object already there, skips the upload, and finds the database
// already pointing at it, so it skips the write too. Safe to re-run as often
// as you like, including after a partial failure.
//
// NOTHING IS LOST ON FAILURE. A gallery is rewritten as a whole array in
// which each entry is either its migrated URL or — if the download failed —
// the ORIGINAL url, untouched. A product whose images all fail is not
// written at all. So a failed download degrades to "still hotlinked", never
// to "no image", and the next run retries exactly those.
// ============================================================
import { readFileSync, mkdirSync, existsSync, writeFileSync, readFileSync as readBin } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ARGS = process.argv.slice(2);
const LIVE = ARGS.includes('--live');
const LIMIT = (() => { const i = ARGS.indexOf('--limit'); return i >= 0 ? Number(ARGS[i + 1]) : Infinity; })();

const BUCKET = 'product-images';
const PREFIX = 'gallery';
const UA = 'SoraLifeBot/1.0 (+https://www.soralife.shop; migrating our own product imagery)';
// Downloads are cached outside the repo so a dry run and the live run that
// follows it do not fetch biosash.com twice.
const CACHE = join(tmpdir(), 'sora-gallery-cache');
const CONCURRENCY = 6;

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

const isOurs = (u) => !u || u.startsWith('/') || /\/\/[a-z0-9]+\.supabase\.co/.test(u);
const publicUrl = (key) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;

/** Storage key derived from the source URL, so re-runs land on the same object. */
function storageKey(slug, sourceUrl) {
  const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 12);
  const base = (sourceUrl.split('/').pop() || 'image')
    .split('?')[0].replace(/[^A-Za-z0-9._-]/g, '-').slice(-48) || 'image';
  return `${PREFIX}/${slug}/${hash}-${base}`;
}

const CTYPE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };

async function download(url) {
  mkdirSync(CACHE, { recursive: true });
  const cacheFile = join(CACHE, createHash('sha1').update(url).digest('hex'));
  const metaFile = `${cacheFile}.json`;
  if (existsSync(cacheFile) && existsSync(metaFile)) {
    return { ok: true, body: readBin(cacheFile), ...JSON.parse(readFileSync(metaFile, 'utf8')), cached: true };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length === 0) return { ok: false, reason: 'empty response' };
    const header = (r.headers.get('content-type') || '').split(';')[0].trim();
    const ext = (url.split('.').pop() || '').split('?')[0].toLowerCase();
    const contentType = header.startsWith('image/') ? header : (CTYPE[ext] || 'application/octet-stream');
    if (!contentType.startsWith('image/')) return { ok: false, reason: `not an image (${contentType})` };
    const meta = { contentType, bytes: buf.length };
    writeFileSync(cacheFile, buf);
    writeFileSync(metaFile, JSON.stringify(meta));
    return { ok: true, body: buf, ...meta, cached: false };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timed out after 30s' : e.message.slice(0, 60) };
  }
}

const objectExists = async (key) => {
  try { return (await fetch(publicUrl(key), { method: 'HEAD' })).ok; } catch { return false; }
};

async function upload(key, body, contentType) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      apikey: WRITE_KEY, Authorization: `Bearer ${WRITE_KEY}`,
      'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': '31536000',
    },
    body,
  });
  return r.ok ? { ok: true } : { ok: false, reason: `${r.status} ${(await r.text()).slice(0, 120)}` };
}

/** Run tasks with bounded concurrency. */
async function pooled(items, worker, size = CONCURRENCY) {
  const queue = items.slice();
  const out = [];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) { const item = queue.shift(); out.push(await worker(item)); }
  }));
  return out;
}

(async () => {
  const key = WRITE_KEY || READ_KEY;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,slug,name,is_active,gallery_urls&limit=1000`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) { console.error(`products read failed: ${res.status}`); process.exit(1); }
  const products = await res.json();

  // Candidates: every external gallery entry, paired with its product.
  const jobs = [];
  for (const p of products) {
    (p.gallery_urls || []).forEach((url, index) => {
      if (url && !isOurs(url)) jobs.push({ p, url, index, key: storageKey(p.slug, url) });
    });
  }
  const capped = jobs.slice(0, LIMIT === Infinity ? jobs.length : LIMIT);

  console.log(`\nGALLERY IMAGE MIGRATION · mode ${LIVE ? 'LIVE' : 'DRY RUN'}`);
  console.log(`Catalogue ${products.length} · external gallery entries ${jobs.length}`
    + (capped.length !== jobs.length ? ` · limited to ${capped.length}` : ''));
  console.log(`Target: ${BUCKET}/${PREFIX}/<slug>/<hash>-<name>\n`);

  let already = 0;
  const failures = [];
  const results = new Map();          // `${productId}:${index}` -> new url

  await pooled(capped, async (job) => {
    // Already uploaded by an earlier run? Then this entry needs no download.
    if (await objectExists(job.key)) {
      already += 1;
      results.set(`${job.p.id}:${job.index}`, publicUrl(job.key));
      return;
    }
    const got = await download(job.url);
    if (!got.ok) { failures.push({ ...job, reason: got.reason }); return; }
    if (LIVE) {
      const up = await upload(job.key, got.body, got.contentType);
      if (!up.ok) { failures.push({ ...job, reason: `upload: ${up.reason}` }); return; }
    }
    results.set(`${job.p.id}:${job.index}`, publicUrl(job.key));
  });

  // Per product, rebuild the whole array: migrated where we have a new URL,
  // ORIGINAL where we do not. Never a hole, never a shortened gallery.
  const writes = [];
  for (const p of products) {
    const urls = p.gallery_urls || [];
    if (!urls.length) continue;
    const next = urls.map((u, i) => results.get(`${p.id}:${i}`) || u);
    const changed = next.some((u, i) => u !== urls[i]);
    if (!changed) continue;
    if (next.length !== urls.length || next.some((u) => !u)) {
      console.error(`  REFUSING ${p.slug}: rebuilt gallery is not the same shape`);
      continue;
    }
    writes.push({ p, next, migrated: next.filter((u, i) => u !== urls[i]).length, total: urls.length });
  }

  const done = results.size;
  console.log(`Downloaded/ready ${done} · already on our storage ${already} · failed ${failures.length}`);
  console.log(`Products whose gallery_urls would change: ${writes.length}\n`);

  for (const w of writes.slice(0, 10)) {
    console.log(`  ${w.p.slug.padEnd(44)} ${w.migrated}/${w.total} entries`);
  }
  if (writes.length > 10) console.log(`  … and ${writes.length - 10} more`);

  // A full before/after mapping, written in BOTH modes. gallery_urls is
  // overwritten in place, so without this the original biosash URL for a
  // migrated entry would exist nowhere: the storage key hashes it, and a
  // hash does not go backwards. This file is what makes the migration
  // reversible.
  {
    const rows = ['slug,active,index,status,original_url,new_url'];
    for (const p of products) {
      (p.gallery_urls || []).forEach((url, index) => {
        const next = results.get(`${p.id}:${index}`);
        const status = isOurs(url) ? 'already-ours'
          : next ? 'migrate'
            : failures.some((f) => f.p.id === p.id && f.index === index) ? 'failed' : 'skipped';
        rows.push(`${p.slug},${p.is_active},${index},${status},${url},${next || ''}`);
      });
    }
    // An idempotent re-run has nothing to migrate. Writing the plan then
    // would replace a mapping that records every original URL with one
    // that records none of them — the file exists precisely so the
    // migration can be undone, and gallery_urls is overwritten in place.
    if (results.size || failures.length) {
      writeFileSync('reports/gallery-migration-plan.csv', `${rows.join('\n')}\n`);
      console.log(`  -> reports/gallery-migration-plan.csv  (${rows.length - 1} entries, before -> after)`);
    } else {
      console.log('  (nothing to migrate; existing plan report left untouched)');
    }
  }
  if (failures.length) {
    console.log(`\nCOULD NOT DOWNLOAD (${failures.length}) — these products need new photography:`);
    const bySlug = new Map();
    for (const f of failures) {
      if (!bySlug.has(f.p.slug)) bySlug.set(f.p.slug, []);
      bySlug.get(f.p.slug).push(f);
    }
    for (const [slug, list] of bySlug) {
      const p = list[0].p;
      console.log(`\n  ${slug}  (${p.is_active ? 'ACTIVE' : 'inactive'}) — ${list.length} of ${(p.gallery_urls || []).length} failed`);
      for (const f of list) console.log(`     ${f.reason.padEnd(22)} ${f.url}`);
    }
    const csv = ['slug,active,reason,url',
      ...failures.map((f) => `${f.p.slug},${f.p.is_active},"${f.reason}",${f.url}`)].join('\n');
    writeFileSync('reports/gallery-migration-failures.csv', `${csv}\n`);
    console.log(`\n  -> reports/gallery-migration-failures.csv`);
  }

  if (!LIVE) {
    console.log('\nDry run — nothing was uploaded and nothing was written.');
    console.log('Downloads are cached, so the live run will not refetch them.');
    return;
  }

  let ok = 0, failed = 0;
  for (const w of writes) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${w.p.id}`, {
      method: 'PATCH',
      headers: {
        apikey: WRITE_KEY, Authorization: `Bearer ${WRITE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      // updated_at moves on every write. The admin editor refuses a save whose
      // captured updated_at no longer matches, and that check is only as good
      // as the writers around it: a script that changes a row WITHOUT moving
      // it leaves a form opened beforehand holding a token that still matches,
      // so its stale values silently overwrite this migration.
      body: JSON.stringify({ gallery_urls: w.next, updated_at: new Date().toISOString() }),
    });
    if (r.ok) ok += 1;
    else { failed += 1; console.log(`  FAILED ${w.p.slug}: ${r.status} ${(await r.text()).slice(0, 120)}`); }
  }
  console.log(`\nUpdated ${ok} products · failed ${failed}`);
})();
