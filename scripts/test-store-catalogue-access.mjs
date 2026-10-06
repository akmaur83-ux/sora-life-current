// ============================================================
// Store catalogue admin — a session that is not an admin cannot write.
//
//   node scripts/test-store-catalogue-access.mjs
//
// Offline; no database is contacted. The proof has three parts, and each
// leans on the one before:
//
//   1. THE POLICIES. Replaying every migration in order (creates, drops and
//      the 0034 renames), the final row-level-security policies that let
//      anyone INSERT, UPDATE or DELETE on the four catalogue tables — and on
//      storage.objects in the product-images bucket — all require
//      exists (select 1 from public.admin_users a where a.user_id = auth.uid())
//      in BOTH their USING and WITH CHECK, and nothing looser. RLS is on for
//      all four tables; no catalogue trigger function is SECURITY DEFINER.
//   2. THE CLIENT. Every catalogue admin module writes only through the
//      browser client (src/lib/supabase.js: the publishable key, the signed-in
//      user's session); no service-role credential exists anywhere in src/;
//      the pages sit inside ProtectedAdminRoute.
//   3. THE BEHAVIOUR. Under exactly those policies (the harness: an RLS-
//      refused INSERT is 42501, an RLS-filtered UPDATE or DELETE matches zero
//      rows — what PostgREST returns), every write the catalogue admin can
//      make is attempted as a signed-in non-admin. Every one fails and says
//      so, and the tables and the storage bucket are byte-identical after.
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT, read, has, createCatalogueDb, catalogueFixtures, loadCatalogueAdmin, imageFile,
} from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
const REPO = fileURLToPath(new URL('..', import.meta.url));
const ADMIN = 'exists (select 1 from public.admin_users a where a.user_id = auth.uid())';
const squash = (s) => String(s || '').replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim().toLowerCase();
const TABLES = ['catalogue_categories', 'catalogue_products', 'catalogue_variants', 'catalogue_product_media'];

