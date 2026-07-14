import { Clock3, ImageIcon, Plus } from "lucide-react";
import { formatMoney } from "../constants";
import type { MenuItem } from "../types";

export function MenuItemCard({
  item,
  quantity,
  onSelect,
}: {
  item: MenuItem;
  quantity: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!item.available}
      onClick={onSelect}
      aria-label={`View ${item.name} details`}
      className={`group relative min-h-[188px] overflow-hidden rounded-2xl border bg-white p-2.5 text-left shadow-[0_3px_12px_rgba(67,42,23,0.04)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${item.available ? "hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_12px_24px_rgba(67,42,23,0.1)] active:scale-[0.98]" : "cursor-not-allowed border-zinc-200 opacity-65"} ${quantity ? "border-primary/50 ring-2 ring-primary/10" : "border-border"}`}
    >
      {quantity > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-white shadow"
          aria-label={`${quantity} in cart`}
        >
          {quantity}
        </span>
      )}
      <div
        className={`relative flex h-20 items-center justify-center overflow-hidden rounded-xl ${item.available ? "bg-gradient-to-br from-[#fbf4eb] to-[#f1e3d4] text-primary/35" : "bg-zinc-100 text-zinc-400"}`}
      >
        <ImageIcon
          className="h-7 w-7"
          aria-label="Menu item image placeholder"
        />
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-black leading-snug text-foreground">
            {item.name}
          </p>
          <p className="mt-1 text-sm font-black text-primary">
            {formatMoney(item.price)}
          </p>
        </div>
        {item.available && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:rotate-90 group-hover:bg-primary group-hover:text-white">
            <Plus className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-bold">
        <span
          className={`rounded-full px-2 py-0.5 ${item.available ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
        >
          {item.available ? "Available" : "Out of stock"}
        </span>
        {item.preparationMinutes && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            <Clock3 className="h-2.5 w-2.5" />
            {item.preparationMinutes} min
          </span>
        )}
      </div>
    </button>
  );
}
