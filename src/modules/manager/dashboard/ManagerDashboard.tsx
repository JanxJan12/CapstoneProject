import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Store,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { StatusBadge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { StatCard } from "../../../components/common/StatCard";
import {
  getManagerDashboard,
  type ManagerDailySale,
  type ManagerDashboardData,
  type ManagerOrderStatus,
} from "../api/managerApi";

const STATUS_PRESENTATION: Record<
  ManagerOrderStatus,
  { label: string; color: string; badgeKey: string }
> = {
  waiting_payment_verification: {
    label: "Awaiting Payment",
    color: "#d97706",
    badgeKey: "waiting-payment",
  },
  confirmed: { label: "Confirmed", color: "#2563eb", badgeKey: "confirmed" },
  preparing: { label: "Preparing", color: "#ea580c", badgeKey: "preparing" },
  ready: { label: "Ready", color: "#7c3aed", badgeKey: "ready" },
  waiting_for_rider: {
    label: "Waiting for Rider",
    color: "#a16207",
    badgeKey: "waiting-rider",
  },
  rider_accepted: {
    label: "Rider Accepted",
    color: "#0891b2",
    badgeKey: "rider-accepted",
  },
  picked_up: { label: "Picked Up", color: "#0284c7", badgeKey: "picked-up" },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "#2563eb",
    badgeKey: "out-for-delivery",
  },
  delivered: { label: "Delivered", color: "#16a34a", badgeKey: "delivered" },
  completed: { label: "Completed", color: "#15803d", badgeKey: "completed" },
  cancelled: { label: "Cancelled", color: "#dc2626", badgeKey: "cancelled" },
  rejected: { label: "Rejected", color: "#b91c1c", badgeKey: "rejected" },
};

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
      <div className="flex h-[130px] items-center justify-center text-xs text-muted-foreground">
        No daily sales data is available.
      </div>
    );
  }

  const width = 500;
  const height = 130;
  const paddingLeft = 44;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 24;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...data.map((entry) => entry.sales));
  const minValue = Math.min(...data.map((entry) => entry.sales));
  const range = maxValue - minValue || 1;
  const xCoordinates = data.map((_, index) =>
    data.length === 1
      ? paddingLeft + innerWidth / 2
      : paddingLeft + (index / (data.length - 1)) * innerWidth,
  );
  const yCoordinates = data.map(
    (entry) =>
      paddingTop +
      innerHeight -
      ((entry.sales - minValue) / range) * innerHeight,
  );
  const linePath = xCoordinates
    .map(
      (coordinate, index) =>
        `${index === 0 ? "M" : "L"}${coordinate},${yCoordinates[index]}`,
    )
    .join(" ");
  const areaPath = `${linePath} L${xCoordinates[xCoordinates.length - 1]},${
    paddingTop + innerHeight
  } L${xCoordinates[0]},${paddingTop + innerHeight} Z`;
  const ticks = [minValue, (minValue + maxValue) / 2, maxValue];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ overflow: "visible" }}
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
              stroke="#f0f0f2"
              strokeDasharray="3 3"
            />
            <text
              x={paddingLeft - 4}
              y={y + 3}
              textAnchor="end"
              fontSize={9}
              fill="#9ca3af"
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
          fill="#9ca3af"
        >
          {entry.day}
        </text>
      ))}
      <path d={areaPath} fill="#b45309" fillOpacity={0.08} />
      <path
        d={linePath}
        fill="none"
        stroke="#dc2626"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((entry, index) => (
        <circle
          key={entry.date}
          cx={xCoordinates[index]}
          cy={yCoordinates[index]}
          r={3}
          fill="#b45309"
        />
      ))}
    </svg>
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
  const today = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date());
  const greeting = session?.name?.trim()
    ? `Good day, ${session.name.trim()}.`
    : "Good day.";

  return (
    <div className="manager-dashboard space-y-4">
      <section className="manager-welcome relative isolate overflow-hidden rounded-[22px] border border-white/10 bg-[#211711] px-5 py-5 text-white shadow-[0_24px_60px_rgba(48,29,17,0.16)] sm:px-6 sm:py-6">
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-12 h-28 w-28 rounded-full border border-white/[0.06] shadow-[0_0_0_32px_rgba(255,255,255,0.025),0_0_0_64px_rgba(255,255,255,0.015)]" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.19em] text-amber-300/80">
            <Sparkles className="h-3.5 w-3.5" /> Daily command center
          </div>
          <h1 className="font-['Fraunces'] text-[30px] font-bold leading-none tracking-[-0.035em] text-white sm:text-[36px]">
            {greeting}
          </h1>
          <p className="mt-2.5 flex items-center gap-2 text-xs font-medium text-white/55">
            <Store className="h-3.5 w-3.5 text-amber-300/70" /> RRJ&apos;s
            Food-Haus · {today}
          </p>
        </div>
      </section>

      {loading && !dashboard ? (
        <div className="rrj-card p-8 text-center text-xs text-muted-foreground">
          Loading manager dashboard…
        </div>
      ) : error && !dashboard ? (
        <div className="rrj-card flex flex-col items-start gap-3 p-5">
          <div>
            <p className="text-xs font-bold text-red-700">
              Dashboard unavailable
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadDashboard()}
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      ) : dashboard ? (
        <>
          {error && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Sales Today"
              value={formatCurrency(dashboard.salesToday)}
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <StatCard
              label="Orders Today"
              value={dashboard.ordersToday.toLocaleString("en-PH")}
              icon={ShoppingCart}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              label="Pending Payments"
              value={dashboard.pendingPayments.toLocaleString("en-PH")}
              icon={CreditCard}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              sub={dashboard.pendingPayments > 0 ? "Cashier queue" : undefined}
              subColor="text-amber-600"
            />
            <StatCard
              label="Low Stock"
              value={`${dashboard.lowStockCount.toLocaleString("en-PH")} items`}
              icon={Package}
              iconBg="bg-red-50"
              iconColor="text-red-600"
              sub={dashboard.lowStockCount > 0 ? "Needs restock" : undefined}
              subColor="text-red-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rrj-card p-5 lg:col-span-2">
              <div className="mb-3">
                <p className="text-sm font-extrabold text-foreground">
                  Revenue trend
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                  Verified payment revenue for the last 7 calendar days
                </p>
              </div>
              <SparkAreaChart data={dashboard.dailySales} />
            </div>

            <div className="rrj-card p-5">
              <p className="mb-1 text-sm font-extrabold text-foreground">
                Orders by status
              </p>
              <p className="mb-4 text-[10px] text-muted-foreground">
                Today&apos;s order status mix
              </p>
              {dashboard.orderStatusCounts.length === 0 ? (
                <div className="flex min-h-28 items-center justify-center text-xs text-muted-foreground">
                  No orders today.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {dashboard.orderStatusCounts.map((entry) => {
                    const presentation = STATUS_PRESENTATION[entry.status];
                    const percentage =
                      totalStatusCount > 0
                        ? Math.round((entry.count / totalStatusCount) * 100)
                        : 0;

                    return (
                      <div key={entry.status}>
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: presentation.color }}
                            />
                            <span className="text-muted-foreground">
                              {presentation.label}
                            </span>
                          </div>
                          <span className="font-bold text-foreground">
                            {entry.count}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: presentation.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                {totalStatusCount.toLocaleString("en-PH")} orders today
              </p>
            </div>
          </div>

          <div className="rrj-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <p className="text-sm font-extrabold text-foreground">
                Recent orders
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Latest activity across all channels
              </p>
            </div>
            {dashboard.recentOrders.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No recent orders are available.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/60">
                      {["Order", "Customer", "Order Total", "Status"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dashboard.recentOrders.map((order) => (
                      <tr key={order.orderNumber} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-[10px] font-bold text-primary">
                          {order.orderNumber}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {order.customerName}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold">
                          {formatCurrency(order.grandTotal)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={
                              STATUS_PRESENTATION[order.currentStatus].badgeKey
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
