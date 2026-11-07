import { useEffect } from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return error.status === 404
      ? "The page you requested could not be found."
      : "The requested page could not be opened.";
  }

  return "The application ran into an unexpected problem while opening this page.";
}

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const returnToSignIn = async (): Promise<void> => {
    await logout();
    navigate("/auth", { replace: true });
  };

  useEffect(() => {
    console.error("Route rendering failed:", error);
  }, [error]);

  return (
    <main className="auth-status-page flex min-h-full items-center justify-center bg-background p-4 sm:p-6">
      <section
        className="auth-status-card flex w-full max-w-md flex-col items-center gap-5 rounded-xl border border-border bg-white p-6 text-center"
        aria-labelledby="route-error-title"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black">
            <img
              src={rrjLogo}
              alt="RRJ's Food-Haus logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="text-left">
            <p className="font-['Fraunces'] text-lg font-bold text-foreground">
              RRJ's Food-Haus
            </p>
            <p className="text-sm text-muted-foreground">
              Application recovery
            </p>
          </div>
        </div>

        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200 bg-amber-50"
          aria-hidden="true"
        >
          <AlertTriangle className="h-6 w-6 text-amber-700" />
        </div>

        <div role="alert">
          <h1
            id="route-error-title"
            className="text-xl font-bold text-foreground"
          >
            This page could not be opened
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {getErrorMessage(error)} You can retry the page or return to the
            sign-in screen.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Retry page
          </button>

          <button
            type="button"
            onClick={() => {
              void returnToSignIn();
            }}
            className="min-h-11 flex-1 rounded-xl border border-border bg-white px-4 text-sm font-bold text-foreground hover:bg-muted"
          >
            Sign out and return
          </button>
        </div>
      </section>
    </main>
  );
}
