import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";

type AuthenticationStep = "credentials" | "permissions" | "workspace" | "error";

type StaffRole = "manager" | "cashier";

interface StaffProfile {
  id: string;
  role: string;
  is_active: boolean;
}

const STAFF_ROLES: StaffRole[] = ["manager", "cashier"];

function isStaffRole(role: unknown): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole);
}

export function AuthenticatingPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<AuthenticationStep>("credentials");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /*
   * Prevent getSession and onAuthStateChange from
   * processing the same login twice.
   */
  const authenticationHandled = useRef(false);

  useEffect(() => {
    let isMounted = true;

    let redirectTimer: number | undefined;

    let sessionTimeout: number | undefined;

    const returnToStaffPortal = (notice = "unauthorized"): void => {
      redirectTimer = window.setTimeout(() => {
        navigate(`/auth?notice=${notice}`, {
          replace: true,
        });
      }, 1500);
    };

    const denyAccess = async (message: string): Promise<void> => {
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        console.error("Unable to clear unauthorized session:", error.message);
      }

      if (!isMounted) {
        return;
      }

      setErrorMessage(message);
      setStep("error");
      returnToStaffPortal();
    };

    const inspectSession = async (
      authSession: SupabaseSession | null,
    ): Promise<void> => {
      if (!isMounted || authenticationHandled.current) {
        return;
      }

      /*
       * OAuth may still be finishing when the page first
       * renders. Wait for onAuthStateChange when there is
       * no session yet.
       */
      if (!authSession?.user) {
        return;
      }

      authenticationHandled.current = true;

      setStep("permissions");

      /*
       * Read the role belonging to the exact Google account
       * that Supabase authenticated.
       */
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
            id,
            role,
            is_active
          `,
        )
        .eq("id", authSession.user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Unable to read staff profile:", error.message);

        await denyAccess(
          "Your Google account was verified, but its staff profile could not be loaded.",
        );

        return;
      }

      const profile = data as StaffProfile | null;

      if (!profile) {
        await denyAccess(
          "No system profile is connected to this Google account.",
        );

        return;
      }

      if (!profile.is_active) {
        await denyAccess(
          "This staff account has been disabled. Please contact the manager.",
        );

        return;
      }

      if (!isStaffRole(profile.role)) {
        await denyAccess(
          "This Google account is not assigned as a manager or cashier.",
        );

        return;
      }

      /*
       * Authentication and authorization both passed.
       */
      setStep("workspace");

      redirectTimer = window.setTimeout(() => {
        navigate(`/${profile.role}`, {
          replace: true,
        });
      }, 650);
    };

    const initializeAuthentication = async (): Promise<void> => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Unable to restore OAuth session:", error.message);

        authenticationHandled.current = true;

        setErrorMessage("The Google login session could not be restored.");

        setStep("error");
        returnToStaffPortal();

        return;
      }

      await inspectSession(session);
    };

    /*
     * Supabase may finish detecting the OAuth session
     * shortly after this component loads.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        void inspectSession(nextSession);
      }, 0);
    });

    void initializeAuthentication();

    /*
     * Avoid leaving the user on an endless loading screen
     * when the OAuth callback contains no valid session.
     */
    sessionTimeout = window.setTimeout(() => {
      if (!isMounted || authenticationHandled.current) {
        return;
      }

      authenticationHandled.current = true;

      setErrorMessage("No valid Google login session was found.");

      setStep("error");
      returnToStaffPortal();
    }, 8000);

    return () => {
      isMounted = false;

      subscription.unsubscribe();

      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }

      if (sessionTimeout) {
        window.clearTimeout(sessionTimeout);
      }
    };
  }, [navigate]);

  const verifyingCredentials = step === "credentials";

  const credentialsVerified = step === "permissions" || step === "workspace";

  const checkingPermissions = step === "permissions";

  const permissionsVerified = step === "workspace";

  const loadingWorkspace = step === "workspace";

  return (
    <div className="auth-status-page flex min-h-full items-center justify-center bg-background p-4 sm:p-6">
      <div className="auth-status-card flex w-full max-w-md flex-col items-center gap-5 rounded-xl border border-border bg-white p-5 text-center sm:p-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black">
            <img
              src={rrjLogo}
              alt="RRJ's Food-Haus logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="text-left">
            <div className="text-xl font-bold leading-none tracking-tight text-foreground">
              RRJ's Food-Haus
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              Cashier & Manager sign-in
            </div>
          </div>
        </div>

        {/* Main indicator */}
        {step !== "error" ? (
          <div className="relative h-11 w-11" aria-hidden="true">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />

            <div
              className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent"
              style={{
                animationDuration: "0.9s",
              }}
            />
          </div>
        ) : (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-red-50"
            aria-hidden="true"
          >
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
        )}

        {/* Status heading */}
        <div role="status">
          <h1 className="text-xl font-bold text-foreground">
            {step === "credentials" && "Authenticating..."}

            {step === "permissions" && "Checking account permissions..."}

            {step === "workspace" && "Access granted"}

            {step === "error" && "Access denied"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {step === "credentials" && "Verifying your Google login session."}

            {step === "permissions" && "Reading your assigned staff role."}

            {step === "workspace" && "Preparing your workspace..."}

            {step === "error" && "Returning to the Staff Portal..."}
          </p>
        </div>

        {/* Authentication steps */}
        {step !== "error" && (
          <div className="flex w-full flex-col gap-2">
            <StatusRow
              label="Verifying credentials"
              done={credentialsVerified}
              active={verifyingCredentials}
            />

            <StatusRow
              label="Checking permissions"
              done={permissionsVerified}
              active={checkingPermissions}
            />

            <StatusRow
              label="Loading workspace"
              done={false}
              active={loadingWorkspace}
            />
          </div>
        )}

        {/* Error message */}
        {step === "error" && errorMessage && (
          <div
            role="alert"
            className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left"
          >
            <p className="text-sm font-semibold leading-relaxed text-red-800">
              {errorMessage}
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {step === "error"
            ? "Use a Google account assigned to a manager or cashier."
            : "You will be redirected based on your assigned role."}
        </p>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  done = false,
  active = false,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${
        done
          ? "border-green-200 bg-green-50"
          : active
            ? "border-primary/20 bg-accent"
            : "border-border bg-card"
      }`}
    >
      {done ? (
        <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
      ) : active ? (
        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" />
      ) : (
        <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-border" />
      )}

      <span
        className={`text-sm font-medium ${
          done
            ? "text-green-700"
            : active
              ? "text-foreground"
              : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
