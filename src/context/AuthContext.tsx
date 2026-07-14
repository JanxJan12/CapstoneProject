import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { saveSession, getSession, clearSession, type Session } from "../data/session";
import type { DemoAccount } from "../data/authAccounts";

interface AuthContextValue {
  session: Session | null;
  login: (account: DemoAccount) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getSession());

  const login = useCallback((account: DemoAccount) => {
    saveSession(account);
    setSession(getSession());
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
