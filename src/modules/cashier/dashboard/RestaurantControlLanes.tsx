import { ArrowUpRight, Banknote, Bike, ChefHat, CreditCard } from "lucide-react";
import { formatMoney } from "../constants";
import { useCashierMetrics } from "../hooks/useCashierMetrics";
import type { CashierNavigationIntent, CashierPageId } from "../types";

export function RestaurantControlLanes({
  onNavigate,
}: {
  onNavigate: (page: CashierPageId, intent?: CashierNavigationIntent) => void;
}) {
  const metrics = useCashierMetrics();
  const lanes = [
    {
      label: "Payment Gate",
      icon: CreditCard,
      action: () => onNavigate("pending-payments"),
      facts: [
        ["Pending", String(metrics.pendingPayments)],
        ["Oldest", `${metrics.oldestPendingMinutes} min`],
        ["Verified", `${metrics.paymentVerificationPercent}%`],
      ],
      progress: metrics.paymentVerificationPercent,
      progressLabel: "Verification completion",
    },
    {
      label: "Kitchen Line",
      icon: ChefHat,
      action: () =>
        onNavigate("order-list", {
          statuses: ["Confirmed", "Preparing", "Ready"],
        }),
      facts: [
        ["Confirmed", String(metrics.confirmedOrders)],
        ["Preparing", String(metrics.preparingOrders)],
        ["Ready", String(metrics.readyOrders)],
      ],
    },
    {
      label: "Delivery Dispatch",
      icon: Bike,
      action: () =>
        onNavigate("order-list", {
          orderTypes: ["Delivery"],
          statuses: [
            "Waiting for Rider",
            "Rider Accepted",
            "Picked Up",
            "Out for Delivery",
          ],
        }),
      facts: [
        ["Waiting", String(metrics.waitingForRider)],
        ["Available riders", String(metrics.availableRiders)],
        ["Active", String(metrics.activeDeliveries)],
      ],
    },
    {
      label: "Shift Settlement",
      icon: Banknote,
      action: () => onNavigate("shift-settlement"),
      facts: [
        ["Cash", formatMoney(metrics.shiftTotals.cashSales)],
        ["GCash", formatMoney(metrics.shiftTotals.gcashSales)],
        ["Expected", formatMoney(metrics.shiftTotals.expectedCash)],
        [
          "Actual",
          metrics.actualCash === undefined
            ? "Not counted"
            : formatMoney(metrics.actualCash),
        ],
        [
          "Variance",
          metrics.variance === undefined
            ? "Pending"
            : formatMoney(metrics.variance),
        ],
      ],
    },
  ];

  return (
    <section className="rrj-card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-black">Restaurant Control Lanes</h2>
        <p className="text-[11px] font-semibold text-muted-foreground">
          Measurable operational counts from current records
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {lanes.map(({ label, icon: Icon, action, facts, progress, progressLabel }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="group min-h-[136px] rounded-xl border border-border bg-white/90 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <strong className="flex-1 text-xs font-black">{label}</strong>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {facts.map(([factLabel, value]) => (
                <span
                  key={factLabel}
                  className="rounded-lg border border-border/80 bg-muted/30 px-2 py-1 text-[9px] font-semibold text-muted-foreground"
                >
                  {factLabel} <strong className="text-foreground">{value}</strong>
                </span>
              ))}
            </div>
            {progress !== undefined && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
