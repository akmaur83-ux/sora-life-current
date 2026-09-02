// ============================================================
// Which social sign-in providers this build may show.
//
// Free of the Supabase client and of import.meta so the allowlist rules can
// be unit tested in Node (scripts/test-feature-activation.mjs). oauth.js
// supplies the build-time value and performs the actual sign-in.
// ============================================================

// Providers this codebase knows how to render and start a flow for.
export const SUPPORTED_PROVIDERS = ['google', 'apple'];

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
