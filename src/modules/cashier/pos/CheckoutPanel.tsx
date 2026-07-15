import type { RefObject } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { formatMoney } from "../constants";
import type { POSForm } from "../schemas";
import { PaymentPanel } from "./PaymentPanel";
import { POSOrderDetails } from "./POSOrderDetails";
import type { POSCartLine } from "./types";

export interface CheckoutPanelProps {
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
  tendered: number;
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
  canPlace: boolean;
  disabledReason?: string;
  shiftOpen: boolean;
  loading: boolean;
  confirmRef?: RefObject<HTMLButtonElement | null>;
  onOptionsOpenChange: (open: boolean) => void;
  onTenderedChange: (amount: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function CheckoutPanel({
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
  tendered,
  register,
  errors,
  canPlace,
  disabledReason,
  shiftOpen,
  loading,
  confirmRef,
  onOptionsOpenChange,
  onTenderedChange,
  onBack,
  onConfirm,
}: CheckoutPanelProps) {
  return (
    <section className="pos-checkout-panel flex min-h-0 flex-1 flex-col">
      <header className="pos-checkout-panel-header sticky top-0 z-10 flex items-center gap-3 border-b p-3">
        <button
          type="button"
          disabled={loading}
          onClick={onBack}
          aria-label="Back to cart"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-[var(--pos-orange-soft)]">
            Checkout
          </p>
          <h2 className="truncate text-sm font-black">{orderNumber}</h2>
        </div>
        <ReceiptText
          className="h-5 w-5 text-[var(--pos-muted)]"
          aria-hidden="true"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="pos-checkout-review border-b border-[var(--pos-line)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black">1. Order Review</p>
              <p className="mt-1 text-[9px] text-[var(--pos-muted)]">
                {items.reduce((sum, item) => sum + item.quantity, 0)} items ·{" "}
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

        <div className="pos-checkout-section-heading px-4 pt-4">
          <p className="text-xs font-black">2. Order Information</p>
        </div>
        <POSOrderDetails
          orderType={values.orderType === "Take-out" ? "Take-out" : "Dine-in"}
          discountType={values.discountType}
          occupiedTables={occupiedTables}
          optionsOpen={optionsOpen}
          onOptionsOpenChange={onOptionsOpenChange}
          register={register}
          errors={errors}
        />

        <div className="pos-checkout-section-heading border-t border-[var(--pos-line)] px-4 pt-4">
          <p className="text-xs font-black">3. Payment</p>
        </div>
        <PaymentPanel
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          taxEnabled={taxEnabled}
          total={total}
          paymentMethod={values.paymentMethod}
          tendered={tendered}
          register={register}
          errors={errors}
          canPlace={canPlace}
          disabledReason={disabledReason}
          shiftOpen={shiftOpen}
          loading={loading}
          confirmRef={confirmRef}
          submitLabel="Confirm Order"
          onTenderedChange={onTenderedChange}
          onBack={onBack}
          onConfirm={onConfirm}
        />
      </div>
    </section>
  );
}
