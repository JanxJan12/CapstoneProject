import { Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import type { OrderItem } from "../types";
import { formatMoney } from "../constants";

export function POSCart({
  items,
  orderType,
  tableNumber,
  onAdjust,
  onRemove,
  onNoteChange,
  onClear,
}: {
  items: Array<Omit<OrderItem, "id">>;
  orderType: "Dine-in" | "Take-out";
  tableNumber?: string;
  onAdjust: (menuItemId: string, delta: number) => void;
  onRemove: (menuItemId: string) => void;
  onNoteChange: (menuItemId: string, note: string) => void;
  onClear: () => void;
}) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="pos-cart flex min-h-0 flex-1 flex-col">
      <div className="pos-cart-header flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-black">Current Order</p>
            <span className="pos-cart-service-chip rounded-md border px-2 py-1 text-[9px] font-black">
              {orderType === "Dine-in" && tableNumber
                ? `Table ${tableNumber}`
                : orderType}
            </span>
          </div>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider">
            {itemCount} {itemCount === 1 ? "item" : "items"} selected
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="pos-cart-clear min-h-11 rounded-lg px-3 text-[9px] font-black uppercase tracking-wider"
          >
            Clear
          </button>
        )}
      </div>

      <div className="pos-cart-items flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="pos-cart-empty flex h-full min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border">
              <UtensilsCrossed className="h-6 w-6" />
            </span>
            <p className="text-xs font-black">Your order is ready to fill</p>
            <p className="max-w-48 text-[10px] leading-4">
              Tap a menu card to add the first item.
            </p>
          </div>
        ) : (
          <div className="pos-cart-list divide-y">
            {items.map((item) => (
              <article key={item.menuItemId} className="pos-cart-item p-3">
                <div className="flex items-center gap-2">
                  <div className="pos-cart-quantity flex shrink-0 items-center rounded-lg border p-0.5">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name}`}
                      onClick={() => onAdjust(item.menuItemId, -1)}
                      className="flex h-10 w-10 items-center justify-center rounded-md transition"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-xs font-black">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name}`}
                      onClick={() => onAdjust(item.menuItemId, 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-md transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black">{item.name}</p>
                    <p className="mt-1 text-[9px]">
                      {formatMoney(item.unitPrice)} each
                    </p>
                  </div>
                  <strong className="w-16 text-right text-xs">
                    {formatMoney(item.unitPrice * item.quantity)}
                  </strong>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onRemove(item.menuItemId)}
                    className="pos-cart-remove flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <details className="pos-cart-item-note mt-1.5">
                  <summary className="cursor-pointer text-[9px] font-bold">
                    {item.note ? "Edit item note" : "+ Add item note"}
                  </summary>
                  <input
                    value={item.note ?? ""}
                    onChange={(event) =>
                      onNoteChange(item.menuItemId, event.target.value)
                    }
                    placeholder="Special instruction for this item…"
                    className="mt-2 min-h-10 w-full rounded-lg border px-3 text-[10px] outline-none"
                  />
                </details>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
