import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session as SupabaseAuthSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import {
  clearSession,
  getSession as getDemoSession,
  saveSession,
  type Session as AppSession,
} from "@/data/session";
import type {
  AccountRole,
  DemoAccount,
} from "@/data/authAccounts";

type DatabaseRole = Exclude<AccountRole, "kitchen">;

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: DatabaseRole;
  is_active: boolean;
}

interface AuthContextValue {
  session: AppSession | null;
  loading: boolean;
  authError: string | null;

  // Temporary support for the old staff/rider prototype.
  login: (account: DemoAccount) => void;

  logout: () => Promise<void>;
}

const AuthContext =
  createContext<AuthContextValue | null>(null);

const DATABASE_ROLES: DatabaseRole[] = [
  "customer",
  "cashier",
  "manager",
  "rider",
];

function isDatabaseRole(
  value: unknown,
): value is DatabaseRole {
  return DATABASE_ROLES.includes(
    value as DatabaseRole,
  );
}

function getDisplayName(
  profile: ProfileRow,
  authSession: SupabaseAuthSession,
): string {
  const profileName = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (profileName) {
    return profileName;
  }

  const metadataName =
    authSession.user.user_metadata?.full_name;

  if (
    typeof metadataName === "string" &&
    metadataName.trim()
  ) {
    return metadataName.trim();
  }

  return authSession.user.email ?? "RRJ User";
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  /*
   * getDemoSession remains temporarily so the old staff
   * and rider prototype pages do not break while we migrate
   * them to Google login.
   */
  const [session, setSession] =
    useState<AppSession | null>(() =>
      getDemoSession(),
    );

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] =
    useState<string | null>(null);

  const loadSupabaseSession = useCallback(
    async (
      authSession: SupabaseAuthSession | null,
    ): Promise<void> => {
      /*
       * No Supabase login exists. Temporarily allow the old
       * demo session until staff and rider authentication
       * are migrated.
       */
      if (!authSession?.user) {
        setSession(getDemoSession());
        setAuthError(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, role, is_active",
        )
        .eq("id", authSession.user.id)
        .single();

      if (error) {
        console.error(
          "Unable to load profile:",
          error.message,
        );

        setSession(null);
        setAuthError(
          "Your account was authenticated, but its profile could not be loaded.",
        );
        setLoading(false);
        return;
      }

      const profile = data as ProfileRow;

      if (!isDatabaseRole(profile.role)) {
        await supabase.auth.signOut();

        setSession(null);
        setAuthError(
          "This account has an unsupported role.",
        );
        setLoading(false);
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();

        setSession(null);
        setAuthError(
          "This account has been disabled.",
        );
        setLoading(false);
        return;
      }

      /*
       * A real Supabase login takes priority over any old
       * prototype session.
       */
      clearSession();

      const expiresAt = authSession.expires_at
        ? authSession.expires_at * 1000
        : Date.now() + 60 * 60 * 1000;

      setSession({
        role: profile.role,
        name: getDisplayName(
          profile,
          authSession,
        ),
        email: authSession.user.email ?? "",
        expiresAt,
      });

      setAuthError(null);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    /*
     * Restore an existing Supabase session when the app
     * first loads or refreshes.
     */
    const initializeAuthentication =
      async (): Promise<void> => {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (error) {
          console.error(
            "Unable to restore session:",
            error.message,
          );

          setAuthError(
            "Unable to restore your login session.",
          );
          setLoading(false);
          return;
        }

        await loadSupabaseSession(
          currentSession,
        );
      };

    void initializeAuthentication();

    /*
     * Listen for Google login, logout, and refreshed
     * authentication sessions.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        window.setTimeout(() => {
          if (mounted) {
            void loadSupabaseSession(
              nextSession,
            );
          }
        }, 0);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadSupabaseSession]);

  /*
   * Temporary mock login support. This will be removed after
   * StaffLoginPage and RiderLoginPage use Google login.
   */
  const login = useCallback(
    (account: DemoAccount): void => {
      saveSession(account);
      setSession(getDemoSession());
      setAuthError(null);
      setLoading(false);
    },
    [],
  );

  const logout =
    useCallback(async (): Promise<void> => {
      clearSession();
      setSession(null);
      setAuthError(null);

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "Unable to sign out:",
          error.message,
        );

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
        login,
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
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}