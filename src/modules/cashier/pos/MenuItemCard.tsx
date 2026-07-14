import { Clock3, Plus } from "lucide-react";
import { formatMoney } from "../constants";
import type { MenuItem } from "../types";

const MENU_IMAGES: Record<string, string> = {
  "MENU-01": "/menu/beef-tadyang.jpg",
  "MENU-02": "/menu/chicken-adobo.jpg",
  "MENU-03": "/menu/soup-bowl.jpg",
  "MENU-04": "/menu/bicol-express.jpg",
  "MENU-05": "/menu/kare-kare.jpg",
  "MENU-06": "/menu/pinakbet.jpg",
  "MENU-07": "/menu/fried-rice.jpg",
  "MENU-08": "/menu/fried-rice.jpg",
  "MENU-09": "/menu/softdrinks.jpg",
  "MENU-10": "/menu/buko-juice.jpg",
};

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
      className={`pos-menu-item-card group relative overflow-hidden rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${item.available ? "active:scale-[0.98]" : "cursor-not-allowed opacity-55"} ${quantity ? "is-selected" : ""}`}
    >
      {quantity > 0 && (
        <span
          className="absolute left-2 top-2 z-20 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[10px] font-black shadow"
          aria-label={`${quantity} in cart`}
        >
          {quantity}
        </span>
      )}

      <div className="pos-menu-item-image relative overflow-hidden">
        <img
          src={MENU_IMAGES[item.id] ?? "/menu/kare-kare.jpg"}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="pos-menu-item-category absolute bottom-2 left-2 rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-wider">
          {item.category}
        </span>
        {item.preparationMinutes && (
          <span className="pos-menu-item-time absolute right-2 top-2 flex items-center gap-1 rounded-md px-2 py-1 text-[8px] font-bold">
            <Clock3 className="h-2.5 w-2.5" />
            {item.preparationMinutes}m
          </span>
        )}
      </div>

      <div className="pos-menu-item-copy flex items-end justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-black leading-snug">
            {item.name}
          </p>
          <p className="mt-1.5 text-sm font-black">{formatMoney(item.price)}</p>
        </div>
        {item.available && (
          <span className="pos-menu-item-add flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all group-hover:rotate-90">
            <Plus className="h-4 w-4" />
          </span>
        )}
      </div>

      {!item.available && (
        <span className="pos-menu-unavailable absolute inset-x-3 top-3 rounded-lg px-3 py-2 text-center text-[9px] font-black uppercase tracking-wider">
          Unavailable
        </span>
      )}
    </button>
  );
}
