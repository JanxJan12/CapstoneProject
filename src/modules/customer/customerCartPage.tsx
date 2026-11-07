import { ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import { CustNav } from "./customerNav";
import { customerUnitPrice, customerMealChoiceName, customerDrinkChoiceNames } from "./customerCatalog";
import { formatCustomerCurrency } from "./customerRecordedCharges";
import type { CartItem } from "./customerTypes";
import type { CustomerPage } from "./customerPageTypes";

function CartCheckoutButton({
  availabilityRefreshing,
  availabilityError,
  hasUnavailableItems,
  onContinue,
  className = "",
  compact = false,
}: {
  availabilityRefreshing: boolean;
  availabilityError: string | null;
  hasUnavailableItems: boolean;
  onContinue: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onContinue}
      disabled={availabilityRefreshing}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none ${className}`}
    >
      {availabilityRefreshing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {compact ? "Checking…" : "Checking availability…"}
        </>
      ) : hasUnavailableItems ? (
        compact ? "Review items" : "Check availability again"
      ) : availabilityError ? (
        compact ? "Retry" : "Retry checkout check"
      ) : (
        <>
          {compact ? "Checkout" : "Continue to checkout"}
          <ChevronRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

export function CartPage({
  cart,
  priceNotice,
  onDismissPriceNotice,
  availabilityRefreshing,
  availabilityError,
  onNav,
  onQtyChange,
  onRemove,
}: {
  cart: CartItem[];
  priceNotice: boolean;
  onDismissPriceNotice: () => void;
  availabilityRefreshing: boolean;
  availabilityError: string | null;
  onNav: (p: CustomerPage) => void;
  onQtyChange: (id: string,qty: number,) => void;
  onRemove: (id: string) => void;
}) {
  const subtotal = cart.reduce((s, c) => s + customerUnitPrice(c) * c.qty, 0);
  const unavailableItems = cart.filter((item) => !item.available);
  const unavailableItemNames = unavailableItems
    .map((item) => item.name)
    .join(", ");
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="cart" />
      <div className="customer-storefront customer-cart-screen flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-9">
          <div className="customer-cart-heading mb-5 flex items-end justify-between gap-3 sm:mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Review your order</h1>
            </div>
            {cart.length > 0 ? (
              <span className="text-sm font-semibold text-muted-foreground">
                {cart.reduce((sum, item) => sum + item.qty, 0)} {cart.reduce((sum, item) => sum + item.qty, 0) === 1 ? "item" : "items"}
              </span>
            ) : null}
          </div>
          {availabilityError ? (
            <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-800">
              {availabilityError} Resolve this issue, then try checkout again.
            </div>
          ) : null}
          {priceNotice ? <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"><p>Menu prices changed. Review the updated line prices and estimated total before checkout.</p><button type="button" onClick={onDismissPriceNotice} className="min-h-11 rounded-lg px-3 font-bold underline underline-offset-2">Got it</button></div> : null}
          {unavailableItems.length > 0 ? (
            <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-5 text-amber-900">
              Availability changed for {unavailableItemNames}. Your cart was kept; remove the unavailable {unavailableItems.length === 1 ? "item" : "items"} before checkout.
            </div>
          ) : null}
          {cart.length === 0 ? (
            <div className="flex min-h-52 flex-col items-start justify-center border-t border-b border-border py-10">
              <h2 className="text-xl font-bold text-foreground">Your cart is empty</h2>
              <button onClick={() => onNav("menu")} className="mt-4 min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-amber-800">Browse the menu</button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.7fr)] lg:items-start lg:gap-12">
              {/* Items */}
              <section aria-labelledby="cart-items-heading" className="customer-cart-items min-w-0">
                <div className="flex items-center justify-between border-b border-border py-3">
                  <h2 id="cart-items-heading" className="text-base font-bold text-foreground">Order items</h2>
                  <button type="button" onClick={() => onNav("menu")} className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary/5">Add more</button>
                </div>
                <div className="customer-cart-list divide-y divide-border">
                {cart.map((item) => (
                  <div key={item.lineKey} className="customer-cart-item grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-5 sm:gap-x-6 sm:py-6">
                    <div className="min-w-0">
                      <p className="text-base font-bold leading-5 text-foreground">{item.name}</p>
                      {item.mealOption ? <p className="mt-1 text-sm text-muted-foreground">{customerMealChoiceName(item.mealOption)}</p> : null}
                      {item.modifiers.length > 0 ? <p className="mt-1 text-sm text-muted-foreground">{customerDrinkChoiceNames(item.modifiers)}</p> : null}
                      <p className="mt-1 text-sm text-muted-foreground">{formatCustomerCurrency(customerUnitPrice(item))} each</p>
                      {!item.available ? (
                        <p className="mt-1 text-sm font-bold text-amber-800">Unavailable after the latest stock check</p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="flex items-center rounded-lg border border-border bg-background p-1" aria-label={`Quantity for ${item.name}`}>
                          <button type="button" onClick={() => onQtyChange(item.lineKey, item.qty - 1)} aria-label={`Decrease ${item.name} quantity`} className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted"><Minus className="h-4 w-4" /></button>
                          <span className="w-8 text-center text-sm font-extrabold" aria-live="polite">{item.qty}</span>
                          <button type="button" onClick={() => onQtyChange(item.lineKey, item.qty + 1)} disabled={item.qty >= 99 || cart.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.qty, 0) >= 99} aria-label={`Increase ${item.name} quantity`} className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"><Plus className="h-4 w-4" /></button>
                        </div>
                        <button type="button" onClick={() => onRemove(item.lineKey)} className="min-h-11 rounded-lg px-3 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button>
                      </div>
                    </div>
                    <div className="customer-cart-line-total text-right">
                      <p className="text-base font-bold text-foreground">{formatCustomerCurrency(customerUnitPrice(item) * item.qty)}</p>
                    </div>
                  </div>
                ))}
                </div>
              </section>
              {/* Summary */}
              <aside>
                <div className="customer-cart-summary border-t border-border py-4 lg:sticky lg:top-4 lg:border-t-2 lg:border-foreground lg:py-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-foreground">Order estimate</h2>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Items subtotal</span><span className="font-bold text-foreground">{formatCustomerCurrency(subtotal)}</span></div>
                    <div className="flex flex-wrap justify-between gap-3"><span className="text-muted-foreground">Delivery fee</span><span className="font-bold text-foreground">Shown at checkout</span></div>
                    <div className="flex items-end justify-between gap-3 border-t border-border pt-4"><span className="font-bold text-foreground">Final total</span><span className="font-bold text-primary">Pending server confirmation</span></div>
                  </div>
                  <div className="hidden lg:block">
                  <CartCheckoutButton
                    availabilityRefreshing={availabilityRefreshing}
                    availabilityError={availabilityError}
                    hasUnavailableItems={unavailableItems.length > 0}
                    onContinue={() => onNav("checkout")}
                    className="mt-4 w-full"
                  />
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
      {cart.length > 0 ? (
        <div className="customer-cart-action-bar border-t border-border bg-card/95 px-4 pt-3 lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-muted-foreground">
                Estimated items subtotal
              </p>
              <p className="truncate text-lg font-black text-foreground">
                {formatCustomerCurrency(subtotal)}
              </p>
            </div>
            <CartCheckoutButton
              availabilityRefreshing={availabilityRefreshing}
              availabilityError={availabilityError}
              hasUnavailableItems={unavailableItems.length > 0}
              onContinue={() => onNav("checkout")}
              className="min-w-32 flex-none"
              compact
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
