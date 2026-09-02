// ============================================================
// Social sign-in (Supabase OAuth).
//
// The code path is real. Whether a BUTTON appears is a separate, deliberate
// decision, because a provider only works once it has been configured in the
// Supabase Dashboard (Authentication -> Providers) with a client id and
// secret held there — never in this repository.
//
// Previously the UI showed "Continue with Google" and "Continue with Apple"
// as permanently disabled buttons titled "Coming soon". That is misleading
// in both directions: it advertises sign-in methods that do not exist, and
// it would keep looking broken even after a provider was switched on.
//
// So: a provider renders only when it is named in VITE_OAUTH_PROVIDERS at
// build time. Nothing is listed by default, so nothing appears until the
// owner has genuinely finished the dashboard setup for that provider.
//
//   VITE_OAUTH_PROVIDERS=google          -> only Google
//   VITE_OAUTH_PROVIDERS=google,apple    -> both
//   (unset)                              -> no social buttons at all
//
// Google and Apple are independent: enabling one says nothing about the
// other, which matters because Apple's setup requires a paid developer
// account and a signing key that Google's does not.
// ============================================================
import { supabase } from './supabase.js';
import { parseEnabledProviders, SUPPORTED_PROVIDERS, PROVIDER_LABELS } from './oauthProviders.js';

export { SUPPORTED_PROVIDERS, PROVIDER_LABELS, parseEnabledProviders };

/** Providers configured for THIS build. Empty unless explicitly opted in. */
export function enabledOAuthProviders() {
  return parseEnabledProviders(import.meta.env.VITE_OAUTH_PROVIDERS);
}

/**
 * Start an OAuth sign-in. Refuses any provider that is not enabled for this
 * build, so a stale or hand-crafted call cannot launch a flow that the
 * project has not configured (which would dead-end on a Supabase error page).
 */
export async function signInWithProvider(provider) {
  if (!enabledOAuthProviders().includes(provider)) {
    return { error: { message: 'That sign-in method is not available.' } };
  }
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: redirectTo ? { redirectTo } : undefined,
  });
  return { error };
}
