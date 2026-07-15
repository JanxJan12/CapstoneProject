import { memo, useRef, useState } from "react";
import {
  ChevronDown,
  CopyPlus,
  GripVertical,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { CashierInput } from "../components";
import {
  MAX_POS_ITEM_QUANTITY,
  POS_ITEM_NOTE_MAX_LENGTH,
  POS_SWIPE_DELETE_THRESHOLD_PX,
  POS_SWIPE_MAX_OFFSET_PX,
  formatMoney,
} from "../constants";
import type { POSCartLine } from "./types";

export interface OrderItemProps {
  item: POSCartLine;
  onAdjust: (lineId: string, delta: number) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onDuplicate: (lineId: string) => void;
  onNoteChange: (lineId: string, note: string) => void;
  onDragStart: (lineId: string) => void;
  onDrop: (lineId: string) => void;
}

export const OrderItem = memo(
  function OrderItem({
    item,
    onAdjust,
    onQuantityChange,
    onRemove,
    onDuplicate,
    onNoteChange,
    onDragStart,
    onDrop,
  }: OrderItemProps) {
    const pointer = useRef<{ startX: number } | undefined>(undefined);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const finishSwipe = () => {
      if (swipeOffset <= -POS_SWIPE_DELETE_THRESHOLD_PX) onRemove(item.lineId);
      setSwipeOffset(0);
      pointer.current = undefined;
    };

    return (
      <div
        className="pos-cart-swipe-shell relative overflow-hidden"
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onDrop(item.lineId)}
      >
        <div className="pos-swipe-delete absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1 text-[10px] font-black text-white">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
        </div>
        <article
          className="pos-cart-item relative p-3 transition-transform duration-150"
          style={{
            transform: `translateX(${swipeOffset}px)`,
            touchAction: "pan-y",
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") return;
            const target = event.target as HTMLElement;
            if (target.closest("button, input, textarea, summary")) return;
            pointer.current = { startX: event.clientX };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!pointer.current) return;
            setSwipeOffset(
              Math.max(
                -POS_SWIPE_MAX_OFFSET_PX,
                Math.min(0, event.clientX - pointer.current.startX),
              ),
            );
          }}
          onPointerUp={finishSwipe}
          onPointerCancel={finishSwipe}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                onDragStart(item.lineId);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.lineId);
              }}
              aria-label={`Drag ${item.name} to reorder`}
              title="Drag to reorder"
              className="pos-cart-drag flex h-10 w-6 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="pos-cart-quantity flex shrink-0 items-center rounded-lg border p-0.5">
              <button
                type="button"
                aria-label={`Decrease ${item.name}`}
                disabled={item.quantity <= 1}
                onClick={() => onAdjust(item.lineId, -1)}
                className="flex h-10 w-9 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={MAX_POS_ITEM_QUANTITY}
                value={item.quantity}
                aria-label={`Quantity for ${item.name}`}
                onChange={(event) =>
                  onQuantityChange(
                    item.lineId,
                    Math.min(
                      MAX_POS_ITEM_QUANTITY,
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
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
              aria-label={`Duplicate ${item.name}`}
              title="Duplicate item"
              onClick={() => onDuplicate(item.lineId)}
              className="pos-cart-duplicate flex h-11 w-10 shrink-0 items-center justify-center rounded-lg transition"
            >
              <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() => onRemove(item.lineId)}
              className="pos-cart-remove flex h-11 w-10 shrink-0 items-center justify-center rounded-lg transition"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {item.modifiers?.length ? (
            <details className="pos-cart-modifiers ml-8 mt-2">
              <summary className="flex min-h-8 cursor-pointer items-center gap-1 text-[9px] font-bold">
                <ChevronDown className="h-3 w-3 transition-transform" />
                {item.modifiers.length} modifier
                {item.modifiers.length === 1 ? "" : "s"}
              </summary>
              <div className="flex flex-wrap gap-1 pt-1">
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
            </details>
          ) : null}

          <details className="pos-cart-item-note ml-8 mt-1">
            <summary className="cursor-pointer py-1 text-[9px] font-bold">
              {item.note ? "Edit item note" : "+ Add item note"}
            </summary>
            <CashierInput
              value={item.note ?? ""}
              maxLength={POS_ITEM_NOTE_MAX_LENGTH}
              aria-label={`Instruction for ${item.name}`}
              onChange={(event) =>
                onNoteChange(item.lineId, event.target.value)
              }
              placeholder="Special request for this item…"
              className="mt-1 min-h-10 rounded-lg text-[10px]"
            />
          </details>
          <span className="sr-only">Swipe left to remove this item.</span>
        </article>
      </div>
    );
  },
  (previous, next) => previous.item === next.item,
);