// ---- 1. Replay the migrations ---------------------------------------------------------
function replayPolicies() {
  const dir = join(REPO, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  const policies = new Map();                      // `${table}|${name}` -> { table, name, cmd, using, check, file }
  const rls = new Set();
  const definers = [];
  const strip = (t) => t.replace(/^public\./, '');
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    const statements = /create policy\s+"([^"]+)"\s+on\s+([\w.]+)\s+for\s+(\w+)([\s\S]*?);|drop policy if exists\s+"([^"]+)"\s+on\s+([\w.]+)\s*;|alter table\s+(?:if exists\s+)?([\w.]+)\s+rename to\s+(\w+)\s*;|alter table\s+(?:if exists\s+)?([\w.]+)\s+enable row level security/gi;
    for (const m of sql.matchAll(statements)) {
      if (m[1]) {
        const body = m[4];
        const using = /using\s*\(([\s\S]*?)\)\s*(?:with check|$)/i.exec(body.trim())?.[1] ?? /using\s*\(([\s\S]*)\)\s*$/i.exec(body.trim())?.[1] ?? null;
        const check = /with check\s*\(([\s\S]*)\)\s*$/i.exec(body.trim())?.[1] ?? null;
        policies.set(`${strip(m[2])}|${m[1]}`, { table: strip(m[2]), name: m[1], cmd: m[3].toLowerCase(), using: squash(using), check: squash(check), file });
      } else if (m[5]) {
        policies.delete(`${strip(m[6])}|${m[5]}`);
      } else if (m[7]) {
        const from = strip(m[7]), to = m[8];
        for (const [key, p] of [...policies]) if (p.table === from) { policies.delete(key); policies.set(`${to}|${p.name}`, { ...p, table: to }); }
        if (rls.has(from)) { rls.delete(from); rls.add(to); }
      } else if (m[9]) rls.add(strip(m[9]));
    }
    // Any function these migrations define for the catalogue must run as the caller.
    if (/catalogue|fashion_/.test(sql)) for (const fn of sql.matchAll(/create or replace function\s+([\w.]+)\(([\s\S]*?)\bas \$\$/gi)) if (/security definer/i.test(fn[2])) definers.push(`${file}: ${fn[1]}`);
  }
  return { policies: [...policies.values()], rls, definers };
}

console.log('\n— 1. The policies —');

await test('every write policy on the four catalogue tables requires admin_users membership, in USING and WITH CHECK', () => {
  const { policies, rls } = replayPolicies();
  for (const table of TABLES) {
    assert.ok(rls.has(table), `RLS is enabled on ${table}`);
    const writes = policies.filter((p) => p.table === table && p.cmd !== 'select');
    assert.ok(writes.length >= 1, `${table} has its admin write policy`);
    for (const p of writes) {
      assert.equal(p.using, squash(ADMIN), `${table} "${p.name}" USING is exactly the admin_users check`);
      assert.equal(p.check, squash(ADMIN), `${table} "${p.name}" WITH CHECK is exactly the admin_users check`);
    }
  }
  const names = policies.filter((p) => TABLES.includes(p.table)).map((p) => `${p.table}: ${p.name} (${p.cmd})`).sort();
  assert.deepEqual(names, [
    'catalogue_categories: catalogue_categories admin write (all)', 'catalogue_categories: catalogue_categories public read (select)',
    'catalogue_product_media: catalogue_product_media admin write (all)', 'catalogue_product_media: catalogue_product_media public read (select)',
    'catalogue_products: catalogue_products admin write (all)', 'catalogue_products: catalogue_products public read (select)',
    'catalogue_variants: catalogue_variants admin read (select)', 'catalogue_variants: catalogue_variants admin write (all)', 'catalogue_variants: catalogue_variants public read (select)',
  ], 'no other policy on the catalogue tables survives the migrations');
});

await test('storage: every write policy names its bucket, and product-images writes require admin_users', () => {
  const { policies } = replayPolicies();
  const writes = policies.filter((p) => p.table === 'storage.objects' && p.cmd !== 'select');
  assert.ok(writes.length >= 1);
  for (const p of writes) {
    // An INSERT policy has only WITH CHECK; the others have USING (and WITH CHECK).
    assert.match(p.using || p.check, /bucket_id = '[a-z0-9-]+'/, `"${p.name}" is scoped to one bucket`);
    if (p.using.includes("bucket_id = 'product-images'") || p.check.includes("bucket_id = 'product-images'")) {
      assert.ok(p.using.includes(squash(ADMIN)) && p.check.includes(squash(ADMIN)), `"${p.name}" requires admin_users in USING and WITH CHECK`);
    }
  }
  assert.ok(writes.some((p) => p.name === 'product-images admin write'));
});

await test('no catalogue trigger or function runs as its owner (SECURITY DEFINER) to write around RLS', () => {
  assert.deepEqual(replayPolicies().definers, []);
});

console.log('\n— 2. The client —');

await test('the catalogue admin writes only through the browser client; no service-role credential exists in src/', () => {
  const modules = ['src/lib/storeCatalogueAdminApi.js', 'src/lib/storeCatalogueAdmin.js', 'src/lib/storeCatalogueCsv.js', 'src/lib/storeCatalogueImage.js', 'src/lib/claimWarnings.js', 'src/admin/pages/StoreCatalogue.jsx'].filter(has);
  assert.ok(modules.length >= 3);
  for (const rel of modules) {
    const src = read(rel);
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.ok(!/supabase-js|\/api\/|service/i.test(m[1]), `${rel} imports ${m[1]}`);
    }
    assert.doesNotMatch(src, /\bfetch\s*\(/, `${rel} makes no direct HTTP calls`);
  }
  assert.match(read('src/lib/storeCatalogueAdminApi.js'), /import \{ supabase \} from '\.\/supabase\.js';/);
  const client = read('src/lib/supabase.js');
  assert.match(client, /import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.deepEqual([...client.matchAll(/import\.meta\.env\.(\w+)/g)].map((m) => m[1]).sort(), ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL']);
  const offenders = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(jsx?|mjs)$/.test(name)) {
        // Code only: several files say "no service-role key" in a comment, which is the point.
        const code = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
        if (/service[_-]?role|SERVICE_ROLE|SUPABASE_SECRET|sb_secret_/i.test(code)) offenders.push(relative(ROOT, p));
      }
    }
  })(join(ROOT, 'src'));
  assert.deepEqual(offenders, [], 'no service-role key or name in the browser source');
});

await test('the catalogue pages sit inside ProtectedAdminRoute, which admits a confirmed admin_users member only', async () => {
  const app = read('src/App.jsx');
  const admin = app.slice(app.indexOf('<Route path="/admin"'), app.indexOf('<Route path="/passport'));
  assert.match(admin, /<ProtectedAdminRoute>/);
  assert.match(admin, /path="store-catalogue\/:store\/:productId\?" element=\{<StoreCatalogue \/>\}/);
  const { grantsAdminAccess, ADMIN_YES, ADMIN_DENIED, ADMIN_ERROR, ADMIN_UNKNOWN } = await import(new URL(`file:///${join(ROOT, 'src/lib/adminAccess.js').replace(/\\/g, '/')}`).href);
  assert.deepEqual([ADMIN_YES, ADMIN_DENIED, ADMIN_ERROR, ADMIN_UNKNOWN].map(grantsAdminAccess), [true, false, false, false]);
  assert.match(read('src/lib/adminAuth.jsx'), /\.from\("admin_users"\)/);
});

console.log('\n— 3. The behaviour —');

