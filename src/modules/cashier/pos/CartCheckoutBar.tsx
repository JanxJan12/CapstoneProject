import type { RefObject } from "react";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { formatMoney } from "../constants";

export function CartCheckoutBar({
  subtotal,
  discountAmount,
  total,
  itemCount,
  checkoutRef,
  onCheckout,
}: {
  subtotal: number;
  discountAmount: number;
  total: number;
  itemCount: number;
  checkoutRef?: RefObject<HTMLButtonElement | null>;
  onCheckout: () => void;
}) {
  return (
    <section className="pos-cart-checkout shrink-0 border-t p-4">
      <div className="mb-3 space-y-1.5 text-[10px] text-[var(--pos-muted)]">
        <div className="flex justify-between gap-3">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        {discountAmount > 0 ? (
          <div className="pos-discount-row flex justify-between gap-3 font-bold">
            <span>Discount</span>
            <span>−{formatMoney(discountAmount)}</span>
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-4 border-t border-[var(--pos-line-soft)] pt-2">
          <div>
            <p className="text-xs font-black text-[var(--pos-text)]">
              Grand total
            </p>
            <p className="mt-1 text-[9px] font-semibold">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <strong className="text-xl font-black text-[var(--pos-orange-soft)]">
            {formatMoney(total)}
          </strong>
        </div>
      </div>
      <button
        ref={checkoutRef}
        type="button"
        disabled={!itemCount}
        onClick={onCheckout}
        aria-keyshortcuts="F3"
        className="pos-proceed-checkout flex min-h-14 w-full items-center rounded-xl px-4 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        <span className="ml-2 text-sm font-black">Checkout</span>
        <kbd className="ml-auto text-[9px] font-black text-white/65">F3</kbd>
        <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
      </button>
    </section>
  );
}
