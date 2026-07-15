import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { ArrowLeft, ReceiptText } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { CashierDialogContent } from "../components";
import { formatMoney } from "../constants";
import type { POSForm } from "../schemas";
import { PaymentPanel } from "./PaymentPanel";
import type { POSCartLine } from "./types";

export interface CheckoutModalProps {
  open: boolean;
  loading: boolean;
  orderNumber: string;
  items: POSCartLine[];
  values: POSForm;
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
  onOpenChange: (open: boolean) => void;
  onTenderedChange: (amount: number) => void;
  onPreview: () => void;
  onConfirm: () => void;
}

export function CheckoutModal({
  open,
  loading,
  orderNumber,
  items,
  values,
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
  onOpenChange,
  onTenderedChange,
  onPreview,
  onConfirm,
}: CheckoutModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !loading && onOpenChange(value)}
    >
      <CashierDialogContent className="tablet-pos pos-checkout-content max-h-[92dvh] max-w-5xl overflow-hidden p-0">
        <div className="border-b border-[var(--pos-line)] px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--pos-text)]">
              <ReceiptText className="h-5 w-5 text-[var(--pos-orange-soft)]" />
              Checkout · {orderNumber}
            </DialogTitle>
            <DialogDescription className="text-[var(--pos-muted)]">
              Review the order, collect payment, then confirm once.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_430px]">
          <section className="pos-checkout-summary min-h-0 border-r border-[var(--pos-line)] p-5">
            <button
              type="button"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-[10px] font-black text-[var(--pos-muted)] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to cart
            </button>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-[var(--pos-text)]">
                  Order summary
                </p>
                <p className="mt-1 text-[9px] font-semibold text-[var(--pos-muted)]">
                  {values.orderType}
                  {values.tableNumber ? ` · Table ${values.tableNumber}` : ""}
                  {values.customerName?.trim()
                    ? ` · ${values.customerName.trim()}`
                    : ""}
                </p>
              </div>
              <strong className="text-lg text-[var(--pos-orange-soft)]">
                {formatMoney(total)}
              </strong>
            </div>

            {values.orderType === "Delivery" ? (
              <div className="pos-checkout-fulfillment mb-4 rounded-xl border border-[var(--pos-line-soft)] bg-[var(--pos-panel-raised)] p-3 text-[10px] text-[var(--pos-muted)]">
                <p className="font-black text-[var(--pos-text)]">
                  Delivery fulfillment
                </p>
                <p className="mt-1">{values.contactNumber}</p>
                <p className="mt-1 leading-4">{values.deliveryAddress}</p>
                {values.orderInstructions?.trim() ? (
                  <p className="mt-2 border-t border-[var(--pos-line-soft)] pt-2 italic">
                    {values.orderInstructions.trim()}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="divide-y divide-[var(--pos-line-soft)] rounded-xl border border-[var(--pos-line-soft)] bg-[var(--pos-panel-raised)]">
              {items.map((item) => (
                <div key={item.lineId} className="p-3">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="font-bold text-[var(--pos-text)]">
                      {item.quantity}× {item.name}
                    </span>
                    <strong className="text-[var(--pos-text)]">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </strong>
                  </div>
                  {item.modifiers?.length ? (
                    <p className="mt-1 text-[9px] leading-4 text-[var(--pos-muted)]">
                      {item.modifiers
                        .map((modifier) => modifier.name)
                        .join(", ")}
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

            <div className="mt-4 space-y-2 text-[11px] text-[var(--pos-muted)]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>−{formatMoney(discountAmount)}</span>
              </div>
              {taxEnabled ? (
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span>{formatMoney(taxAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[var(--pos-line-soft)] pt-3 text-sm font-black text-[var(--pos-text)]">
                <span>Grand Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
          </section>

          <div className="min-h-0 overflow-y-auto">
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
              submitLabel="Confirm Order"
              onTenderedChange={onTenderedChange}
              onPreview={onPreview}
              onConfirm={onConfirm}
            />
          </div>
        </div>
      </CashierDialogContent>
    </Dialog>
  );
}
