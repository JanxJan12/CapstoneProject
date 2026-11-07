import type { Order } from "./types";
import type { HistoryRow } from "./transactions/historyReadApi";

/** The history RPC already scopes rows to the signed-in Cashier; keep exact FK checks here. */
export function selectAuthorizedReceipt(order: Order, cashierId: string, rows: HistoryRow[]) {
  return rows.find((row) =>
    row.cashier_id === cashierId &&
    row.order_id === order.databaseId &&
    row.order_number === order.id &&
    (!order.transactionId || row.id === order.transactionId),
  );
}

export function findAccessibleOrder(linkedOrder: Order | undefined, orders: Order[]) {
  if (!linkedOrder?.databaseId) return undefined;
  return orders.find((order) =>
    order.id === linkedOrder.id && order.databaseId === linkedOrder.databaseId,
  );
}
