import { useMemo } from "react";
import {
  Banknote,
  Calculator,
  CreditCard,
  Percent,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  UtensilsCrossed,
  XCircle,
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
  const cards = [
    metric(
      "Revenue",
      formatMoney(summary.revenue),
      `${summary.completedCount} completed transactions`,
      TrendingUp,
      "bg-emerald-50 text-emerald-700",
    ),
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
      "Refunds",
      formatMoney(summary.refunds),
      `${summary.refundCount} records`,
      RotateCcw,
      "bg-sky-50 text-sky-700",
    ),
    metric(
      "Discounts",
      formatMoney(summary.discounts),
      "Completed sales only",
      Percent,
      "bg-violet-50 text-violet-700",
    ),
    metric(
      "Voids",
      formatMoney(summary.voids),
      `${summary.voidCount} audit records`,
      XCircle,
      "bg-zinc-100 text-zinc-700",
    ),
    metric(
      "Average Order",
      formatMoney(averageOrder),
      "Per completed transaction",
      Calculator,
      "bg-orange-50 text-orange-700",
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
    metric(
      "Most Used Payment",
      method,
      method === "Cash & GCash"
        ? "Usage is tied"
        : method === "—"
          ? "No completed sales"
          : `${Math.max(summary.methodCounts.Cash, summary.methodCounts.GCash)} transactions`,
      ReceiptText,
      "bg-cyan-50 text-cyan-700",
    ),
  ];

  return (
    <section aria-label="Filtered transaction summary">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
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
