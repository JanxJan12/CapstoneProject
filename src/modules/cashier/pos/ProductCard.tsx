import { memo } from "react";
import { Flame, Plus } from "lucide-react";
import { formatMoney } from "../constants";
import { drinkChoiceGroupsFor } from "../constants/drinkChoices";
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
  bestSeller: boolean;
  keyboardActive: boolean;
  onSelect: () => void;
  onQuickAdd: () => void;
}

export const ProductCard = memo(function ProductCard({
  item,
  quantity,
  bestSeller,
  keyboardActive,
  onSelect,
  onQuickAdd,
}: ProductCardProps) {
  const drinkChoiceCount = drinkChoiceGroupsFor(item).length;
  const hasMealChoice = item.withoutRicePrice !== undefined;
  const requiresChoice = hasMealChoice || drinkChoiceCount > 0;
  const soldOut = !item.available;

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
        onClick={requiresChoice ? onSelect : onQuickAdd}
        aria-label={`${requiresChoice ? "Choose options for" : "Add"} ${item.code} ${item.name}${requiresChoice ? "" : " to order"}`}
        className="pos-product-main flex min-h-0 flex-1 items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
      >
        <span className="pos-product-thumb relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
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
          <span className="flex items-center gap-2"><b className="pos-product-code">{item.code}</b>{soldOut ? <span className="pos-availability">Sold out</span> : null}</span>
          <strong className="pos-product-name">{item.name}</strong>
          <span className="pos-product-price">{formatMoney(item.price)}</span>
          {bestSeller && !soldOut ? <span className="pos-product-signals"><em><Flame className="h-3 w-3" /> Popular</em></span> : null}
        </span>
        {!soldOut ? (
          <span className="pos-product-add-icon pos-product-action shrink-0 rounded-lg border" aria-hidden="true">
            <Plus className="h-4 w-4" />
            <span>{requiresChoice ? "Choose options" : "Add"}</span>
          </span>
        ) : null}
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
    previous.bestSeller === next.bestSeller &&
    previous.keyboardActive === next.keyboardActive
  );
}
