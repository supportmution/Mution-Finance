import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  demoMode: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const demoMode = !isSupabaseConfigured;
  const [isAdmin, setIsAdmin] = useState(demoMode);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      setIsAdmin(true);
      return;
    }

    let alive = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.error("Unable to restore Supabase session", error);
      if (!data.session) {
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      void client
        .rpc("finance_is_authorized")
        .then(async ({ data: authorized, error: authorizationError }) => {
          if (!alive) return;
          if (authorizationError || authorized !== true) {
            await client.auth.signOut();
            setSession(null);
            setIsAdmin(false);
          } else {
            setSession(data.session);
            const { data: admin, error: adminError } =
              await client.rpc("finance_is_admin");
            setIsAdmin(!adminError && admin === true);
          }
          setLoading(false);
        });
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) {
        setSession(nextSession);
        if (!nextSession) setIsAdmin(false);
      }
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const normalizedEmail = email.trim().toLowerCase();
    const allowedDomain = normalizedEmail.endsWith("@mution.tech");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;

    const { data: allowed, error: authorizationError } = await supabase.rpc(
      "finance_is_authorized",
    );
    if (authorizationError || allowed !== true) {
      await supabase.auth.signOut();
      if (!allowedDomain) {
        throw new Error(
          "Akun ini belum diizinkan. Gunakan email @mution.tech atau minta owner menambahkan email founder ke daftar akses.",
        );
      }
      throw new Error(
        "Akses akun belum diaktifkan di Supabase. Pastikan migrasi database sudah dijalankan.",
      );
    }

    const { data: admin, error: adminError } = await supabase.rpc(
      "finance_is_admin",
    );
    setIsAdmin(!adminError && admin === true);
    setSession(data.session);
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
    setIsAdmin(demoMode);
  }, [demoMode]);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      demoMode,
      isAdmin,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
    }),
    [
      session,
      loading,
      demoMode,
      isAdmin,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
