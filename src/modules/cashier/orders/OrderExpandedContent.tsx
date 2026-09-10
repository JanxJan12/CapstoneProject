import { formatDateTime, formatMoney } from "../constants";
import type { Order } from "../types";

export function OrderExpandedContent({
  order,
  onView,
}: {
  order: Order;
  onView: (order: Order) => void;
}) {
  const fulfillment =
    order.type === "Dine-in"
      ? `Table ${order.tableNumber ?? "not assigned"}`
      : order.type === "Delivery"
        ? (order.deliveryAddress ?? "Address not provided")
        : "Take-out counter";

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
          <p className="mt-1 text-[11px] text-muted-foreground">
            {order.orderInstructions || "No special instructions"}
          </p>
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
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateTime(event.timestamp)} · {event.actor}
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