await test('as a signed-in non-admin, every catalogue write fails, says so, and changes nothing — tables and storage', async () => {
  // Open everything as an admin first (a real editor session that then loses admin membership is the hardest case).
  const fixtures = catalogueFixtures();
  fixtures.catalogue_product_media.push({ id: 'm-linen-2', product_id: 'fp-linen', storage_path: null, public_url: '/img/fashion-hero.webp?2', alt_text: 'Back', sort_order: 1, is_primary: false });
  const store = createCatalogueDb(fixtures);
  const { api, csv } = await loadCatalogueAdmin({ supabase: store.supabase });
  const linen = await api.getStoreProduct('fashion', 'fp-linen');
  const percale = await api.getStoreProduct('homeliving', 'hp-percale');
  const cats = await api.listStoreCategories('fashion');
  const shirts = cats.find((c) => c.id === 'fc-shirts');
  const products = await api.listStoreProducts('homeliving');
  const hlCats = await api.listStoreCategories('homeliving');
  const demo = await api.previewStoreDemoDelete('homeliving');
  const plan = csv.planProductImport ? csv.planProductImport('slug,hsn_code\npercale-sheet-set,630231\n', { store: 'homeliving', products, categories: hlCats, overwrite: true }) : null;

  store.session.admin = false;
  const before = structuredClone(store.db());
  const attempts = {
    'create product': () => api.saveStoreProduct('fashion', null, { name: 'Intruder', category_id: 'fc-shirts', mrp: 1 }),
    'update product': () => api.saveStoreProduct('fashion', 'fp-linen', { ...linen, name: 'Hijacked' }, linen.updated_at),
    'create category': () => api.saveStoreCategory('fashion', null, { name: 'Intruders' }),
    'update category': () => api.saveStoreCategory('fashion', 'fc-shirts', { ...shirts, name: 'Hijacked' }, shirts.updated_at),
    'create variant': () => api.saveStoreVariant('homeliving', 'hp-percale', null, { size: 'Single', colour: 'Ivory', stock: 1 }),
    'update variant': () => api.saveStoreVariant('homeliving', 'hp-percale', 'hv-king', { ...percale.variants[0], stock: 999 }, percale.variants[0].updated_at),
    'delete variant': () => api.deleteStoreVariant('homeliving', 'hp-percale', 'hv-king', percale.variants[0].updated_at),
    'add image by URL': () => api.saveStoreMedia('fashion', 'fp-linen', null, { public_url: '/img/fashion-hero.webp' }),
    'remove image': () => api.removeStoreMedia('homeliving', 'hp-percale', 'm-percale'),
    'make primary': () => api.setStoreMediaPrimary('fashion', 'fp-linen', 'm-linen-2'),
    'reorder images': () => api.reorderStoreMedia('fashion', 'fp-linen', ['m-linen-2', 'm-linen']),
    'alt text': () => api.saveStoreMediaAlt('fashion', 'fp-linen', 'm-linen', 'Hijacked', linen.media[0].updated_at),
    'upload image': () => (api.uploadStoreImage ? api.uploadStoreImage('fashion', imageFile('x.jpg', { detail: 0.05 })) : Promise.reject(new Error('n/a'))),
    'delete demo rows': () => (api.deleteStoreDemoRows ? api.deleteStoreDemoRows('homeliving', demo) : Promise.reject(new Error('n/a'))),
  };
  for (const [what, attempt] of Object.entries(attempts)) {
    await assert.rejects(attempt(), (e) => e instanceof Error && e.message.length > 0, `${what} must fail`);
  }
  // Batch paths report per row/file instead of throwing; nothing may be reported as done.
  const upload = await api.addStoreImages('fashion', 'fp-linen', [imageFile('a.jpg', { detail: 0.05 })]);
  assert.deepEqual(upload.map((r) => r.ok), [false]);
  assert.match(upload[0].error, /refused to save this image: this account is not a catalogue admin/);
  const applied = await api.applyCatalogueImport('homeliving', plan);
  assert.equal(applied.done.length, 0);
  assert.match(applied.failed[0].reason, /not a catalogue admin/);

  assert.deepEqual(store.db(), before, 'every catalogue table is byte-identical');
  assert.equal(store.storage.objects.size, 0, 'nothing reached the bucket');
  assert.ok(store.storage.uploads.length >= 1 && store.storage.uploads.every((u) => u.admin === false), 'the uploads that were attempted were refused by the bucket policy');
});

await test('the refusals read as refusals — never as "saved", and never as someone else\'s edit', async () => {
  const store = createCatalogueDb(catalogueFixtures());
  const { api } = await loadCatalogueAdmin({ supabase: store.supabase });
  const linen = await api.getStoreProduct('fashion', 'fp-linen');
  store.session.admin = false;
  await assert.rejects(api.saveStoreProduct('fashion', null, { name: 'Intruder', category_id: 'fc-shirts', mrp: 1 }), (e) => e.isRefused && /not a catalogue admin/.test(e.message) && !/row-level/.test(e.message));
  await assert.rejects(api.saveStoreProduct('fashion', 'fp-linen', { ...linen, name: 'Hijacked' }, linen.updated_at), (e) => e.isRefused && !e.isStaleWrite);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
