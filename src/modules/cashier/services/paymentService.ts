import { PAYMENT_REJECTION_REASONS } from "../constants";
import { getPaymentVerificationIssues } from "../payments/paymentVerification";
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
  paymentId: string,
  overrideMismatch: boolean,
): CashierState {
  const state = cloneState(current);
  const shift = requireOpenShift(state);
  const payment = state.payments.find((entry) => entry.id === paymentId);
  const order = state.orders.find((entry) => entry.id === payment?.orderId);
  if (!order || !payment) throw new Error("Payment record could not be found.");
  if (payment.status !== "Pending" || order.paymentStatus !== "Pending")
    throw new Error("This payment has already been processed.");
  const verificationIssues = getPaymentVerificationIssues(
    payment,
    order,
    state.payments,
  );
  if (verificationIssues.length && !overrideMismatch)
    throw new Error(
      `Resolve or explicitly override: ${verificationIssues.map((issue) => issue.label).join(", ")}.`,
    );

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
  state.notifications.unshift(
    {
      id: nextEventId(),
      title: "Kitchen ticket created",
      message: `${order.id} was confirmed and added to the kitchen queue.`,
      createdAt: timestamp,
      read: false,
      customerVisible: false,
      kind: "record_updated",
      page: "order-list",
      intent: { statuses: ["Confirmed"], search: order.id },
      orderId: order.id,
    },
    {
      id: nextEventId(),
      title: "Payment verified",
      message: `${order.id} payment was verified successfully.`,
      createdAt: timestamp,
      read: false,
      customerVisible: true,
      kind: "record_updated",
      page: "order-list",
      intent: { search: order.id },
      orderId: order.id,
    },
  );
  addActivity(
    state,
    "payment_verified",
    `${state.cashier.name} verified payment for ${order.id}`,
    order.id,
    transactionId,
  );
  return state;
}

export function rejectOnlinePayment(
  current: CashierState,
  paymentId: string,
  reason: string,
  notes?: string,
): CashierState {
  const state = cloneState(current);
  const payment = state.payments.find((entry) => entry.id === paymentId);
  const order = state.orders.find((entry) => entry.id === payment?.orderId);
  if (!order || !payment) throw new Error("Payment record could not be found.");
  if (payment.status !== "Pending")
    throw new Error("This payment has already been processed.");
  const normalizedReason = reason.trim();
  if (
    !PAYMENT_REJECTION_REASONS.includes(
      normalizedReason as (typeof PAYMENT_REJECTION_REASONS)[number],
    )
  )
    throw new Error("Select a valid rejection reason.");
  const normalizedNotes = notes?.trim();
  if (normalizedReason === "Other" && !normalizedNotes)
    throw new Error("Explain the rejection reason when Other is selected.");
  const timestamp = timestampNow();
  payment.status = "Rejected";
  payment.rejectedBy = state.cashier.id;
  payment.rejectedAt = timestamp;
  payment.rejectionReason = normalizedReason;
  payment.rejectionNotes = normalizedNotes || undefined;
  order.paymentStatus = "Rejected";
  order.status = "Awaiting Payment";
  addTimeline(
    order,
    "Awaiting Payment",
    `Payment rejected: ${normalizedReason}`,
    state.cashier.name,
    timestamp,
  );
  state.notifications.unshift({
    id: nextEventId(),
    title: "Payment needs resubmission",
    message: `${order.id}: ${normalizedReason}.`,
    createdAt: timestamp,
    read: false,
    customerVisible: true,
    kind: "payment_submitted",
    page: "pending-payments",
    orderId: order.id,
  });
  addActivity(
    state,
    "payment_rejected",
    `${state.cashier.name} rejected payment for ${order.id}`,
    order.id,
  );
  return state;
}
