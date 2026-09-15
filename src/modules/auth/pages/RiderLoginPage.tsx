import { useState } from "react";
import { AlertCircle, Bike, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AccountRole } from "../../../data/accountRole";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";

const GOOGLE_SVG = (
  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
  onLoginSuccess?: (role: AccountRole) => void;
}

export function RiderLoginPage(_props: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (googleLoading) {
      return;
    }

    setGoogleLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth?portal=rider`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (signInError) {
      console.error("Rider Google sign-in failed:", signInError.message);

      setError(`Google sign-in failed: ${signInError.message}`);

      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page-shell">
      <div className="auth-form-card w-full max-w-[25rem] overflow-hidden rounded-xl">
        <div className="auth-panel-heading relative overflow-hidden bg-[#211914] px-6 pb-7 pt-6 text-white sm:px-8">
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/15 bg-black shadow-none">
                <ImageWithFallback
                  src={rrjLogo}
                  alt="RRJ's Food-Haus logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <p className="font-['Fraunces'] text-lg font-bold leading-none">
                  RRJ's Food-Haus
                </p>

                <p className="mt-1 text-sm font-extrabold uppercase tracking-[0.18em] text-white/80">
                  Rider
                </p>
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
              <Bike className="h-4 w-4 text-amber-300" />
            </div>
          </div>

          <div className="relative mt-7">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-amber-300/80">
              Rider access
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Rider sign-in
            </h1>

            <p className="mt-1.5 text-sm leading-relaxed text-white/80">
              Sign in to receive delivery requests, manage active deliveries,
              and update delivery progress.
            </p>
          </div>
        </div>

        <div className="bg-card/90 p-6 sm:p-8">
          {error && <ErrorBanner message={error} />}

          <button
            type="button"
            onClick={() => {
              void handleGoogleLogin();
            }}
            disabled={googleLoading}
            aria-busy={googleLoading}
            className="auth-google-button flex min-h-[3.15rem] w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-5 text-sm font-extrabold text-foreground shadow-sm hover:border-primary/25 hover:bg-amber-50/30 disabled:cursor-wait disabled:opacity-70"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              GOOGLE_SVG
            )}

            {googleLoading ? "Connecting to Google…" : "Continue with Google"}
          </button>

          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-50 text-primary">
                <Bike className="h-4 w-4" aria-hidden="true" />
              </div>

              <div>
                <p className="text-sm font-extrabold text-foreground">
                  Authorized riders only
                </p>

                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Rider access is available only to registered and approved
                  RRJ's Food-Haus delivery partners.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm leading-relaxed text-muted-foreground">
            Need rider access? Contact RRJ's Food-Haus management.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-red-600" />

      <p className="text-sm font-semibold leading-relaxed text-red-800">
        {message}
      </p>
    </div>
  );
}
