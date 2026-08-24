import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { CashierTextarea, Label } from "../components";
import {
  MAX_POS_ITEM_QUANTITY,
  POS_ITEM_NOTE_MAX_LENGTH,
  formatMoney,
} from "../constants";
import { modifierGroupsFor } from "../constants/modifiers";
import type { MenuItem, OrderItemModifier } from "../types";
import type { POSCartLine } from "./types";

export interface ModifierDrawerProps {
  item: MenuItem;
  initialLine?: POSCartLine;
  currentQuantity: number;
  onCancel: () => void;
  onAdd: (
    item: MenuItem,
    quantity: number,
    note: string,
    modifiers: OrderItemModifier[],
  ) => void;
}

export function ModifierDrawer({
  item,
  initialLine,
  currentQuantity,
  onCancel,
  onAdd,
}: ModifierDrawerProps) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const groups = useMemo(() => modifierGroupsFor(item), [item]);
  const remaining = Math.max(0, MAX_POS_ITEM_QUANTITY - currentQuantity);

  useEffect(() => {
    setQuantity(initialLine?.quantity ?? 1);
    setNote(initialLine?.note ?? "");
    setSelectedIds(
      initialLine?.modifiers?.map((modifier) => modifier.id) ??
        modifierGroupsFor(item).flatMap((group) =>
          group.required && group.selection === "single"
            ? (group.options[0]?.id ?? [])
            : [],
        ),
    );
  }, [initialLine, item]);

  const selectedModifiers = groups.flatMap((group) =>
    group.options.filter((option) => selectedIds.includes(option.id)),
  );
  const missingRequired = groups.some(
    (group) =>
      group.required &&
      !group.options.some((option) => selectedIds.includes(option.id)),
  );
  const unitPrice =
    item.price +
    selectedModifiers.reduce((sum, modifier) => sum + modifier.price, 0);

  const toggleModifier = (groupId: string, optionId: string) => {
    const group = groups.find((entry) => entry.id === groupId);
    if (!group) return;
    setSelectedIds((current) => {
      if (group.selection === "single") {
        const groupIds = new Set(group.options.map((option) => option.id));
        const alreadySelected = current.includes(optionId);
        if (alreadySelected && !group.required) {
          return current.filter((id) => id !== optionId);
        }
        return [...current.filter((id) => !groupIds.has(id)), optionId];
      }
      return current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
    });
  };

  return (
    <section
      className="pos-side-drawer flex min-h-0 flex-1 flex-col"
      aria-label={`Customize ${item.name}`}
    >
      <header className="pos-side-drawer-header flex items-start gap-3 border-b p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-[var(--pos-orange-soft)]">
            {initialLine ? "Edit order item" : "Customize item"}
          </p>
          <h2 className="mt-1 truncate text-sm font-black">{item.name}</h2>
          <p className="mt-1 text-[10px] text-[var(--pos-muted)]">
            Base price {formatMoney(item.price)}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel customization"
          className="flex h-10 w-10 items-center justify-center rounded-lg"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2 flex w-full items-center justify-between gap-3 text-[10px] font-black">
              <span>{group.name}</span>
              <span className="text-[8px] uppercase tracking-wider text-[var(--pos-muted)]">
                {group.required ? "Required" : "Optional"}
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((option) => {
                const selected = selectedIds.includes(option.id);
                return (
                  <button
                    type="button"
                    key={option.id}
                    aria-pressed={selected}
                    onClick={() => toggleModifier(group.id, option.id)}
                    className={`pos-modifier-option flex min-h-12 items-center gap-2 rounded-lg border px-2.5 text-left text-[10px] font-bold ${selected ? "is-selected" : ""}`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border">
                      {selected ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">{option.name}</span>
                    <span className="text-[9px] text-[var(--pos-muted)]">
                      {option.price ? `+${formatMoney(option.price)}` : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div>
          <Label htmlFor="pos-custom-item-note">Item note</Label>
          <CashierTextarea
            id="pos-custom-item-note"
            value={note}
            maxLength={POS_ITEM_NOTE_MAX_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Special request for this item…"
            className="min-h-16 text-xs"
          />
        </div>
      </div>

      <footer className="pos-side-drawer-footer border-t p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="pos-cart-quantity flex items-center rounded-lg border p-0.5">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-md disabled:opacity-35"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <strong className="w-9 text-center text-sm">{quantity}</strong>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= remaining}
              onClick={() =>
                setQuantity((value) => Math.min(remaining, value + 1))
              }
              className="flex h-10 w-10 items-center justify-center rounded-md disabled:opacity-35"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--pos-muted)]">
              Item total
            </p>
            <strong className="text-base text-[var(--pos-orange-soft)]">
              {formatMoney(unitPrice * quantity)}
            </strong>
          </div>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border px-4 text-xs font-black"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!item.available || remaining === 0 || missingRequired}
            onClick={() => onAdd(item, quantity, note, selectedModifiers)}
            className="pos-place-order min-h-12 rounded-xl px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {missingRequired
              ? "Complete required choices"
              : initialLine
                ? "Update Order Item"
                : "Add to Order"}
          </button>
        </div>
      </footer>
    </section>
  );
}
