import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import {
  adminStateFromResult, grantsAdminAccess,
  ADMIN_UNKNOWN, ADMIN_DENIED, ADMIN_ERROR,
} from "./adminAccess.js";

export * from './adminAccess.js';

const AdminAuthContext = createContext(null);

// The decision rules live in a React-free module so they can be unit
// tested directly in Node; see src/lib/adminAccess.js for why the states
// exist and why only one of them grants access.
export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [adminState, setAdminState] = useState(ADMIN_UNKNOWN);
  const [loading, setLoading] = useState(true);

  // Derived, never stored: there is one definition of "is an admin" and it is
  // strictly the successful-and-present case.
  const isAdmin = grantsAdminAccess(adminState);

  async function queryMembership(userId) {
    try {
      const res = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      return adminStateFromResult(res);
    } catch {
      // A thrown client/network error is the same class of "we don't know".
      return ADMIN_ERROR;
    }
  }

  async function verifyAdmin(currentSession) {
    if (!currentSession?.user) {
      setAdminState(ADMIN_DENIED);
      return ADMIN_DENIED;
    }

    let state = await queryMembership(currentSession.user.id);
    // One retry: a single dropped request should not cost an admin their
    // session. A genuine denial ('denied') is never retried.
    if (state === ADMIN_ERROR) {
      await new Promise((r) => setTimeout(r, 400));
      state = await queryMembership(currentSession.user.id);
    }

    setAdminState(state);
    return state;
  }

  /** Lets the error screen ask again without a full reload. */
  async function retryVerification() {
    setAdminState(ADMIN_UNKNOWN);
    const { data: { session: current } } = await supabase.auth.getSession();
    setSession(current);
    return verifyAdmin(current);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return;

      setSession(currentSession);
      await verifyAdmin(currentSession);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      await verifyAdmin(currentSession);

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    setSession(data.session);

    const state = await verifyAdmin(data.session);

    if (!data.session || !grantsAdminAccess(state)) {
      await supabase.auth.signOut();
      setSession(null);
      setAdminState(ADMIN_DENIED);

      // Say which of the two it was. Telling someone their account is not
      // authorized when the check simply could not run sends them looking for
      // the wrong problem.
      return {
        error: new Error(
          state === ADMIN_ERROR
            ? "We could not verify your admin access just now. Please check your connection and try again."
            : "This account is not authorized as a SORA LIFE admin."
        ),
      };
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setAdminState(ADMIN_DENIED);
  }

  return (
    <AdminAuthContext.Provider
      value={{
        session,
        isAdmin,
        // Lets the route tell "not an admin" apart from "could not check".
        adminState,
        verificationFailed: adminState === ADMIN_ERROR,
        retryVerification,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }

  return context;
}