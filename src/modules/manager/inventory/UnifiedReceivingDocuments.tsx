import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/common/Button";
import { getInventoryRequestRegister, startInventoryRequestReceiving, type InventoryRequest } from "./inventoryRequestApi";
import { getReceivingDocuments, type ReceivingDocumentFilters, type ReceivingReportSummary } from "./receivingApi";
import { formatRequestQuantity } from "./requestQuantity";
import { requestWorkflow } from "./requestWorkflow";
import { manilaToday } from "./inventoryMutationUi";
import { manilaDateTime } from "./StockPresentation";
import { receivingDocumentLabels } from "./ReceivingDocumentList";
import { receiptReceivingEntries, requestReceivingEntries } from "./unifiedReceivingModel";

const PAGE_SIZE = 20;
type StatusFilter = "" | "awaiting" | "draft" | "posted";
type ListFilters = ReceivingDocumentFilters & { viewStatus: StatusFilter };
const initialFilters: ListFilters = { viewStatus: "" };

export function UnifiedReceivingDocuments({
  selectedId, onSelect, onOpenReport, beforeCreate, refreshKey, disabled, initialSearch = "", compact = false, autoOpenFirstReceipt = false,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenReport: (id: string, created?: boolean) => Promise<boolean>;
  beforeCreate: () => boolean;
  refreshKey: number;
  disabled: boolean;
  initialSearch?: string;
  compact?: boolean;
  autoOpenFirstReceipt?: boolean;
}) {
  const [draft, setDraft] = useState<ListFilters>(() => ({ ...initialFilters, search: initialSearch }));
  const [filters, setFilters] = useState<ListFilters>(() => ({ ...initialFilters, search: initialSearch }));
  const [offset, setOffset] = useState(0);
  const [requests, setRequests] = useState<InventoryRequest[] | null>(null);
  const [receipts, setReceipts] = useState<ReceivingReportSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const actionLock = useRef(false);
  const nextReportId = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;
    setRequestsLoading(true);
    setRequestError("");
    void getInventoryRequestRegister()
      .then((result) => { if (active) setRequests(result); })
      .catch((caught: unknown) => {
        if (!active) return;
        setRequests(null);
        setRequestError(caught instanceof Error ? caught.message : "Unable to load Inventory Requests.");
      })
      .finally(() => { if (active) setRequestsLoading(false); });
    return () => { active = false; };
  }, [refreshKey, retryKey]);

  useEffect(() => {
    let active = true;
    if (filters.viewStatus === "awaiting") {
      setReceipts([]);
      setHasMore(false);
      setReceiptError("");
      setReceiptsLoading(false);
      return () => { active = false; };
    }
    setReceiptsLoading(true);
    setReceiptError("");
    const serverFilters: ReceivingDocumentFilters = {
      search: filters.search,
      status: filters.viewStatus === "draft" || filters.viewStatus === "posted" ? filters.viewStatus : "",
      sourceType: filters.sourceType,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    };
    void getReceivingDocuments(serverFilters, offset, PAGE_SIZE)
      .then((page) => {
        if (!active) return;
        setReceipts(page.rows);
        setHasMore(page.hasMore);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setReceipts([]);
        setHasMore(false);
        setReceiptError(caught instanceof Error ? caught.message : "Unable to load Receiving receipts.");
      })
      .finally(() => { if (active) setReceiptsLoading(false); });
    return () => { active = false; };
  }, [filters, offset, refreshKey, retryKey]);

  const requestEntries = useMemo(() => requestReceivingEntries(requests ?? []), [requests]);
  const visibleRequests = requestEntries.filter((entry) => {
    if (filters.viewStatus === "posted") return false;
    if (filters.viewStatus === "awaiting" && entry.draftId) return false;
    if (filters.viewStatus === "draft" && !entry.draftId) return false;
    if (filters.fromDate || filters.toDate) return false;
    return !filters.search || entry.request.number.toLowerCase().includes(filters.search.trim().toLowerCase());
  });
  const visibleReceipts = receiptReceivingEntries(receipts, visibleRequests, false);
  const initialReceiptOpened = useRef(false);
  useEffect(() => {
    if (initialReceiptOpened.current || !autoOpenFirstReceipt || selectedId || pendingRequestId || busy || receiptsLoading || receipts.length === 0) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    initialReceiptOpened.current = true;
    onSelect(receipts.find((receipt) => receipt.status === "draft")?.id ?? receipts[0].id);
  }, [autoOpenFirstReceipt, busy, onSelect, pendingRequestId, receipts, receiptsLoading, selectedId]);
  const pendingRequest = requestEntries.find((entry) => entry.request.id === pendingRequestId);
  const progressFor = (request: InventoryRequest) => {
    const complete = request.lines.filter((line) => line.remaining <= 0).length;
    const partial = request.lines.filter((line) => line.accepted > 0 && line.remaining > 0).length;
    const total = request.lines.length;
    const percent = total ? Math.round(request.lines.reduce((sum, line) => sum + (line.quantity > 0 ? Math.min(1, line.accepted / line.quantity) : 0), 0) / total * 100) : 0;
    return { complete, partial, total, percent };
  };

  const apply = () => {
    if (draft.search?.trim().toUpperCase().startsWith("RR-")) setHistoryOpen(true);
    setOffset(0);
    setPendingRequestId(null);
    setFilters({ ...draft });
  };
  const setStatus = (viewStatus: StatusFilter) => {
    if (viewStatus === "draft" || viewStatus === "posted") setHistoryOpen(true);
    setDraft((current) => ({ ...current, viewStatus }));
    setFilters((current) => ({ ...current, viewStatus }));
    setOffset(0);
    setPendingRequestId(null);
  };
  const today = () => {
    const date = manilaToday();
    const next = { ...draft, fromDate: date, toDate: date };
    setDraft(next);
    setFilters(next);
    setOffset(0);
  };

  const openOrPrepare = async (requestId: string) => {
    if (disabled || actionLock.current) return;
    initialReceiptOpened.current = true;
    actionLock.current = true;
    setBusy(true);
    setRequestError("");
    try {
      const latest = await getInventoryRequestRegister();
      setRequests(latest);
      const entry = requestReceivingEntries(latest).find((row) => row.request.id === requestId);
      if (!entry) {
        setPendingRequestId(null);
        setRequestError("This request is no longer open for Receiving. Review the refreshed list.");
        return;
      }
      if (entry.draftId) {
        if (await onOpenReport(entry.draftId)) setPendingRequestId(null);
      } else {
        setPendingRequestId(requestId);
      }
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : "Unable to open this request.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  const createLinkedDraft = async () => {
    if (!pendingRequest || disabled || actionLock.current || !beforeCreate()) return;
    actionLock.current = true;
    setBusy(true);
    setRequestError("");
    try {
      const latest = await getInventoryRequestRegister();
      setRequests(latest);
      const entry = requestReceivingEntries(latest).find((row) => row.request.id === pendingRequest.request.id);
      if (!entry) {
        setPendingRequestId(null);
        setRequestError("This request is no longer open for Receiving. Review the refreshed list.");
        return;
      }
      let draftId = entry.draftId;
      if (!draftId) {
        if (entry.request.revision !== pendingRequest.request.revision) {
          setPendingRequestId(null);
          setRequestError("The issued revision changed. Select the current request again.");
          return;
        }
        const created = await startInventoryRequestReceiving(entry.request.id, entry.request.revision, nextReportId.current);
        draftId = created.id;
      }
      if (await onOpenReport(draftId, true)) {
        nextReportId.current = crypto.randomUUID();
        setPendingRequestId(null);
      }
    } catch (caught) {
      try {
        const latest = await getInventoryRequestRegister();
        setRequests(latest);
        const draftId = requestWorkflow(latest.find((row) => row.id === pendingRequest.request.id) ?? pendingRequest.request).draftReceipt?.id;
        if (draftId && await onOpenReport(draftId, true)) {
          nextReportId.current = crypto.randomUUID();
          setPendingRequestId(null);
          return;
        }
      } catch { /* Keep the original failure and the retry UUID. */ }
      setRequestError(caught instanceof Error ? caught.message : "Unable to start linked Receiving. Refresh before retrying.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-label="Receiving documents" className={`min-w-0 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4 ${compact ? "manager-receiving-register" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="receiving-queue-heading" tabIndex={-1} className="text-base font-bold outline-none">Receiving Register</h2>
          <p className="mt-1 text-xs text-muted-foreground">Select a request to start or continue receiving deliveries.</p>
        </div>
      </div>
      <div role="group" aria-label="Receiving status" className="mt-3 flex flex-wrap gap-1 border-b border-border pb-2">
        {([ ["", "All"], ["awaiting", "Awaiting Delivery"], ["draft", "Draft"], ["posted", "Posted"] ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filters.viewStatus === value} onClick={() => setStatus(value)}
            className={`min-h-11 rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filters.viewStatus === value ? "bg-[#2b1b12] text-white" : "text-muted-foreground hover:bg-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="manager-receiving-search mt-3 flex flex-wrap items-end gap-2">
        <label className="w-full min-w-0 text-xs font-semibold sm:min-w-64 sm:flex-1">
          Search requests and receipts
          <input type="search" value={draft.search ?? ""} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
            onKeyDown={(event) => { if (event.key === "Enter") apply(); }} placeholder="Request number, receipt number, source reference"
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        <label className="text-xs font-semibold">Source
          <select aria-label="Receiving source" value={draft.sourceType ?? ""} onChange={(event) => setDraft((current) => ({ ...current, sourceType: event.target.value as ReceivingDocumentFilters["sourceType"] }))}
            className="mt-1 block min-h-11 rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary">
            <option value="">All sources</option><option value="production_team">Production Team</option>
          </select>
        </label>
        <Button size="sm" className={compact ? "manager-receiving-register-action" : undefined} onClick={apply}>Search</Button>
        <Button size="sm" variant="secondary" onClick={() => { setDraft(initialFilters); setFilters(initialFilters); setOffset(0); setPendingRequestId(null); }}>Clear</Button>
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setRetryKey((value) => value + 1)}>Refresh</Button>
      </div>
      <details className="mt-2 rounded-lg border border-border px-3 text-xs">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          More filters{filters.sourceType || filters.fromDate || filters.toDate ? " · active" : ""}
        </summary>
        <div className="grid gap-2 border-t border-border py-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Received from
            <input type="date" value={draft.fromDate ?? ""} max={draft.toDate || undefined} onChange={(event) => setDraft((current) => ({ ...current, fromDate: event.target.value }))}
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
          <label className="text-xs font-semibold">Received through
            <input type="date" value={draft.toDate ?? ""} min={draft.fromDate || undefined} onChange={(event) => setDraft((current) => ({ ...current, toDate: event.target.value }))}
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <Button size="sm" variant="secondary" onClick={today}>Today</Button>
          <Button size="sm" onClick={apply}>Apply filters</Button>
        </div>
        <p className="pb-3 text-xs text-muted-foreground">Received-date filters apply to actual receipts only. Request entries use their needed date and are hidden while a received-date filter is active.</p>
      </details>
      <p className="mt-3 text-xs text-muted-foreground">Requests show accepted quantities by item. Receipt history uses separate server pages and received-date filters.</p>
      {requestError ? <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{requestError}<Button size="sm" variant="secondary" className="mt-2" onClick={() => setRetryKey((value) => value + 1)}>Retry requests</Button></div> : null}
      {receiptError ? <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{receiptError}<Button size="sm" variant="secondary" className="mt-2" onClick={() => setRetryKey((value) => value + 1)}>Retry receipts</Button></div> : null}
      {requestsLoading || receiptsLoading ? <p role="status" className="mt-3 text-xs text-muted-foreground">Loading Receiving Documents…</p> : null}
      {(visibleRequests.length > 0 || requestsLoading) ? <div className="mt-3 overflow-hidden rounded-lg border border-border" aria-label="Unified Receiving entries">
        <div className="manager-receiving-queue-columns hidden items-center gap-2 bg-muted/50 px-3 py-2 text-xs font-bold text-muted-foreground lg:grid">
          <span>Reference</span><span>Source</span><span>Requested</span><span>Accepted</span><span>Outstanding</span><span>Status</span><span>Needed date</span><span className="text-right">Action</span>
        </div>
        <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto" aria-label="Receiving requests">
        {visibleRequests.map((entry) => {
          const request = entry.request;
          const progress = progressFor(request);
          return (
            <li key={entry.key} className="min-w-0 px-3 py-2.5 text-xs">
              <div className="manager-receiving-queue-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <p className="break-all font-mono font-bold">{request.number}</p>
                  <p className="text-muted-foreground">Rev {request.revision}{entry.draftId ? ` · ${request.receipts.find((receipt) => receipt.id === entry.draftId)?.number ?? "Linked draft"}` : ""}</p>
                </div>
                <span className="hidden text-muted-foreground lg:block">Production Team</span>
                <div className="order-3 col-span-2 min-w-0 lg:order-none lg:col-span-1">
                  <p className="font-semibold lg:hidden">{request.lines.length === 1
                    ? `${formatRequestQuantity(request.lines[0].accepted)} / ${formatRequestQuantity(request.lines[0].quantity)} ${request.lines[0].unit} accepted`
                    : `${progress.complete} of ${progress.total} items fulfilled${progress.partial ? ` · ${progress.partial} partly accepted` : ""}`}</p>
                  <p className="hidden lg:block">{request.lines.length === 1 ? `${formatRequestQuantity(request.lines[0].quantity)} ${request.lines[0].unit}` : `${request.lines.length} item lines`}</p>
                  {!compact ? <><div role="progressbar" aria-label={`${request.number} average item completion`} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} /></div>
                  <details className="mt-1 text-muted-foreground"><summary className="cursor-pointer font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Item progress</summary>
                    <ul className="mt-1 space-y-1 rounded-md border border-border bg-card p-2">
                      {request.lines.map((line) => <li key={line.inventory_item_id} className="break-words">{line.name}: <strong className="text-foreground">{formatRequestQuantity(line.accepted)} / {formatRequestQuantity(line.quantity)} {line.unit}</strong> accepted · {formatRequestQuantity(line.remaining)} {line.unit} remaining</li>)}
                    </ul>
                  </details></> : null}
                </div>
                <span className="hidden lg:block">{request.lines.length === 1 ? `${formatRequestQuantity(request.lines[0].accepted)} ${request.lines[0].unit}` : `${progress.complete} complete · ${progress.partial} partial`}</span>
                <span className="hidden lg:block">{request.lines.length === 1 ? `${formatRequestQuantity(request.lines[0].remaining)} ${request.lines[0].unit}` : `${request.lines.filter((line) => line.remaining > 0).length} item lines`}</span>
                <span className={`order-2 justify-self-end rounded-full px-2 py-1 font-bold lg:order-none lg:justify-self-start ${entry.draftId ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"}`}>{entry.status}</span>
                <span className="order-4 min-w-0 text-muted-foreground lg:order-none">{manilaDateTime.format(new Date(request.needed_at))}</span>
                <Button size="sm" className={`order-5 justify-self-end lg:order-none ${compact ? "manager-receiving-register-action" : ""}`} disabled={disabled || busy} onClick={() => void openOrPrepare(request.id)}>{entry.action}</Button>
              </div>
              {pendingRequestId === request.id && !entry.draftId ? (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="font-bold">Start linked Receiving · {request.number} Rev {request.revision}</p>
                  <p className="mt-1">Start only after personally inspecting a physical delivery. Your authenticated Manager account is recorded as inspector. Draft creation does not move stock.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy || disabled} loading={busy} onClick={() => void createLinkedDraft()}>Start Receiving</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setPendingRequestId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        </ul>
      </div> : null}
      {filters.viewStatus !== "awaiting" ? <div className="mt-4">
        <button type="button" aria-expanded={historyOpen} aria-controls="receiving-register-history" onClick={() => setHistoryOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border px-3 text-left text-sm font-bold focus-visible:ring-2 focus-visible:ring-primary">Receipt history <span aria-hidden="true">{historyOpen ? "▴" : "▾"}</span></button>
        <div id="receiving-register-history" hidden={!historyOpen}>
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border" aria-label="Receiving receipt history">
        {!receiptError && visibleReceipts.map((entry) => {
          const receipt = entry.receipt;
          return (
            <li key={entry.key}>
              <button type="button" onClick={() => { initialReceiptOpened.current = true; onSelect(receipt.id); }} aria-current={selectedId === receipt.id ? "true" : undefined}
                className={`grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-3 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:grid-cols-[minmax(10rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(7rem,0.7fr)_auto] ${selectedId === receipt.id ? "bg-amber-50" : "hover:bg-muted/60"}`}>
                <span className="min-w-0 break-all font-mono font-bold">{receipt.rrNumber}</span>
                <span className="min-w-0 font-semibold">Receiving Receipt · {receivingDocumentLabels(receipt).source}{receipt.sourceReference ? ` · ${receipt.sourceReference}` : ""}</span>
                <span className="text-muted-foreground">Received {manilaDateTime.format(new Date(receipt.receivedAt))}</span>
                <span className="text-muted-foreground">{receipt.lineCount} line(s) · {receivingDocumentLabels(receipt).status}</span>
                <span className="col-start-2 row-start-1 text-right font-bold text-primary md:col-auto md:row-auto">{receipt.status === "draft" ? "Open Draft" : "View Receipt"}</span>
              </button>
            </li>
          );
        })}
        </ul>
      </div></div> : null}
      {!requestsLoading && !receiptsLoading && !requestError && !receiptError && visibleRequests.length === 0 && visibleReceipts.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">No matching Receiving entries. Clear or adjust the filters to see other requests and receipts.</p>
      ) : null}
      {filters.viewStatus !== "awaiting" ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Linked drafts appear with their request. Search a receipt number to find its record.</span>
          {(hasMore || offset > 0) && !receiptError && !receiptsLoading ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Previous</Button>
              <span>Receipt page {Math.floor(offset / PAGE_SIZE) + 1}</span>
              <Button size="sm" variant="secondary" disabled={!hasMore} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Next</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
