import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  UtensilsCrossed,
  TimerOff,
  ShieldOff,
  WrenchIcon,
  CheckCircle,
  ArrowLeft,
  Send,
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import { ImageWithFallback } from "../../../app/components/figma/ImageWithFallback";
import rrjLogo from "../../../imports/451655946_497836222754416_7005773426468078155_n__1_.jpg";
import {
  authenticate,
  STAFF_ACCOUNTS,
  type DemoAccount,
} from "../../../data/authAccounts";
import type { AccountRole } from "../../../data/authAccounts";
import { useAuth } from "../../../context/AuthContext";

// ── Types ──────────────────────────────────────────────────────────
type CardMode =
  | "login"
  | "signing-in"
  | "authenticating"
  | "success"
  | "forgot-password"
  | "forgot-success";

type FormError =
  | "invalid-credentials"
  | "unknown-email"
  | "wrong-password"
  | "account-disabled"
  | "unauthorized-role"
  | null;

export type AuthNotice =
  "session-expired" | "unauthorized" | "maintenance" | null;

// ── Role display config ────────────────────────────────────────────
const ROLE_META: Record<
  "manager" | "cashier" | "kitchen",
  { label: string; icon: React.ElementType; dest: string; color: string }
> = {
  manager: {
    label: "Manager",
    icon: LayoutDashboard,
    dest: "Manager Dashboard",
    color: "text-violet-600",
  },
  cashier: {
    label: "Cashier",
    icon: ShoppingCart,
    dest: "Cashier Dashboard",
    color: "text-blue-600",
  },
  kitchen: {
    label: "Kitchen Staff",
    icon: ChefHat,
    dest: "Kitchen Queue",
    color: "text-amber-600",
  },
};

// ── Notice configs ────────────────────────────────────────────────
const NOTICE_CONFIG: Record<
  NonNullable<AuthNotice>,
  {
    icon: React.ElementType;
    bg: string;
    border: string;
    titleColor: string;
    msgColor: string;
    title: string;
    message: string;
  }
> = {
  "session-expired": {
    icon: TimerOff,
    bg: "bg-amber-50",
    border: "border-amber-200",
    titleColor: "text-amber-800",
    msgColor: "text-amber-700",
    title: "Session Expired",
    message: "Your session has expired. Please sign in again to continue.",
  },
  unauthorized: {
    icon: ShieldOff,
    bg: "bg-red-50",
    border: "border-red-200",
    titleColor: "text-red-800",
    msgColor: "text-red-700",
    title: "Access Denied",
    message:
      "You do not have permission to access that page. Please sign in with an authorized account.",
  },
  maintenance: {
    icon: WrenchIcon,
    bg: "bg-blue-50",
    border: "border-blue-200",
    titleColor: "text-blue-800",
    msgColor: "text-blue-700",
    title: "Maintenance Mode",
    message:
      "The system is currently undergoing maintenance. Please try again shortly.",
  },
};

// ── Error messages ────────────────────────────────────────────────
const ERROR_MSG: Record<NonNullable<FormError>, string> = {
  "invalid-credentials":
    "Invalid email or password. Please check your credentials and try again.",
  "unknown-email": "No staff account found with that email address.",
  "wrong-password": "Incorrect password. Please try again.",
  "account-disabled":
    "Your account has been disabled. Please contact the administrator.",
  "unauthorized-role":
    "That account is not authorised to access the Staff Portal.",
};

// ── Props ──────────────────────────────────────────────────────────
interface Props {
  onLoginSuccess?: (role: AccountRole) => void;
}

