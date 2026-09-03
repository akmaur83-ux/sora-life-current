// ============================================================
// Product media system — regression tests
//
//   node scripts/test-product-media.mjs
//
// OFFLINE — the storefront gallery model (fallback, ordering, independence),
//           the SSRF guard, image sniffing and page discovery (pure logic).
// STATIC  — migration 0016 + importer endpoint shape/security.
// LIVE    — opt-in only: --live makes real anon read/write probes. Never use
//           that flag without explicit authorization for the target backend.
// ============================================================
import { readFileSync } from 'node:fs';
import { runMediaFailureTests } from './product-media-failure-cases.mjs';
import { products, applyProductMedia, productGallery } from '../src/data/products.js';
import {
  assertSafeUrl, sniffImageType, discoverImageUrls, IMPORT_ALLOWED_MIME, extForMime,
} from '../api/_lib/ssrf.js';

let pass = 0, fail = 0, note = 0;
const ok = (m, k = 'OFFLINE') => { console.log(`  PASS [${k}] ${m}`); pass++; };
const bad = (m, k = 'OFFLINE') => { console.log(`  FAIL [${k}] ${m}`); fail++; };
const inf = (m) => { console.log(`  NOTE ${m}`); note++; };
const t = (c, m, k) => (c ? ok(m, k) : bad(m, k));
const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
const accepts = async (fn) => { try { await fn(); return true; } catch { return false; } };

const SQL = readFileSync('supabase/migrations/0016_product_media.sql', 'utf8');
const ENDPOINT = readFileSync('api/admin/import-media.js', 'utf8');
const SSRF = readFileSync('api/_lib/ssrf.js', 'utf8');

console.log('\n— Storefront gallery model —');
{
  const p = products[0];
  const key = p.dbId ?? p.id;
  // No structured media -> real primary + imported catalogue gallery, never
  // a fabricated placeholder. The imported first frame backs the local
  // primary, so only genuine secondary frames follow it.
  p.media = [];
  const fb = productGallery(p);
  const expectedFallbackLength = 1 + Math.max(0, (p.gallery?.length || 0) - 1);
  t(fb.length === expectedFallbackLength && fb[0].url === p.image && fb[0].isPrimary,
    'no media rows -> primary plus unique real catalogue images');

  applyProductMedia([
    { productId: key, id: 'm2', url: 'U-second', alt: 'b', isPrimary: false, sortOrder: 1 },
    { productId: key, id: 'm1', url: 'U-primary', alt: 'a', isPrimary: true, sortOrder: 0 },
    { productId: key, id: 'm3', url: 'U-third', alt: 'c', isPrimary: false, sortOrder: 2 },
  ]);
  const g = productGallery(p);
  t(g.length === 3, 'one product -> multiple media rows attached');
  t(g[0].url === 'U-primary' && g[0].isPrimary, 'primary sorts first regardless of input order');
  t(g[1].url === 'U-second' && g[2].url === 'U-third', 'remaining media keep sort_order');
  t(p.image === 'U-primary', 'primary media syncs product.image (grid/cart/wishlist stay correct)');
  t(g.filter((m) => m.isPrimary).length === 1, 'exactly one primary in the rendered gallery');

  // A product with no media and no image renders nothing (no placeholder tiles).
  const empty = { id: 'zzz', name: 'x', image: '', media: [] };
  t(productGallery(empty).length === 0, 'no image + no media -> empty (never fabricates tiles)');
}

console.log('\n— SSRF guard (private/internal blocked, public allowed) —');
for (const u of [
  'http://127.0.0.1/x', 'http://10.0.0.5/x', 'http://192.168.1.10/x', 'http://172.16.5.5/x',
  'http://169.254.169.254/latest/meta-data/', 'http://[::1]/x', 'https://localhost/x',
  'https://foo.internal/x', 'http://0.0.0.0/x', 'http://100.100.0.1/x',
  'ftp://8.8.8.8/x', 'https://user:pass@8.8.8.8/x', 'https://8.8.8.8:22/x', 'https://[::ffff:127.0.0.1]/x',
  'http://[fd00::1]/x', 'http://[fe80::1]/x', 'http://[fc00::1234]/x',
  'http://0177.0.0.1/x', 'http://0x7f000001/x', 'http://2130706433/x', 'http://127.1/x',
  'http://[::ffff:7f00:1]/x', 'http://[2001:db8::1]/x', 'http://[2002:7f00:1::]/x',
  'http://192.0.2.1/x', 'http://198.51.100.1/x', 'http://203.0.113.1/x',
  'https://single-label/x', 'https://example.com:80/x',
]) {
  t(await rejects(() => assertSafeUrl(u)), `blocked: ${u}`);
}
t(await accepts(() => assertSafeUrl('https://8.8.8.8/img.png')), 'allowed: public IP literal (no DNS)');
t(await accepts(() => assertSafeUrl('https://172.32.0.1/img.png')), 'allowed: 172.32/x is public (outside 172.16/12)');

