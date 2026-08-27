// ============================================================
// POST /api/admin/import-media   (admin only)
//
// Two explicit steps — never auto-imports, never overwrites:
//   { action: 'discover', url }                 -> list candidate image URLs
//   { action: 'import', productId, urls: [...] } -> copy the SELECTED images
//                                                   into OUR storage + media rows
//
// Security:
//   • Admin-gated: the caller's Supabase JWT is validated and the user id must
//     exist in admin_users. Anonymous/customer/creator callers get 401/403.
//   • SSRF-safe: assertSafeUrl/safeFetch reject non-http(s), credentials,
//     non-standard ports, internal hostnames and any private/loopback/
//     link-local/CGNAT/ULA resolved IP, re-checking every redirect hop.
//   • Content-validated: supported Content-Type AND matching magic bytes, plus
//     size caps. Neither check alone is sufficient. Filenames are never taken from the source — storage
//     paths are random. A raw third-party URL is never stored as media; only
//     our own storage public URL is.
//   • Never overwrites: import only ADDS rows; primary is set only when the
//     product currently has no media.
//   • DNS-rebinding TOCTOU remains: fetch resolves again after the DNS check;
//     see safeFetch. Redirect validation does not pin the connection address.
//
// Runs server-side with the service-role key (like the order routes). Does not
// touch pricing, checkout, Razorpay, or creator/attribution logic.
// ============================================================
import { getSupabaseConfig, getUserIdFromToken } from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import {
  assertSafeUrl, safeFetch, validateDownloadedImage, discoverImageUrls, extForMime, SsrfError,
} from '../_lib/ssrf.js';
import { persistUploadedMedia, removeMediaObject, settlePrimaryMedia } from '../../src/lib/productMediaOperations.js';

const MAX_IMPORT = 12;             // images copied per request
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

function fail(res, status, error) { return res.status(status).json({ ok: false, error }); }

