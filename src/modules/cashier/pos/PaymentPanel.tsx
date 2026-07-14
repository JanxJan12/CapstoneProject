import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Banknote, CheckCircle2, Smartphone } from "lucide-react";
import type { POSForm } from "../schemas";
import { formatMoney } from "../constants";
import { CashierInput, FieldError, Label } from "../components/CashierUI";

export function PaymentPanel({
  subtotal,
  discountAmount,
  total,
  paymentMethod,
  tendered,
  register,
  errors,
  canPlace,
  disabledReason,
  shiftOpen,
  onTenderedChange,
  onConfirm,
}: {
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: POSForm["paymentMethod"];
  tendered: number;
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
  canPlace: boolean;
  disabledReason?: string;
  shiftOpen: boolean;
  onTenderedChange: (amount: number) => void;
  onConfirm: () => void;
}) {
  const change = Math.max(0, tendered - total);
  const cashSuggestions = [100, 200, 500, 1000].filter(
    (amount) => amount >= total && amount !== total,
  );
  return (
    <div className="pos-payment-panel shrink-0 border-t border-border bg-gradient-to-b from-white to-[#fffaf5] shadow-[0_-10px_28px_rgba(67,42,23,0.055)]">
      <div className="space-y-1.5 px-4 py-3 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between font-semibold text-emerald-700">
            <span>Approved discount</span>
            <span>−{formatMoney(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-black">
          <span>Total</span>
          <span className="text-primary">{formatMoney(total)}</span>
        </div>
      </div>
      <div className="border-t border-border px-4 py-3">
        <Label>Payment method</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["Cash", "GCash"] as const).map((method) => (
            <label
              key={method}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-xs font-black shadow-sm transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${paymentMethod === method ? (method === "Cash" ? "border-primary bg-orange-50 text-primary shadow-orange-900/5" : "border-blue-500 bg-blue-50 text-blue-700") : "border-border bg-white text-muted-foreground hover:border-primary/25"}`}
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
        <div className="border-t border-border px-4 py-3">
          <Label htmlFor="amount-tendered">Cash tendered</Label>
          <CashierInput
            id="amount-tendered"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            {...register("amountTendered", { valueAsNumber: true })}
          />
          <FieldError>{errors.amountTendered?.message}</FieldError>
          {tendered > 0 && tendered < total && (
            <FieldError>Cash tendered is insufficient.</FieldError>
          )}
          {total > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onTenderedChange(total)}
                className="min-h-9 rounded-lg border border-primary/20 bg-orange-50 px-3 text-[10px] font-black text-primary hover:bg-orange-100"
              >
                Exact
              </button>
              {cashSuggestions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => onTenderedChange(amount)}
                  className="min-h-9 rounded-lg border border-border bg-white px-3 text-[10px] font-black text-muted-foreground hover:border-primary/30 hover:text-primary"
                >
                  ₱{amount.toLocaleString("en-PH")}
                </button>
              ))}
            </div>
          )}
          <div
            className={`mt-2 flex justify-between rounded-lg px-3 py-2 text-xs font-black ${change > 0 ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}
          >
            <span>Change</span>
            <span>{formatMoney(change)}</span>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3">
          <Label htmlFor="gcash-reference">GCash reference number</Label>
          <CashierInput
            id="gcash-reference"
            placeholder="Enter in-person payment reference"
            {...register("gcashReference")}
          />
          <FieldError>{errors.gcashReference?.message}</FieldError>
          <p className="mt-2 text-[10px] font-semibold text-blue-700">
            Cashier-confirmed in-person payment; no proof upload required.
          </p>
        </div>
      )}
      {!shiftOpen && (
        <p className="mx-4 rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">
          Start a shift before placing a new order.
        </p>
      )}
      {shiftOpen && disabledReason && (
        <p className="mx-4 rounded-lg bg-muted/70 px-3 py-2 text-[10px] font-bold text-muted-foreground">
          {disabledReason}
        </p>
      )}
      <div className="p-4">
        <button
          type="button"
          disabled={!canPlace || !shiftOpen}
          onClick={onConfirm}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-600 px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(184,79,10,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(184,79,10,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
        >
          <CheckCircle2 className="h-4 w-4" />
          Place Order · {formatMoney(total)}
        </button>
      </div>
    </div>
  );
}
