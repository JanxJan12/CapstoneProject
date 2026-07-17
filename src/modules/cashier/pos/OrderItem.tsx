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
import { CashierInput } from "../components";
import {
  MAX_POS_ITEM_QUANTITY,
  POS_ITEM_NOTE_MAX_LENGTH,
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
    onNoteChange,
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
              title="Edit modifiers"
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
            className="pos-cart-drag flex h-10 w-6 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black">{item.name}</p>
                <p className="mt-1 text-[9px] text-[var(--pos-muted)]">
                  {formatMoney(item.unitPrice)} each
                </p>
              </div>
              <strong className="shrink-0 text-xs">
                {formatMoney(item.unitPrice * item.quantity)}
              </strong>
            </div>

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

        <div className="mt-2 flex items-center gap-2 pl-8">
          <div className="pos-cart-quantity flex items-center rounded-lg border p-0.5">
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
          <details className="pos-cart-item-note min-w-0 flex-1">
            <summary className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-[9px] font-bold">
              {item.note ? "Edit note" : "+ Note"}
            </summary>
            <CashierInput
              value={item.note ?? ""}
              maxLength={POS_ITEM_NOTE_MAX_LENGTH}
              aria-label={`Instruction for ${item.name}`}
              onChange={(event) =>
                onNoteChange(item.lineId, event.target.value)
              }
              placeholder="Special request…"
              className="mt-1 min-h-10 rounded-lg text-[10px]"
            />
          </details>
          <button
            type="button"
            aria-label={`Duplicate ${item.name}`}
            title="Duplicate item"
            onClick={() => onDuplicate(item.lineId)}
            className="pos-cart-duplicate flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition"
          >
            <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${item.name}`}
            title="Remove item"
            onClick={() => onRemove(item.lineId)}
            className="pos-cart-remove flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </article>
    );
  },
  (previous, next) => previous.item === next.item,
);
