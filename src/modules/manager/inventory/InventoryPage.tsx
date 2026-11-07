import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/common/Button";
import {
  getManagerStockSummary,
  getManagerStockMovements,
  type ManagerInventoryStock,
  type ManagerStockMovement,
} from "./inventoryApi";
import type { InventoryWorkspacePage } from "./InventoryWorkspaceNav";
import { formatInventoryQuantity } from "./inventoryMutationUi";
import { manilaDate, manilaDateTime, movementLabel, stockStatus } from "./StockPresentation";
import {
  getInventoryRequestRegister,
  getRequestProposal,
  type InventoryRequest,
  type RequestProposalItem,
} from "./inventoryRequestApi";
import {
  getReceivingDocuments,
  type ReceivingReportSummary,
} from "./receivingApi";
import { attentionItems } from "./inventoryOverview";
import { suggestedRequestQuantity } from "./requestQuantity";

type ReadState<T> =
  | { status: "loading"; rows: T[] }
  | { status: "ready"; rows: T[] }
  | { status: "error"; rows: T[]; message: string };

type StockFilter =
  | "all"
  | "attention"
  | "out"
  | "low"
  | "expired"
  | "outstanding"
  | "active"
  | "production";
const stockFilters: StockFilter[] = [
  "all",
  "attention",
  "out",
  "low",
  "expired",
  "outstanding",
  "active",
  "production",
];
const overviewQuery = () =>
  new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  );
const suggestedGap = suggestedRequestQuantity;

