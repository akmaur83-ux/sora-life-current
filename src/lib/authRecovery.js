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

// ------------------------------------------------------------
// OAuth callback handling
//
// Supabase returns a FAILED sign-in to the redirect URL carrying `error` and
// `error_description` — sometimes in the query string, sometimes in the hash,
// depending on which stage failed. Nothing read either, so a customer who
// declined the Google consent screen, or hit a provider that was not
// configured, landed on /account with no session and no explanation: a silent
// dead end that looks like the site is broken.
// ------------------------------------------------------------

/** Messages we are willing to show. Provider text is never echoed verbatim. */
const OAUTH_ERROR_MESSAGES = {
  access_denied: 'Sign-in was cancelled. You can try again or use your email and password.',
  server_error: 'That sign-in provider had a problem. Please try again, or use your email and password.',
  temporarily_unavailable: 'That sign-in provider is unavailable right now. Please try again shortly.',
  provider_email_needs_verification: 'Please verify your email with that provider first, then try again.',
  // Raised when an address already belongs to an account created another way.
  invalid_request: 'We could not complete that sign-in. If you already have an account, sign in with your email and password.',
};

/**
 * Extract an OAuth failure from a callback URL.
 *
 * Returns a safe, human message, or '' when the URL carries no error. The
 * provider's own `error_description` is deliberately NOT rendered: it is
 * attacker-influencable text arriving in a URL, and echoing it into the page
 * would be a reflected-content risk for no benefit.
 */
export function readOAuthError(search, hash) {
  const fromQuery = new URLSearchParams(typeof search === 'string' ? search.replace(/^\?/, '') : '');
  const fromHash = new URLSearchParams(typeof hash === 'string' ? hash.replace(/^#/, '') : '');
  const code = fromQuery.get('error') || fromHash.get('error')
    || fromQuery.get('error_code') || fromHash.get('error_code');
  if (!code) return '';
  return OAUTH_ERROR_MESSAGES[code]
    || 'We could not complete that sign-in. Please try again, or use your email and password.';
}

/**
 * True when the URL fragment carries auth tokens.
 *
 * supabase-js consumes them, but leaves them in the address bar — so the
 * access token sits in browser history and in anything the customer pastes.
 * The caller strips the fragment once the session is established.
 */
export function hashCarriesAuthTokens(hash) {
  if (typeof hash !== 'string' || !hash) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.has('access_token') || params.has('refresh_token');
}
