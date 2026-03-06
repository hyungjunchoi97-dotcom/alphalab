"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<string | null>;
  logout: () => Promise<void>;
  /** Open the auth modal from anywhere */
  openAuthModal: () => void;
  closeAuthModal: () => void;
  authModalOpen: boolean;
  /** Stash a callback to run after successful login */
  setPendingAction: (cb: (() => void) | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAction, _setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setUser(s?.user ?? null);
      setSession(s ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      const newUser = s?.user ?? null;
      setUser(newUser);
      setSession(s ?? null);

      // If user just logged in and there's a pending action, run it
      if (newUser && pendingAction) {
        pendingAction();
        _setPendingAction(null);
        setAuthModalOpen(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user changes and there's a pending action, fire it
  useEffect(() => {
    if (user && pendingAction) {
      pendingAction();
      _setPendingAction(null);
      setAuthModalOpen(false);
    }
  }, [user, pendingAction]);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return error ? error.message : null;
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? error.message : null;
    },
    []
  );

  const loginWithGoogle = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://www.thealphalabs.net" },
    });
    return error ? error.message : null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    _setPendingAction(null);
  }, []);
  const setPendingAction = useCallback(
    (cb: (() => void) | null) => _setPendingAction(() => cb),
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        loginWithEmail,
        signUp,
        loginWithGoogle,
        logout,
        openAuthModal,
        closeAuthModal,
        authModalOpen,
        setPendingAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
