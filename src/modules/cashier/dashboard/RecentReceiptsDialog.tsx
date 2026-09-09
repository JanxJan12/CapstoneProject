import { useState } from "react";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CashierDialogContent, EmptyState } from "../components";
import { formatDateTime, formatMoney } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { ReceiptDialog } from "../pos/ReceiptDialog";
import type { Order } from "../types";

export function RecentReceiptsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useCashierStore();
  const [receiptOrder, setReceiptOrder] = useState<Order>();

  const transactions = state.transactions
    .filter((transaction) => transaction.status === "Completed")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);

  const payment = state.payments.find(
    (entry) => entry.orderId === receiptOrder?.id,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <CashierDialogContent className="max-w-xl">
          {/* Fixed modal header */}
          <DialogHeader className="shrink-0 border-b border-border/80 px-6 py-5 pr-12">
            <DialogTitle>
              Recent printable transactions
            </DialogTitle>

            <DialogDescription>
              Choose a completed transaction to preview and reprint
              its receipt.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable transaction list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => {
                      const order = state.orders.find(
                        (entry) =>
                          entry.id === transaction.orderId,
                      );

                      if (!order) return;

                      onOpenChange(false);
                      setReceiptOrder(order);
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
                      <Printer
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <strong className="block truncate font-mono text-xs text-primary">
                        {transaction.id} · {transaction.orderId}
                      </strong>

                      <span className="mt-1 block truncate text-[10px] font-medium text-muted-foreground">
                        {transaction.customerName} ·{" "}
                        {transaction.method} ·{" "}
                        {formatDateTime(transaction.createdAt)}
                      </span>
                    </span>

                    <strong className="shrink-0 text-xs font-black text-foreground">
                      {formatMoney(transaction.amount)}
                    </strong>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center">
                <EmptyState
                  icon={Printer}
                  title="No printable transactions"
                  description="Completed paid orders will appear here."
                />
              </div>
            )}
          </div>
        </CashierDialogContent>
      </Dialog>

      <ReceiptDialog
        order={receiptOrder}
        payment={payment}
        open={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(undefined)}
      />
    </>
  );
}
