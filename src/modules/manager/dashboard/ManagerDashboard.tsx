import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
  Store,
  ArrowUpRight,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/components/common/Button";
import {
  getManagerDashboard,
  type ManagerDailySale,
  type ManagerDashboardData,
  type ManagerOrderStatus,
} from "../api/managerApi";
import {
  ManagerOrderStatusBadge,
  managerOrderNeedsAttention,
} from "../components/ManagerStatusBadge";
import { getManagerStockSummary } from "../inventory/inventoryApi";
import { countLowUsableStock } from "./usableStockAttention";

const STATUS_ORDER: ManagerOrderStatus[] = [
  "waiting_payment_verification",
  "waiting_for_rider",
  "rejected",
  "cancelled",
  "confirmed",
  "preparing",
  "ready",
  "rider_accepted",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "completed",
];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("Active manager access required") ||
    message.includes("Authentication required")
  )
    return "Manager access is required to view this dashboard.";
  return "The dashboard could not be refreshed. Check your connection or access, then retry.";
}

function isAccessFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Active manager access required") ||
    message.includes("Authentication required")
  );
}

function SparkAreaChart({ data }: { data: ManagerDailySale[] }) {
  if (data.length === 0 || data.every((entry) => entry.sales === 0)) {
    return (
      <div className="flex h-[116px] items-center justify-center text-sm text-muted-foreground">
        {data.length === 0
          ? "No daily sales data is available."
          : "No verified-payment revenue in this period."}
      </div>
    );
  }

  const width = 600;
  const height = 116;
  const paddingLeft = 52;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 24;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(1, ...data.map((entry) => entry.sales));
  const xCoordinates = data.map((_, index) =>
    data.length === 1
      ? paddingLeft + innerWidth / 2
      : paddingLeft + (index / (data.length - 1)) * innerWidth,
  );
  const yCoordinates = data.map(
    (entry) =>
      paddingTop + innerHeight - (entry.sales / maxValue) * innerHeight,
  );
  const linePath = xCoordinates
    .map(
      (coordinate, index) =>
        (index === 0 ? "M" : "L") + coordinate + "," + yCoordinates[index],
    )
    .join(" ");
  const areaPath =
    linePath +
    " L" +
    xCoordinates[xCoordinates.length - 1] +
    "," +
    (paddingTop + innerHeight) +
    " L" +
    xCoordinates[0] +
    "," +
    (paddingTop + innerHeight) +
    " Z";
  const ticks = [0, maxValue / 2, maxValue];

  return (
    <svg
      viewBox={"0 0 " + width + " " + height}
      width="100%"
      height={height}
      role="img"
      aria-label="Verified-payment revenue for the last seven fulfillment dates"
    >
      {[0, 0.5, 1].map((tick, index) => {
        const y = paddingTop + innerHeight - tick * innerHeight;

        return (
          <g key={tick}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={y}
              y2={y}
              stroke="#eadfd4"
              strokeDasharray="3 4"
            />
            <text
              x={paddingLeft - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={9}
              fill="#746153"
            >
              {currencyFormatter.format(ticks[index])}
            </text>
          </g>
        );
      })}
      {data.map((entry, index) => (
        <text
          key={entry.date}
          x={xCoordinates[index]}
          y={height - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#746153"
        >
          {entry.day}
        </text>
      ))}
      <path d={areaPath} fill="#b45309" fillOpacity={0.07} />
      <path
        d={linePath}
        fill="none"
        stroke="#b45309"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((entry, index) => (
        <circle
          key={entry.date}
          cx={xCoordinates[index]}
          cy={yCoordinates[index]}
          r={2.5}
          fill="#b45309"
        />
      ))}
    </svg>
  );
}

function AttentionCard({
  label,
  value,
  description,
  active,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  active: boolean;
  tone: "amber" | "red";
  icon: typeof CreditCard;
}) {
  const activeTone =
    tone === "red"
      ? "border-red-200 bg-red-50/70 text-red-700"
      : "border-amber-200 bg-amber-50/70 text-amber-800";

  return (
    <article
      className={
        "flex min-h-[88px] items-center gap-3 rounded-xl border p-3 " +
        (active ? activeTone : "border-border/80 bg-muted/25 text-foreground")
      }
    >
      <div
        className={
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl " +
          (active
            ? tone === "red"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
            : "bg-emerald-50 text-emerald-700")
        }
      >
        {active ? (
          <Icon className="h-5 w-5" />
        ) : (
          <CheckCircle2 className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-current/75">
          {label}
        </p>
        <p className="mt-1 font-['Manrope'] text-2xl font-extrabold leading-none text-current">
          {value}
        </p>
        <p className="mt-1.5 text-xs font-medium leading-4 text-current/75">
          {description}
        </p>
      </div>
    </article>
  );
}

export function ManagerDashboard({
  onNavigate,
}: {
  onNavigate?: (
    page:
      "inventory" | "orders" | "replenishment" | "stock-receiving" | "reports",
  ) => void;
}) {
  const { session, loading: authLoading } = useAuth();
  const [storedDashboard, setDashboard] = useState<ManagerDashboardData | null>(
    null,
  );
  const [loadedForSession, setLoadedForSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const requestVersion = useRef(0);
  const [stockCount, setStockCount] = useState<number | null>(null);
  const [stockItemCount, setStockItemCount] = useState<number | null>(null);
  const [stockLoadedForSession, setStockLoadedForSession] = useState<string | null>(null);
  const [stockLoadedAt, setStockLoadedAt] = useState<Date | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState(false);
  const stockRequestVersion = useRef(0);
  const stockInFlight = useRef(false);

  const loadStock = useCallback(async () => {
    if (stockInFlight.current) return;
    stockInFlight.current = true;
    const version = ++stockRequestVersion.current;
    setStockLoading(true);
    setStockError(false);
    try {
      const rows = await getManagerStockSummary();
      const count = countLowUsableStock(rows);
      if (version === stockRequestVersion.current) {
        setStockCount(count);
        setStockItemCount(rows.length);
        setStockLoadedForSession(session?.id ?? null);
        setStockLoadedAt(new Date());
      }
    } catch {
      if (version === stockRequestVersion.current) setStockError(true);
    } finally {
      if (version === stockRequestVersion.current) {
        stockInFlight.current = false;
        setStockLoading(false);
      }
    }
  }, [session?.id]);

  const loadDashboard = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const result = await getManagerDashboard();
      if (version === requestVersion.current) {
        setDashboard(result);
        setLoadedForSession(session?.id ?? null);
        setLoadedAt(new Date());
      }
    } catch (loadError) {
      if (version === requestVersion.current) {
        if (isAccessFailure(loadError)) {
          setDashboard(null);
          setLoadedForSession(null);
          setLoadedAt(null);
        }
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.id || session.role !== "manager") {
      requestVersion.current += 1;
      stockRequestVersion.current += 1;
      stockInFlight.current = false;
      setDashboard(null);
      setLoadedForSession(null);
      setLoadedAt(null);
      setError("Manager access is required to view this dashboard.");
      setLoading(false);
      setStockCount(null);
      setStockItemCount(null);
      setStockLoadedForSession(null);
      setStockLoadedAt(null);
      setStockLoading(false);
      setStockError(false);
      return;
    }
    setDashboard(null);
    setLoadedForSession(null);
    setLoadedAt(null);
    setStockCount(null);
    setStockItemCount(null);
    setStockLoadedForSession(null);
    setStockLoadedAt(null);
    void loadStock();
    void loadDashboard();
    return () => {
      requestVersion.current += 1;
      stockRequestVersion.current += 1;
      stockInFlight.current = false;
    };
  }, [authLoading, session?.id, session?.role, loadDashboard, loadStock]);

  const dashboard =
    !authLoading &&
    session?.role === "manager" &&
    session.id === loadedForSession
      ? storedDashboard
      : null;
  const usableCount =
    !authLoading &&
    session?.role === "manager" &&
    session.id === stockLoadedForSession
      ? stockCount
      : null;
  const refreshDashboard = () => {
    void loadDashboard();
    void loadStock();
  };
  const totalStatusCount =
    dashboard?.orderStatusCounts.reduce((sum, entry) => sum + entry.count, 0) ??
    0;
  const orderedStatusCounts = dashboard
    ? [...dashboard.orderStatusCounts].sort(
        (left, right) =>
          STATUS_ORDER.indexOf(left.status) -
          STATUS_ORDER.indexOf(right.status),
      )
    : [];
  const today = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date());
  const greeting = session?.name?.trim()
    ? "Good day, " + session.name.trim() + "."
    : "Good day.";

  return (
    <div className="manager-dashboard min-w-0 space-y-5">
      <header className="manager-dashboard-hero flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            <Store className="h-4 w-4" /> RRJ's Food-Haus · Operations
          </p>
          <h1 className="text-foreground">Manager dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {greeting} Review the recorded queues and today's activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <p className="manager-dashboard-date text-sm font-semibold text-muted-foreground">
            {today}
          </p>
          <Button
            variant="secondary"
            size="md"
            onClick={refreshDashboard}
            disabled={loading || authLoading || session?.role !== "manager"}
            aria-label="Refresh manager dashboard"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      {dashboard && loadedAt && (
        <p className="text-xs text-muted-foreground">
          Dashboard last loaded{" "}
          {new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(loadedAt)}. Values may change between refreshes.
        </p>
      )}
      {loading && dashboard && (
        <p
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          Refreshing dashboard… Previously loaded values remain visible until
          the read finishes.
        </p>
      )}

      {loading && !dashboard ? (
        <div
          role="status"
          className="rrj-card p-8 text-center text-sm text-muted-foreground"
        >
          Loading manager dashboard…
        </div>
      ) : error && !dashboard ? (
        <div
          role="alert"
          className="rrj-card flex flex-col items-start gap-3 p-5"
        >
          <div>
            <p className="text-sm font-bold text-red-700">
              Dashboard unavailable
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void loadDashboard()}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : dashboard ? (
        <>
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <span>
                {error} The displayed values are from the last successful load
                and may be outdated.
              </span>
              <Button
                variant="secondary"
                size="md"
                onClick={() => void loadDashboard()}
              >
                Retry
              </Button>
            </div>
          )}

          <section
            aria-labelledby="manager-attention-heading"
            className="manager-dashboard-operations"
          >
            <div className="manager-section-heading">
              <div>
                <p className="manager-page-context">Operational queues</p>
                <h2 id="manager-attention-heading">Needs attention</h2>
                <p>
                  Current pending payments, physical and usable stock warnings, plus
                  orders created today.
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="manager-dashboard-action">
                  <AttentionCard
                    label="Pending payments"
                    value={dashboard.pendingPayments.toLocaleString("en-PH")}
                    description={
                      dashboard.pendingPayments > 0
                        ? "Pending payments across all dates"
                        : "No payments are pending across all dates"
                    }
                    active={dashboard.pendingPayments > 0}
                    tone="amber"
                    icon={CreditCard}
                  />
                  {onNavigate && (
                    <button type="button" onClick={() => onNavigate("orders")}>
                      Review orders <ArrowUpRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="manager-dashboard-action">
                  <AttentionCard
                    label="Low stock"
                    value={
                      dashboard.lowStockCount.toLocaleString("en-PH") + " items"
                    }
                    description={
                      dashboard.lowStockCount > 0
                        ? "Active items with recorded on-hand at or below reorder level"
                        : "No active items have recorded on-hand at or below reorder level"
                    }
                    active={dashboard.lowStockCount > 0}
                    tone="red"
                    icon={Package}
                  />
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate("inventory")}
                    >
                      Open Stock Monitor <ArrowUpRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="manager-dashboard-action">
                  <AttentionCard
                    label="Low usable stock"
                    value={
                      usableCount === null
                        ? "—"
                        : usableCount.toLocaleString("en-PH") + " items"
                    }
                    description={
                      stockLoading && usableCount === null
                        ? "Loading usable stock…"
                        : stockError && usableCount === null
                          ? "Usable stock information is temporarily unavailable."
                          : usableCount === null
                            ? "Usable stock has not been loaded."
                            : stockError
                              ? "Previous usable-stock count; refresh failed and may be stale."
                              : stockLoading
                                ? "Refreshing usable stock; previous count shown."
                                : stockItemCount === 0
                                  ? "No inventory items were returned."
                                  : usableCount === 0 && stockLoadedAt
                                  ? "No active items at or below the recorded minimum."
                                  : "Active items with usable stock at or below the recorded minimum."
                    }
                    active={usableCount !== null && usableCount > 0}
                    tone="amber"
                    icon={Package}
                  />
                  {stockError && (
                    <Button variant="secondary" size="sm" onClick={() => void loadStock()} disabled={stockLoading}>
                      Retry usable stock
                    </Button>
                  )}
                  {onNavigate && (
                    <button type="button" onClick={() => onNavigate("inventory")}>
                      Open Stock Monitor <ArrowUpRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="rrj-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-foreground">
                      Today&apos;s order flow
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Status of orders created today, across channels
                    </p>
                  </div>
                  <span className="rounded-lg border border-border bg-muted/45 px-2.5 py-1 text-sm font-extrabold tabular-nums text-foreground">
                    {totalStatusCount.toLocaleString("en-PH")}
                  </span>
                </div>
                {orderedStatusCounts.length === 0 ? (
                  <div className="flex min-h-28 items-center justify-center px-4 text-sm text-muted-foreground">
                    No orders today.
                  </div>
                ) : (
                  <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {orderedStatusCounts.map((entry) => {
                      const needsAttention = managerOrderNeedsAttention(
                        entry.status,
                      );
                      const isRejected =
                        entry.status === "cancelled" ||
                        entry.status === "rejected";

                      return (
                        <div
                          key={entry.status}
                          className={
                            "flex min-h-10 items-center justify-between gap-3 rounded-lg border px-3 py-2 " +
                            (needsAttention
                              ? isRejected
                                ? "border-red-200 bg-red-50/60"
                                : "border-amber-200 bg-amber-50/60"
                              : "border-border/70 bg-muted/20")
                          }
                        >
                          <ManagerOrderStatusBadge status={entry.status} />
                          <span className="text-sm font-extrabold tabular-nums text-foreground">
                            {entry.count.toLocaleString("en-PH")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section
            aria-label="Business overview"
            className="manager-dashboard-kpis grid gap-3 sm:grid-cols-2"
          >
            <article className="manager-dashboard-kpi rrj-card">
              <span className="manager-dashboard-kpi-icon">
                <DollarSign className="h-5 w-5" />
              </span>
              <p>Verified fulfilled sales today</p>
              <strong>{formatCurrency(dashboard.salesToday)}</strong>
              <small>Verified payments; fulfillment date</small>
            </article>
            <article className="manager-dashboard-kpi rrj-card">
              <span className="manager-dashboard-kpi-icon">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <p>Orders today</p>
              <strong>{dashboard.ordersToday.toLocaleString("en-PH")}</strong>
              <small>Created today; all statuses and channels</small>
            </article>
          </section>

          {onNavigate && (
            <section
              aria-labelledby="manager-quick-access-heading"
              className="rrj-card p-4 sm:p-5"
            >
              <div className="mb-3">
                <h2
                  id="manager-quick-access-heading"
                  className="text-base font-extrabold text-foreground"
                >
                  Quick access
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open the existing Manager workspaces for the next task.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    [
                      "replenishment",
                      "Inventory Requests",
                      "Prepare or review a formal request",
                    ],
                    [
                      "stock-receiving",
                      "Receiving",
                      "Inspect and post a delivery",
                    ],
                    ["reports", "Reports", "Review business reporting"],
                  ] as const
                ).map(([target, label, description]) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => onNavigate(target)}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span>
                      <strong className="block text-sm text-foreground">
                        {label}
                      </strong>
                      <small className="mt-1 block text-xs text-muted-foreground">
                        {description}
                      </small>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section
            className="rrj-card overflow-hidden"
            aria-labelledby="recent-orders-heading"
          >
            <div className="border-b border-border px-4 py-3">
              <h2
                id="recent-orders-heading"
                className="text-sm font-extrabold text-foreground"
              >
                Recent orders
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Latest four orders across all dates and channels
              </p>
            </div>
            {dashboard.recentOrders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recent orders are available.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <p className="px-4 pt-3 text-xs text-muted-foreground sm:hidden">
                  Scroll horizontally to read every order field.
                </p>
                <table className="w-full min-w-[620px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/45">
                      {["Order", "Customer", "Order total", "Order status"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-4 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/80">
                    {dashboard.recentOrders.map((order) => (
                      <tr
                        key={order.orderNumber}
                        className={
                          order.currentStatus === "cancelled" ||
                          order.currentStatus === "rejected"
                            ? "bg-red-50/35"
                            : managerOrderNeedsAttention(order.currentStatus)
                              ? "bg-amber-50/35"
                              : "hover:bg-muted/25"
                        }
                      >
                        <td className="max-w-[180px] break-all px-4 py-3 font-mono text-xs font-bold text-primary">
                          {order.orderNumber}
                        </td>
                        <td className="max-w-[220px] break-words px-4 py-3 text-sm font-semibold text-foreground">
                          {order.customerName}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold tabular-nums text-foreground">
                          {formatCurrency(order.grandTotal)}
                        </td>
                        <td className="px-4 py-3">
                          <ManagerOrderStatusBadge
                            status={order.currentStatus}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            className="rrj-card overflow-hidden"
            aria-labelledby="business-snapshot-heading"
          >
            <div className="border-b border-border px-4 py-3">
              <h2
                id="business-snapshot-heading"
                className="text-sm font-extrabold text-foreground"
              >
                Business snapshot
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Verified payments on successfully fulfilled orders
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-bold text-muted-foreground">
                  Verified-payment revenue · Last 7 fulfillment dates
                </p>
                <SparkAreaChart data={dashboard.dailySales} />
                {dashboard.dailySales.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="min-h-11 cursor-pointer rounded-lg px-2 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      View seven daily values
                    </summary>
                    <div className="max-w-full overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[260px] text-sm">
                        <thead>
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left">
                              Date
                            </th>
                            <th scope="col" className="px-3 py-2 text-right">
                              Verified-payment revenue
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.dailySales.map((day) => (
                            <tr
                              key={day.date}
                              className="border-t border-border"
                            >
                              <th
                                scope="row"
                                className="px-3 py-2 text-left font-normal"
                              >
                                {day.date}
                              </th>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatCurrency(day.sales)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
