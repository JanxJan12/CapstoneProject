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
import { formatMoney } from "../constants";
import type { Order, Transaction } from "../types";
import { getBasketQuantity } from "./transactionRecords";

export function TransactionSummary({
  transactions,
  orders,
}: {
  transactions: Transaction[];
  orders: Order[];
}) {
  const completed = transactions.filter(
    (transaction) => transaction.status === "Completed",
  );
  const linkedOrders = completed
    .map((transaction) =>
      orders.find((order) => order.id === transaction.orderId),
    )
    .filter((order): order is Order => Boolean(order));
  const revenue = completed.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const basketQuantity = linkedOrders.reduce(
    (sum, order) => sum + getBasketQuantity(order),
    0,
  );
  const itemSales = new Map<string, number>();
  for (const order of linkedOrders) {
    for (const item of order.items) {
      itemSales.set(item.name, (itemSales.get(item.name) ?? 0) + item.quantity);
    }
  }
  const mostSold = [...itemSales.entries()].sort((a, b) => b[1] - a[1])[0];
  const methodCounts = completed.reduce(
    (counts, transaction) => {
      counts[transaction.method] += 1;
      return counts;
    },
    { Cash: 0, GCash: 0 },
  );
  const mostUsedMethod = completed.length
    ? methodCounts.Cash === methodCounts.GCash
      ? "Cash & GCash"
      : methodCounts.Cash > methodCounts.GCash
        ? "Cash"
        : "GCash"
    : "—";

  const cards = [
    {
      label: "Revenue",
      value: formatMoney(revenue),
      detail: `${completed.length} completed transactions`,
      icon: TrendingUp,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Cash",
      value: formatMoney(
        completed
          .filter((transaction) => transaction.method === "Cash")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      ),
      detail: `${methodCounts.Cash} transactions`,
      icon: Banknote,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "GCash",
      value: formatMoney(
        completed
          .filter((transaction) => transaction.method === "GCash")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      ),
      detail: `${methodCounts.GCash} transactions`,
      icon: CreditCard,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Refunds",
      value: formatMoney(
        transactions
          .filter((transaction) => transaction.status === "Refunded")
          .reduce(
            (sum, transaction) =>
              sum + (transaction.refundAmount ?? transaction.amount),
            0,
          ),
      ),
      detail: `${transactions.filter((transaction) => transaction.status === "Refunded").length} records`,
      icon: RotateCcw,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Discounts",
      value: formatMoney(
        completed.reduce(
          (sum, transaction) => sum + transaction.discountAmount,
          0,
        ),
      ),
      detail: "Completed sales only",
      icon: Percent,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Voids",
      value: formatMoney(
        transactions
          .filter((transaction) => transaction.status === "Voided")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      ),
      detail: `${transactions.filter((transaction) => transaction.status === "Voided").length} audit records`,
      icon: XCircle,
      tone: "bg-zinc-100 text-zinc-700",
    },
    {
      label: "Average Order",
      value: formatMoney(completed.length ? revenue / completed.length : 0),
      detail: "Per completed transaction",
      icon: Calculator,
      tone: "bg-orange-50 text-orange-700",
    },
    {
      label: "Average Basket Size",
      value: completed.length
        ? `${(basketQuantity / completed.length).toFixed(1)} items`
        : "0 items",
      detail: `${basketQuantity} units sold`,
      icon: ShoppingCart,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: "Most Sold Item",
      value: mostSold?.[0] ?? "—",
      detail: mostSold ? `${mostSold[1]} units sold` : "No completed sales",
      icon: UtensilsCrossed,
      tone: "bg-lime-50 text-lime-700",
    },
    {
      label: "Most Used Payment",
      value: mostUsedMethod,
      detail:
        mostUsedMethod === "Cash & GCash"
          ? "Usage is tied"
          : mostUsedMethod === "—"
            ? "No completed sales"
            : `${Math.max(methodCounts.Cash, methodCounts.GCash)} transactions`,
      icon: ReceiptText,
      tone: "bg-cyan-50 text-cyan-700",
    },
  ];

  return (
    <section aria-label="Filtered transaction summary">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <div
            key={label}
            className="rrj-card rrj-card-hover group relative min-w-0 overflow-hidden p-3.5"
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/[0.03] transition-transform group-hover:scale-105 ${tone}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <p
              className="mt-1 truncate text-base font-black text-foreground"
              title={value}
            >
              {value}
            </p>
            <p
              className="mt-0.5 truncate text-[9px] text-muted-foreground"
              title={detail}
            >
              {detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
