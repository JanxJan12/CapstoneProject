import {
  Bike,
  Clock3,
  ShieldAlert,
} from "lucide-react";

import type {
  RiderApplicationStatus,
} from "../services/riderApplicationService";

interface Props {
  status: RiderApplicationStatus;
  onSignOut: () => void;
}

export function RiderApplicationStatusPage({
  status,
  onSignOut,
}: Props) {
  const content = getStatusContent(status);
  const Icon = content.icon;

  return (
    <div className="auth-page-shell">
      <div className="auth-form-card w-full max-w-[27rem] overflow-hidden rounded-xl">
        <div className="auth-panel-heading bg-[#211914] px-6 pb-7 pt-6 text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-amber-300/80">
                Rider application
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {content.title}
              </h1>
            </div>

            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
              <Bike className="h-5 w-5 text-amber-300" />
            </div>
          </div>
        </div>

        <div className="bg-card/90 p-6 sm:p-8">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${content.iconBackground}`}
          >
            <Icon
              className={`h-5 w-5 ${content.iconColor}`}
            />
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-foreground">
            {content.heading}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {content.description}
          </p>

          {status === "pending" ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-bold text-amber-900">
                What happens next?
              </p>

              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Management will review your submitted
                identification, motorcycle documents,
                license information, and rider photo.
                Rider access will only be available after
                approval.
              </p>
            </div>
          ) : null}

          {status === "suspended" ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold text-red-800">
                Rider access unavailable
              </p>

              <p className="mt-1 text-xs leading-relaxed text-red-700">
                A suspended rider cannot receive or
                manage delivery assignments. Please
                contact RRJ&apos;s Food-Haus management
                regarding your account.
              </p>
            </div>
          ) : null}

          {status === "rejected" ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold text-red-800">
                Application not active
              </p>

              <p className="mt-1 text-xs leading-relaxed text-red-700">
                This is a legacy rider application
                status. Please contact RRJ&apos;s
                Food-Haus management if you need
                assistance.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onSignOut}
            className="mt-6 flex min-h-[2.9rem] w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function getStatusContent(
  status: RiderApplicationStatus,
) {
  switch (status) {
    case "pending":
      return {
        title: "Pending approval",
        heading: "Your application is under review",
        description:
          "Your rider application has been submitted successfully. You do not have Rider workspace access yet.",
        icon: Clock3,
        iconBackground: "bg-amber-50",
        iconColor: "text-amber-600",
      };

    case "suspended":
      return {
        title: "Rider suspended",
        heading: "Your rider access is suspended",
        description:
          "Your account is currently not authorized to use the Rider workspace.",
        icon: ShieldAlert,
        iconBackground: "bg-red-50",
        iconColor: "text-red-600",
      };

    case "rejected":
      return {
        title: "Application unavailable",
        heading: "Your rider application is not active",
        description:
          "This rider application cannot currently access the Rider workspace.",
        icon: ShieldAlert,
        iconBackground: "bg-red-50",
        iconColor: "text-red-600",
      };

    case "approved":
      return {
        title: "Rider approved",
        heading: "Your rider account is approved",
        description:
          "Your account has been approved for Rider access.",
        icon: Bike,
        iconBackground: "bg-green-50",
        iconColor: "text-green-600",
      };
  }
}