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
} from "../components/CashierUI";
import { formatMoney } from "../constants";
import { modifierGroupsFor } from "../constants/modifiers";
import type { MenuItem, OrderItemModifier } from "../types";
import { menuImageFor } from "./MenuItemCard";

export function MenuItemDialog({
  item,
  currentQuantity,
  onClose,
  onAdd,
}: {
  item?: MenuItem;
  currentQuantity: number;
  onClose: () => void;
  onAdd: (
    item: MenuItem,
    quantity: number,
    note: string,
    modifiers: OrderItemModifier[],
  ) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const groups = useMemo(() => (item ? modifierGroupsFor(item) : []), [item]);
  const remaining = Math.max(
    0,
    Math.min(
      99 - currentQuantity,
      (item?.inventoryRemaining ?? 99) - currentQuantity,
    ),
  );

  useEffect(() => {
    if (!item) return;
    setQuantity(1);
    setNote("");
    setSelectedIds(
      modifierGroupsFor(item)
        .filter((group) => group.selection === "single")
        .flatMap((group) => group.options[0]?.id ?? []),
    );
  }, [item]);

  if (!item) return null;

  const selectedModifiers = groups.flatMap((group) =>
    group.options.filter((option) => selectedIds.includes(option.id)),
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
            src={menuImageFor(item.id)}
            alt={item.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-bold text-white">
            <Clock3 className="h-4 w-4" />
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

          {groups.length > 0 && (
            <div className="space-y-4" aria-label="Item modifiers">
              <div className="flex items-center gap-2 text-xs font-black">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Customize item
              </div>
              {groups.map((group) => (
                <fieldset key={group.id}>
                  <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {group.name}
                    <span className="ml-1 normal-case tracking-normal">
                      · {group.selection === "single" ? "Choose one" : "Optional"}
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
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 flex-1">{option.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {option.price ? `+${formatMoney(option.price)}` : "Free"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          <div>
            <Label htmlFor="item-note">Special request</Label>
            <CashierTextarea
              id="item-note"
              value={note}
              maxLength={120}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: sauce on the side or allergy note"
              className="text-xs"
            />
            <p className="mt-1 text-right text-[9px] text-muted-foreground">
              {note.length}/120
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
                <Minus className="h-4 w-4" />
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
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <CashierButton
              size="lg"
              disabled={!item.available || remaining === 0}
              onClick={() => {
                onAdd(item, quantity, note, selectedModifiers);
                onClose();
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              {remaining === 0
                ? "Maximum in cart"
                : `Add ${quantity} · ${formatMoney(unitPrice * quantity)}`}
            </CashierButton>
          </DialogFooter>
        </div>
      </CashierDialogContent>
    </Dialog>
  );
}
