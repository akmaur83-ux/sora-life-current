// ============================================================
// Admin access decision rules.
//
// Free of React and of the Supabase client, so the rules can be unit tested in
// Node (scripts/test-purchase-gating.mjs) — the same split authRecovery.js and
// oauthProviders.js use. adminAuth.jsx performs the query and holds the state.
//
// The states exist because "not an admin" and "the membership query failed"
// used to collapse into a single boolean. A dropped request then looked
// exactly like a denial and bounced a signed-in admin to the login page, so
// they re-entered credentials for a problem that was never about them.
//
//   'unknown'  not checked yet
//   'admin'    the query SUCCEEDED and returned a membership row
//   'denied'   the query SUCCEEDED and returned nothing — genuinely not an admin
//   'error'    the query FAILED; membership is still unknown
//
// Separating them cannot widen access: `grantsAdminAccess` returns true for
// exactly one state, and the real enforcement is RLS on the server regardless.
// ============================================================
export const ADMIN_UNKNOWN = 'unknown';
export const ADMIN_YES = 'admin';
export const ADMIN_DENIED = 'denied';
export const ADMIN_ERROR = 'error';

/** Map a Supabase `{ data, error }` response to a verification state. */
export function adminStateFromResult({ data, error } = {}) {
  if (error) return ADMIN_ERROR;
  return data ? ADMIN_YES : ADMIN_DENIED;
}

/**
 * The single definition of "may use the admin area".
 *
 * Deliberately an allowlist of one: anything that is not a confirmed,
 * successfully-read membership is not access.
 */
export function grantsAdminAccess(state) {
  return state === ADMIN_YES;
}
