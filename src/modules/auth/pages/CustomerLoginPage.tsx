import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Clock3,
  Loader2,
  MapPin,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";

const GOOGLE_SVG = (
  <svg
    className="h-5 w-5 flex-shrink-0"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

interface Props {
  onLoginSuccess?: (role: "customer") => void;
}

export function CustomerLoginPage(_props: Props) {
  const navigate = useNavigate();

  const [googleLoading, setGoogleLoading] =
    useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

    if (error) {
      console.error(
        "Google sign-in failed:",
        error.message,
      );

      setGoogleLoading(false);

      window.alert(
        `Google sign-in failed: ${error.message}`,
      );
    }
  };

  /*
   * Guest browsing does NOT create an authenticated session.
   * It simply opens the public customer storefront.
   */
  const browseMenu = () => {
    navigate("/customer");
  };

  return (
    <div className="auth-page-shell">
      <div className="w-full max-w-md">
        <div className="auth-form-card overflow-hidden rounded-[1.6rem]">
          {/* Header */}
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
                  <p className="font-['Fraunces'] text-lg font-bold leading-none">
                    RRJ&apos;s Food-Haus
                  </p>

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
                Hungry? Let&apos;s find your favorite.
              </h1>

              <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/60">
                Browse the full menu now. Sign in when
                you&apos;re ready to place and track an
                order.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-card/90 p-6 sm:p-8">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="flex min-h-[3.15rem] w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-5 text-sm font-extrabold text-foreground shadow-sm transition-colors hover:border-primary/25 hover:bg-amber-50/30 disabled:cursor-wait disabled:opacity-70"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                GOOGLE_SVG
              )}

              {googleLoading
                ? "Connecting to Google…"
                : "Continue with Google"}
            </button>

            <div
              className="my-4 flex items-center gap-3"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-border" />

              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                or explore first
              </span>

              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={browseMenu}
              className="flex min-h-[3.15rem] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white shadow-lg shadow-orange-900/15 transition-colors hover:bg-amber-800"
            >
              <ShoppingBag className="h-4 w-4" />
              Browse the menu
            </button>

            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              No sign-in needed to browse. We&apos;ll ask you
              to sign in when you&apos;re ready to check out.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
              {[
                {
                  icon: Clock3,
                  label: "Quick ordering",
                },
                {
                  icon: ShieldCheck,
                  label: "Secure checkout",
                },
                {
                  icon: MapPin,
                  label: "Live tracking",
                },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1.5 text-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <span className="text-[9px] font-bold leading-tight text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="px-4 pt-3 text-center text-[9px] leading-relaxed text-muted-foreground/65">
          By continuing, you agree to RRJ&apos;s Food-Haus
          Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}