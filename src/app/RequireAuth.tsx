import { Navigate, useNavigate } from "react-router";

import { useAuth } from "@/app/providers/AuthProvider";
import type { AccountRole } from "@/data/accountRole";

export const MAINTENANCE_MODE = false;

interface RequireAuthProps {
  role: AccountRole;
  children: React.ReactNode;
}

export function RequireAuth({
  role,
  children,
}: RequireAuthProps) {
  const {
    session,
    loading,
  } = useAuth();

  if (MAINTENANCE_MODE) {
    return (
      <Navigate
        to="/auth?notice=maintenance"
        replace
      />
    );
  }

  /*
   * Do not redirect while Supabase is still restoring the
   * browser session. Redirecting too early would send a
   * valid Google user back to the login page.
   */
  if (loading) {
    return (
      <div className="auth-status-page flex h-full items-center justify-center bg-background p-4 sm:p-6">
        <div role="status" className="auth-status-card flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-white p-6 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />

          <p className="text-base font-bold text-foreground">
            Checking your account…
          </p>
          <p className="text-sm text-muted-foreground">Please wait while your session is restored.</p>
        </div>
      </div>
    );
  }

if (!session) {
  return (
    <Navigate
      to={
        role === "rider"
          ? "/auth?portal=rider"
          : "/auth"
      }
      replace
    />
  );
}

  if (session.role !== role) {
    return (
      <Navigate
        to="/auth?notice=unauthorized"
        replace
      />
    );
  }

  return <>{children}</>;
}

export function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return async (): Promise<void> => {
    await logout();
    navigate("/auth", { replace: true });
  };
}
