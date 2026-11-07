import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Session as SupabaseAuthSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { clearSession, type Session as AppSession } from "@/data/session";

import type { AccountRole } from "@/data/accountRole";

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: AccountRole;
  is_active: boolean;
}

interface AuthContextValue {
  session: AppSession | null;
  loading: boolean;
  authError: string | null;
  retrySession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DATABASE_ROLES: AccountRole[] = [
  "customer",
  "cashier",
  "manager",
  "rider",
];

function isDatabaseRole(value: unknown): value is AccountRole {
  return DATABASE_ROLES.includes(value as AccountRole);
}

function getDisplayName(
  profile: ProfileRow,
  authSession: SupabaseAuthSession,
): string {
  const profileName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (profileName) {
    return profileName;
  }

  const metadataName = authSession.user.user_metadata?.full_name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return authSession.user.email ?? "RRJ User";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * Authentication now comes only from Supabase.
   *
   * Old prototype/demo sessions are no longer trusted.
   */
  const [session, setSession] = useState<AppSession | null>(null);

  const [loading, setLoading] = useState(true);

  const [authError, setAuthError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const authRequestRef = useRef(0);
  const sessionUserIdRef = useRef<string | null>(null);
  const deniedSessionMessageRef = useRef<string | null>(null);

  const loadSupabaseSession = useCallback(
    async (
      authSession: SupabaseAuthSession | null,
      requestId: number,
    ): Promise<void> => {
      const isCurrentRequest = () =>
        mountedRef.current && requestId === authRequestRef.current;

      /*
       * No real Supabase session means the user is
       * not authenticated.
       *
       * Also remove any old prototype session that
       * may still exist in sessionStorage.
       */
      if (!authSession?.user) {
        if (!isCurrentRequest()) {
          return;
        }

        const deniedMessage = deniedSessionMessageRef.current;

        deniedSessionMessageRef.current = null;
        sessionUserIdRef.current = null;

        clearSession();

        setSession(null);
        setAuthError(deniedMessage);
        setLoading(false);

        return;
      }

      if (sessionUserIdRef.current !== authSession.user.id) {
        sessionUserIdRef.current = null;
        setSession(null);
        setLoading(true);
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
              id,
              first_name,
              last_name,
              role,
              is_active
            `,
        )
        .eq("id", authSession.user.id)
        .single();

      if (!isCurrentRequest()) {
        return;
      }

      if (error) {
        console.error("Unable to load profile:", error.message);

        setSession(null);

        setAuthError(
          "Your account was authenticated, but its profile could not be loaded.",
        );

        setLoading(false);

        return;
      }

      const profile = data as ProfileRow;

      if (!isDatabaseRole(profile.role)) {
        const message = "This account has an unsupported role.";

        deniedSessionMessageRef.current = message;

        clearSession();

        sessionUserIdRef.current = null;
        setSession(null);
        setAuthError(message);
        setLoading(false);

        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });

        if (signOutError) {
          console.error(
            "Unable to clear unsupported session:",
            signOutError.message,
          );
        }

        return;
      }

      if (!profile.is_active) {
        const message = "This account has been disabled.";

        deniedSessionMessageRef.current = message;

        clearSession();

        sessionUserIdRef.current = null;
        setSession(null);
        setAuthError(message);
        setLoading(false);

        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });

        if (signOutError) {
          console.error(
            "Unable to clear disabled session:",
            signOutError.message,
          );
        }

        return;
      }

      /*
       * Remove any remaining legacy prototype
       * session before establishing the real
       * application session.
       */
      clearSession();

      const expiresAt = authSession.expires_at
        ? authSession.expires_at * 1000
        : Date.now() + 60 * 60 * 1000;

      sessionUserIdRef.current = authSession.user.id;

      setSession({
        id: profile.id,

        role: profile.role,

        name: getDisplayName(profile, authSession),

        email: authSession.user.email ?? "",

        expiresAt,
      });

      setAuthError(null);
      setLoading(false);
    },
    [],
  );

  const retrySession = useCallback(async (): Promise<void> => {
    const requestId = ++authRequestRef.current;

    deniedSessionMessageRef.current = null;
    setAuthError(null);
    setLoading(true);

    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession();

    if (!mountedRef.current || requestId !== authRequestRef.current) {
      return;
    }

    if (error) {
      console.error("Unable to restore session:", error.message);

      setAuthError("Unable to restore your login session.");
      setLoading(false);

      return;
    }

    await loadSupabaseSession(currentSession, requestId);
  }, [loadSupabaseSession]);

  useEffect(() => {
    mountedRef.current = true;

    void retrySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const requestId = ++authRequestRef.current;

      window.setTimeout(() => {
        if (mountedRef.current) {
          void loadSupabaseSession(nextSession, requestId);
        }
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      authRequestRef.current += 1;

      subscription.unsubscribe();
    };
  }, [loadSupabaseSession, retrySession]);

  const logout = useCallback(async (): Promise<void> => {
    authRequestRef.current += 1;
    deniedSessionMessageRef.current = null;
    sessionUserIdRef.current = null;

    clearSession();

    setSession(null);
    setAuthError(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Unable to sign out:", error.message);

      setAuthError(
        "You were logged out locally, but Supabase returned an error.",
      );
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        authError,
        retrySession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
