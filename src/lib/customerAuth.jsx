// ============================================================
// Customer authentication (Supabase Auth, email/password).
//
// This is the storefront-customer counterpart to adminAuth.jsx. It is
// deliberately SEPARATE from the admin provider so the two roles stay
// cleanly isolated and independently auditable. Both use the one shared
// Supabase session (there is a single session per browser); "admin" vs
// "customer" is a role distinction decided elsewhere (admin_users
// membership), NOT by this provider. This provider never checks
// admin_users and never grants any elevated capability.
//
// Scope: identity only — sign up, sign in, sign out, request a password
// reset, and complete that reset by setting a new password. It does NOT
// read orders, does NOT touch the database schema/RLS, and adds NO blocking
// network call on mount: getSession() reads the persisted session from local
// storage, so storefront routes stay zero-network for auth.
// ============================================================
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { hashIndicatesRecovery, readOAuthError, hashCarriesAuthTokens } from './authRecovery.js';

export { hashIndicatesRecovery };

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set while the customer is completing a reset. Gates the account UI so
  // the only thing they can do is choose a new password.
  const [recovery, setRecovery] = useState(
    () => typeof window !== 'undefined' && hashIndicatesRecovery(window.location.hash)
  );
  // A failed OAuth round-trip comes back as ?error=... on the redirect URL.
  // Captured once at mount, before anything can rewrite the address bar, so
  // the sign-in card can explain what happened instead of silently showing
  // an empty logged-out page.
  const [oauthError, setOauthError] = useState(
    () => (typeof window === 'undefined'
      ? ''
      : readOAuthError(window.location.search, window.location.hash))
  );

  useEffect(() => {
    let mounted = true;

    // Local storage read — no network round-trip, so this never blocks
    // or slows first paint on any storefront route.
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!mounted) return;
      setSession(current);
      setLoading(false);
    });

    // Keeps this provider in sync with sign-in/out that happen anywhere
    // (including the single shared session being replaced). Passive
    // listener; fires no query of its own.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, current) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      // Signing out ends any recovery flow; otherwise a stale flag would
      // keep showing the set-password screen over the login card.
      if (event === 'SIGNED_OUT') setRecovery(false);
      // A successful sign-in clears any earlier failure notice.
      if (event === 'SIGNED_IN') setOauthError('');

      // supabase-js reads the tokens out of the fragment but leaves it in the
      // address bar, so an access token ends up in browser history and in any
      // URL the customer copies. Strip it once the session exists — but NOT
      // during recovery, where the fragment is still what gates the
      // set-password screen on a refresh.
      if (current && typeof window !== 'undefined'
          && hashCarriesAuthTokens(window.location.hash)
          && !hashIndicatesRecovery(window.location.hash)
          && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      setSession(current);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Create an account. If the Supabase project requires email
  // confirmation, no session is returned yet (data.session is null) —
  // the caller should tell the user to confirm via email before logging
  // in. If confirmation is disabled, the user is signed in immediately.
  async function signUp({ email, password, fullName }) {
    // Send the confirmation email's link back to the SAME environment the
    // customer signed up from — production, a Vercel preview, or localhost —
    // by using the live origin. Without this, Supabase falls back to the
    // project's Site URL (which was localhost), so a production signup would
    // open localhost after tapping the emailed link. The target /account is
    // where supabase-js (detectSessionInUrl: true, on by default) picks up the
    // session from the URL and signs the customer in.
    const options = {};
    if (fullName) options.data = { full_name: fullName };
    if (typeof window !== 'undefined') options.emailRedirectTo = `${window.location.origin}/account`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: Object.keys(options).length ? options : undefined,
    });
    if (error) return { error, needsConfirmation: false, session: null };
    return { error: null, needsConfirmation: !data.session, session: data.session ?? null };
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    setSession(data.session);
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  // Sends a password-reset email. redirectTo brings the customer back to
  // /account, where the recovery landing is detected and the set-password
  // screen is shown.
  //
  // The caller must show the SAME confirmation whether or not the address
  // has an account — Supabase deliberately does not distinguish, and neither
  // should we, or this becomes an account-enumeration oracle.
  async function resetPassword(email) {
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );
    return { error };
  }

  /**
   * Complete a recovery by setting a new password on the recovery session.
   *
   * Requires a live session: an expired or already-consumed recovery link
   * leaves none, and Supabase rejects the update rather than silently
   * succeeding. The caller surfaces that as "link expired, request a new one".
   */
  async function updatePassword(newPassword) {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (!current) {
      return { error: { message: 'Your reset link has expired. Please request a new one.' } };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error };
    // The reset is done — drop the gate so the account UI behaves normally.
    setRecovery(false);
    return { error: null };
  }

  /** Abandon a recovery landing without changing anything. */
  function clearRecovery() { setRecovery(false); }

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    recovery,
    oauthError,
    clearOauthError: () => setOauthError(''),
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    clearRecovery,
  };

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used inside CustomerAuthProvider');
  }
  return context;
}
