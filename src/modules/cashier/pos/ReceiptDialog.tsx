import { CheckCircle2, Printer } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Order, Payment, Transaction } from "../types";
import { CashierButton, CashierDialogContent, Toast } from "../components";
import { ReceiptContent } from "./ReceiptContent";

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
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <CashierDialogContent className="max-w-md bg-[#fbf8f4]">
        <DialogHeader className="text-center sm:text-center">
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
        <ReceiptContent
          order={order}
          payment={payment}
          transaction={transaction}
        />
        <DialogFooter>
          <CashierButton
            variant="secondary"
            onClick={() => {
              window.print();
              Toast.success("Receipt sent to the print dialog.");
            }}
          >
            <Printer className="h-4 w-4" />
            Print receipt
          </CashierButton>
          <CashierButton onClick={onClose}>Close receipt</CashierButton>
        </DialogFooter>
      </CashierDialogContent>
    </Dialog>
  );
}
