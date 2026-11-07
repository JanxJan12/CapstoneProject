import { formatDateTime, formatMoney } from "../constants";
import type { Order } from "../types";
import { useCashierStore } from "../hooks/CashierStore";
import { getRecordedDeliveryFee, presentTimelineActor } from "./orderOperations";

export function OrderExpandedContent({
  order,
  onView,
}: {
  order: Order;
  onView: (order: Order) => void;
}) {
  const { state } = useCashierStore();
  const fulfillment =
    order.type === "Dine-in"
      ? "Dine-in"
      : order.type === "Delivery"
        ? (order.deliveryAddress ?? "Address not provided")
        : "Take-out counter";
  const deliveryFee = getRecordedDeliveryFee(order);

  return (
    <td colSpan={10} className="px-6 py-4">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Label>Customer details</Label>
          <p className="mt-2 text-xs font-bold">{order.customerName}</p>
          <p className="mt-1 text-[11px] font-semibold text-foreground/65">
            {order.contactNumber || "No phone number provided"}
          </p>
          <div className="mt-4">
            <Label>Fulfillment detail</Label>
          </div>
          <p className="mt-2 text-xs font-bold">{fulfillment}</p>
        </div>
        <div>
          <Label>Item breakdown</Label>
          <ul className="mt-2 space-y-1 text-[11px]">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.quantity}× {item.name}
                </span>
                <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-border pt-2 text-[11px]">
            <div className="flex justify-between gap-3"><span>Item subtotal</span><strong>{formatMoney(order.subtotal)}</strong></div>
            {deliveryFee !== undefined ? <div className="flex justify-between gap-3"><span>Delivery fee</span><strong>{formatMoney(deliveryFee)}</strong></div> : null}
            <div className="flex justify-between gap-3 font-black"><span>Order total</span><span>{formatMoney(order.total)}</span></div>
          </div>
        </div>
        <div>
          <Label>Latest timeline</Label>
          <div className="mt-2 space-y-2">
            {[...order.timeline]
              .reverse()
              .slice(0, 2)
              .map((event) => (
                <div key={event.id}>
                  <p className="text-[11px] font-bold">{event.label}</p>
                  <p className="text-[10px] text-muted-foreground" title={presentTimelineActor(event.actor, state.cashier.id, state.cashier.name).technicalId}>
                    {formatDateTime(event.timestamp)} · {presentTimelineActor(event.actor, state.cashier.id, state.cashier.name).label}
                  </p>
                </div>
              ))}
            <button
              type="button"
              onClick={() => onView(order)}
              className="min-h-9 text-[10px] font-black text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Open full timeline
            </button>
          </div>
        </div>
      </div>
    </td>
  );
}

function Label({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
