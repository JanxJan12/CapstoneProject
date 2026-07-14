import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  CashierButton,
  CashierStatusBadge,
  EmptyState,
  ErrorBanner,
} from "../../cashier/components/CashierUI";
import {
  formatElapsed,
  formatMoney,
  minutesSince,
} from "../../cashier/constants";
import { useCashierStore } from "../../cashier/hooks/CashierStore";
import type { Order, OrderStatus } from "../../cashier/types";

const COLUMNS: Array<
  Extract<OrderStatus, "Confirmed" | "Preparing" | "Ready">
> = ["Confirmed", "Preparing", "Ready"];

export function KitchenQueue() {
  const { state, updateKitchenStatus } = useCashierStore();
  const [loadingId, setLoadingId] = useState<string>();
  const [error, setError] = useState("");
  const kitchenOrders = state.orders.filter((order) =>
    COLUMNS.includes(order.status as (typeof COLUMNS)[number]),
  );
  const advance = async (order: Order) => {
    setLoadingId(order.id);
    setError("");
    try {
      const next = order.status === "Confirmed" ? "Preparing" : "Ready";
      await updateKitchenStatus(order.id, next);
      toast.success(`${order.id} marked ${next.toLowerCase()}`, {
        description:
          next === "Ready"
            ? "The cashier was notified for handoff."
            : "Preparation time is now tracked.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the kitchen ticket.",
      );
    } finally {
      setLoadingId(undefined);
    }
  };
  return (
    <div className="kitchen-queue flex flex-col gap-5">
      <header className="kitchen-heading relative overflow-hidden rounded-[22px] border border-orange-200/70 bg-gradient-to-br from-[#fffaf2] via-white to-orange-50/70 p-5 shadow-[0_18px_40px_rgba(95,52,20,0.06)] sm:p-6">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-orange-200/35 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/75"><ChefHat className="h-3.5 w-3.5" /> Kitchen command board</p>
            <h1 className="font-['Fraunces'] text-3xl font-bold tracking-[-0.035em]">Kitchen Queue</h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">
          Shared confirmed orders from cashier payment verification and Walk-in
          POS
            </p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]" /> Kitchen online</span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1.5 text-[10px] font-black text-foreground">{kitchenOrders.length} active</span>
          </div>
        </div>
      </header>
      {error && <ErrorBanner message={error} onRetry={() => setError("")} />}
      <div className="kitchen-board grid gap-4 xl:grid-cols-3">
        {COLUMNS.map((status) => {
          const orders = kitchenOrders
            .filter((order) => order.status === status)
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );
          return (
            <section
              key={status}
              data-status={status.toLowerCase()}
              className="kitchen-column overflow-hidden rounded-2xl border border-border bg-card shadow-[0_16px_36px_rgba(67,42,23,0.055)]"
            >
              <div className="kitchen-column-heading flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-black">{status}</h2>
                </div>
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-[10px] font-black text-primary">
                  {orders.length}
                </span>
              </div>
              <div className="space-y-3 p-3">
                {orders.length ? (
                  orders.map((order) => (
                    <KitchenTicket
                      key={order.id}
                      order={order}
                      threshold={state.delayedThresholdMinutes}
                      loading={loadingId === order.id}
                      onAdvance={() => advance(order)}
                    />
                  ))
                ) : (
                  <EmptyState
                    title={`No ${status.toLowerCase()} tickets`}
                    description="Orders will move here as the shared workflow advances."
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KitchenTicket({
  order,
  threshold,
  loading,
  onAdvance,
}: {
  order: Order;
  threshold: number;
  loading: boolean;
  onAdvance: () => void;
}) {
  const delayed = minutesSince(order.createdAt) > threshold;
  return (
    <article
      className={`kitchen-ticket rounded-xl border p-4 ${delayed ? "border-red-200 bg-red-50/60" : "border-border bg-white"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-black text-primary">
            {order.id}
          </p>
          <p className="mt-1 text-xs font-bold">
            {order.type}
            {order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <CashierStatusBadge status={order.status} />
          {delayed && (
            <span className="flex items-center gap-1 text-[10px] font-black text-red-700">
              <AlertTriangle className="h-3 w-3" />
              Delayed
            </span>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-1 border-y border-border py-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3 text-xs">
            <span>
              <strong>{item.quantity}×</strong> {item.name}
            </span>
            <span className="text-muted-foreground">
              {formatMoney(item.unitPrice * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
      {order.orderInstructions && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-900">
          Instruction: {order.orderInstructions}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1 text-[10px] font-bold ${delayed ? "text-red-700" : "text-muted-foreground"}`}
        >
          <Clock3 className="h-3 w-3" />
          {formatElapsed(order.createdAt)} elapsed
        </span>
        {order.status !== "Ready" && (
          <CashierButton
            className="min-h-10 px-3"
            loading={loading}
            onClick={onAdvance}
          >
            {order.status === "Confirmed" ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {order.status === "Confirmed" ? "Start preparing" : "Mark ready"}
          </CashierButton>
        )}
      </div>
    </article>
  );
}
