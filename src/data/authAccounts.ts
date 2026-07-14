// ── Seeded demo accounts ─────────────────────────────────────────
// In production this lookup would be performed server-side.
// Here it lives in-browser for prototype demonstration only.

export type AccountRole = "manager" | "cashier" | "kitchen" | "customer" | "rider";

export interface DemoAccount {
  email: string;
  password: string;
  role: AccountRole;
  name: string;
  label: string;          // human-readable role
  dest: string;           // destination after login
  disabled?: boolean;
}

// ── Staff accounts (login via Staff Portal) ───────────────────────
export const STAFF_ACCOUNTS: DemoAccount[] = [
  {
    email:    "manager@rrjfoodhouse.com",
    password: "Manager@123",
    role:     "manager",
    name:     "Maria Reyes",
    label:    "Manager",
    dest:     "Manager Dashboard",
  },
  {
    email:    "cashier@rrjfoodhouse.com",
    password: "Cashier@123",
    role:     "cashier",
    name:     "Juan Santos",
    label:    "Cashier",
    dest:     "Cashier Dashboard",
  },
  {
    email:    "kitchen@rrjfoodhouse.com",
    password: "Kitchen@123",
    role:     "kitchen",
    name:     "Ana Cruz",
    label:    "Kitchen Staff",
    dest:     "Kitchen Queue",
  },
];

// ── Customer account ─────────────────────────────────────────────
export const CUSTOMER_ACCOUNT: DemoAccount = {
  email:    "customer@rrjfoodhouse.com",
  password: "Customer@123",
  role:     "customer",
  name:     "Juan dela Cruz",
  label:    "Customer",
  dest:     "Customer Home",
};

// ── Rider account ────────────────────────────────────────────────
export const RIDER_ACCOUNT: DemoAccount = {
  email:    "ramil.abad@rrj.com",
  password: "Rider@123",
  role:     "rider",
  name:     "Ramil Abad",
  label:    "Delivery Rider",
  dest:     "Rider Home",
};

// ── All accounts (for admin reference) ──────────────────────────
export const ALL_ACCOUNTS: DemoAccount[] = [
  ...STAFF_ACCOUNTS,
  CUSTOMER_ACCOUNT,
  RIDER_ACCOUNT,
];

// ── Auth result types ────────────────────────────────────────────
export type AuthSuccess = { ok: true;  account: DemoAccount };
export type AuthFailure = { ok: false; error: AuthError };
export type AuthError =
  | "unknown-email"
  | "wrong-password"
  | "account-disabled"
  | "unauthorized-role";  // right email, wrong login screen

// ── Authenticate against a specific set of allowed accounts ──────
export function authenticate(
  email: string,
  password: string,
  allowedRoles: AccountRole[],
): AuthSuccess | AuthFailure {
  const account = ALL_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );

  if (!account)           return { ok: false, error: "unknown-email"       };
  if (account.disabled)   return { ok: false, error: "account-disabled"    };
  if (!allowedRoles.includes(account.role))
                          return { ok: false, error: "unauthorized-role"   };
  if (account.password !== password)
                          return { ok: false, error: "wrong-password"      };

  return { ok: true, account };
}
