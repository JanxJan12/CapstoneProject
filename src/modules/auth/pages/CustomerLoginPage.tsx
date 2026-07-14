import { useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock3,
  Loader2,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { CUSTOMER_ACCOUNT } from "../../../data/authAccounts";
import type { AccountRole } from "../../../data/authAccounts";
import { useAuth } from "../../../context/AuthContext";
import { ImageWithFallback } from "../../../app/components/figma/ImageWithFallback";
import rrjLogo from "../../../imports/451655946_497836222754416_7005773426468078155_n__1_.jpg";

const GOOGLE_SVG = (
  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

interface Props {
  onLoginSuccess?: (role: AccountRole) => void;
}

export function CustomerLoginPage({ onLoginSuccess }: Props) {
  const { login } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setTimeout(() => {
      setGoogleLoading(false);
      setSuccess(true);
      login(CUSTOMER_ACCOUNT);
      setTimeout(() => onLoginSuccess?.("customer"), 1200);
    }, 1300);
  };

  const browseMenu = () => {
    login(CUSTOMER_ACCOUNT);
    onLoginSuccess?.("customer");
  };

  return (
    <div className="auth-page-shell">
      <div className="w-full max-w-md">
        <div className="auth-form-card overflow-hidden rounded-[1.6rem]">
          <div className="relative overflow-hidden bg-[#211914] px-6 pb-7 pt-6 text-white sm:px-8">
            <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full border border-white/10" />
            <div className="absolute -right-5 -top-4 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
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
                    Order online
                  </p>
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <ShoppingBag className="h-4 w-4 text-amber-300" />
              </div>
            </div>

            <div className="relative mt-7">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-300/80">
                Halal Filipino favorites
              </p>
              <h1 className="mt-1 font-['Fraunces'] text-[1.7rem] font-semibold leading-tight tracking-tight">
                Hungry? Let’s find your favorite.
              </h1>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/60">
                Browse the full menu now. Sign in to make checkout and order tracking effortless.
              </p>
            </div>
          </div>

          <div className="bg-card/90 p-6 sm:p-8">
            {success ? (
              <div className="flex flex-col items-center py-2 text-center" aria-live="polite">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Signed in</p>
                <h2 className="mt-1 text-lg font-extrabold text-foreground">Welcome, {CUSTOMER_ACCOUNT.name}!</h2>
                <p className="mt-1 text-xs text-muted-foreground">Your menu and recent orders are ready.</p>
                <div className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-bold text-foreground">Opening the menu…</span>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="flex min-h-[3.15rem] w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-5 text-sm font-extrabold text-foreground shadow-sm hover:border-primary/25 hover:bg-amber-50/30 disabled:cursor-wait disabled:opacity-70"
                >
                  {googleLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : GOOGLE_SVG}
                  {googleLoading ? "Connecting to Google…" : "Continue with Google"}
                </button>

                <div className="my-4 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">or explore first</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <button
                  type="button"
                  onClick={browseMenu}
                  className="flex min-h-[3.15rem] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white shadow-lg shadow-orange-900/15 hover:bg-amber-800"
                >
                  <ShoppingBag className="h-4 w-4" /> Browse the menu
                </button>

                <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
                  No sign-in needed to browse. We’ll only ask when you’re ready to check out.
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
                  {[
                    { icon: Clock3, label: "Quick ordering" },
                    { icon: ShieldCheck, label: "Secure checkout" },
                    { icon: MapPin, label: "Live tracking" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-primary">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[9px] font-bold leading-tight text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-dashed border-border">
                  <button
                    type="button"
                    onClick={() => setDemoPanelOpen(!demoPanelOpen)}
                    className="flex min-h-11 w-full items-center justify-between bg-muted/40 px-3 text-left hover:bg-muted/70"
                    aria-expanded={demoPanelOpen}
                  >
                    <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                      <ClipboardList className="h-3.5 w-3.5" /> Demo customer
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[8px] text-amber-800">Prototype</span>
                    </span>
                    {demoPanelOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {demoPanelOpen && (
                    <div className="border-t border-border/70 p-3">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white/60 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-amber-50 text-primary">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-extrabold text-foreground">{CUSTOMER_ACCOUNT.name}</p>
                            <p className="truncate font-mono text-[9px] text-muted-foreground">{CUSTOMER_ACCOUNT.email}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          className="min-h-9 rounded-lg bg-[#2a211b] px-3 text-[10px] font-extrabold text-white hover:bg-primary"
                        >
                          Use demo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <p className="px-4 pt-3 text-center text-[9px] leading-relaxed text-muted-foreground/65">
          By continuing, you agree to RRJ's Food-Haus Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
