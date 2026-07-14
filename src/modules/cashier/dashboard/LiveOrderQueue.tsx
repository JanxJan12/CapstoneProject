import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import {
  ACTIVE_ORDER_STATUSES,
  formatElapsed,
  formatMoney,
  minutesSince,
} from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order } from "../types";
import { CashierStatusBadge, EmptyState } from "../components/CashierUI";

export function LiveOrderQueue({
  onSelect,
}: {
  onSelect: (order: Order) => void;
}) {
  const { state } = useCashierStore();
  const orders = state.orders
    .filter((entry) => ACTIVE_ORDER_STATUSES.includes(entry.status))
    .sort((a, b) => {
      const aDelayed =
        minutesSince(a.createdAt) > state.delayedThresholdMinutes ? 1 : 0;
      const bDelayed =
        minutesSince(b.createdAt) > state.delayedThresholdMinutes ? 1 : 0;
      return (
        bDelayed - aDelayed ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    })
    .slice(0, 7);
  return (
    <section className="rrj-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/80 bg-gradient-to-r from-amber-50/50 to-transparent p-4 sm:px-5">
        <div>
          <h2 className="text-sm font-black">Live Order Queue</h2>
          <p className="text-[11px] font-semibold text-muted-foreground">
            Prioritized at {state.delayedThresholdMinutes}+ minutes
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 shadow-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      {orders.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="Queue is clear"
            description="New confirmed orders will appear here automatically."
          />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((order) => {
            const delayed =
              minutesSince(order.createdAt) > state.delayedThresholdMinutes;
            const Icon =
              order.type === "Delivery"
                ? Truck
                : order.type === "Dine-in"
                  ? UtensilsCrossed
                  : ShoppingBag;
            return (
              <button
                key={order.id}
                onClick={() => onSelect(order)}
                className={`group flex min-h-[82px] w-full items-center gap-3 px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5 ${delayed ? "border-l-4 border-l-red-500 bg-red-50/60 hover:bg-red-50" : "hover:bg-amber-50/35"}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${delayed ? "bg-red-100 text-red-700" : "bg-amber-50 text-primary"}`}
                >
                  {delayed ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="font-mono text-xs text-primary">
                      {order.id}
                    </strong>
                    <CashierStatusBadge status={order.status} />
                    {delayed && (
                      <CashierStatusBadge status={order.status} delayed />
                    )}
                  </span>
                  <span className="mt-1 block truncate text-[11px] font-semibold text-muted-foreground">
                    {order.customerName} ·{" "}
                    {order.items
                      .map((item) => `${item.quantity}× ${item.name}`)
                      .join(", ")}
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <strong className="block text-xs">
                    {formatMoney(order.total)}
                  </strong>
                  <span
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-bold ${delayed ? "text-red-700" : "text-muted-foreground"}`}
                  >
                    <Clock3 className="h-3 w-3" />
                    {formatElapsed(order.createdAt)} elapsed
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
