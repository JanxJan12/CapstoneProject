import type { RefObject } from "react";
import type { MenuItem } from "../types";
import { CartCheckoutBar } from "./CartCheckoutBar";
import { MealRecommendations } from "./MealRecommendations";
import type { MealRecommendations as MealRecommendationsModel } from "./posOperations";
import { POSCart } from "./POSCart";
import type { POSCartLine, WalkInOrderType } from "./types";

export interface CartPanelProps {
  items: POSCartLine[];
  orderNumber: string;
  orderType: WalkInOrderType;
  subtotal: number;
  discountAmount: number;
  total: number;
  itemCount: number;
  recommendations: MealRecommendationsModel;
  checkoutRef?: RefObject<HTMLButtonElement | null>;
  onAdjust: (lineId: string, delta: number) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onDuplicate: (lineId: string) => void;
  onNoteChange: (lineId: string, note: string) => void;
  onReorder: (sourceLineId: string, targetLineId: string) => void;
  onClear: () => void;
  onAddRecommendation: (item: MenuItem) => void;
  onCheckout: () => void;
}

export function CartPanel({
  items,
  orderNumber,
  orderType,
  subtotal,
  discountAmount,
  total,
  itemCount,
  recommendations,
  checkoutRef,
  onAdjust,
  onQuantityChange,
  onRemove,
  onDuplicate,
  onNoteChange,
  onReorder,
  onClear,
  onAddRecommendation,
  onCheckout,
}: CartPanelProps) {
  return (
    <section className="pos-cart-panel flex min-h-0 flex-1 flex-col">
      <POSCart
        items={items}
        orderNumber={orderNumber}
        orderType={orderType}
        onAdjust={onAdjust}
        onQuantityChange={onQuantityChange}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onNoteChange={onNoteChange}
        onReorder={onReorder}
        onClear={onClear}
      />
      {items.length ? (
        <MealRecommendations
          recommendations={recommendations}
          onAdd={onAddRecommendation}
        />
      ) : null}
      <CartCheckoutBar
        subtotal={subtotal}
        discountAmount={discountAmount}
        total={total}
        itemCount={itemCount}
        checkoutRef={checkoutRef}
        onCheckout={onCheckout}
      />
    </section>
  );
}
