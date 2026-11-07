import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/common/Button";
import {
  getManagerStockMovements,
  getManagerStockSummary,
  type InventoryTransactionType,
  type ManagerInventoryStock,
  type ManagerStockMovement,
  type StockMovementPage,
} from "./inventoryApi";
import { StockMovementList } from "./StockMovementList";
import {
  appendMovementPage,
  claimMovementPageLoad,
  releaseMovementPageLoad,
} from "./movementPage";

const TYPES: Array<[InventoryTransactionType, string]> = [
  ["receiving", "Receiving"],
  ["restock", "Restock"],
  ["issuance", "Sale / Issuance"],
  ["waste", "Waste"],
  ["adjustment", "Adjustment"],
  ["opening_balance", "Opening Balance"],
];

export function InvTransactionsPage({
  initialItemId = "",
  initialReceiptReference = "",
  onBackToItem,
  onOpenReceipt,
}: {
  initialItemId?: string;
  initialReceiptReference?: string;
  onBackToItem?: () => void;
  onOpenReceipt?: (reference: string) => void;
}) {
  const [items, setItems] = useState<ManagerInventoryStock[]>([]);
  const [itemId, setItemId] = useState(initialItemId);
  const [type, setType] = useState<InventoryTransactionType | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [receiptReference, setReceiptReference] = useState(initialReceiptReference);
  const [receiptMatches, setReceiptMatches] = useState<ManagerStockMovement[] | null>(null);
  const [receiptScanStatus, setReceiptScanStatus] = useState<"idle" | "searching" | "complete" | "error">("idle");
  const [receiptScanMessage, setReceiptScanMessage] = useState("");
  const receiptScanVersion = useRef(0);
  const [rows, setRows] = useState<ManagerStockMovement[]>([]);
  const [cursor, setCursor] = useState<StockMovementPage["nextCursor"]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const firstInFlight = useRef(false);
  const moreInFlightVersion = useRef<number | null>(null);
  const rowsRef = useRef<ManagerStockMovement[]>([]);
  const cursorRef = useRef<StockMovementPage["nextCursor"]>(null);
  const filters = { itemId, type, fromDate, toDate };
  const searchTerm = search.trim().toLocaleLowerCase();
  const hasServerFilters = Boolean(
    itemId !== initialItemId || type || fromDate || toDate,
  );
  const displayedRows = receiptMatches ?? rows;
  const visibleRows = displayedRows.filter((row) =>
    (!receiptReference || (row.transactionType === "receiving" && row.referenceLabel?.toLocaleLowerCase() === receiptReference.trim().toLocaleLowerCase())) && [
      row.itemName,
      row.referenceLabel,
      row.reason,
      row.performedByName,
      ...row.batches.map((batch) => batch.batchCode),
    ].some((value) => value?.toLocaleLowerCase().includes(searchTerm)),
  );

  useEffect(() => {
    let active = true;
    void getManagerStockSummary()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch(() => {
        /* Movement history remains usable without the item selector. */
      });
    return () => {
      active = false;
    };
  }, []);

  const loadFirst = useCallback(async () => {
    receiptScanVersion.current += 1;
    setReceiptMatches(null);
    setReceiptScanStatus("idle");
    setReceiptScanMessage("");
    const version = ++requestVersion.current;
    firstInFlight.current = true;
    moreInFlightVersion.current = null;
    setIsLoading(true);
    setIsLoadingMore(false);
    setError("");
    try {
      const page = await getManagerStockMovements({
        itemId,
        type,
        fromDate,
        toDate,
      });
      if (version !== requestVersion.current) return;
      const nextRows = appendMovementPage([], page.rows);
      rowsRef.current = nextRows;
      cursorRef.current = page.nextCursor;
      setRows(nextRows);
      setCursor(page.nextCursor);
    } catch (caught) {
      if (version !== requestVersion.current) return;
      rowsRef.current = [];
      cursorRef.current = null;
      setRows([]);
      setCursor(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load stock movements.",
      );
    } finally {
      if (version === requestVersion.current) {
        firstInFlight.current = false;
        setIsLoading(false);
      }
    }
  }, [itemId, type, fromDate, toDate]);
  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);
  useEffect(() => () => { receiptScanVersion.current += 1; }, []);

  const searchEntireReceiptHistory = async () => {
    const reference = receiptReference.trim().toLocaleLowerCase();
    if (!reference || receiptScanStatus === "searching") return;
    const version = ++receiptScanVersion.current;
    setReceiptMatches(null);
    setReceiptScanStatus("searching");
    setReceiptScanMessage("Searching receiving movements across server pages…");
    const matches: ManagerStockMovement[] = [];
    const ids = new Set<string>();
    let next: StockMovementPage["nextCursor"] = null;
    let scanned = 0;
    try {
      do {
        const page = await getManagerStockMovements({ itemId, type: "receiving", fromDate, toDate }, next, 100);
        if (version !== receiptScanVersion.current) return;
        for (const row of page.rows) {
          if (ids.has(row.id)) throw new Error("The server repeated a movement while searching. Refresh and try again.");
          ids.add(row.id);
          if (row.referenceLabel?.toLocaleLowerCase() === reference) matches.push(row);
        }
        scanned += page.rows.length;
        if (page.nextCursor && page.rows.length === 0) throw new Error("The server returned an empty movement page with more history pending.");
        next = page.nextCursor;
        setReceiptScanMessage(`Checked ${scanned} receiving movement${scanned === 1 ? "" : "s"}…`);
      } while (next);
      setReceiptMatches(matches);
      setReceiptScanStatus("complete");
      setReceiptScanMessage(`${matches.length} movement${matches.length === 1 ? "" : "s"} for ${receiptReference.trim()} across ${scanned} receiving movement${scanned === 1 ? "" : "s"} checked.`);
    } catch (caught) {
      if (version !== receiptScanVersion.current) return;
      setReceiptScanStatus("error");
      setReceiptScanMessage(caught instanceof Error ? caught.message : "Unable to finish the receipt search.");
    }
  };

  const loadMore = async () => {
    const activeCursor = cursorRef.current;
    if (!activeCursor || firstInFlight.current) return;
    const version = requestVersion.current;
    if (!claimMovementPageLoad(moreInFlightVersion, version)) return;
    setIsLoadingMore(true);
    setError("");
    try {
      const page = await getManagerStockMovements(filters, activeCursor);
      if (version !== requestVersion.current) return;
      const nextRows = appendMovementPage(rowsRef.current, page.rows);
      rowsRef.current = nextRows;
      cursorRef.current = page.nextCursor;
      setRows(nextRows);
      setCursor(page.nextCursor);
    } catch (caught) {
      if (version === requestVersion.current)
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load more movements.",
        );
    } finally {
      if (releaseMovementPageLoad(moreInFlightVersion, version)) {
        setIsLoadingMore(false);
      }
    }
  };

  const changeFilters = (change: () => void) => {
    receiptScanVersion.current += 1;
    setReceiptMatches(null);
    setReceiptScanStatus("idle");
    setReceiptScanMessage("");
    requestVersion.current += 1;
    firstInFlight.current = true;
    moreInFlightVersion.current = null;
    cursorRef.current = null;
    setIsLoading(true);
    setIsLoadingMore(false);
    change();
  };

  const clearFilters = () => {
    if (hasServerFilters) {
      changeFilters(() => {
        setItemId(initialItemId);
        setType("");
        setFromDate("");
        setToDate("");
      });
    }
    setSearch("");
    setReceiptReference("");
    receiptScanVersion.current += 1;
    setReceiptMatches(null);
    setReceiptScanStatus("idle");
    setReceiptScanMessage("");
  };

  return (
    <div className="inventory-workspace-page manager-support-page max-w-7xl [&_button]:min-h-11 [&_select]:min-h-11!">
      <header className="manager-page-header mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="manager-page-context">Inventory / Stock Movements</p>
          {onBackToItem ? (
            <button
              type="button"
              onClick={onBackToItem}
              className="mb-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              ← Item stock
            </button>
          ) : null}
          <h1>Stock Movements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded stock changes · newest first
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={isLoading}
          onClick={() => void loadFirst()}
        >
          Refresh
        </Button>
      </header>
      <section
        aria-label="Movement filters"
        className="manager-movement-filters grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <label className="block min-w-0 text-xs font-semibold sm:col-span-2">
          Search loaded movements
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Item, batch, reference, reason, or actor"
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="text-xs font-semibold">
          Item
          <select
            value={itemId}
            onChange={(event) => {
              if (event.target.value !== itemId)
                changeFilters(() => setItemId(event.target.value));
            }}
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">All items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Movement type
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as
                InventoryTransactionType | "";
              if (nextType !== type) changeFilters(() => setType(nextType));
            }}
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">All types</option>
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-xs font-semibold sm:col-span-2 xl:col-span-2">
          Receiving receipt number
          <input type="search" value={receiptReference} onChange={(event) => { receiptScanVersion.current += 1; setReceiptMatches(null); setReceiptScanStatus("idle"); setReceiptScanMessage(""); setReceiptReference(event.target.value); }}
            placeholder="Exact RR number in loaded movements"
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        {receiptReference.trim() ? <div className="flex items-end"><Button size="sm" variant="secondary" disabled={receiptScanStatus === "searching"} onClick={() => void searchEntireReceiptHistory()}>Search full receipt history</Button></div> : null}
        <label className="text-xs font-semibold">
          From date
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => {
              if (event.target.value !== fromDate)
                changeFilters(() => setFromDate(event.target.value));
            }}
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="text-xs font-semibold">
          To date
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => {
              if (event.target.value !== toDate)
                changeFilters(() => setToDate(event.target.value));
            }}
            className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        {hasServerFilters || search || receiptReference ? (
          <div className="flex items-end">
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              Reset filters
            </Button>
          </div>
        ) : null}
      </section>
      <p className="mt-2 text-xs text-muted-foreground">
        {receiptMatches ? "Full receipt search checked every available Receiving movement page for the selected item and dates." : "Search and receipt number check loaded rows only."}
        {cursor && !receiptMatches ? " Load more to check older movements." : null}
      </p>
      {receiptScanStatus !== "idle" ? <p role={receiptScanStatus === "error" ? "alert" : "status"} className="mt-2 text-xs text-muted-foreground">{receiptScanMessage}</p> : null}
      {!isLoading && (rows.length > 0 || !error) ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {searchTerm
            ? `${visibleRows.length} matches in ${displayedRows.length} ${receiptMatches ? "receipt movements" : "loaded movements"}`
            : `${displayedRows.length} movements loaded`}
          {cursor && !receiptMatches ? " · Older records available" : ""}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>{error}</span>
          {rows.length === 0 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadFirst()}
            >
              Retry movements
            </Button>
          ) : null}
        </div>
      ) : null}
      {isLoading ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-border bg-card p-6"
        >
          Loading stock movements…
        </p>
      ) : !error && visibleRows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6">
          {displayedRows.length === 0
            ? "No stock movements match these filters."
            : cursor && !receiptMatches
              ? "No loaded movements match this search. Older records may still match."
              : "No movements match this search within these filters."}
        </p>
      ) : visibleRows.length > 0 ? (
        <div className="mt-4">
          <StockMovementList rows={visibleRows} onOpenReceipt={onOpenReceipt} />
        </div>
      ) : null}
      {cursor && !isLoading && !receiptMatches ? (
        <div className="mt-4 flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoadingMore}
            onClick={() => void loadMore()}
          >
            {isLoadingMore ? "Loading…" : "Load more movements"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