function randomId() {
  return (globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
}

async function sbFetch(path, cfg, init = {}) {
  const res = await fetch(`${cfg.url}${path}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(10000),
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      ...(init.headers || {}),
    },
  });
  return res;
}

// All writes are checked and read back. Only product_media determines primary;
// products.image_url is a required, denormalised copy, never the authority.
function mediaOperations(productId, cfg) {
  const query = `/rest/v1/product_media?product_id=eq.${productId}`;
  const appRow = (row) => ({ id: row.id, url: row.public_url, storagePath: row.storage_path,
    sortOrder: Number(row.sort_order) || 0, isPrimary: row.is_primary === true });
  async function rows(path, init, message) {
    const response = await sbFetch(path, cfg, init);
    if (!response.ok) throw new Error(`${message} (${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`${message}: invalid response.`);
    return data;
  }
  return {
    list: async () => (await rows(`${query}&select=*&order=sort_order.asc,id.asc`, {}, 'Could not read media')).map(appRow),
    find: async (path) => {
      const data = await rows(`${query}&select=*&storage_path=eq.${encodeURIComponent(path)}`, {}, 'Could not reconcile media');
      return data[0] ? appRow(data[0]) : null;
    },
    add: async (row) => {
      const data = await rows('/rest/v1/product_media', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row),
      }, 'Could not save media row');
      if (!data[0]?.id) throw new Error('Media insert was not confirmed.');
      return appRow(data[0]);
    },
    select: async (id) => {
      const data = await rows(`${query}&id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ is_primary: true }),
      }, 'Primary selection failed');
      if (data.length !== 1 || data[0].is_primary !== true) throw new Error('Primary selection was not confirmed.');
    },
    sync: async (url) => {
      const data = await rows(`/rest/v1/products?id=eq.${productId}&select=id,image_url`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ image_url: url, updated_at: new Date().toISOString() }),
      }, 'Product image synchronization failed');
      if (data.length !== 1 || data[0].image_url !== url) throw new Error('Product image synchronization was not confirmed.');
    },
    remove: async (path) => {
      const response = await sbFetch('/storage/v1/object/product-images', cfg, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }),
      });
      if (!response.ok) throw new Error(`Storage cleanup failed (${response.status}).`);
      const removed = await response.json();
      if (Array.isArray(removed) && removed.some((object) => object.name === path)) return;
      // Empty delete results can mean either absent or inaccessible. Confirm
      // absence using authenticated metadata, never a cached public image URL.
      const check = await sbFetch(`/storage/v1/object/info/product-images/${path}`, cfg);
      const info = await check.json().catch(() => ({}));
      if (check.status === 404 || (check.status === 400 && info.code === 'NoSuchKey')) return;
      throw new Error('Storage deletion was not confirmed.');
    },
  };
}

// Validate the caller is an admin. Returns the user id or null.
async function requireAdmin(req, cfg) {
  const uid = await getUserIdFromToken(req.headers?.authorization, cfg);
  if (!uid) return null;
  try {
    const res = await sbFetch(`/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(uid)}&limit=1`, cfg);
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? uid : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Method not allowed.'); }

  const cfg = getSupabaseConfig();
  if (!(await enforceRateLimit(req, res, { name: 'admin-import-media', limit: 20, windowSeconds: 60 }, cfg))) return;
  if (!cfg.configured) return fail(res, 503, 'Media import is not available right now.');

  const uid = await requireAdmin(req, cfg);
  if (!uid) return fail(res, 401, 'Admin sign-in required.');

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return fail(res, 400, 'Invalid request body.'); }

  const action = body.action;

  // ---------- DISCOVER ----------
  if (action === 'discover') {
    const raw = typeof body.url === 'string' ? body.url.trim() : '';
    if (!raw || raw.length > 2000) return fail(res, 400, 'Paste a valid product page URL.');
    try {
      await assertSafeUrl(raw); // fast reject before fetching
      const page = await safeFetch(raw, { as: 'text', maxBytes: MAX_HTML_BYTES, timeoutMs: 9000 });
      const images = discoverImageUrls(page.text || '', page.finalUrl);
      if (!images.length) return res.status(200).json({ ok: true, source: page.finalUrl, images: [], note: 'No product images were found on that page.' });
      return res.status(200).json({ ok: true, source: page.finalUrl, images });
    } catch (e) {
      const status = e instanceof SsrfError ? 400 : 502;
      return fail(res, status, e?.message || 'Could not inspect that page.');
    }
  }

  // ---------- IMPORT ----------
  if (action === 'import') {
    const productId = Number(body.productId);
    if (!Number.isInteger(productId) || productId <= 0) return fail(res, 400, 'A valid product is required.');
    const urls = Array.isArray(body.urls) ? body.urls.filter((u) => typeof u === 'string').slice(0, MAX_IMPORT) : [];
    if (!urls.length) return fail(res, 400, 'Select at least one image to import.');

    // Product must exist. (Ownership is by product_id; admins manage all products.)
    try {
      const pr = await sbFetch(`/rest/v1/products?select=id&id=eq.${productId}&limit=1`, cfg);
      if (!pr.ok) return fail(res, 502, 'Could not verify the product.');
      const rows = await pr.json();
      if (!Array.isArray(rows) || !rows.length) return fail(res, 404, 'That product no longer exists.');
    } catch { return fail(res, 502, 'Could not verify the product.'); }

    const ops = mediaOperations(productId, cfg);
    let initial;
    try { initial = await ops.list(); }
    catch (error) { return fail(res, 502, error.message); }
    const baseOrder = initial.reduce((max, row) => Math.max(max, row.sortOrder + 1), 0);
    const imported = [];
    const skipped = [];
    const cleanupPending = [];
    let madePrimary = initial.filter((row) => row.isPrimary).length === 1;

    for (const [index, url] of urls.entries()) {
      try {
        const img = await safeFetch(url, { as: 'buffer', maxBytes: MAX_IMAGE_BYTES, timeoutMs: 9000 });
        const mime = validateDownloadedImage(img);
        const ext = extForMime(mime);

        // Upload into OUR bucket at a random, sanitized path.
        const path = `products/import/${randomId()}.${ext}`;
        try {
          const up = await sbFetch(`/storage/v1/object/product-images/${path}`, cfg, {
            method: 'POST',
            headers: { 'Content-Type': mime, 'cache-control': '3600', 'x-upsert': 'false' },
            body: img.buffer,
          });
          if (!up.ok) throw new Error(`Storage upload failed (${up.status}).`);
        } catch (error) {
          // A failed/lost upload response can still have stored the object.
          await removeMediaObject(path, ops.remove);
          throw error;
        }
        const publicUrl = `${cfg.url}/storage/v1/object/public/product-images/${path}`;
        const row = await persistUploadedMedia({ storagePath: path }, () => ops.add({
            product_id: productId,
            storage_path: path,
            public_url: publicUrl,
            alt_text: '',
            sort_order: baseOrder + imported.length,
            is_primary: !madePrimary,
          }), ops.find, ops.remove);
        imported.push(row);
        if (row.isPrimary) madePrimary = true;
      } catch (e) {
        skipped.push({ url, phase: e.phase || 'import', reason: e?.message || 'Failed to import.' });
        if (e.cleanupPending?.length) {
          cleanupPending.push(...e.cleanupPending);
          skipped.push(...urls.slice(index + 1).map((pending) => ({ url: pending, phase: 'not-attempted', reason: 'Not attempted while cleanup is unresolved.' })));
          break;
        }
      }
    }
    const state = imported.length
      ? await settlePrimaryMedia(ops)
      : { ok: true, rows: initial, primaryCount: initial.filter((row) => row.isPrimary).length, primaryError: null, syncError: null };
    const ok = imported.length > 0 && state.ok && cleanupPending.length === 0;
    const error = cleanupPending.length ? 'Storage cleanup needs attention; do not retry this batch until the listed paths are checked.'
      : state.primaryError || state.syncError || (!imported.length ? 'No images were imported.' : null);
    return res.status(ok ? 200 : 502).json({
      ok, productId, imported: imported.map((row) => {
        const actual = state.rows.find((saved) => saved.id === row.id) || row;
        return { id: actual.id, url: actual.url, isPrimary: actual.isPrimary };
      }), skipped, primaryCount: state.primaryCount, primaryError: state.primaryError,
      syncError: state.syncError, cleanupPending, ...(error ? { error } : {}),
    });
  }

  return fail(res, 400, 'Unknown action.');
}
