import { memo } from "react";
import {
  ChevronDown,
  CopyPlus,
  GripVertical,
  Minus,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  MAX_POS_ITEM_QUANTITY,
  formatMoney,
} from "../constants";
import type { POSCartLine } from "./types";

export interface OrderItemProps {
  item: POSCartLine;
  onAdjust: (lineId: string, delta: number) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onDuplicate?: (lineId: string) => void;
  onCustomize?: (lineId: string) => void;
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
    onCustomize,
    onDragStart,
    onDrop,
  }: OrderItemProps) {
    return (
      <article
        className="pos-cart-item p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onDrop(item.lineId)}
      >
        <div className="flex items-start gap-2">
          {onCustomize ? (
            <button
              type="button"
              aria-label={`Edit choices for ${item.name}`}
              title="Edit order item"
              onClick={() => onCustomize(item.lineId)}
              className="pos-cart-edit flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
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
            className="pos-cart-drag flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{item.name}</p>
                <p className="mt-1 text-xs text-[var(--pos-muted)]">
                  {formatMoney(item.unitPrice)} each
                </p>
              </div>
              <strong className="shrink-0 text-sm">
                {formatMoney(item.unitPrice * item.quantity)}
              </strong>
            </div>

            {item.mealOption ? (
              <p className="mt-1 text-xs font-semibold text-[var(--pos-muted)]">
                {item.mealOption === "with_rice" ? "With Rice" : "Without Rice"}
              </p>
            ) : null}
            {item.modifiers?.length ? (
              <details className="pos-cart-modifiers mt-2">
                <summary className="flex min-h-7 cursor-pointer items-center gap-1 text-[9px] font-bold">
                  <ChevronDown className="h-3 w-3 transition-transform" />
                  {item.modifiers.map((modifier) => modifier.name).join(", ")}
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

            {item.note ? (
              <p className="mt-2 rounded-md bg-white/5 px-2 py-1.5 text-[9px] italic text-[var(--pos-muted)]">
                Note: {item.note}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 pl-10">
          <div className="pos-cart-quantity flex items-center rounded-lg border p-0.5">
            <button
              type="button"
              aria-label={`Decrease ${item.name}`}
              disabled={item.quantity <= 1}
              onClick={() => onAdjust(item.lineId, -1)}
              className="flex h-11 w-11 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Minus className="h-5 w-5" aria-hidden="true" />
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
              className="h-11 w-10 border-0 bg-transparent p-0 text-center text-sm font-black outline-none"
            />
            <button
              type="button"
              aria-label={`Increase ${item.name}`}
              onClick={() => onAdjust(item.lineId, 1)}
              className="flex h-11 w-11 items-center justify-center rounded-md transition"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {onDuplicate ? (
            <button
              type="button"
              aria-label={`Duplicate ${item.name}`}
              title="Duplicate item"
              onClick={() => onDuplicate(item.lineId)}
              className="pos-cart-duplicate flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition"
            >
              <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`Remove ${item.name}`}
            title="Remove item"
            onClick={() => onRemove(item.lineId)}
            className="pos-cart-remove ml-auto flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            <span>Remove</span>
          </button>
        </div>
      </article>
    );
  },
  (previous, next) => previous.item === next.item,
);
