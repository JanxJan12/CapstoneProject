import { formatDateTime, formatMoney } from "../constants";
import { StatusBadge } from "../components";
import type { Order, Transaction } from "../types";
import { getReceiptNumber } from "./transactionRecords";

export function TransactionCards({
  transactions,
  orders,
  onView,
  onReceipt,
}: {
  transactions: Transaction[];
  orders: Order[];
  onView: (transaction: Transaction) => void;
  onReceipt: (transaction: Transaction) => void;
}) {
  if (!transactions.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No matching transactions. Adjust the search or filters.
      </p>
    );
  }

  return (
    <div className="space-y-2 p-2" aria-label="Transaction cards">
      {transactions.map((transaction) => {
        const receiptAvailable = transaction.status === "Completed";
        return (
          <article
            key={transaction.id}
            className="min-w-0 rounded-xl border border-border bg-white p-3"
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <h2 className="min-w-0 break-all font-mono text-sm font-bold text-primary">
                {getReceiptNumber(transaction)}
              </h2>
              <strong className="shrink-0 text-sm font-black tabular-nums">
                {formatMoney(transaction.amount)}
              </strong>
            </div>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {transaction.orderId} · {transaction.method}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={transaction.status} />
              <time
                className="text-xs text-muted-foreground"
                dateTime={transaction.createdAt}
              >
                {formatDateTime(transaction.createdAt)}
              </time>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-2">
              <button
                type="button"
                onClick={() => onView(transaction)}
                className="min-h-11 flex-1 rounded-lg border border-border px-3 text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                View details
              </button>
              {receiptAvailable && (
                <button
                  type="button"
                  onClick={() => onReceipt(transaction)}
                  className="min-h-11 flex-1 rounded-lg border border-border px-3 text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Receipt
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
