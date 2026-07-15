import {
  Bike,
  CheckCircle2,
  ChefHat,
  CreditCard,
  Printer,
  ReceiptText,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { formatDateTime, formatElapsed } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order } from "../types";
import { EmptyState } from "../components/CashierUI";

const ICONS = {
  payment_verified: CreditCard,
  payment_rejected: XCircle,
  walkin_created: ShoppingCart,
  kitchen_ready: ChefHat,
  rider_accepted: Bike,
  transaction_completed: ReceiptText,
  order_cancelled: XCircle,
  receipt_reprinted: Printer,
  shift_started: CheckCircle2,
  shift_closed: CheckCircle2,
};

export function RecentActivityFeed({
  onSelectOrder,
}: {
  onSelectOrder: (order: Order) => void;
}) {
  const { state } = useCashierStore();
  const activities = state.activities.slice(0, 7);

  return (
    <section className="rrj-card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-black">Recent Activity</h2>
        <p className="text-[11px] font-semibold text-muted-foreground">
          Latest operational events from the shared records
        </p>
      </div>
      {activities.length === 0 ? (
        <EmptyState
          title="No recent activity"
          description="Cashier, kitchen, and rider events will appear here."
        />
      ) : (
        <ol className="space-y-2">
          {activities.map((activity) => {
            const Icon = ICONS[activity.kind];
            const order = state.orders.find(
              (entry) => entry.id === activity.orderId,
            );
            const content = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 text-primary ring-1 ring-primary/10 transition-transform group-hover:scale-105">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold leading-4 text-foreground">
                    {activity.message}
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">
                    {activity.actor} · {formatDateTime(activity.timestamp)} ·{" "}
                    {formatElapsed(activity.timestamp) === "Just now"
                      ? "Just now"
                      : `${formatElapsed(activity.timestamp)} ago`}
                  </span>
                  {(activity.orderId || activity.transactionId) && (
                    <span className="mt-0.5 block font-mono text-[9px] font-bold text-primary">
                      {[activity.orderId, activity.transactionId]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
              </>
            );
            return (
              <li key={activity.id}>
                {order ? (
                  <button
                    type="button"
                    onClick={() => onSelectOrder(order)}
                    className="group flex min-h-[58px] w-full gap-3 rounded-xl p-1.5 text-left transition hover:bg-amber-50/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="group flex min-h-[58px] gap-3 rounded-xl p-1.5">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
