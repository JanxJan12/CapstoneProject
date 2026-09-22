import {
  ExternalLink,
  FileText,
  IdCard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { Button } from "../../../components/common/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

import {
  getManagerRiderApplication,
  setManagerRiderApprovalStatus,
  type ManagerRiderApplication,
} from "../api/managerPhase2Api";

interface Props {
  riderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}

export function RiderApplicationDialog({
  riderId,
  open,
  onOpenChange,
  onApproved,
}: Props) {
  const [application, setApplication] =
    useState<ManagerRiderApplication | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [approving, setApproving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open || !riderId) {
      setApplication(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadApplication = async () => {
      setLoading(true);
      setError(null);
      setApplication(null);

      try {
        const result =
          await getManagerRiderApplication(riderId);

        if (!cancelled) {
          setApplication(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load rider application.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadApplication();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    riderId,
  ]);

  const handleApprove = async () => {
    if (
      !application ||
      approving ||
      application.approvalStatus !== "pending"
    ) {
      return;
    }

    setApproving(true);
    setError(null);

    try {
      await setManagerRiderApprovalStatus(
        application.id,
        "approved",
      );

      onApproved();
      onOpenChange(false);
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Unable to approve rider.",
      );
    } finally {
      setApproving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!approving) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
          <DialogTitle>
            Rider application review
          </DialogTitle>

          <DialogDescription>
            Review the rider&apos;s submitted identity,
            license, motorcycle information, and supporting
            documents before approval.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />

              <p className="mt-3 text-sm font-semibold text-foreground">
                Loading rider application…
              </p>
            </div>
          ) : error && !application ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">
                {error}
              </p>
            </div>
          ) : application ? (
            <div className="space-y-5">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-800">
                    {error}
                  </p>
                </div>
              ) : null}

              <section className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground">
                      {application.name}
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {application.contactNumber ??
                        "Contact number not recorded"}
                    </p>

                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      {application.approvalStatus === "pending"
                        ? "Pending approval"
                        : application.approvalStatus}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  License & motorcycle
                </h3>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailCard
                    label="Driver license"
                    value={
                      application.driverLicenseNumber ??
                      "Not recorded"
                    }
                  />

                  <DetailCard
                    label="Plate number"
                    value={
                      application.plateNumber ??
                      "Not recorded"
                    }
                  />

                  <DetailCard
                    label="Motorcycle brand"
                    value={
                      application.motorBrand ??
                      "Not recorded"
                    }
                  />

                  <DetailCard
                    label="Motorcycle model"
                    value={
                      application.motorModel ??
                      "Not recorded"
                    }
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  Submitted documents
                </h3>

                <div className="space-y-2">
                  <DocumentLink
                    label="Valid ID"
                    url={application.validIdUrl}
                    icon={IdCard}
                  />

                  <DocumentLink
                    label="Motorcycle OR/CR"
                    url={application.orCrDocumentUrl}
                    icon={FileText}
                  />

                  <DocumentLink
                    label="Rider photo"
                    url={application.riderPhotoUrl}
                    icon={UserRound}
                  />
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  Documents open through temporary private
                  links and are not publicly accessible.
                </p>
              </section>

              {application.approvalStatus === "pending" ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-green-700" />

                    <div>
                      <p className="text-xs font-bold text-green-900">
                        Approval grants Rider access
                      </p>

                      <p className="mt-1 text-xs leading-relaxed text-green-800">
                        Approving this application changes the
                        applicant&apos;s account role to Rider.
                        Their availability starts as Offline until
                        they choose to become available.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={approving}
          >
            Close
          </Button>

          {application?.approvalStatus === "pending" ? (
            <Button
              loading={approving}
              onClick={() => {
                void handleApprove();
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              {approving
                ? "Approving…"
                : "Approve rider"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function DocumentLink({
  label,
  url,
  icon: Icon,
}: {
  label: string;
  url: string | null;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">
          {label}
        </p>

        <p className="text-[10px] text-muted-foreground">
          Private rider document
        </p>
      </div>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-primary transition hover:bg-muted"
        >
          Open
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : (
        <span className="text-[10px] font-semibold text-muted-foreground">
          Missing
        </span>
      )}
    </div>
  );
}