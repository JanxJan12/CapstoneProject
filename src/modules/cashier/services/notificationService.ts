import type { CashierNotification, CashierState } from "../types";
import { cloneState } from "./serviceUtils";

const LIVE_PREFIX = "cashier-live:";
const MAX_NOTIFICATIONS = 40;

/** Rebuild workstation alerts from the latest confirmed Cashier state. */
export function reconcileCashierNotifications(current: CashierState): CashierState {
  const previous = new Map(current.notifications.map((entry) => [entry.id, entry]));
  const live: CashierNotification[] = [];

  for (const payment of current.payments) {
    if (payment.status !== "Pending") continue;
    const id = `${LIVE_PREFIX}payment:${payment.id}:${payment.uploadedAt}`;
    live.push({
      id,
      title: "Payment needs verification",
      message: `Order ${payment.orderId} has a payment waiting for review.`,
      createdAt: payment.uploadedAt,
      read: previous.get(id)?.read ?? false,
      kind: "payment_submitted",
      page: "pending-payments",
      intent: { paymentOrderId: payment.orderId },
      orderId: payment.orderId,
    });
  }

  for (const order of current.orders) {
    if (!order.databaseId) continue;
    const detail = order.status === "Ready"
      ? { kind: "kitchen_ready" as const, title: "Order ready for handoff", message: `Order ${order.id} is ready for handoff.` }
      : order.status === "Waiting for Rider"
        ? { kind: "no_rider" as const, title: "Rider needed", message: `Order ${order.id} is waiting for a rider.` }
        : order.status === "Rider Accepted"
          ? { kind: "rider_accepted" as const, title: "Rider accepted", message: `A rider accepted order ${order.id}.` }
          : null;
    if (!detail) continue;
    const id = `${LIVE_PREFIX}order:${order.databaseId}:${order.status}`;
    live.push({
      id,
      ...detail,
      createdAt: order.updatedAt,
      read: previous.get(id)?.read ?? false,
      page: "order-list",
      intent: { search: order.id },
      orderId: order.id,
    });
  }

  const local = current.notifications.filter((entry) => !entry.id.startsWith(LIVE_PREFIX));
  return {
    ...current,
    notifications: [...live, ...local]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, MAX_NOTIFICATIONS),
  };
}

export function markNotificationsRead(current: CashierState): CashierState {
  const state = cloneState(current);
  state.notifications.forEach((entry) => {
    entry.read = true;
  });
  return state;
}

export function markNotificationRead(
  current: CashierState,
  notificationId: string,
): CashierState {
  const state = cloneState(current);
  const notification = state.notifications.find(
    (entry) => entry.id === notificationId,
  );
  if (notification) notification.read = true;
  return state;
}
