import { useMemo } from "react";
import { formatMoney } from "../constants";
import type { Order, Transaction } from "../types";
import { calculateTransactionSummary } from "./transactionSummaryMetrics";

export function TransactionSummary({ transactions, orders }: {
  transactions: Transaction[];
  orders: Order[];
}) {
  const summary = useMemo(
    () => calculateTransactionSummary(transactions, orders),
    [transactions, orders],
  );
  const primary = [
    ["Transactions (this page)", String(transactions.length)],
    ["Completed sales", formatMoney(summary.revenue)],
    ["Cash", formatMoney(summary.cashRevenue)],
    ["GCash", formatMoney(summary.gcashRevenue)],
  ];

  return (
    <section className="rrj-card overflow-hidden" aria-label="Filtered transaction summary">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {primary.map(([label, value]) => (
          <div key={label} className="min-w-0 border-r border-border/70 px-3 py-2.5 last:border-r-0">
            <p className="text-xs font-bold text-muted-foreground">{label}</p>
            <p className="truncate text-base font-black tabular-nums" title={value}>{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
