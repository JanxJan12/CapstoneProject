import type { Order, PaymentMethod, Transaction } from "../types";
import { getBasketQuantity } from "./transactionRecords";

export interface TransactionSummaryMetrics {
  revenue: number;
  cashRevenue: number;
  gcashRevenue: number;
  refunds: number;
  refundCount: number;
  discounts: number;
  voids: number;
  voidCount: number;
  completedCount: number;
  basketQuantity: number;
  mostSoldItem?: { name: string; quantity: number };
  mostUsedMethod?: PaymentMethod | "Cash & GCash";
  methodCounts: Record<PaymentMethod, number>;
}

export function calculateTransactionSummary(
  transactions: Transaction[],
  orders: Order[],
): TransactionSummaryMetrics {
  const completed = transactions.filter(
    (entry) => entry.status === "Completed",
  );
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const linkedOrders = completed
    .map((transaction) => orderById.get(transaction.orderId))
    .filter((order): order is Order => Boolean(order));
  const revenue = completed.reduce((sum, entry) => sum + entry.amount, 0);
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
  const methodCounts: Record<PaymentMethod, number> = { Cash: 0, GCash: 0 };
  for (const transaction of completed) methodCounts[transaction.method] += 1;
  const mostUsedMethod = completed.length
    ? methodCounts.Cash === methodCounts.GCash
      ? "Cash & GCash"
      : methodCounts.Cash > methodCounts.GCash
        ? "Cash"
        : "GCash"
    : undefined;

  return {
    revenue,
    cashRevenue: completed
      .filter((entry) => entry.method === "Cash")
      .reduce((sum, entry) => sum + entry.amount, 0),
    gcashRevenue: completed
      .filter((entry) => entry.method === "GCash")
      .reduce((sum, entry) => sum + entry.amount, 0),
    refunds: transactions
      .filter((entry) => entry.status === "Refunded")
      .reduce((sum, entry) => sum + (entry.refundAmount ?? entry.amount), 0),
    refundCount: transactions.filter((entry) => entry.status === "Refunded")
      .length,
    discounts: completed.reduce((sum, entry) => sum + entry.discountAmount, 0),
    voids: transactions
      .filter((entry) => entry.status === "Voided")
      .reduce((sum, entry) => sum + entry.amount, 0),
    voidCount: transactions.filter((entry) => entry.status === "Voided").length,
    completedCount: completed.length,
    basketQuantity,
    mostSoldItem: mostSold
      ? { name: mostSold[0], quantity: mostSold[1] }
      : undefined,
    mostUsedMethod,
    methodCounts,
  };
}
