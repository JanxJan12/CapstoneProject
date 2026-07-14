import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Send,
} from "lucide-react";
import { RIDER_ACCOUNT, authenticate } from "../../../data/authAccounts";
import type { AccountRole } from "../../../data/authAccounts";
import { useAuth } from "../../../context/AuthContext";
import { ImageWithFallback } from "../../../app/components/figma/ImageWithFallback";
import rrjLogo from "../../../imports/451655946_497836222754416_7005773426468078155_n__1_.jpg";

interface Props {
  onLoginSuccess?: (role: AccountRole) => void;
}

export function RiderLoginPage({ onLoginSuccess }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fpMode, setFpMode] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [fpSent, setFpSent] = useState(false);
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);

  const fillDemo = () => {
    setEmail(RIDER_ACCOUNT.email);
    setPassword(RIDER_ACCOUNT.password);
    setError("");
    setDemoPanelOpen(false);
  };

  const handleLogin = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);

    setTimeout(() => {
      const result = authenticate(email, password, ["rider"]);
      setLoading(false);

      if (!result.ok) {
        setError(
          result.error === "account-disabled"
            ? "Your account has been disabled. Please contact management."
            : result.error === "unauthorized-role"
              ? "This account does not have rider access."
              : "Invalid email or password. Please try again.",
        );
        return;
      }

      setSuccess(true);
      login(result.account);
      setTimeout(() => onLoginSuccess?.(result.account.role), 1200);
    }, 850);
  };

  const handleForgot = (event: React.FormEvent) => {
    event.preventDefault();
    if (!fpEmail || !/\S+@\S+\.\S+/.test(fpEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setFpSent(true);
  };

  const returnToLogin = () => {
    setFpMode(false);
    setFpSent(false);
    setFpEmail("");
    setError("");
  };

  return (
    <div className="auth-page-shell">
      <div className="auth-form-card w-full max-w-[25rem] overflow-hidden rounded-[1.6rem]">
        <div className="relative overflow-hidden bg-[#211914] px-6 pb-7 pt-6 text-white sm:px-8">
          <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full border border-white/10" />
          <div className="absolute -right-4 -top-8 h-28 w-28 rounded-full bg-orange-500/10 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/15 bg-black shadow-xl">
                <ImageWithFallback
                  src={rrjLogo}
                  alt="RRJ's Food-Haus logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-['Fraunces'] text-lg font-bold leading-none">RRJ's Food-Haus</p>
                <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/50">
                  Delivery partner app
                </p>
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
              <Bike className="h-4 w-4 text-amber-300" />
            </div>
          </div>

          <div className="relative mt-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-300/80">
              Rider access
            </p>
            <h1 className="mt-1 font-['Fraunces'] text-2xl font-semibold tracking-tight">
              {fpMode ? "Recover your account" : "Ready for the next delivery?"}
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-white/60">
              {fpMode
                ? "We’ll send recovery instructions to your registered email."
                : "Sign in to view routes, update orders, and upload delivery proof."}
            </p>
          </div>
        </div>

        <div className="bg-card/90 p-6 sm:p-8">
          {success ? (
            <div className="flex flex-col items-center py-2 text-center" aria-live="polite">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                Access confirmed
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-foreground">
                Welcome, {RIDER_ACCOUNT.name}!
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Preparing your active delivery board.</p>
              <div className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs font-bold text-foreground">Opening rider home…</span>
              </div>
            </div>
          ) : fpMode ? (
            fpSent ? (
              <div className="flex flex-col items-center py-2 text-center" aria-live="polite">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                  <Send className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="text-lg font-extrabold text-foreground">Reset link sent</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  If the email exists in our records, recovery instructions are on the way.
                </p>
                <button
                  type="button"
                  onClick={returnToLogin}
                  className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white shadow-lg shadow-orange-900/10 hover:bg-amber-800"
                >
                  <ArrowLeft className="h-4 w-4" /> Return to login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} noValidate>
                {error && <ErrorBanner message={error} />}
                <InputRow
                  type="email"
                  placeholder="rider@rrjfoodhouse.com"
                  value={fpEmail}
                  onChange={(value) => { setFpEmail(value); setError(""); }}
                  label="Registered email"
                  icon={Mail}
                  autoComplete="email"
                />
                <button
                  type="submit"
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white shadow-lg shadow-orange-900/10 hover:bg-amber-800"
                >
                  <Send className="h-4 w-4" /> Send reset link
                </button>
                <button
                  type="button"
                  onClick={returnToLogin}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Return to login
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} noValidate>
              {error && <ErrorBanner message={error} />}

              <InputRow
                type="email"
                placeholder="rider@rrjfoodhouse.com"
                value={email}
                onChange={(value) => { setEmail(value); setError(""); }}
                label="Email address"
                icon={Mail}
                disabled={loading}
                autoComplete="email"
              />

              <div className="mt-4">
                <InputRow
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(value) => { setPassword(value); setError(""); }}
                  label="Password"
                  icon={LockKeyhole}
                  disabled={loading}
                  autoComplete="current-password"
                  rightEl={
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </div>

              <div className="my-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setFpMode(true); setFpEmail(email); setError(""); }}
                  className="min-h-10 rounded-lg px-1 text-xs font-bold text-primary hover:text-amber-800"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-[3.15rem] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white shadow-lg shadow-orange-900/15 hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />}
                {loading ? "Signing in…" : "Open rider workspace"}
              </button>

              <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
                Authorized delivery partners only. Need access? Contact RRJ's Food-Haus management.
              </p>

              <div className="mt-5 overflow-hidden rounded-xl border border-dashed border-border">
                <button
                  type="button"
                  onClick={() => setDemoPanelOpen(!demoPanelOpen)}
                  className="flex min-h-11 w-full items-center justify-between bg-muted/40 px-3 text-left hover:bg-muted/70"
                  aria-expanded={demoPanelOpen}
                >
                  <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                    <ClipboardList className="h-3.5 w-3.5" /> Demo account
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[8px] text-amber-800">Prototype</span>
                  </span>
                  {demoPanelOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {demoPanelOpen && (
                  <div className="border-t border-border/70 p-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white/60 p-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold text-foreground">{RIDER_ACCOUNT.label}</p>
                        <p className="truncate font-mono text-[9px] text-muted-foreground">{RIDER_ACCOUNT.email}</p>
                        <p className="font-mono text-[9px] text-muted-foreground">{RIDER_ACCOUNT.password}</p>
                      </div>
                      <button
                        type="button"
                        onClick={fillDemo}
                        className="min-h-9 rounded-lg bg-[#2a211b] px-3 text-[10px] font-extrabold text-white hover:bg-primary"
                      >
                        Use demo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-red-600" />
      <p className="text-xs font-semibold leading-relaxed text-red-800">{message}</p>
    </div>
  );
}

function InputRow({
  label,
  type,
  placeholder,
  value,
  onChange,
  disabled,
  rightEl,
  icon: Icon,
  autoComplete,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rightEl?: React.ReactNode;
  icon: React.ElementType;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-foreground">{label}</span>
      <span className="relative flex h-[3.15rem] items-center rounded-xl border border-border bg-input-background transition-all focus-within:border-primary/55 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/10">
        <Icon className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          className="h-full w-full bg-transparent pl-10 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
        />
        {rightEl && <span className="absolute right-1.5 flex items-center">{rightEl}</span>}
      </span>
    </label>
  );
}
