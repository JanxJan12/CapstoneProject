import { Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import type { OrderItem } from "../types";
import { formatMoney } from "../constants";

export function POSCart({
  items,
  onAdjust,
  onRemove,
  onNoteChange,
  onClear,
}: {
  items: Array<Omit<OrderItem, "id">>;
  onAdjust: (menuItemId: string, delta: number) => void;
  onRemove: (menuItemId: string) => void;
  onNoteChange: (menuItemId: string, note: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#2b1b12] to-[#442718] px-4 py-3.5 text-white shadow-md">
        <div>
          <p className="text-xs font-black">Current Order</p>
          <p className="mt-0.5 text-[10px] text-white/50">
            {items.reduce((sum, item) => sum + item.quantity, 0)} items
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 rounded-lg px-2 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white"
          >
            Clear cart
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 text-muted-foreground/50">
            <UtensilsCrossed className="h-9 w-9" />
            <p className="text-xs font-bold">Tap a menu item to start</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.menuItemId}
                className="p-3.5 transition-colors hover:bg-amber-50/35"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatMoney(item.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name}`}
                      onClick={() => onAdjust(item.menuItemId, -1)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white shadow-sm transition hover:border-primary/30 hover:bg-amber-50 hover:text-primary"
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
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white shadow-sm transition hover:border-primary/30 hover:bg-amber-50 hover:text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <strong className="w-16 text-right text-xs">
                    {formatMoney(item.unitPrice * item.quantity)}
                  </strong>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onRemove(item.menuItemId)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={item.note ?? ""}
                  onChange={(event) =>
                    onNoteChange(item.menuItemId, event.target.value)
                  }
                  placeholder="Special instruction for this item…"
                  className="mt-2 min-h-9 w-full rounded-lg border border-border bg-muted/30 px-3 text-[10px] outline-none focus:border-primary/50"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
