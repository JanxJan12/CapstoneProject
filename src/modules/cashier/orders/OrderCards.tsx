import { formatMoney } from "../constants";
import { StatusBadge } from "../components";
import type { Order } from "../types";
import { canCancelCashierOrder, getOrderWaitingPresentation, getRiderStatus } from "./orderOperations";
import { OrderActionMenu } from "./OrderTableRow";

export function OrderCards({
  orders,
  delayedThreshold,
  now,
  selectedIds,
  onToggleSelect,
  onView,
  onCancel,
}: {
  orders: Order[];
  delayedThreshold: number;
  now: number;
  selectedIds: Set<string>;
  onToggleSelect: (orderId: string) => void;
  onView: (order: Order, trigger: HTMLElement) => void;
  onCancel: (order: Order) => void;
}) {
  if (!orders.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No matching orders. Adjust the search or filters.
      </p>
    );
  }

  return (
    <div className="space-y-2 p-1.5 sm:p-2" aria-label="Order cards">
      {orders.map((order) => {
        const waiting = getOrderWaitingPresentation(
          order,
          delayedThreshold,
          now,
        );
        const rider = getRiderStatus(order);
        return (
          <article
            key={order.id}
            className={`min-w-0 rounded-xl border p-3 ${selectedIds.has(order.id) ? "border-amber-300 bg-amber-50/70" : "border-border bg-white"}`}
          >
            <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
              <div className="flex min-w-0 flex-[1_1_10rem] items-start gap-2">
                <label
                  className="flex h-11 w-11 shrink-0 items-start justify-center pt-1"
                  aria-label={`Select ${order.id}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={() => onToggleSelect(order.id)}
                    className="h-5 w-5 accent-primary"
                  />
                </label>
                <div className="min-w-0">
                  <h2>
                    <button type="button" onClick={(event) => onView(order, event.currentTarget)}
                      className="min-h-11 break-all rounded-md text-left font-mono text-sm font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={`View details for ${order.id}`}>
                      {order.id}
                    </button>
                  </h2>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground" title={order.customerName}>
                    {order.customerName} · {order.type}
                  </p>
                </div>
              </div>
              <strong className="ml-auto shrink-0 text-sm font-black tabular-nums">
                {formatMoney(order.total)}
              </strong>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-border/70 pt-2 text-xs">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Fulfillment</dt>
                <dd className="mt-1">
                  <StatusBadge status={order.status} className="max-w-full break-words text-left" />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Payment</dt>
                <dd className="mt-1">
                  <StatusBadge status={order.paymentStatus} unknownLabel="Payment status unavailable" className="max-w-full break-words text-left" />
                </dd>
              </div>
              {waiting.active && (
                <div className="col-span-2 min-w-0">
                  <dt className="sr-only">Waiting</dt>
                  <dd
                    className={
                      waiting.delayed
                        ? "font-semibold text-amber-800"
                        : "text-muted-foreground"
                    }
                  >
                    {waiting.label}
                  </dd>
                </div>
              )}
              {order.type === "Delivery" &&
                rider !== "Not yet applicable" &&
                rider !== "Not required" && (
                  <div className="col-span-2 min-w-0">
                    <dt className="inline text-muted-foreground">Rider: </dt>
                    <dd className="inline break-words font-semibold">
                      {rider}
                    </dd>
                  </div>
                )}
            </dl>
            {canCancelCashierOrder(order) ? (
              <div className="mt-2 flex items-center justify-end border-t border-border/70 pt-2">
                <OrderActionMenu order={order} onCancel={onCancel} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
