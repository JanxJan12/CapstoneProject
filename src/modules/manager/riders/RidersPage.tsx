import { useCallback, useEffect, useRef, useState } from "react";
import { FileSearch, RefreshCw, UserCheck, UserX } from "lucide-react";
import { Badge, StatusBadge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { useAuth } from "@/app/providers/AuthProvider";
import { SuspendRiderDialog } from "./SuspendRiderDialog";
import { RestoreRiderDialog } from "./RestoreRiderDialog";
import {
  getManagerRiders,
  type ManagerRider,
  type ManagerRiderApprovalStatus,
} from "../api/managerPhase2Api";
import { RiderApplicationDialog } from "./RiderApplicationDialog";

const APPROVAL_BADGES: Record<
  ManagerRiderApprovalStatus,
  {
    label: string;
    variant: "success" | "warning" | "danger" | "neutral";
  }
> = {
  approved: {
    label: "Approved",
    variant: "success",
  },
  pending: {
    label: "Pending",
    variant: "warning",
  },
  rejected: {
    label: "Rejected",
    variant: "danger",
  },
  suspended: {
    label: "Suspended",
    variant: "danger",
  },
};

function isAccessFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Active manager access required") ||
    message.includes("Authentication required")
  );
}

const activityDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});
const refreshTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

