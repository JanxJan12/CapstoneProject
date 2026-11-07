import {
  ExternalLink,
  FileText,
  IdCard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  onOutcomeUnknown: () => void;
}

export function RiderApplicationDialog({
  riderId,
  open,
  onOpenChange,
  onApproved,
  onOutcomeUnknown,
}: Props) {
  const [application, setApplication] =
    useState<ManagerRiderApplication | null>(null);

  const [loading, setLoading] = useState(false);

  const [approving, setApproving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationPending = useRef(false);

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
        const result = await getManagerRiderApplication(riderId);

        if (!cancelled) {
          setApplication(result);
        }
      } catch {
        if (!cancelled) {
          setError(
            "The rider application could not be loaded. Close this review and refresh the directory before trying again.",
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
  }, [open, riderId, reloadKey]);

  const handleApprove = async () => {
    if (
      !application ||
      mutationPending.current ||
      application.approvalStatus !== "pending" ||
      !application.validIdUrl ||
      !application.orCrDocumentUrl ||
      !application.riderPhotoUrl
    ) {
      return;
    }

    mutationPending.current = true;
    setApproving(true);
    setError(null);

    try {
      const result = await setManagerRiderApprovalStatus(
        application.id,
        "approved",
      );
      if (result.riderId !== application.id || result.profileRole !== "rider") {
        throw new Error("Unexpected approval result");
      }

      onApproved();
      onOpenChange(false);
    } catch {
      onOutcomeUnknown();
    } finally {
      mutationPending.current = false;
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
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-6">
          <DialogTitle>Rider application</DialogTitle>

          <DialogDescription>
            Review submitted identity, vehicle details, and private documents.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div
              role="status"
              className="flex min-h-56 flex-col items-center justify-center text-center"
            >
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />

              <p className="mt-3 text-sm font-semibold text-foreground">
                Loading rider application…
              </p>
            </div>
          ) : error && !application ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p role="alert" className="text-sm font-semibold text-red-800">
                {error}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 min-h-11"
                onClick={() => setReloadKey((value) => value + 1)}
              >
                Retry application
              </Button>
            </div>
          ) : application ? (
            <div className="space-y-5">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-800">{error}</p>
                </div>
              ) : null}

              <section className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="break-words text-base font-bold text-foreground">
                      {application.name}
                    </p>
                    <p className="mt-0.5 break-all text-xs text-muted-foreground">
                      {application.contactNumber ??
                        "Contact number not recorded"}
                    </p>

                    <p className="mt-2 text-xs font-semibold text-foreground">
                      Approval:{" "}
                      {application.approvalStatus === "pending"
                        ? "Pending"
                        : application.approvalStatus[0].toUpperCase() +
                          application.approvalStatus.slice(1)}
                      {" · "}Availability:{" "}
                      {application.availabilityStatus.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rider record created{" "}
                      {new Intl.DateTimeFormat("en-PH", {
                        dateStyle: "medium",
                        timeZone: "Asia/Manila",
                      }).format(new Date(application.createdAt))}
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
                    value={application.driverLicenseNumber ?? "Not recorded"}
                  />

                  <DetailCard
                    label="Plate number"
                    value={application.plateNumber ?? "Not recorded"}
                  />

                  <DetailCard
                    label="Motorcycle brand"
                    value={application.motorBrand ?? "Not recorded"}
                  />

                  <DetailCard
                    label="Motorcycle model"
                    value={application.motorModel ?? "Not recorded"}
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
                    path={application.validIdPath}
                    url={application.validIdUrl}
                    icon={IdCard}
                  />

                  <DocumentLink
                    label="Motorcycle OR/CR"
                    path={application.orCrDocumentPath}
                    url={application.orCrDocumentUrl}
                    icon={FileText}
                  />

                  <DocumentLink
                    label="Rider photo"
                    path={application.riderPhotoPath}
                    url={application.riderPhotoUrl}
                    icon={UserRound}
                  />
                </div>

                {[
                  application.validIdPath && !application.validIdUrl,
                  application.orCrDocumentPath && !application.orCrDocumentUrl,
                  application.riderPhotoPath && !application.riderPhotoUrl,
                ].some(Boolean) ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2 min-h-11"
                    onClick={() => setReloadKey((value) => value + 1)}
                  >
                    Retry documents
                  </Button>
                ) : null}
              </section>

              <details className="text-xs text-muted-foreground">
                <summary className="min-h-11 cursor-pointer text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  Record details
                </summary>
                <p className="break-all pb-2">Rider ID: {application.id}</p>
              </details>

              {application.approvalStatus === "pending" ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-green-700" />

                    <div>
                      <p className="text-xs font-bold text-green-900">
                        Approval grants Rider access
                      </p>

                      <p className="mt-1 text-xs leading-relaxed text-green-800">
                        Approving this application changes the applicant&apos;s
                        account role to Rider. Their availability starts as
                        Offline until they choose to become available.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
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
              disabled={
                !application.validIdUrl ||
                !application.orCrDocumentUrl ||
                !application.riderPhotoUrl
              }
              onClick={() => {
                void handleApprove();
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              {approving ? "Approving…" : "Approve rider"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
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
  path,
  url,
  icon: Icon,
}: {
  label: string;
  path: string | null;
  url: string | null;
  icon: React.ElementType;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const canPreview = Boolean(url && path && /\.(?:jpe?g|png)$/i.test(path));
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{label}</p>

          <p className="text-xs text-muted-foreground">
            {path
              ? url
                ? "Private document"
                : "Access unavailable"
              : "Not submitted"}
          </p>
        </div>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-primary transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Open document
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      {canPreview && !previewFailed ? (
        <img
          src={url ?? undefined}
          alt={`${label} preview for the selected rider`}
          className="mt-3 max-h-48 w-full rounded-lg border border-border bg-muted/20 object-contain"
          onError={() => setPreviewFailed(true)}
        />
      ) : null}
      {canPreview && previewFailed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Preview unavailable. Try opening the document or retry access.
        </p>
      ) : null}
    </div>
  );
}
