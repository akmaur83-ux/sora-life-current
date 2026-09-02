// ============================================================
// POST /api/newsletter/subscribe
//
// The newsletter form used to be a lie: it flipped a local flag and claimed
// a welcome code that did not exist. This route is what makes the success
// message true — the browser only sees success after a row is actually
// committed.
//
// Design notes:
//   * The service-role key never reaches the browser, so the write happens
//     here rather than through the public key. newsletter_subscribers has
//     no anon policy at all (migration 0020).
//   * Rate limited per IP with the same limiter checkout uses, because this
//     is an unauthenticated write endpoint.
//   * The response is identical whether the address was new or already
//     subscribed. Distinguishing them would let anyone test which addresses
//     are on the list.
// ============================================================
import { getSupabaseConfig } from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';

// Intentionally conservative: this is the shape of an address we are willing
// to store, not an attempt to fully validate RFC 5322.
const EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 practical maximum.

/** Trim + lowercase, so "  Me@Example.COM " and "me@example.com" are one row. */
export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH + 1);
}

export function isAcceptableEmail(email) {
  return Boolean(email) && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const sb = getSupabaseConfig();

  // Unauthenticated write -> limit before doing any work. Fails open, like
  // every other use of this limiter.
  if (!(await enforceRateLimit(req, res, { name: 'newsletter', limit: 5, windowSeconds: 60 }, sb))) return;

  if (!sb.configured) {
    console.error('[newsletter] Supabase server env missing.');
    return res.status(503).json({ error: 'We could not sign you up right now. Please try again later.' });
  }

  let email;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    email = normalizeEmail(body.email);
  } catch {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!isAcceptableEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const response = await fetch(`${sb.url}/rest/v1/newsletter_subscribers`, {
      method: 'POST',
      headers: {
        apikey: sb.serviceKey,
        Authorization: `Bearer ${sb.serviceKey}`,
        'Content-Type': 'application/json',
        // Re-subscribing must not 409. Merging on the unique email keeps the
        // original created_at and simply refreshes the row.
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email,
        status: 'subscribed',
        source: 'storefront_footer',
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // Status + code only. The body can echo the submitted address, which
      // does not belong in logs.
      let code = '';
      try { code = JSON.parse(detail)?.code || ''; } catch { /* not JSON */ }
      console.error('[newsletter] insert failed:', response.status, code);
      return res.status(502).json({ error: 'We could not sign you up right now. Please try again.' });
    }

    // Same answer for a new address and one already on the list.
    return res.status(200).json({ subscribed: true });
  } catch (err) {
    console.error('[newsletter] failed:', err?.message);
    return res.status(500).json({ error: 'We could not sign you up right now. Please try again.' });
  }
}
