import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { getSession } from "../data/session";
import type { AccountRole } from "../data/authAccounts";

// Set to true to force all protected routes into maintenance mode
export const MAINTENANCE_MODE = false;

interface RequireAuthProps {
  role: AccountRole;
  children: React.ReactNode;
}

export function RequireAuth({ role, children }: RequireAuthProps) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  if (MAINTENANCE_MODE) {
    return <Navigate to="/auth?notice=maintenance" replace />;
  }

  // No session at all — redirect with unauthorized notice
  if (!session) {
    return <Navigate to="/auth?notice=unauthorized" replace />;
  }

  // Check if session has expired since last render
  const live = getSession();
  if (!live) {
    logout();
    return <Navigate to="/auth?notice=session-expired" replace />;
  }

  // Session belongs to a different role — access denied
  if (session.role !== role) {
    return <Navigate to="/auth?notice=unauthorized" replace />;
  }

  return <>{children}</>;
}

/** Hook for triggering a logout from inside a protected module */
export function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return () => {
    logout();
    navigate("/auth");
  };
}
