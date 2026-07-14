import type { AccountRole, DemoAccount } from "./authAccounts";

const KEY = "rrj_session";
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface Session {
  role: AccountRole;
  name: string;
  email: string;
  expiresAt: number;
}

export function saveSession(account: DemoAccount): void {
  const session: Session = {
    role: account.role,
    name: account.name,
    email: account.email,
    expiresAt: Date.now() + TTL_MS,
  };
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}
