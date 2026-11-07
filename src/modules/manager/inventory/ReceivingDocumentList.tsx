import { useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import {
  getReceivingDocuments,
  type ReceivingDocumentFilters,
  type ReceivingReportSummary,
} from "./receivingApi";
import { manilaToday } from "./inventoryMutationUi";
import { manilaDateTime } from "./StockPresentation";

const PAGE_SIZE = 20;

export function receivingDocumentLabels(report: ReceivingReportSummary) {
  return {
    status: report.status === "draft" ? "Draft" : "Posted",
    source:
      report.policyClass === "manager_emergency" ? "Production · Manager emergency"
        : report.policyClass === "formal_request" ? "Production · Formal request"
        : report.policyClass === "historical_legacy_request" ? "Production · Historical request"
        : report.policyClass === "historical_unlinked" ? "Production · Historical unlinked"
        : report.sourceType === "direct_supplier" ? "Direct Supplier" : "Production Team",
  };
}

export function ReceivingDocumentList({
  selectedId,
  onSelect,
  refreshKey,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  refreshKey: number;
}) {
  const [draft, setDraft] = useState<ReceivingDocumentFilters>({});
  const [filters, setFilters] = useState<ReceivingDocumentFilters>({});
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ReceivingReportSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError("");
    void getReceivingDocuments(filters, offset, PAGE_SIZE)
      .then((page) => {
        if (!active) return;
        setRows(page.rows);
        setHasMore(page.hasMore);
      })
      .catch((caught: unknown) => {
        if (active) {
          if (import.meta.env.DEV) console.error("Receiving document retrieval failed", caught);
          setRows([]);
          setHasMore(false);
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load receiving documents.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, offset, refreshKey, retryKey]);

  const apply = () => {
    setOffset(0);
    setFilters({ ...draft });
  };
  const today = () => {
    const date = manilaToday();
    const next = { ...draft, fromDate: date, toDate: date };
    setDraft(next);
    setOffset(0);
    setFilters(next);
  };

  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-sm"
      aria-label="Receiving documents"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">Receiving documents</h2>
        <p className="text-xs text-muted-foreground">Open a draft or review a posted receipt.</p>
      </div>
      <div
        role="group"
        aria-label="Receiving status"
        className="mt-3 flex flex-wrap gap-1 border-b border-border pb-2"
      >
        {(
          [
            ["", "All"],
            ["draft", "Draft"],
            ["posted", "Posted"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={(draft.status ?? "") === value}
            onClick={() => {
              setDraft((current) => ({ ...current, status: value }));
              setFilters((current) => ({ ...current, status: value }));
              setOffset(0);
            }}
            className={`min-h-11 rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${(draft.status ?? "") === value ? "bg-[#2b1b12] text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="w-full min-w-0 text-xs font-semibold sm:w-auto sm:min-w-64 sm:flex-1">
          Search documents
          <input
            type="search"
            value={draft.search ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Receipt number, source, PO"
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
            }}
          />
        </label>
        <Button size="sm" onClick={apply}>Search</Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDraft({});
            setFilters({});
            setOffset(0);
          }}
        >
          Clear
        </Button>
      </div>
      <details className="mt-2 rounded-lg border border-border px-3 text-xs">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          More filters{filters.sourceType || filters.fromDate || filters.toDate ? " · active" : ""}
        </summary>
        <div className="grid gap-2 border-t border-border py-3 sm:grid-cols-3">
          <label className="text-xs font-semibold">
            Source
            <select
              value={draft.sourceType ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sourceType: event.target
                    .value as ReceivingDocumentFilters["sourceType"],
                }))
              }
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">All sources</option>
              <option value="production_team">Production Team</option>
              <option value="direct_supplier">Direct Supplier</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Received from
            <input
              type="date"
              value={draft.fromDate ?? ""}
              max={draft.toDate || undefined}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  fromDate: event.target.value,
                }))
              }
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="text-xs font-semibold">
            Received through
            <input
              type="date"
              value={draft.toDate ?? ""}
              min={draft.fromDate || undefined}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  toDate: event.target.value,
                }))
              }
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 pb-3">
          <Button size="sm" variant="secondary" onClick={today}>Today</Button>
          <Button size="sm" onClick={apply}>Apply filters</Button>
        </div>
      </details>
      {error ? (
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>{error}</p>
          <Button size="sm" variant="secondary" className="mt-2" disabled={isLoading} onClick={() => setRetryKey((value) => value + 1)}>
            Retry documents
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <p role="status" className="mt-4 text-xs text-muted-foreground">
          Loading documents…
        </p>
      ) : error ? null : rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {offset > 0
            ? "No documents remain on this page. Use Previous to return to available documents."
            : Object.values(filters).some(Boolean)
            ? "No receiving documents match these filters. Clear or change the filters to see other documents."
            : "No receiving documents yet. Record a Production delivery from Awaiting Production Delivery above, or start a supplier or emergency receipt."}
        </p>
      ) : (
        <ul className="mt-3 max-h-[22rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {rows.map((report) => (
            <li key={report.id}>
              <button
                type="button"
                onClick={() => onSelect(report.id)}
                aria-current={selectedId === report.id ? "true" : undefined}
                className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-3 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:grid-cols-[minmax(7rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(6rem,0.8fr)] md:items-center ${selectedId === report.id ? "bg-amber-50 shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-muted/60"}`}
              >
                <span className="min-w-0 md:col-auto md:row-auto">
                  <span className="break-all font-mono font-bold">{report.rrNumber}</span>
                  {selectedId === report.id ? (
                    <span className="ml-2 inline-block rounded-full border border-current px-2 py-0.5 font-semibold">Viewing</span>
                  ) : null}
                </span>
                <span className="col-span-2 min-w-0 font-semibold md:col-auto md:row-auto">
                  {receivingDocumentLabels(report).source}
                </span>
                <span className="min-w-0 text-muted-foreground md:col-auto md:row-auto">
                  {manilaDateTime.format(new Date(report.receivedAt))}
                </span>
                <span className="text-right text-muted-foreground md:col-auto md:text-left">
                  {report.lineCount} line(s)
                </span>
                <span className={`col-start-2 row-start-1 rounded-full px-2 py-1 text-center font-bold md:col-auto md:row-auto ${report.status === "draft" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}>
                  {receivingDocumentLabels(report).status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!error && !isLoading && (hasMore || offset > 0) ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
          >
            Previous
          </Button>
          <span>Page {Math.floor(offset / PAGE_SIZE) + 1}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={!hasMore}
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}
