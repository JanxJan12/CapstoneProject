import type { Order } from "../types";

export type OrderPriority = "Critical" | "High" | "Normal" | "Low";
export type BaseOrderSort =
  "operations" | "newest" | "oldest" | "total-high" | "total-low";
export type OrderSortKey =
  | "orderNumber"
  | "customer"
  | "phone"
  | "items"
  | "type"
  | "kitchen"
  | "payment"
  | "rider"
  | "elapsed"
  | "priority"
  | "total";

export interface OrderSortDescriptor {
  key: OrderSortKey;
  direction: "asc" | "desc";
}

const TERMINAL_STATUSES = ["Delivered", "Completed", "Cancelled"];

export const elapsedOrderMinutes = (order: Order, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));

export function formatElapsedMinutes(minutes: number) {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export const isOrderDelayed = (
  order: Order,
  thresholdMinutes: number,
  now = Date.now(),
) =>
  elapsedOrderMinutes(order, now) > thresholdMinutes &&
  !TERMINAL_STATUSES.includes(order.status);

export function getOrderPriority(
  order: Order,
  thresholdMinutes: number,
  now = Date.now(),
): OrderPriority {
  const elapsed = elapsedOrderMinutes(order, now);
  if (!TERMINAL_STATUSES.includes(order.status)) {
    if (elapsed > thresholdMinutes * 2) return "Critical";
    if (elapsed > thresholdMinutes || order.status === "Ready") return "High";
    return "Normal";
  }
  return "Low";
}

export function getKitchenStatus(order: Order) {
  if (order.status === "Awaiting Payment") return "Not released";
  if (order.status === "Confirmed") return "Queued";
  if (order.status === "Preparing") return "Preparing";
  if (order.status === "Ready") return "Ready";
  if (order.status === "Cancelled") return "Cancelled";
  return "Complete";
}

export function getRiderStatus(order: Order) {
  if (order.type !== "Delivery") return "Not required";
  if (order.riderStatus) return order.riderStatus;
  if (order.assignedRider) return "Assigned";
  return "Unassigned";
}

export const getItemsSummary = (order: Order) =>
  order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ");

const priorityRank: Record<OrderPriority, number> = {
  Critical: 4,
  High: 3,
  Normal: 2,
  Low: 1,
};

export function sortOperationalOrders(
  orders: Order[],
  descriptors: OrderSortDescriptor[],
  delayedThreshold: number,
  now: number,
  fallback: BaseOrderSort,
) {
  return [...orders].sort((left, right) => {
    const leftDelayed = isOrderDelayed(left, delayedThreshold, now);
    const rightDelayed = isOrderDelayed(right, delayedThreshold, now);
    if (leftDelayed !== rightDelayed) return leftDelayed ? -1 : 1;

    if (descriptors.length) {
      for (const descriptor of descriptors) {
        const result = compareByKey(
          left,
          right,
          descriptor.key,
          delayedThreshold,
          now,
        );
        if (result !== 0)
          return descriptor.direction === "asc" ? result : -result;
      }
    } else {
      const fallbackResult = compareFallback(
        left,
        right,
        fallback,
        delayedThreshold,
        now,
      );
      if (fallbackResult !== 0) return fallbackResult;
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

function compareFallback(
  left: Order,
  right: Order,
  fallback: BaseOrderSort,
  delayedThreshold: number,
  now: number,
) {
  if (fallback === "oldest")
    return (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  if (fallback === "total-high") return right.total - left.total;
  if (fallback === "total-low") return left.total - right.total;
  if (fallback === "operations") {
    const priority =
      priorityRank[getOrderPriority(right, delayedThreshold, now)] -
      priorityRank[getOrderPriority(left, delayedThreshold, now)];
    return (
      priority ||
      elapsedOrderMinutes(right, now) - elapsedOrderMinutes(left, now)
    );
  }
  return (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function compareByKey(
  left: Order,
  right: Order,
  key: OrderSortKey,
  delayedThreshold: number,
  now: number,
) {
  if (key === "orderNumber")
    return left.id.localeCompare(right.id, undefined, { numeric: true });
  if (key === "customer")
    return left.customerName.localeCompare(right.customerName);
  if (key === "phone")
    return left.contactNumber.localeCompare(right.contactNumber);
  if (key === "items") {
    const leftItems = left.items.reduce((sum, item) => sum + item.quantity, 0);
    const rightItems = right.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    return leftItems - rightItems;
  }
  if (key === "type") return left.type.localeCompare(right.type);
  if (key === "kitchen")
    return getKitchenStatus(left).localeCompare(getKitchenStatus(right));
  if (key === "payment")
    return left.paymentStatus.localeCompare(right.paymentStatus);
  if (key === "rider")
    return getRiderStatus(left).localeCompare(getRiderStatus(right));
  if (key === "elapsed")
    return elapsedOrderMinutes(left, now) - elapsedOrderMinutes(right, now);
  if (key === "priority")
    return (
      priorityRank[getOrderPriority(left, delayedThreshold, now)] -
      priorityRank[getOrderPriority(right, delayedThreshold, now)]
    );
  return left.total - right.total;
}
