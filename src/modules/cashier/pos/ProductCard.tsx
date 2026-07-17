import { memo } from "react";
import {
  AlertTriangle,
  Flame,
  History,
  Plus,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { POS_LOW_INVENTORY_THRESHOLD, formatMoney } from "../constants";
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

const productImageFor = (itemId: string) =>
  MENU_IMAGES[itemId] ?? "/menu/kare-kare.jpg";

export interface ProductCardProps {
  item: MenuItem;
  quantity: number;
  favorite: boolean;
  bestSeller: boolean;
  recentlyOrdered: boolean;
  keyboardActive: boolean;
  onSelect: () => void;
  onQuickAdd: () => void;
  onToggleFavorite: () => void;
}

export const ProductCard = memo(function ProductCard({
  item,
  quantity,
  favorite,
  bestSeller,
  recentlyOrdered,
  keyboardActive,
  onSelect,
  onQuickAdd,
  onToggleFavorite,
}: ProductCardProps) {
  const modifierCount = modifierGroupsFor(item).length;
  const lowInventory =
    item.inventoryRemaining !== undefined &&
    item.inventoryRemaining <= POS_LOW_INVENTORY_THRESHOLD;
  const soldOut = !item.available || item.inventoryRemaining === 0;

  return (
    <article
      id={`pos-product-${item.id}`}
      role="option"
      aria-selected={keyboardActive || undefined}
      className={`pos-menu-item-card group relative flex h-full flex-col overflow-hidden rounded-xl border text-left ${soldOut ? "is-unavailable" : ""} ${quantity ? "is-selected" : ""} ${keyboardActive ? "is-keyboard-active" : ""}`}
    >
      <button
        type="button"
        disabled={soldOut}
        onClick={onQuickAdd}
        aria-label={`Add ${item.code} ${item.name} to order`}
        className="pos-product-main flex min-h-0 flex-1 gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
      >
        <span className="pos-product-thumb relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
          <img
            src={item.imageUrl ?? productImageFor(item.id)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          {quantity ? (
            <b aria-label={`${quantity} in order`}>{quantity}</b>
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <b className="pos-product-code">{item.code}</b>
            <span
              className={`pos-availability ${soldOut ? "" : "is-available"}`}
            >
              <i /> {soldOut ? "Sold out" : "Ready"}
            </span>
          </span>
          <strong className="pos-product-name">{item.name}</strong>
          <span className="pos-product-price">{formatMoney(item.price)}</span>
          <span className="pos-product-signals">
            {bestSeller ? (
              <em>
                <Flame className="h-3 w-3" /> Popular
              </em>
            ) : recentlyOrdered ? (
              <em>
                <History className="h-3 w-3" /> Recent
              </em>
            ) : null}
            {lowInventory && !soldOut ? (
              <em className="is-warning">
                <AlertTriangle className="h-3 w-3" /> {item.inventoryRemaining}{" "}
                left
              </em>
            ) : null}
          </span>
        </span>
      </button>

      <div
        className={`pos-product-actions grid gap-2 px-3 pb-3 ${modifierCount ? "grid-cols-2" : ""}`}
      >
        <button
          type="button"
          disabled={soldOut}
          onClick={onQuickAdd}
          className="pos-menu-quick-add flex min-h-10 items-center justify-center gap-2 rounded-lg text-[10px] font-black"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {soldOut ? "Unavailable" : "Quick add"}
        </button>
        {modifierCount > 0 && !soldOut ? (
          <button
            type="button"
            onClick={onSelect}
            className="pos-menu-customize flex min-h-10 items-center justify-center gap-2 rounded-lg border text-[10px] font-black"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Customize
          </button>
        ) : null}
      </div>

      <button
        type="button"
        disabled={soldOut}
        onClick={onToggleFavorite}
        aria-label={
          favorite
            ? `Remove ${item.name} from favorites`
            : `Favorite ${item.name}`
        }
        aria-pressed={favorite}
        className="pos-menu-favorite absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg disabled:cursor-not-allowed"
      >
        <Star
          className={`h-3.5 w-3.5 ${favorite ? "fill-current" : ""}`}
          aria-hidden="true"
        />
      </button>
    </article>
  );
}, areProductCardPropsEqual);

function areProductCardPropsEqual(
  previous: ProductCardProps,
  next: ProductCardProps,
) {
  return (
    previous.item === next.item &&
    previous.quantity === next.quantity &&
    previous.favorite === next.favorite &&
    previous.bestSeller === next.bestSeller &&
    previous.recentlyOrdered === next.recentlyOrdered &&
    previous.keyboardActive === next.keyboardActive
  );
}
