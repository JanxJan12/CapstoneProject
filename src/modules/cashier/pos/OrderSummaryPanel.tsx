import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { ArrowLeft, ArrowRight, ClipboardList } from "lucide-react";
import { formatMoney } from "../constants";
import type { POSForm } from "../schemas";
import { POSOrderDetails } from "./POSOrderDetails";
import type { POSCartLine } from "./types";

export interface OrderSummaryPanelProps {
  orderNumber: string;
  items: POSCartLine[];
  values: POSForm;
  occupiedTables: string[];
  optionsOpen: boolean;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxEnabled: boolean;
  total: number;
  canContinue: boolean;
  disabledReason?: string;
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
  onOptionsOpenChange: (open: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function OrderSummaryPanel({
  orderNumber,
  items,
  values,
  occupiedTables,
  optionsOpen,
  subtotal,
  discountAmount,
  taxAmount,
  taxEnabled,
  total,
  canContinue,
  disabledReason,
  register,
  errors,
  onOptionsOpenChange,
  onBack,
  onContinue,
}: OrderSummaryPanelProps) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="pos-summary-panel flex min-h-0 flex-1 flex-col">
      <header className="pos-panel-header flex items-center gap-3 border-b p-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to current cart"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-[var(--pos-orange-soft)]">
            Order Summary · Step 1 of 2
          </p>
          <h2 className="truncate text-sm font-black">{orderNumber}</h2>
        </div>
        <ClipboardList className="h-5 w-5 text-[var(--pos-muted)]" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="pos-summary-review border-b p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black">Order review</p>
              <p className="mt-1 text-[9px] text-[var(--pos-muted)]">
                {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
                {values.orderType}
              </p>
            </div>
            <strong className="text-base text-[var(--pos-orange-soft)]">
              {formatMoney(total)}
            </strong>
          </div>
          <div className="divide-y divide-[var(--pos-line-soft)] rounded-xl border border-[var(--pos-line-soft)] bg-[var(--pos-panel-raised)]">
            {items.map((item) => (
              <div key={item.lineId} className="p-3 text-[10px]">
                <div className="flex justify-between gap-3">
                  <strong>
                    {item.quantity}× {item.name}
                  </strong>
                  <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
                </div>
                {item.modifiers?.length ? (
                  <p className="mt-1 text-[9px] text-[var(--pos-muted)]">
                    {item.modifiers.map((modifier) => modifier.name).join(", ")}
                  </p>
                ) : null}
                {item.note ? (
                  <p className="mt-1 text-[9px] italic text-[var(--pos-muted)]">
                    Note: {item.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <POSOrderDetails
          orderType={values.orderType === "Take-out" ? "Take-out" : "Dine-in"}
          discountType={values.discountType}
          occupiedTables={occupiedTables}
          optionsOpen={optionsOpen}
          onOptionsOpenChange={onOptionsOpenChange}
          register={register}
          errors={errors}
        />

        <section className="pos-summary-totals space-y-1.5 border-t px-4 py-3 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="pos-discount-row flex justify-between font-semibold">
            <span>Discount</span>
            <span>−{formatMoney(discountAmount)}</span>
          </div>
          {taxEnabled ? (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatMoney(taxAmount)}</span>
            </div>
          ) : null}
          <div className="pos-total-row flex items-end justify-between border-t pt-2">
            <span className="text-sm font-black">Running Total</span>
            <span className="text-xl font-black">{formatMoney(total)}</span>
          </div>
        </section>
      </div>

      <footer className="pos-panel-footer border-t p-3">
        {disabledReason ? (
          <p
            className="pos-payment-message mb-2 rounded-lg px-3 py-2 text-[10px] font-bold"
            role="status"
          >
            {disabledReason}
          </p>
        ) : null}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <button
            type="button"
            onClick={onBack}
            className="pos-secondary-action flex min-h-14 items-center gap-2 rounded-xl border px-4 text-xs font-black"
          >
            <ArrowLeft className="h-4 w-4" /> Cart
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className="pos-place-order flex min-h-14 items-center rounded-xl px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            Continue to Payment
            <ArrowRight className="ml-auto h-5 w-5" />
          </button>
        </div>
      </footer>
    </section>
  );
}
