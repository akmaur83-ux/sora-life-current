#!/usr/bin/env node
// ============================================================
// Publish-time storefront content (runs on Vercel after `npm run build`; see
// vercel.json buildCommand).
//
//   1. read every store's PUBLISHED record (storefront_published, migration 0037)
//      with the site's public key — the same project and key the committed
//      public/bundle.js talks to;
//   2. check each one with the editor's own rules (validateStorefrontContent);
//   3. copy every image uploaded through the admin into img/published/<hash>.<ext>,
//      so Vercel serves the storefront art, not Supabase Storage, and a new picture
//      always gets a new file name;
//   4. write the content into index.html as one JSON block the page reads before
//      its first render.
//
// ANY failure — the read, a missing store, a rule, an image — throws before
// index.html or img/published is touched, and the CLI exits 1. Vercel then marks
// the deployment failed and does not promote it: the live site stays exactly as
// it was. Nothing here falls back to built-in content.
//
//   node build/publish-content.mjs [root]
// ============================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  STOREFRONT_CONTENT_STORES, INLINE_MARKER, INLINE_ID, validateStorefrontContent, contentImages, mapContentImages, serializeInlinedContent,
} from '../src/lib/storefrontContent.js';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };

/** The Supabase project URL and publishable key the committed bundle uses (both public). */
export function supabaseFromBundle(bundleText) {
  const url = /const supabaseUrl = "(https:\/\/[a-z0-9]+\.supabase\.co)"/.exec(bundleText)?.[1];
  const key = /const supabasePublishableKey = "([A-Za-z0-9_.-]{20,})"/.exec(bundleText)?.[1];
  if (!url || !key) throw new Error('public/bundle.js carries no Supabase project URL and key, so the published content cannot be read.');
  return { url, key };
}

/** Magic bytes agree with the declared type. */
function looksLike(type, bytes) {
  if (type === 'image/png') return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

/**
 * Read, check, copy and write. Resolves with a summary; throws on any failure,
 * having written nothing.
 */
export async function publishContent({ root, fetch = globalThis.fetch, supabase = null, timeoutMs = 15000 }) {
  const indexPath = join(root, 'index.html');
  const index = readFileSync(indexPath, 'utf8');
  if (index.split(INLINE_MARKER).length !== 2) throw new Error(`index.html must hold the marker ${INLINE_MARKER} exactly once.`);
  const { url, key } = supabase || supabaseFromBundle(readFileSync(join(root, 'public', 'bundle.js'), 'utf8'));
  const storagePrefix = `${url}/storage/v1/object/public/product-images/`;

  // 1. The read.
  let response;
  try {
    response = await fetch(`${url}/rest/v1/storefront_published?select=store,content,draft_version,published_at`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`Reading the published storefront content failed: ${error?.name === 'TimeoutError' ? 'no answer in time' : 'the request did not complete'}.`);
  }
  if (!response.ok) throw new Error(`Reading the published storefront content failed: HTTP ${response.status}.`);
  let rows;
  try { rows = await response.json(); } catch { throw new Error('The published storefront content was not readable JSON.'); }
  if (!Array.isArray(rows)) throw new Error('The published storefront content was not a list of stores.');

  // 2. The rules. Every store must be there, and every field must pass.
  const stores = {}, versions = {}, problems = [];
  for (const store of STOREFRONT_CONTENT_STORES) {
    const row = rows.find((r) => r && r.store === store);
    if (!row) { problems.push(`${store}: no published record`); continue; }
    const { value, errors } = validateStorefrontContent(store, row.content, { mode: 'published' });
    for (const [path, message] of Object.entries(errors)) problems.push(`${store}${path ? `.${path}` : ''}: ${message}`);
    stores[store] = value;
    versions[store] = { version: Number(row.draft_version) || 0, publishedAt: typeof row.published_at === 'string' ? row.published_at : null };
  }
  if (problems.length) throw new Error(`The published storefront content breaks the rules, so it is not deployed:\n  - ${problems.join('\n  - ')}`);

  // 3. The images: every one uploaded through the admin is copied in; files the site ships stay as they are.
  const tmp = join(root, 'img', '.published-tmp');
  rmSync(tmp, { recursive: true, force: true });
  const copies = new Map();
  try {
    for (const store of STOREFRONT_CONTENT_STORES) {
      for (const src of contentImages(store, stores[store])) {
        if (!src.startsWith(storagePrefix) || copies.has(src)) continue;
        let res;
        try { res = await fetch(src, { signal: AbortSignal.timeout(timeoutMs) }); } catch { throw new Error(`Copying an image failed: ${src} did not download.`); }
        if (!res.ok) throw new Error(`Copying an image failed: ${src} answered HTTP ${res.status}.`);
        const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const bytes = Buffer.from(await res.arrayBuffer());
        if (!IMAGE_TYPES[type] || !looksLike(type, bytes)) throw new Error(`Copying an image failed: ${src} is not a WebP, PNG or JPEG.`);
        if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`Copying an image failed: ${src} is over 4 MB.`);
        const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 20)}.${IMAGE_TYPES[type]}`;
        mkdirSync(tmp, { recursive: true });
        writeFileSync(join(tmp, name), bytes);
        copies.set(src, name);
      }
    }
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true });
    throw error;
  }

  // 4. Everything is read and checked: now write — the images, then the page.
  const out = join(root, 'img', 'published');
  if (copies.size) {
    mkdirSync(out, { recursive: true });
    for (const name of new Set(copies.values())) renameSync(join(tmp, name), join(out, name));
  }
  rmSync(tmp, { recursive: true, force: true });
  const baked = Object.fromEntries(STOREFRONT_CONTENT_STORES.map((store) => [
    store, mapContentImages(store, stores[store], (src) => (copies.has(src) ? `/img/published/${copies.get(src)}` : src)),
  ]));
  const block = `<script id="${INLINE_ID}" type="application/json">${serializeInlinedContent({ stores: baked, versions })}</script>`;
  writeFileSync(indexPath, index.replace(INLINE_MARKER, () => block));
  return { stores: STOREFRONT_CONTENT_STORES.length, images: copies.size, versions };
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const root = resolve(process.argv[2] || '.');
  publishContent({ root }).then(
    (summary) => {
      console.log(`Publish-time content: ${summary.stores} storefronts written into index.html, ${summary.images} image(s) copied into img/published.`);
    },
    (error) => {
      console.error(`\nPublish-time content FAILED — this deployment stops here and the live site is unchanged.\n${error.message}\n`);
      // Anything a failed run left half-written goes with it (it never writes index.html before the end).
      if (existsSync(join(root, 'img', '.published-tmp'))) rmSync(join(root, 'img', '.published-tmp'), { recursive: true, force: true });
      process.exit(1);
    },
  );
}

// For the suite: the files a run leaves in img/published.
export const publishedFiles = (root) => (existsSync(join(root, 'img', 'published')) ? readdirSync(join(root, 'img', 'published')).sort() : []);
