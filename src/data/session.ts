import type { AccountRole } from "./accountRole";

const KEY = "rrj_session";

export interface Session {
  id: string;
  role: AccountRole;
  name: string;
  email: string;
  expiresAt: number;
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}