export function StockOverviewFilters({
  search,
  onSearch,
  category,
  onCategory,
  categories,
  filter,
  onFilter,
  hasActiveFilters,
  onReset,
}: {
  search: string;
  onSearch: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  categories: string[];
  filter: StockFilter;
  onFilter: (value: StockFilter) => void;
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
      <label className="min-w-0 text-xs font-semibold">
        Search inventory
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Item, category, or unit"
          className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>
      <label className="min-w-0 text-xs font-semibold">
        Category
        <select
          value={category}
          onChange={(event) => onCategory(event.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">All categories</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 text-xs font-semibold">
        Stock view
        <select
          value={filter}
          onChange={(event) => onFilter(event.target.value as StockFilter)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="all">All stock</option>
          <option value="attention">Needs attention</option>
          <option value="out">Usable out of stock</option>
          <option value="low">Low usable stock</option>
          <option value="expired">Has expired stock</option>
          <option value="outstanding">Requests outstanding</option>
          <option value="active">Active items</option>
          <option value="production">Production eligible</option>
        </select>
      </label>
    </div>
    {hasActiveFilters && (
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary underline underline-offset-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Reset filters
        </button>
      </div>
    )}
  </div>
  );
}

export function StockOverviewCard({
  stock,
  proposal,
  proposalLoaded = true,
  existingRequests = [],
  onOpen,
  onOpenRequest,
  onPrepareRequest,
}: {
  stock: ManagerInventoryStock;
  proposal?: RequestProposalItem;
  proposalLoaded?: boolean;
  existingRequests?: InventoryRequest[];
  onOpen: () => void;
  onOpenRequest?: (requestId: string) => void;
  onPrepareRequest?: () => void;
}) {
  const newGap = proposal ? suggestedGap(proposal) : null;
  const hasAttention =
    (stock.isActive && stock.usableQuantity <= stock.reorderLevel) ||
    stock.expiredQuantity > 0;
  return (
    <article
      className={`manager-stock-row min-w-0 px-4 py-3 ${hasAttention ? "has-attention" : ""}`}
    >
      <div className="min-w-0">
        <h2 className="break-words text-base font-extrabold">
          {stock.itemName}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {stock.category ?? "Uncategorized"}
        </p>
        <span
          className={`manager-stock-status mt-2 ${hasAttention ? "is-attention" : ""}`}
        >
          {stockStatus(stock)}
        </span>
      </div>
      <dl className="manager-stock-quantities mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Usable now</dt>
          <dd className="font-bold tabular-nums">
            {formatInventoryQuantity(stock.usableQuantity, stock.unit)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Physical on hand</dt>
          <dd className="font-bold tabular-nums">
            {formatInventoryQuantity(stock.physicalQuantity, stock.unit)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recorded minimum</dt>
          <dd className="font-bold tabular-nums">
            {formatInventoryQuantity(stock.reorderLevel, stock.unit)}
          </dd>
        </div>
      </dl>
      {stock.expiredQuantity > 0 ? (
        <p className="mt-2 text-xs font-semibold text-amber-800">
          {formatInventoryQuantity(stock.expiredQuantity, stock.unit)} expired
          on hand
        </p>
      ) : null}
      {proposal || stock.nearestUseBy ? (
        <details className="manager-stock-proposal mt-3 min-w-0 text-xs">
          <summary className="min-h-11 cursor-pointer py-3 font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {proposal ? "Request guidance" : "Use-by details"}
          </summary>
          <div className="space-y-1 border-t border-border pt-2 text-muted-foreground">
            <p>
              {!stock.isActive
                ? "Inactive"
                : proposal
                  ? "Production eligible"
                  : proposalLoaded
                    ? "Not Production eligible"
                    : "Production eligibility unavailable"}
            </p>
            {proposal ? (
              <>
                <p>
                  Provisional minimum{" "}
                  {formatInventoryQuantity(proposal.reorder_level, stock.unit)}
                </p>
                <p>
                  Valid at request need{" "}
                  {proposal.expiry_verified
                    ? formatInventoryQuantity(
                        proposal.valid_at_need,
                        stock.unit,
                      )
                    : "unverified expiry"}
                </p>
                <p>
                  Open request, not on hand{" "}
                  {formatInventoryQuantity(proposal.outstanding, stock.unit)}
                </p>
                <p className="font-semibold text-foreground">
                  Suggested new request{" "}
                  {formatInventoryQuantity(newGap ?? 0, stock.unit)}
                </p>
                {hasAttention && newGap === 0 && proposal.outstanding > 0 ? (
                  <p className="font-semibold text-amber-800">
                    Still needs attention; open request covers the provisional
                    gap.
                  </p>
                ) : null}
              </>
            ) : null}
            {stock.nearestUseBy ? (
              <p>
                Use by{" "}
                {manilaDate.format(new Date(`${stock.nearestUseBy}T00:00:00Z`))}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
      <div className="manager-stock-action mt-3 flex flex-wrap items-center gap-2">
        <Button size="md" variant="secondary" onClick={onOpen}>
          View stock<span className="sr-only"> for {stock.itemName}</span>
        </Button>
        {stock.isActive &&
        proposalLoaded &&
        newGap !== null &&
        newGap > 0 &&
        onPrepareRequest ? (
          <Button size="md" onClick={onPrepareRequest}>
            Prepare Request
            <span className="sr-only"> for {stock.itemName}</span>
          </Button>
        ) : null}
        <ExistingRequestLinks
          requests={existingRequests}
          onOpenRequest={onOpenRequest}
        />
      </div>
    </article>
  );
}

function ExistingRequestLinks({
  requests,
  onOpenRequest,
}: {
  requests: InventoryRequest[];
  onOpenRequest?: (requestId: string) => void;
}) {
  if (!onOpenRequest || requests.length === 0) return null;
  if (requests.length === 1) {
    const request = requests[0];
    return (
      <button
        type="button"
        className="min-h-11 max-w-full break-all text-left text-xs font-bold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => onOpenRequest(request.id)}
      >
        Open {request.number} · Rev {request.revision}
      </button>
    );
  }
  return (
    <details className="text-left text-xs">
      <summary className="min-h-11 cursor-pointer py-3 font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {requests.length} existing formal requests
      </summary>
      <ul className="space-y-1">
        {requests.map((request) => (
          <li key={request.id}>
            <button
              type="button"
              className="min-h-11 max-w-full break-all text-left font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => onOpenRequest(request.id)}
            >
              Open {request.number} · Rev {request.revision}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function InventoryPage({
  onNavigate,
  onOpenItem,
  onPrepareItem,
  onOpenRequest,
  onOpenReceivingReport,
  onOpenReceiptReference,
}: {
  onNavigate: (page: InventoryWorkspacePage) => void;
  onOpenItem: (itemId: string) => void;
  onPrepareItem?: (itemId: string) => void;
  onOpenRequest?: (requestId: string) => void;
  onOpenReceivingReport: (reportId: string) => void;
  onOpenReceiptReference?: (receiptNumber: string) => void;
}) {
  const [stockRead, setStockRead] = useState<ReadState<ManagerInventoryStock>>({
    status: "loading",
    rows: [],
  });
  const [proposalRead, setProposalRead] = useState<
    ReadState<RequestProposalItem>
  >({ status: "loading", rows: [] });
  const [requestRead, setRequestRead] = useState<ReadState<InventoryRequest>>({
    status: "loading",
    rows: [],
  });
  const [receivingRead, setReceivingRead] = useState<
    ReadState<ReceivingReportSummary>
  >({ status: "loading", rows: [] });
  const [recentPostedRead, setRecentPostedRead] = useState<ReadState<ReceivingReportSummary>>({ status: "loading", rows: [] });
  const [recentMovementRead, setRecentMovementRead] = useState<ReadState<ManagerStockMovement>>({ status: "loading", rows: [] });
  const [asOf, setAsOf] = useState("");
  const loadVersion = useRef(0);
  const refreshInFlight = useRef(false);
  const readGate = useRef({ stock: false, proposal: false, receiving: false });
  const stockResultsRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState(
    () => overviewQuery().get("stockSearch") ?? "",
  );
  const [category, setCategory] = useState(
    () => overviewQuery().get("stockCategory") ?? "",
  );
  const [filter, setFilter] = useState<StockFilter>(() => {
    const value = overviewQuery().get("stockFilter") as StockFilter | null;
    return value && stockFilters.includes(value) ? value : "all";
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    if (search) url.searchParams.set("stockSearch", search);
    else url.searchParams.delete("stockSearch");
    if (category) url.searchParams.set("stockCategory", category);
    else url.searchParams.delete("stockCategory");
    if (filter !== "all") url.searchParams.set("stockFilter", filter);
    else url.searchParams.delete("stockFilter");
    window.history.replaceState(window.history.state, "", url);
  }, [search, category, filter]);
  const load = useCallback(() => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const version = ++loadVersion.current;
    setRecentPostedRead({ status: "loading", rows: [] });
    setRecentMovementRead({ status: "loading", rows: [] });
    void getReceivingDocuments({ status: "posted" }, 0, 3).then((page) => {
      if (version === loadVersion.current) setRecentPostedRead({ status: "ready", rows: page.rows });
    }).catch(() => {
      if (version === loadVersion.current) setRecentPostedRead({ status: "error", rows: [], message: "Recent posted receipts are unavailable." });
    });
    void getManagerStockMovements({}, null, 3).then((page) => {
      if (version === loadVersion.current) setRecentMovementRead({ status: "ready", rows: page.rows });
    }).catch(() => {
      if (version === loadVersion.current) setRecentMovementRead({ status: "error", rows: [], message: "Recent stock movements are unavailable." });
    });
    let remaining = 4;
    const finished = () => {
      remaining -= 1;
      if (remaining === 0 && version === loadVersion.current)
        refreshInFlight.current = false;
    };
    readGate.current = { stock: false, proposal: false, receiving: false };
    setStockRead({ status: "loading", rows: [] });
    setProposalRead({ status: "loading", rows: [] });
    setRequestRead({ status: "loading", rows: [] });
    setReceivingRead({ status: "loading", rows: [] });
    setAsOf("");
    const neededAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    void getManagerStockSummary().then(
      (rows) => {
        finished();
        if (version !== loadVersion.current) return;
        readGate.current.stock = true;
        setStockRead({ status: "ready", rows });
        setAsOf(
          new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date()),
        );
      },
      (caught: unknown) => {
        finished();
        if (version !== loadVersion.current) return;
        setStockRead({
          status: "error",
          rows: [],
          message:
            caught instanceof Error ? caught.message : "Unable to load stock.",
        });
      },
    );
    void getRequestProposal(neededAt)
      .then(
        (rows) => {
          finished();
          if (version === loadVersion.current) {
            readGate.current.proposal = true;
            setProposalRead({ status: "ready", rows });
          }
        },
        (caught: unknown) => {
          finished();
          if (version === loadVersion.current) {
            if (import.meta.env.DEV)
              console.error("Stock request guidance read failed", caught);
            setProposalRead({
              status: "error",
              rows: [],
              message:
                "Stock quantities remain available; try again for request guidance.",
            });
          }
        },
      );
    void getInventoryRequestRegister().then(
      (rows) => {
        finished();
        if (version === loadVersion.current)
          setRequestRead({ status: "ready", rows });
      },
      (caught: unknown) => {
        finished();
        if (version === loadVersion.current) {
          if (import.meta.env.DEV)
            console.error("Formal request links read failed", caught);
          setRequestRead({
            status: "error",
            rows: [],
            message: "Try again to view linked requests.",
          });
        }
      },
    );
    void getReceivingDocuments({ status: "draft" }, 0, 5)
      .then((page) => {
        if (page.rows.some((report) => report.status !== "draft"))
          throw new Error("The server returned a non-draft Receiving report.");
        return page;
      })
      .then(
        (page) => {
          finished();
          if (version === loadVersion.current) {
            readGate.current.receiving = true;
            setReceivingRead({ status: "ready", rows: page.rows });
          }
        },
        (caught: unknown) => {
          finished();
          if (version === loadVersion.current)
            setReceivingRead({
              status: "error",
              rows: [],
              message:
                caught instanceof Error
                  ? caught.message
                  : "Unable to load Receiving drafts.",
            });
        },
      );
  }, []);
  useEffect(() => {
    load();
    return () => {
      loadVersion.current += 1;
      refreshInFlight.current = false;
    };
  }, [load]);

  const stocks = stockRead.rows;
  const proposals = proposalRead.rows;
  const stockReady = stockRead.status === "ready";
  const proposalReady = proposalRead.status === "ready";
  const isLoading = stockRead.status === "loading";
  const isRefreshing =
    isLoading ||
    proposalRead.status === "loading" ||
    requestRead.status === "loading" ||
    receivingRead.status === "loading";
  const error = stockRead.status === "error" ? stockRead.message : "";
  const attentionRows = useMemo(() => attentionItems(stocks), [stocks]);
  const proposalById = useMemo(
    () => new Map(proposals.map((row) => [row.id, row])),
    [proposals],
  );
  const requestsByItem = useMemo(() => {
    const byItem = new Map<string, InventoryRequest[]>();
    if (requestRead.status !== "ready") return byItem;
    for (const request of requestRead.rows) {
      if (
        request.status !== "issued" &&
        request.status !== "partially_received"
      )
        continue;
      for (const line of request.lines) {
        if (line.remaining <= 0) continue;
        const matches = byItem.get(line.inventory_item_id) ?? [];
        if (!matches.some((match) => match.id === request.id))
          matches.push(request);
        byItem.set(line.inventory_item_id, matches);
      }
    }
    return byItem;
  }, [requestRead]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          stocks
            .map((stock) => stock.category)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [stocks],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return stocks
      .filter((stock) => {
        if (
          query &&
          !`${stock.itemName} ${stock.category ?? ""} ${stock.unit}`
            .toLocaleLowerCase()
            .includes(query)
        )
          return false;
        if (category && stock.category !== category) return false;
        if (filter === "out" && (!stock.isActive || stock.usableQuantity > 0))
          return false;
        if (
          filter === "low" &&
          (!stock.isActive ||
            stock.usableQuantity <= 0 ||
            stock.usableQuantity > stock.reorderLevel)
        )
          return false;
        if (filter === "expired" && stock.expiredQuantity <= 0) return false;
        if (
          filter === "outstanding" &&
          !((proposalById.get(stock.id)?.outstanding ?? 0) > 0)
        )
          return false;
        if (filter === "active" && !stock.isActive) return false;
        if (filter === "production" && !proposalById.has(stock.id))
          return false;
        if (
          filter === "attention" &&
          !(
            (stock.isActive && stock.usableQuantity <= stock.reorderLevel) ||
            stock.expiredQuantity > 0
          )
        )
          return false;
        return true;
      })
      .sort((left, right) => {
        const priority = (stock: ManagerInventoryStock) =>
          !stock.isActive
            ? stock.expiredQuantity > 0
              ? 2
              : 3
            : stock.usableQuantity <= 0
              ? 0
              : stock.usableQuantity <= stock.reorderLevel
                ? 1
                : 2;
        return (
          priority(left) - priority(right) ||
          left.itemName.localeCompare(right.itemName)
        );
      });
  }, [stocks, proposalById, search, category, filter]);

  const active = stocks.filter((stock) => stock.isActive);
  const out = active.filter((stock) => stock.usableQuantity <= 0).length;
  const low = active.filter(
    (stock) =>
      stock.usableQuantity > 0 && stock.usableQuantity <= stock.reorderLevel,
  ).length;
  const expired = stocks.filter((stock) => stock.expiredQuantity > 0).length;
  const attention = attentionRows.length;

  const showStockView = (next: StockFilter) => {
    if (!readGate.current.stock) return;
    setSearch("");
    setCategory("");
    setFilter(next);
    stockResultsRef.current?.scrollIntoView({ block: "start" });
  };
  const openItem = (itemId: string) => {
    if (readGate.current.stock) onOpenItem(itemId);
  };
  const openReceivingReport = (reportId: string) => {
    if (readGate.current.receiving) onOpenReceivingReport(reportId);
  };
  const prepareItem = (itemId: string) => {
    if (!readGate.current.stock || !readGate.current.proposal) return;
    const proposal = proposalById.get(itemId);
    if (!proposal || suggestedGap(proposal) <= 0) return;
    if (onPrepareItem) onPrepareItem(itemId);
    else onNavigate("replenishment");
  };

  return (
    <div className="inventory-workspace-page max-w-7xl">
      <header className="manager-page-header mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="manager-page-context">Inventory / Overview & stock</p>
          <h1>Stock Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor recorded inventory and stock availability.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {asOf
              ? `Last stock read: ${asOf}`
              : "No successful stock read yet"}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            size="md"
            variant="secondary"
            className="whitespace-normal!"
            disabled={isRefreshing}
            onClick={() => void load()}
          >
            Refresh
          </Button>
          <Button
            size="md"
            className="whitespace-normal!"
            onClick={() => onNavigate("replenishment")}
          >
            Prepare Request
          </Button>
          <Button
            size="md"
            variant="secondary"
            className="whitespace-normal!"
            onClick={() => onNavigate("stock-receiving")}
          >
            Open Receiving
          </Button>
        </div>
      </header>
      {requestRead.status === "loading" && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          Checking existing formal requests…
        </p>
      )}
      {requestRead.status === "error" && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        >
          Existing formal request links are unavailable. {requestRead.message}{" "}
          <button
            type="button"
            className="font-bold underline"
            disabled={isRefreshing}
            onClick={load}
          >
            Try again
          </button>
        </p>
      )}
      <section
        aria-label="Stock attention"
        className="manager-stock-summary mb-3 grid grid-cols-2 gap-2 md:grid-cols-4"
      >
        {(
          [
            { label: "Needs attention", count: attention, view: "attention" },
            { label: "Usable out", count: out, view: "out" },
            { label: "Low usable", count: low, view: "low" },
            { label: "Has expired", count: expired, view: "expired" },
          ] satisfies Array<{ label: string; count: number; view: StockFilter }>
        ).map(({ label, count, view }) => (
          <button
            key={label}
            type="button"
            disabled={!stockReady}
            aria-pressed={filter === view}
            className={`manager-stock-summary-card min-h-20 rounded-xl border border-border bg-card px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed ${filter === view ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}
            onClick={() => showStockView(view)}
          >
            <span className="block text-xs font-semibold text-foreground">
              {label}
            </span>
            <strong className="mt-1 block text-xl font-extrabold tabular-nums text-foreground">
              {isLoading || error ? "—" : count}
            </strong>
            <span className="sr-only"> items. Filter inventory list.</span>
          </button>
        ))}
      </section>
      <p className="mb-3 text-xs text-muted-foreground">
        Counts are items and may overlap. On-hand stock is recorded, not a
        verified count; requests and unposted receipts do not add stock.
      </p>
      {receivingRead.status === "loading" ? (
        <p role="status" className="mb-3 text-xs text-muted-foreground">
          Checking Receiving drafts…
        </p>
      ) : receivingRead.status === "error" ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        >
          <span>
            Receiving draft status is unavailable. Recorded stock is still
            shown.
          </span>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={load}
            className="min-h-11 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            Retry draft check
          </button>
        </div>
      ) : receivingRead.rows.length > 0 ? (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        >
          <span className="font-semibold">
            Unposted Receiving{" "}
            {receivingRead.rows.length === 1 ? "draft needs" : "drafts need"}{" "}
            review.
          </span>
          <button
            type="button"
            onClick={() => openReceivingReport(receivingRead.rows[0].id)}
            className="min-h-11 break-all text-left font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Review {receivingRead.rows[0].rrNumber}
          </button>
          {receivingRead.rows.length > 1 ? (
            <button
              type="button"
              onClick={() => onNavigate("stock-receiving")}
              className="min-h-11 text-left font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View all drafts
            </button>
          ) : null}
        </div>
      ) : null}
      <section aria-labelledby="recent-stock-activity-heading" className="mb-4 grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="recent-stock-activity-heading" className="text-sm font-bold">Recent Receiving</h2>
            <Button size="sm" variant="secondary" onClick={() => onNavigate("stock-receiving")}>All receipts</Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Posted receipts only. Drafts above have no stock effect.</p>
          {recentPostedRead.status === "loading" ? <p role="status" className="mt-2 text-xs">Loading recent receipts…</p>
            : recentPostedRead.status === "error" ? <p role="alert" className="mt-2 text-xs text-amber-900">{recentPostedRead.message}</p>
            : recentPostedRead.rows.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No recent posted receipts returned.</p>
            : <ul className="mt-2 divide-y divide-border">{recentPostedRead.rows.map((receipt) => <li key={receipt.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-1 text-xs">
              <button type="button" onClick={() => openReceivingReport(receipt.id)} className="min-h-11 break-all text-left font-bold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{receipt.rrNumber}</button>
              <span className="text-muted-foreground">Posted · {receipt.postedAt ? `${manilaDateTime.format(new Date(receipt.postedAt))}` : "time not recorded"}</span>
            </li>)}</ul>}
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Recent stock movements</h2>
            <Button size="sm" variant="secondary" onClick={() => onNavigate("inv-transactions")}>All movements</Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Latest recorded changes from the inventory ledger.</p>
          {recentMovementRead.status === "loading" ? <p role="status" className="mt-2 text-xs">Loading recent movements…</p>
            : recentMovementRead.status === "error" ? <p role="alert" className="mt-2 text-xs text-amber-900">{recentMovementRead.message}</p>
            : recentMovementRead.rows.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No recent movements returned.</p>
            : <ul className="mt-2 divide-y divide-border">{recentMovementRead.rows.map((movement) => <li key={movement.id} className="min-w-0 py-2 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="break-words font-semibold">{movement.itemName} · {movementLabel(movement.transactionType)}</span>
                <strong className="whitespace-nowrap tabular-nums">{movement.quantityChange > 0 ? "+" : ""}{formatInventoryQuantity(movement.quantityChange, movement.unit)}</strong>
              </div>
              <p className="mt-1 text-muted-foreground">{manilaDateTime.format(new Date(movement.createdAt))}</p>
              {movement.referenceLabel ? <p className="mt-1 break-all">Reference: {movement.referenceLabel}{movement.transactionType === "receiving" && onOpenReceiptReference ? <button type="button" onClick={() => onOpenReceiptReference(movement.referenceLabel!)} className="ml-2 min-h-11 font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Open receipt</button> : null}</p> : null}
            </li>)}</ul>}
        </div>
      </section>
      <section
        ref={stockResultsRef}
        aria-label="Inventory items"
        className="min-w-0"
      >
        <div className="mb-3">
          <h2 className="text-lg font-bold">Inventory items</h2>
        </div>
        <StockOverviewFilters
          search={search}
          onSearch={setSearch}
          category={category}
          onCategory={setCategory}
          categories={categories}
          filter={filter}
          onFilter={setFilter}
          hasActiveFilters={Boolean(search || category || filter !== "all")}
          onReset={() => {
            setSearch("");
            setCategory("");
            setFilter("all");
          }}
        />
        {proposalRead.status === "error" && !error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          >
            Request guidance is unavailable. Recorded stock quantities are still
            shown. Retry with Refresh.
          </p>
        ) : null}
        {!isLoading &&
          !error &&
          (proposalReady ||
            (filter !== "outstanding" && filter !== "production")) && (
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <span>
                {visible.length.toLocaleString("en-PH")} of{" "}
                {stocks.length.toLocaleString("en-PH")} stock items shown
              </span>

            </div>
          )}
        {isLoading ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-border bg-card p-6"
          >
            Loading inventory…
          </p>
        ) : error ? (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <span>{error}</span>
            <Button
              size="md"
              variant="secondary"
              disabled={isRefreshing}
              onClick={() => void load()}
            >
              Try Again
            </Button>
          </div>
        ) : !proposalReady &&
          (filter === "outstanding" || filter === "production") ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950"
          >
            This stock view needs the request proposal, which is{" "}
            {proposalRead.status === "loading"
              ? "still loading"
              : "unavailable"}
            . Try again before interpreting an empty result.
          </p>
        ) : stocks.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-card p-6">
            No stock records were returned. Stock availability is unverified;
            check the inventory source.
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-card p-6">
            No inventory items match these filters.
          </p>
        ) : (
          <section
            aria-label="Inventory stock levels"
            className="manager-stock-list mt-3 overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="hidden overflow-x-auto xl:block">
              <table className="manager-stock-table w-full text-left">
                <caption className="sr-only">
                  Reported stock, request guidance, and item actions
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Physical</th>
                    <th scope="col">Usable</th>
                    <th scope="col">Recorded minimum</th>
                    <th scope="col">
                      Pending request{" "}
                      <span className="block font-medium normal-case tracking-normal">
                        Not on hand
                      </span>
                    </th>
                    <th scope="col">Stock status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((stock) => {
                    const proposal = proposalById.get(stock.id);
                    const hasAttention =
                      (stock.isActive &&
                        stock.usableQuantity <= stock.reorderLevel) ||
                      stock.expiredQuantity > 0;
                    const newGap = proposal ? suggestedGap(proposal) : null;
                    return (
                      <tr
                        key={stock.id}
                        className={hasAttention ? "has-attention" : ""}
                      >
                        <th scope="row">
                          <span className="block font-bold text-foreground">
                            {stock.itemName}
                          </span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {stock.category ?? "Uncategorized"}
                          </span>
                        </th>
                        <td className="tabular-nums">
                          {formatInventoryQuantity(
                            stock.physicalQuantity,
                            stock.unit,
                          )}
                        </td>
                        <td className="font-bold tabular-nums">
                          {formatInventoryQuantity(
                            stock.usableQuantity,
                            stock.unit,
                          )}
                        </td>
                        <td className="tabular-nums">
                          {formatInventoryQuantity(
                            stock.reorderLevel,
                            stock.unit,
                          )}
                        </td>
                        <td>
                          {proposal ? (
                            <span className="block font-bold tabular-nums">
                              {formatInventoryQuantity(
                                proposal.outstanding,
                                stock.unit,
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {proposalReady
                                ? "Not in proposal"
                                : "Unavailable"}
                            </span>
                          )}
                          <ExistingRequestLinks
                            requests={requestsByItem.get(stock.id) ?? []}
                            onOpenRequest={onOpenRequest}
                          />
                        </td>
                        <td>
                          <span
                            className={`manager-stock-status ${hasAttention ? "is-attention" : ""}`}
                          >
                            {stockStatus(stock)}
                          </span>
                          {stock.expiredQuantity > 0 && (
                            <span className="mt-1 block text-xs font-semibold text-amber-800">
                              {formatInventoryQuantity(
                                stock.expiredQuantity,
                                stock.unit,
                              )}{" "}
                              expired on hand
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex flex-col items-start">
                            <button
                              type="button"
                              className="min-h-11 text-left text-xs font-bold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              onClick={() => openItem(stock.id)}
                            >
                              View details
                              <span className="sr-only">
                                {" "}
                                for {stock.itemName}
                              </span>
                            </button>
                            {stock.isActive &&
                              proposalReady &&
                              newGap !== null &&
                              newGap > 0 && (
                                <button
                                  type="button"
                                  className="min-h-11 text-left text-xs font-bold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  onClick={() => prepareItem(stock.id)}
                                >
                                  Prepare Request
                                  <span className="sr-only">
                                    {" "}
                                    for {stock.itemName}
                                  </span>
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border xl:hidden">
              {visible.map((stock) => (
                <StockOverviewCard
                  key={stock.id}
                  stock={stock}
                  proposal={proposalById.get(stock.id)}
                  proposalLoaded={proposalReady}
                  existingRequests={requestsByItem.get(stock.id) ?? []}
                  onOpen={() => openItem(stock.id)}
                  onOpenRequest={onOpenRequest}
                  onPrepareRequest={() => prepareItem(stock.id)}
                />
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
