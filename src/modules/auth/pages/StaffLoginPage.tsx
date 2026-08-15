import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  AlertCircle,
  Loader2,
  ShieldCheck,
  ShieldOff,
  TimerOff,
  Users,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { supabase } from "@/lib/supabase";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";

type StaffRole = "manager" | "cashier";

interface Props {
  /*
   * Kept temporarily so the parent component does not break.
   * Supabase/AuthProvider will handle the real redirect after OAuth.
   */
  onLoginSuccess?: (role: StaffRole) => void;
}

export type AuthNotice =
  | "session-expired"
  | "unauthorized"
  | "maintenance"
  | null;

interface NoticeConfig {
  icon: LucideIcon;
  bg: string;
  border: string;
  titleColor: string;
  messageColor: string;
  title: string;
  message: string;
}

const NOTICE_CONFIG: Record<
  NonNullable<AuthNotice>,
  NoticeConfig
> = {
  "session-expired": {
    icon: TimerOff,
    bg: "bg-amber-50",
    border: "border-amber-200",
    titleColor: "text-amber-800",
    messageColor: "text-amber-700",
    title: "Session Expired",
    message:
      "Your session has expired. Sign in again to continue.",
  },

  unauthorized: {
    icon: ShieldOff,
    bg: "bg-red-50",
    border: "border-red-200",
    titleColor: "text-red-800",
    messageColor: "text-red-700",
    title: "Access Denied",
    message:
      "This Google account is not authorized to access the Staff Portal.",
  },

  maintenance: {
    icon: WrenchIcon,
    bg: "bg-blue-50",
    border: "border-blue-200",
    titleColor: "text-blue-800",
    messageColor: "text-blue-700",
    title: "Maintenance Mode",
    message:
      "The management system is temporarily unavailable. Please try again later.",
  },
};

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />

      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />

      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.74 6.74 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84Z"
      />

      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function StaffLoginPage(_props: Props) {
  const [searchParams] = useSearchParams();

  const [signingIn, setSigningIn] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const noticeParam =
    searchParams.get("notice");

  const notice: AuthNotice =
    noticeParam === "session-expired" ||
    noticeParam === "unauthorized" ||
    noticeParam === "maintenance"
      ? noticeParam
      : null;

  const handleGoogleSignIn =
    async (): Promise<void> => {
      if (signingIn) {
        return;
      }

      setSigningIn(true);
      setErrorMessage(null);

      /*
       * Remember which portal started the OAuth request.
       * We will use this when enforcing portal-specific access.
       */
      window.sessionStorage.setItem(
        "rrjs_login_portal",
        "staff",
      );

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",

          options: {
            /*
             * After Google verifies the account, Supabase
             * returns the browser to this authentication route.
             */
            redirectTo: `${window.location.origin}/authenticating?portal=staff`,

            /*
             * Always show Google's account chooser. This is
             * useful when customer and staff accounts are signed
             * in on the same computer.
             */
            queryParams: {
              prompt: "select_account",
            },
          },
        });

      /*
       * On success the browser leaves this page, so this block
       * runs only when Supabase cannot start the OAuth flow.
       */
      if (error) {
        console.error(
          "Staff Google sign-in failed:",
          error.message,
        );

        window.sessionStorage.removeItem(
          "rrjs_login_portal",
        );

        setErrorMessage(error.message);
        setSigningIn(false);
      }
    };

  return (
    <div className="auth-page-shell">
      <div className="auth-form-card w-full max-w-[25rem] overflow-hidden rounded-[1.6rem]">
        <div className="h-1 bg-gradient-to-r from-amber-700 via-orange-500 to-amber-300" />

        <div className="p-6 sm:p-8">
          {/* Brand */}
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-900 shadow-sm">
              <ImageWithFallback
                src={rrjLogo}
                alt="RRJ's Food-Haus logo"
                className="h-11 w-11 object-contain"
              />
            </div>

            <div>
              <div className="text-xl font-bold leading-none tracking-tight text-foreground">
                RRJ&apos;s Food-Haus
              </div>

              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Management System · Est. 2021
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-5">
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">
              Staff Portal
            </h1>

            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Sign in using the Google account assigned
              to a manager or cashier.
            </p>
          </div>

          {/* Notice */}
          {notice &&
            (() => {
              const config =
                NOTICE_CONFIG[notice];

              const NoticeIcon = config.icon;

              return (
                <div
                  className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3.5 ${config.bg} ${config.border}`}
                >
                  <NoticeIcon
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${config.titleColor}`}
                  />

                  <div>
                    <p
                      className={`text-sm font-semibold ${config.titleColor}`}
                    >
                      {config.title}
                    </p>

                    <p
                      className={`mt-0.5 text-xs leading-relaxed ${config.messageColor}`}
                    >
                      {config.message}
                    </p>
                  </div>
                </div>
              );
            })()}

          {/* OAuth error */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />

              <div>
                <p className="text-sm font-semibold text-red-800">
                  Sign-in failed
                </p>

                <p className="mt-0.5 text-xs leading-relaxed text-red-700">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Security explanation */}
          <div className="mb-5 rounded-xl border border-border bg-muted/35 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-bold text-foreground">
                  Role-based access
                </p>

                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The system will check the account&apos;s
                  assigned role after Google verifies its
                  identity.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <Users className="h-4 w-4 text-violet-600" />

                <span className="text-xs font-bold text-foreground">
                  Manager
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <Users className="h-4 w-4 text-blue-600" />

                <span className="text-xs font-bold text-foreground">
                  Cashier
                </span>
              </div>
            </div>
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={() => {
              void handleGoogleSignIn();
            }}
            disabled={signingIn}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signingIn ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Connecting to Google…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            Customers and riders cannot access the
            management system using this portal.
          </p>
        </div>
      </div>
    </div>
  );
}