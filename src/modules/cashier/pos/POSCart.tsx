import { useRef, useState } from "react";
import {
  GripVertical,
  Minus,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { formatMoney } from "../constants";
import { CashierInput } from "../components";
import type { POSCartLine } from "./types";

export function POSCart({
  items,
  orderNumber,
  orderType,
  onAdjust,
  onQuantityChange,
  onRemove,
  onNoteChange,
  onReorder,
  onClear,
}: {
  items: POSCartLine[];
  orderNumber: string;
  orderType: "Dine-in" | "Take-out";
  onAdjust: (lineId: string, delta: number) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onNoteChange: (lineId: string, note: string) => void;
  onReorder: (sourceLineId: string, targetLineId: string) => void;
  onClear: () => void;
}) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const draggedLine = useRef<string | undefined>(undefined);
  const pointer = useRef<{ lineId: string; startX: number } | undefined>(
    undefined,
  );
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});

  const finishSwipe = (lineId: string) => {
    const offset = swipeOffsets[lineId] ?? 0;
    if (offset <= -72) onRemove(lineId);
    setSwipeOffsets((current) => ({ ...current, [lineId]: 0 }));
    pointer.current = undefined;
  };

  return (
    <section className="pos-cart flex min-h-[240px] flex-1 flex-col">
      <div className="pos-cart-header flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-black">Current Order</p>
            <span className="pos-cart-service-chip rounded-md border px-2 py-1 text-[9px] font-black">
              {orderType}
            </span>
          </div>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider">
            {orderNumber} · {itemCount} {itemCount === 1 ? "item" : "items"}
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

      <div className="pos-cart-items min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="pos-cart-empty flex h-full min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border">
              <UtensilsCrossed className="h-6 w-6" />
            </span>
            <p className="text-xs font-black">Ready for the first item</p>
            <p className="max-w-52 text-[10px] leading-4">
              Use Quick add for speed, or open a product to add modifiers.
            </p>
          </div>
        ) : (
          <div className="pos-cart-list divide-y">
            {items.map((item) => (
              <div
                key={item.lineId}
                className="pos-cart-swipe-shell relative overflow-hidden"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (
                    draggedLine.current &&
                    draggedLine.current !== item.lineId
                  ) {
                    onReorder(draggedLine.current, item.lineId);
                  }
                  draggedLine.current = undefined;
                }}
              >
                <div className="pos-swipe-delete absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1 text-[10px] font-black text-white">
                  <Trash2 className="h-4 w-4" /> Remove
                </div>
                <article
                  className="pos-cart-item relative p-3 transition-transform"
                  style={{
                    transform: `translateX(${swipeOffsets[item.lineId] ?? 0}px)`,
                    touchAction: "pan-y",
                  }}
                  onPointerDown={(event) => {
                    if (event.pointerType !== "touch") return;
                    const target = event.target as HTMLElement;
                    if (target.closest("button, input, textarea, summary"))
                      return;
                    pointer.current = {
                      lineId: item.lineId,
                      startX: event.clientX,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (pointer.current?.lineId !== item.lineId) return;
                    const offset = Math.max(
                      -96,
                      Math.min(0, event.clientX - pointer.current.startX),
                    );
                    setSwipeOffsets((current) => ({
                      ...current,
                      [item.lineId]: offset,
                    }));
                  }}
                  onPointerUp={() => finishSwipe(item.lineId)}
                  onPointerCancel={() => finishSwipe(item.lineId)}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        draggedLine.current = item.lineId;
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item.lineId);
                      }}
                      aria-label={`Drag ${item.name} to reorder`}
                      title="Drag to reorder"
                      className="pos-cart-drag flex h-10 w-6 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="pos-cart-quantity flex shrink-0 items-center rounded-lg border p-0.5">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        onClick={() => onAdjust(item.lineId, -1)}
                        className="flex h-10 w-9 items-center justify-center rounded-md transition"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="99"
                        value={item.quantity}
                        aria-label={`Quantity for ${item.name}`}
                        onChange={(event) =>
                          onQuantityChange(
                            item.lineId,
                            Math.min(
                              99,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          )
                        }
                        className="h-9 w-8 border-0 bg-transparent p-0 text-center text-xs font-black outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => onAdjust(item.lineId, 1)}
                        className="flex h-10 w-9 items-center justify-center rounded-md transition"
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
                      onClick={() => onRemove(item.lineId)}
                      className="pos-cart-remove flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {item.modifiers?.length ? (
                    <div className="pos-cart-modifiers ml-8 mt-2 flex flex-wrap gap-1">
                      {item.modifiers.map((modifier) => (
                        <span
                          key={modifier.id}
                          className="rounded-md px-2 py-1 text-[9px] font-bold"
                        >
                          {modifier.name}
                          {modifier.price > 0
                            ? ` +${formatMoney(modifier.price)}`
                            : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <details className="pos-cart-item-note ml-8 mt-2">
                    <summary className="cursor-pointer text-[9px] font-bold">
                      {item.note ? "Edit special request" : "+ Add item note"}
                    </summary>
                    <CashierInput
                      value={item.note ?? ""}
                      maxLength={120}
                      aria-label={`Instruction for ${item.name}`}
                      onChange={(event) =>
                        onNoteChange(item.lineId, event.target.value)
                      }
                      placeholder="Special request for this item…"
                      className="mt-2 min-h-10 rounded-lg text-[10px]"
                    />
                  </details>
                  <span className="sr-only">
                    Swipe left to remove this item.
                  </span>
                </article>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
