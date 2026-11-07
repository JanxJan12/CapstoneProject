import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/common/Button";
import {
  getInventoryRequestRegister,
  startInventoryRequestReceiving,
  type InventoryRequest,
} from "./inventoryRequestApi";
import { formatRequestQuantity } from "./requestQuantity";
import { requestWorkflow } from "./requestWorkflow";

const manila = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
});
const statusLabel: Record<InventoryRequest["status"], string> = {
  issued: "Issued",
  partially_received: "Partially received",
  fulfilled: "Fulfilled",
  closed_short: "Closed with shortfall",
};

/** Display only; the register RPC and start RPC remain the authorization and write authorities. */
export const awaitingProductionDelivery = (request: InventoryRequest) => {
  const next = requestWorkflow(request).next;
  return next === "draft" || next === "delivery";
};

export function AwaitingProductionDelivery({
  refreshKey,
  disabled,
  beforeCreate,
  onOpenReport,
}: {
  refreshKey: number;
  disabled: boolean;
  beforeCreate: () => boolean;
  onOpenReport: (id: string, created?: boolean) => Promise<boolean>;
}) {
  const [requests, setRequests] = useState<InventoryRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);
  const actionLock = useRef(false);
  const reportId = useRef(crypto.randomUUID());

  const refresh = async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const result = await getInventoryRequestRegister();
      if (version === requestVersion.current) setRequests(result);
      return result;
    } catch (caught) {
      if (version === requestVersion.current) {
        setRequests(null);
        setError(caught instanceof Error ? caught.message : "Unable to load issued requests.");
      }
      return null;
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };
  useEffect(() => { void refresh(); return () => { requestVersion.current += 1; }; }, [refreshKey]);

  const eligible = useMemo(() => (requests ?? []).filter(awaitingProductionDelivery), [requests]);
  const starting = eligible.find((request) => request.id === startingId);

  const openOrPrepare = async (requestId: string) => {
    if (disabled || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      const latest = await getInventoryRequestRegister();
      setRequests(latest);
      const request = latest.find((row) => row.id === requestId);
      if (!request || !awaitingProductionDelivery(request)) {
        setStartingId(null);
        setError("This request is no longer open for Receiving. Review the refreshed list.");
        return;
      }
      const draft = requestWorkflow(request).draftReceipt;
      if (draft) {
        if (await onOpenReport(draft.id)) setStartingId(null);
      } else {
        setStartingId(request.id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open this request.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  const createLinkedDraft = async () => {
    if (!starting || disabled || actionLock.current || !beforeCreate()) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      const latest = await getInventoryRequestRegister();
      setRequests(latest);
      const request = latest.find((row) => row.id === starting.id);
      if (!request || !awaitingProductionDelivery(request)) {
        setStartingId(null);
        setError("This request is no longer open for Receiving. Review the refreshed list.");
        return;
      }
      let draftId = requestWorkflow(request).draftReceipt?.id;
      if (!draftId) {
        if (request.revision !== starting.revision) {
          setStartingId(null);
          setError("The issued revision changed. Select the current request again.");
          return;
        }
        const created = await startInventoryRequestReceiving(request.id, request.revision, reportId.current);
        draftId = created.id;
      }
      if (await onOpenReport(draftId, true)) {
        reportId.current = crypto.randomUUID();
        setStartingId(null);
      }
    } catch (caught) {
      // The RPC may have committed before a network error, or another Manager may
      // have won the one-open-draft uniqueness race. Read the register before retry.
      try {
        const latest = await getInventoryRequestRegister();
        setRequests(latest);
        const draft = latest.find((row) => row.id === starting.id)?.receipts.find((row) => row.status === "draft");
        if (draft && await onOpenReport(draft.id, true)) {
          reportId.current = crypto.randomUUID();
          setStartingId(null);
          return;
        }
      } catch { /* Preserve the original failure; the Manager can refresh. */ }
      setError(caught instanceof Error ? caught.message : "Unable to start linked Receiving. Refresh before retrying.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="awaiting-production-heading" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="awaiting-production-heading" className="text-base font-bold">Awaiting Production Delivery</h2>
          <p className="mt-1 text-xs text-muted-foreground">Issued requests with outstanding quantities. These are requests, not Receiving documents; viewing them does not record delivery or stock.</p>
        </div>
        <Button size="sm" variant="secondary" disabled={loading || busy || disabled} onClick={() => void refresh()}>Refresh requests</Button>
      </div>
      {loading ? <p role="status" className="mt-4 text-sm">Loading outstanding requests…</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {!loading && requests && eligible.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No issued requests currently have an open delivery balance.</p> : null}
      {!loading && requests && eligible.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {eligible.map((request) => {
            const workflow = requestWorkflow(request);
            const remaining = request.lines.filter((line) => line.remaining > 0);
            const needed = new Date(request.needed_at);
            return <li key={request.id} className="min-w-0 rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-bold">{request.number} · Rev {request.revision}</p>
                  <p className="mt-1 text-xs">Status: {statusLabel[request.status]} · Needed: {Number.isNaN(needed.getTime()) ? "Time unavailable" : `${manila.format(needed)}`}</p>
                  <p className="mt-1 text-xs">{workflow.outstandingLines} outstanding item{workflow.outstandingLines === 1 ? "" : "s"} · {workflow.postedReceipts} posted Receiving document{workflow.postedReceipts === 1 ? "" : "s"}</p>
                </div>
                <Button size="sm" disabled={disabled || busy} onClick={() => void openOrPrepare(request.id)}>{workflow.draftReceipt ? "Resume Receiving" : "Record delivery"}</Button>
              </div>
              <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                {remaining.map((line) => <li key={line.inventory_item_id} className="break-words">{line.name}: <strong>{formatRequestQuantity(line.remaining)} {line.unit}</strong> remaining</li>)}
              </ul>
              {startingId === request.id && !workflow.draftReceipt ? (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="font-semibold">Start linked Receiving · {request.number} Rev {request.revision}</p>
                  <p className="mt-1 text-xs">Start only when you personally inspect this delivery. Your authenticated Manager account is recorded as the physical inspector. No stock moves until the receipt is posted.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy || disabled} loading={busy} onClick={() => void createLinkedDraft()}>Start Receiving</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStartingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}
            </li>;
          })}
        </ul>
      ) : null}
    </section>
  );
}
