import type { Order } from "../types";

export const CASHIER_PAYMENT_BATCH_SIZE = 100;

export interface CashierOrderPaymentSummary {
  order_id: string;
  payment_method: "cash" | "gcash" | null;
  payment_status: "verified" | "voided" | null;
}

export async function loadCashierOrderPaymentSummaries(
  orderIds: string[],
  fetchBatch: (orderIds: string[]) => Promise<unknown>,
): Promise<Map<string, CashierOrderPaymentSummary>> {
  const summaries = new Map<string, CashierOrderPaymentSummary>();
  for (let start = 0; start < orderIds.length; start += CASHIER_PAYMENT_BATCH_SIZE) {
    const batch = orderIds.slice(start, start + CASHIER_PAYMENT_BATCH_SIZE);
    const response = await fetchBatch(batch);
    for (const [id, summary] of parseCashierOrderPaymentSummaries(batch, response)) {
      if (summaries.has(id)) throw new Error("Duplicate cashier payment summary.");
      summaries.set(id, summary);
    }
  }
  return summaries;
}

export function parseCashierOrderPaymentSummaries(
  requestedIds: string[],
  response: unknown,
): Map<string, CashierOrderPaymentSummary> {
  if (!Array.isArray(response)) throw new Error("Invalid cashier payment summary response.");
  const requested = new Set(requestedIds);
  const summaries = new Map<string, CashierOrderPaymentSummary>();
  for (const value of response) {
    if (!value || typeof value !== "object") throw new Error("Invalid cashier payment summary response.");
    const row = value as CashierOrderPaymentSummary;
    if (typeof row.order_id !== "string" || !requested.has(row.order_id) ||
        summaries.has(row.order_id) ||
        !["verified", "voided", null].includes(row.payment_status) ||
        !["cash", "gcash", null].includes(row.payment_method) ||
        Boolean(row.payment_status) !== Boolean(row.payment_method)) {
      throw new Error("Invalid cashier payment summary response.");
    }
    summaries.set(row.order_id, row);
  }
  return summaries;
}

export function applyCashierOrderPaymentSummaries(
  orders: Order[],
  summaries: Map<string, CashierOrderPaymentSummary>,
): Order[] {
  return orders.map((order) => {
    const summary = order.orderChannel === "walk_in" && order.databaseId
      ? summaries.get(order.databaseId)
      : undefined;
    if (summary && (!summary.payment_status || !summary.payment_method)) {
      return { ...order, paymentResolutionUncertain: true };
    }
    if (!summary?.payment_status || !summary.payment_method) return order;
    return {
      ...order,
      paymentResolutionUncertain: false,
      paymentMethod: summary.payment_method === "cash" ? "Cash" : "GCash",
      paymentStatus: summary.payment_status === "verified" ? "Verified" : "Voided",
    };
  });
}
