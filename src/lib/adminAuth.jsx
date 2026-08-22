import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function verifyAdmin(currentSession) {
  if (!currentSession?.user) {
    setIsAdmin(false);
    return false;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", currentSession.user.id)
    .maybeSingle();

  const authorized = !error && !!data;
  setIsAdmin(authorized);

  return authorized;
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

const authorized = await verifyAdmin(data.session);

if (!data.session || !authorized) {
      await supabase.auth.signOut();
      setSession(null);
      setIsAdmin(false);

      return {
        error: new Error("This account is not authorized as a SORA LIFE admin."),
      };
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }

  return (
    <AdminAuthContext.Provider
      value={{
        session,
        isAdmin,
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