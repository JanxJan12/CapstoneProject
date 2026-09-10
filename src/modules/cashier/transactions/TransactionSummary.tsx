import { useMemo } from "react";
import {
  Banknote,
  Calculator,
  CreditCard,
  Percent,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { SummaryCard } from "../components";
import { formatMoney } from "../constants";
import type { Order, Transaction } from "../types";
import { calculateTransactionSummary } from "./transactionSummaryMetrics";

export function TransactionSummary({
  transactions,
  orders,
}: {
  transactions: Transaction[];
  orders: Order[];
}) {
  const summary = useMemo(
    () => calculateTransactionSummary(transactions, orders),
    [orders, transactions],
  );
  const averageOrder = summary.completedCount
    ? summary.revenue / summary.completedCount
    : 0;
  const averageBasket = summary.completedCount
    ? summary.basketQuantity / summary.completedCount
    : 0;
  const method = summary.mostUsedMethod ?? "—";
  const primaryCards = [
    metric(
      "Revenue",
      formatMoney(summary.revenue),
      `${summary.completedCount} completed transactions`,
      TrendingUp,
      "bg-emerald-50 text-emerald-700",
    ),
    metric(
      "Transactions",
      String(transactions.length),
      `${summary.completedCount} completed in the current filters`,
      ReceiptText,
      "bg-orange-50 text-orange-700",
    ),
    metric(
      "Average Order",
      formatMoney(averageOrder),
      "Per completed transaction",
      Calculator,
      "bg-amber-50 text-amber-700",
    ),
    metric(
      "Most Used Payment",
      method,
      method === "Cash & GCash"
        ? "Usage is tied"
        : method === "—"
          ? "No completed sales"
          : `${Math.max(summary.methodCounts.Cash, summary.methodCounts.GCash)} transactions`,
      CreditCard,
      "bg-blue-50 text-blue-700",
    ),
  ];
  const secondaryMetrics = [
    metric(
      "Cash",
      formatMoney(summary.cashRevenue),
      `${summary.methodCounts.Cash} transactions`,
      Banknote,
      "bg-amber-50 text-amber-700",
    ),
    metric(
      "GCash",
      formatMoney(summary.gcashRevenue),
      `${summary.methodCounts.GCash} transactions`,
      CreditCard,
      "bg-blue-50 text-blue-700",
    ),
    metric(
      "Discounts",
      formatMoney(summary.discounts),
      "Completed sales only",
      Percent,
      "bg-violet-50 text-violet-700",
    ),
    metric(
      "Average Basket Size",
      `${averageBasket.toFixed(1)} items`,
      `${summary.basketQuantity} units sold`,
      ShoppingCart,
      "bg-rose-50 text-rose-700",
    ),
    metric(
      "Most Sold Item",
      summary.mostSoldItem?.name ?? "—",
      summary.mostSoldItem
        ? `${summary.mostSoldItem.quantity} units sold`
        : "No completed sales",
      UtensilsCrossed,
      "bg-lime-50 text-lime-700",
    ),
  ];

  return (
    <section className="space-y-3" aria-label="Filtered transaction summary">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} className="min-h-[126px]" />
        ))}
      </div>
      <div className="rounded-2xl border border-border/80 bg-[#fffaf5]/65 px-4 py-3.5 shadow-[0_2px_10px_rgba(67,42,23,0.025)]">
        <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground/65">
            Sales breakdown
          </h2>
          <p className="text-[9px] font-medium text-muted-foreground">
            Supporting totals for the current filters
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-5">
          {secondaryMetrics.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="flex min-w-0 items-start gap-2.5 border-border/70 lg:border-l lg:pl-4 lg:first:border-l-0 lg:first:pl-0"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-black/[0.03] ${item.tone}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                  <p
                    className="mt-0.5 truncate text-sm font-black text-foreground"
                    title={item.value}
                  >
                    {item.value}
                  </p>
                  <p
                    className="mt-0.5 truncate text-[9px] text-muted-foreground"
                    title={item.detail}
                  >
                    {item.detail}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function metric(
  label: string,
  value: string,
  detail: string,
  icon: typeof TrendingUp,
  tone: string,
) {
  return { label, value, detail, icon, tone };
}
