import type { CashierState } from "../types";
import {
  addActivity,
  addTimeline,
  cloneState,
  nextEventId,
  nextRecordId,
  requireOpenShift,
  timestampNow,
} from "./serviceUtils";

export function verifyOnlinePayment(
  current: CashierState,
  orderId: string,
  overrideMismatch: boolean,
): CashierState {
  const state = cloneState(current);
  const shift = requireOpenShift(state);
  const order = state.orders.find((entry) => entry.id === orderId);
  const payment = state.payments.find((entry) => entry.orderId === orderId);
  if (!order || !payment) throw new Error("Payment record could not be found.");
  if (payment.status !== "Pending" || order.paymentStatus !== "Pending")
    throw new Error("This payment has already been processed.");
  if (payment.amount !== payment.submittedAmount && !overrideMismatch)
    throw new Error("Submitted amount does not match the order total.");

  const timestamp = timestampNow();
  payment.status = "Verified";
  payment.verifiedBy = state.cashier.id;
  payment.verifiedAt = timestamp;
  payment.overrideMismatch = overrideMismatch;
  order.paymentStatus = "Verified";
  order.status = "Confirmed";
  order.cashierId = state.cashier.id;
  order.shiftId = shift.id;
  addTimeline(
    order,
    "Confirmed",
    overrideMismatch
      ? "Payment verified with amount override; sent to kitchen"
      : "Payment verified; sent to kitchen",
    state.cashier.name,
    timestamp,
  );

  const transactionId = nextRecordId("TXN", state.transactions);
  order.transactionId = transactionId;
  state.transactions.unshift({
    id: transactionId,
    orderId: order.id,
    customerName: order.customerName,
    amount: order.total,
    discountAmount: order.discountAmount,
    method: "GCash",
    status: "Completed",
    cashierId: state.cashier.id,
    cashierName: state.cashier.name,
    shiftId: shift.id,
    paymentId: payment.id,
    createdAt: timestamp,
  });
  state.notifications.unshift({
    id: nextEventId(),
    title: "Payment verified",
    message: `${order.id} was confirmed and sent to the kitchen.`,
    createdAt: timestamp,
    read: false,
    customerVisible: true,
  });
  addActivity(
    state,
    "payment_verified",
    `${state.cashier.name} verified payment for ${order.id}`,
    order.id,
  );
  return state;
}

export function rejectOnlinePayment(
  current: CashierState,
  orderId: string,
  reason: string,
  notes?: string,
): CashierState {
  const state = cloneState(current);
  const order = state.orders.find((entry) => entry.id === orderId);
  const payment = state.payments.find((entry) => entry.orderId === orderId);
  if (!order || !payment) throw new Error("Payment record could not be found.");
  if (payment.status !== "Pending")
    throw new Error("This payment has already been processed.");
  const timestamp = timestampNow();
  payment.status = "Rejected";
  payment.rejectedBy = state.cashier.id;
  payment.rejectedAt = timestamp;
  payment.rejectionReason = reason;
  payment.rejectionNotes = notes;
  order.paymentStatus = "Rejected";
  addTimeline(
    order,
    "Awaiting Payment",
    `Payment rejected: ${reason}`,
    state.cashier.name,
    timestamp,
  );
  state.notifications.unshift({
    id: nextEventId(),
    title: "Payment needs resubmission",
    message: `${order.id}: ${reason}.`,
    createdAt: timestamp,
    read: false,
    customerVisible: true,
  });
  addActivity(
    state,
    "payment_rejected",
    `${state.cashier.name} rejected payment for ${order.id}`,
    order.id,
  );
  return state;
}
