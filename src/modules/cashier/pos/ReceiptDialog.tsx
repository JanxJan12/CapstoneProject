import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CheckCircle2, Printer, XIcon } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Order, Payment, Transaction } from "../types";
import { CashierButton, Toast } from "../components";
import { ReceiptContent } from "./ReceiptContent";
import { ReceiptPrintDocument } from "./ReceiptPrintDocument";
import { prepareReceipt } from "./receiptPresentation";

export function ReceiptDialog({
  order,
  payment,
  transaction,
  open,
  onClose,
  placed = false,
}: {
  order?: Order;
  payment?: Payment;
  transaction?: Transaction;
  open: boolean;
  onClose: () => void;
  placed?: boolean;
}) {
  if (!order) return null;
  const prepared = prepareReceipt(order, payment, transaction);
  const printable = prepared.ready && !prepared.receipt.voided;
  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="print:hidden" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:block print:p-0">
          <DialogPrimitive.Content
            data-testid="cashier-receipt-dialog"
            className="pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-4 overflow-hidden rounded-2xl border border-border/80 bg-[#fbf8f4] p-5 shadow-[0_24px_70px_rgba(36,26,19,0.22)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:p-6 print:max-h-none print:max-w-none print:overflow-visible print:border-0 print:shadow-none"
          >
            <DialogPrimitive.Close
              className="absolute right-3.5 top-3.5 z-10 rounded-[10px] p-2 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary print:hidden"
              aria-label="Close receipt preview"
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
            <DialogHeader className="shrink-0 text-center sm:text-center">
              {placed ? (
                <div className="pos-receipt-ready mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </div>
              ) : null}
              <DialogTitle className="text-emerald-700">
                {placed ? "Order placed successfully" : "Receipt preview"}
              </DialogTitle>
              <DialogDescription>
                {placed
                  ? `${order.id} was sent to the kitchen and recorded in this shift.`
                  : `${order.id} is ready to print from the recorded transaction.`}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain print:overflow-visible">
              <ReceiptContent
                order={order}
                payment={payment}
                transaction={transaction}
              />
            </div>
            <DialogFooter className="shrink-0 border-t border-border/70 pt-4">
              {!printable ? <p role="status" className="w-full text-xs text-amber-900">
                {prepared.ready ? "Voided receipts cannot be printed." : prepared.reason}
              </p> : null}
              <CashierButton
                variant="secondary"
                disabled={!printable}
                onClick={() => {
                  window.print();
                  Toast.success("Print dialog opened");
                }}
              >
                <Printer className="h-4 w-4" />
                Print receipt
              </CashierButton>
              <CashierButton onClick={onClose}>Close receipt</CashierButton>
            </DialogFooter>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
    {open ? <ReceiptPrintDocument order={order} payment={payment} transaction={transaction} /> : null}
    </>
  );
}
