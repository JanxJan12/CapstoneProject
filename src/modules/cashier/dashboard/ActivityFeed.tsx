import {
  Bike,
  CheckCircle2,
  ChefHat,
  CreditCard,
  ReceiptText,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { formatElapsed } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";

const ICONS = {
  payment_verified: CreditCard,
  payment_rejected: XCircle,
  walkin_created: ShoppingCart,
  kitchen_ready: ChefHat,
  rider_accepted: Bike,
  transaction_completed: ReceiptText,
  order_cancelled: XCircle,
  shift_started: CheckCircle2,
  shift_closed: CheckCircle2,
};

export function ActivityFeed() {
  const { state } = useCashierStore();
  return (
    <section className="rrj-card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-black">Live Activity</h2>
        <p className="text-[11px] font-semibold text-muted-foreground">
          Recent events from shared cashier records
        </p>
      </div>
      <ol className="space-y-3">
        {state.activities.slice(0, 6).map((activity) => {
          const Icon = ICONS[activity.kind];
          return (
            <li
              key={activity.id}
              className="group flex gap-3 rounded-xl p-1.5 transition hover:bg-amber-50/45"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 text-primary ring-1 ring-primary/10 transition-transform group-hover:scale-105">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground">
                  {activity.message}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatElapsed(activity.timestamp)} ago
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
