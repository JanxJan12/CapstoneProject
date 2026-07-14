import {
  ArrowRight,
  Banknote,
  ChefHat,
  CreditCard,
  Search,
  ShoppingCart,
  PackageCheck,
  Bike,
} from "lucide-react";
import { formatMoney } from "../constants";
import { useCashierMetrics } from "../hooks/useCashierMetrics";
import type { CashierNavigationIntent, CashierPageId } from "../types";

export function CashierWorkbench({
  onNavigate,
}: {
  onNavigate: (page: CashierPageId, intent?: CashierNavigationIntent) => void;
}) {
  const metrics = useCashierMetrics();
  const actions = [
    {
      label: "New Walk-in Order",
      detail: "Dine-in or take-out POS",
      icon: ShoppingCart,
      action: () => onNavigate("walkin-pos"),
      primary: true,
    },
    {
      label: "Verify GCash Payments",
      detail: `${metrics.pendingPayments} submissions waiting`,
      icon: CreditCard,
      action: () => onNavigate("pending-payments"),
    },
    {
      label: "Release Ready Order",
      detail: `${metrics.readyOrders} ready for handoff`,
      icon: PackageCheck,
      action: () =>
        onNavigate("order-list", { statuses: ["Ready"], openFirstReady: true }),
    },
    {
      label: "Search Order",
      detail: "Find by ID or customer",
      icon: Search,
      action: () => onNavigate("order-list", { focusSearch: true }),
    },
  ];
  return (
    <section className="rrj-card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-black tracking-tight text-foreground">
          Priority Actions
        </h2>
        <p className="text-[11px] font-semibold text-muted-foreground">
          The four tasks used most often at the counter
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        {actions.map(({ label, detail, icon: Icon, action, primary }) => (
          <button
            key={label}
            onClick={action}
            className={`group flex min-h-[72px] items-center gap-3 rounded-xl border px-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${primary ? "border-primary bg-gradient-to-r from-primary to-orange-600 text-primary-foreground shadow-md shadow-orange-900/10 hover:-translate-y-0.5 hover:shadow-lg" : "border-border bg-white/90 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-amber-50/30 hover:shadow-md"}`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${primary ? "bg-white/15" : "bg-amber-50 text-primary"}`}
            >
              <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black">{label}</span>
              <span
                className={`mt-0.5 block truncate text-[10px] font-semibold ${primary ? "text-white/70" : "text-muted-foreground"}`}
              >
                {detail}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-35 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function RestaurantControlLanes() {
  const metrics = useCashierMetrics();
  const lanes = [
    {
      label: "Payment Gate",
      value: `${metrics.pendingPayments} waiting`,
      detail: "GCash review before kitchen release",
      icon: CreditCard,
      progress: Math.min(100, metrics.pendingPayments * 28),
    },
    {
      label: "Kitchen Line",
      value: `${metrics.kitchenOrders} tickets`,
      detail: `${metrics.readyOrders} ready for handoff`,
      icon: ChefHat,
      progress: Math.min(100, metrics.kitchenOrders * 18),
    },
    {
      label: "Delivery Dispatch",
      value: `${metrics.deliveryOrders} active`,
      detail: "Customer delivery orders in progress",
      icon: Bike,
      progress: Math.min(100, metrics.deliveryOrders * 18),
    },
    {
      label: "Shift Settlement",
      value: formatMoney(
        metrics.shiftTotals.cashSales + metrics.shiftTotals.gcashSales,
      ),
      detail: "Completed payments in active shift",
      icon: Banknote,
      progress: Math.min(
        100,
        (metrics.shiftTotals.transactionCount / 12) * 100,
      ),
    },
  ];
  return (
    <section className="rrj-card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-black">Restaurant Control Lanes</h2>
        <p className="text-[11px] font-semibold text-muted-foreground">
          Payment, kitchen, delivery, and settlement readiness
        </p>
      </div>
      <div className="grid gap-2">
        {lanes.map(({ label, value, detail, icon: Icon, progress }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-white/90 p-3.5 transition hover:border-primary/20 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3 text-xs font-black">
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground">
                  {detail}
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400 shadow-[0_0_8px_rgba(184,79,10,0.24)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
