import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { RefObject } from "react";
import { ArrowRight, Banknote, Eye, Smartphone } from "lucide-react";
import type { POSForm } from "../schemas";
import {
  CASH_TENDER_SUGGESTIONS,
  formatCompactMoney,
  formatMoney,
} from "../constants";
import { CashierInput, FieldError, Label } from "../components";

export function PaymentPanel({
  subtotal,
  discountAmount,
  taxAmount,
  taxEnabled,
  total,
  paymentMethod,
  tendered,
  register,
  errors,
  canPlace,
  disabledReason,
  shiftOpen,
  checkoutRef,
  onTenderedChange,
  onPreview,
  onConfirm,
}: {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxEnabled: boolean;
  total: number;
  paymentMethod: POSForm["paymentMethod"];
  tendered: number;
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
  canPlace: boolean;
  disabledReason?: string;
  shiftOpen: boolean;
  checkoutRef?: RefObject<HTMLButtonElement | null>;
  onTenderedChange: (amount: number) => void;
  onPreview: () => void;
  onConfirm: () => void;
}) {
  const change = Math.max(0, tendered - total);

  return (
    <section className="pos-payment-panel shrink-0 border-t">
      <div className="pos-payment-summary space-y-1.5 px-4 py-3 text-[11px]">
        <div className="flex justify-between">
          <span>Running subtotal</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        <div className="pos-discount-row flex justify-between font-semibold">
          <span>Discount</span>
          <span>−{formatMoney(discountAmount)}</span>
        </div>
        {taxEnabled && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatMoney(taxAmount)}</span>
          </div>
        )}
        <div className="pos-total-row flex items-end justify-between border-t pt-2">
          <span className="text-sm font-black">Grand Total</span>
          <span className="text-xl font-black">{formatMoney(total)}</span>
        </div>
      </div>

      <div className="pos-payment-method border-t px-4 py-3">
        <Label>Payment method</Label>
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Payment method"
        >
          {(["Cash", "GCash"] as const).map((method) => (
            <label
              key={method}
              className={`pos-payment-option flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-xs font-black transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400 ${paymentMethod === method ? "is-active" : ""}`}
              data-method={method.toLowerCase()}
            >
              <input
                type="radio"
                value={method}
                className="sr-only"
                {...register("paymentMethod")}
              />
              {method === "Cash" ? (
                <Banknote className="h-4 w-4" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {method}
            </label>
          ))}
        </div>
      </div>

      {paymentMethod === "Cash" ? (
        <div className="pos-tendered border-t px-4 py-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <div>
              <Label htmlFor="amount-tendered">Custom cash amount</Label>
              <CashierInput
                id="amount-tendered"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                aria-invalid={
                  Boolean(errors.amountTendered) ||
                  (tendered > 0 && tendered < total)
                }
                {...register("amountTendered", { valueAsNumber: true })}
              />
            </div>
            <button
              type="button"
              onClick={() => onTenderedChange(total)}
              className="pos-cash-exact min-h-12 rounded-lg border px-3 text-[10px] font-black"
            >
              Exact
            </button>
          </div>
          <FieldError>{errors.amountTendered?.message}</FieldError>
          {tendered > 0 && tendered < total && (
            <FieldError>Cash tendered is insufficient.</FieldError>
          )}
          <div className="pos-cash-suggestions mt-2 grid grid-cols-4 gap-1.5">
            {CASH_TENDER_SUGGESTIONS.map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={amount < total}
                onClick={() => onTenderedChange(amount)}
                className="min-h-10 rounded-lg border px-2 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-30"
              >
                {formatCompactMoney(amount)}
              </button>
            ))}
          </div>
          <div
            className={`pos-change mt-2 flex justify-between rounded-lg border px-3 py-2 text-[11px] font-black ${change > 0 ? "has-change" : ""}`}
          >
            <span>Change</span>
            <span>{formatMoney(change)}</span>
          </div>
        </div>
      ) : (
        <div className="pos-gcash border-t px-4 py-3">
          <Label htmlFor="gcash-reference">GCash reference number</Label>
          <CashierInput
            id="gcash-reference"
            placeholder="Enter in-person payment reference"
            aria-invalid={Boolean(errors.gcashReference)}
            {...register("gcashReference")}
          />
          <FieldError>{errors.gcashReference?.message}</FieldError>
          <p className="mt-2 text-[9px] font-semibold">
            Cashier-confirmed in-person payment; no proof upload required.
          </p>
        </div>
      )}

      {!shiftOpen && (
        <p
          className="pos-payment-message mx-4 rounded-lg px-3 py-2 text-[10px] font-bold"
          role="status"
          aria-live="polite"
        >
          Start a shift before placing a new order.
        </p>
      )}
      {shiftOpen && disabledReason && (
        <p
          className="pos-payment-message mx-4 rounded-lg px-3 py-2 text-[10px] font-bold"
          role="status"
          aria-live="polite"
        >
          {disabledReason}
        </p>
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 p-4">
        <button
          type="button"
          disabled={!subtotal}
          onClick={onPreview}
          className="pos-receipt-button flex min-h-14 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Eye className="h-4 w-4" /> Preview
        </button>
        <button
          ref={checkoutRef}
          type="button"
          disabled={!canPlace || !shiftOpen}
          onClick={onConfirm}
          aria-keyshortcuts="F3 Control+Enter"
          className="pos-place-order flex min-h-14 w-full items-center rounded-xl px-4 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span className="text-sm font-black">Place Order</span>
          <strong className="ml-auto text-sm">{formatMoney(total)}</strong>
          <ArrowRight className="ml-2 h-5 w-5" />
        </button>
        <p className="col-span-2 text-center text-[9px] font-bold text-muted-foreground">
          F3 Checkout · Ctrl+Enter Complete
        </p>
      </div>
    </section>
  );
}
