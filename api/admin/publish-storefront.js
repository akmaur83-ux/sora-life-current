// ============================================================
// POST /api/admin/publish-storefront   (admin only)
//
//   { store: 'fashion', version: 7 }
//
// Publishes one store's saved draft and starts a rebuild of the site:
//   1. admin_publish_storefront() — run AS THE SIGNED-IN ADMIN (their own access
//      token), so the database checks admin_users itself and refuses a draft
//      that moved since the admin last saw it (the version);
//   2. the Vercel deploy hook — a POST that rebuilds master unchanged; the build
//      bakes the newly published content into the page (build/publish-content.mjs).
//
// The deploy hook URL is a secret: it lives ONLY in this function's environment
// (VERCEL_DEPLOY_HOOK_URL, not a VITE_ variable, so no build can inline it). It
// is never sent to the browser, logged, or echoed in an error — every response
// below is a fixed sentence. test-storefront-publish.mjs pins that.
// ============================================================
import { getSupabaseConfig } from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { STOREFRONT_CONTENT_STORES } from '../../src/lib/storefrontContent.js';

const HOOK_SHAPE = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_/-]+$/;

function fail(res, status, error) { return res.status(status).json({ ok: false, error }); }

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Method not allowed.'); }

  const cfg = getSupabaseConfig();
  if (!(await enforceRateLimit(req, res, { name: 'admin-publish-storefront', limit: 10, windowSeconds: 60 }, cfg))) return;

  // Checked before anything is published, so a missing hook never leaves a publish without its rebuild.
  const hook = String(process.env.VERCEL_DEPLOY_HOOK_URL || '');
  if (!HOOK_SHAPE.test(hook)) return fail(res, 503, 'Publishing is not set up yet: the site rebuild is not configured on the server.');
  const apikey = cfg.anonKey || cfg.serviceKey;
  if (!cfg.url || !apikey) return fail(res, 503, 'Publishing is not available right now.');

  const authorization = String(req.headers?.authorization || '');
  if (!/^Bearer [A-Za-z0-9._-]{20,}$/.test(authorization)) return fail(res, 401, 'Admin sign-in required.');

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return fail(res, 400, 'Invalid request body.'); }
  const store = body?.store;
  const version = Number(body?.version);
  if (!STOREFRONT_CONTENT_STORES.includes(store)) return fail(res, 400, 'Unknown storefront.');
  if (!Number.isInteger(version) || version < 1) return fail(res, 400, 'Missing draft version.');

  // 1. Record the publish, as the admin.
  let recorded;
  try {
    const r = await fetch(`${cfg.url}/rest/v1/rpc/admin_publish_storefront`, {
      method: 'POST',
      headers: { apikey, Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_store: store, p_expected_version: version }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await r.json().catch(() => ({}));
    if (!r.ok) {
      const message = String(payload?.message || '');
      if (r.status === 401 || r.status === 403 || /admin only|JWT/i.test(message)) return fail(res, 403, 'Admin sign-in required.');
      if (/^stale/.test(message)) return fail(res, 409, 'This storefront was saved elsewhere since you opened it. Reload it, check it, and publish again.');
      return fail(res, 502, 'The publish could not be recorded. Nothing was changed.');
    }
    recorded = payload;
  } catch {
    return fail(res, 502, 'The publish could not be recorded. Nothing was changed.');
  }

  // 2. Rebuild. Republishing the same version is harmless, so "press Publish again" is the remedy.
  try {
    const d = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10000) });
    if (!d.ok) return fail(res, 502, 'Published, but the site rebuild did not start. Press Publish again.');
  } catch {
    return fail(res, 502, 'Published, but the site rebuild did not start. Press Publish again.');
  }
  return res.status(200).json({
    ok: true, store, version: Number(recorded?.version) || version,
    publishedAt: typeof recorded?.published_at === 'string' ? recorded.published_at : null, rebuild: 'started',
  });
}
