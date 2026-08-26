// ============================================================
// POST /api/creator/track  — Creator Program attribution (FOUNDATION)
//
// The browser sends only a PUBLIC code (?ref=…, optional &campaign=…). This
// route resolves it server-side to the internal creator / campaign /
// tracking-link ids, validates that the creator is active, the campaign is
// live and in-window, and records ONE attribution event.
//
// Security:
//   * Internal ids are NEVER accepted from the browser. record_attribution_event
//     is service-role only, so a visitor cannot fabricate an event for an
//     arbitrary creator, nor write to the events table directly (no RLS
//     insert policy exists for anon/authenticated).
//   * commissionRate / creatorId / campaignId in the request body are ignored.
//   * For a 'signup' event the user id is derived from the VERIFIED access
//     token, never from the body.
//   * Rate-limited, so link codes cannot be enumerated cheaply.
//
// This phase records that a visit happened. It does NOT attribute any sale
// and creates no commission — that is Part 2.
// ============================================================
import { getSupabaseConfig, callRpc, getUserIdFromToken } from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';

const EVENTS = new Set(['click', 'landing', 'signup', 'campaign_attribution']);

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const sb = getSupabaseConfig();
  // Generous: a real visitor fires one or two of these per landing.
  if (!(await enforceRateLimit(req, res, { name: 'creator-track', limit: 20, windowSeconds: 60 }, sb))) return;

  if (!sb.configured) {
    // Attribution is non-essential to browsing — never surface an error that
    // could break the page. Report "not recorded" and move on.
    return res.status(200).json({ ok: false, reason: 'unavailable' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const ref = str(body.ref, 64);
    const campaign = str(body.campaign, 64);
    const visitorId = str(body.visitorId, 64);
    const landingPath = str(body.path, 300);
    const event = EVENTS.has(body.event) ? body.event : 'landing';

    if (!ref) return res.status(400).json({ ok: false, reason: 'missing_ref' });

    // Only a verified token can associate an event with a real account.
    const userId = await getUserIdFromToken(req.headers?.authorization, sb);
    if (event === 'signup' && !userId) {
      return res.status(401).json({ ok: false, reason: 'auth_required' });
    }

    const result = await callRpc('record_attribution_event', {
      p_ref: ref,
      p_campaign: campaign || null,
      p_event_type: event,
      p_visitor_id: visitorId || null,
      p_user_id: userId,
      p_landing_path: landingPath || null,
    }, sb);

    const out = result && typeof result === 'object' && !Array.isArray(result) ? result : (Array.isArray(result) ? result[0] : null);

    if (!out || out.ok !== true) {
      // A bad/expired/unknown code is a normal outcome, not a server error.
      return res.status(200).json({ ok: false, reason: out?.reason || 'not_attributed' });
    }

    // Only public-safe fields go back to the browser. No internal ids, no
    // commission rate, no contact details. `attributionId` is an opaque
    // handle Part 2 will exchange server-side.
    return res.status(200).json({
      ok: true,
      attributionId: out.attribution_id,
      creatorCode: out.creator_code,
      displayName: out.display_name,
      campaignCode: out.campaign_code || null,
      campaignName: out.campaign_name || null,
      windowDays: out.attribution_window_days,
    });
  } catch (err) {
    console.error('[creator/track] failed:', err?.message);
    // Never break the storefront because tracking failed.
    return res.status(200).json({ ok: false, reason: 'error' });
  }
}
