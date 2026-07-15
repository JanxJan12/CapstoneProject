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
import {
  CashierStatusBadge,
  EmptyState,
  SectionHeading,
} from "../components/CashierUI";

const kitchenStatus = (order: Order) => {
  if (order.status === "Awaiting Payment") return "Not sent";
  if (["Confirmed", "Preparing", "Ready"].includes(order.status))
    return order.status;
  if (order.status === "Cancelled") return "Cancelled";
  if (order.status === "Completed") return "Completed";
  return "Ready / released";
};

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
      <div className="border-b border-border/80 bg-gradient-to-r from-amber-50/50 to-transparent p-4 sm:px-5">
        <SectionHeading
          title="Live Order Queue"
          description="Payment, kitchen, rider, and handoff readiness in one queue"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {orders.length} live
            </span>
          }
        />
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
                type="button"
                onClick={() => onSelect(order)}
                className={`group grid min-h-[126px] w-full grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5 ${delayed ? "border-l-4 border-l-red-500 bg-red-50/60 hover:bg-red-50" : "hover:bg-amber-50/35"}`}
              >
                <span
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${delayed ? "bg-red-100 text-red-700" : "bg-amber-50 text-primary"}`}
                >
                  {delayed ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="font-mono text-xs text-primary">
                      {order.id}
                    </strong>
                    <span className="text-[10px] font-bold text-foreground">
                      {order.customerName}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-muted-foreground">
                      {order.type}
                    </span>
                    {delayed && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-red-800">
                        <AlertTriangle className="h-3 w-3" /> Delayed
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[10px] font-semibold text-muted-foreground">
                    {order.items
                      .map((item) => `${item.quantity}× ${item.name}`)
                      .join(", ")}
                  </span>
                  <span className="mt-2.5 flex flex-wrap gap-1.5">
                    <QueueFact label="Payment">
                      <CashierStatusBadge status={order.paymentStatus} />
                    </QueueFact>
                    <QueueFact label="Kitchen" value={kitchenStatus(order)} />
                    <QueueFact
                      label="Rider"
                      value={
                        order.type === "Delivery"
                          ? (order.riderStatus ?? "Waiting assignment")
                          : "Not required"
                      }
                    />
                    <QueueFact
                      label="Assigned"
                      value={
                        order.type === "Delivery"
                          ? (order.assignedRider ?? "Unassigned")
                          : "—"
                      }
                    />
                  </span>
                </span>

                <span className="col-span-2 flex min-w-[94px] items-start gap-2 border-t border-border/60 pt-2 text-right sm:col-span-1 sm:border-0 sm:pt-0">
                  <span className="flex-1">
                    <strong className="block text-xs">
                      {formatMoney(order.total)}
                    </strong>
                    <span className="mt-1 block text-[9px] font-semibold text-muted-foreground">
                      Created{" "}
                      {new Date(order.createdAt).toLocaleTimeString("en-PH", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className={`mt-1 flex items-center justify-end gap-1 text-[9px] font-black ${delayed ? "text-red-700" : "text-muted-foreground"}`}
                    >
                      <Clock3 className="h-3 w-3" />
                      {formatElapsed(order.createdAt)} elapsed
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function QueueFact({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-lg border border-border/80 bg-white/75 px-1.5 py-0.5 text-[8px] font-semibold text-muted-foreground">
      <span>{label}</span>
      {children ?? <strong className="text-foreground">{value}</strong>}
    </span>
  );
}
