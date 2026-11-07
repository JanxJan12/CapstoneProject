import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  fetchClosedShiftHistory,
  type ClosedShiftSnapshot,
  type HistoryCursor,
} from "../api/closedShiftHistoryApi";
import { formatMoney } from "../constants";

const manilaDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

type ShiftFilters = { from: string; through: string; cashierId: string };
const emptyFilters: ShiftFilters = { from: "", through: "", cashierId: "" };

export function ClosedShiftHistory({
  manager = false,
  refreshKey = "",
}: {
  manager?: boolean;
  refreshKey?: string;
}) {
  const { session } = useAuth();
  const [draft, setDraft] = useState<ShiftFilters>(emptyFilters);
  const [filters, setFilters] = useState<ShiftFilters>(emptyFilters);
  const [cursor, setCursor] = useState<HistoryCursor>();
  const [pages, setPages] = useState<(HistoryCursor | undefined)[]>([]);
  const [rows, setRows] = useState<ClosedShiftSnapshot[]>([]);
  const [next, setNext] = useState<HistoryCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const canRead = Boolean(
    session?.id && session.role === (manager ? "manager" : "cashier"),
  );
  const hasFilters = Boolean(
    filters.from || filters.through || (manager && filters.cashierId),
  );

  useEffect(() => {
    let current = true;
    setRows([]);
    setNext(null);
    setSelected(null);
    setError("");
    setLoading(canRead);
    if (!canRead) {
      return () => {
        current = false;
      };
    }
    fetchClosedShiftHistory({
      from: filters.from || undefined,
      through: filters.through || undefined,
      cashierId: manager ? filters.cashierId.trim() || undefined : undefined,
      cursor,
    })
      .then((result) => {
        if (current) {
          setRows(result.rows);
          setNext(result.next);
        }
      })
      .catch(() => {
        if (current)
          setError(
            "Saved shifts could not be loaded. Check your access or connection, then retry.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    session?.id,
    session?.role,
    manager,
    filters,
    cursor,
    retry,
    refreshKey,
    canRead,
  ]);

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.from && draft.through && draft.from > draft.through) {
      setFilterError("Closed from must be on or before Through.");
      return;
    }
    setFilterError("");
    setPages([]);
    setCursor(undefined);
    setSelected(null);
    const nextFilters = {
      ...draft,
      cashierId: manager ? draft.cashierId.trim() : "",
    };
    if (
      nextFilters.from !== filters.from ||
      nextFilters.through !== filters.through ||
      nextFilters.cashierId !== filters.cashierId
    )
      setFilters(nextFilters);
  };
  const clearFilters = () => {
    setDraft(emptyFilters);
    setFilterError("");
    setPages([]);
    setCursor(undefined);
    setSelected(null);
    if (hasFilters) setFilters(emptyFilters);
  };
  const previous = () => {
    const earlier = pages.at(-1);
    setPages((value) => value.slice(0, -1));
    setCursor(earlier);
  };
  return (
    <section
      className="rrj-card min-w-0 p-4 sm:p-5"
      aria-label={
        manager ? "Manager shift history" : "Persisted closed shift history"
      }
    >
      <h2 className="text-lg font-bold">
        {manager ? "Shift Audit" : "Saved closed shifts"}
      </h2>

      {!manager && (  
      <p className="mt-1 text-xs text-muted-foreground">
        Settlement amounts are saved when a shift closes.
        Later transaction changes do not alter these recorded figures.
      </p>
    )}

      {manager && <p className="mt-1 text-sm text-muted-foreground">
        Saved cash settlement values at closure. Later receipt changes do not
        rewrite these figures.
      </p>}

      <form
        className={`grid gap-3 sm:grid-cols-2 xl:items-end ${manager ? "mt-5 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]" : "mt-3 xl:grid-cols-[repeat(2,minmax(0,1fr))_auto_auto]"}`}
        onSubmit={apply}
      >
        <label className="min-w-0 text-sm font-semibold">
          {manager ? "Closed from" : "From"}
          <input
            className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-input-background px-3 text-sm"
            type="date"
            value={draft.from}
            onChange={(event) =>
              setDraft({ ...draft, from: event.target.value })
            }
          />
        </label>
        <label className="min-w-0 text-sm font-semibold">
          {manager ? "Through" : "Through"}
          <input
            className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-input-background px-3 text-sm"
            type="date"
            value={draft.through}
            onChange={(event) =>
              setDraft({ ...draft, through: event.target.value })
            }
          />
        </label>
        {manager && (
          <label className="min-w-0 text-sm font-semibold sm:col-span-2 xl:col-span-1">
            Cashier ID (optional)
            <input
              className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-input-background px-3 text-sm"
              value={draft.cashierId}
              onChange={(event) =>
                setDraft({ ...draft, cashierId: event.target.value })
              }
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              title="Enter a complete cashier UUID"
              spellCheck={false}
              autoCapitalize="off"
            />
          </label>
        )}
        <button
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
          type="submit"
          disabled={!canRead || loading}
        >
          Apply filters
        </button>
        <button
          className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-50"
          type="button"
          onClick={clearFilters}
          disabled={
            !canRead ||
            (!hasFilters && !draft.from && !draft.through && !draft.cashierId)
          }
        >
          Clear
        </button>
      </form>
      {filterError && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {filterError}
        </p>
      )}
      {!canRead ? (
        <p className="mt-5 text-sm" role="alert">
          Shift history is available only to the authorized staff role.
        </p>
      ) : loading ? (
        <p className="mt-5 text-sm" role="status">
          Loading saved shifts…
        </p>
      ) : error ? (
        <div
          className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}{" "}
          <button
            className="ml-3 min-h-11 font-semibold underline"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div
          className="mt-5 rounded-lg border border-border p-4 text-sm text-muted-foreground"
          role="status"
        >
          {hasFilters
            ? "No saved closed shifts match these filters."
            : "No saved closed shifts are available."}
          {hasFilters && (
            <button
              className="ml-3 min-h-11 font-semibold text-foreground underline"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {manager ? <p className="text-xs text-muted-foreground">Page {pages.length + 1} · {rows.length} saved shift{rows.length === 1 ? "" : "s"} shown · newest closures first</p> : null}
          {rows.map((shift) => manager ? (
            <article
              key={shift.id}
              className="min-w-0 rounded-xl border border-border p-4 text-sm"
            >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold">
                  Closed {manilaDateTime(shift.endedAt)}
                </h3>

                <p className="mt-1 break-words text-muted-foreground">
                  Terminal: {shift.terminal || "Not recorded"}
                </p>

                <p className="break-all text-xs text-muted-foreground">
                  Shift ID: {shift.id}
                </p>

                <p className="break-all text-xs text-muted-foreground">
                  Cashier ID: {shift.cashierId}
                </p>
              </div>

              <button
                className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold"
                type="button"
                aria-expanded={selected === shift.id}
                aria-controls={
                  selected === shift.id
                    ? `shift-details-${shift.id}`
                    : undefined
                }
                onClick={() =>
                  setSelected(selected === shift.id ? null : shift.id)
                }
              >
                {selected === shift.id
                  ? "Hide details"
                  : "View saved details"}
              </button>
            </div>


              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Opening cash</dt>
                  <dd className="break-words font-semibold tabular-nums">
                    {formatMoney(shift.openingCash)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Expected cash</dt>
                  <dd className="break-words font-semibold tabular-nums">
                    {formatMoney(shift.expectedCash)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Actual cash</dt>
                  <dd className="break-words font-semibold tabular-nums">
                    {formatMoney(shift.actualCash)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Recorded variance</dt>
                  <dd className="break-words font-semibold tabular-nums">
                    {formatMoney(shift.variance)}
                  </dd>
                </div>
              </dl>
              {selected === shift.id && (
                <div
                  id={`shift-details-${shift.id}`}
                  className="mt-4 space-y-2 border-t border-border pt-3 text-sm"
                >
                  <p>Opened {manilaDateTime(shift.startedAt)}</p>
                  <p className="break-all">Closed by ID: {shift.closedBy}</p>
                  <p className="text-muted-foreground">
                    These are closure snapshots. Current completed receipts may
                    differ after later cancellation.
                  </p>
                </div>
              )}
            </article>
          ) : (
            <article key={shift.id} className="min-w-0 rounded-xl border border-border px-3 py-3 text-sm sm:px-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold">
                    {shift.terminal || "Terminal not recorded"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saved closed shift
                  </p>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Started</dt>
                <dd className="mt-0.5 text-sm font-semibold">
                  {manilaDateTime(shift.startedAt)}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Ended</dt>
                <dd className="mt-0.5 text-sm font-semibold">
                  {manilaDateTime(shift.endedAt)}
                </dd>
              </div>
            </dl>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2 text-xs sm:grid-cols-4">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Opening cash</dt>
                <dd className="break-words font-bold tabular-nums">
                  {formatMoney(shift.openingCash)}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-muted-foreground">Expected</dt>
                <dd className="break-words font-bold tabular-nums">
                  {formatMoney(shift.expectedCash)}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-muted-foreground">Counted</dt>
                <dd className="break-words font-bold tabular-nums">
                  {formatMoney(shift.actualCash)}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-muted-foreground">Variance</dt>
                <dd className={`break-words font-bold tabular-nums ${
                  shift.variance === 0 ? "" : "text-red-700"
                }`}>
                  {formatMoney(shift.variance)}
                </dd>
              </div>
            </dl>

            </article>
          ))}
        </div>
      )}
      {canRead &&
        !loading &&
        !error &&
        (rows.length > 0 || pages.length > 0) && (
          <nav
            className="mt-5 flex flex-wrap items-center gap-3"
            aria-label="Shift history pages"
          >
            <button
              className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-40"
              type="button"
              disabled={pages.length === 0}
              onClick={previous}
            >
              Previous page
            </button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              Page {pages.length + 1}
            </span>
            <button
              className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-40"
              type="button"
              disabled={!next}
              onClick={() => {
                setPages((value) => [...value, cursor]);
                setCursor(next ?? undefined);
              }}
            >
              Next page
            </button>
          </nav>
        )}
    </section>
  );
}
