// ============================================================
// Lightweight, serverless-safe rate limiting.
//
// Vercel functions do not share memory between invocations, so the counter
// lives in Postgres (the infrastructure this project already runs) behind the
// atomic rate_limit_check function from migration 0009. One upsert per hit.
//
// Design rules from the audit:
//   * Return 429 when a client exceeds its window.
//   * Never block a normal customer (limits are generous; keyed per client IP).
//   * FAIL OPEN — if the limiter store is unreachable or the migration is not
//     applied yet, requests are ALLOWED. A limiter outage must never take the
//     site (or checkout) down.
//
// This module only gates ACCESS in front of a handler. It never touches the
// handler's own logic — Razorpay signature/secret code is not modified.
// ============================================================
import { callRpc } from './supabaseAdmin.js';

/** Best-effort client IP from the Vercel/proxy headers. */
export function getClientIp(req) {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  const xr = req.headers?.['x-real-ip'];
  if (typeof xr === 'string' && xr.length) return xr.trim();
  return 'unknown';
}

/**
 * @returns {Promise<{allowed:boolean, retryAfter?:number}>}
 * Fails OPEN (allowed:true) on any error.
 */
export async function checkRateLimit({ key, limit, windowSeconds }, cfg) {
  try {
    const r = await callRpc('rate_limit_check', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }, cfg);
    if (!r || typeof r.allowed !== 'boolean') return { allowed: true };
    const now = Math.floor(Date.now() / 1000);
    return { allowed: r.allowed, retryAfter: Math.max(1, (Number(r.reset) || now + windowSeconds) - now) };
  } catch {
    return { allowed: true }; // fail-open
  }
}

/**
 * Guard to call at the very top of a handler.
 * @returns {Promise<boolean>} true = continue; false = a 429 was already sent.
 */
export async function enforceRateLimit(req, res, { name, limit, windowSeconds }, cfg) {
  // No DB config -> cannot limit -> allow (fail-open), same as the DB being down.
  if (!cfg?.configured) return true;
  const ip = getClientIp(req);
  const { allowed, retryAfter } = await checkRateLimit(
    { key: `${name}:${ip}`, limit, windowSeconds }, cfg,
  );
  if (allowed) return true;
  res.setHeader('Retry-After', String(retryAfter || windowSeconds));
  res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  return false;
}
