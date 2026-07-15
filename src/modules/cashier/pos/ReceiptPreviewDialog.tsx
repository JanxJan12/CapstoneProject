import { Eye, Printer, ReceiptText } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { CashierButton, CashierDialogContent } from "../components";
import { formatMoney } from "../constants";
import type { POSForm } from "../schemas";
import type { POSCartLine } from "./types";

export function ReceiptPreviewDialog({
  open,
  orderNumber,
  items,
  orderType,
  tableNumber,
  customerName,
  contactNumber,
  deliveryAddress,
  instructions,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  paymentMethod,
  onOpenChange,
  onCheckout,
  onPrint,
}: {
  open: boolean;
  orderNumber: string;
  items: POSCartLine[];
  orderType: POSForm["orderType"];
  tableNumber?: string;
  customerName?: string;
  contactNumber?: string;
  deliveryAddress?: string;
  instructions?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: POSForm["paymentMethod"];
  onOpenChange: (open: boolean) => void;
  onCheckout: () => void;
  onPrint: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CashierDialogContent className="max-w-md bg-[#fbf8f4]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" /> Receipt preview
          </DialogTitle>
          <DialogDescription>
            Review the customer-facing receipt before completing payment.
          </DialogDescription>
        </DialogHeader>

        <div className="pos-receipt-preview mx-auto w-full max-w-sm rounded-xl border border-dashed border-[#b9a794] bg-white p-5 font-mono text-[11px] text-[#38291f] shadow-sm">
          <div className="text-center">
            <p className="font-black uppercase tracking-[0.18em]">
              RRJ's Food-Haus
            </p>
            <p className="mt-1 text-[9px] text-[#7a6859]">
              Cashier receipt preview
            </p>
          </div>
          <div className="my-4 border-t border-dashed border-[#cdbba9]" />
          <div className="space-y-1">
            <div className="flex justify-between gap-3">
              <span>Order</span>
              <strong>{orderNumber}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>Type</span>
              <strong>
                {orderType}
                {tableNumber ? ` · Table ${tableNumber}` : ""}
              </strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>Customer</span>
              <strong className="truncate">
                {customerName?.trim() || "Walk-in Customer"}
              </strong>
            </div>
            {orderType === "Delivery" ? (
              <>
                <div className="flex justify-between gap-3">
                  <span>Contact</span>
                  <strong>{contactNumber}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Address</span>
                  <strong className="max-w-52 text-right">
                    {deliveryAddress}
                  </strong>
                </div>
              </>
            ) : null}
          </div>
          <div className="my-4 border-t border-dashed border-[#cdbba9]" />
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.lineId}>
                <div className="flex justify-between gap-3 font-bold">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span>{formatMoney(item.unitPrice * item.quantity)}</span>
                </div>
                {item.modifiers?.map((modifier) => (
                  <p
                    key={modifier.id}
                    className="pl-4 text-[9px] text-[#7a6859]"
                  >
                    + {modifier.name}
                    {modifier.price ? ` (${formatMoney(modifier.price)})` : ""}
                  </p>
                ))}
                {item.note && (
                  <p className="pl-4 text-[9px] italic text-[#7a6859]">
                    Note: {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="my-4 border-t border-dashed border-[#cdbba9]" />
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>−{formatMoney(discountAmount)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatMoney(taxAmount)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-[#38291f] pt-2 text-sm font-black">
              <span>GRAND TOTAL</span>
              <span>{formatMoney(total)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Payment</span>
              <strong>{paymentMethod}</strong>
            </div>
          </div>
          {instructions && (
            <div className="mt-4 border-t border-dashed border-[#cdbba9] pt-3 text-[9px]">
              Instructions: {instructions}
            </div>
          )}
        </div>

        <DialogFooter>
          <CashierButton variant="secondary" onClick={onPrint}>
            <Printer className="h-4 w-4" /> Print
          </CashierButton>
          <CashierButton
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Close preview
          </CashierButton>
          <CashierButton onClick={onCheckout}>
            <Eye className="h-4 w-4" /> Continue to checkout
          </CashierButton>
        </DialogFooter>
      </CashierDialogContent>
    </Dialog>
  );
}
