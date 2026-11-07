import type { Order, PaymentStatus } from "../types";
import { formatElapsedMinutes } from "../constants";
import { isOlderCashierOrder } from "../dashboard/workQueuePresentation";

/** Mirrors the ordinary cancel RPC's status and financial guards for action visibility. */
export function canCancelCashierOrder(order: Order): boolean {
  return Boolean(order.databaseId) && order.status === "Awaiting Payment" &&
    (order.paymentStatus === "Unpaid" || order.paymentStatus === "Rejected") &&
    !order.transactionId;
}

/** The operational-edit RPC alone decides final eligibility under a row lock. */
export function canEditCashierOrder(order: Order): boolean {
  return Boolean(order.databaseId) && [
    "Awaiting Payment", "Confirmed", "Preparing", "Ready", "Waiting for Rider",
  ].includes(order.status);
}

/** Cashiers can read their own profile, but profile RLS does not identify other actors. */
export function presentTimelineActor(actor: string, cashierId: string, cashierName: string) {
  const accountId = actor.startsWith("Account ") ? actor.slice("Account ".length) : undefined;
  if (!accountId) return { label: actor, technicalId: undefined };
  return {
    label: accountId === cashierId
      ? `${cashierName.trim() || "Current cashier"} (Cashier)`
      : "Recorded account (identity unavailable)",
    technicalId: accountId,
  };
}

export type OrderListView = "today" | "all" | "older";

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
  | "created"
  | "elapsed"
  | "priority"
  | "total";

export interface OrderSortDescriptor {
  key: OrderSortKey;
  direction: "asc" | "desc";
}

const TERMINAL_STATUSES = new Set<Order["status"]>([
  "Delivered",
  "Completed",
  "Cancelled",
]);

export function matchesOrderListView(order: Order, view: OrderListView, now: number) {
  if (view === "all") return true;
  if (TERMINAL_STATUSES.has(order.status)) return false;
  const older = isOlderCashierOrder(order.createdAt, now);
  return view === "older" ? older : !older;
}

export function getRecordedDeliveryFee(order: Order) {
  return order.type === "Delivery" &&
    typeof order.deliveryFee === "number" &&
    Number.isFinite(order.deliveryFee) && order.deliveryFee > 0
    ? order.deliveryFee : undefined;
}

export const elapsedOrderMinutes = (order: Order, now = Date.now()) => {
  const timestamp = new Date(order.createdAt).getTime();
  return Number.isFinite(timestamp)
    ? Math.max(0, Math.floor((now - timestamp) / 60_000))
    : 0;
};

export function getOrderWaitingPresentation(
  order: Order,
  thresholdMinutes: number,
  now = Date.now(),
) {
  const elapsedMinutes = elapsedOrderMinutes(order, now);
  const validTimestamp = Number.isFinite(new Date(order.createdAt).getTime());
  const active = !TERMINAL_STATUSES.has(order.status);
  const older = isOlderCashierOrder(order.createdAt, now);
  const delayed = active && !older && validTimestamp && elapsedMinutes > thresholdMinutes;
  const elapsedLabel = formatElapsedMinutes(elapsedMinutes);

  return {
    active,
    delayed,
    elapsedMinutes,
    label:
      !validTimestamp
        ? "Date unavailable"
        : active && older
        ? `Older unresolved · ${elapsedLabel} since placed`
        : !active
          ? order.status
          : delayed
            ? `${elapsedLabel} since placed · review`
            : `${elapsedLabel} since placed`,
  };
}

export const isOrderDelayed = (
  order: Order,
  thresholdMinutes: number,
  now = Date.now(),
) =>
  elapsedOrderMinutes(order, now) > thresholdMinutes &&
  !isOlderCashierOrder(order.createdAt, now) &&
  !TERMINAL_STATUSES.has(order.status);

export function getOrderPriority(
  order: Order,
  thresholdMinutes: number,
  now = Date.now(),
): OrderPriority {
  const elapsed = elapsedOrderMinutes(order, now);
  if (!TERMINAL_STATUSES.has(order.status)) {
    if (isOlderCashierOrder(order.createdAt, now)) return "Normal";
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
  if (order.status === "Awaiting Payment") return "Not yet applicable";
  if (order.riderAssignmentKnown === false) return "Assignment status unavailable";
  if (order.riderStatus) return order.riderStatus;
  if (order.assignedRider) return "Assigned";
  if (order.status === "Waiting for Rider")
    return order.riderAssignmentKnown === true ? "Waiting for rider" : "Assignment status unavailable";
  return "Not yet applicable";
}

export const getItemsSummary = (order: Order) =>
  order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ");

export function matchesOrderSearch(order: Order, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized ||
    `${order.id} ${order.customerName} ${order.contactNumber} ${getItemsSummary(order)} ${order.type}`
      .toLowerCase().includes(normalized);
}

export function matchesOrderPaymentStatus(order: Order, status: "All" | PaymentStatus) {
  return status === "All" || order.paymentStatus === status;
}

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
      if (fallback === "operations") {
        const leftCurrent = matchesOrderListView(left, "today", now);
        const rightCurrent = matchesOrderListView(right, "today", now);
        if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
        const leftBacklog = matchesOrderListView(left, "older", now);
        const rightBacklog = matchesOrderListView(right, "older", now);
        if (leftBacklog !== rightBacklog) return leftBacklog ? -1 : 1;
      }
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
  if (key === "created")
    return (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  if (key === "elapsed")
    return elapsedOrderMinutes(left, now) - elapsedOrderMinutes(right, now);
  if (key === "priority")
    return (
      priorityRank[getOrderPriority(left, delayedThreshold, now)] -
      priorityRank[getOrderPriority(right, delayedThreshold, now)]
    );
  return left.total - right.total;
}
