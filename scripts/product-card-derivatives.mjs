/**
 * Non-destructive Supabase product-card derivative generator.
 *
 * Default: a 12-image local pilot covering the largest files and a spread of
 * the catalogue. Use --dry-run to inspect the plan without downloading.
 * Nothing is uploaded unless --upload is present; uploads require an existing
 * admin user JWT in SORA_SUPABASE_USER_JWT. Originals are never overwritten.
 *
 * Pilot:
 *   node scripts/product-card-derivatives.mjs
 * Full local generation:
 *   node scripts/product-card-derivatives.mjs --all --width=700 --quality=86
 * Later admin upload (not for the pilot run):
 *   node scripts/product-card-derivatives.mjs --all --width=700 --quality=86 --upload
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { productCardObjectName } from '../src/lib/productImageVariants.js';

dotenv.config({ path: '.env.local', quiet: true });

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.length ? rest.join('=') : true];
}));
const bool = (name) => args.has(name);
const numbers = (name, fallback) => String(args.get(name) || fallback).split(',').map(Number).filter(Number.isFinite);
const widths = numbers('widths', args.get('width') || '600,700,800');
const qualities = numbers('qualities', args.get('quality') || '82,86,90');
const limit = Math.max(1, Number(args.get('limit')) || 12);
const dryRun = bool('dry-run');
const upload = bool('upload');
const verify = bool('verify') || upload;
const all = bool('all');
const outputRoot = String(args.get('output-dir') || '.product-card-pilot.local');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const userJwt = process.env.SORA_SUPABASE_USER_JWT;

if (!supabaseUrl || !publishableKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required.');
if (upload && !userJwt) throw new Error('--upload requires SORA_SUPABASE_USER_JWT for an existing admin session.');

const supabase = createClient(supabaseUrl, publishableKey, userJwt ? {
  global: { headers: { Authorization: `Bearer ${userJwt}` } },
  auth: { persistSession: false, autoRefreshToken: false },
} : { auth: { persistSession: false, autoRefreshToken: false } });

function bytes(value) {
  if (!Number.isFinite(value)) return 'unknown';
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MB` : `${Math.round(value / 1024)} KB`;
}

function fileFromUrl(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { return ''; }
}

async function enumerateProducts() {
  const { data: products, error: productError } = await supabase
    .from('products').select('id,name,slug,image_url,is_active').eq('is_active', true).order('sort_order');
  if (productError) throw productError;
  const byFile = new Map((products || []).filter((p) => p.image_url).map((p) => [fileFromUrl(p.image_url), p]));

  const { data: objects, error: listError } = await supabase.storage.from('product-images')
    .list('products', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (!listError && Array.isArray(objects) && objects.length) {
    const eligible = objects.filter((item) => item.name && /\.(?:png|jpe?g|webp)$/i.test(item.name));
    return {
      catalogue: eligible.map((item) => {
      const product = byFile.get(item.name);
      const url = supabase.storage.from('product-images').getPublicUrl(`products/${item.name}`).data.publicUrl;
        return {
          name: item.name, url, bytes: Number(item.metadata?.size) || null,
          updatedAt: item.updated_at || item.updatedAt || null,
          product: product?.name || '', slug: product?.slug || '',
        };
      }),
      discovered: objects.length,
      unsupported: objects.length - eligible.length,
      listing: true,
    };
  }

  console.warn(`Storage listing unavailable (${listError?.message || 'empty'}); using product image URLs.`);
  const catalogue = (products || []).filter((p) => p.image_url && fileFromUrl(p.image_url)).map((p) => ({
    name: fileFromUrl(p.image_url), url: p.image_url, bytes: null, updatedAt: null, product: p.name, slug: p.slug,
  }));
  return { catalogue, discovered: catalogue.length, unsupported: 0, listing: false };
}

async function listDerivatives() {
  const { data, error } = await supabase.storage.from('product-images')
    .list('products-optimized/v1', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  return (data || []).filter((item) => item.name && /\.webp$/i.test(item.name));
}

function inventoryFingerprint(items) {
  return items.map((item) => `${item.name}:${item.bytes || ''}:${item.updatedAt || ''}`).sort().join('|');
}

function pilotProjection(totalBytes) {
  const pilotFile = '.product-card-pilot.local/measurements.json';
  if (!existsSync(pilotFile) || widths.length !== 1 || qualities.length !== 1) return null;
  try {
    const pilot = JSON.parse(readFileSync(pilotFile, 'utf8'))
      .filter((row) => row.width === widths[0] && row.quality === qualities[0]);
    const original = pilot.reduce((sum, row) => sum + row.originalBytes, 0);
    const derivative = pilot.reduce((sum, row) => sum + row.derivativeBytes, 0);
    return original > 0 ? Math.round(totalBytes * derivative / original) : null;
  } catch { return null; }
}

function selectPilot(items) {
  if (all || items.length <= limit) return items;
  const sized = [...items].sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
  const picked = sized.slice(0, 2);
  const remaining = items.filter((item) => !picked.includes(item));
  const stride = remaining.length / (limit - picked.length);
  for (let i = 0; picked.length < limit && i < limit - 2; i++) picked.push(remaining[Math.floor(i * stride)]);
  return picked;
}

async function fetchBuffer(item) {
  const response = await fetch(item.url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`download HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function remoteProbe(path) {
  const publicUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  // Supabase's object endpoint deliberately reports `no-cache` for HEAD even
  // when the object's GET metadata is immutable. A one-byte range request
  // verifies the customer-facing cache policy without downloading the image.
  const response = await fetch(publicUrl, {
    headers: { Range: 'bytes=0-0' },
    signal: AbortSignal.timeout(15000),
  });
  if (response.body) await response.body.cancel();
  return {
    path, ok: response.ok, status: response.status,
    cacheControl: response.headers.get('cache-control') || '',
    contentLength: Number(response.headers.get('content-length')) || null,
  };
}

const sourceInventory = await enumerateProducts();
const catalogue = sourceInventory.catalogue;
const selected = selectPilot(catalogue);
let existingDerivatives = [];
try { existingDerivatives = await listDerivatives(); } catch (error) { console.warn(`Derivative listing unavailable: ${error.message}`); }
const existingNames = new Set(existingDerivatives.map((item) => item.name));
const expectedNames = selected.flatMap((item) => widths.flatMap((width) => qualities.map((quality) => productCardObjectName(item.url, { width, quality }))));
const expectedExisting = expectedNames.filter((name) => existingNames.has(name)).length;
const originalTotal = selected.reduce((sum, item) => sum + (item.bytes || 0), 0);
const projectedTotal = pilotProjection(originalTotal);

console.log(`Found ${sourceInventory.discovered} source objects: ${catalogue.length} eligible images, ${sourceInventory.unsupported} unsupported/non-image.`);
console.log(`Selected ${selected.length}${all ? ' (all)' : ' for pilot'}; ${expectedExisting} expected derivatives already exist remotely.`);
for (const item of selected) {
  for (const width of widths) for (const quality of qualities) {
    const name = productCardObjectName(item.url, { width, quality });
    console.log(`PLAN ${item.product || item.name} | ${item.name} | ${bytes(item.bytes)} -> products-optimized/v1/${name}${existingNames.has(name) ? ' | EXISTS' : ''}`);
  }
}
if (dryRun) {
  console.log(`DRY RUN SUMMARY ${JSON.stringify({
    discovered: sourceInventory.discovered, eligible: catalogue.length, unsupported: sourceInventory.unsupported,
    selected: selected.length, expectedDerivatives: expectedNames.length, existingDerivativeSkips: expectedExisting,
    originalBytes: originalTotal || null, projectedDerivativeBytes: projectedTotal,
  })}`);
  process.exit(0);
}

mkdirSync(outputRoot, { recursive: true });
mkdirSync(join(outputRoot, 'originals'), { recursive: true });
mkdirSync(join(outputRoot, 'derivatives'), { recursive: true });
const rows = [];
const failures = [];
let created = 0;
let localSkipped = 0;
let uploaded = 0;
let uploadSkipped = 0;

for (const item of selected) {
  try {
    const originalPath = join(outputRoot, 'originals', item.name);
    const source = existsSync(originalPath) ? readFileSync(originalPath) : await fetchBuffer(item);
    if (!existsSync(originalPath)) writeFileSync(originalPath, source);
    const meta = await sharp(source).metadata();
    for (const width of widths) {
      for (const quality of qualities) {
        const profile = { width, quality };
        const objectName = productCardObjectName(item.url, profile);
        const outPath = join(outputRoot, 'derivatives', objectName);
        if (!existsSync(outPath)) {
          await sharp(source).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
            .webp({ quality, effort: 6, smartSubsample: true }).toFile(outPath);
          created++;
        } else localSkipped++;
        const outMeta = await sharp(outPath).metadata();
        const derivativeBytes = statSync(outPath).size;
        rows.push({
          product: item.product, slug: item.slug, originalName: item.name, originalUrl: item.url,
          originalWidth: meta.width, originalHeight: meta.height, originalFormat: meta.format,
          originalBytes: source.length, hasAlpha: Boolean(meta.hasAlpha),
          width, quality, derivativeName: objectName, derivativeWidth: outMeta.width,
          derivativeHeight: outMeta.height, derivativeBytes,
          reductionPercent: Number((100 * (1 - derivativeBytes / source.length)).toFixed(1)),
        });

        if (upload) {
          const storagePath = `products-optimized/v1/${objectName}`;
          if (existingNames.has(objectName)) {
            console.log(`SKIP existing ${storagePath}`);
            uploadSkipped++;
          } else {
            const file = readFileSync(outPath);
            const { error } = await supabase.storage.from('product-images').upload(storagePath, file, {
              contentType: 'image/webp', cacheControl: '31536000', upsert: false,
            });
            if (error) throw error;
            console.log(`UPLOAD ${storagePath}`);
            existingNames.add(objectName);
            uploaded++;
          }
        }
      }
    }
  } catch (error) {
    console.error(`FAIL ${item.product || item.name}: ${error.message}`);
    failures.push({ name: item.name, product: item.product, error: error.message });
  }
}

writeFileSync(join(outputRoot, 'measurements.json'), JSON.stringify(rows, null, 2));
console.log(`Wrote ${rows.length} measurements to ${join(outputRoot, 'measurements.json')}.`);
for (const row of rows) {
  console.log(`${row.product || row.originalName} | ${row.originalWidth}x${row.originalHeight} ${bytes(row.originalBytes)} -> ${row.derivativeWidth}x${row.derivativeHeight} q${row.quality} ${bytes(row.derivativeBytes)} | -${row.reductionPercent}%`);
}

const uniqueOriginals = new Map();
for (const row of rows) uniqueOriginals.set(row.originalName, row.originalBytes);
const measuredOriginalBytes = [...uniqueOriginals.values()].reduce((sum, value) => sum + value, 0);
const derivativeBytes = rows.reduce((sum, row) => sum + row.derivativeBytes, 0);
console.log(`GENERATION SUMMARY ${JSON.stringify({
  selected: selected.length, successfulOriginals: uniqueOriginals.size, expectedDerivatives: expectedNames.length,
  measuredDerivatives: rows.length, created, localSkipped, failed: failures.length,
  originalBytes: measuredOriginalBytes, derivativeBytes,
  averageOriginalBytes: uniqueOriginals.size ? Math.round(measuredOriginalBytes / uniqueOriginals.size) : 0,
  averageDerivativeBytes: rows.length ? Math.round(derivativeBytes / rows.length) : 0,
  reductionPercent: measuredOriginalBytes ? Number((100 * (1 - derivativeBytes / measuredOriginalBytes)).toFixed(1)) : null,
  uploaded, uploadSkipped,
})}`);

if (verify) {
  const afterSources = await enumerateProducts();
  const actualDerivatives = await listDerivatives();
  const actualNames = new Set(actualDerivatives.map((item) => item.name));
  const missing = expectedNames.filter((name) => !actualNames.has(name));
  const originalsUnchanged = inventoryFingerprint(afterSources.catalogue) === inventoryFingerprint(catalogue);
  const sampleCount = Math.min(12, expectedNames.length);
  const sampleNames = Array.from({ length: sampleCount }, (_, index) => expectedNames[Math.floor(index * expectedNames.length / sampleCount)]);
  const heads = [];
  for (const name of sampleNames) heads.push(await remoteProbe(`products-optimized/v1/${name}`));
  const badHeads = heads.filter((head) => !head.ok);
  const badCache = heads.filter((head) => !/max-age=31536000/.test(head.cacheControl));
  const actualDerivativeBytes = actualDerivatives.reduce((sum, item) => sum + (Number(item.metadata?.size) || 0), 0);
  console.log(`VERIFICATION SUMMARY ${JSON.stringify({
    expected: expectedNames.length, actualProfileMatches: expectedNames.length - missing.length,
    actualFolderObjects: actualDerivatives.length, missing: missing.length,
    originalCountBefore: catalogue.length, originalCountAfter: afterSources.catalogue.length,
    originalsUnchanged, sampledUrls: heads.length, failedSampleUrls: badHeads.length,
    badCacheHeaders: badCache.length, cacheHeaders: [...new Set(heads.map((head) => head.cacheControl))],
    actualDerivativeBytes,
  })}`);
  if (missing.length) console.error(`MISSING ${missing.join(', ')}`);
  if (badHeads.length) console.error(`UNREACHABLE ${badHeads.map((head) => head.path).join(', ')}`);
  if (badCache.length) console.error(`BAD CACHE ${badCache.map((head) => `${head.path}=${head.cacheControl || '(empty)'}`).join(', ')}`);
  if (missing.length || !originalsUnchanged || badHeads.length || badCache.length) process.exitCode = 1;
}

if (failures.length || rows.length !== expectedNames.length) process.exitCode = 1;
