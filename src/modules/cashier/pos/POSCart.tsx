import { useRef } from "react";
import { UtensilsCrossed } from "lucide-react";
import { OrderItem } from "./OrderItem";
import type { POSCartLine } from "./types";
import type { WalkInOrderType } from "./types";

export interface POSCartProps {
  items: POSCartLine[];
  orderNumber: string;
  orderType: WalkInOrderType;
  onAdjust: (lineId: string, delta: number) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onDuplicate: (lineId: string) => void;
  onNoteChange: (lineId: string, note: string) => void;
  onCustomize?: (lineId: string) => void;
  onReorder: (sourceLineId: string, targetLineId: string) => void;
  onClear: () => void;
  embedded?: boolean;
}

export function POSCart({
  items,
  orderNumber,
  orderType,
  onAdjust,
  onQuantityChange,
  onRemove,
  onDuplicate,
  onNoteChange,
  onCustomize,
  onReorder,
  onClear,
  embedded = false,
}: POSCartProps) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const draggedLine = useRef<string | undefined>(undefined);

  return (
    <section
      className={`pos-cart flex flex-col ${embedded ? "pos-cart-embedded" : "min-h-[180px] flex-1"}`}
    >
      {!embedded ? (
        <div className="pos-cart-header flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black">Current Order</p>
              <span className="pos-cart-service-chip rounded-md border px-2 py-1 text-[9px] font-black">
                {orderType}
              </span>
            </div>
            {items.length ? (
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider">
                {orderNumber} · {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
            ) : null}
          </div>
          {items.length ? (
            <button
              type="button"
              onClick={onClear}
              className="pos-cart-clear min-h-11 rounded-lg px-3 text-[9px] font-black uppercase tracking-wider"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={`pos-cart-items min-h-0 flex-1 ${embedded ? "overflow-visible" : "overflow-y-auto"}`}
      >
        {items.length === 0 ? (
          <div className="pos-cart-empty flex h-full min-h-36 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border">
              <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-xs font-black">No items entered yet</p>
            <p className="max-w-52 text-[10px] leading-4">
              Select an item from the menu to begin.
            </p>
          </div>
        ) : (
          <div className="pos-cart-list divide-y">
            {items.map((item) => (
              <OrderItem
                key={item.lineId}
                item={item}
                onAdjust={onAdjust}
                onQuantityChange={onQuantityChange}
                onRemove={onRemove}
                onDuplicate={onDuplicate}
                onNoteChange={onNoteChange}
                onCustomize={onCustomize}
                onDragStart={(lineId) => {
                  draggedLine.current = lineId;
                }}
                onDrop={(targetLineId) => {
                  if (
                    draggedLine.current &&
                    draggedLine.current !== targetLineId
                  ) {
                    onReorder(draggedLine.current, targetLineId);
                  }
                  draggedLine.current = undefined;
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
