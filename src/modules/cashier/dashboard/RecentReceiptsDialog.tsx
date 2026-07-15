import { useState } from "react";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatDateTime, formatMoney } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order } from "../types";
import { CashierDialogContent, EmptyState } from "../components/CashierUI";
import { ReceiptDialog } from "../pos/ReceiptDialog";

export function RecentReceiptsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, recordReceiptReprint } = useCashierStore();
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const transactions = state.transactions
    .filter((entry) => entry.status === "Completed")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);
  const payment = state.payments.find(
    (entry) => entry.orderId === receiptOrder?.id,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <CashierDialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Recent printable transactions</DialogTitle>
            <DialogDescription>
              Choose a completed transaction to preview and reprint its receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[440px] space-y-2 overflow-y-auto">
            {transactions.length ? (
              transactions.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => {
                    const order = state.orders.find(
                      (entry) => entry.id === transaction.orderId,
                    );
                    if (order) {
                      onOpenChange(false);
                      setReceiptOrder(order);
                    }
                  }}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-border bg-white px-3 text-left transition hover:border-primary/25 hover:bg-amber-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-primary">
                    <Printer className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block font-mono text-xs text-primary">
                      {transaction.id} · {transaction.orderId}
                    </strong>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {transaction.customerName} · {transaction.method} ·{" "}
                      {formatDateTime(transaction.createdAt)}
                    </span>
                  </span>
                  <strong className="text-xs">
                    {formatMoney(transaction.amount)}
                  </strong>
                </button>
              ))
            ) : (
              <EmptyState
                icon={Printer}
                title="No printable transactions"
                description="Completed paid orders will appear here."
              />
            )}
          </div>
        </CashierDialogContent>
      </Dialog>
      <ReceiptDialog
        order={receiptOrder}
        payment={payment}
        open={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(undefined)}
        onPrint={() =>
          receiptOrder ? recordReceiptReprint(receiptOrder.id) : undefined
        }
      />
    </>
  );
}
