import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Minus,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import {
  CashierButton,
  CashierDialogContent,
  CashierTextarea,
  Label,
} from "../components";
import {
  MAX_POS_ITEM_QUANTITY,
  POS_ITEM_NOTE_MAX_LENGTH,
  formatMoney,
} from "../constants";
import { modifierGroupsFor } from "../constants/modifiers";
import type { MenuItem, OrderItemModifier } from "../types";
import { productImageFor } from "./ProductCard";

export interface ModifierModalProps {
  item?: MenuItem;
  currentQuantity: number;
  onClose: () => void;
  onAdd: (
    item: MenuItem,
    quantity: number,
    note: string,
    modifiers: OrderItemModifier[],
  ) => void;
}

export function ModifierModal({
  item,
  currentQuantity,
  onClose,
  onAdd,
}: ModifierModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const groups = useMemo(() => (item ? modifierGroupsFor(item) : []), [item]);
  const remaining = Math.max(
    0,
    Math.min(
      MAX_POS_ITEM_QUANTITY - currentQuantity,
      (item?.inventoryRemaining ?? MAX_POS_ITEM_QUANTITY) - currentQuantity,
    ),
  );

  useEffect(() => {
    if (!item) return;
    setQuantity(1);
    setNote("");
    setSelectedIds(
      modifierGroupsFor(item).flatMap((group) =>
        group.required && group.selection === "single"
          ? (group.options[0]?.id ?? [])
          : [],
      ),
    );
  }, [item]);

  if (!item) return null;

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <CashierDialogContent className="max-w-xl overflow-hidden p-0">
        <div className="relative h-44 overflow-hidden bg-[#f1e3d4] sm:h-48">
          <img
            src={item.imageUrl ?? productImageFor(item.id)}
            alt={item.name}
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-bold text-white">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            {item.preparationMinutes ?? 5} min preparation
          </div>
        </div>
        <div className="max-h-[calc(100dvh-14rem)] space-y-4 overflow-y-auto p-5 pt-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {item.category}
                </p>
                <DialogTitle className="mt-1">{item.name}</DialogTitle>
              </div>
              <p className="text-lg font-black text-primary">
                {formatMoney(unitPrice)}
              </p>
            </div>
            <DialogDescription>{item.description}</DialogDescription>
          </DialogHeader>

          {groups.length ? (
            <div className="space-y-4" aria-label="Item modifiers">
              <div className="flex items-center gap-2 text-xs font-black">
                <SlidersHorizontal
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                Customize item
              </div>
              {groups.map((group) => (
                <fieldset key={group.id}>
                  <legend className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {group.name}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[8px] ${group.required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {group.required ? "Required" : "Optional"} ·{" "}
                      {group.selection === "single"
                        ? "Single select"
                        : "Multi select"}
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
                          className={`pos-modifier-option flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-xs font-bold transition ${selected ? "is-selected" : ""}`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border">
                            {selected ? (
                              <Check className="h-3 w-3" aria-hidden="true" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">{option.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {option.price
                              ? `+${formatMoney(option.price)}`
                              : "Free"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}

          <div>
            <Label htmlFor="item-note">Special request</Label>
            <CashierTextarea
              id="item-note"
              value={note}
              maxLength={POS_ITEM_NOTE_MAX_LENGTH}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: sauce on the side or allergy note"
              className="text-xs"
            />
            <p className="mt-1 text-right text-[9px] text-muted-foreground">
              {note.length}/{POS_ITEM_NOTE_MAX_LENGTH}
            </p>
          </div>

          <DialogFooter className="sticky bottom-0 -mx-5 border-t border-border bg-[#fffdf9] px-5 py-4 sm:items-center sm:justify-between">
            <div className="flex items-center rounded-xl border border-border bg-white p-1 shadow-sm">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-9 text-center text-sm font-black">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= remaining}
                onClick={() =>
                  setQuantity((value) => Math.min(remaining, value + 1))
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <CashierButton
              size="lg"
              disabled={!item.available || remaining === 0 || missingRequired}
              onClick={() => {
                onAdd(item, quantity, note, selectedModifiers);
                onClose();
              }}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              {remaining === 0
                ? "Maximum in cart"
                : missingRequired
                  ? "Choose required option"
                  : `Add ${quantity} · ${formatMoney(unitPrice * quantity)}`}
            </CashierButton>
          </DialogFooter>
        </div>
      </CashierDialogContent>
    </Dialog>
  );
}
