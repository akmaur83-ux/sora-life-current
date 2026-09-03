// ============================================================
// Which social sign-in providers this build may show.
//
// Free of the Supabase client and of import.meta so the allowlist rules can
// be unit tested in Node (scripts/test-feature-activation.mjs). oauth.js
// supplies the build-time value and performs the actual sign-in.
// ============================================================

// Providers this codebase knows how to render and start a flow for.
export const SUPPORTED_PROVIDERS = ['google', 'apple'];

/**
 * Providers this repository INTENDS a shipped build to enable.
 *
 * The committed, reviewable source of truth the build checks itself against.
 * It exists because the provider list previously came ONLY from the
 * VITE_OAUTH_PROVIDERS environment variable: an environment that simply
 * lacked that variable produced a bundle with social sign-in silently switched
 * off, and because public/bundle.js is the deployed artifact, that downgraded
 * bundle could then be committed and shipped.
 *
 * Add a provider here ONLY once it is actually configured in the Supabase
 * Dashboard (Authentication -> Providers) with its client id and secret. Those
 * credentials live in Supabase and never in this repository — the names below
 * are public configuration and carry no secret.
 *
 * Removing a provider here is the supported way to turn one off: a reviewed
 * code change rather than an invisible environment edit.
 */
export const INTENDED_PROVIDERS = ['google'];

/**
 * Intended providers that are missing from `enabled`.
 *
 * The build uses this to refuse to ship an artifact that would quietly drop a
 * sign-in method customers already rely on.
 */
export function missingIntendedProviders(enabled, intended = INTENDED_PROVIDERS) {
  const have = Array.isArray(enabled) ? enabled : [];
  return intended.filter((p) => !have.includes(p));
}

export const PROVIDER_LABELS = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
};

/**
 * Parse the build-time allowlist into the providers that may be shown.
 *
 * Empty by default and on anything unrecognised: a provider only works once
 * it has been configured in the Supabase Dashboard, so the safe answer to
 * "should this button exist?" is no until someone says otherwise. Google and
 * Apple are independent — enabling one says nothing about the other.
 */
export function parseEnabledProviders(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const wanted = raw.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  // Filtering SUPPORTED_PROVIDERS (rather than the input) keeps button order
  // stable and drops duplicates and unknown names in one step.
  return SUPPORTED_PROVIDERS.filter((p) => wanted.includes(p));
}
