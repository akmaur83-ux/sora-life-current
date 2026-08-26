// ============================================================
// Creator Program — pure link helpers.
//
// Deliberately free of any Supabase/browser import so the rules below can be
// unit-tested directly (scripts/test-creator-program.mjs). These are
// convenience guards: the database repeats the destination rule as a CHECK
// constraint, so a bypass here still cannot store a malicious destination.
// ============================================================

export const CREATOR_STATUSES = ['pending', 'active', 'paused', 'suspended', 'archived'];
export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'ended'];
export const LINK_STATUSES = ['active', 'paused', 'archived'];
export const DESTINATION_TYPES = ['homepage', 'product', 'category', 'custom'];

/**
 * Force a destination to an INTERNAL root-relative path.
 * Anything resembling an external, protocol-relative or script URL collapses
 * to '/', so a tracking link can never become an open redirect.
 */
export function normalizeDestination(path, type) {
  let p = String(path || '').trim();
  if (type === 'homepage' || !p) return '/';
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return '/'; // http:, javascript:, data:
  if (p.startsWith('//')) return '/';              // protocol-relative
  if (!p.startsWith('/')) p = `/${p}`;
  return p.slice(0, 300);
}

/** True when a stored destination is a safe internal path. */
export function isSafeDestination(path) {
  const p = String(path || '');
  return p.startsWith('/')
    && !p.startsWith('//')
    && !p.includes('://')
    && !/javascript:/i.test(p)
    && p.length <= 300;
}

/**
 * The public tracking URL for a link.
 * `ref` carries the human-readable creator code; `trk` carries the link's own
 * unique code so the server can resolve this exact link (and its campaign).
 */
export function buildTrackingUrl(link, creator, campaign, origin) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const path = link?.destination_path || '/';
  const params = new URLSearchParams();
  params.set('ref', creator?.creator_code || link?.public_code || '');
  if (campaign?.campaign_code) params.set('campaign', campaign.campaign_code);
  if (link?.public_code) params.set('trk', link.public_code);
  return `${base}${path}${path.includes('?') ? '&' : '?'}${params.toString()}`;
}
