import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { ArrowLeft, ArrowRight, ClipboardCheck, X } from "lucide-react";
import { formatMoney } from "../constants";
import type { POSForm } from "../schemas";
import { POSCart } from "./POSCart";
import { POSOrderDetails } from "./POSOrderDetails";
import type { POSCartLine, WalkInOrderType } from "./types";

export function OrderReviewDrawer({
  orderNumber,
  orderType,
  items,
  values,
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
  onAdjust,
  onQuantityChange,
  onRemove,
  onDuplicate,
  onNoteChange,
  onCustomize,
  onReorder,
  onClear,
  onClose,
  onContinue,
}: {
  orderNumber: string;
  orderType: WalkInOrderType;
  items: POSCartLine[];
  values: POSForm;
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
  onAdjust: (lineId: string, delta: number) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onDuplicate: (lineId: string) => void;
  onNoteChange: (lineId: string, note: string) => void;
  onCustomize: (lineId: string) => void;
  onReorder: (sourceLineId: string, targetLineId: string) => void;
  onClear: () => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="pos-order-review flex min-h-0 flex-1 flex-col">
      <header className="pos-panel-header flex items-center gap-3 border-b p-3">
        <span className="pos-drawer-icon">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-[var(--pos-orange-soft)]">
            Order review
          </p>
          <h2 className="truncate text-sm font-black">
            {orderNumber} · {itemCount} {itemCount === 1 ? "item" : "items"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Continue ordering"
          className="flex h-10 w-10 items-center justify-center rounded-lg"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="pos-order-review-body min-h-0 flex-1 overflow-y-auto">
        <POSCart
          embedded
          items={items}
          orderNumber={orderNumber}
          orderType={orderType}
          onAdjust={onAdjust}
          onQuantityChange={onQuantityChange}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onNoteChange={onNoteChange}
          onCustomize={onCustomize}
          onReorder={onReorder}
          onClear={onClear}
        />

        <POSOrderDetails
          discountType={values.discountType}
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
          {discountAmount > 0 ? (
            <div className="pos-discount-row flex justify-between font-semibold">
              <span>Discount</span>
              <span>−{formatMoney(discountAmount)}</span>
            </div>
          ) : null}
          {taxEnabled ? (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatMoney(taxAmount)}</span>
            </div>
          ) : null}
          <div className="pos-total-row flex items-end justify-between border-t pt-2">
            <span className="text-sm font-black">Amount due</span>
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
            onClick={onClose}
            className="pos-secondary-action flex min-h-12 items-center gap-2 rounded-xl border px-4 text-xs font-black"
          >
            <ArrowLeft className="h-4 w-4" /> Continue ordering
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className="pos-place-order flex min-h-12 items-center rounded-xl px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            Take Payment
            <strong className="ml-auto">{formatMoney(total)}</strong>
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </footer>
    </section>
  );
}
