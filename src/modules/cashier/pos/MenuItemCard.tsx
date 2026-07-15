import {
  AlertTriangle,
  Clock3,
  Flame,
  History,
  Plus,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { formatMoney } from "../constants";
import { modifierGroupsFor } from "../constants/modifiers";
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

export const menuImageFor = (itemId: string) =>
  MENU_IMAGES[itemId] ?? "/menu/kare-kare.jpg";

export function MenuItemCard({
  item,
  quantity,
  favorite,
  bestSeller,
  recentlyOrdered,
  onSelect,
  onQuickAdd,
  onToggleFavorite,
}: {
  item: MenuItem;
  quantity: number;
  favorite: boolean;
  bestSeller: boolean;
  recentlyOrdered: boolean;
  onSelect: () => void;
  onQuickAdd: () => void;
  onToggleFavorite: () => void;
}) {
  const modifierCount = modifierGroupsFor(item).length;
  const lowInventory =
    item.inventoryRemaining !== undefined && item.inventoryRemaining <= 5;

  return (
    <article
      className={`pos-menu-item-card group relative h-full overflow-hidden rounded-xl border text-left transition-all duration-200 ${item.available ? "" : "is-unavailable opacity-60"} ${quantity ? "is-selected" : ""}`}
    >
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-label={
          favorite
            ? `Remove ${item.name} from favorites`
            : `Favorite ${item.name}`
        }
        aria-pressed={favorite}
        className="pos-menu-favorite absolute right-2 top-2 z-30 flex h-10 w-10 items-center justify-center rounded-lg"
      >
        <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
      </button>

      {quantity > 0 && (
        <span
          className="absolute left-2 top-2 z-20 flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-black shadow"
          aria-label={`${quantity} in cart`}
        >
          {quantity}
        </span>
      )}

      <button
        type="button"
        disabled={!item.available}
        onClick={onSelect}
        aria-label={`Configure ${item.name}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
      >
        <div className="pos-menu-item-image relative overflow-hidden">
          <img
            src={menuImageFor(item.id)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
          <span className="pos-menu-item-category absolute bottom-2 left-2 rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-wider">
            {item.category}
          </span>
          {item.preparationMinutes && (
            <span className="pos-menu-item-time absolute bottom-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-[8px] font-bold">
              <Clock3 className="h-2.5 w-2.5" />
              {item.preparationMinutes}m
            </span>
          )}
        </div>

        <div className="pos-menu-item-copy p-3 pb-2">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-black leading-snug">
                {item.name}
              </p>
              <p className="mt-1.5 text-base font-black">
                {formatMoney(item.price)}
              </p>
            </div>
            <span
              className={`pos-availability mt-0.5 inline-flex shrink-0 items-center gap-1 text-[9px] font-black ${item.available ? "is-available" : ""}`}
            >
              <span className="h-2 w-2 rounded-full" />
              {item.available ? "Available" : "Sold out"}
            </span>
          </div>

          <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
            {bestSeller && (
              <span className="pos-product-signal">
                <Flame className="h-3 w-3" /> Best seller
              </span>
            )}
            {!bestSeller && recentlyOrdered && (
              <span className="pos-product-signal">
                <History className="h-3 w-3" /> Recent
              </span>
            )}
            {modifierCount > 0 && (
              <span className="pos-product-signal">
                <SlidersHorizontal className="h-3 w-3" /> Modifiers
              </span>
            )}
            {lowInventory && item.available && (
              <span className="pos-product-signal is-warning">
                <AlertTriangle className="h-3 w-3" /> Only{" "}
                {item.inventoryRemaining}
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="px-3 pb-3">
        <button
          type="button"
          disabled={!item.available}
          onClick={onQuickAdd}
          className="pos-menu-quick-add flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-xs font-black transition disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          {item.available ? "Quick add" : "Unavailable"}
        </button>
      </div>

      {!item.available && (
        <span className="pos-menu-unavailable pointer-events-none absolute inset-x-3 top-14 z-20 rounded-lg px-3 py-2 text-center text-[9px] font-black uppercase tracking-wider">
          Temporarily unavailable
        </span>
      )}
    </article>
  );
}
