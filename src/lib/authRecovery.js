// ============================================================
// Password-recovery helpers.
//
// Kept free of React and of the Supabase client so the rules can be unit
// tested directly (scripts/test-feature-activation.mjs). customerAuth.jsx
// and Account.jsx import from here rather than defining their own copies.
// ============================================================

// Minimum length the Supabase project itself enforces. Checked in the browser
// too so the customer is told before the round-trip rather than after it.
export const MIN_PASSWORD_LENGTH = 8;

/**
 * True when the current page load is a password-recovery landing.
 *
 * Supabase returns the customer to `${origin}/account#...type=recovery...`.
 * supabase-js consumes that fragment and emits PASSWORD_RECOVERY — but it can
 * do so BEFORE the auth provider's listener attaches, and a recovery session
 * is an ordinary signed-in session. Without this URL check the customer would
 * silently land on their account page with no way to set a password, which is
 * the one thing the reset email invited them to do.
 */
export function hashIndicatesRecovery(hash) {
  if (typeof hash !== 'string' || !hash) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('type') === 'recovery';
}

/**
 * Validate a proposed new password.
 * Returns an error string, or '' when the password is acceptable.
 */
export function validateNewPassword(password, confirm) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Please use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return 'Those passwords do not match.';
  return '';
}
