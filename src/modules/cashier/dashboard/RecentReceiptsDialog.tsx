import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Printer, XIcon } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "../components";
import { formatDateTime, formatMoney } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { ReceiptDialog } from "../pos/ReceiptDialog";
import { getReceiptNumber } from "../transactions/transactionRecords";
import type { Transaction } from "../types";

export function RecentReceiptsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useCashierStore();
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction>();

  const transactions = state.transactions
    .filter((transaction) => transaction.status === "Completed")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);

  const receiptOrder = state.orders.find(
    (entry) => entry.id === receiptTransaction?.orderId,
  );
  const payment = state.payments.find(
    (entry) => entry.id === receiptTransaction?.paymentId,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <DialogPrimitive.Content
              data-testid="recent-receipts-dialog"
              className="pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#fffdf9] shadow-[0_24px_70px_rgba(36,26,19,0.22)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              <DialogPrimitive.Close
                className="absolute right-3.5 top-3.5 z-10 rounded-[10px] p-2 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Close recent receipts"
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </DialogPrimitive.Close>
              {/* Fixed modal header */}
              <DialogHeader className="shrink-0 border-b border-border/80 px-6 py-5 pr-12">
                <DialogTitle>Recent printable transactions</DialogTitle>

                <DialogDescription>
                  Choose a completed transaction to preview and reprint its
                  receipt.
                </DialogDescription>
              </DialogHeader>

              {/* Scrollable transaction list */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                {transactions.length > 0 ? (
                  <div className="space-y-2">
                    {transactions.map((transaction) => {
                      const order = state.orders.find((entry) => entry.id === transaction.orderId);
                      return (
                        <button
                        key={transaction.id}
                        type="button"
                        onClick={() => {
                          if (!order) return;

                          onOpenChange(false);
                          setReceiptTransaction(transaction);
                        }}
                        className="
                      flex min-h-[64px] w-full items-center gap-3
                      rounded-xl border border-border bg-white
                      px-3 py-2.5 text-left transition
                      hover:border-primary/25 hover:bg-amber-50/35
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-primary
                    "
                      >
                        <span
                          className="
                        flex h-9 w-9 shrink-0 items-center
                        justify-center rounded-xl
                        bg-amber-50 text-primary
                      "
                        >
                          <Printer className="h-4 w-4" aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <strong className="block truncate font-mono text-xs text-primary">
                            {getReceiptNumber(transaction)} ·{" "}
                            {order && /^ORD-\d{6,}$/.test(order.id)
                              ? order.id
                              : "Order number unavailable"}
                          </strong>

                          <span className="mt-1 block truncate text-[10px] font-medium text-muted-foreground">
                            {transaction.customerName} · {transaction.method} ·{" "}
                            {formatDateTime(transaction.createdAt)}
                          </span>
                        </span>

                        <strong className="shrink-0 text-xs font-black text-foreground">
                          {formatMoney(transaction.amount)}
                        </strong>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[160px] items-center justify-center">
                    <EmptyState
                      icon={Printer}
                      title="No printable transactions"
                      description="Completed paid orders will appear here."
                    />
                  </div>
                )}
              </div>
            </DialogPrimitive.Content>
          </div>
        </DialogPortal>
      </Dialog>

      <ReceiptDialog
        order={receiptOrder}
        payment={payment}
        transaction={receiptTransaction}
        open={Boolean(receiptOrder)}
        onClose={() => setReceiptTransaction(undefined)}
      />
    </>
  );
}
