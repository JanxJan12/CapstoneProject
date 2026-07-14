import { useEffect, useState } from "react";
import { Clock3, ImageIcon, Minus, Plus, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { CashierButton } from "../components/CashierUI";
import { formatMoney } from "../constants";
import type { MenuItem } from "../types";

export function MenuItemDialog({
  item,
  currentQuantity,
  onClose,
  onAdd,
}: {
  item?: MenuItem;
  currentQuantity: number;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number, note: string) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const remaining = Math.max(0, 99 - currentQuantity);

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setNote("");
    }
  }, [item]);

  if (!item) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="flex h-44 items-center justify-center bg-gradient-to-br from-[#fbf4eb] to-[#f1e3d4] text-primary/30">
          <ImageIcon className="h-12 w-12" aria-hidden="true" />
        </div>
        <div className="space-y-4 p-5 pt-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {item.category}
                </p>
                <DialogTitle className="mt-1">{item.name}</DialogTitle>
              </div>
              <p className="text-lg font-black text-primary">
                {formatMoney(item.price)}
              </p>
            </div>
            <DialogDescription>{item.description}</DialogDescription>
          </DialogHeader>

          {item.preparationMinutes && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs font-bold text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              About {item.preparationMinutes} minutes preparation time
            </div>
          )}

          <div>
            <label
              htmlFor="item-note"
              className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground"
            >
              Item instruction
            </label>
            <textarea
              id="item-note"
              value={note}
              maxLength={120}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: no onions, sauce on the side"
              className="min-h-20 w-full rounded-xl border border-border bg-[#fbf8f4] p-3 text-xs outline-none transition focus:border-primary/50 focus:bg-white focus:ring-4 focus:ring-primary/10"
            />
            <p className="mt-1 text-right text-[9px] text-muted-foreground">
              {note.length}/120
            </p>
          </div>

          <DialogFooter className="items-center sm:justify-between">
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
              disabled={!item.available || remaining === 0}
              onClick={() => {
                onAdd(item, quantity, note);
                onClose();
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              {remaining === 0
                ? "Maximum in cart"
                : `Add · ${formatMoney(item.price * quantity)}`}
            </CashierButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