console.log('\n— Image sniffing (magic bytes, not Content-Type) —');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
const evil = Buffer.from('<?php echo 1; ?>#############', 'ascii');
t(sniffImageType(png) === 'image/png', 'PNG magic detected');
t(sniffImageType(jpg) === 'image/jpeg', 'JPEG magic detected');
t(sniffImageType(gif) === 'image/gif', 'GIF magic detected');
t(sniffImageType(webp) === 'image/webp', 'WEBP magic detected');
t(sniffImageType(evil) === null, 'non-image (php/script) rejected by sniff');
t(IMPORT_ALLOWED_MIME.includes('image/jpeg') && extForMime('image/png') === 'png', 'allowed mime -> extension map');

console.log('\n— Page discovery (multi-image, originals, same-site) —');
{
  const html = `
    <meta property="og:image" content="https://biosash.com/wp-content/uploads/2020/10/hero.jpg">
    <a href="https://biosash.com/product/x" data-large_image="https://biosash.com/wp-content/uploads/2020/10/01-35.jpg"></a>
    <img src="https://biosash.com/wp-content/uploads/2020/10/02-35-300x300.jpg" srcset="https://biosash.com/wp-content/uploads/2020/10/02-35-768x768.jpg 768w">
    <img src="https://evil.example.com/tracker.gif">`;
  const imgs = discoverImageUrls(html, 'https://biosash.com/product/x/');
  const urls = imgs.map((i) => i.url);
  t(imgs.length >= 3, 'discovers multiple product images');
  t(urls.some((u) => u.endsWith('/02-35.jpg')) && !urls.some((u) => /02-35-\d+x\d+/.test(u)), 'collapses -WxH resize variants to the original');
  t(imgs[0].sameSite === true, 'same-site images ranked first');
  t(imgs.every((i) => i.sameSite), 'off-site images dropped when same-site images exist');
  // HTML-entity-encoded query URLs (e.g. Next.js image optimizer) decode to real &
  const nextHtml = '<img src="https://biosash.com/_next/image/?url=%2Fp.png&amp;w=640&amp;q=75">';
  const nx = discoverImageUrls(nextHtml, 'https://biosash.com/product/x/');
  t(nx.length === 1 && nx[0].url.includes('&w=640&q=75') && !nx[0].url.includes('&amp;'), 'decodes &amp; entities in discovered URLs');
}

