import type { RefObject } from "react";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { formatMoney } from "../constants";

export function CartCheckoutBar({
  total,
  itemCount,
  disabledReason,
  checkoutRef,
  onCheckout,
}: {
  total: number;
  itemCount: number;
  disabledReason?: string;
  checkoutRef?: RefObject<HTMLButtonElement | null>;
  onCheckout: () => void;
}) {
  return (
    <section className="pos-cart-checkout shrink-0 border-t p-4">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            Running total
          </p>
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"} · Payment comes
            next
          </p>
        </div>
        <strong className="text-xl font-black">{formatMoney(total)}</strong>
      </div>
      {disabledReason ? (
        <p
          className="pos-payment-message mb-2 rounded-lg px-3 py-2 text-[10px] font-bold"
          role="status"
        >
          {disabledReason}
        </p>
      ) : null}
      <button
        ref={checkoutRef}
        type="button"
        onClick={onCheckout}
        aria-keyshortcuts="F3"
        className="pos-proceed-checkout flex min-h-14 w-full items-center rounded-xl px-4 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        <span className="ml-2 text-sm font-black">Proceed to Checkout</span>
        <kbd className="ml-auto text-[9px] font-black text-white/65">F3</kbd>
        <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
      </button>
    </section>
  );
}