export function RidersPage() {
  const { session, loading: authLoading } = useAuth();
  const [riders, setRiders] = useState<ManagerRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedForSession, setLoadedForSession] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [requiresRead, setRequiresRead] = useState(false);
  const requestVersion = useRef(0);

  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [riderToSuspend, setRiderToSuspend] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [riderToRestore, setRiderToRestore] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const loadRiders = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const nextRiders = await getManagerRiders();
      if (version !== requestVersion.current) return;
      setRiders(nextRiders);
      setLoadedForSession(session?.id ?? null);
      setLoadedAt(new Date());
      setRequiresRead(false);
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      setRiders([]);
      setLoadedAt(null);
      setNotice(null);
      if (isAccessFailure(loadError)) {
        setLoadedForSession(null);
        setSelectedRiderId(null);
        setRiderToSuspend(null);
        setRiderToRestore(null);
      }
      setError(
        isAccessFailure(loadError)
          ? "Manager access is required to view riders."
          : "Riders could not be loaded. Check your connection or access, then retry.",
      );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.id || session.role !== "manager") {
      requestVersion.current += 1;
      setRiders([]);
      setLoadedForSession(null);
      setLoadedAt(null);
      setSelectedRiderId(null);
      setRiderToSuspend(null);
      setRiderToRestore(null);
      setError("Manager access is required to view riders.");
      setLoading(false);
      return;
    }
    setSelectedRiderId(null);
    setRiderToSuspend(null);
    setRiderToRestore(null);
    void loadRiders();
    return () => {
      requestVersion.current += 1;
    };
  }, [authLoading, loadRiders, session?.id, session?.role]);

  const visibleRiders =
    session?.role === "manager" && loadedForSession === session.id
      ? riders
      : [];

  const handleUnknownOutcome = () => {
    setSelectedRiderId(null);
    setRiderToSuspend(null);
    setRiderToRestore(null);
    setRequiresRead(true);
    setNotice(null);
    setError(
      "The rider status change could not be confirmed. Refresh the directory to check the current status before taking another action.",
    );
  };

  const handleConfirmedChange = (message: string) => {
    setNotice(message);
    void loadRiders();
  };

  const availableCount = visibleRiders.filter(
    (rider) =>
      rider.isActive &&
      rider.approvalStatus === "approved" &&
      rider.availabilityStatus === "available",
  ).length;

  const pendingCount = visibleRiders.filter(
    (rider) => rider.approvalStatus === "pending",
  ).length;

  const onDeliveryCount = visibleRiders.filter(
    (rider) =>
      rider.isActive &&
      rider.approvalStatus === "approved" &&
      rider.availabilityStatus === "on_delivery",
  ).length;

  return (
    <div className="manager-riders">
      <header className="manager-page-header mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="manager-page-context">Business Management / Riders</p>
          <h1 className="text-xl font-bold text-foreground">Riders</h1>

          <p className="mt-0.5 text-xs text-muted-foreground">
            Review applications, availability, and completed delivery activity.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadRiders()}
          loading={loading}
          className="min-h-11"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </header>

      <dl className="manager-rider-metrics mb-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-sm sm:grid-cols-4">
        {[
          ["Riders", visibleRiders.length],
          ["Pending", pendingCount],
          ["Available", availableCount],
          ["On delivery", onDeliveryCount],
        ].map(([label, count]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {loading || error ? "—" : count}
            </dd>
          </div>
        ))}
      </dl>

      {!loading && !error && loadedForSession === session?.id && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          {loadedAt
            ? `Refreshed ${refreshTimeFormatter.format(loadedAt)}. `
            : ""}
          Available and on-delivery counts include active, approved riders only.
        </p>
      )}

      {error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          {session?.role === "manager" && (
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={() => void loadRiders()}
              loading={loading}
            >
              Refresh riders
            </Button>
          )}
        </div>
      ) : null}
      {notice && !error && (
        <p
          role="status"
          className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}

      <div className="hidden md:block">
        <Table
          headers={[
            "Rider",
            "Approval",
            "Availability",
            "Deliveries",
            "Actions",
          ]}
        >
          {loading ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-xs text-muted-foreground"
              >
                Loading riders…
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                Rider status is unavailable until the list is refreshed.
              </td>
            </tr>
          ) : visibleRiders.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-xs text-muted-foreground"
              >
                No rider profiles were returned.
              </td>
            </tr>
          ) : (
            visibleRiders.map((rider) => {
              const approvalBadge = APPROVAL_BADGES[rider.approvalStatus];

              return (
                <tr key={rider.id} className="hover:bg-muted/30">
                  <Td>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-[10px] font-bold text-primary">
                          {rider.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">
                          {rider.name}
                        </p>

                        <p className="mt-0.5 break-all text-xs text-muted-foreground">
                          {rider.contactNumber ?? "Contact not recorded"}
                        </p>
                        {!rider.isActive ? (
                          <p className="mt-0.5 text-xs font-bold text-red-700">
                            Inactive account
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <Badge variant={approvalBadge.variant}>
                      {approvalBadge.label}
                    </Badge>
                  </Td>
                  <Td>
                    <StatusBadge status={rider.availabilityStatus} />
                  </Td>

                  <Td>
                    <div className="flex items-baseline gap-4">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {rider.deliveriesToday.toLocaleString("en-PH")}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Delivered today
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {rider.totalDeliveries.toLocaleString("en-PH")}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Delivered total
                        </p>
                      </div>
                    </div>

                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {rider.lastAssignedAt
                        ? `Last assigned ${activityDateTimeFormatter.format(
                            new Date(rider.lastAssignedAt),
                          )}`
                        : "No assignment recorded"}
                    </p>
                  </Td>

                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={requiresRead || loading}
                        className="min-h-11"
                        onClick={() => {
                          setSelectedRiderId(rider.id);
                        }}
                      >
                        <FileSearch className="h-3.5 w-3.5" />
                        View application
                        <span className="sr-only">
                          {" "}
                          for {rider.name}, {rider.id}
                        </span>
                      </Button>
                      {rider.approvalStatus === "approved" ? (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={requiresRead || loading}
                          className="min-h-11"
                          onClick={() => {
                            setRiderToSuspend({
                              id: rider.id,
                              name: rider.name,
                            });
                          }}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Suspend
                          <span className="sr-only">
                            {" "}
                            {rider.name}, {rider.id}
                          </span>
                        </Button>
                      ) : rider.approvalStatus === "suspended" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={requiresRead || loading}
                          className="min-h-11"
                          onClick={() => {
                            setRiderToRestore({
                              id: rider.id,
                              name: rider.name,
                            });
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Restore
                          <span className="sr-only">
                            {" "}
                            {rider.name}, {rider.id}
                          </span>
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })
          )}
        </Table>
      </div>
      <section aria-label="Rider cards" className="grid gap-3 md:hidden">
        {loading ? (
          <p
            role="status"
            className="rounded-xl border border-border bg-card p-4 text-sm"
          >
            Loading riders…
          </p>
        ) : error ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            Rider status is unavailable until the list is refreshed.
          </p>
        ) : visibleRiders.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            No rider profiles were returned.
          </p>
        ) : (
          visibleRiders.map((rider) => (
            <article
              key={rider.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-bold text-foreground">
                    {rider.name}
                  </h2>
                  <p className="break-all text-xs text-muted-foreground">
                    {rider.contactNumber ?? "Contact not recorded"}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    Availability
                  </span>
                  <StatusBadge status={rider.availabilityStatus} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span>Approval</span>
                <Badge variant={APPROVAL_BADGES[rider.approvalStatus].variant}>
                  {APPROVAL_BADGES[rider.approvalStatus].label}
                </Badge>
                {!rider.isActive && (
                  <span className="font-bold text-red-700">
                    Inactive account
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {rider.deliveriesToday} delivered today ·{" "}
                {rider.totalDeliveries} delivered total
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {rider.lastAssignedAt
                  ? `Last assigned ${activityDateTimeFormatter.format(new Date(rider.lastAssignedAt))}`
                  : "No assignment recorded"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-11"
                  disabled={requiresRead || loading}
                  onClick={() => setSelectedRiderId(rider.id)}
                >
                  View application
                  <span className="sr-only">
                    {" "}
                    for {rider.name}, {rider.id}
                  </span>
                </Button>
                {rider.approvalStatus === "approved" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    className="min-h-11"
                    disabled={requiresRead || loading}
                    onClick={() =>
                      setRiderToSuspend({ id: rider.id, name: rider.name })
                    }
                  >
                    Suspend
                    <span className="sr-only">
                      {" "}
                      {rider.name}, {rider.id}
                    </span>
                  </Button>
                ) : rider.approvalStatus === "suspended" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-11"
                    disabled={requiresRead || loading}
                    onClick={() =>
                      setRiderToRestore({ id: rider.id, name: rider.name })
                    }
                  >
                    Restore
                    <span className="sr-only">
                      {" "}
                      {rider.name}, {rider.id}
                    </span>
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>

      <RiderApplicationDialog
        riderId={selectedRiderId}
        open={
          Boolean(selectedRiderId) &&
          loadedForSession === session?.id &&
          session?.role === "manager"
        }
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRiderId(null);
          }
        }}
        onApproved={() => {
          setSelectedRiderId(null);
          handleConfirmedChange(
            "Rider approval was confirmed. The directory is refreshing.",
          );
        }}
        onOutcomeUnknown={handleUnknownOutcome}
      />
      <SuspendRiderDialog
        riderId={riderToSuspend?.id ?? null}
        riderName={riderToSuspend?.name ?? null}
        open={
          Boolean(riderToSuspend) &&
          loadedForSession === session?.id &&
          session?.role === "manager"
        }
        onOpenChange={(open) => {
          if (!open) {
            setRiderToSuspend(null);
          }
        }}
        onSuspended={() => {
          setRiderToSuspend(null);
          handleConfirmedChange(
            "Rider suspension was confirmed. The directory is refreshing.",
          );
        }}
        onOutcomeUnknown={handleUnknownOutcome}
      />
      <RestoreRiderDialog
        riderId={riderToRestore?.id ?? null}
        riderName={riderToRestore?.name ?? null}
        open={
          Boolean(riderToRestore) &&
          loadedForSession === session?.id &&
          session?.role === "manager"
        }
        onOpenChange={(open) => {
          if (!open) {
            setRiderToRestore(null);
          }
        }}
        onRestored={() => {
          setRiderToRestore(null);
          handleConfirmedChange(
            "Rider restoration was confirmed. The directory is refreshing.",
          );
        }}
        onOutcomeUnknown={handleUnknownOutcome}
      />
    </div>
  );
}
