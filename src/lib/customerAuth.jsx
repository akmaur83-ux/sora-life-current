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
// Phase 1 scope: identity only — sign up, sign in, sign out, and
// request-a-password-reset. It does NOT read orders, does NOT touch the
// database schema/RLS, and adds NO blocking network call on mount:
// getSession() reads the persisted session from local storage, so
// storefront routes stay zero-network for auth.
// ============================================================
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

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
    } = supabase.auth.onAuthStateChange((_event, current) => {
      if (!mounted) return;
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

  // Sends a password-reset email. redirectTo brings the user back to the
  // account page after they click the link. (Setting the new password on
  // that landing — the PASSWORD_RECOVERY event + updateUser — is a later
  // phase; Phase 1 only requests the email.)
  async function resetPassword(email) {
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );
    return { error };
  }

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
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
