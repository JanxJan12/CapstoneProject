import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import {
  getReplenishmentRequests,
  startReplenishmentReceiving,
  type ReplenishmentRequest,
  type ReplenishmentStatus,
} from "./replenishmentApi";

const statusLabel: Record<ReplenishmentStatus, string> = {
  requested: "Requested",
  acknowledged: "Acknowledged",
  preparing: "Preparing",
  ready_for_delivery: "Ready for delivery",
  received: "Received / closed",
};
const when = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(value))
    : "—";

export function ReplenishmentPage({
  initialItemId,
  onBackToItem,
  onReceive,
}: {
  initialItemId?: string;
  onBackToItem?: () => void;
  onReceive?: (request: ReplenishmentRequest, reportId: string) => void;
}) {
  const [rows, setRows] = useState<ReplenishmentRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getReplenishmentRequests());
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const startReceiving = async (row: ReplenishmentRequest) => {
    if (busy || !onReceive) return;
    setBusy(true);
    setError("");
    try {
      const reportId = await startReplenishmentReceiving(row.id);
      onReceive(row, reportId);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start Receiving.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inventory-workspace-page max-w-7xl">
      <header className="manager-page-header mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="manager-page-context">
            Inventory / Stock
          </p>
          {onBackToItem ? (
            <button
              type="button"
              onClick={onBackToItem}
              className="mb-2 text-sm font-semibold text-primary underline"
            >
              ← Item stock
            </button>
          ) : null}
          <h1>Single-item requests</h1>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Refresh
        </Button>
      </header>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      <section aria-label="Replenishment queue" className="space-y-3">
        {loading ? (
          <p role="status">Loading requests…</p>
        ) : rows.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No legacy requests.
          </p>
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{row.item_name}</h2>
                  <p className="text-sm">
                    {row.quantity} {row.unit} ·{" "}
                    {row.priority === "urgent" ? "Urgent" : "Normal"} ·{" "}
                    {statusLabel[row.status]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requested {when(row.requested_at)} by{" "}
                    {row.requested_by_name || "Staff"} · Needed{" "}
                    {when(row.needed_at)}
                  </p>
                  {row.note ? <p className="mt-2 text-sm">{row.note}</p> : null}
                  {row.ready_at ? (
                    <p className="mt-2 text-xs">Ready {when(row.ready_at)}</p>
                  ) : null}
                  {row.receiving_report_number ? (
                    <p className="mt-1 text-xs">
                      Receiving {row.receiving_report_number} ·{" "}
                      {row.receiving_report_status}
                    </p>
                  ) : null}
                  {row.status === "received" ? (
                    <p className="mt-1 text-xs font-semibold">
                      Final: {row.accepted ?? 0} accepted · {row.rejected ?? 0}{" "}
                      rejected {row.unit}
                    </p>
                  ) : null}
                </div>
                {row.status === "ready_for_delivery" ? (
                  <Button
                    size="sm"
                    onClick={() => void startReceiving(row)}
                    disabled={busy}
                  >
                    {row.receiving_report_id
                      ? "Open Receiving"
                      : "Start Receiving"}
                  </Button>
                ) : null}
              </div>
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-semibold">
                  Status history
                </summary>
                <ol className="mt-2 space-y-1">
                  {row.events.map((event, index) => (
                    <li key={`${event.changed_at}-${index}`}>
                      {statusLabel[event.next_status]} ·{" "}
                      {when(event.changed_at)} ·{" "}
                      {event.changed_by_name || "Staff"}
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
