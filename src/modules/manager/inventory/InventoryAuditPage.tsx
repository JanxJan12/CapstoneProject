import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/common/Button";
import {
  getInventoryAuditItems,
  getInventoryAudits,
  runInventoryAudit,
  type InventoryAuditFinding,
  type InventoryAuditRun,
} from "./inventoryAuditApi";
import { InventoryReconciliationPanel } from "./InventoryReconciliationPanel";

const historyDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

function auditHistoryLabel(
  audit: InventoryAuditRun,
  history: InventoryAuditRun[],
): string {
  const date = historyDateFormatter.format(new Date(audit.completedAt));
  const sameMinute = history.some(
    (other) =>
      other.id !== audit.id &&
      historyDateFormatter.format(new Date(other.completedAt)) === date,
  );
  return `${date} · Completed${sameMinute ? ` · ${audit.id.slice(0, 8)}` : ""}`;
}

function auditIdFromUrl(): string | null {
  return typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("audit");
}

const PENDING_AUDIT_KEY = "rrj-manager-inventory-audit-request";

function pendingRequestId(): string | null {
  try {
    const stored =
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(PENDING_AUDIT_KEY);
    return stored &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        stored,
      )
      ? stored
      : null;
  } catch {
    return null;
  }
}

function storePendingRequestId(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(PENDING_AUDIT_KEY, id);
    else window.sessionStorage.removeItem(PENDING_AUDIT_KEY);
  } catch {
    // The in-memory request ID still protects retries within this page visit.
  }
}

export function InventoryAuditPage({
  onOpenItem,
}: {
  onOpenItem: (itemId: string) => void;
}) {
  const [history, setHistory] = useState<InventoryAuditRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(auditIdFromUrl);
  const [rows, setRows] = useState<InventoryAuditFinding[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [olderError, setOlderError] = useState("");
  const [running, setRunning] = useState(false);
  const [awaitingHistory, setAwaitingHistory] = useState(false);
  const [error, setError] = useState("");
  const [runError, setRunError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(pendingRequestId());
  const readVersion = useRef(0);

  const loadHistory = useCallback(
    async (preferredId?: string): Promise<boolean> => {
      setLoadingHistory(true);
      setError("");
      try {
        const audits = await getInventoryAudits();
        setHistory(audits);
        setHasOlder(audits.length === 25);
        setOlderError("");
        setAwaitingHistory(false);
        setSelectedId(
          (current) => preferredId ?? current ?? audits[0]?.id ?? null,
        );
        return true;
      } catch (caught) {
        setHistory([]);
        setRows([]);
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load audit history.",
        );
        return false;
      } finally {
        setLoadingHistory(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);
  useEffect(() => {
    const restore = () => setSelectedId(auditIdFromUrl());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const loadOlder = async () => {
    const last = history.at(-1);
    if (!last || !hasOlder || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError("");
    try {
      const older = await getInventoryAudits({
        completedAt: last.completedAt,
        id: last.id,
      });
      setHistory((current) => [
        ...current,
        ...older.filter(
          (audit) => !current.some((existing) => existing.id === audit.id),
        ),
      ]);
      setHasOlder(older.length === 25);
    } catch (caught) {
      setOlderError(
        caught instanceof Error
          ? caught.message
          : "Unable to load older audits.",
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    const version = ++readVersion.current;
    if (
      !selectedId ||
      loadingHistory ||
      !history.some((audit) => audit.id === selectedId)
    ) {
      setRows([]);
      setLoadingItems(false);
      return;
    }
    setRows([]);
    setLoadingItems(true);
    setError("");
    void getInventoryAuditItems(selectedId)
      .then((items) => {
        if (version === readVersion.current) setRows(items);
      })
      .catch((caught: unknown) => {
        if (version === readVersion.current)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load audit results.",
          );
      })
      .finally(() => {
        if (version === readVersion.current) setLoadingItems(false);
      });
  }, [selectedId, loadingHistory, history, retryKey]);

  const selectAudit = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("audit", id);
    window.history.pushState(null, "", url);
    setError("");
    setSelectedId(id);
  };

  const runAudit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setRunError("");
    requestId.current ??= crypto.randomUUID();
    storePendingRequestId(requestId.current);
    try {
      const id = await runInventoryAudit(requestId.current);
      requestId.current = null;
      storePendingRequestId(null);
      if (await loadHistory(id)) selectAudit(id);
      else {
        setAwaitingHistory(true);
        setRunError(
          "Audit saved, but its history could not be loaded. Refresh history before running again.",
        );
      }
    } catch (caught) {
      setRunError(
        caught instanceof Error
          ? caught.message
          : "Audit could not be confirmed.",
      );
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  };

  const selected = history.find((audit) => audit.id === selectedId) ?? null;
  return (
    <div className="inventory-workspace-page manager-support-page manager-audit-page max-w-7xl [&_button]:min-h-11 [&_select]:min-h-11!">
      <header className="manager-page-header mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="manager-page-context">Inventory / Audit</p>
          <h1>Inventory Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare book stock with movement history. A match does not verify
            physical stock.
          </p>
        </div>
        <Button
          size="sm"
          disabled={running || loadingHistory || awaitingHistory}
          onClick={() => void runAudit()}
        >
          {running ? "Saving audit…" : "Run and save audit"}
        </Button>
      </header>
      {runError ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {runError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-[1_1_16rem] text-sm font-medium text-foreground">
          Audit history
          <select
            value={selectedId ?? ""}
            onChange={(event) => selectAudit(event.target.value)}
            disabled={loadingHistory || history.length === 0}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {history.length === 0 ? (
              <option value="">No audits yet</option>
            ) : null}
            {history.map((audit) => (
              <option key={audit.id} value={audit.id}>
                {auditHistoryLabel(audit, history)}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="ghost"
          disabled={loadingHistory}
          onClick={() => void loadHistory()}
        >
          Refresh
        </Button>
        {hasOlder ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
          >
            {loadingOlder ? "Loading…" : "Load older"}
          </Button>
        ) : null}
      </div>
      {olderError ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {olderError}
        </p>
      ) : null}
      {selectedId && !selected && !loadingHistory && !error ? (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          This audit is not in the recent history list.
        </p>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (history.length === 0) void loadHistory();
              else setRetryKey((value) => value + 1);
            }}
          >
            {history.length === 0
              ? "Retry audit history"
              : "Retry audit results"}
          </Button>
        </div>
      ) : null}
      <InventoryReconciliationPanel
        run={selected}
        rows={rows}
        isLoading={loadingHistory || loadingItems}
        error={error}
        onOpenItem={onOpenItem}
      />
    </div>
  );
}
