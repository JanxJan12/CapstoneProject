import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
  Store,
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
  return error instanceof Error
    ? error.message
    : "Unable to load the manager dashboard.";
}

function SparkAreaChart({ data }: { data: ManagerDailySale[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[116px] items-center justify-center text-sm text-muted-foreground">
        No daily sales data is available.
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
      aria-label="Verified revenue for the last seven calendar days"
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
        "flex min-h-[112px] items-center gap-4 rounded-xl border p-4 " +
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
        <p className="mt-1 font-['Fraunces'] text-2xl font-bold leading-none text-current">
          {value}
        </p>
        <p className="mt-1.5 text-xs font-medium leading-4 text-current/75">
          {description}
        </p>
      </div>
    </article>
  );
}

export function ManagerDashboard() {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setDashboard(await getManagerDashboard());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
    <div className="manager-dashboard space-y-4">
      <header className="flex flex-col gap-2 border-b border-border/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            <Store className="h-4 w-4" /> Manager overview
          </p>
          <h1 className="text-foreground">{greeting}</h1>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{today}</p>
      </header>

      {loading && !dashboard ? (
        <div className="rrj-card p-8 text-center text-sm text-muted-foreground">
          Loading manager dashboard…
        </div>
      ) : error && !dashboard ? (
        <div className="rrj-card flex flex-col items-start gap-3 p-5">
          <div>
            <p className="text-sm font-bold text-red-700">
              Dashboard unavailable
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadDashboard()}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : dashboard ? (
        <>
          {error && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadDashboard()}
              >
                Retry
              </Button>
            </div>
          )}

          <section aria-labelledby="manager-attention-heading">
            <div className="mb-2.5 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <div>
                <h2
                  id="manager-attention-heading"
                  className="text-sm font-extrabold text-foreground"
                >
                  Needs attention
                </h2>
                <p className="text-xs text-muted-foreground">
                  Current payment and inventory exception queues
                </p>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
              <div className="rrj-card grid gap-3 p-3 sm:grid-cols-2">
                <AttentionCard
                  label="Pending payments"
                  value={dashboard.pendingPayments.toLocaleString("en-PH")}
                  description={
                    dashboard.pendingPayments > 0
                      ? "Waiting in the cashier verification queue"
                      : "No payments are waiting for verification"
                  }
                  active={dashboard.pendingPayments > 0}
                  tone="amber"
                  icon={CreditCard}
                />
                <AttentionCard
                  label="Low stock"
                  value={
                    dashboard.lowStockCount.toLocaleString("en-PH") + " items"
                  }
                  description={
                    dashboard.lowStockCount > 0
                      ? "At or below the configured reorder level"
                      : "No items are at their reorder level"
                  }
                  active={dashboard.lowStockCount > 0}
                  tone="red"
                  icon={Package}
                />
              </div>

              <div className="rrj-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-foreground">
                      Today&apos;s order flow
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Current status across today&apos;s orders
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
                Latest activity across all order channels
              </p>
            </div>
            {dashboard.recentOrders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recent orders are available.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/45">
                      {["Order", "Customer", "Total", "Order status"].map(
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
                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">
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
                Secondary performance view from verified payments
              </p>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <DollarSign className="h-4 w-4 text-emerald-700" />
                    Verified sales today
                  </div>
                  <p className="mt-2 font-['Fraunces'] text-xl font-bold tabular-nums text-foreground">
                    {formatCurrency(dashboard.salesToday)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <ShoppingCart className="h-4 w-4 text-blue-700" />
                    Orders today
                  </div>
                  <p className="mt-2 font-['Fraunces'] text-xl font-bold tabular-nums text-foreground">
                    {dashboard.ordersToday.toLocaleString("en-PH")}
                  </p>
                </div>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-bold text-muted-foreground">
                  Verified revenue · Last 7 calendar days
                </p>
                <SparkAreaChart data={dashboard.dailySales} />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