console.log('\n— Migration 0016 shape (STATIC) —');
t(/create table if not exists public\.product_media/.test(SQL), 'product_media table defined', 'STATIC');
t(/product_id\s+bigint\s+not null\s+references public\.products\(id\)\s+on delete cascade/.test(SQL), 'FK to products(id) with cascade', 'STATIC');
t(/create unique index if not exists product_media_one_primary_idx[\s\S]*where is_primary/.test(SQL), 'ONE primary per product (partial unique index)', 'STATIC');
t(/product_media_enforce_primary/.test(SQL) && /before insert or update on public\.product_media/.test(SQL), 'single-primary trigger present', 'STATIC');
t(/product_media_promote_after_delete/.test(SQL) && /after delete on public\.product_media/.test(SQL), 'promote-next-on-delete trigger present', 'STATIC');
t(/enable row level security/.test(SQL), 'RLS enabled', 'STATIC');
t(/product_media public read[\s\S]*for select[\s\S]*using \(true\)/.test(SQL), 'public can READ media', 'STATIC');
t(/product_media admin write[\s\S]*for all[\s\S]*is_sora_admin\(\)/.test(SQL), 'writes are admin-only (is_sora_admin)', 'STATIC');
t(/insert into public\.product_media[\s\S]*from public\.products p[\s\S]*image_url/.test(SQL), 'seeds one primary row per product from image_url', 'STATIC');
t(/not exists \(select 1 from public\.product_media m where m\.product_id = p\.id\)/.test(SQL), 'seed never duplicates / clobbers existing media', 'STATIC');
t(/storage_path is null or \(storage_path !~ '\\\.\\\.'/.test(SQL), 'storage_path check blocks path traversal', 'STATIC');

console.log('\n— Importer endpoint shape (STATIC) —');
t(/action === 'discover'/.test(ENDPOINT) && /action === 'import'/.test(ENDPOINT), 'two explicit steps: discover + import', 'STATIC');
t(/requireAdmin/.test(ENDPOINT) && /admin_users/.test(ENDPOINT), 'admin-gated (admin_users membership)', 'STATIC');
t(/getUserIdFromToken/.test(ENDPOINT), 'caller identity taken from validated JWT, not the body', 'STATIC');
t(/assertSafeUrl/.test(ENDPOINT) && /safeFetch/.test(ENDPOINT), 'uses SSRF-safe URL validation + fetch', 'STATIC');
t(/import \{ Agent \} from 'undici'/.test(SSRF) && /dispatcher/.test(SSRF) && /connect: \{ lookup \}/.test(SSRF), 'validated DNS answers are pinned into the outbound connection', 'STATIC');
t(/redirect: 'manual'/.test(SSRF) && /resolveSafeTarget\(current\)/.test(SSRF), 'every redirect target is independently resolved and validated', 'STATIC');
t(/validateDownloadedImage/.test(ENDPOINT), 'validates Content-Type together with magic bytes', 'STATIC');
t(/if \(row\.isPrimary\) madePrimary = true/.test(ENDPOINT), 'primary state advances only after a confirmed media row', 'STATIC');
t(/storage\/v1\/object\/product-images\//.test(ENDPOINT), 'copies into OUR product-images bucket (no hotlink stored)', 'STATIC');
t(/products\/import\/\$\{randomId\(\)\}/.test(ENDPOINT), 'random, sanitized storage path (no client-controlled path)', 'STATIC');
t(/enforceRateLimit/.test(ENDPOINT), 'rate-limited', 'STATIC');
t(/range\('fc00::', 7\)/.test(SSRF) && /range\('fe80::', 10\)/.test(SSRF) && /a === 169 && b === 254/.test(SSRF), 'SSRF lib blocks ULA, link-local and metadata ranges', 'STATIC');

console.log('\n— Admin media safety (STATIC) —');
{
  const API = readFileSync('src/lib/adminApi.js', 'utf8');
  const GAL = readFileSync('src/admin/components/MediaGallery.jsx', 'utf8');
  const OPS = readFileSync('src/lib/productMediaOperations.js', 'utf8');
  // Cross-product: every mutation is scoped by product_id (req 6).
  t(/adminReorderProductMedia\(productId, idsInOrder\)[\s\S]*\.eq\('id', id\)\.eq\('product_id', productId\)/.test(API), 'reorder scoped by product_id', 'STATIC');
  t(/selectPrimaryMediaRow\(productId, id\)[\s\S]*\.eq\('product_id', productId\)/.test(API), 'set-primary scoped by product_id', 'STATIC');
  t(/adminDeleteProductMedia\(productId, id\)[\s\S]*\.eq\('id', id\)\.eq\('product_id', productId\)/.test(API), 'delete scoped by product_id (+ pre-check ownership)', 'STATIC');
  t(/adminUpdateProductMedia\(productId, id, patch\)[\s\S]*\.eq\('product_id', productId\)/.test(API), 'update scoped by product_id', 'STATIC');
  t(/adminReplaceProductMedia\(productId, id, file\)[\s\S]*belongs to this product/.test(API), 'replace scoped + rejects foreign id', 'STATIC');
  // Primary <-> image_url sync (req 2/3).
  t(/adminDeleteProductMedia[\s\S]*await adminEnsurePrimaryMedia\(productId\)/.test(API), 'delete verifies and syncs the promoted primary', 'STATIC');
  t(/adminReplaceProductMedia[\s\S]*await adminEnsurePrimaryMedia\(productId\)/.test(API), 'replacement verifies and syncs the actual primary', 'STATIC');
  // Staged robustness (req 7).
  t(/adminCommitStagedProductMedia/.test(GAL) && /failed\.push/.test(OPS), 'staged commit retains individual failures', 'STATIC');
  t(/await settlePrimaryMedia\(ops, preferred\?\.id\)/.test(OPS), 'staged commit verifies primary and synchronization', 'STATIC');
  // Legacy gallery import candidates + select-all (req 1).
  t(/legacyCandidates/.test(GAL) && /toggleAll\(/.test(GAL), 'legacy gallery_urls offered as import candidates with Select all', 'STATIC');
}

await runMediaFailureTests(t);

if (process.argv.includes('--live')) {
console.log('\n— Live posture (anon; explicitly opted in) —');
try {
  const bundle = readFileSync('public/bundle.js', 'utf8');
  const URL = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
  const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${URL}/rest/v1/product_media?select=id&limit=1`, { headers: H });
  const rStatus = r.status; await r.arrayBuffer().catch(() => {}); // drain body so the socket can close
  if (rStatus === 404 || rStatus === 400) {
    inf('product_media not present yet — apply migration 0016 to enable the gallery table');
  } else {
    t(rStatus >= 200 && rStatus < 300, `anon can READ product_media (${rStatus})`, 'LIVE');
    const w = await fetch(`${URL}/rest/v1/product_media`, {
      method: 'POST', headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({ product_id: 1, public_url: 'https://x/y.png', is_primary: false }),
    });
    const wStatus = w.status; await w.arrayBuffer().catch(() => {});
    t(wStatus === 401 || wStatus === 403 || wStatus === 400, `anon cannot WRITE product_media (${wStatus})`, 'LIVE');
  }
} catch (e) { inf(`live probe skipped: ${e.message}`); }
} else { inf('Live probes disabled; offline/static/mocked tests only.'); }

console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
// Set exit code and let the loop drain (undici keep-alive timers are unref'd),
// instead of process.exit() which can trip a libuv teardown assert on Windows.
process.exitCode = fail ? 1 : 0;