// ── Demo accounts collapsible panel ──────────────────────────────
function DemoPanel({
  onFill,
}: {
  onFill: (email: string, password: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const ROLE_ICON: Record<string, React.ElementType> = {
    manager: LayoutDashboard,
    cashier: ShoppingCart,
    kitchen: ChefHat,
  };
  const ROLE_COLOR: Record<string, string> = {
    manager: "bg-violet-100 text-violet-700",
    cashier: "bg-blue-100 text-blue-700",
    kitchen: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="mt-5 border border-dashed border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
            Demo Accounts
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
            PROTOTYPE
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2">
          <p className="text-[10px] text-muted-foreground mb-3">
            Click <span className="font-semibold">Fill</span> to pre-populate
            the form, then click Sign In.
          </p>
          <div className="flex flex-col gap-2">
            {STAFF_ACCOUNTS.map((acct: DemoAccount) => {
              const Icon = ROLE_ICON[acct.role] ?? LayoutDashboard;
              const colorCls =
                ROLE_COLOR[acct.role] ?? "bg-zinc-100 text-zinc-600";
              return (
                <div
                  key={acct.email}
                  className="flex items-start justify-between gap-3 p-3 bg-card border border-border rounded-lg"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${colorCls}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-foreground">
                        {acct.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono break-all">
                        {acct.email}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {acct.password}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onFill(acct.email, acct.password)}
                    className="px-2.5 py-1 rounded-md bg-primary text-white text-[10px] font-bold hover:bg-amber-800 flex-shrink-0 transition-colors"
                  >
                    Fill
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-3 text-center">
            For testing purposes only · Not visible in production
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export function StaffLoginPage({ onLoginSuccess }: Props) {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const noticeParam = searchParams.get("notice");
  const notice: AuthNotice =
    noticeParam === "session-expired" ||
    noticeParam === "unauthorized" ||
    noticeParam === "maintenance"
      ? noticeParam
      : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [mode, setMode] = useState<CardMode>("login");
  const [formError, setFormError] = useState<FormError>(null);
  const [fpEmail, setFpEmail] = useState("");
  const [fpEmailErr, setFpEmailErr] = useState("");
  const [successAccount, setSuccessAccount] = useState<DemoAccount | null>(
    null,
  );

  // ── Fill demo credentials from panel ──────────────────────────
  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setFormError(null);
    setFieldErrors({});
  };

  // ── Validation ────────────────────────────────────────────────
  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!email) errs.email = "Email address is required";
    else if (!/\S+@\S+\.\S+/.test(email))
      errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Sign In ───────────────────────────────────────────────────
  const handleSignIn = () => {
    if (!validate()) return;
    setFormError(null);
    setMode("signing-in");

    // Simulate network latency (500ms) then authenticate
    setTimeout(() => {
      const result = authenticate(email, password, [
        "manager",
        "cashier",
        "kitchen",
      ]);

      if (!result.ok) {
        // Map auth error → FormError
        const errMap: Record<string, FormError> = {
          "unknown-email": "invalid-credentials",
          "wrong-password": "invalid-credentials",
          "account-disabled": "account-disabled",
          "unauthorized-role": "unauthorized-role",
        };
        setFormError(errMap[result.error] ?? "invalid-credentials");
        setMode("login");
        return;
      }

      // Credentials valid — move to authenticating state
      setSuccessAccount(result.account);
      setMode("authenticating");

      // Simulate permission check (1.5s) then redirect
      setTimeout(() => {
        setMode("success");
        login(result.account);
        setTimeout(() => onLoginSuccess?.(result.account.role), 1000);
      }, 1500);
    }, 600);
  };

  // ── Forgot password ───────────────────────────────────────────
  const handleSendReset = () => {
    if (!fpEmail) {
      setFpEmailErr("Email address is required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(fpEmail)) {
      setFpEmailErr("Enter a valid email address");
      return;
    }
    setFpEmailErr("");
    setMode("forgot-success");
  };

  // ── Shared input row style ────────────────────────────────────
  const inputCls = (err?: string) =>
    `relative flex items-center rounded-lg border transition-all ${
      err
        ? "border-destructive bg-red-50/60"
        : "border-border bg-input-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 focus-within:bg-white"
    }`;

  // ─────────────────────────────────────────────────────────────
  const renderBody = () => {
    // ── Success ──────────────────────────────────────────────────
    if (mode === "success" && successAccount) {
      const r = ROLE_META[successAccount.role as keyof typeof ROLE_META];
      if (!r) return null;
      const Icon = r.icon;
      return (
        <div className="flex flex-col items-center text-center py-2">
          <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center mb-5">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Login successful
          </p>
          <h2 className="text-lg font-bold text-foreground mb-0.5">
            Welcome, {successAccount.name}!
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Role detected:{" "}
            <span className={`font-bold ${r.color}`}>{r.label}</span>
          </p>
          <div className="flex items-center justify-center gap-2.5 px-5 py-3 bg-muted/60 border border-border rounded-xl w-full">
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            <Icon className={`w-4 h-4 ${r.color} flex-shrink-0`} />
            <span className="text-sm font-semibold text-foreground">
              Redirecting to {r.dest}…
            </span>
          </div>
        </div>
      );
    }

    // ── Authenticating ───────────────────────────────────────────
    if (mode === "authenticating") {
      return (
        <div className="flex flex-col items-center text-center py-2">
          <div className="relative w-14 h-14 mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div
              className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"
              style={{ animationDuration: "0.85s" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <UtensilsCrossed
                className="w-5 h-5 text-primary"
                strokeWidth={2.5}
              />
            </div>
          </div>
          <h2 className="text-base font-bold text-foreground">
            Checking account permissions…
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5 mb-6">
            Your assigned role will be detected automatically.
          </p>
          <div className="flex flex-col gap-2 w-full">
            {[
              { label: "Credentials verified", done: true, active: false },
              {
                label: "Reading account permissions",
                done: false,
                active: true,
              },
              { label: "Preparing your workspace", done: false, active: false },
            ].map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
                  s.done
                    ? "bg-green-50 border-green-200"
                    : s.active
                      ? "bg-accent border-primary/20"
                      : "bg-card border-border"
                }`}
              >
                {s.done ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : s.active ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    s.done
                      ? "text-green-700"
                      : s.active
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── Forgot password success ──────────────────────────────────
    if (mode === "forgot-success") {
      return (
        <div className="flex flex-col items-center text-center py-2">
          <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-4">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-2">
            Reset Link Sent
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            If the email address exists in our records, a password reset link
            has been sent.
          </p>
          <button
            onClick={() => {
              setMode("login");
              setFpEmail("");
            }}
            style={{ minHeight: 44 }}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-amber-800 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Login
          </button>
        </div>
      );
    }

    // ── Forgot password form ─────────────────────────────────────
    if (mode === "forgot-password") {
      return (
        <>
          <h2 className="text-lg font-bold text-foreground mb-1">
            Forgot Password
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Enter your staff email and we'll send a password reset link.
          </p>
          <div className="flex flex-col gap-1.5 mb-5">
            <label className="text-sm font-semibold text-foreground">
              Email Address
            </label>
            <div className={inputCls(fpEmailErr)} style={{ height: 48 }}>
              <svg
                className="absolute left-3 w-4 h-4 flex-shrink-0 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <input
                type="email"
                placeholder="staff@rrjfoodhouse.com"
                value={fpEmail}
                onChange={(e) => {
                  setFpEmail(e.target.value);
                  setFpEmailErr("");
                }}
                className="w-full h-full pl-9 pr-3 bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
              />
            </div>
            {fpEmailErr && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {fpEmailErr}
              </p>
            )}
          </div>
          <button
            onClick={handleSendReset}
            style={{ minHeight: 48 }}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-amber-800 shadow-sm mb-3"
          >
            <Send className="w-4 h-4" /> Send Reset Link
          </button>
          <button
            onClick={() => {
              setMode("login");
              setFpEmail("");
              setFpEmailErr("");
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Login
          </button>
        </>
      );
    }

    // ── Main login form ──────────────────────────────────────────
    const isSigningIn = mode === "signing-in";

    return (
      <>
        {/* Contextual notice banner */}
        {notice &&
          (() => {
            const cfg = NOTICE_CONFIG[notice];
            const Icon = cfg.icon;
            return (
              <div
                className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border mb-5 ${cfg.bg} ${cfg.border}`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.titleColor}`}
                />
                <div>
                  <p className={`text-sm font-semibold ${cfg.titleColor}`}>
                    {cfg.title}
                  </p>
                  <p
                    className={`text-xs mt-0.5 leading-relaxed ${cfg.msgColor}`}
                  >
                    {cfg.message}
                  </p>
                </div>
              </div>
            );
          })()}

        {/* Auth error banner */}
        {formError && (
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border mb-4 ${
              formError === "account-disabled"
                ? "bg-zinc-50 border-zinc-300"
                : "bg-red-50 border-red-200"
            }`}
          >
            <AlertCircle
              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                formError === "account-disabled"
                  ? "text-zinc-500"
                  : "text-red-500"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                formError === "account-disabled"
                  ? "text-zinc-700"
                  : "text-red-700"
              }`}
            >
              {ERROR_MSG[formError]}
            </span>
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-sm font-semibold text-foreground">
            Email Address
          </label>
          <div className={inputCls(fieldErrors.email)} style={{ height: 48 }}>
            <svg
              className={`absolute left-3 w-4 h-4 flex-shrink-0 ${fieldErrors.email ? "text-destructive" : "text-muted-foreground"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <input
              type="email"
              autoComplete="username"
              placeholder="staff@rrjfoodhouse.com"
              value={email}
              disabled={isSigningIn}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((p) => ({ ...p, email: undefined }));
                setFormError(null);
              }}
              className="w-full h-full pl-9 pr-3 bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
            />
          </div>
          {fieldErrors.email && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5 mb-3">
          <label className="text-sm font-semibold text-foreground">
            Password
          </label>
          <div
            className={inputCls(fieldErrors.password)}
            style={{ height: 48 }}
          >
            <svg
              className={`absolute left-3 w-4 h-4 flex-shrink-0 ${fieldErrors.password ? "text-destructive" : "text-muted-foreground"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              disabled={isSigningIn}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((p) => ({ ...p, password: undefined }));
                setFormError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isSigningIn) handleSignIn();
              }}
              className="w-full h-full pl-9 pr-10 bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              disabled={isSigningIn}
              aria-label="Toggle password visibility"
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {showPw ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Forgot password link */}
        <div className="flex justify-end mb-5">
          <button
            disabled={isSigningIn}
            onClick={() => {
              setMode("forgot-password");
              setFpEmail(email);
              setFormError(null);
              setFieldErrors({});
            }}
            className="text-xs font-semibold text-primary hover:text-red-700 transition-colors disabled:opacity-50"
          >
            Forgot password?
          </button>
        </div>

        {/* Sign In button */}
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          style={{ minHeight: 48 }}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-amber-800 disabled:opacity-75 disabled:cursor-not-allowed shadow-sm transition-all"
        >
          {isSigningIn ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing In…
            </>
          ) : (
            "Sign In"
          )}
        </button>

        {isSigningIn && (
          <p className="text-center text-xs text-muted-foreground mt-3 animate-pulse">
            Checking account permissions…
          </p>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-5 leading-relaxed">
          Your assigned role will be detected automatically after login.
        </p>

        {/* Demo accounts panel */}
        <DemoPanel onFill={fillDemo} />
      </>
    );
  };

  return (
    <div className="auth-page-shell">
      <div className="auth-form-card w-full max-w-[25rem] overflow-hidden rounded-[1.6rem]">
        <div className="h-1 bg-gradient-to-r from-amber-700 via-orange-500 to-amber-300" />
        <div className="p-6 sm:p-8">
          {/* Logo */}
          {(mode === "login" ||
            mode === "signing-in" ||
            mode === "forgot-password" ||
            mode === "forgot-success") && (
            <div className="flex items-center gap-3 mb-7">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                <ImageWithFallback
                  src={rrjLogo}
                  alt="RRJ's Food-Haus logo"
                  className="w-11 h-11 object-contain"
                />
              </div>
              <div>
                <div className="font-bold text-xl text-foreground tracking-tight leading-none">
                  RRJ's Food-Haus
                </div>
                <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 tracking-widest uppercase">
                  Management System · Est. 2021
                </div>
              </div>
            </div>
          )}

          {/* Page title */}
          {(mode === "login" || mode === "signing-in") && (
            <div className="mb-5">
              <h1 className="text-[22px] font-bold text-foreground tracking-tight">
                Staff Portal
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to access the RRJ Food-House Management System.
              </p>
            </div>
          )}

          {/* Compact brand on loading screens */}
          {(mode === "authenticating" || mode === "success") && (
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 overflow-hidden flex-shrink-0">
                <ImageWithFallback
                  src={rrjLogo}
                  alt="RRJ's Food-Haus logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="font-bold text-sm text-foreground tracking-tight">
                RRJ's Food-Haus
              </div>
            </div>
          )}

          {renderBody()}
        </div>
      </div>
    </div>
  );
}

// Eye, EyeOff, and Send are imported from lucide-react above — no redefinitions needed.
